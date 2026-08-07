'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { gsap } from '@/lib/gsap-lenis-bridge';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * Hero / Entrance. A single "opening a door" motion beat on load —
 * heavy, deliberate easing, not snappy or bouncy. This is a load-time
 * reveal (not scroll-triggered), since it's the very first thing seen.
 */
export function Hero() {
  const t = useTranslations('hero');
  const doorLeftRef = useRef<HTMLDivElement>(null);
  const doorRightRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      gsap.set([doorLeftRef.current, doorRightRef.current], { autoAlpha: 0 });
      gsap.set(contentRef.current, { autoAlpha: 1 });
      return;
    }

    const tl = gsap.timeline({ delay: 0.2 });

    tl.set(contentRef.current, { autoAlpha: 0 })
      .set(logoRef.current, { autoAlpha: 0, scale: 0.92 })
      .to(logoRef.current, {
        autoAlpha: 1,
        scale: 1,
        duration: 1.6,
        ease: 'power2.inOut',
      })
      .to(
        [doorLeftRef.current, doorRightRef.current],
        {
          xPercent: (i) => (i === 0 ? -100 : 100),
          duration: 1.8,
          ease: 'power2.inOut',
        },
        '+=0.3'
      )
      .to(
        contentRef.current,
        { autoAlpha: 1, duration: 1, ease: 'power2.out' },
        '-=0.6'
      );

    return () => {
      tl.kill();
    };
  }, [reducedMotion]);

  return (
    <section className="relative flex h-[100vh] items-center justify-center overflow-hidden bg-ink">
      {/* The two "door" panels that part to reveal the brand space */}
      <div
        ref={doorLeftRef}
        aria-hidden
        className="absolute inset-y-0 left-0 z-20 w-1/2 bg-ink-soft ltr:origin-left rtl:origin-right"
      />
      <div
        ref={doorRightRef}
        aria-hidden
        className="absolute inset-y-0 right-0 z-20 w-1/2 bg-ink-soft"
      />

      <div className="relative z-10 flex flex-col items-center gap-8 px-6 text-center">
        <div ref={logoRef} className="font-en text-6xl font-bold tracking-wideish text-accent md:text-8xl">
          TYV
        </div>

        <div ref={contentRef} className="flex flex-col items-center gap-4">
          <p className="text-sm uppercase tracking-wideish text-paper-dim">{t('eyebrow')}</p>
          <h1 className="max-w-2xl text-2xl font-bold leading-tight text-paper md:text-4xl">
            {t('title')}
          </h1>
          <p className="max-w-md text-paper-dim">{t('subtitle')}</p>
          <span className="mt-4 text-xs uppercase tracking-wideish text-accent">
            {t('cta')}
          </span>
        </div>
      </div>
    </section>
  );
}
