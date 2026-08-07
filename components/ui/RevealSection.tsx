'use client';

import { useEffect, useRef } from 'react';
import { gsap, ScrollTrigger } from '@/lib/gsap-lenis-bridge';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type RevealSectionProps = {
  children: React.ReactNode;
  className?: string;
  /** id used for ScrollTrigger + in-page anchors */
  id?: string;
};

/**
 * One clear, deliberate entry reveal per section — fires once when the
 * section enters the viewport (GSAP ScrollTrigger, NOT a continuous
 * scrub tied to scroll offset). Content rises and un-masks via a
 * clip-path wipe, with slow/heavy easing (no bounce/elastic).
 *
 * Reduced motion: skips the timeline entirely and renders a simple
 * opacity fade instead, per the defined mechanism in the brief.
 */
export function RevealSection({ children, className = '', id }: RevealSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    if (reducedMotion) {
      gsap.set(el, { opacity: 0 });
      const fade = gsap.to(el, {
        opacity: 1,
        duration: 0.6,
        ease: 'power1.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          once: true,
        },
      });
      return () => {
        fade.scrollTrigger?.kill();
        fade.kill();
      };
    }

    gsap.set(el, {
      opacity: 0,
      y: 64,
      clipPath: 'inset(12% 0% 12% 0% round 0px)',
    });

    const reveal = gsap.to(el, {
      opacity: 1,
      y: 0,
      clipPath: 'inset(0% 0% 0% 0% round 0px)',
      duration: 1.4,
      ease: 'power2.inOut', // heavy, deliberate — no bounce/elastic
      scrollTrigger: {
        trigger: el,
        start: 'top 80%',
        once: true,
      },
    });

    return () => {
      reveal.scrollTrigger?.kill();
      reveal.kill();
    };
  }, [reducedMotion]);

  return (
    <div ref={sectionRef} id={id} className={className}>
      {children}
    </div>
  );
}
