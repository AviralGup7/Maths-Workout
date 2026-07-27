// ─── Timer policy ────────────────────────────────────────────────────────────
// Implements §9 M1 of docs/14-educational-improvement-roadmap.md.
//
// Every question in the app was timed, with a visible countdown bar that turns
// amber and then red. Timed testing is one of the best-documented correlates of
// mathematics anxiety in early primary, and anxiety consumes exactly the
// working memory that arithmetic needs. The child who most needs to think is
// the one the clock hurts most.
//
// Rather than remove timing — it is genuinely useful for building fluency in
// older, secure learners, and Blitz mode is a deliberate choice the child makes
// — the timer becomes a setting, defaulted by age.
//
// Kept free of React Native imports so the policy itself is unit-testable.

import type { SchoolClass } from '../generators/types';

export type TimerPreference = 'on' | 'off' | 'auto';

/** The default: timers off below this class. */
export const TIMER_DEFAULT_FROM_CLASS = 3;

const CLASS_ORDER: SchoolClass[] = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

function classNumber(cls: SchoolClass): number {
  return CLASS_ORDER.indexOf(cls) + 1;
}

/**
 * Should the per-question countdown run?
 *
 * `auto` resolves by class: off for Classes 1–2, on from Class 3. Six- and
 * seven-year-olds are still building number facts; a countdown converts a
 * thinking task into a performance task. By Class 3 the child has the fluency
 * for a time budget to mean "keep moving" rather than "you are too slow".
 *
 * An explicit 'on' or 'off' from the learner or parent always wins — autonomy
 * matters, and a Class 1 child who enjoys racing should be allowed to.
 */
export function timerEnabled(pref: TimerPreference, cls: SchoolClass): boolean {
  if (pref === 'on') return true;
  if (pref === 'off') return false;
  return classNumber(cls) >= TIMER_DEFAULT_FROM_CLASS;
}

/**
 * Blitz is exempt.
 *
 * A 60-second challenge the child deliberately selected is not imposed time
 * pressure — the time limit *is* the activity, and removing it would leave the
 * mode meaningless. The distinction is consent.
 */
export function timerEnabledForSession(
  pref: TimerPreference,
  cls: SchoolClass,
  isBlitz: boolean,
): boolean {
  if (isBlitz) return true;
  return timerEnabled(pref, cls);
}
