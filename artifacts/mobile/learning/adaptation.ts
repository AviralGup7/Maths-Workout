// ─── In-session adaptation ───────────────────────────────────────────────────
// Implements §3 of docs/14-educational-improvement-roadmap.md.
//
// The scheduler (scheduler.ts) decides what a session should contain *before*
// it starts. That is not enough. The audit simulated a struggling learner and
// measured a session that was 70% one skill at ~5% expected success — a child
// answering 1 question in 20 correctly, for ten minutes, with no way out.
//
// This module is the missing half: it reacts to what happens *during* the
// session. Four mechanisms, all pure functions over the attempt log so they can
// be tested without a running app:
//
//   M1  success floor          — pre-session, in scheduler.buildSession
//   M2  prerequisite descent   — this file: fix the cause, not the symptom
//   M3  frustration breaker    — this file: interrupt the failure spiral
//   M4  anti-inflation guard   — mastery.ts: recognition is not recall
//
// The learner must never perceive any of this. Adaptivity a child can see is
// adaptivity that tells them they are being handled, which damages self-concept
// more than the hard questions did.

import type { SkillId } from './skills';
import { SKILLS, prerequisiteClosure } from './skills';
import type { MasteryEstimate } from './mastery';
import { MASTERED_THRESHOLD, STRUGGLING_THRESHOLD } from './mastery';
import type { Attempt } from './attempts';

/** Consecutive misses on one skill before we look for the underlying gap. */
export const DESCENT_TRIGGER = 2;

/** Consecutive misses (any skill) before a confidence item is forced. */
export const BREAKER_TRIGGER = 3;

/**
 * How far down the prerequisite chain we will go.
 *
 * Unbounded descent is a real failure mode: a Class 6 learner failing algebra
 * could be walked all the way back to "add within 10", which is humiliating and
 * almost never the actual cause. Two levels reaches the genuine gap in
 * practice; below that the answer is instruction, not easier questions.
 */
export const MAX_DESCENT_DEPTH = 2;

/** Mastery a prerequisite must reach before we return to the skill that failed. */
export const RETURN_THRESHOLD = 0.70;

/** A skill this secure is a confidence item — used to break a failure spiral. */
export const CONFIDENCE_THRESHOLD = MASTERED_THRESHOLD;

// ─── M2 · Prerequisite descent ───────────────────────────────────────────────

/** Trailing attempts on one skill, newest last. */
function tailFor(log: Attempt[], skill: SkillId, n: number): Attempt[] {
  return log.filter(a => a.skill === skill).slice(-n);
}

/** Consecutive misses on `skill` at the end of the log. */
export function consecutiveMisses(log: Attempt[], skill: SkillId): number {
  const mine = log.filter(a => a.skill === skill);
  let n = 0;
  for (let i = mine.length - 1; i >= 0; i--) {
    if (mine[i].correct) break;
    n++;
  }
  return n;
}

/** Consecutive misses at the end of the log, regardless of skill. */
export function consecutiveMissesAny(log: Attempt[]): number {
  let n = 0;
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].correct) break;
    n++;
  }
  return n;
}

export interface DescentResult {
  /** Skill to practise instead. Null when no weak prerequisite exists. */
  target: SkillId | null;
  /** How many levels below the failing skill the target sits. */
  depth: number;
  /**
   * Why the descent produced no target — the caller uses this to decide
   * whether to teach instead. `'no-weak-prerequisite'` is the signal that the
   * gap is in this skill itself, so a worked example is the right response.
   */
  reason: 'descended' | 'no-weak-prerequisite' | 'depth-capped' | 'not-triggered';
}

/**
 * Find the prerequisite to practise instead of a skill the learner keeps failing.
 *
 * This is the key fix in the roadmap. The previous behaviour on repeated failure
 * was to lower the operand size — smaller numbers, same skill. That is the wrong
 * axis. A child failing 2-digit subtraction with borrowing does not need
 * *smaller numbers*; they need the place-value understanding that borrowing
 * rests on. `findRootGap` already computed exactly that and was used only to
 * print a label on the progress screen. Here it becomes load-bearing.
 */
export function descendToPrerequisite(
  skill: SkillId,
  estimates: Record<SkillId, MasteryEstimate>,
  log: Attempt[],
): DescentResult {
  if (consecutiveMisses(log, skill) < DESCENT_TRIGGER) {
    return { target: null, depth: 0, reason: 'not-triggered' };
  }

  const chain = prerequisiteClosure(skill);
  if (chain.length === 0) {
    return { target: null, depth: 0, reason: 'no-weak-prerequisite' };
  }

  // Depth of each prerequisite below the failing skill, so the cap is real.
  const depthOf = new Map<SkillId, number>();
  let frontier: SkillId[] = [skill];
  for (let d = 1; d <= MAX_DESCENT_DEPTH; d++) {
    const next: SkillId[] = [];
    for (const s of frontier) {
      for (const p of SKILLS[s]?.prerequisites ?? []) {
        if (!depthOf.has(p)) { depthOf.set(p, d); next.push(p); }
      }
    }
    frontier = next;
  }

  // The weakest prerequisite within the cap that has enough evidence to trust.
  let target: SkillId | null = null;
  let worst = STRUGGLING_THRESHOLD;
  for (const [p, d] of depthOf) {
    if (d > MAX_DESCENT_DEPTH) continue;
    const e = estimates[p];
    if (!e || e.attempts < 3) continue;
    if (e.value < worst) { worst = e.value; target = p; }
  }

  if (target) return { target, depth: depthOf.get(target) ?? 1, reason: 'descended' };

  // A weak prerequisite may exist further down than we are willing to go.
  const deepGap = chain.some(p => {
    const e = estimates[p];
    return e && e.attempts >= 3 && e.value < STRUGGLING_THRESHOLD;
  });
  return {
    target: null,
    depth: 0,
    reason: deepGap ? 'depth-capped' : 'no-weak-prerequisite',
  };
}

/** Has a descent target been repaired well enough to return to the parent skill? */
export function readyToReturn(
  prerequisite: SkillId,
  estimates: Record<SkillId, MasteryEstimate>,
): boolean {
  const e = estimates[prerequisite];
  if (!e) return false;
  return e.value >= RETURN_THRESHOLD;
}

// ─── M3 · Frustration circuit-breaker ────────────────────────────────────────

/**
 * Three consecutive misses means the session has stopped teaching and started
 * eroding. Interrupt with something the learner can certainly do.
 *
 * This is not a reward and it is not padding: retrieval practice on a secure
 * skill is genuinely valuable, and it costs one question to prevent a child
 * concluding that they are bad at maths.
 */
export function needsCircuitBreaker(log: Attempt[]): boolean {
  return consecutiveMissesAny(log) >= BREAKER_TRIGGER;
}

/**
 * Pick a skill the learner will almost certainly get right.
 * Prefers the most secure skill available; returns null if nothing qualifies,
 * in which case the caller should fall back to the easiest candidate it has.
 */
export function pickConfidenceSkill(
  candidates: SkillId[],
  estimates: Record<SkillId, MasteryEstimate>,
): SkillId | null {
  let best: SkillId | null = null;
  let bestValue = CONFIDENCE_THRESHOLD;
  for (const s of candidates) {
    const e = estimates[s];
    if (!e || e.attempts < 3) continue;
    if (e.value >= bestValue) { bestValue = e.value; best = s; }
  }
  return best;
}

// ─── The combined decision ───────────────────────────────────────────────────

export type AdaptationKind =
  /** Carry on with the planned question. */
  | { kind: 'continue' }
  /** Swap the next question for a prerequisite the learner is missing. */
  | { kind: 'descend'; skill: SkillId; from: SkillId; depth: number }
  /** Swap the next question for one the learner is secure on. */
  | { kind: 'confidence'; skill: SkillId }
  /**
   * The learner is failing a skill with no weak prerequisite behind it.
   * Practice cannot fix this — they need to be shown the method.
   */
  | { kind: 'teach'; skill: SkillId };

/**
 * Decide what should happen after an answer.
 *
 * Ordering matters. The circuit-breaker runs first because three misses in a
 * row is an emotional state, not a knowledge state, and no amount of correctly
 * targeted prerequisite work helps a child who has stopped trying.
 */
export function decideAdaptation(args: {
  /** Attempts from this session only, oldest first. */
  sessionLog: Attempt[];
  /** The skill the learner has just been working on. */
  currentSkill: SkillId;
  estimates: Record<SkillId, MasteryEstimate>;
  /** Skills reachable in this session, for confidence-item selection. */
  candidates: SkillId[];
}): AdaptationKind {
  const { sessionLog, currentSkill, estimates, candidates } = args;
  if (sessionLog.length === 0) return { kind: 'continue' };
  const last = sessionLog[sessionLog.length - 1];
  if (last.correct) return { kind: 'continue' };

  if (needsCircuitBreaker(sessionLog)) {
    const skill = pickConfidenceSkill(candidates, estimates);
    if (skill) return { kind: 'confidence', skill };
  }

  const descent = descendToPrerequisite(currentSkill, estimates, sessionLog);
  if (descent.target) {
    return { kind: 'descend', skill: descent.target, from: currentSkill, depth: descent.depth };
  }

  // Repeated failure with nothing weaker to blame: the skill itself is the gap.
  if (
    consecutiveMisses(sessionLog, currentSkill) >= DESCENT_TRIGGER &&
    descent.reason === 'no-weak-prerequisite' &&
    (estimates[currentSkill]?.value ?? 0.5) < STRUGGLING_THRESHOLD
  ) {
    return { kind: 'teach', skill: currentSkill };
  }

  return { kind: 'continue' };
}
