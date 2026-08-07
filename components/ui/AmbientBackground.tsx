'use client';

import { useEffect, useRef } from 'react';
import { gsap } from '@/lib/gsap-lenis-bridge';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * Optional background depth layer (max one per section). Per the brief,
 * this MUST be a time-based tween running on its own timeline —
 * explicitly NOT scroll-scrubbed and NOT a one-time static offset.
 * A slow, looping drift keeps it feeling ambient rather than reactive,
 * with no scroll-sync complexity added.
 */
export function AmbientBackground({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion) return;

    const tween = gsap.to(el, {
      xPercent: 6,
      yPercent: -4,
      duration: 18,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
    });

    return () => {
      tween.kill();
    };
  }, [reducedMotion]);

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <div
        ref={ref}
        className="absolute -inset-1/4 bg-[radial-gradient(circle_at_30%_30%,theme(colors.accent.dim)_0%,transparent_60%)] opacity-30 blur-3xl"
      />
    </div>
  );
}
