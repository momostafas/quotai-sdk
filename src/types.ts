/** Built-in API base URLs keyed by environment name. */
export type QuotaiEnvironment = 'production' | 'staging' | 'development';

/** Query filters supported by `GET /api/public/translations`. */
export type TranslationStatus = 'pending' | 'translated' | 'reviewed' | 'approved';

export interface QuotaiClientConfig {
  /**
   * Project API key (`qk_…`). Falls back to `process.env.QUOTAI_API_KEY` in Node.js when omitted.
   * Avoid exposing this in browser bundles; pass it only from server-side code.
   */
  apiKey?: string;

  /**
   * API origin. Use a preset via `environment`, or set `baseUrl` explicitly (wins over `environment`).
   * @default 'production' → https://quotai.net
   */
  environment?: QuotaiEnvironment;
  baseUrl?: string;

  /** Default locale for `getString` / `getMessages` (e.g. `en`). Loaded from project info when omitted. */
  locale?: string;

  /** Default branch MongoDB id (`branch_id` query param). Uses the project main branch when omitted. */
  branch?: string;

  /** In-memory cache TTL in milliseconds. Set to `0` to disable caching. @default 60_000 */
  cacheTTL?: number;

  /** Per-request network timeout in milliseconds. @default 15_000 */
  timeout?: number;

  /** Optional filters applied to every pull request. */
  status?: TranslationStatus | TranslationStatus[];
  tags?: string[];

  /** Custom `fetch` implementation (testing or polyfills). */
  fetch?: typeof fetch;
}

export interface LocaleBranchOptions {
  locale?: string;
  branch?: string;
}

export interface GetStringOptions extends LocaleBranchOptions {
  /** Returned when the key is missing or the API is unreachable. Defaults to the key itself. */
  fallback?: string;
}

export interface PushKeyInput {
  key: string;
  defaultValue: string;
  context?: string;
  tags?: string[];
}

export interface PublicProjectInfo {
  project_id: string;
  name: string;
  source_language: string;
  target_languages: string[];
  status: string;
}

/** Flat map returned by `GET /api/public/translations?language=…&format=flat`. */
export type FlatTranslations = Record<string, string>;

/** All languages: `{ en: { key: value }, es: { … } }`. */
export type MultiLanguageTranslations = Record<string, FlatTranslations>;

export interface PushKeysRequestBody {
  keys: Array<{
    key: string;
    default_text: string;
    context?: string;
    tags?: string[];
  }>;
  branch_id?: string;
}

export interface PushKeysResultItem {
  success: boolean;
  key: string;
  id?: string;
  error?: string;
}

export interface PushKeysResponse {
  results: PushKeysResultItem[];
  created: number;
  skipped: number;
}

export interface ApiErrorBody {
  error?: string;
}

export type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};
