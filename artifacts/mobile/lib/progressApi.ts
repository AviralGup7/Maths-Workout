/**
 * Thin fetch wrapper for the /api/progress endpoints.
 * All errors are swallowed — AsyncStorage is the source of truth; the
 * server is a sync target for cross-device and cross-reinstall durability.
 */
import type { WrongAnswer } from '../generators';

export type { WrongAnswer };

export interface ProgressData {
  highScores:    Record<string, number>;
  progressStats: Record<string, { attempted: number; correct: number }>;
  tablesBest:    Record<string, number>;
  wrongAnswers:  WrongAnswer[];
  /**
   * The append-only attempt log — the ONLY authoritative learner data.
   *
   * docs/23 F3, the single largest loss vector found in the audit. This field
   * did not exist, so `pushProgress` never uploaded the log, yet `loadAll`
   * read `remote.attempts` behind a cast — making the restore path look
   * implemented when it could never return anything. Measured: a reinstall
   * recovered 0 attempts, 0 skills and mastery index 0, so a learner who
   * replaced their phone lost every month of history and landed on level 1
   * with all chapters locked.
   *
   * Everything else in this payload is derivable from it. Optional so that a
   * client talking to an older server, or vice versa, still works.
   */
  attempts?: unknown[];
}

function apiBase(): string {
  // EXPO_PUBLIC_DOMAIN can be set for hosted deployments; otherwise use the local API.
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}/api` : "/api";
}

export async function fetchProgress(deviceId: string): Promise<ProgressData | null> {
  try {
    const res = await fetch(`${apiBase()}/progress/${encodeURIComponent(deviceId)}`);
    if (!res.ok) return null;
    return (await res.json()) as ProgressData;
  } catch {
    return null;
  }
}

/** Fire-and-forget push — never throws. */
export async function pushProgress(deviceId: string, data: ProgressData): Promise<void> {
  try {
    await fetch(`${apiBase()}/progress/${encodeURIComponent(deviceId)}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
  } catch {
    // Local state is source of truth; silently ignore network errors
  }
}
