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
/**
 * Animation speed multiplier — docs/28 item 60.
 *
 * Distinct from the OS "reduce motion" switch, which is binary and global.
 * Some children are not motion-sensitive but ARE overwhelmed by a fast
 * interface, and some want it faster than default once they are fluent. This
 * scales travel time only; it never scales a pause that exists so text can be
 * read (see `readingDelay`), because speeding that up removes information
 * rather than movement.
 *
 * Module-level so the pure motion helpers can read it without React.
 */
let motionSpeed = 1;
export function setMotionSpeed(multiplier: number): void {
  motionSpeed = Math.max(0.5, Math.min(2, multiplier));
}
export function getMotionSpeed(): number { return motionSpeed; }
/** Scale an animation duration by the user's speed preference. */
export function scaleDuration(ms: number): number {
  return Math.round(ms / getMotionSpeed());
}

export const FEEDBACK_MS = {
  correct: 280,
  correctBlitz: 200,
  /**
   * Correct answers that carry a praise line need long enough to read it.
   *
   * Measured in the browser: at the 280 ms default the sentence is painted but
   * gone before it can be read, which is worse than no praise at all — motion
   * with no information. ~5 words at a young child's reading speed needs closer
   * to a second. Applied only when a praise line is actually shown, so ordinary
   * correct answers keep the fast path and session length barely moves.
   */
  correctPraised: 950,
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

/**
 * Floor below which text on screen cannot be read.
 *
 * `feedbackDelay` caps reduced-motion pauses at 400 ms, which is right when the
 * pause exists to let an animation land — but wrong when it exists to let a
 * learner *read something*. Clamping a praise line or a diagnosis to 400 ms
 * would remove the information along with the movement, which is exactly what
 * the reduced-motion contract says not to do.
 */
export const MIN_READING_MS = 900;

/**
 * A pause that must remain long enough to read, whatever the motion setting.
 * Use for any feedback carrying words rather than colour alone.
 */
export function readingDelay(base: number, reduced: boolean): number {
  return Math.max(feedbackDelay(base, reduced), Math.min(base, MIN_READING_MS));
}
