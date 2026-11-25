/**
 * The z-index scale (FRONTEND_SPEC.md section 5.4). Nothing else is allowed.
 * Mirrored as --z-* custom properties in src/styles/tokens.css; tests/unit/tokens.test.ts keeps them equal.
 */
export const Z = {
  canvas: 0,
  map: 5,
  content: 10,
  overlay: 15,
  sticky: 20,
  nav: 30,
  panel: 35,
  modal: 40,
  toast: 50,
  grain: 60,
} as const;

export type ZLayer = keyof typeof Z;
