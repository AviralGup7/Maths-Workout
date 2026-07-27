// ─── Mastery estimation ──────────────────────────────────────────────────────
// Direction C core.
//
// The legacy model stored `{ attempted, correct }` per session-key. Two counters
// cannot express:
//   · recency — a skill practised once in March reads identically in June
//   · confidence — 1/1 correct and 40/40 correct both read as "100%"
//   · trend — improving and declining learners look the same
//
// This module estimates mastery as a probability with an explicit confidence,
// decayed over time. The estimate is derived from the append-only attempt log,
// so it can always be recomputed from scratch — no migration risk, no drift.

import type { SkillId } from './skills';
import { SKILLS, prerequisiteClosure } from './skills';
import type { Attempt } from './attempts';

/** Half-life of unpractised mastery, in days. */
const DECAY_HALF_LIFE_DAYS = 21;

/** Laplace smoothing prior — pulls sparse estimates toward 0.5 rather than 0 or 1. */
const PRIOR_STRENGTH = 2;

/** Attempts beyond this count contribute little; keeps recent evidence dominant. */
const RECENCY_WINDOW = 12;

/** Mastery at or above this is "secure". */
export const MASTERED_THRESHOLD = 0.85;

/** Mastery at or below this needs immediate work. */
export const STRUGGLING_THRESHOLD = 0.55;

/**
 * Ceiling on mastery that rests entirely on multiple-choice evidence (M4).
 *
 * A four-option question carries roughly a 25% guess probability, and choosing
 * between visible options is *recognition*. Promoting a learner past 0.80 on
 * recognition alone would claim recall they have never demonstrated — and it
 * would do so precisely at the threshold where the interaction ladder switches
 * to typed entry, so the app would be certifying a skill it had never tested.
 *
 * Attempts are treated as recall-bearing when the learner produced the answer
 * rather than picked it: typed entry, multi-select and ordering all qualify,
 * because none of them can be solved by elimination from four tiles.
 */
export const RECOGNITION_CEILING = 0.80;

export interface MasteryEstimate {
  skill: SkillId;
  /** Probability the learner answers a fresh question correctly, 0–1. */
  value: number;
  /** 0–1. Low when evidence is sparse or stale. */
  confidence: number;
  attempts: number;
  correct: number;
  /** Epoch ms of the most recent attempt, or null if never practised. */
  lastPracticed: number | null;
  /** Change in accuracy between the older and newer half of recent attempts. */
  trend: number;
  /** Raw accuracy before decay is applied — used for reporting, not scheduling. */
  rawAccuracy: number;
}

export const DAY_MS = 86_400_000;

/**
 * Exponential decay toward the 0.5 prior.
 * A skill unpractised for one half-life sits halfway between its last estimate
 * and pure uncertainty.
 */
export function applyDecay(value: number, daysSince: number): number {
  if (daysSince <= 0) return value;
  const retained = Math.pow(0.5, daysSince / DECAY_HALF_LIFE_DAYS);
  return 0.5 + (value - 0.5) * retained;
}

/**
 * Estimate mastery for one skill from its attempt history.
 *
 * Recent attempts are weighted more heavily than old ones (linear ramp across
 * the recency window) so that improvement is reflected quickly rather than
 * being drowned by a long tail of early failures.
 */
export function estimateMastery(
  skill: SkillId,
  attempts: Attempt[],
  now: number = Date.now(),
): MasteryEstimate {
  const relevant = attempts
    .filter(a => a.skill === skill)
    .sort((a, b) => a.answeredAt - b.answeredAt);

  if (relevant.length === 0) {
    return {
      skill, value: 0.5, confidence: 0, attempts: 0, correct: 0,
      lastPracticed: null, trend: 0, rawAccuracy: 0,
    };
  }

  const totalCorrect = relevant.filter(a => a.correct).length;
  const rawAccuracy = totalCorrect / relevant.length;

  // Weighted accuracy over the recency window.
  const window = relevant.slice(-RECENCY_WINDOW);
  let weightedCorrect = 0;
  let weightTotal = 0;
  window.forEach((a, i) => {
    const recency = 1 + i / window.length; // oldest ≈1.0 → newest ≈2.0
    // A correct answer produced with a scaffold on screen is genuine evidence,
    // but weaker evidence: the child succeeded *with support*. Half weight
    // keeps the estimate honest without punishing them for accepting help.
    const w = recency * (a.scaffolded && a.correct ? 0.5 : 1);
    weightTotal += w;
    if (a.correct) weightedCorrect += w;
  });

  // Laplace-smoothed estimate: sparse evidence stays near the prior.
  const smoothed =
    (weightedCorrect + PRIOR_STRENGTH * 0.5) / (weightTotal + PRIOR_STRENGTH);

  const lastPracticed = relevant[relevant.length - 1].answeredAt;
  const daysSince = Math.max(0, (now - lastPracticed) / DAY_MS);
  let value = clamp01(applyDecay(smoothed, daysSince));

  // M4 · Anti-inflation guard. Mastery above the recognition ceiling has to be
  // earned on evidence the learner produced, not selected. Without this the
  // estimate crosses 0.80 on multiple choice, the interaction ladder promotes
  // them to typed entry on the strength of it, and the app has certified recall
  // it never observed.
  const producedAnswer = relevant.some(
    a => a.correct && a.interaction && a.interaction !== 'choice',
  );
  if (!producedAnswer && value > RECOGNITION_CEILING) {
    value = RECOGNITION_CEILING;
  }

  // Confidence grows with evidence and shrinks as evidence goes stale.
  const evidence = Math.min(1, relevant.length / 8);
  const freshness = Math.pow(0.5, daysSince / (DECAY_HALF_LIFE_DAYS * 2));
  const confidence = clamp01(evidence * (0.4 + 0.6 * freshness));

  // Trend: newer half minus older half of the recency window.
  let trend = 0;
  if (window.length >= 4) {
    const mid = Math.floor(window.length / 2);
    const older = window.slice(0, mid);
    const newer = window.slice(mid);
    const acc = (xs: Attempt[]) => xs.filter(a => a.correct).length / xs.length;
    trend = acc(newer) - acc(older);
  }

  return {
    skill,
    value,
    confidence,
    attempts: relevant.length,
    correct: totalCorrect,
    lastPracticed,
    trend,
    rawAccuracy,
  };
}

/** Estimate every skill that has been attempted, keyed by skill id. */
export function estimateAll(
  attempts: Attempt[],
  now: number = Date.now(),
): Record<SkillId, MasteryEstimate> {
  const bySkill = new Set(attempts.map(a => a.skill));
  const out: Record<SkillId, MasteryEstimate> = {};
  for (const skill of bySkill) {
    if (!SKILLS[skill]) continue; // ignore ids from removed/renamed skills
    out[skill] = estimateMastery(skill, attempts, now);
  }
  return out;
}

/**
 * Is this skill ready to be introduced?
 * A skill is ready when every prerequisite is at or above the threshold, or has
 * simply never been practised (we do not block a learner on an untested gate).
 */
export function isReady(
  skill: SkillId,
  estimates: Record<SkillId, MasteryEstimate>,
  threshold = 0.7,
): boolean {
  const prereqs = SKILLS[skill]?.prerequisites ?? [];
  return prereqs.every(p => {
    const e = estimates[p];
    if (!e || e.attempts === 0) return true;
    return e.value >= threshold;
  });
}

/**
 * Find the weakest *prerequisite* behind a struggling skill.
 *
 * This is what turns "you got fractions wrong" into "your fraction work is
 * failing because equivalence isn't secure" — the diagnostic payoff of holding
 * a graph rather than a flat list.
 */
export function findRootGap(
  skill: SkillId,
  estimates: Record<SkillId, MasteryEstimate>,
): SkillId | null {
  const chain = prerequisiteClosure(skill);
  let worst: SkillId | null = null;
  let worstValue = STRUGGLING_THRESHOLD;
  for (const p of chain) {
    const e = estimates[p];
    if (!e || e.attempts < 3) continue;
    if (e.value < worstValue) {
      worstValue = e.value;
      worst = p;
    }
  }
  return worst;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
