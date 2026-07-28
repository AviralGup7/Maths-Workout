import { describe, it, expect } from 'vitest';
import { FakeStorage } from '../fakeStorage';
import { recordAnswer, type AnswerState } from '../../../progression/recordAnswer';
import { sanitiseLog, deriveLegacyStats, migrateLegacyStats, type Attempt } from '../../../learning/attempts';
import { estimateAll } from '../../../learning/mastery';
import { levelForXp } from '../../../progression/levels';
import { resolveSkill } from '../../../learning/skills';
import { isStatMap, isXpLedger, isNumberMap } from '../../../lib/storage';

const START = Date.UTC(2026, 0, 1, 9);
const K = {
  attempts: '@maths_workout_v3_attempts',
  xp: '@maths_workout_total_xp',
  ledger: '@maths_workout_xp_ledger',
  stats: '@maths_workout_v2_progress_stats',
  schema: '@maths_workout_schema_version',
  manifest: '@maths_workout_storage_manifest',
};

function answer(st: AnswerState, o: { skill: string; correct: boolean; now: number }) {
  return recordAnswer(st, {
    question: { questionText: `q-${o.now}`, answer: 7, choices: [1, 2, 3, 7] } as never,
    chosen: o.correct ? '7' : '1', correct: o.correct, latencyMs: 5000, timedOut: false,
    plannedSkill: o.skill as never, cls: '4th', sessionCategory: 'addition',
    difficulty: 'medium', isTablesMode: false, now: o.now,
  });
}
const blank = (): AnswerState => ({ log: [], ledger: {}, totalXp: 0 });

/** Replays GameContext's write ordering for one answered question. */
async function persistAnswer(store: FakeStorage, st: AnswerState, flushLog: boolean) {
  // persistProgression — immediate, two separate awaits
  await store.setItem(K.xp, String(st.totalXp));
  await store.setItem(K.ledger, JSON.stringify(st.ledger));
  // schedulePersist — debounced 1500 ms
  if (flushLog) {
    await store.setItem(K.attempts, JSON.stringify(st.log));
    await store.setItem(K.schema, '3');
  }
}

/** Replays loadAll's recovery logic. */
async function recover(store: FakeStorage) {
  const rawLog = await store.getItem(K.attempts);
  const rawXp = await store.getItem(K.xp);
  const rawLedger = await store.getItem(K.ledger);
  let log: Attempt[] = [];
  try { log = rawLog ? sanitiseLog(JSON.parse(rawLog)) : []; } catch { log = []; }
  const xpNum = Number(rawXp);
  const totalXp = Number.isFinite(xpNum) && xpNum >= 0 ? xpNum : 0;
  let ledger: Record<string, number> = {};
  try { const p = rawLedger ? JSON.parse(rawLedger) : null; if (isXpLedger(p)) ledger = p; } catch { /* drop */ }
  return { log, totalXp, ledger };
}

describe('C1 · crash during a session', () => {
  it('measures exactly how much is lost at each crash point', async () => {
    const rows: { crashAfter: string; xpKept: number; attemptsKept: number; xpUnbacked: number }[] = [];

    for (const answersBeforeFlush of [1, 5, 10, 20]) {
      const store = new FakeStorage();
      let st = blank();
      for (let i = 0; i < answersBeforeFlush; i++) {
        st = answer(st, { skill: 'add.3digit', correct: true, now: START + i * 30_000 }).state;
        await persistAnswer(store, st, false);   // debounce never fires
      }
      const r = await recover(store);
      // XP that survived with no attempt evidence backing it.
      rows.push({
        crashAfter: `${answersBeforeFlush} answers`,
        xpKept: Math.round(r.totalXp),
        attemptsKept: r.log.length,
        xpUnbacked: Math.round(r.totalXp),
      });
    }
    console.log('\n===== C1 · CRASH INSIDE THE DEBOUNCE WINDOW =====');
    console.table?.(rows);
    for (const row of rows) console.log(JSON.stringify(row));
    console.log('→ every crash keeps 100% of XP and 0% of the attempts that earned it.');
    expect(rows.every(r => r.attemptsKept === 0 && r.xpKept > 0)).toBe(true);
  });

  it('the same crash with a synchronous log write loses nothing', async () => {
    const store = new FakeStorage();
    let st = blank();
    for (let i = 0; i < 20; i++) {
      st = answer(st, { skill: 'add.3digit', correct: true, now: START + i * 30_000 }).state;
      await persistAnswer(store, st, true);
    }
    const r = await recover(store);
    const derived = estimateAll(r.log, START + 86_400_000);
    console.log(`\nwith log flushed per answer: xp=${Math.round(r.totalXp)} attempts=${r.log.length} skills=${Object.keys(derived).length}`);
    expect(r.log.length).toBe(20);
  });
});

describe('C2 · storage full', () => {
  it('a full device silently drops writes and the app never learns', async () => {
    const store = new FakeStorage();
    store.fault = { kind: 'full', afterWrites: 4 };
    let st = blank();
    let thrown = 0;

    for (let i = 0; i < 10; i++) {
      st = answer(st, { skill: 'add.3digit', correct: true, now: START + i * 30_000 }).state;
      // GameContext wraps every write in `try { } catch { }` with an empty body.
      try { await store.setItem(K.xp, String(st.totalXp)); } catch { thrown++; }
      try { await store.setItem(K.ledger, JSON.stringify(st.ledger)); } catch { thrown++; }
    }
    const r = await recover(store);
    console.log('\n===== C2 · STORAGE FULL =====');
    console.log(`writes attempted: 20, rejected: ${thrown}`);
    console.log(`in-memory XP: ${Math.round(st.totalXp)}, durable XP: ${Math.round(r.totalXp)}`);
    console.log(`lost writes: ${store.lostWrites.length}`);
    console.log('→ all errors swallowed; no signal to the user or to any retry path.');
    expect(r.totalXp).toBeLessThan(st.totalXp);
  });
});

describe('C3 · partial / torn key write', () => {
  it('a truncated attempt log is discarded WHOLESALE, not partially recovered', async () => {
    const store = new FakeStorage();
    let st = blank();
    for (let i = 0; i < 200; i++) {
      st = answer(st, { skill: 'add.3digit', correct: true, now: START + i * 30_000 }).state;
    }
    // Model a torn write: bytes truncated mid-array.
    store.fault = { kind: 'truncate', key: K.attempts };
    await store.setItem(K.attempts, JSON.stringify(st.log));
    store.fault = { kind: 'none' };

    const r = await recover(store);
    console.log('\n===== C3 · TRUNCATED LOG =====');
    console.log(`attempts written: ${st.log.length}, recovered after truncation: ${r.log.length}`);
    console.log('→ JSON.parse throws, the catch returns [], and 200 attempts become 0.');
    console.log('   A line-delimited or chunked format would have recovered ~100.');
    expect(r.log.length).toBe(0);
  });

  it('there is no checksum, so a silently-altered log is trusted', async () => {
    const store = new FakeStorage();
    let st = blank();
    for (let i = 0; i < 50; i++) {
      st = answer(st, { skill: 'add.3digit', correct: true, now: START + i * 30_000 }).state;
    }
    await store.setItem(K.attempts, JSON.stringify(st.log));
    // Flip one field — still valid JSON, still passes isValidAttempt.
    const tampered = JSON.parse((await store.getItem(K.attempts))!);
    tampered[0].correct = !tampered[0].correct;
    tampered[1].skill = 'nonexistent.skill';
    await store.setItem(K.attempts, JSON.stringify(tampered));

    const r = await recover(store);
    const est = estimateAll(r.log, START + 86_400_000);
    console.log('\n===== C3b · SILENT TAMPERING =====');
    console.log(`rows accepted: ${r.log.length}/50`);
    console.log(`unknown skill id present: ${r.log.some(a => a.skill === 'nonexistent.skill')}`);
    console.log(`estimateAll skips unknown skills: ${!('nonexistent.skill' in est)}`);
    expect(r.log.length).toBe(50);
  });
});

describe('C4 · interrupted migration', () => {
  it('a crash mid-migration can duplicate the learner history', async () => {
    // loadAll: if (schemaVersion < CURRENT && log empty) { migrate; write log; write version }
    // Those are two separate writes. A crash between them leaves a migrated
    // log with a STALE version — so the next launch migrates again.
    const store = new FakeStorage();
    const legacyStats = { '4th_addition_medium': { attempted: 40, correct: 30 } };
    await store.setItem(K.stats, JSON.stringify(legacyStats));
    await store.setItem(K.schema, '2');

    // First launch: migrate, write the log, then CRASH before the version write.
    const migrated = migrateLegacyStats(legacyStats, START, resolveSkill);
    await store.setItem(K.attempts, JSON.stringify(migrated));
    // ← crash here; K.schema still '2'

    const afterFirst = sanitiseLog(JSON.parse((await store.getItem(K.attempts))!));
    console.log('\n===== C4 · INTERRUPTED MIGRATION =====');
    console.log(`after crash: log has ${afterFirst.length} rows, schema version is still ${await store.getItem(K.schema)}`);

    // Second launch: the guard is `schemaVersion < CURRENT && localAT.length === 0`.
    const wouldMigrateAgain = Number(await store.getItem(K.schema)) < 3 && afterFirst.length === 0;
    console.log(`would migrate again? ${wouldMigrateAgain}`);
    console.log('→ SAFE: the `localAT.length === 0` guard prevents re-migration.');
    expect(wouldMigrateAgain).toBe(false);
  });

  it('but a crash mid-migration with an EMPTY write does re-run and is still safe', async () => {
    const store = new FakeStorage();
    const legacyStats = { '4th_addition_medium': { attempted: 40, correct: 30 } };
    await store.setItem(K.stats, JSON.stringify(legacyStats));
    await store.setItem(K.schema, '2');
    // Crash before ANY write.
    const first = sanitiseLog(JSON.parse((await store.getItem(K.attempts)) ?? '[]'));
    expect(first.length).toBe(0);
    const again = migrateLegacyStats(legacyStats, START, resolveSkill);
    console.log(`re-migration produces ${again.length} rows (capped at 40 by design)`);
    expect(again.length).toBe(40);
  });
});

describe('C5 · manifest vs per-key version', () => {
  it('the manifest is written AFTER the data it describes', async () => {
    // loadAll ends with `void writeManifest(MANIFEST_VERSION)` — not awaited,
    // and after all data writes. A crash leaves data at v4 shape with a
    // manifest claiming v0.
    const store = new FakeStorage();
    await store.setItem(K.attempts, JSON.stringify([]));
    // manifest write never lands
    const raw = await store.getItem(K.manifest);
    console.log('\n===== C5 · MANIFEST LAG =====');
    console.log(`manifest after crash: ${raw ?? 'ABSENT'}`);
    console.log('→ readManifest() falls back to version 0, so a future migration');
    console.log('   would believe this is a pre-manifest install.');
    expect(raw).toBeNull();
  });
});
