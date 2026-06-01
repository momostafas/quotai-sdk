# quotai-sdk

Official TypeScript/JavaScript client for the [Quotai](https://quotai.net) public translation API.

Pull translations into your app at runtime, resolve individual keys with fallbacks, and push newly extracted strings back to your Quotai project.

**npm:** [quotai-sdk](https://www.npmjs.com/package/quotai-sdk)

## Requirements

- Node.js **18+** (uses native `fetch`)
- A Quotai project **API key** (`qk_…`) from [quotai.net](https://quotai.net) → Project → Settings → API Key

## Install

```bash
npm install quotai-sdk
```

## Quick start

```ts
import { QuotaiClient } from 'quotai-sdk';

const quotai = new QuotaiClient({
  apiKey: process.env.QUOTAI_API_KEY,
  environment: 'production', // https://quotai.net
  locale: 'en',
});

const info = await quotai.getProjectInfo();
console.log(info.name, info.target_languages);

const title = await quotai.getString('home.hero.title', {
  fallback: 'Welcome',
});

const messages = await quotai.getMessages({ locale: 'en' });
// { "home.hero.title": "Welcome", ... } — flat map for next-intl, vue-i18n, etc.
```

### Environment variable

In Node.js you can omit `apiKey` if `QUOTAI_API_KEY` is set:

```ts
const quotai = new QuotaiClient({ locale: 'en' });
```

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| `apiKey` | Project API key (`qk_…`) | `process.env.QUOTAI_API_KEY` |
| `environment` | `production` \| `staging` \| `development` | `production` |
| `baseUrl` | Override API origin (wins over `environment`) | — |
| `locale` | Default locale for `getString` / `getMessages` | Project source language |
| `branch` | Branch id (`branch_id` query param) | Main branch |
| `cacheTTL` | In-memory cache TTL (ms); `0` disables | `60000` |
| `timeout` | Request timeout (ms) | `15000` |
| `status` | Filter by translation status | — |
| `tags` | Filter by tags | — |
| `fetch` | Custom `fetch` (tests, abort signals) | `globalThis.fetch` |

### Built-in base URLs

| `environment` | URL |
|---------------|-----|
| `production` | `https://quotai.net` |
| `staging` | `https://staging.quotai.net` |
| `development` | `http://localhost:5001` |

## API

### `getProjectInfo()`

Returns project metadata (`GET /api/public/project-info`).

```ts
const info = await quotai.getProjectInfo();
// { project_id, name, source_language, target_languages, status }
```

### `getMessages(options?)`

Returns a flat `key → string` map for one locale (`GET /api/public/translations?language=…&format=flat`).

```ts
const en = await quotai.getMessages({ locale: 'en' });
const fr = await quotai.getMessages({ locale: 'fr', branch: 'branch_id_here' });
```

### `getString(key, options?)`

Resolves a single key with caching and safe fallbacks.

```ts
const text = await quotai.getString('nav.home', {
  locale: 'de',
  fallback: 'Home',
});
```

### `pushKeys(keys, branch?)`

Creates new keys on your project (`POST /api/public/keys`). Existing keys on the same branch are skipped.

```ts
await quotai.pushKeys([
  { key: 'checkout.title', defaultValue: 'Checkout', context: 'Payment page heading' },
  { key: 'checkout.submit', defaultValue: 'Pay now', tags: ['checkout'] },
]);
```

### `clearCache()`

Clears the in-memory translation cache (for example after `pushKeys`).

## Next.js (App Router)

Use the SDK **only on the server** — never expose `QUOTAI_API_KEY` in client bundles.

```ts
// lib/quotai.ts
import { QuotaiClient } from 'quotai-sdk';

export const quotai = new QuotaiClient({
  apiKey: process.env.QUOTAI_API_KEY,
  locale: 'en',
  cacheTTL: 120_000,
});

export async function getQuotaiMessages(locale: string) {
  return quotai.getMessages({ locale });
}
```

See [`examples/nextjs-app-router.ts`](./examples/nextjs-app-router.ts).

## Node script

```bash
QUOTAI_API_KEY=qk_your_key node examples/node-script.mjs
```

See [`examples/node-script.mjs`](./examples/node-script.mjs).

## Security

- **Server-side only** for production apps that use an API key.
- If you must load translations in the browser, use a backend proxy or Quotai LiveSync with a public delivery endpoint — do not embed `qk_…` keys in frontend bundles.

## Development

```bash
cd sdk
npm install
npm run build
```

Publish to npm:

```bash
npm publish
```

## License

MIT
