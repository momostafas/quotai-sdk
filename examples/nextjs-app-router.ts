/**
 * Next.js App Router — load messages in a Server Component for next-intl.
 *
 * Install: npm install quotai-sdk
 * Env: QUOTAI_API_KEY=qk_…  (optional: QUOTAI_BRANCH_ID for branch_id)
 */
import { QuotaiClient } from 'quotai-sdk';

const quotai = new QuotaiClient({
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  locale: 'en',
  branch: process.env.QUOTAI_BRANCH_ID,
  cacheTTL: 120_000,
});

export async function getQuotaiMessages(locale: string) {
  return quotai.getMessages({ locale });
}

// app/[locale]/layout.tsx
// import { NextIntlClientProvider } from 'next-intl';
// import { getQuotaiMessages } from '@/lib/quotai';
//
// export default async function LocaleLayout({
//   children,
//   params: { locale },
// }: {
//   children: React.ReactNode;
//   params: { locale: string };
// }) {
//   const messages = await getQuotaiMessages(locale);
//   return (
//     <NextIntlClientProvider locale={locale} messages={messages}>
//       {children}
//     </NextIntlClientProvider>
//   );
// }

// app/page.tsx — single string
// const headline = await quotai.getString('marketing.hero.title');
