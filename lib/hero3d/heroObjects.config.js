// Config for the 7 Hero monoliths.
// Editable by the project manager — sectionId, order, and material assignment
// can all be changed here without touching the 3D component logic.
//
// Material assignment logic (why each object got polished vs matte):
// - "polished / metallic" → sections that are technical, service, or equipment-facing
//   (rental, equipment, services) — the sharp reflective surface reads as precision/expertise,
//   echoing the brand's "navy = pillars of trust, technical mastery" language.
// - "matte / charcoal" → sections that are creative/content/human-facing
//   (production, portfolio, about, contact) — the light-absorbing surface reads as
//   understated and expressive, echoing the brand's "cream/white = calm creative space".
//
// bevelVariant controls the top/bottom facet cut angle passed into buildMonolithGeometry.
// Kept in a narrow range (0.22–0.45) so all 7 stay visually part of one family —
// per the brand constraint, only the facet cut varies, never the base silhouette.

export const heroObjects = [
  {
    id: "monolith-01",
    sectionId: "rental",
    material: "polished",
    bevelVariant: 0.28,
    order: 1,
  },
  {
    id: "monolith-02",
    sectionId: "production",
    material: "matte",
    bevelVariant: 0.35,
    order: 2,
  },
  {
    id: "monolith-03",
    sectionId: "portfolio",
    material: "matte",
    bevelVariant: 0.40,
    order: 3,
  },
  {
    id: "monolith-04",
    sectionId: "equipment",
    material: "polished",
    bevelVariant: 0.22,
    order: 4,
  },
  {
    id: "monolith-05",
    sectionId: "about",
    material: "matte",
    bevelVariant: 0.45,
    order: 5,
  },
  {
    id: "monolith-06",
    sectionId: "services",
    material: "polished",
    bevelVariant: 0.30,
    order: 6,
  },
  {
    id: "monolith-07",
    sectionId: "contact",
    material: "matte",
    bevelVariant: 0.38,
    order: 7,
  },
];
