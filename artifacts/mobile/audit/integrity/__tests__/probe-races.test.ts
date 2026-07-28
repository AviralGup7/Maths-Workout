import { describe, it, expect } from 'vitest';
import { FakeStorage } from '../fakeStorage';
import { recordAnswer, type AnswerState } from '../../../progression/recordAnswer';
import { deriveLegacyStats, sanitiseLog, type Attempt } from '../../../learning/attempts';
import { isStatMap } from '../../../lib/storage';

const START = Date.UTC(2026, 0, 1, 9);
const K = {
  attempts: '@maths_workout_v3_attempts',
  stats: '@maths_workout_v2_progress_stats',
  xp: '@maths_workout_total_xp',
};

function answer(st: AnswerState, o: { skill: string; correct: boolean; now: number; cat?: string }) {
  return recordAnswer(st, {
    question: { questionText: `q-${o.now}`, answer: 7, choices: [1, 2, 3, 7],
      resolvedCategory: o.cat as never } as never,
    chosen: o.correct ? '7' : '1', correct: o.correct, latencyMs: 5000, timedOut: false,
    plannedSkill: o.skill as never, cls: '4th', sessionCategory: 'mixed',
    difficulty: 'medium', isTablesMode: false, now: o.now,
  });
}
const blank = (): AnswerState => ({ log: [], ledger: {}, totalXp: 0 });

describe('R1 · progressStats is write-only dead state', () => {
  it('the persisted counter is discarded on every launch once a log exists', async () => {
    const store = new FakeStorage();
    let st = blank();

    // Session: both writers run per answer, exactly as game.tsx does.
    const incremental: Record<string, { attempted: number; correct: number }> = {};
    for (let i = 0; i < 30; i++) {
      const cat = i % 2 === 0 ? 'addition' : 'division';
      const correct = i % 3 !== 0;
      st = answer(st, { skill: i % 2 === 0 ? 'add.3digit' : 'div.basic', correct, now: START + i * 60_000, cat }).state;
      // saveProgressStats: keys on the SESSION category unless resolvedCategory
      // is supplied. game.tsx does supply it, so this matches.
      const key = `4th_${cat}_medium`;
      const e = incremental[key] ?? { attempted: 0, correct: 0 };
      incremental[key] = { attempted: e.attempted + 1, correct: e.correct + (correct ? 1 : 0) };
      await store.setItem(K.stats, JSON.stringify(incremental));
    }
    await store.setItem(K.attempts, JSON.stringify(st.log));

    // Restart — loadAll's actual expression.
    const localPS = JSON.parse((await store.getItem(K.stats))!);
    const localAT = sanitiseLog(JSON.parse((await store.getItem(K.attempts))!));
    const shownAfterRestart = localAT.length > 0 ? deriveLegacyStats(localAT) : localPS;

    console.log('\n===== R1 · IS THE PERSISTED COUNTER EVER READ? =====');
    console.log('persisted (STATS_KEY):', JSON.stringify(localPS));
    console.log('shown after restart  :', JSON.stringify(shownAfterRestart));
    const identical = JSON.stringify(localPS) === JSON.stringify(shownAfterRestart);
    console.log(`values agree here: ${identical}`);
    console.log('→ agreement is COINCIDENTAL: the derived copy is used regardless.');
    console.log('   STATS_KEY is written ~30x per session and read only when the log is empty.');
    expect(localAT.length).toBeGreaterThan(0);
  });

  it('divergence appears the moment the log is evicted or partially lost', async () => {
    const store = new FakeStorage();
    let st = blank();
    const incremental: Record<string, { attempted: number; correct: number }> = {};
    for (let i = 0; i < 50; i++) {
      const correct = i % 3 !== 0;
      st = answer(st, { skill: 'add.3digit', correct, now: START + i * 60_000, cat: 'addition' }).state;
      const key = '4th_addition_medium';
      const e = incremental[key] ?? { attempted: 0, correct: 0 };
      incremental[key] = { attempted: e.attempted + 1, correct: e.correct + (correct ? 1 : 0) };
    }
    await store.setItem(K.stats, JSON.stringify(incremental));
    // A crash inside the debounce window: only the first 20 attempts flushed.
    await store.setItem(K.attempts, JSON.stringify(st.log.slice(0, 20)));

    const localPS = JSON.parse((await store.getItem(K.stats))!);
    const localAT = sanitiseLog(JSON.parse((await store.getItem(K.attempts))!));
    const shown = deriveLegacyStats(localAT);

    console.log('\n===== R1b · AFTER A PARTIAL LOG LOSS =====');
    console.log(`counter says attempted=${localPS['4th_addition_medium'].attempted}`);
    console.log(`log says attempted=${shown['4th_addition_medium'].attempted}`);
    console.log('→ the app HAS the true count on disk and throws it away.');
    expect(localPS['4th_addition_medium'].attempted).toBeGreaterThan(
      shown['4th_addition_medium'].attempted);
  });
});

describe('R2 · concurrent flush races', () => {
  it('an in-flight flush can overwrite a newer log with an older snapshot', async () => {
    // schedulePersist stores `pendingRef.current = next` and a 1500 ms timer.
    // flushAttempts is ALSO called directly by endGame() and by the AppState
    // listener. Two overlapping flushes both read pendingRef, and the slower
    // write can land last.
    const store = new FakeStorage();
    let st = blank();

    for (let i = 0; i < 10; i++) {
      st = answer(st, { skill: 'add.3digit', correct: true, now: START + i * 30_000 }).state;
    }
    const snapshotA = [...st.log];               // 10 rows — flush A reads this

    for (let i = 10; i < 25; i++) {
      st = answer(st, { skill: 'add.3digit', correct: true, now: START + i * 30_000 }).state;
    }
    const snapshotB = [...st.log];               // 25 rows — flush B reads this

    // B completes first (smaller earlier write already queued), A lands after.
    await store.setItem(K.attempts, JSON.stringify(snapshotB));
    await store.setItem(K.attempts, JSON.stringify(snapshotA));

    const durable = sanitiseLog(JSON.parse((await store.getItem(K.attempts))!));
    console.log('\n===== R2 · OUT-OF-ORDER FLUSH =====');
    console.log(`newest snapshot: ${snapshotB.length} rows, durable after reordering: ${durable.length}`);
    console.log('→ AsyncStorage gives no write ordering guarantee across awaits;');
    console.log('   there is no sequence number or compare-and-set to reject a stale write.');
    expect(durable.length).toBe(snapshotA.length);
  });

  it('flushAttempts clears pendingRef before awaiting, so a concurrent answer is dropped', async () => {
    // flushAttempts():  pendingRef.current = null;  await setItem(...)
    // If an answer arrives during the await, schedulePersist sets pendingRef
    // and starts a NEW timer — safe. But if the process dies during that
    // await, the just-cleared pending snapshot is gone from memory too.
    const store = new FakeStorage();
    store.fault = { kind: 'crash', afterWrites: 0 };
    let pending: Attempt[] | null = [{ skill: 'add.3digit', correct: true, answeredAt: START,
      latencyMs: 5000, chosen: '7', expected: '7', questionText: 'q', timedOut: false,
      cls: '4th', category: 'addition', difficulty: 'medium' } as Attempt];

    pending = null;                              // flushAttempts clears first
    await store.setItem(K.attempts, JSON.stringify([]));   // never lands

    const durable = await store.getItem(K.attempts);
    console.log('\n===== R2b · CLEARED-THEN-CRASHED =====');
    console.log(`pendingRef after clear: ${pending}`);
    console.log(`durable log: ${durable ?? 'ABSENT'}`);
    console.log(`writes recorded as lost: ${store.lostWrites.length}`);
    expect(store.lostWrites.length).toBeGreaterThan(0);
  });
});

describe('R3 · rapid double submission at the UI layer', () => {
  it('two recordAnswer calls for one question double-count XP', () => {
    // game.tsx guards with perQLocked, but recordAttempt itself has no
    // idempotency key: if the guard is ever bypassed (fast double-tap on a
    // slow device, a re-render, a replayed event) the same question is
    // recorded twice and paid twice.
    let st = blank();
    const first = answer(st, { skill: 'add.3digit', correct: true, now: START });
    st = first.state;
    const second = answer(st, { skill: 'add.3digit', correct: true, now: START });
    st = second.state;

    console.log('\n===== R3 · DOUBLE SUBMISSION =====');
    console.log(`XP: ${first.award.total} then ${second.award.total} — total ${st.totalXp.toFixed(1)}`);
    console.log(`log rows for one question: ${st.log.length}`);
    console.log('→ no attempt id and no dedupe: the engine cannot tell a genuine');
    console.log('   second attempt from a replay of the first.');
    expect(st.log.length).toBe(2);
    expect(st.totalXp).toBeGreaterThan(first.award.total);
  });
});
