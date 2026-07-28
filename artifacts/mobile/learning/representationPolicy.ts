// ─── When to serve a multi-representation or non-example item ────────────────
// docs/27 P3-07 and P3-09.
//
// Same shape as `openTaskPolicy` and `reasoningPolicy`, and for the same
// reason: the generators exist, and this decides who meets them. A
// `Math.random() < 0.15` inline in GameContext would be untestable, invisible
// to the audit, and would apply one rate to a Class 3 child meeting halves for
// the first time and a Class 6 child converting percentages.
//
// These two formats share one budget because they compete for the same thing.
// Both ask the child to step outside the procedure they were practising — one
// to re-express a quantity, one to test a definition at its boundary — and a
// session that did both repeatedly would never let a child actually rehearse
// anything.

import type { SkillId } from './skills';
import { SKILLS } from './skills';
import type { SchoolClass } from '../generators/types';

export type RepresentationKind = 'convert' | 'match' | 'nonExample' | 'nonExampleSet';

/**
 * Combined share of eligible questions given to these formats.
 *
 * Deliberately modest. docs/26's finding was that the bank had ZERO of them,
 * and the fix for absence is presence. Translation items in particular are
 * cognitively expensive — a child holding 3/4, 0.75 and 75% in mind at once is
 * doing more work than the arithmetic they were sent here to practise.
 */
export const REPRESENTATION_RATE = 0.18;

/**
 * Mastery below which these are withheld.
 *
 * Lower than `REASONING_FLOOR` (0.60) on purpose, and the difference is not
 * arbitrary. Auditing someone else's method presupposes being able to execute
 * it. Recognising that a square IS a rectangle does not — it is exactly the
 * item a child who is still forming the concept needs, and withholding it
 * until they are secure would deliver it after it stopped being useful.
 *
 * It sits above zero only so that a child who is failing outright is not
 * handed a definitional edge case on top.
 */
export const REPRESENTATION_FLOOR = 0.35;

/**
 * Mastery above which conversion items stop.
 *
 * Unlike the other policies, this one FADES OUT. Converting 3/4 to 75% for the
 * two hundredth time is not magnitude knowledge, it is a rule being drilled,
 * and the whole argument for the format is that it reveals understanding a
 * procedure can hide. Once a child converts reliably it has nothing left to
 * reveal. Non-examples do not fade: a definition is worth re-testing.
 */
export const CONVERT_CEILING = 0.88;

/** Earliest class per format. */
const MIN_CLASS: Record<RepresentationKind, number> = {
  convert: 4,        // needs two of fraction/decimal/percentage to be available
  match: 4,
  nonExample: 3,     // "which is not a rectangle" works as soon as shapes do
  nonExampleSet: 4,  // the set form needs the child to hold several at once
};

/**
 * Skills with a meaningful item in each format.
 *
 * Restricted for the reason the sibling policies restrict: an attempt is
 * logged against the planned skill, so serving a format that does not exercise
 * it corrupts the mastery estimate (docs/21 F3). A conversion item logged
 * against `add.3digit` would be evidence about a skill the child never met.
 */
const ELIGIBLE: Partial<Record<SkillId, RepresentationKind[]>> = {
  'frac.equivalence':  ['convert', 'match', 'nonExample', 'nonExampleSet'],
  'frac.ofAmount':     ['convert', 'match'],
  'frac.compare':      ['match', 'nonExample'],
  'frac.numberline':   ['convert', 'match'],
  'dec.tenths':        ['convert', 'match'],
  'dec.hundredths':    ['convert', 'match'],
  'percent.basic':     ['convert', 'match'],
  'shapes.basic':      ['nonExample', 'nonExampleSet'],
  'geometry.basic':    ['nonExample'],
  'geometry.angles':   ['nonExample'],
  'symmetry.basic':    ['nonExample'],
  'factors.basic':     ['nonExample', 'nonExampleSet'],
};

const CLASS_ORDER: SchoolClass[] = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

/** Every skill that can produce one of these, for the coverage guard. */
export function skillsWithRepresentation(): SkillId[] {
  return Object.keys(ELIGIBLE).filter(id => id in SKILLS);
}

/**
 * The eligibility map's keys, UNFILTERED.
 *
 * `skillsWithRepresentation` filters to known skills, which is right for
 * callers and useless for a guard: a mistyped key is silently dropped, so a
 * test built on the filtered list passes against a map whose entry no longer
 * matches anything. Verified — typing `percent.basics` for `percent.basic`
 * left every assertion green while the format quietly stopped existing for
 * percentages. The raw keys are what a drift guard has to look at.
 *
 * `SkillId` is a bare `string`, so the type system cannot catch this either.
 */
export function declaredRepresentationKeys(): string[] {
  return Object.keys(ELIGIBLE);
}

/**
 * Which format, if any, to serve for this question.
 *
 * Pure: randomness is supplied by the caller, so the measured share is
 * reproducible — the same contract as `pickOpenTask` and `pickReasoning`.
 */
export function pickRepresentation(args: {
  skill: SkillId;
  mastery: number;
  cls: SchoolClass;
  roll: number;
  kindRoll: number;
}): RepresentationKind | null {
  const kinds = ELIGIBLE[args.skill];
  if (!kinds || kinds.length === 0) return null;
  if (args.mastery < REPRESENTATION_FLOOR) return null;
  if (args.roll >= REPRESENTATION_RATE) return null;

  const n = CLASS_ORDER.indexOf(args.cls) + 1;
  const allowed = kinds.filter(k => {
    if (n < MIN_CLASS[k]) return false;
    if ((k === 'convert' || k === 'match') && args.mastery > CONVERT_CEILING) return false;
    return true;
  });
  if (allowed.length === 0) return null;

  // Weighted toward the SET-VALUED forms, and the reason is pedagogical before
  // it is anything else. "Which one is not a rectangle?" can be answered by
  // elimination; "tap every one that is not a rectangle" cannot, because the
  // child has to evaluate each card against the definition. The same holds for
  // matching: equivalence is a property of a set, and a partial selection says
  // exactly which representation the child cannot yet read, where a single
  // choice says only that they got it wrong.
  //
  // It also keeps the P3-08 share honest. Both set forms are `multiSelect`;
  // both single forms are `choice`. An even split measured the multiple-choice
  // share at 39.4% against a 40% bar — technically passing, with a margin
  // smaller than the sampling noise.
  const weightOf = (k: RepresentationKind) => (k === 'match' || k === 'nonExampleSet' ? 0.7 : 0.3);
  const weights = allowed.map(weightOf);
  const sum = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  const target = args.kindRoll * sum;
  for (let i = 0; i < allowed.length; i++) {
    acc += weights[i];
    if (target < acc) return allowed[i];
  }
  return allowed[allowed.length - 1];
}
