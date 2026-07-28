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
  /**
   * Globally unique identity for this attempt: `${deviceId}:${counter}`.
   *
   * docs/23 F7. Identity used to be inferred from
   * `${answeredAt}|${skill}|${questionText}|${chosen}`, which collides at
   * millisecond resolution: two genuine attempts at the same question with the
   * same answer are indistinguishable. Measured, merging a device holding one
   * attempt with a device holding two yielded ONE — a real attempt destroyed by
   * sync, silently.
   *
   * An explicit id makes the log a true CRDT: union-by-id is commutative,
   * associative and idempotent, so any number of devices can merge in any
   * order and converge on exactly the set of attempts that actually happened.
   *
   * Optional because rows written by older builds have no id. `ensureIds`
   * backfills them deterministically on load, so the property holds for
   * existing installs too.
   */
  id?: string;
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
  /**
   * How the answer was given.
   *
   * Absent means multiple choice, which keeps every pre-existing stored row
   * valid. The distinction matters for the anti-inflation guard (M4): tapping
   * one of four tiles is recognition and carries a ~25% guess probability,
   * whereas typing, selecting a set or building a sequence is recall.
   */
  interaction?: 'choice' | 'entry' | 'multiSelect' | 'ordering' | 'estimate';
  /**
   * True when the learner reached this answer with a scaffold on screen
   * (hint or worked example). Such attempts contribute reduced weight to
   * mastery, so support never inflates the estimate.
   */
  scaffolded?: boolean;
  cls: SchoolClass;
  category: Category;
  difficulty: Difficulty;
}

/**
 * Cap on retained FULL-FIDELITY attempts.
 *
 * docs/23 S5. At 4,000 rows and ~20 questions/day this was a 200-day rolling
 * window, which is short for a product measured in school years: five years of
 * daily use generated 36,500 attempts and retained 11% of them, so any
 * "lifetime" statistic was silently computed over the last 200 days.
 *
 * Raised to 12,000 — roughly 20 months at 20/day, still ~3 MB of JSON at the
 * cap and well within what a mid-range device parses comfortably. Beyond that,
 * `DailySummary` preserves the facts lifetime statistics actually need (see
 * below), so eviction no longer erases a child's history, only its detail.
 */
export const MAX_ATTEMPTS = 12_000;

// ─── Lifetime summary ────────────────────────────────────────────────────────

/**
 * One row per practice day, retained forever.
 *
 * The attempt log is capped, but a handful of numbers per day is not: ten years
 * of daily practice is ~3,650 rows of five fields, a few hundred KB. This is
 * what keeps "practise on 90 different days" honest for a learner in their
 * third year, and what stops a five-year veteran's lifetime totals resetting.
 *
 * Deliberately minimal. It is NOT a second source of truth for anything the
 * log can answer — mastery, misconceptions and scheduling all still read the
 * log, and this is only consulted for facts that are inherently cumulative.
 */
export interface DailySummary {
  /** Local YYYY-MM-DD. */
  day: string;
  attempted: number;
  correct: number;
  /** Attempts that were genuine (not timed out, not sub-second taps). */
  genuine: number;
  /** Distinct skills touched that day. */
  skills: number;
}

/** Fold a set of attempts into per-day summary rows. */
export function summariseByDay(log: Attempt[]): DailySummary[] {
  const byDay = new Map<string, { attempted: number; correct: number; genuine: number; skills: Set<string> }>();
  for (const a of log) {
    const k = dayKey(a.answeredAt);
    let e = byDay.get(k);
    if (!e) { e = { attempted: 0, correct: 0, genuine: 0, skills: new Set() }; byDay.set(k, e); }
    e.attempted++;
    if (a.correct) e.correct++;
    if (!a.timedOut && !(a.latencyMs > 0 && a.latencyMs < GUESS_LATENCY_MS)) e.genuine++;
    e.skills.add(a.skill);
  }
  return [...byDay.entries()]
    .map(([day, e]) => ({ day, attempted: e.attempted, correct: e.correct, genuine: e.genuine, skills: e.skills.size }))
    .sort((x, y) => x.day.localeCompare(y.day));
}

/**
 * Merge new summary rows into an existing set.
 *
 * Rows for days still present in the live log are RECOMPUTED rather than added,
 * so folding the same day in twice cannot double-count. That makes this
 * idempotent, which matters because it runs on every load.
 */
export function mergeSummaries(existing: DailySummary[], incoming: DailySummary[]): DailySummary[] {
  const byDay = new Map(existing.map(r => [r.day, r]));
  for (const r of incoming) {
    const prev = byDay.get(r.day);
    // Keep whichever row saw more of that day: the live log is authoritative
    // while it still holds the day, and the archive wins once it no longer does.
    byDay.set(r.day, !prev || r.attempted >= prev.attempted ? r : prev);
  }
  return [...byDay.values()].sort((x, y) => x.day.localeCompare(y.day));
}

/** Lifetime practice days, from the archive plus whatever the log still holds. */
export function lifetimePracticeDays(summary: DailySummary[], log: Attempt[]): number {
  const days = new Set(summary.filter(r => r.genuine >= 5).map(r => r.day));
  for (const d of meaningfulPracticeDays(log)) days.add(d);
  return days.size;
}

/** Append attempts, evicting oldest rows beyond the cap. */
export function appendAttempts(log: Attempt[], incoming: Attempt[]): Attempt[] {
  if (incoming.length === 0) return log;
  const next = [...log, ...incoming];
  // docs/23 S7. Keep the log chronological on APPEND, not only on merge. A
  // backwards clock change (manual edit, NTP correction after a flat battery,
  // travel) otherwise inserts an out-of-order row that every downstream
  // window function then reads wrongly — `estimateFromRelevant` sorts
  // defensively, but streaks, `isDue` and the recency window did not.
  // Only sorts when the tail is actually out of order, so the common path
  // stays O(n) rather than O(n log n).
  for (let i = next.length - incoming.length; i < next.length; i++) {
    if (i > 0 && next[i].answeredAt < next[i - 1].answeredAt) {
      next.sort((p, q) => p.answeredAt - q.answeredAt);
      break;
    }
  }
  return next.length > MAX_ATTEMPTS ? next.slice(next.length - MAX_ATTEMPTS) : next;
}

// ─── Attempt identity ────────────────────────────────────────────────────────

/**
 * Monotonic per-device counter, persisted alongside the log.
 *
 * Combined with the device id this yields an identifier that is unique across
 * devices without coordination — the property a CRDT needs. The counter is
 * seeded from the existing log on load so it never repeats after a restart.
 */
let idCounter = 0;

/** Seed the counter above whatever the stored log already used. */
export function seedAttemptIds(log: Attempt[]): void {
  for (const a of log) {
    const n = Number(a.id?.split(':')[1]);
    if (Number.isFinite(n) && n >= idCounter) idCounter = n + 1;
  }
}

export function nextAttemptId(deviceId: string): string {
  return `${deviceId}:${idCounter++}`;
}

/**
 * Backfill ids on rows written before ids existed.
 *
 * Deterministic on purpose: the same legacy row must receive the same id on
 * every device that holds it, or a merge would treat one attempt as two. The
 * legacy identity tuple is the only information available, so it is reused —
 * which reintroduces the collision for pre-existing rows ONLY, and cannot
 * affect anything recorded from now on.
 */
export function ensureIds(log: Attempt[]): Attempt[] {
  let changed = false;
  const out = log.map(a => {
    if (a.id) return a;
    changed = true;
    return { ...a, id: `legacy:${a.answeredAt}|${a.skill}|${a.questionText}|${a.chosen}` };
  });
  return changed ? out : log;
}

/**
 * Merge two logs from different devices.
 *
 * Attempts are immutable facts, so union-by-identity is correct and
 * commutative — unlike the legacy `Math.max` merge on counters, which lost
 * counts and could produce accuracy above 100%.
 *
 * docs/23 F7. Identity is now the explicit `id`, not a tuple of field values.
 * The tuple collided at millisecond resolution and silently destroyed genuine
 * attempts on cross-device merge. Union-by-id is a proper set union: idempotent
 * (merging the same log twice is a no-op), commutative and associative, so
 * devices converge regardless of sync order.
 */
export function mergeAttempts(a: Attempt[], b: Attempt[]): Attempt[] {
  const withIds = (xs: Attempt[]) => ensureIds(xs);
  const left = withIds(a);
  const right = withIds(b);

  const seen = new Set(left.map(x => x.id!));
  const merged = [...left];
  for (const x of right) {
    if (!seen.has(x.id!)) {
      seen.add(x.id!);
      merged.push(x);
    }
  }
  merged.sort((p, q) => p.answeredAt - q.answeredAt);
  return merged.length > MAX_ATTEMPTS ? merged.slice(merged.length - MAX_ATTEMPTS) : merged;
}

/** Runtime guard — storage and network payloads are untrusted. */
/**
 * Earliest plausible attempt timestamp: 2020-01-01.
 * Anything older is a corrupt or default-initialised value, not history.
 */
export const MIN_PLAUSIBLE_TS = Date.UTC(2020, 0, 1);

/** Tolerance for benign clock skew before a timestamp is treated as future. */
export const FUTURE_TOLERANCE_MS = 60 * 60 * 1000;   // 1 hour

/**
 * Latest structurally plausible timestamp: 2100-01-01.
 *
 * Distinct from the FUTURE clamp, which is relative to `now` and repairs benign
 * clock skew. This is an absolute sanity bound catching values that are not
 * timestamps at all — `8.64e15` (the year 275760) is the classic result of a
 * corrupted numeric field, and it would sort to the end of the log forever.
 */
export const MAX_PLAUSIBLE_TS = Date.UTC(2100, 0, 1);

export function isValidAttempt(x: unknown): x is Attempt {
  if (!x || typeof x !== 'object') return false;
  const a = x as Partial<Attempt>;
  return (
    typeof a.skill === 'string' &&
    // docs/23 F10. An empty skill id passed every check and then silently
    // failed to resolve anywhere downstream.
    a.skill.length > 0 &&
    typeof a.correct === 'boolean' &&
    typeof a.answeredAt === 'number' &&
    Number.isFinite(a.answeredAt) &&
    // A timestamp of 0, or of the year 275760, is corruption rather than data.
    a.answeredAt >= MIN_PLAUSIBLE_TS &&
    a.answeredAt <= MAX_PLAUSIBLE_TS &&
    typeof a.latencyMs === 'number' &&
    Number.isFinite(a.latencyMs) &&
    // Negative latency is impossible and would invert the guess detector.
    a.latencyMs >= 0 &&
    typeof a.chosen === 'string' &&
    typeof a.expected === 'string' &&
    typeof a.questionText === 'string'
  );
}

/**
 * Validate, repair and order a stored log.
 *
 * docs/23 F10/S7. Three repairs, all of which prefer keeping the learner's
 * history over discarding it:
 *
 *  · rows failing the structural check are dropped (they carry no usable fact)
 *  · FUTURE-dated rows are clamped to `now` rather than dropped — a clock skew
 *    is not the child's fault and the attempt really did happen. Left
 *    unclamped, `daysSince` goes negative and the row sits at the head of the
 *    log forever, poisoning every streak and spaced-review computation.
 *  · the result is sorted, so callers can rely on chronological order
 */
export function sanitiseLog(raw: unknown, now: number = Date.now()): Attempt[] {
  if (!Array.isArray(raw)) return [];
  const ceiling = now + FUTURE_TOLERANCE_MS;
  const rows = raw.filter(isValidAttempt).map(a =>
    a.answeredAt > ceiling ? { ...a, answeredAt: now } : a,
  );
  rows.sort((p, q) => p.answeredAt - q.answeredAt);
  return rows;
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
 * Minimum genuine attempts for a day to count as PRACTICE rather than presence.
 *
 * docs/21. `practiceDays` counts any day containing a single tap, so every
 * consistency achievement built on it measured attendance, not practice — a
 * simulated learner who answered at random for a year earned `fortnight` and
 * `season` in full. Those are the "answer 100 questions" archetype the
 * achievements module explicitly sets out to avoid, arrived at from the other
 * direction.
 *
 * Deliberately low. A child who is ill, busy or simply having a short day
 * should still be credited; the bar exists to exclude a day that contained no
 * real work at all, not to demand a session of a particular size.
 */
export const MEANINGFUL_DAY_ATTEMPTS = 5;

/** A tap faster than this cannot be a computed answer. */
const GUESS_LATENCY_MS = 1200;

/**
 * Distinct days containing GENUINE practice, most recent first.
 *
 * A day qualifies on a small number of real attempts — answers that were not
 * timed out and were not sub-second taps. Correctness is deliberately NOT
 * required: a child who tried hard and got everything wrong has practised, and
 * saying otherwise would punish exactly the learner who most needs credit.
 */
export function meaningfulPracticeDays(log: Attempt[]): string[] {
  const byDay = new Map<string, number>();
  for (const a of log) {
    if (a.timedOut) continue;
    if (a.latencyMs > 0 && a.latencyMs < GUESS_LATENCY_MS) continue;
    const k = dayKey(a.answeredAt);
    byDay.set(k, (byDay.get(k) ?? 0) + 1);
  }
  return [...byDay.entries()]
    .filter(([, n]) => n >= MEANINGFUL_DAY_ATTEMPTS)
    .map(([k]) => k)
    .sort()
    .reverse();
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
