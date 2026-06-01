/**
 * Node.js 18+ script — sync keys and print a greeting.
 *
 *   QUOTAI_API_KEY=qk_… node examples/node-script.mjs
 */
import { QuotaiClient } from '../dist/index.js';

const quotai = new QuotaiClient({
  environment: process.env.QUOTAI_ENV === 'production' ? 'production' : 'development',
  locale: 'en',
  branch: process.env.QUOTAI_BRANCH_ID,
});

const info = await quotai.getProjectInfo();
console.log(`Project: ${info.name} (${info.project_id})`);

await quotai.pushKeys([
  { key: 'sdk.example.greeting', defaultValue: 'Hello from the Quotai SDK' },
]);

const greeting = await quotai.getString('sdk.example.greeting', {
  fallback: 'Hello',
});
console.log(greeting);

const messages = await quotai.getMessages({ locale: 'en' });
console.log(`Loaded ${Object.keys(messages).length} keys for en`);
