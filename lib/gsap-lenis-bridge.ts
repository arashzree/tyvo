'use client';

import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let lenisInstance: Lenis | null = null;
let tickerFn: ((time: number) => void) | null = null;

/**
 * Initializes Lenis and syncs it with GSAP ScrollTrigger.
 *
 * Implementation note (per brief v4.1's explicit flag): the brief's
 * acceptance criterion originally specified a manual
 * `ScrollTrigger.scrollerProxy`, which was the standard wiring pattern
 * for older Lenis/GSAP versions. As of the installed Lenis version
 * (1.1.x) running in DEFAULT WINDOW-SCROLL MODE (no custom scroll
 * wrapper div), Lenis already scrolls the real `window`, so a
 * scrollerProxy is unnecessary and risks double-applying scroll
 * transforms. We use Lenis's own currently-documented integration
 * instead: `lenis.on('scroll', ScrollTrigger.update)` plus driving
 * Lenis's raf loop from `gsap.ticker` (never raw `requestAnimationFrame`),
 * which satisfies the underlying acceptance test (zero visual desync
 * between scroll position and triggered animations at any scroll speed)
 * without the proxy. If a custom scroll container is introduced later,
 * revisit this and add a scrollerProxy pointing at that container.
 */
export function initLenisGsapBridge(): Lenis {
  if (lenisInstance) return lenisInstance;

  const lenis = new Lenis({
    duration: 1.2,
    easing: (t: number) => 1 - Math.pow(1 - t, 3), // deliberate, heavy easing — no bounce
    smoothWheel: true,
  });

  // 1 & 3: keep ScrollTrigger's internal scroll position in lockstep with Lenis.
  lenis.on('scroll', ScrollTrigger.update);

  // 4: drive Lenis from gsap.ticker rather than a separate rAF loop, so
  // Lenis and every GSAP-driven animation share one clock.
  tickerFn = (time: number) => {
    lenis.raf(time * 1000);
  };
  gsap.ticker.add(tickerFn);
  gsap.ticker.lagSmoothing(0);

  lenisInstance = lenis;
  return lenis;
}

export function destroyLenisGsapBridge(): void {
  if (tickerFn) {
    gsap.ticker.remove(tickerFn);
    tickerFn = null;
  }
  lenisInstance?.destroy();
  lenisInstance = null;
}

/**
 * Stops/starts Lenis smooth scrolling without destroying it — used to
 * fall back to native scroll under `prefers-reduced-motion: reduce`.
 */
export function setLenisEnabled(enabled: boolean): void {
  if (!lenisInstance) return;
  if (enabled) {
    lenisInstance.start();
  } else {
    lenisInstance.stop();
  }
}

export { gsap, ScrollTrigger };
