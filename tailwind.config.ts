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
        // OFFICIAL Tyvo brand palette (source of truth — Brand Book).
        // Kept available under literal names for direct reference,
        // in addition to the semantic tokens below.
        brand: {
          winestone: '#B52524',
          charcoal: '#2B2A29',
          cream: '#FFECD3',
          white: '#FEFEFE',
          navy: '#273449',
          orange: '#C45E23',
        },
        // Semantic tokens used throughout components — values now
        // sourced from the official palette above. Derived shades
        // (soft/line/dim/glow) are computed tints/shades of the
        // official colors, not separately-chosen hex values, so they
        // stay visually consistent with the brand book.
        ink: {
          DEFAULT: '#2B2A29', // Charcoal
          soft: '#383736', // Charcoal + ~6% white
          line: '#494847', // Charcoal + ~14% white
        },
        paper: {
          DEFAULT: '#FFECD3', // Cream
          dim: '#A09586', // Cream blended toward Charcoal
        },
        accent: {
          DEFAULT: '#B52524', // Winestone Red
          dim: '#6D1616', // Winestone + ~40% black
          glow: '#C24C4B', // Winestone + ~18% white
        },
      },
      fontFamily: {
        // FINAL: both locale tokens now point at the same Vazirmatn
        // variable — see app/[locale]/layout.tsx for the full
        // rationale. Kept as two Tailwind class names (font-fa /
        // font-en) rather than collapsing to one, purely so existing
        // component markup didn't need to change.
        fa: ['var(--font-vazirmatn)', 'sans-serif'],
        en: ['var(--font-vazirmatn)', 'sans-serif'],
      },
      fontWeight: {
        // Semantic aliases so components express *intent* (heading vs
        // body) rather than a raw numeric weight — makes the
        // Damoon/Peyda-approximation mapping explicit and greppable.
        heading: '800', // ExtraBold — approximates Damoon's sharp display character
        'heading-black': '900', // Black — for the largest/hero-scale display text
        body: '400', // Regular — approximates Peyda's readable body character
        'body-medium': '500', // Medium — for emphasized body/UI text
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
