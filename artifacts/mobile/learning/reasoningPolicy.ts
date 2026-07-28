// ─── When to serve a reasoning item ──────────────────────────────────────────
// docs/27 P1-14, P1-15, P1-16.
//
// P1-16 asks for error-analysis to rise from 1.1% to roughly 8%. Measuring
// first changed the target: in ADAPTIVE sessions the measured share is
// **0.00% of 12,000 questions**, not 1.1%. The cause is structural, not a
// tuning problem — `genErrorHunt` is only reachable through the `number_sense`
// branch of the category dispatcher, and `generateForSkill` bypasses that
// branch for every named skill the scheduler plans. Raising a weight inside
// the dispatcher would therefore have changed nothing, which is exactly the
// class of non-fix docs/25 warned about.
//
// So the routing moves here: a policy the scheduler's caller consults for
// every question, independent of category.
//
// Three formats share one budget, because they compete for the same thing —
// a child's willingness to read a long stem. Spending 8% on error hunting and
// another 8% each on the other two would put a quarter of every session into
// reading-heavy items, which is how you build an app children stop opening.

import type { SkillId } from './skills';
import { SKILLS } from './skills';
import type { SchoolClass } from '../generators/types';

export type ReasoningKind = 'errorHunt' | 'methodCompare' | 'reasonSelect';

/**
 * Combined share of questions given to reasoning formats.
 *
 * docs/26 B24 asked for ~8% error analysis. That number is honoured as the
 * floor for `errorHunt` specifically (see SPLIT), with the other two formats
 * carried on top — they did not exist when B24 was written.
 */
export const REASONING_RATE = 0.285;
// Calibrated, not guessed. The rate is applied only to ELIGIBLE skills from
// their MIN_CLASS upward, and that denominator is 48.3% of planned questions,
// not 100% — so the naive rate (0.14) delivered 3.64%, less than half the
// target. Measured progression: 0.14→3.64%, 0.24→6.82%, 0.27→7.58%,
// 0.285→8.43%. See the guard test, which re-measures rather than trusting
// this comment.

/** How the budget divides. Error hunting keeps the largest share per B24. */
export const SPLIT: Record<ReasoningKind, number> = {
  errorHunt: 0.66,
  methodCompare: 0.19,
  reasonSelect: 0.15,
};

/**
 * Mastery below which reasoning items are withheld.
 *
 * Auditing someone else's method, when you cannot yet execute it yourself,
 * adds cognitive load without adding understanding — the same reasoning that
 * already gated `genErrorHunt` in the dispatcher, now applied uniformly.
 */
export const REASONING_FLOOR = 0.60;

/** Earliest class for each format. */
const MIN_CLASS: Record<ReasoningKind, number> = {
  errorHunt: 3,      // evaluating a written method presumes writing one
  methodCompare: 2,  // needs two strategies to already be available
  reasonSelect: 3,   // the stems are long; younger children stall on reading
};

/**
 * Skills whose questions have a meaningful reasoning form.
 *
 * Restricted for the same reason `openTaskPolicy` restricts: an attempt is
 * logged against the planned skill, so serving a format that does not
 * exercise it corrupts the mastery estimate (docs/21 F3).
 */
const ELIGIBLE: Partial<Record<SkillId, ReasoningKind[]>> = {
  'add.2digit.carry':    ['errorHunt', 'methodCompare', 'reasonSelect'],
  'add.3digit':          ['errorHunt', 'methodCompare', 'reasonSelect'],
  'add.large':           ['errorHunt', 'methodCompare'],
  'sub.2digit.borrow':   ['errorHunt', 'reasonSelect'],
  'sub.3digit':          ['errorHunt', 'reasonSelect'],
  'sub.large':           ['errorHunt'],
  'mul.tables.mid':      ['errorHunt', 'methodCompare'],
  'mul.tables.full':     ['errorHunt', 'methodCompare'],
  'mul.2digit':          ['errorHunt', 'methodCompare', 'reasonSelect'],
  'mul.large':           ['errorHunt', 'methodCompare'],
  'div.tables':          ['errorHunt', 'reasonSelect'],
  'div.large':           ['errorHunt', 'methodCompare'],
  'frac.equivalence':    ['reasonSelect', 'methodCompare'],
  'frac.ofAmount':       ['methodCompare', 'reasonSelect'],
  'frac.addSameDenom':   ['errorHunt', 'reasonSelect'],
  'dec.tenths':          ['reasonSelect'],
  'dec.hundredths':      ['reasonSelect', 'methodCompare'],
  'percent.basic':       ['methodCompare', 'reasonSelect'],
  'geometry.basic':      ['reasonSelect'],
  'numsense.estimate':   ['methodCompare'],
  'numsense.reasonable': ['reasonSelect', 'errorHunt'],
  'placevalue':          ['reasonSelect'],
  'patterns.basic':      ['reasonSelect'],
  'wordproblems':        ['errorHunt', 'reasonSelect'],
};

const CLASS_ORDER: SchoolClass[] = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

/** Every skill that can produce a reasoning item, for the coverage guard. */
export function skillsWithReasoning(): SkillId[] {
  return Object.keys(ELIGIBLE).filter(id => id in SKILLS);
}

/**
 * The eligibility map's keys, UNFILTERED — for the drift guard only.
 *
 * `skillsWithReasoning` filters to known skills, which is right for callers and
 * useless for a guard: a mistyped key is silently dropped, so a test built on
 * the filtered list passes against a map whose entry matches nothing. Verified
 * on the sibling policy in learning/representationPolicy.ts, where typing
 * `percent.basics` for `percent.basic` left every assertion green. `SkillId`
 * is a bare `string`, so the type system cannot catch it either.
 */
export function declaredReasoningKeys(): string[] {
  return Object.keys(ELIGIBLE);
}

/**
 * Which reasoning format, if any, to serve for this question.
 *
 * Pure: randomness is supplied by the caller, so the policy is testable and
 * the measured share is reproducible.
 */
export function pickReasoning(args: {
  skill: SkillId;
  mastery: number;
  cls: SchoolClass;
  roll: number;
  kindRoll: number;
}): ReasoningKind | null {
  const kinds = ELIGIBLE[args.skill];
  if (!kinds || kinds.length === 0) return null;
  if (args.mastery < REASONING_FLOOR) return null;
  if (args.roll >= REASONING_RATE) return null;

  const n = CLASS_ORDER.indexOf(args.cls) + 1;
  const allowed = kinds.filter(k => n >= MIN_CLASS[k]);
  if (allowed.length === 0) return null;

  // Choose by the split, renormalised over what this skill and class allow —
  // otherwise a skill offering only `errorHunt` would silently drop 43% of its
  // reasoning budget on the floor.
  const weights = allowed.map(k => SPLIT[k]);
  const sum = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  const target = args.kindRoll * sum;
  for (let i = 0; i < allowed.length; i++) {
    acc += weights[i];
    if (target < acc) return allowed[i];
  }
  return allowed[allowed.length - 1];
}
