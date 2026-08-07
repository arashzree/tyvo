import type { ReactNode } from 'react';

// Locale-specific <html lang/dir> and fonts are set in app/[locale]/layout.tsx.
// This root layout only needs to exist to satisfy the App Router.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
