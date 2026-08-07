import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand tokens — accent-red is a placeholder until the logo SVG
        // is provided; replace with the sampled hex once confirmed.
        ink: {
          DEFAULT: '#0A0A0A',
          soft: '#131313',
          line: '#232323',
        },
        paper: {
          DEFAULT: '#F5F3EF',
          dim: '#B9B6AF',
        },
        accent: {
          DEFAULT: '#C41E2A',
          dim: '#7A1219',
          glow: '#E13544',
        },
      },
      fontFamily: {
        // Wired to CSS variables set by next/font in app/[locale]/layout.tsx
        fa: ['var(--font-vazirmatn)', 'sans-serif'],
        en: ['var(--font-inter)', 'sans-serif'],
      },
      letterSpacing: {
        wideish: '0.08em',
      },
      transitionTimingFunction: {
        heavy: 'cubic-bezier(0.65, 0, 0.35, 1)', // power2.inOut-equivalent
      },
    },
  },
  plugins: [require('tailwindcss-rtl')],
};

export default config;
