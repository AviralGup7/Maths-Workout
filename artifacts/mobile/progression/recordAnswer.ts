// ─── The answer pipeline, as a pure function ─────────────────────────────────
// docs/19 W1.
//
// Lives in `progression/` rather than `learning/` because it composes BOTH:
// it diagnoses and updates mastery (learning) and it prices the answer
// (progression). Progression already sits above learning in the layering, so
// this is the only home that does not create an upward dependency — the
// architecture guard rejected the first placement for exactly that reason.
//
// This is the single most important operation in the product: everything the
// engine knows about a learner is derived from the sequence of calls made here.
// It was previously a ~70-line closure inside `GameContext`, which meant:
//
//   · it could not be tested without React — the only significant piece of
//     domain logic in the system with that property
//   · it read five pieces of component state and wrote four, so ordering bugs
//     were invisible (the XP double-count bug lived exactly here)
//   · reasoning about it required reasoning about React's update semantics
//
// Extracted as `(state, event) -> nextState` it is ordinary code: exhaustively
// testable, trivially simulatable, and free of any framework semantics. The
// context becomes a thin adapter that owns *when* this runs, not *what* it does.
//
// Note there is deliberately no I/O here. The caller decides what to persist
// and when — this function only computes.

import type { Attempt } from '../learning/attempts';
import { appendAttempts, deriveLegacyStats } from '../learning/attempts';
import type { SkillId } from '../learning/skills';
import { resolveSkill } from '../learning/skills';
import { estimateMastery } from '../learning/mastery';
import { diagnose } from '../learning/misconceptions';
import { awardXp, type XpLedger, type Award } from './award';
import type { Question, SchoolClass, Category, Difficulty, ProgressStats } from '../generators/types';

/** Everything the pipeline needs to know before the answer. */
export interface AnswerState {
  log: Attempt[];
  ledger: XpLedger;
  totalXp: number;
}

/** Everything about the answer itself. */
export interface AnswerEvent {
  question: Question;
  chosen: string;
  correct: boolean;
  latencyMs: number;
  timedOut: boolean;
  scaffolded?: boolean;
  /** Skill the scheduler assigned, when it planned this question. */
  plannedSkill?: SkillId | null;
  cls: SchoolClass;
  /** Category selected for the session; the question may resolve a different one. */
  sessionCategory: Category;
  difficulty: Difficulty;
  isTablesMode: boolean;
  /** Injected so the result is deterministic and testable. */
  now?: number;
}

export interface AnswerResult {
  /** New state. Never mutates the input. */
  state: AnswerState;
  /** The row appended. */
  attempt: Attempt;
  /** Diagnosed misconception, or null. */
  misconception: string | null;
  /** XP award. Present even when zero, so callers can show a breakdown. */
  award: Award;
  /** Legacy aggregate view, recomputed. */
  progressStats: ProgressStats;
  /** Mastery before and after, for feedback copy. */
  masteryBefore: number;
  masteryAfter: number;
}

/** Window in which earlier misses still count against the recovery curve. */
const RECENT_MISS_WINDOW_MS = 30 * 60_000;

/**
 * Record one answered question.
 *
 * Pure: same inputs, same outputs, no I/O, no clock unless you pass one.
 */
export function recordAnswer(state: AnswerState, event: AnswerEvent): AnswerResult {
  const {
    question, chosen, correct, latencyMs, timedOut, scaffolded,
    plannedSkill, cls, sessionCategory, difficulty, isTablesMode,
    now = Date.now(),
  } = event;

  const category = question.resolvedCategory ?? sessionCategory;
  const skill = plannedSkill
    ?? resolveSkill(cls, isTablesMode ? 'tables' : category, difficulty);

  // Prefer the distractor map: if this exact wrong option was generated *by* a
  // known misconception, that is a direct observation rather than an inference
  // from the answer's numeric shape.
  const mapped = !correct ? question.distractorMap?.[chosen] : undefined;
  const misconception = mapped ?? (correct ? null : diagnose({
    questionText: question.questionText,
    expected: String(question.answer),
    chosen, skill, latencyMs, timedOut,
  }));

  const attempt: Attempt = {
    skill, correct, answeredAt: now, latencyMs, chosen,
    expected: String(question.answer), questionText: question.questionText,
    timedOut, misconception: misconception ?? undefined,
    // Recorded so the anti-inflation guard can tell recognition from recall.
    interaction: question.interaction?.kind ?? 'choice',
    scaffolded: scaffolded || undefined,
    cls, category, difficulty,
  };

  const nextLog = appendAttempts(state.log, [attempt]);

  // Mastery is read before AND after, because XP is paid for the movement
  // between them rather than for answering. Both are computed from the log, so
  // they cannot disagree with what the rest of the engine believes.
  const masteryBefore = estimateMastery(skill, state.log, now).value;
  const masteryAfter = estimateMastery(skill, nextLog, now).value;

  const priorMisses = state.log.filter(
    a => a.skill === skill && !a.correct && a.answeredAt > now - RECENT_MISS_WINDOW_MS,
  ).length;

  // Days since this skill was last practised, for the comeback multiplier.
  //
  // docs/21 · dead lever. `comebackMultiplier` — the main positive incentive
  // for returning to an avoided skill, worth up to 2x — was reachable only if
  // the caller supplied `daysAvoided`, and `recordAnswer` is the sole caller of
  // `awardXp`. It never did, so the multiplier was pinned at 1.0 and the app's
  // primary answer to avoidance did not exist at runtime. Simulation showed the
  // avoider profile plateauing for want of exactly this.
  //
  // Computed here rather than passed in: the log already knows, and a value
  // derived at the point of use cannot drift from the evidence.
  let lastOnSkill = 0;
  for (let i = state.log.length - 1; i >= 0; i--) {
    if (state.log[i].skill === skill) { lastOnSkill = state.log[i].answeredAt; break; }
  }
  const daysAvoided = lastOnSkill === 0 ? 0 : (now - lastOnSkill) / 86_400_000;

  const award = awardXp({
    question, skill, correct,
    masteryBefore, masteryAfter,
    latencyMs, difficulty, cls,
    scaffolded, priorMissesThisSkill: priorMisses,
    log: state.log, ledger: state.ledger, daysAvoided, now,
  });

  return {
    state: {
      log: nextLog,
      ledger: award.ledger,
      // Wrong answers pay nothing, so this is a no-op for them. Guarding on
      // `> 0` also keeps the total stable when the floor rounds to zero.
      totalXp: award.total > 0 ? state.totalXp + award.total : state.totalXp,
    },
    attempt,
    misconception: misconception ?? null,
    award,
    progressStats: deriveLegacyStats(nextLog),
    masteryBefore,
    masteryAfter,
  };
}
