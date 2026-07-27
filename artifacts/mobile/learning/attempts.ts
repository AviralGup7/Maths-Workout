// ─── Attempt log ─────────────────────────────────────────────────────────────
// The foundational data-model change.
//
// The legacy model recorded aggregates only: `{ attempted, correct }`. That is
// lossy and irreversible — you can always derive counters from a log, but you
// can never recover a log from counters.
//
// This module records one immutable row per answered question, capturing the
// three fields the old model discarded:
//   · answeredAt  → streaks, spaced repetition, decay, trends
//   · latencyMs   → fluency, and detecting guesses
//   · chosen      → misconception diagnosis (Direction D)
//
// The log is the single source of truth. Mastery estimates, statistics and
// dashboards are all *derived*, never stored, so they can be recomputed after
// any change to the estimation logic.

import type { SkillId } from './skills';
import type { Category, Difficulty, SchoolClass } from '../generators/types';

export interface Attempt {
  /** Skill exercised — resolved via `resolveSkill`, never the raw category. */
  skill: SkillId;
  correct: boolean;
  /** Epoch ms. */
  answeredAt: number;
  /** Milliseconds from question shown to answer submitted. */
  latencyMs: number;
  /** What the learner actually chose. Empty string when the question timed out. */
  chosen: string;
  /** The correct answer, so diagnosis needs no back-reference to the question. */
  expected: string;
  /** Verbatim question text — required to replay and diagnose the error. */
  questionText: string;
  /** True when the learner ran out of time rather than answering. */
  timedOut: boolean;
  /** Detected misconception id, if any (Direction D). */
  misconception?: string;
  cls: SchoolClass;
  category: Category;
  difficulty: Difficulty;
}

/**
 * Cap on retained attempts.
 *
 * At ~50 questions/day this is roughly eight months of history — far more than
 * the 21-day decay half-life needs, while bounding storage and JSON parse cost.
 * Oldest rows are evicted first.
 */
export const MAX_ATTEMPTS = 4000;

/** Append attempts, evicting oldest rows beyond the cap. */
export function appendAttempts(log: Attempt[], incoming: Attempt[]): Attempt[] {
  if (incoming.length === 0) return log;
  const next = [...log, ...incoming];
  return next.length > MAX_ATTEMPTS ? next.slice(next.length - MAX_ATTEMPTS) : next;
}

/**
 * Merge two logs from different devices.
 *
 * Attempts are immutable facts, so union-by-identity is correct and
 * commutative — unlike the legacy `Math.max` merge on counters, which lost
 * counts and could produce accuracy above 100%.
 */
export function mergeAttempts(a: Attempt[], b: Attempt[]): Attempt[] {
  const key = (x: Attempt) => `${x.answeredAt}|${x.skill}|${x.questionText}|${x.chosen}`;
  const seen = new Set(a.map(key));
  const merged = [...a];
  for (const x of b) {
    if (!seen.has(key(x))) {
      seen.add(key(x));
      merged.push(x);
    }
  }
  merged.sort((p, q) => p.answeredAt - q.answeredAt);
  return merged.length > MAX_ATTEMPTS ? merged.slice(merged.length - MAX_ATTEMPTS) : merged;
}

/** Runtime guard — storage and network payloads are untrusted. */
export function isValidAttempt(x: unknown): x is Attempt {
  if (!x || typeof x !== 'object') return false;
  const a = x as Partial<Attempt>;
  return (
    typeof a.skill === 'string' &&
    typeof a.correct === 'boolean' &&
    typeof a.answeredAt === 'number' &&
    Number.isFinite(a.answeredAt) &&
    typeof a.latencyMs === 'number' &&
    Number.isFinite(a.latencyMs) &&
    typeof a.chosen === 'string' &&
    typeof a.expected === 'string' &&
    typeof a.questionText === 'string'
  );
}

export function sanitiseLog(raw: unknown): Attempt[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isValidAttempt);
}

// ─── Derived views ───────────────────────────────────────────────────────────
// Everything below is computed on demand. Nothing here is persisted.

/** Local YYYY-MM-DD key. Local, not UTC, so "today" matches the learner's day. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Distinct days practised, most recent first. */
export function practiceDays(log: Attempt[]): string[] {
  return [...new Set(log.map(a => dayKey(a.answeredAt)))].sort().reverse();
}

/**
 * Current consecutive-day streak, counting back from today.
 * Practising yesterday but not yet today keeps the streak alive.
 */
export function currentStreak(log: Attempt[], now: number = Date.now()): number {
  const days = new Set(practiceDays(log));
  if (days.size === 0) return 0;

  const today = dayKey(now);
  const yesterday = dayKey(now - 86_400_000);
  if (!days.has(today) && !days.has(yesterday)) return 0;

  let streak = 0;
  let cursor = days.has(today) ? now : now - 86_400_000;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor -= 86_400_000;
  }
  return streak;
}

/** Attempts recorded today. */
export function todayCount(log: Attempt[], now: number = Date.now()): number {
  const today = dayKey(now);
  return log.filter(a => dayKey(a.answeredAt) === today).length;
}

/**
 * Backwards-compatible aggregate view.
 *
 * Rebuilds the legacy `${cls}_${cat}_${diff}` → {attempted, correct} shape from
 * the log, so existing screens keep working unchanged while the log becomes the
 * source of truth underneath them.
 */
export function deriveLegacyStats(
  log: Attempt[],
): Record<string, { attempted: number; correct: number }> {
  const out: Record<string, { attempted: number; correct: number }> = {};
  for (const a of log) {
    const key = `${a.cls}_${a.category}_${a.difficulty}`;
    const e = out[key] ?? { attempted: 0, correct: 0 };
    e.attempted += 1;
    if (a.correct) e.correct += 1;
    out[key] = e;
  }
  return out;
}

/**
 * One-time migration from legacy counters.
 *
 * Historic aggregates carry no timestamps, latency or chosen answers, so the
 * detail is genuinely unrecoverable. Rather than discard the learner's history
 * we synthesise placeholder attempts dated well in the past — enough to seed a
 * mastery estimate, while decay ensures they are quickly superseded by real
 * evidence. Synthesised rows are marked so they are never used for diagnosis.
 */
export function migrateLegacyStats(
  stats: Record<string, { attempted: number; correct: number }>,
  now: number = Date.now(),
  resolve?: (cls: SchoolClass, cat: Category, diff: Difficulty) => SkillId,
): Attempt[] {
  const out: Attempt[] = [];
  // Date them 30 days back: real practice outranks them almost immediately.
  const base = now - 30 * 86_400_000;

  for (const [key, entry] of Object.entries(stats)) {
    const parts = key.split('_');
    if (parts.length < 3) continue;
    const cls = parts[0] as SchoolClass;
    const difficulty = parts[parts.length - 1] as Difficulty;
    const category = parts.slice(1, -1).join('_') as Category;

    // Cap synthesis so a large legacy history cannot flood the log.
    const total = Math.min(entry.attempted, 40);
    const correct = Math.round((entry.correct / Math.max(1, entry.attempted)) * total);
    const skill = resolve ? resolve(cls, category, difficulty) : `legacy.${category}`;

    for (let i = 0; i < total; i++) {
      out.push({
        skill,
        correct: i < correct,
        answeredAt: base + i * 1000,
        latencyMs: 0,
        chosen: '',
        expected: '',
        questionText: '',
        timedOut: false,
        misconception: 'legacy-import',
        cls,
        category,
        difficulty,
      });
    }
  }
  return out;
}
