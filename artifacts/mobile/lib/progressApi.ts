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
