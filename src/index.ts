import type {
  ApiErrorBody,
  CacheEntry,
  FlatTranslations,
  GetStringOptions,
  LocaleBranchOptions,
  PublicProjectInfo,
  PushKeyInput,
  PushKeysResponse,
  QuotaiClientConfig,
  QuotaiEnvironment,
} from './types.js';

export type {
  ApiErrorBody,
  CacheEntry,
  FlatTranslations,
  GetStringOptions,
  LocaleBranchOptions,
  MultiLanguageTranslations,
  PublicProjectInfo,
  PushKeyInput,
  PushKeysRequestBody,
  PushKeysResponse,
  PushKeysResultItem,
  QuotaiClientConfig,
  QuotaiEnvironment,
  TranslationStatus,
} from './types.js';

const ENVIRONMENT_BASE_URLS: Record<QuotaiEnvironment, string> = {
  production: 'https://quotai.net',
  staging: 'https://staging.quotai.net',
  development: 'http://localhost:5001',
};

const DEFAULT_CACHE_TTL_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 15_000;

function joinUrl(base: string, path: string): string {
  const normalizedBase = base.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function readEnvApiKey(): string | undefined {
  if (typeof process === 'undefined') return undefined;
  const value = process.env?.QUOTAI_API_KEY;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function resolveBaseUrl(config: QuotaiClientConfig): string {
  if (config.baseUrl?.trim()) {
    return config.baseUrl.trim().replace(/\/+$/, '');
  }
  const env = config.environment ?? 'production';
  return ENVIRONMENT_BASE_URLS[env];
}

function cacheKey(parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(':');
}

/**
 * Lightweight, typed client for the Quotai public API (`/api/public/*`).
 *
 * @example
 * ```ts
 * const quotai = new QuotaiClient({ apiKey: process.env.QUOTAI_API_KEY });
 * const title = await quotai.getString('home.title');
 * ```
 */
export class QuotaiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultLocale?: string;
  private readonly defaultBranch?: string;
  private readonly cacheTTL: number;
  private readonly timeout: number;
  private readonly status?: string;
  private readonly tags?: string;
  private readonly fetchFn: typeof fetch;
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private projectInfoPromise?: Promise<PublicProjectInfo>;

  constructor(config: QuotaiClientConfig = {}) {
    const apiKey = config.apiKey?.trim() ?? readEnvApiKey();
    if (!apiKey) {
      throw new Error(
        'QuotaiClient requires an apiKey in config or QUOTAI_API_KEY in the environment.',
      );
    }

    this.apiKey = apiKey;
    this.baseUrl = resolveBaseUrl(config);
    this.defaultLocale = config.locale?.trim();
    this.defaultBranch = config.branch?.trim();
    this.cacheTTL = config.cacheTTL ?? DEFAULT_CACHE_TTL_MS;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = config.fetch ?? fetch;

    if (config.status) {
      const list = Array.isArray(config.status) ? config.status : [config.status];
      this.status = list.join(',');
    }
    if (config.tags?.length) {
      this.tags = config.tags.join(',');
    }
  }

  /** Project metadata (`GET /api/public/project-info`). */
  async getProjectInfo(): Promise<PublicProjectInfo> {
    if (!this.projectInfoPromise) {
      this.projectInfoPromise = this.requestJson<PublicProjectInfo>(
        '/api/public/project-info',
      );
    }
    return this.projectInfoPromise;
  }

  /**
   * Fetch all key/value pairs for a locale and branch.
   * Uses `format=flat` for direct use with next-intl, react-intl, etc.
   */
  async getMessages(options: LocaleBranchOptions = {}): Promise<FlatTranslations> {
    const locale = await this.resolveLocale(options.locale);
    const branch = options.branch ?? this.defaultBranch;
    const key = cacheKey(['messages', locale, branch]);

    const cached = this.readCache<FlatTranslations>(key);
    if (cached) return cached;

    const params = new URLSearchParams({
      language: locale,
      format: 'flat',
    });
    if (branch) params.set('branch_id', branch);
    if (this.status) params.set('status', this.status);
    if (this.tags) params.set('tags', this.tags);

    const data = await this.requestJson<FlatTranslations>(
      `/api/public/translations?${params.toString()}`,
    );

    const messages =
      data && typeof data === 'object' && !Array.isArray(data) ? data : {};

    this.writeCache(key, messages);
    return messages;
  }

  /**
   * Resolve a single translation key with caching and safe fallbacks.
   */
  async getString(key: string, options: GetStringOptions = {}): Promise<string> {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      return options.fallback ?? '';
    }

    const locale = await this.resolveLocale(options.locale);
    const branch = options.branch ?? this.defaultBranch;
    const fallback = options.fallback ?? trimmedKey;
    const singleCacheKey = cacheKey(['string', locale, branch, trimmedKey]);

    const cachedSingle = this.readCache<string>(singleCacheKey);
    if (cachedSingle !== undefined) return cachedSingle;

    try {
      const params = new URLSearchParams({
        language: locale,
        format: 'flat',
        keys: trimmedKey,
      });
      if (branch) params.set('branch_id', branch);
      if (this.status) params.set('status', this.status);
      if (this.tags) params.set('tags', this.tags);

      const data = await this.requestJson<FlatTranslations>(
        `/api/public/translations?${params.toString()}`,
      );

      const value = data?.[trimmedKey];
      if (typeof value === 'string' && value.length > 0) {
        this.writeCache(singleCacheKey, value);
        return value;
      }

      const messages = await this.getMessages({ locale, branch });
      const fromBulk = messages[trimmedKey];
      if (typeof fromBulk === 'string' && fromBulk.length > 0) {
        this.writeCache(singleCacheKey, fromBulk);
        return fromBulk;
      }

      return fallback;
    } catch {
      const messages = this.readCache<FlatTranslations>(
        cacheKey(['messages', locale, branch]),
      );
      const stale = messages?.[trimmedKey];
      if (typeof stale === 'string' && stale.length > 0) {
        return stale;
      }
      return fallback;
    }
  }

  /**
   * Push newly extracted keys to Quotai (`POST /api/public/keys`).
   * Existing keys on the same branch are skipped (not overwritten).
   */
  async pushKeys(keys: PushKeyInput[], branch?: string): Promise<void> {
    if (!keys.length) return;

    const branchId = branch ?? this.defaultBranch;
    const body = {
      keys: keys.map((item) => ({
        key: item.key,
        default_text: item.defaultValue,
        ...(item.context ? { context: item.context } : {}),
        ...(item.tags?.length ? { tags: item.tags } : {}),
      })),
      ...(branchId ? { branch_id: branchId } : {}),
    };

    await this.requestJson<PushKeysResponse>('/api/public/keys', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    this.clearCache();
  }

  /** Drop all in-memory cached translations. */
  clearCache(): void {
    this.cache.clear();
  }

  private async resolveLocale(locale?: string): Promise<string> {
    const explicit = locale?.trim() ?? this.defaultLocale?.trim();
    if (explicit) return explicit;

    const info = await this.getProjectInfo();
    return info.source_language || 'en';
  }

  private readCache<T>(key: string): T | undefined {
    if (this.cacheTTL <= 0) return undefined;
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  private writeCache<T>(key: string, value: T): void {
    if (this.cacheTTL <= 0) return;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.cacheTTL,
    });
  }

  private async requestJson<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const url = joinUrl(this.baseUrl, path);
      const response = await this.fetchFn(url, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          ...(init.headers ?? {}),
        },
      });

      if (!response.ok) {
        let message = `Quotai API ${response.status}`;
        try {
          const errBody = (await response.json()) as ApiErrorBody;
          if (errBody?.error) message = `${message}: ${errBody.error}`;
        } catch {
          const text = await response.text().catch(() => '');
          if (text) message = `${message}: ${text.slice(0, 200)}`;
        }
        throw new Error(message);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Quotai request timed out after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export default QuotaiClient;
