'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import { scrollToElement } from '@/lib/gsap-lenis-bridge';
import { resolveSectionAnchor } from '@/lib/hero3d/sectionResolver';

// Client-only: the scene talks to WebGL/window directly (K-Spline's
// package, not React Three Fiber), so it cannot run during SSR.
const TyvoHeroScene = dynamic(
  () => import('@/components/hero3d/TyvoHeroScene').then((m) => m.TyvoHeroScene),
  { ssr: false }
);

/**
 * Hero / Entrance — now the 3D horizontal spatial navigation system
 * (7 monoliths) per the architecture update. The previous "opening a
 * door" 2D reveal is retired; see git history if it's needed again.
 *
 * This component owns ONLY navigation/content concerns (per the
 * brief's ownership split): it receives a raw sectionId from the 3D
 * scene via onSelect, resolves it to an actual DOM anchor, and
 * triggers the existing Lenis-driven smooth scroll. It does not know
 * or care how the 3D objects are rendered.
 *
 * Horizontal interaction is scoped entirely to this component's
 * canvas — the rest of the site (below this section) remains a
 * normal vertical scroll, unchanged.
 */
export function Hero() {
  const [unmappedNotice, setUnmappedNotice] = useState<string | null>(null);

  const handleSelect = useCallback((sectionId: string) => {
    const resolution = resolveSectionAnchor(sectionId);

    if (resolution.status === 'resolved') {
      setUnmappedNotice(null);
      scrollToElement(resolution.anchorId);
      return;
    }

    // Defensive fallback for sectionIds with no matching section yet
    // ("equipment", "services" as of the current heroObjects.config.js).
    // Does not navigate anywhere or crash — surfaces the gap instead.
    console.warn(
      `Hero: monolith mapped to sectionId "${resolution.sectionId}", which has no matching section yet.`
    );
    setUnmappedNotice(resolution.sectionId);
  }, []);

  return (
    <section className="relative h-[100vh] w-full overflow-hidden bg-ink">
      <TyvoHeroScene onSelect={handleSelect} />

      {unmappedNotice && (
        <div
          role="status"
          className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-sm border border-accent/40 bg-ink/90 px-4 py-2 text-center text-xs text-paper-dim"
        >
          &ldquo;{unmappedNotice}&rdquo; isn&apos;t connected to a section yet — config/content
          update pending.
        </div>
      )}
    </section>
  );
}
