'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations('nav');

  const target = locale === 'fa' ? 'en' : 'fa';
  const rest = pathname.split('/').slice(2).join('/');
  const href = `/${target}${rest ? `/${rest}` : ''}`;

  return (
    <Link
      href={href}
      className="fixed top-6 z-50 rounded-full border border-ink-line px-4 py-2 text-xs uppercase tracking-wideish text-paper-dim transition-colors duration-300 hover:border-accent hover:text-paper ltr:right-6 rtl:left-6"
    >
      {t('switchLocale')}
    </Link>
  );
}
