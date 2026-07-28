// ─── When to serve an open-ended task ────────────────────────────────────────
// docs/27 P1-18/19/20. The generators exist; this decides who meets them.
//
// Kept out of GameContext deliberately. A `Math.random() < 0.2` inline in the
// context would be untestable, would apply the same rate to a struggling
// Class 1 child as to a secure Class 6 one, and would be invisible to the
// audit. This is a policy, so it is a pure function with a guard test.

import type { SkillId } from './skills';
import { SKILLS } from './skills';
import type { SchoolClass } from '../generators/types';

export type OpenTaskKind = 'openEnded' | 'openMiddle' | 'reverse';

/**
 * Mastery below which an open task is withheld.
 *
 * An open task removes the answer AND the procedure: a child who cannot yet
 * execute `37 + 13` reliably will not find two numbers that add to 50 by
 * searching, they will stall. Set above `STRUGGLING_THRESHOLD` (0.55) so a
 * child the scheduler already considers to be struggling is never handed the
 * hardest format in the app.
 */
export const OPEN_TASK_FLOOR = 0.62;

/**
 * Share of eligible questions served as open tasks.
 *
 * Low on purpose. docs/26's finding was that the bank had *zero* open items,
 * not that it had too few closed ones; the fix is presence, not dominance.
 * An open task also costs several times the time of a closed one, so a 20%
 * rate is closer to 40% of session minutes.
 */
export const OPEN_TASK_RATE = 0.2;

/**
 * Skills whose procedures invert cleanly.
 *
 * Not every skill does. "Lines of symmetry" has no meaningful reverse, and
 * "the answer is 24, write a division" is nonsense for a child who has not
 * met division. Restricting the map is what keeps the attempt loggable against
 * the skill it claims to practise (docs/21 F3 — the same defect that made
 * `number_sense` log estimation attempts as patterns practice).
 */
const ELIGIBLE: Partial<Record<SkillId, OpenTaskKind[]>> = {
  'add.within10':        ['openEnded'],
  'add.within20':        ['openEnded', 'reverse'],
  'add.2digit.nocarry':  ['openEnded', 'reverse'],
  'add.2digit.carry':    ['openEnded', 'openMiddle', 'reverse'],
  'add.3digit':          ['openEnded', 'openMiddle', 'reverse'],
  'add.large':           ['openEnded', 'openMiddle'],
  'sub.2digit.borrow':   ['openMiddle'],
  'sub.3digit':          ['openMiddle'],
  'sub.large':           ['openMiddle'],
  'mul.tables.mid':      ['openEnded', 'reverse'],
  'mul.tables.full':     ['openEnded', 'openMiddle', 'reverse'],
  'mul.2digit':          ['openMiddle', 'reverse'],
  'mul.large':           ['openMiddle'],
  'div.basic':           ['reverse'],
  'div.tables':          ['openEnded', 'reverse'],
  'div.large':           ['reverse'],
  'factors.basic':       ['openEnded', 'reverse'],
  'numsense.compare':    ['openEnded'],
  'numsense.estimate':   ['openEnded'],
  'placevalue':          ['openMiddle'],
  'dec.tenths':          ['openEnded'],
  'dec.hundredths':      ['openEnded'],
  'patterns.basic':      ['openEnded'],
  'algebra.basic':       ['reverse'],
};

/** Every skill that can produce an open task, for the coverage guard. */
export function skillsWithOpenTasks(): SkillId[] {
  return Object.keys(ELIGIBLE).filter(id => id in SKILLS);
}

const CLASS_ORDER: SchoolClass[] = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

/**
 * Which open-task kind, if any, to serve for this question.
 *
 * `roll` is passed in rather than drawn inside so the caller owns randomness
 * and the policy is a pure function — the same reason `pickInteraction` takes
 * a mastery value rather than reading a store.
 *
 * Returns null when the skill is ineligible, the learner is not secure enough,
 * the class is too young for the format, or the roll simply misses.
 */
export function pickOpenTask(args: {
  skill: SkillId;
  mastery: number;
  cls: SchoolClass;
  roll: number;
  kindRoll?: number;
}): OpenTaskKind | null {
  const kinds = ELIGIBLE[args.skill];
  if (!kinds || kinds.length === 0) return null;
  if (args.mastery < OPEN_TASK_FLOOR) return null;
  if (args.roll >= OPEN_TASK_RATE) return null;

  // Open Middle asks the child to hold a search over a digit pool. Below
  // Class 3 that is a working-memory task, not a maths one.
  const n = CLASS_ORDER.indexOf(args.cls) + 1;
  const allowed = kinds.filter(k => (k === 'openMiddle' ? n >= 3 : true));
  if (allowed.length === 0) return null;

  const kr = args.kindRoll ?? 0;
  return allowed[Math.min(allowed.length - 1, Math.floor(kr * allowed.length))];
}
