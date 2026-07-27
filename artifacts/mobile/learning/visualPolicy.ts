// ─── Visual fade policy ──────────────────────────────────────────────────────
// docs/14 §2, the "fade rule".
//
// This is the rule that makes visuals pedagogy rather than decoration:
//
//     mastery < 0.55   →  visual shown, INTERACTIVE (the visual is the answer)
//     0.55 – 0.80      →  visual shown, ILLUSTRATIVE (sits beside the question)
//     mastery > 0.80   →  no visual; symbolic only
//
// Concrete → Pictorial → Abstract, driven automatically by the mastery model
// that already exists. The child is never told they have "graduated" — it
// simply stops appearing.
//
// The withdrawal is not optional politeness. The expertise-reversal effect is
// well established: visual support that persists past competence *reduces*
// performance, because the learner spends working memory reconciling two
// representations instead of using the efficient one. A visual that never fades
// would make the app worse for the children who have succeeded with it.

import type { SkillId } from './skills';
import { MASTERED_THRESHOLD, STRUGGLING_THRESHOLD } from './mastery';

export type VisualModel = 'numberLine' | 'partModel' | 'arrayGrid' | 'baseTen';
export type VisualMode = 'interactive' | 'illustrative' | 'none';

/** Below this, the visual is the answer surface. */
export const VISUAL_INTERACTIVE_BELOW = STRUGGLING_THRESHOLD;   // 0.55
/** At or above this, no visual at all. */
export const VISUAL_HIDDEN_ABOVE = 0.80;

/**
 * Which visual model, if any, suits a skill.
 *
 * The judgement recorded in docs/14 §2 is that visuals are NOT free — they cost
 * screen space, render time and attention — so the test applied is: *does the
 * symbol alone mislead?* Where the answer is no, there is deliberately no
 * visual:
 *
 *   · times tables  — the goal is automaticity; a visual slows retrieval
 *   · word problems — building the model from text IS the skill being trained
 *   · algebra       — single-step at this level; symbols suffice
 */
const MODEL_FOR_SKILL: Partial<Record<SkillId, VisualModel>> = {
  // Fractions — 1/2 + 1/3 = 2/5 is only obviously wrong when you see the pieces.
  'frac.ofAmount':       'partModel',
  'frac.equivalence':    'partModel',
  'frac.addSameDenom':   'partModel',

  // Decimals — dec.longer-is-bigger is a spatial misconception.
  'dec.tenths':          'numberLine',
  'dec.hundredths':      'numberLine',

  // Integers — negative magnitude is genuinely counter-intuitive.
  'integers.basic':      'numberLine',

  // Number sense — magnitude is the whole construct.
  'numsense.compare':    'numberLine',
  'numsense.estimate':   'numberLine',

  // Place value and regrouping — base-ten blocks are the canonical model, and
  // the only way "borrow 1 ten" acquires a referent.
  'placevalue':          'baseTen',
  'add.2digit.carry':    'baseTen',
  'sub.2digit.borrow':   'baseTen',
  'add.3digit':          'baseTen',
  'sub.3digit':          'baseTen',

  // Multiplication structure — the array unifies ×, area and factors.
  'mul.2digit':          'arrayGrid',
  'factors.basic':       'arrayGrid',
  'geometry.basic':      'arrayGrid',
};

export function visualFor(skill: SkillId): VisualModel | null {
  return MODEL_FOR_SKILL[skill] ?? null;
}

/**
 * How — or whether — to show a visual for this skill at this mastery level.
 *
 * `reducedMotion` does not suppress visuals: a static diagram is information,
 * not animation, and removing it would remove understanding rather than
 * movement.
 */
export function visualMode(skill: SkillId, mastery: number): VisualMode {
  if (!visualFor(skill)) return 'none';
  if (mastery >= VISUAL_HIDDEN_ABOVE) return 'none';
  if (mastery < VISUAL_INTERACTIVE_BELOW) return 'interactive';
  return 'illustrative';
}

/** Every skill with a visual, for coverage reporting and tests. */
export const VISUAL_SKILLS = Object.keys(MODEL_FOR_SKILL);

/**
 * Skills deliberately left without a visual, with the reason.
 * Recorded so the omission reads as a decision rather than an oversight.
 */
export const NO_VISUAL_BY_DESIGN: Record<string, string> = {
  'mul.tables.easy':  'automaticity is the goal; a visual slows retrieval',
  'mul.tables.mid':   'automaticity is the goal; a visual slows retrieval',
  'mul.tables.full':  'automaticity is the goal; a visual slows retrieval',
  'wordproblems':     'building the model from text is the skill being trained',
  'algebra.basic':    'single-step at this level; symbols suffice',
};
