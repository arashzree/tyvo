'use client';

import { useEffect, useState } from 'react';

/**
 * Detects `prefers-reduced-motion: reduce`.
 *
 * Per the Phase 1 brief: when true, callers must SKIP creating
 * GSAP entry-reveal timelines and Lenis smooth-scroll entirely,
 * rather than building the animation and then disabling it.
 * Sections should fall back to a simple opacity fade instead.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mql.matches);

    const handleChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  return reduced;
}
