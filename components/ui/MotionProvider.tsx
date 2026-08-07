'use client';

import { useEffect } from 'react';
import {
  initLenisGsapBridge,
  destroyLenisGsapBridge,
  setLenisEnabled,
} from '@/lib/gsap-lenis-bridge';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * Mounted once at the root layout. Initializes Lenis smooth-scroll and
 * its GSAP ScrollTrigger sync for the whole page. Under
 * `prefers-reduced-motion: reduce`, Lenis smooth-scroll is disabled and
 * the page falls back to native scroll, per the acceptance criterion.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    initLenisGsapBridge();
    return () => destroyLenisGsapBridge();
  }, []);

  useEffect(() => {
    setLenisEnabled(!reducedMotion);
  }, [reducedMotion]);

  return <>{children}</>;
}
