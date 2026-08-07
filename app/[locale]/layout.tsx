import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import localFont from 'next/font/local';
import { locales, type Locale } from '@/i18n';
import { MotionProvider } from '@/components/ui/MotionProvider';
import '@/styles/globals.css';

// Both typefaces are self-hosted (not the Google Fonts CDN) via
// next/font/local, which reserves fallback metrics automatically to
// avoid FOUT/CLS — required given the bold-weight, layout-shift-prone
// headers.
const vazirmatn = localFont({
  src: '../../public/fonts/Vazirmatn-var.woff2',
  variable: '--font-vazirmatn',
  display: 'swap',
  weight: '100 900',
});

const inter = localFont({
  src: '../../public/fonts/Inter-var.woff2',
  variable: '--font-inter',
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
    <html lang={locale} dir={dir} className={`${vazirmatn.variable} ${inter.variable}`}>
      <body className={locale === 'fa' ? 'font-fa' : 'font-en'}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <MotionProvider>{children}</MotionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
