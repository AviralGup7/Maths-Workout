// ─── Feedback timing ─────────────────────────────────────────────────────────
// Pure values, free of React Native imports so they can be unit tested.

/**
 * Feedback timing for the answer path.
 *
 * The correct-answer pause was 450 ms; 280 ms still reads clearly while
 * removing roughly 1.7 s from a ten-question session. The wrong-answer pause
 * stays deliberately longer - the child needs time to read the diagnosis, and
 * rushing past a mistake defeats the purpose of detecting it.
 */
export const FEEDBACK_MS = {
  correct: 280,
  correctBlitz: 200,
  wrong: 600,
  wrongBlitz: 400,
  /** Constructed-response answers reveal the solution, so allow reading time. */
  wrongConstructed: 1500,
} as const;

/**
 * Under reduced motion, collapse the transition but keep enough reading time.
 * Reduced motion means less movement, not less information.
 */
export function feedbackDelay(base: number, reduced: boolean): number {
  return reduced ? Math.min(base, 400) : base;
}
