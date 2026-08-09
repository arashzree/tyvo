/**
 * Resolves a K-Spline `sectionId` (from heroObjects.config.js) to the
 * actual DOM anchor id used by the existing 01–05 / Contact sections
 * (see the `id` prop on each <RevealSection> in components/sections/*).
 *
 * This is intentionally a single, editable table — not hardcoded into
 * the 3D scene or the Hero component — so a PM/dev can fix a mapping
 * without touching interaction code, per the brief's data-driven
 * requirement.
 *
 * STATUS (per team decision, provisional — not final IA):
 * 6 of 7 monoliths now resolve. "services" was reassigned to
 * "community" (an existing section that had no monolith pointing at
 * it) so every slot that CAN resolve to something real, does.
 * "equipment" remains deliberately unmapped — team decision to leave
 * it showing the "not connected yet" notice for the current demo
 * stage rather than guess a destination for it.
 *
 * Until "equipment" is resolved, selecting it does NOT crash or
 * silently navigate somewhere wrong — see resolveSectionAnchor below.
 */
export const sectionIdToAnchor: Record<string, string> = {
  rental: 'studio-rental',
  production: 'content-production',
  portfolio: 'portfolio',
  about: 'about',
  contact: 'contact',
  services: 'community', // reassigned per team decision — provisional, not final IA
  // 'equipment' deliberately left unmapped — team decision, not a gap
  // to silently fill. Revisit when IA is finalized.
};

export type SectionResolution =
  | { status: 'resolved'; anchorId: string }
  | { status: 'unmapped'; sectionId: string };

export function resolveSectionAnchor(sectionId: string): SectionResolution {
  const anchorId = sectionIdToAnchor[sectionId];
  if (anchorId) return { status: 'resolved', anchorId };
  return { status: 'unmapped', sectionId };
}
