import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ProgressData } from '../progressApi';
import { mergeAttempts, sanitiseLog, ensureIds } from '../../learning/attempts';
import type { Attempt } from '../../learning/attempts';

/**
 * Client/server contract — docs/27 P6-01.
 *
 * docs/23 F3 was not a bug in either half. Both halves were individually
 * correct: the client read `remote.attempts`, the server (had there been one)
 * would have stored what it was given. The failure was in the CONTRACT — the
 * client uploaded a payload that did not contain the field the client itself
 * later read back.
 *
 * A test of the client alone cannot catch that, and neither can a test of the
 * server alone. This one holds both against each other: the real client
 * payload type on one side, the real server merge on the other.
 */

const require = createRequire(import.meta.url);

function freshStore() {
  const dir = mkdtempSync(join(tmpdir(), 'sync-contract-'));
  process.env.PROGRESS_DATA_DIR = dir;
  // Re-require so DATA_ROOT is re-resolved against the scratch directory.
  const path = require.resolve('../../server/progressStore.js');
  delete require.cache[path];
  const store = require('../../server/progressStore.js');
  return { store, dir };
}

const row = (over: Partial<Attempt> = {}): Attempt => ({
  id: `x${Math.random().toString(36).slice(2)}`,
  skill: 'add.within20', correct: true, answeredAt: Date.now(),
  latencyMs: 4000, chosen: '7', expected: '7', questionText: '3 + 4 = ?',
  timedOut: false, cls: '2nd', category: 'addition', difficulty: 'easy',
  ...over,
});

describe('sync contract', () => {
  it('the server preserves every field the client uploads', () => {
    // Built from the client's own ProgressData type. If a field is added to
    // the payload and the server does not carry it, this fails at compile
    // time on the annotation and at runtime on the assertion.
    const { store, dir } = freshStore();
    try {
      const payload: ProgressData = {
        highScores: { '2nd_addition_easy': 9 },
        progressStats: { '2nd_addition_easy': { attempted: 10, correct: 9 } },
        tablesBest: { 5: 12 },
        wrongAnswers: [{ display: '2+2', userAnswer: '5', correctAnswer: '4' }],
        attempts: [row(), row()],
      };
      store.putProgress('device-contract-1', payload);
      const back = store.getProgress('device-contract-1');

      for (const key of Object.keys(payload) as (keyof ProgressData)[]) {
        expect(back[key], `server dropped ${key}`).toBeDefined();
      }
      expect(back.attempts).toHaveLength(2);
      expect(back.highScores['2nd_addition_easy']).toBe(9);
      expect(back.wrongAnswers).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reproduces docs/23 F3 if the log is ever dropped again', () => {
    // The original defect, stated as a property: a payload WITHOUT attempts
    // restores nothing useful, which is exactly what a reinstall measured.
    const { store, dir } = freshStore();
    try {
      store.putProgress('device-f3', {
        highScores: { '2nd_addition_easy': 9 },
        progressStats: {},
        tablesBest: {},
        wrongAnswers: [],
        // attempts deliberately absent — the pre-docs/24 client payload
      });
      const back = store.getProgress('device-f3');
      expect(back.attempts).toEqual([]);
      // ...and with attempts present, the same device restores its history.
      store.putProgress('device-f3', {
        highScores: {}, progressStats: {}, tablesBest: {}, wrongAnswers: [],
        attempts: [row(), row(), row()],
      });
      expect(store.getProgress('device-f3').attempts).toHaveLength(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('server and client merge attempts to the same set', () => {
    // Both sides deduplicate by id. If the two rules ever diverge, a sync
    // round trip would change the log's length, which the client would then
    // treat as new evidence and re-derive mastery from.
    const { store, dir } = freshStore();
    try {
      const a = [row({ id: 'p1' }), row({ id: 'p2' })];
      const b = [row({ id: 'p2' }), row({ id: 'p3' })];

      const serverMerged = store.mergePayload(
        { attempts: a }, { attempts: b },
      ).attempts.map((r: Attempt) => r.id).sort();

      const clientMerged = ensureIds(mergeAttempts(a, sanitiseLog(b)))
        .map(r => r.id).sort();

      expect(serverMerged).toEqual(clientMerged);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a round trip through the server is idempotent for the client', () => {
    // The client pushes on load AND after every session. If a round trip grew
    // the log, a month of ordinary use would multiply it.
    const { store, dir } = freshStore();
    try {
      const log = [row({ id: 'r1' }), row({ id: 'r2' }), row({ id: 'r3' })];
      const payload: ProgressData = {
        highScores: {}, progressStats: {}, tablesBest: {}, wrongAnswers: [],
        attempts: log,
      };
      for (let i = 0; i < 5; i++) store.putProgress('device-idem', payload);
      const back = store.getProgress('device-idem');
      expect(back.attempts).toHaveLength(3);

      // And the client merging that back into its own copy is also stable.
      const reMerged = mergeAttempts(log, sanitiseLog(back.attempts));
      expect(reMerged).toHaveLength(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects device ids that are not safe as filenames', () => {
    const { store, dir } = freshStore();
    try {
      for (const bad of ['../../etc/passwd', 'a/b', '', 'x', 'a'.repeat(200), 'has space']) {
        expect(store.isValidDeviceId(bad), `${bad} should be rejected`).toBe(false);
      }
      expect(store.isValidDeviceId('a4711c8e-9458-4e9e-9667-ec239e31db22')).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
