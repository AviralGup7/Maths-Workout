// ─── Accessibility constants ─────────────────────────────────────────────────
// Pure values, deliberately free of React Native imports so they can be unit
// tested directly (React Native ships Flow-typed source that Vitest cannot
// parse without a native preset).

/**
 * Minimum comfortable touch target.
 *
 * WCAG 2.5.5 asks for 44x44. For a six-year-old with developing motor control
 * that is a floor, not a target.
 */
export const MIN_TOUCH = 44;

/**
 * hitSlop that expands a small control to the minimum touch size without
 * changing its visual footprint.
 *
 * Used for back and close buttons, which are visually 40 pt by design but must
 * be tappable at 44.
 */
export function touchSlop(visualSize: number): { top: number; bottom: number; left: number; right: number } {
  const pad = Math.max(0, Math.ceil((MIN_TOUCH - visualSize) / 2));
  return { top: pad, bottom: pad, left: pad, right: pad };
}
