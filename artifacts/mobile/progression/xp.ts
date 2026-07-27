// ─── XP economy ──────────────────────────────────────────────────────────────
// The central design decision, and the one everything else follows from:
//
//   XP IS PAID FOR MOVEMENT IN THE MASTERY MODEL, NOT FOR ANSWERING QUESTIONS.
//
// Almost every educational XP system pays per correct answer and then bolts on
// anti-grind rules to stop the obvious exploit. That is backwards: it creates a
// profitable behaviour and then polices it. Children are extremely good at
// finding the cheapest path to a number that goes up, and any rule-based patch
// leaves a residue of "technically optimal but pedagogically worthless" play.
//
// If the payout is a function of Δmastery, grinding is not *punished* — it is
// simply worth nothing, because a skill you have already mastered cannot move.
// The exploit stops being a rule violation and becomes an arithmetic identity.
//
// Everything below is a modifier on that core idea.

import type { SkillId } from '../learning/skills';
import { SKILLS, prerequisiteClosure } from '../learning/skills';
import type { MasteryEstimate } from '../learning/mastery';
import { MASTERED_THRESHOLD, STRUGGLING_THRESHOLD } from '../learning/mastery';
import type { Difficulty, SchoolClass } from '../generators/types';
import type { InteractionKind } from '../generators/interactions';

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * XP paid per 1.0 of mastery gained on a skill.
 *
 * Calibrated by simulation, not chosen by feel. At 100 an honest learner earned
 * ~1.7 XP per question, which is too small a number to read as a reward and
 * made the floor payment (1 XP) proportionally far too large — grinding was
 * unprofitable but still visible. At 600 a skill taken 0.30 -> 0.85 pays ~330 XP
 * across its life, an honest 20-question session pays ~200 XP, and the 1 XP
 * floor becomes the rounding error it should be.
 */
export const XP_PER_MASTERY_POINT = 600;

/**
 * Small payment for a correct answer that moved mastery by ~nothing.
 *
 * This exists for one reason: pure Δmastery pays zero for maintenance review,
 * and retrieval practice on a secure skill IS valuable — it is what stops the
 * 21-day decay. Paying literally nothing would teach children that reviewing is
 * a waste of time, which is the opposite of the intended lesson.
 *
 * Deliberately tiny. It must never be worth farming: at 1 XP a child would need
 * ~330 questions to match a single properly learned skill, at which point the
 * session and saturation decays have long since reduced it to 0.1 XP.
 */
export const LEARNING_FLOOR_XP = 1;

/** Ceiling on XP from any single question. Blocks unbounded multiplier stacking. */
export const MAX_XP_PER_QUESTION = 250;

/**
 * Ceiling on the PRODUCT of all bonus multipliers.
 *
 * Added after simulation: a "difficulty farmer" stacking expert difficulty
 * (1.5) x ordering (1.35) x metacognitive structure (1.4) reached a 2.8x
 * multiplier and earned 117% of an honest learner's XP while ending with a
 * mastery index of 20 vs 65. Multiplier stacking was outrunning the Delta-mastery
 * core, which is exactly the failure the core was meant to prevent.
 *
 * Capping the product keeps every individual multiplier meaningful while
 * guaranteeing that no combination of question properties can substitute for
 * actually learning something.
 */
export const MAX_MULTIPLIER_PRODUCT = 2.0;

// ─── Skill weight ────────────────────────────────────────────────────────────

/**
 * How much a skill matters, from its position in the prerequisite DAG.
 *
 * A skill that blocks many others is worth more than a leaf, because securing
 * it unblocks downstream learning. This is computed from the graph rather than
 * hand-assigned, so it stays correct when skills are added.
 *
 * Range ~1.0 (leaf) to ~1.6 (foundational bottleneck).
 */
export function skillWeight(skill: SkillId): number {
  const dependents = Object.values(SKILLS).filter(s =>
    s.prerequisites.includes(skill)).length;
  const depth = prerequisiteClosure(skill).length;
  // Dependents dominate: being a bottleneck matters more than being deep.
  return 1 + Math.min(0.4, dependents * 0.1) + Math.min(0.2, depth * 0.02);
}

// ─── Question-type weight ────────────────────────────────────────────────────

/**
 * Cognitive demand of the question form.
 *
 * The brief asks that simple addition not pay the same as long division. But
 * the honest version of that requirement is subtler: what should differ is not
 * the *topic* but the **cognitive operation**. Long division is worth more than
 * single-digit addition because it is multi-step and holds more in working
 * memory — not because "division" is a more prestigious word.
 *
 * Topic difficulty is already captured by mastery: a child who finds addition
 * hard has low addition mastery and therefore large Δmastery to earn. Paying
 * extra for the *topic* on top would double-count and would punish young
 * learners for being young, which is indefensible in a Class 1–6 product.
 */
export const INTERACTION_WEIGHT: Record<InteractionKind, number> = {
  // Recognition: the answer is on screen. Cheapest, and correctly so.
  choice: 1.00,
  // Recall: the answer must be produced. No elimination possible.
  entry: 1.25,
  // Set reasoning: every option must be evaluated, not just one found.
  multiSelect: 1.30,
  // Relational reasoning: n items ordered against each other.
  ordering: 1.35,
  // Approximation under a band. Sits between recognition and full recall: the
  // options are visible, but they cannot be eliminated by computing — the
  // child has to hold a sense of magnitude, which is a different construct.
  estimate: 1.20,
};

/**
 * Multi-step / reasoning surcharge, applied on top of interaction weight.
 * Keyed by the *structure* of the task, which is what actually costs the child.
 */
export const STRUCTURE_WEIGHT = {
  singleStep: 1.00,
  /** Two or more chained operations (long division, multi-step word problems). */
  multiStep: 1.30,
  /** Approximation under a range answer — a different construct entirely. */
  estimation: 1.20,
  /** Evaluating a procedure rather than executing one (error hunting). */
  metacognitive: 1.40,
} as const;

export type Structure = keyof typeof STRUCTURE_WEIGHT;

// ─── Difficulty ──────────────────────────────────────────────────────────────

/**
 * Difficulty multipliers.
 *
 * The brief warns: avoid making "hard" the only efficient way to gain XP. The
 * spread here is deliberately narrow (1.0 → 1.5) and — critically — difficulty
 * is NOT free to choose profitably, because attempting work far above your
 * mastery produces mostly wrong answers, and wrong answers move mastery *down*.
 *
 * The economy self-corrects: the most profitable difficulty is the one at the
 * edge of your ability, which is exactly the zone of proximal development.
 * We do not have to enforce that. The mathematics enforces it.
 */
/**
 * docs/21 · the spread was narrowed from (1.0 … 1.5) to (1.0 … 1.2).
 *
 * The original reasoning — that over-reach self-corrects because wrong answers
 * move mastery down — is sound but incomplete. It assumes the learner picks
 * hard content they cannot do. A learner who picks hard content they CAN do is
 * paid twice for the same fact: once by Δmastery (harder items move the
 * estimate further) and again by this multiplier. Measured over a simulated
 * year, an "always hard" learner earned 29,038 XP against a gifted learner's
 * 23,884 while mastering 1 skill against 30 — the difficulty selector had
 * become the most profitable button in the app.
 *
 * `relativeChallenge` already pays for genuine stretch, and it does so
 * per-learner, which is the honest version of this idea. The residual spread
 * here only acknowledges that harder items take longer.
 */
export const DIFFICULTY_MULTIPLIER: Record<Difficulty | 'expert', number> = {
  easy: 1.00,
  medium: 1.10,
  hard: 1.20,
  /** Reserved for adaptive over-reach: content above the learner's class band. */
  expert: 1.25,
};

/**
 * Relative-challenge multiplier: how hard was this *for this learner*?
 *
 * A "hard" question is not hard for a child who has mastered it. This scales
 * payout by the gap between the question's demand and the learner's estimated
 * mastery, so the same question pays differently to different children — which
 * is the fair outcome, and impossible in a flat XP system.
 *
 * Peaks in the desirable-difficulty band and falls off on both sides:
 *   · far below ability → trivial, ~0.6
 *   · at the frontier   → 1.0
 *   · far above ability → 0.75 (attempted, but likely guessed; see penalties)
 */
export function relativeChallenge(mastery: number, demand: number): number {
  const gap = demand - mastery;           // >0 means harder than the learner
  if (gap < -0.30) return 0.60;           // well within comfort
  if (gap < -0.10) return 0.85;
  if (gap <= 0.20) return 1.00;           // the productive band
  if (gap <= 0.40) return 0.90;           // a stretch, still useful
  return 0.75;                            // over-reach: real, but noisy
}

// ─── Speed ───────────────────────────────────────────────────────────────────

/**
 * Speed multiplier — fluency reward, guess-proofed.
 *
 * Three rules make this safe, and all three are necessary:
 *
 *  1 · The bonus applies ONLY at mastery >= MASTERED_THRESHOLD. Speed before
 *      accuracy is a misconception factory. A struggling child who is rewarded
 *      for speed learns to answer fast and wrong, and we have already built a
 *      `guessing` misconception detector that fires below 1200 ms.
 *
 *  2 · There is a FLOOR, not just a ceiling. Answers faster than the plausible
 *      floor for the question earn NO bonus — you cannot have computed it. This
 *      is what stops "tap the first tile instantly" from being profitable.
 *
 *  3 · Slow is never penalised. The minimum multiplier is 1.0. A child who
 *      thinks for 40 seconds and gets it right has done something valuable, and
 *      timed pressure is a documented anxiety driver in early primary (which is
 *      why the timer itself already defaults off below Class 3).
 *
 * The bonus is small on purpose. Fluency is worth acknowledging, not chasing.
 */
export const SPEED_MAX_BONUS = 0.15;   // +15% ceiling
export const SPEED_MIN_BONUS = 0.00;   // never negative

/**
 * Plausible floor, in ms, below which we assume the answer was not computed.
 * Scales with structure: a multi-step problem cannot honestly be done in 800ms.
 */
export function plausibilityFloorMs(structure: Structure, cls: SchoolClass): number {
  const base = { singleStep: 1200, estimation: 1500, multiStep: 3000, metacognitive: 3500 }[structure];
  // Younger children read and process more slowly; the floor must not treat
  // normal Class 1 pace as suspicious.
  const young = cls === '1st' || cls === '2nd' ? 1.4 : cls === '3rd' ? 1.2 : 1.0;
  return base * young;
}

/** Target time, in ms, for a fluent answer. Beyond this, no bonus (but no penalty). */
export function fluentTargetMs(structure: Structure, cls: SchoolClass): number {
  const base = { singleStep: 6000, estimation: 8000, multiStep: 20000, metacognitive: 25000 }[structure];
  const young = cls === '1st' || cls === '2nd' ? 1.6 : cls === '3rd' ? 1.3 : 1.0;
  return base * young;
}

export function speedMultiplier(args: {
  latencyMs: number;
  structure: Structure;
  cls: SchoolClass;
  mastery: number;
}): number {
  const { latencyMs, structure, cls, mastery } = args;
  // Rule 1 — fluency bonus is for the already-accurate only.
  if (mastery < MASTERED_THRESHOLD) return 1.0;

  const floor = plausibilityFloorMs(structure, cls);
  const target = fluentTargetMs(structure, cls);

  // Rule 2 — implausibly fast earns nothing. Not a penalty; simply no bonus.
  if (latencyMs < floor) return 1.0;
  // Rule 3 — slow is fine.
  if (latencyMs >= target) return 1.0 + SPEED_MIN_BONUS;

  // Linear ramp between floor (full bonus) and target (no bonus).
  const t = (target - latencyMs) / (target - floor);
  return 1.0 + SPEED_MAX_BONUS * Math.max(0, Math.min(1, t));
}

// ─── Attempt penalty ─────────────────────────────────────────────────────────

/**
 * Payout decay for repeated attempts at the same skill in one session.
 *
 * The brief asks that a correct answer after many failures earn reduced XP,
 * while recovery stays encouraged. These pull against each other, so the curve
 * matters: it decays to a FLOOR, not to zero.
 *
 * A child who fails five times and then succeeds has done something genuinely
 * hard, and paying them nothing is the fastest way to teach learned
 * helplessness. 0.40 is low enough that guess-until-correct is unprofitable,
 * high enough that persistence still visibly pays.
 */
export const RECOVERY_FLOOR = 0.40;

export function attemptDecay(priorMissesThisSkill: number): number {
  if (priorMissesThisSkill <= 0) return 1.00;
  return Math.max(RECOVERY_FLOOR, Math.pow(0.75, priorMissesThisSkill));
}

/**
 * Guess suppression.
 *
 * A wrong answer below the plausibility floor is a tap, not an attempt. It
 * should not merely pay zero — it should not *count* as an attempt for the
 * purposes of the recovery curve either, or a child could burn through the
 * decay with instant taps and then answer properly at full rate. Returns true
 * when the attempt should be excluded from XP accounting entirely.
 */
export function isNonAttempt(latencyMs: number, structure: Structure, cls: SchoolClass): boolean {
  return latencyMs < plausibilityFloorMs(structure, cls) * 0.5;
}

// ─── Bonuses ─────────────────────────────────────────────────────────────────

/**
 * One-off bonuses for the events that actually represent learning.
 *
 * These are the emotional peaks of the system and they are all tied to
 * *change*, never to volume. Note there is no "answered N questions" bonus
 * anywhere — that is the archetypal metric that rewards attendance over
 * learning.
 */
export const BONUS = {
  /** Crossed STRUGGLING_THRESHOLD upward on a skill — the hardest climb. */
  breakthrough: 40,
  /** Crossed MASTERED_THRESHOLD upward. */
  mastery: 60,
  /** Mastery earned on typed/produced evidence rather than recognition. */
  trueRecall: 25,
  /** A previously-detected misconception has not recurred in 10 attempts. */
  misconceptionCleared: 50,
  /** Correct on a skill that had decayed below 0.5 since last practice. */
  recovered: 30,
  /** Completed a spaced review that was due, on a skill above 0.85. */
  retention: 15,
  /** First correct answer on a skill never attempted before. */
  firstContact: 10,
  /** Whole chapter finished with every skill above MASTERED_THRESHOLD. */
  chapterMastery: 250,
  /** Answered correctly on the twin question straight after a worked example. */
  transferAfterTeaching: 35,
} as const;

// ─── The formula ─────────────────────────────────────────────────────────────

export interface XpInput {
  correct: boolean;
  /** Mastery BEFORE this attempt. */
  masteryBefore: number;
  /** Mastery AFTER this attempt, recomputed from the log. */
  masteryAfter: number;
  skill: SkillId;
  difficulty: Difficulty | 'expert';
  interaction: InteractionKind;
  structure: Structure;
  latencyMs: number;
  cls: SchoolClass;
  /** Misses on this skill earlier in this session. */
  priorMissesThisSkill: number;
  /** True when a hint or worked example was on screen. */
  scaffolded?: boolean;
  /** Session-level diminishing returns factor (see antiGrind.ts). */
  sessionDecay?: number;
}

export interface XpBreakdown {
  total: number;
  learningXp: number;
  floorXp: number;
  multipliers: Record<string, number>;
  suppressed?: string;
}

/**
 * Compute XP for one answered question.
 *
 * Shape:
 *     XP = [ Δmastery · 100 · skillWeight  +  floor ]
 *          × difficulty × relativeChallenge × interaction × structure
 *          × speed × attemptDecay × scaffoldDiscount × sessionDecay
 *
 * The bracket is the *earned* part; everything outside it is a modifier. That
 * ordering is intentional — if Δmastery is zero, no multiplier can inflate the
 * result beyond the floor, so no stacking of difficulty/speed/type bonuses can
 * ever make repeating mastered content profitable.
 */
export function computeXp(input: XpInput): XpBreakdown {
  const {
    correct, masteryBefore, masteryAfter, skill, difficulty, interaction,
    structure, latencyMs, cls, priorMissesThisSkill, scaffolded, sessionDecay = 1,
  } = input;

  // Non-attempts pay nothing and are recorded as such.
  if (isNonAttempt(latencyMs, structure, cls)) {
    return { total: 0, learningXp: 0, floorXp: 0, multipliers: {}, suppressed: 'non-attempt' };
  }

  // Wrong answers pay no XP — but they are not penalised in XP terms either.
  // The cost of a wrong answer is already paid in the mastery model, which is
  // the honest currency. Deducting XP as well would double-punish and would
  // make the total a worse signal of progress.
  if (!correct) {
    return { total: 0, learningXp: 0, floorXp: 0, multipliers: {}, suppressed: 'incorrect' };
  }

  const delta = Math.max(0, masteryAfter - masteryBefore);
  const learningXp = delta * XP_PER_MASTERY_POINT * skillWeight(skill);

  const m: Record<string, number> = {
    difficulty: DIFFICULTY_MULTIPLIER[difficulty],
    relativeChallenge: relativeChallenge(masteryBefore, demandOf(difficulty)),
    interaction: INTERACTION_WEIGHT[interaction],
    structure: STRUCTURE_WEIGHT[structure],
    speed: speedMultiplier({ latencyMs, structure, cls, mastery: masteryBefore }),
    attemptDecay: attemptDecay(priorMissesThisSkill),
    // Succeeding with support on screen is real, but it is not unaided
    // performance. Same 0.5 weight the mastery model already applies.
    scaffold: scaffolded ? 0.5 : 1.0,
    session: sessionDecay,
  };

  // Bonus multipliers are capped as a group; suppressive factors (attempt
  // decay, scaffold discount, session decay) are applied afterwards and are
  // deliberately NOT capped — they must always be able to drive payout down.
  const bonusProduct = Math.min(
    MAX_MULTIPLIER_PRODUCT,
    m.difficulty * m.relativeChallenge * m.interaction * m.structure * m.speed,
  );
  const suppressors = m.attemptDecay * m.scaffold * m.session;
  const product = bonusProduct * suppressors;
  const raw = (learningXp + LEARNING_FLOOR_XP) * product;

  return {
    total: Math.min(MAX_XP_PER_QUESTION, Math.round(raw * 10) / 10),
    learningXp: Math.round(learningXp * product * 10) / 10,
    floorXp: Math.round(LEARNING_FLOOR_XP * product * 10) / 10,
    multipliers: m,
  };
}

/** Nominal demand level of a difficulty band, on the mastery scale. */
export function demandOf(d: Difficulty | 'expert'): number {
  return { easy: 0.35, medium: 0.60, hard: 0.80, expert: 0.92 }[d];
}
