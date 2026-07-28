// ─── The graded interaction ladder ───────────────────────────────────────────
// docs/27 P3-08 · docs/25 T3-23: "reduce multiple-choice share below 40% by
// extending the interaction ladder earlier".
//
// MEASURED FIRST. Over 27,000 questions drawn from the category dispatcher
// across all six classes and three difficulties:
//
//     choice    26,752   99.1%
//     estimate      248    0.9%
//
// docs/25 recorded 58.4% multiple choice over a simulated year. The gap is not
// a contradiction: that figure came from a simulation whose learners spent
// much of the year above 0.80, where `pickInteraction` promotes. The raw
// supply is 99.1%, and a child in their first months meets almost nothing else.
//
// The cause was structural, not a weight to nudge. `pickInteraction` is a STEP
// function: multiple choice below mastery 0.80, typed entry at or above it.
// So the whole population between "no longer struggling" and "secure" — where
// learners spend most of their time — never left the tiles. Worse, it
// interlocks with the recognition ceiling: mastery is clamped at 0.80 without
// recall evidence (mastery.ts M4), and recall evidence was only served at 0.80.
// A learner had to reach the exact value the ladder gates on in order to be
// given the only kind of question that can carry them past it.
//
// This module replaces the step with a RAMP, and keeps the scaffold where it
// is actually doing work.
//
// Kept out of GameContext for the same reason `openTaskPolicy` is: an inline
// `Math.random() < x` is untestable, invisible to the audit, and applies one
// rate to every learner. This is a policy, so it is a pure function with a
// guard test that re-measures the share rather than trusting this comment.

import type { Question } from '../generators/types';
import { toEntry, estimateQuestion } from '../generators/interactions';
import { qp } from '../i18n/questions';
import type { Lang } from '../i18n/strings';

/**
 * Mastery below which the answer stays on screen.
 *
 * A child who cannot yet execute the procedure is helped by seeing candidate
 * answers — recognition scaffolds recall, and removing the tiles from someone
 * who is failing converts a hard question into a blank one. Set below
 * `STRUGGLING_THRESHOLD` (0.55) rather than at it: a learner at 0.45 is not
 * struggling, they are mid-acquisition, and that is exactly the population
 * the step function stranded.
 */
export const ENTRY_FLOOR = 0.40;

/**
 * The floor for questions whose answer is small enough to COUNT to.
 *
 * The scaffold exists so that a struggling child is not left staring at a
 * blank keypad with no way in. But whether that risk is real depends on the
 * answer, not only on the mastery estimate. A child at 0.30 on "7 + 5" has a
 * fallback strategy available to them — count — and using it is the very
 * behaviour early-years teaching wants. A child at 0.30 on "473 + 289" has no
 * such fallback: without the tiles the question is simply blank.
 *
 * So the floor is magnitude-aware. Measured: 50.4% of the multiple-choice
 * residual at mastery 0.25–0.45 had an answer below 25, spread across all six
 * classes, and it is exactly that half where the tiles were buying nothing.
 */
export const ENTRY_FLOOR_COUNTABLE = 0.15;

/** Answers at or below this are reachable by counting. */
export const COUNTABLE_MAX = 20;

/** Mastery at and above which every convertible question is typed. */
export const ENTRY_FULL = 0.80;

/**
 * Probability that a convertible question is served as typed entry.
 *
 * Linear between the floor and the ceiling. The shape matters less than the
 * fact that it is continuous: a learner earns a little recall demand as soon
 * as they are no longer struggling, so recall evidence accumulates *while*
 * mastery climbs instead of only after it arrives.
 */
export function entryChance(mastery: number, answer?: number): number {
  if (!Number.isFinite(mastery)) return 0;
  const countable = typeof answer === 'number' && Number.isInteger(answer)
    && answer >= 0 && answer <= COUNTABLE_MAX;
  const floor = countable ? ENTRY_FLOOR_COUNTABLE : ENTRY_FLOOR;
  if (mastery < floor) return 0;
  if (mastery >= ENTRY_FULL) return 1;
  return (mastery - floor) / (ENTRY_FULL - floor);
}

/**
 * Can this question be typed at all?
 *
 * `toEntry` refuses non-numeric answers, and rightly: "Rectangle", "Yes" and
 * "Wednesday" are word-recall, not number-recall, and a numeric keypad cannot
 * express them. Measured share of numeric answers per category: 100% for the
 * eighteen arithmetic and measurement categories, 95% time, 94% factors,
 * 69% shapes, 51% number_sense. Those remainders stay on tiles by design.
 */
export function canType(q: Question): boolean {
  if (q.interaction && q.interaction.kind !== 'choice') return false;
  return typeof q.answer === 'number' && Number.isFinite(q.answer);
}

// ─── The estimate-first rung ─────────────────────────────────────────────────
//
// Ramping typed entry alone took the measured share from 99.1% to 51.3%, and
// the residual was not spread evenly: it sat at 84% for mastery 0.25–0.45 and
// 17% above 0.80. That is the correct place for it to sit — a child who cannot
// yet execute the procedure is *helped* by seeing candidate answers — so the
// remaining 11 points could not honestly be bought by lowering ENTRY_FLOOR.
// Doing that would have hit the target by taking support away from precisely
// the learners the scaffold exists for.
//
// So the low band gets a rung that suits it instead. "Roughly, how much is
// 47 + 38?" is answered by choosing a BAND, and a band cannot be reached by
// elimination or by computing exactly and rounding — the buckets are spaced so
// that estimating is the faster path (see `estimateQuestion`). It is also the
// order the mathematics wants: estimation before exact computation is what
// lets a child notice that 550 is not a plausible answer to 33 + 22.
//
// It is deliberately NOT offered when the answer is small. "Roughly, how much
// is 3 + 4?" is a worse question than "3 + 4", because at that magnitude there
// is nothing to estimate.

/** Smallest answer worth estimating. Below this the exact answer IS the estimate. */
export const ESTIMATE_MIN_MAGNITUDE = 25;

/** Mastery at and above which estimation stops being offered as a rung. */
export const ESTIMATE_CEILING = 0.62;

/**
 * Share of eligible low-mastery questions served as an estimate.
 *
 * Not higher: estimation is one strand of number sense, not a replacement for
 * arithmetic, and a session that was half bands would be teaching a child to
 * avoid computing. Calibrated against the measured share — see the guard.
 */
export const ESTIMATE_RATE = 0.42;

/** Can this question sensibly be asked as an estimate? */
export function canEstimate(q: Question): boolean {
  if (q.interaction && q.interaction.kind !== 'choice') return false;
  if (typeof q.answer !== 'number' || !Number.isFinite(q.answer)) return false;
  // Negative answers make bands read as nonsense to a child; integers only,
  // because a band around 0.35 is not a quantity a primary learner can picture.
  if (!Number.isInteger(q.answer)) return false;
  return q.answer >= ESTIMATE_MIN_MAGNITUDE;
}

/**
 * Apply the ladder to a freshly generated question.
 *
 * `roll` is supplied by the caller so the policy stays pure and the measured
 * share is reproducible — the same contract as `pickOpenTask` and
 * `pickReasoning`.
 *
 * Order matters. Typed entry is tried first because it is the higher demand;
 * estimation only fills the band the entry ramp deliberately leaves alone.
 */
export function applyLadder(
  q: Question, mastery: number, roll: number,
  opts: { estimateRoll?: number; lang?: Lang } = {},
): Question {
  if (canType(q) && roll < entryChance(mastery, q.answer as number)) return toEntry(q);
  const er = opts.estimateRoll;
  if (er !== undefined && mastery < ESTIMATE_CEILING && er < ESTIMATE_RATE && canEstimate(q)) {
    return {
      ...estimateQuestion(
        qp('roughlyHowMuch', opts.lang ?? 'en', q.questionText),
        q.answer as number,
        { resolvedCategory: q.resolvedCategory },
      ),
      // The estimate wrapper must not inherit the exact-answer distractor map:
      // those keys name misconceptions about a computation the child was not
      // asked to perform.
      distractorMap: undefined,
    };
  }
  return q;
}
