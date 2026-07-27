// ─── XP award orchestration ──────────────────────────────────────────────────
// docs/16 Phases A and B.
//
// `computeXp` is a pure function over seven inputs, and the anti-grind
// suppressors are four more pure functions. Assembling them correctly at the
// call site would mean the game screen had to understand the whole economy —
// and any screen that got it slightly wrong would silently mis-pay.
//
// This module is the single place where the economy is assembled. The screen
// asks one question ("how much did this answer earn?") and gets one answer,
// with a full breakdown for debugging and for the ledger.

import type { Attempt } from '../learning/attempts';
import { dayKey } from '../learning/attempts';
import type { SkillId } from '../learning/skills';
import type { Difficulty, SchoolClass, Question } from '../generators/types';
import { MASTERED_THRESHOLD, STRUGGLING_THRESHOLD } from '../learning/mastery';
import { computeXp, BONUS, type Structure, type XpBreakdown } from './xp';
import {
  sessionDecay, skillSaturation, repetitionDecay, payableDelta,
  comebackMultiplier,
} from './antiGrind';

/**
 * Per-skill high-water mark of mastery already paid for.
 *
 * This is the anti-oscillation ledger (docs/16 E7) and the ONE piece of
 * progression state that must be persisted: everything else — level, mastery
 * index, achievements — is derived from the attempt log and can be recomputed.
 * Without it, a learner could let a skill decay and re-earn the same Δ forever.
 */
export type XpLedger = Record<SkillId, number>;

export interface AwardInput {
  question: Question;
  skill: SkillId;
  correct: boolean;
  /** Mastery before this answer. */
  masteryBefore: number;
  /** Mastery after this answer, recomputed from the log. */
  masteryAfter: number;
  latencyMs: number;
  difficulty: Difficulty;
  cls: SchoolClass;
  scaffolded?: boolean;
  /** Misses on this skill earlier in this session. */
  priorMissesThisSkill: number;
  /** Full attempt log, for saturation and repetition accounting. */
  log: Attempt[];
  ledger: XpLedger;
  /** Days this skill has been avoided, if the scheduler flagged it. */
  daysAvoided?: number;
  now?: number;
}

export interface Award {
  xp: number;
  breakdown: XpBreakdown;
  /** Bonus events triggered by this answer, in display order. */
  bonuses: { id: keyof typeof BONUS; xp: number }[];
  /** Updated ledger, if the high-water mark moved. */
  ledger: XpLedger;
  /** Total including bonuses. */
  total: number;
}

/**
 * Infer the cognitive structure of a question.
 *
 * Structure is about the SHAPE of the task, not its topic — see the note in
 * xp.ts on why paying extra for "division" would double-count and would
 * penalise young learners for being young.
 */
export function structureOf(q: Question, skill: SkillId): Structure {
  if (q.interaction?.kind === 'estimate') return 'estimation';
  if (/sensible|ठीक लगता|which step|कौन-सा चरण/i.test(q.questionText)) return 'metacognitive';
  // Multi-step: long division/multiplication, and word problems that must be
  // modelled before they can be computed.
  if (skill === 'mul.2digit' || skill === 'mul.large' || skill === 'div.large') return 'multiStep';
  if (skill === 'wordproblems') return 'multiStep';
  return 'singleStep';
}

/**
 * Detect the one-off bonus events this answer triggered.
 *
 * Every bonus is tied to a *change of state*, never to volume. There is
 * deliberately no "answered N questions" bonus: that rewards attendance rather
 * than learning.
 */
export function detectBonuses(args: {
  correct: boolean;
  masteryBefore: number;
  masteryAfter: number;
  skill: SkillId;
  log: Attempt[];
  interaction?: string;
  scaffolded?: boolean;
  wasDue?: boolean;
}): { id: keyof typeof BONUS; xp: number }[] {
  const { correct, masteryBefore, masteryAfter, skill, log, interaction, scaffolded, wasDue } = args;
  if (!correct) return [];
  const out: { id: keyof typeof BONUS; xp: number }[] = [];

  const priorOnSkill = log.filter(a => a.skill === skill).length;

  // First correct answer on a skill never attempted before.
  if (priorOnSkill <= 1) out.push({ id: 'firstContact', xp: BONUS.firstContact });

  // Threshold crossings — the two biggest moments in the model.
  if (masteryBefore < STRUGGLING_THRESHOLD && masteryAfter >= STRUGGLING_THRESHOLD) {
    out.push({ id: 'breakthrough', xp: BONUS.breakthrough });
  }
  if (masteryBefore < MASTERED_THRESHOLD && masteryAfter >= MASTERED_THRESHOLD) {
    out.push({ id: 'mastery', xp: BONUS.mastery });
    // Mastery earned on produced rather than recognised evidence is worth more,
    // and closes the loop with the anti-inflation guard.
    if (interaction && interaction !== 'choice') {
      out.push({ id: 'trueRecall', xp: BONUS.trueRecall });
    }
  }

  // Recovered a skill that had decayed badly since last practice.
  if (masteryBefore < 0.5 && priorOnSkill > 3) {
    out.push({ id: 'recovered', xp: BONUS.recovered });
  }

  // Applied a method immediately after being taught it — the completion-problem
  // effect, and the thing that turns "I watched" into "I can".
  if (scaffolded) out.push({ id: 'transferAfterTeaching', xp: BONUS.transferAfterTeaching });

  // A due spaced review completed on a secure skill.
  if (wasDue && masteryBefore >= MASTERED_THRESHOLD) {
    out.push({ id: 'retention', xp: BONUS.retention });
  }

  // A named misconception absent for the last 10 attempts on this skill.
  const recent = log.filter(a => a.skill === skill).slice(-10);
  if (recent.length >= 10) {
    const older = log.filter(a => a.skill === skill).slice(-30, -10);
    const hadOne = older.some(a => a.misconception && a.misconception !== 'legacy-import');
    const clearNow = recent.every(a => !a.misconception || a.misconception === 'legacy-import');
    if (hadOne && clearNow) out.push({ id: 'misconceptionCleared', xp: BONUS.misconceptionCleared });
  }

  return out;
}

/**
 * Award XP for one answered question.
 *
 * Returns 0 for wrong answers by design: the cost of a mistake is already paid,
 * honestly, in the mastery model. Deducting XP as well would double-punish and
 * would teach children to avoid difficulty.
 */
export function awardXp(input: AwardInput): Award {
  const {
    question, skill, correct, masteryBefore, masteryAfter, latencyMs,
    difficulty, cls, scaffolded, priorMissesThisSkill, log, ledger,
    daysAvoided = 0, now = Date.now(),
  } = input;

  const today = dayKey(now);
  const answeredToday = log.filter(a => dayKey(a.answeredAt) === today).length;
  const onSkillToday = log.filter(
    a => a.skill === skill && dayKey(a.answeredAt) === today).length;

  // High-water gate: only mastery above the level already paid for earns.
  const paid = ledger[skill] ?? 0;
  const payable = payableDelta(masteryBefore, masteryAfter, paid);

  const decay =
    sessionDecay(answeredToday)
    * skillSaturation(onSkillToday)
    * repetitionDecay(log, question.questionText);

  const breakdown = computeXp({
    correct,
    masteryBefore,
    // Feed the *payable* delta so oscillation farming pays the floor only.
    masteryAfter: masteryBefore + payable,
    skill,
    difficulty,
    interaction: question.interaction?.kind ?? 'choice',
    structure: structureOf(question, skill),
    latencyMs,
    cls,
    priorMissesThisSkill,
    scaffolded,
    sessionDecay: decay,
  });

  // Returning to a skill the learner had been avoiding is the single most
  // valuable thing on offer, and the multiplier is visible to them.
  const comeback = comebackMultiplier(daysAvoided, masteryBefore);
  const base = Math.round(breakdown.total * comeback * 10) / 10;

  const bonuses = detectBonuses({
    correct, masteryBefore, masteryAfter, skill, log,
    interaction: question.interaction?.kind ?? 'choice', scaffolded,
  });

  const nextLedger = payable > 0
    ? { ...ledger, [skill]: Math.max(paid, masteryAfter) }
    : ledger;

  return {
    xp: base,
    breakdown,
    bonuses,
    ledger: nextLedger,
    total: base + bonuses.reduce((s, b) => s + b.xp, 0),
  };
}
