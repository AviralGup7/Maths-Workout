/**
 * Server-side progress store — docs/27 P6-01.
 *
 * The client has had `fetchProgress`/`pushProgress` since docs/23, and docs/24
 * fixed the attempt log so the payload finally carries the only authoritative
 * data. But **no endpoint has ever existed in this repository**, so the restore
 * path — the thing that decides whether a child who replaces their phone keeps
 * months of history — has never once been executed end to end. docs/27 called
 * it the only correctness risk on the backlog, and it was right: every other
 * open item is an improvement, this one is a data-loss question.
 *
 * ── Design constraints, and why they are unusual ────────────────────────────
 *
 * This is deliberately NOT a database. The client treats AsyncStorage as the
 * source of truth and the server purely as a durability target for reinstalls
 * and second devices, so the server's job is narrow:
 *
 *   · never lose an attempt that was successfully uploaded
 *   · never return something the client would merge INCORRECTLY
 *   · never become the reason a child cannot practise (all errors are the
 *     client's to swallow; the app works fully offline by design)
 *
 * ── Why the server merges rather than overwrites ────────────────────────────
 *
 * A naive `PUT` that replaces the stored blob loses data in a case that will
 * certainly happen: two devices, both offline for a while, both syncing. The
 * second push would erase the first device's attempts. Attempts are immutable
 * facts with stable ids, so union-by-id is both correct and commutative — the
 * same property the client relies on in `mergeAttempts`. The server applies the
 * same rule so that push order cannot matter.
 *
 * Zero dependencies, matching serve.js.
 */

const fs = require('fs');
const path = require('path');

/** Where the JSON files live. Overridable so tests never touch real data. */
const DATA_ROOT = process.env.PROGRESS_DATA_DIR
  || path.resolve(__dirname, '..', '.progress-data');

/**
 * Cap on stored attempts per device.
 *
 * Matches the client's own 4,000-row cap (docs/23 S5) so the two cannot
 * disagree about what "full" means. Oldest rows are dropped first; the client
 * keeps lifetime aggregates in `dailySummary` separately, so this costs detail
 * rather than history.
 */
const MAX_ATTEMPTS = 4000;

/** Reject absurd payloads before parsing cost is incurred. */
const MAX_BODY_BYTES = 8 * 1024 * 1024;

/**
 * Device ids come from the URL and become a filename, so they are the one
 * genuine attack surface here. A strict allowlist is safer than escaping:
 * the client generates UUID v4, so anything else is either a bug or hostile.
 */
function isValidDeviceId(id) {
  return typeof id === 'string'
    && id.length >= 8
    && id.length <= 64
    && /^[A-Za-z0-9_-]+$/.test(id);
}

function fileFor(deviceId) {
  return path.join(DATA_ROOT, `${deviceId}.json`);
}

const EMPTY = {
  highScores: {},
  progressStats: {},
  tablesBest: {},
  wrongAnswers: [],
  attempts: [],
};

function readStored(deviceId) {
  try {
    const raw = fs.readFileSync(fileFor(deviceId), 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    // Missing file is the normal first-sync case, not an error.
    return null;
  }
}

/**
 * Write atomically.
 *
 * A half-written JSON file is worse than no file: the client would parse-fail
 * and silently restore nothing, which is exactly the failure mode this whole
 * item exists to remove. Write to a temp file in the same directory, then
 * rename — rename is atomic on POSIX within a filesystem.
 */
function writeStored(deviceId, data) {
  fs.mkdirSync(DATA_ROOT, { recursive: true });
  const target = fileFor(deviceId);
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data), 'utf-8');
  fs.renameSync(tmp, target);
}

/** Highest value wins — high scores only ever go up. */
function mergeMaxMap(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    out[k] = Math.max(out[k] ?? 0, v);
  }
  return out;
}

/** Counters: take the larger of each field, never the sum. */
function mergeStats(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (!v || typeof v !== 'object') continue;
    const prev = out[k] ?? { attempted: 0, correct: 0 };
    out[k] = {
      attempted: Math.max(prev.attempted ?? 0, v.attempted ?? 0),
      correct: Math.max(prev.correct ?? 0, v.correct ?? 0),
    };
  }
  return out;
}

/**
 * Union attempts by id, newest kept, capped.
 *
 * Rows without an id are kept but cannot be deduplicated — the client has
 * backfilled ids since docs/24, so this only affects very old payloads.
 */
function mergeAttempts(a = [], b = []) {
  const seen = new Set();
  const out = [];
  for (const row of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
    if (!row || typeof row !== 'object') continue;
    const id = row.id;
    if (typeof id === 'string' && id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    out.push(row);
  }
  out.sort((x, y) => (x.answeredAt ?? 0) - (y.answeredAt ?? 0));
  return out.length > MAX_ATTEMPTS ? out.slice(out.length - MAX_ATTEMPTS) : out;
}

/** Deduplicate saved mistakes on their visible content. */
function mergeMistakes(a = [], b = []) {
  const seen = new Set();
  const out = [];
  for (const m of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
    if (!m || typeof m !== 'object') continue;
    const key = `${m.display}|${m.userAnswer}|${m.correctAnswer}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

/**
 * Merge an incoming payload into whatever is stored.
 *
 * Pure and exported so the guard test can assert commutativity directly
 * rather than inferring it from HTTP behaviour.
 */
function mergePayload(stored, incoming) {
  const s = stored ?? EMPTY;
  const i = incoming ?? EMPTY;
  return {
    highScores: mergeMaxMap(s.highScores, i.highScores),
    progressStats: mergeStats(s.progressStats, i.progressStats),
    tablesBest: mergeMaxMap(s.tablesBest, i.tablesBest),
    wrongAnswers: mergeMistakes(s.wrongAnswers, i.wrongAnswers),
    attempts: mergeAttempts(s.attempts, i.attempts),
    updatedAt: Date.now(),
  };
}

/** GET handler. Returns null when nothing is stored for this device. */
function getProgress(deviceId) {
  if (!isValidDeviceId(deviceId)) return undefined;
  return readStored(deviceId);
}

/** POST handler. Returns the merged record actually persisted. */
function putProgress(deviceId, incoming) {
  if (!isValidDeviceId(deviceId)) return undefined;
  const merged = mergePayload(readStored(deviceId), incoming);
  writeStored(deviceId, merged);
  return merged;
}

/**
 * Wire the endpoints onto a plain Node request.
 *
 * Returns true when the request was handled, so serve.js can fall through to
 * static files otherwise. Kept as a function rather than a framework route so
 * serve.js keeps its zero-dependency promise.
 */
function handleProgressRequest(req, res, pathname) {
  const match = /^\/api\/progress\/([^/]+)\/?$/.exec(pathname);
  if (!match) return false;

  const deviceId = decodeURIComponent(match[1]);

  const json = (code, body) => {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
  };

  if (!isValidDeviceId(deviceId)) {
    json(400, { error: 'invalid device id' });
    return true;
  }

  if (req.method === 'GET') {
    const stored = getProgress(deviceId);
    // 404 rather than an empty object: the client distinguishes "nothing to
    // restore" from "restored an empty account", and an empty object would
    // make a first sync look like a wipe.
    if (!stored) { json(404, { error: 'not found' }); return true; }
    json(200, stored);
    return true;
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    let size = 0;
    const chunks = [];
    let aborted = false;

    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        aborted = true;
        json(413, { error: 'payload too large' });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (aborted) return;
      try {
        const incoming = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
        const merged = putProgress(deviceId, incoming);
        json(200, { ok: true, attempts: merged.attempts.length });
      } catch {
        json(400, { error: 'invalid json' });
      }
    });

    req.on('error', () => { if (!aborted) json(400, { error: 'request failed' }); });
    return true;
  }

  json(405, { error: 'method not allowed' });
  return true;
}

module.exports = {
  DATA_ROOT,
  MAX_ATTEMPTS,
  isValidDeviceId,
  mergePayload,
  mergeAttempts,
  mergeMaxMap,
  mergeStats,
  mergeMistakes,
  getProgress,
  putProgress,
  handleProgressRequest,
};
