import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n';

export default createMiddleware({
  locales,
  defaultLocale,
  // Locale segment is always present in the URL after the first
  // Accept-Language-based redirect — no cookie-only routing.
  localePrefix: 'always',
});

export const config = {
  // Skip static files, API routes, and Next internals.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
