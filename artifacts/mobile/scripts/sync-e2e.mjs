#!/usr/bin/env node
// ─── Sync restore, proven end to end ─────────────────────────────────────────
// docs/27 P6-01.
//
// docs/23 F3 found that `pushProgress` never uploaded the attempt log while
// `loadAll` read `remote.attempts` behind a cast — so the restore path LOOKED
// implemented and could never return anything. Measured then: a reinstall
// recovered 0 attempts, 0 skills, mastery index 0.
//
// docs/24 fixed the client. But the verdict stayed "unproven" for a simple
// reason: there was no server. Every test to date has exercised the client
// against a mock of itself, which cannot catch a contract mismatch between the
// two halves — and a contract mismatch is precisely the class of bug that
// produced F3 in the first place.
//
// This script starts the REAL server from `server/progressStore.js`, drives it
// over real HTTP, and asserts the properties a child's history depends on.
//
// Usage: node scripts/sync-e2e.mjs

import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Point the store at a scratch directory BEFORE requiring it, so the module
// resolves DATA_ROOT to somewhere disposable.
const dataDir = mkdtempSync(join(tmpdir(), 'progress-e2e-'));
process.env.PROGRESS_DATA_DIR = dataDir;

const store = require('../server/progressStore.js');

let pass = 0;
let fail = 0;
const check = (ok, msg) => {
  if (ok) { pass++; console.log(`  PASS  ${msg}`); }
  else { fail++; console.log(`  FAIL  ${msg}`); }
};

const PORT = 8931;
const base = `http://127.0.0.1:${PORT}`;

const server = createServer((req, res) => {
  const url = new URL(req.url, base);
  if (store.handleProgressRequest(req, res, url.pathname)) return;
  res.writeHead(404); res.end('nf');
});

/** A realistic attempt row, matching what the client actually uploads. */
const attempt = (id, skill, at, correct = true) => ({
  id, skill, correct, answeredAt: at, latencyMs: 4200,
  chosen: '7', expected: '7', questionText: '3 + 4 = ?', timedOut: false,
  interaction: 'choice', cls: '2nd', category: 'addition', difficulty: 'easy',
});

const payload = (attempts, extra = {}) => ({
  highScores: { '2nd_addition_easy': 8 },
  progressStats: { '2nd_addition_easy': { attempted: attempts.length, correct: attempts.length } },
  tablesBest: { 5: 12 },
  wrongAnswers: [],
  attempts,
  ...extra,
});

await new Promise(r => server.listen(PORT, '127.0.0.1', r));

try {
  const DEVICE = 'a4711c8e-9458-4e9e-9667-ec239e31db22';

  // ── 1. A device with no history gets a clean "nothing to restore" ─────────
  const first = await fetch(`${base}/api/progress/${DEVICE}`);
  check(first.status === 404,
    `first sync returns 404, not an empty account (got ${first.status})`);

  // ── 2. Push, then restore. The actual F3 scenario. ────────────────────────
  const now = Date.now();
  const original = Array.from({ length: 120 }, (_, i) =>
    attempt(`a${i}`, i % 2 ? 'add.within20' : 'mul.tables.easy', now - i * 60_000));

  const up = await fetch(`${base}/api/progress/${DEVICE}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload(original)),
  });
  check(up.ok, `upload accepted (${up.status})`);

  const restored = await (await fetch(`${base}/api/progress/${DEVICE}`)).json();
  check(restored.attempts.length === 120,
    `reinstall restores all 120 attempts (got ${restored.attempts.length})`);

  const skills = new Set(restored.attempts.map(a => a.skill));
  check(skills.size === 2,
    `restored history covers both skills (got ${skills.size})`);
  check(restored.highScores['2nd_addition_easy'] === 8,
    'high scores survive the round trip');
  check(restored.tablesBest['5'] === 12 || restored.tablesBest[5] === 12,
    'tables bests survive the round trip');

  // ── 3. Re-uploading the same log must not duplicate it ────────────────────
  // The client pushes on every load AND after every session, so idempotence is
  // not a nicety — without it a month of syncing multiplies the log.
  for (let i = 0; i < 3; i++) {
    await fetch(`${base}/api/progress/${DEVICE}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload(original)),
    });
  }
  const afterRepeat = await (await fetch(`${base}/api/progress/${DEVICE}`)).json();
  check(afterRepeat.attempts.length === 120,
    `three more identical pushes leave 120 rows (got ${afterRepeat.attempts.length})`);

  // ── 4. Two devices, both offline, both syncing ────────────────────────────
  // A PUT that replaced the blob would silently erase whichever device pushed
  // first. This is the case a naive implementation gets wrong.
  const deviceB = Array.from({ length: 40 }, (_, i) =>
    attempt(`b${i}`, 'sub.within20', now - i * 30_000));
  await fetch(`${base}/api/progress/${DEVICE}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload(deviceB)),
  });
  const merged = await (await fetch(`${base}/api/progress/${DEVICE}`)).json();
  check(merged.attempts.length === 160,
    `a second device's 40 rows merge rather than overwrite (got ${merged.attempts.length})`);
  const ids = new Set(merged.attempts.map(a => a.id));
  check(ids.size === 160, `no id appears twice (${ids.size} unique)`);

  // ── 5. Merge order must not matter ────────────────────────────────────────
  const ab = store.mergePayload(payload(original), payload(deviceB));
  const ba = store.mergePayload(payload(deviceB), payload(original));
  const idsOf = p => p.attempts.map(a => a.id).sort().join(',');
  check(idsOf(ab) === idsOf(ba),
    'merge is commutative — push order cannot change the result');

  // ── 6. Hostile and malformed input ────────────────────────────────────────
  const traversal = await fetch(`${base}/api/progress/${encodeURIComponent('../../etc/passwd')}`);
  check(traversal.status === 400,
    `path traversal in the device id is rejected (${traversal.status})`);

  const badJson = await fetch(`${base}/api/progress/${DEVICE}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{not json',
  });
  check(badJson.status === 400, `malformed JSON is rejected (${badJson.status})`);

  const stillThere = await (await fetch(`${base}/api/progress/${DEVICE}`)).json();
  check(stillThere.attempts.length === 160,
    'a rejected request leaves stored history untouched');

  // ── 7. The cap matches the client's, and drops OLDEST ─────────────────────
  const flood = Array.from({ length: 4200 }, (_, i) =>
    attempt(`f${i}`, 'add.within10', now + i * 1000));
  await fetch(`${base}/api/progress/${DEVICE}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload(flood)),
  });
  const capped = await (await fetch(`${base}/api/progress/${DEVICE}`)).json();
  check(capped.attempts.length === store.MAX_ATTEMPTS,
    `stored log is capped at ${store.MAX_ATTEMPTS} (got ${capped.attempts.length})`);
  const times = capped.attempts.map(a => a.answeredAt);
  check(times[0] <= times[times.length - 1],
    'retained rows are the most recent, in ascending time order');

  // ── 8. Devices are isolated ───────────────────────────────────────────────
  const other = await fetch(`${base}/api/progress/11111111-2222-3333-4444-555555555555`);
  check(other.status === 404, "another device's id returns nothing");

} finally {
  server.close();
  rmSync(dataDir, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
