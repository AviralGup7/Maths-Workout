// ─── Storage manifest ────────────────────────────────────────────────────────
// docs/19 R1.
//
// The audit found 15 storage keys with exactly one of them versioned. Only the
// attempt log carried a schema version; `xp_ledger`, `total_xp`, the theme and
// timer preferences and the four legacy `v2_*` keys had none. A future change
// to any of their shapes would have had no migration path, and the failure mode
// is silent: `JSON.parse` succeeds, the shape is wrong, and behaviour degrades
// in ways that look like bugs elsewhere.
//
// This module is the single declaration of what is stored, what version each
// key is at, and how to validate it on read. It deliberately does NOT wrap
// AsyncStorage in a repository or ORM — the audit's recommendation was a thin
// typed façade, and anything heavier would be unearned indirection.

import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Every key the app persists.
 *
 * Adding a key here is the only way it should be added at all: a key that is
 * not in this manifest has no version, no validator, and no migration story.
 */
export const KEYS = {
  attempts:      '@maths_workout_v3_attempts',
  /** Write-ahead buffer for the current session — docs/23 F1. */
  pendingAttempts: '@maths_workout_pending_attempts',
  /** Per-day aggregates retained beyond the attempt cap — docs/23 S5. */
  dailySummary:  '@maths_workout_daily_summary',
  /** Set once placement has run or been declined — docs/27 P1-01. */
  placementDone: '@maths_workout_placement_done',
  xpLedger:      '@maths_workout_xp_ledger',
  totalXp:       '@maths_workout_total_xp',
  highScores:    '@maths_workout_v2_high_scores',
  progressStats: '@maths_workout_v2_progress_stats',
  tablesBest:    '@maths_workout_v2_tables_best',
  savedMistakes: '@maths_workout_v2_saved_mistakes',
  board:         '@maths_workout_board',
  lang:          '@maths_workout_lang',
  timerPref:     '@maths_workout_timer_pref',
  theme:         '@maths_workout_theme',
  textScale:     '@maths_workout_text_scale',
  /** Dyslexia-friendly typeface — docs/28 item 53. */
  dyslexicFont:  '@maths_workout_dyslexic_font',
  /** Animation speed multiplier — docs/28 item 60. */
  motionSpeed:   '@maths_workout_motion_speed',
  deviceId:      '@maths_workout_device_id',
  seenWelcome:   '@maths_workout_seen_welcome',
  /** Single manifest version covering every key above. */
  manifest:      '@maths_workout_storage_manifest',
} as const;

export type StorageKey = keyof typeof KEYS;

/**
 * Current shape version, for the store as a whole.
 *
 * One number rather than one per key, deliberately. Per-key versions sound
 * tidier but in practice migrations are cross-cutting — the v2→v3 move rebuilt
 * the attempt log *from* the legacy counters, touching two keys at once. A
 * single monotonic version makes "which migrations still need to run?" a
 * question with one answer.
 *
 * v5 (docs/23): added `pendingAttempts` (crash-safe write-ahead buffer) and
 * `dailySummary` (lifetime aggregates beyond the attempt cap), and every
 * durable value gained a checksummed envelope with a backup slot. Both
 * additions are read-optional, so a v4 install upgrades with no migration.
 *
 * v6 (docs/27 P1-01): added `placementDone`. Absent means "never offered",
 * which is the correct default for every existing install — they already have
 * a history, and `needsPlacement` additionally requires an empty log.
 */
export const MANIFEST_VERSION = 6;

/** Recorded so a future migration knows what it is migrating from. */
export interface Manifest {
  version: number;
  /** Epoch ms of the last successful write. Diagnostic only. */
  updatedAt: number;
}

export async function readManifest(): Promise<Manifest> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.manifest);
    if (raw) {
      const m = JSON.parse(raw) as Manifest;
      if (typeof m?.version === 'number') return m;
    }
    // No manifest: either a fresh install or a pre-manifest build. The legacy
    // per-key version tells the two apart.
    const legacy = await AsyncStorage.getItem('@maths_workout_schema_version');
    return { version: legacy ? Number(legacy) : 0, updatedAt: 0 };
  } catch {
    return { version: 0, updatedAt: 0 };
  }
}

export async function writeManifest(version = MANIFEST_VERSION): Promise<void> {
  try {
    await AsyncStorage.setItem(
      KEYS.manifest,
      JSON.stringify({ version, updatedAt: Date.now() } satisfies Manifest),
    );
  } catch { /* offline-first: in-memory state remains correct */ }
}

// ─── Typed read with validation ──────────────────────────────────────────────

/**
 * Read and validate a JSON value.
 *
 * The validator is the point. Untrusted storage is exactly as dangerous as
 * untrusted network input — it survives app upgrades, it can be corrupted by a
 * partial write, and on some platforms it is user-editable. A value that fails
 * validation is discarded in favour of the fallback rather than propagated.
 */
export async function readJson<T>(
  key: string,
  isValid: (x: unknown) => x is T,
  fallback: T,
): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch { /* offline-first */ }
}

/** Read a number, rejecting NaN, Infinity and negatives. */
export async function readNumber(key: string, fallback: number): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const n = Number(raw);
    return raw !== null && Number.isFinite(n) && n >= 0 ? n : fallback;
  } catch {
    return fallback;
  }
}

/** Read a value constrained to a known set — the shape most preferences take. */
export async function readEnum<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return allowed.includes(raw as T) ? (raw as T) : fallback;
  } catch {
    return fallback;
  }
}

// ─── Validators for the stored shapes ────────────────────────────────────────

export function isXpLedger(x: unknown): x is Record<string, number> {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  return Object.values(x as Record<string, unknown>).every(
    v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1,
  );
}

/**
 * A map of non-negative numbers — high scores, tables bests.
 *
 * docs/23 F10. Previously accepted negatives, so a corrupt or tampered store
 * could yield a negative high score that then won every `Math.max` merge and
 * could never be beaten.
 */
export function isNumberMap(x: unknown): x is Record<string, number> {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  return Object.values(x as Record<string, unknown>).every(
    v => typeof v === 'number' && Number.isFinite(v) && v >= 0,
  );
}

export function isStatMap(
  x: unknown,
): x is Record<string, { attempted: number; correct: number }> {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  return Object.values(x as Record<string, unknown>).every(v => {
    if (!v || typeof v !== 'object') return false;
    const e = v as { attempted?: unknown; correct?: unknown };
    return typeof e.attempted === 'number' && typeof e.correct === 'number'
      && Number.isFinite(e.attempted) && Number.isFinite(e.correct)
      // docs/23 F10. Negative counts passed the old guard, because the ONLY
      // numeric check was `correct <= attempted` and -10 <= -5 holds.
      && e.attempted >= 0 && e.correct >= 0
      // A cell claiming more correct than attempted is corrupt, and would
      // produce accuracy above 100% in every downstream view.
      && e.correct <= e.attempted;
  });
}

export function isWrongAnswerList(
  x: unknown,
): x is { display: string; userAnswer: string; correctAnswer: string }[] {
  return Array.isArray(x) && x.every(m =>
    m && typeof m === 'object'
    && typeof (m as Record<string, unknown>).display === 'string'
    && typeof (m as Record<string, unknown>).correctAnswer === 'string');
}
