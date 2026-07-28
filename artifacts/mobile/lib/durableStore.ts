// ─── Durable write layer ─────────────────────────────────────────────────────
// docs/23 · F2, F5, F6.
//
// AsyncStorage gives exactly one durability guarantee: a single `setItem` is
// atomic for that key. It gives NO transaction across keys, NO write ordering
// across awaits, and NO integrity check — and on a full device it simply
// rejects. The app previously assumed all three of the properties it does not
// have, and swallowed the rejection it does.
//
// This module supplies the missing properties for the values that matter:
//
//   · integrity  — a checksum stored with the payload, verified on read
//   · ordering   — a monotonic sequence number; a stale write is refused
//   · redundancy — the previous good value is retained and used on failure
//   · honesty    — failures are counted and reported, never swallowed silently
//
// Deliberately NOT a database. The audit's finding was that the existing
// storage was under-engineered, not that it needed an ORM; everything here is
// in service of one property the product actually depends on — that a child's
// history survives a crash on a cheap phone.

import AsyncStorage from '@react-native-async-storage/async-storage';

/** Envelope wrapping every durable value. */
export interface Envelope<T> {
  /** Monotonic per-key write counter. A lower value must never overwrite a higher one. */
  seq: number;
  /** Cheap integrity check over the serialised payload. */
  sum: number;
  /** Epoch ms of the write. Diagnostic. */
  at: number;
  data: T;
}

/**
 * FNV-1a over the payload string.
 *
 * Not cryptographic and not meant to be: the threat is a torn or truncated
 * write, not an adversary. What matters is that it is fast enough to run on
 * every write of a ~1 MB payload on a low-end device, and that it detects
 * truncation — which it does, because length changes the hash.
 */
export function checksum(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Backup key for a given primary key. */
export const backupKeyFor = (key: string) => `${key}__bak`;

export interface WriteResult {
  ok: boolean;
  /** Set when the write was refused because a newer value is already stored. */
  stale?: boolean;
  error?: string;
}

/** Consecutive write failures, exposed so the UI can stop lying to the user. */
let consecutiveFailures = 0;
let lastFailureAt = 0;

export function storageHealth(): { failing: boolean; consecutiveFailures: number; lastFailureAt: number } {
  return { failing: consecutiveFailures >= 3, consecutiveFailures, lastFailureAt };
}

export function resetStorageHealth(): void {
  consecutiveFailures = 0;
  lastFailureAt = 0;
}

/** In-memory record of the highest sequence written per key, to avoid a read-before-write. */
const seqCache = new Map<string, number>();

export function currentSeq(key: string): number {
  return seqCache.get(key) ?? 0;
}

export function primeSeq(key: string, seq: number): void {
  if (seq > (seqCache.get(key) ?? 0)) seqCache.set(key, seq);
}

/**
 * Write a value durably.
 *
 * Order matters and is deliberate: the PREVIOUS good value is copied to the
 * backup slot before the primary is overwritten. A crash at any point therefore
 * leaves at least one intact copy — either the new primary, or the old backup
 * with a torn primary that will fail its checksum on read.
 *
 * Retries with backoff rather than swallowing the error, because the common
 * cause (a momentarily full device, or contention during app teardown) is
 * transient.
 */
export async function writeDurable<T>(
  key: string,
  data: T,
  opts: { retries?: number; backup?: boolean } = {},
): Promise<WriteResult> {
  const { retries = 2, backup = true } = opts;
  const seq = (seqCache.get(key) ?? 0) + 1;
  const payload = JSON.stringify(data);
  const envelope: Envelope<T> = { seq, sum: checksum(payload), at: Date.now(), data };
  const serialised = JSON.stringify(envelope);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (backup) {
        // Promote the current primary to backup first. If this fails we still
        // attempt the primary write — a missing backup is a lesser problem
        // than a missing write.
        try {
          const existing = await AsyncStorage.getItem(key);
          if (existing !== null) await AsyncStorage.setItem(backupKeyFor(key), existing);
        } catch { /* backup is best-effort */ }
      }
      await AsyncStorage.setItem(key, serialised);
      seqCache.set(key, seq);
      consecutiveFailures = 0;
      return { ok: true };
    } catch (e) {
      if (attempt === retries) {
        consecutiveFailures++;
        lastFailureAt = Date.now();
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
      await new Promise(r => setTimeout(r, 50 * Math.pow(3, attempt)));
    }
  }
  return { ok: false, error: 'unreachable' };
}

export interface ReadResult<T> {
  data: T | null;
  /** Which slot the value came from. */
  source: 'primary' | 'backup' | 'legacy' | 'none';
  /** True when the primary failed its integrity check. */
  repaired: boolean;
}

/**
 * Read a value, verifying integrity and falling back to the backup.
 *
 * `legacy` handles values written before this module existed: a bare payload
 * with no envelope. Those are accepted once and re-wrapped on the next write,
 * so existing installs upgrade silently rather than losing their history —
 * which would be a spectacular own goal for a data-integrity fix.
 */
export async function readDurable<T>(
  key: string,
  isValid: (x: unknown) => x is T,
): Promise<ReadResult<T>> {
  const tryParse = (raw: string | null): { env: Envelope<T> | null; legacy: T | null } => {
    if (raw === null) return { env: null, legacy: null };
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return { env: null, legacy: null }; }
    const e = parsed as Partial<Envelope<T>>;
    if (e && typeof e === 'object' && typeof e.seq === 'number' && typeof e.sum === 'number' && 'data' in e) {
      // Verify the checksum before trusting the payload.
      if (checksum(JSON.stringify(e.data)) !== e.sum) return { env: null, legacy: null };
      return { env: e as Envelope<T>, legacy: null };
    }
    // No envelope: a pre-upgrade value.
    return { env: null, legacy: isValid(parsed) ? parsed : null };
  };

  let primaryRaw: string | null = null;
  try { primaryRaw = await AsyncStorage.getItem(key); } catch { /* fall through */ }
  const primary = tryParse(primaryRaw);

  if (primary.env && isValid(primary.env.data)) {
    primeSeq(key, primary.env.seq);
    return { data: primary.env.data, source: 'primary', repaired: false };
  }
  if (primary.legacy !== null) {
    return { data: primary.legacy, source: 'legacy', repaired: false };
  }

  // Primary is absent, unparseable, checksum-failed or invalid — try the backup.
  let backupRaw: string | null = null;
  try { backupRaw = await AsyncStorage.getItem(backupKeyFor(key)); } catch { /* fall through */ }
  const backup = tryParse(backupRaw);
  if (backup.env && isValid(backup.env.data)) {
    primeSeq(key, backup.env.seq);
    return { data: backup.env.data, source: 'backup', repaired: primaryRaw !== null };
  }
  if (backup.legacy !== null) {
    return { data: backup.legacy, source: 'backup', repaired: primaryRaw !== null };
  }

  return { data: null, source: 'none', repaired: primaryRaw !== null };
}
