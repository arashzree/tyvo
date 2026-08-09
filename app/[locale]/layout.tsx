import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import localFont from 'next/font/local';
import { locales, type Locale } from '@/i18n';
import { MotionProvider } from '@/components/ui/MotionProvider';
import '@/styles/globals.css';

// FINAL: Vazirmatn (self-hosted variable font, SIL OFL licensed) is
// the single, permanent typeface for the whole site — both locales.
// Damoon/Peyda were the original Brand Book spec but are commercial
// fonts with no available license. Vazirmatn was designed for
// bilingual Persian/Latin use and covers both scripts, so it replaces
// the original two-font (fa/en) split entirely rather than pairing
// with a separate Latin font. Weight mapping: Black/ExtraBold for
// headings (approximating Damoon's sharp display character), Regular/
// Medium for body (approximating Peyda's geometric character) — see
// the fontWeight tokens in tailwind.config.ts.
const vazirmatn = localFont({
  src: '../../public/fonts/Vazirmatn-var.woff2',
  variable: '--font-vazirmatn',
  display: 'swap',
  weight: '100 900',
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  if (!locales.includes(locale as Locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = locale === 'fa' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} className={vazirmatn.variable}>
      <body className={locale === 'fa' ? 'font-fa' : 'font-en'}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <MotionProvider>{children}</MotionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
