// Realistic end-to-end failure scenarios, measured.
import { describe, it, expect } from 'vitest';
import { FakeStorage } from '../fakeStorage';
import { recordAnswer, type AnswerState } from '../../../progression/recordAnswer';
import { sanitiseLog, currentStreak, type Attempt } from '../../../learning/attempts';
import { estimateAll, MASTERED_THRESHOLD } from '../../../learning/mastery';
import { levelForXp, masteryIndex } from '../../../progression/levels';
import { evaluateAchievements } from '../../../progression/achievements';

const START = Date.UTC(2026, 0, 1, 9);
const DAY = 86_400_000;
const K = { attempts: '@maths_workout_v3_attempts', xp: '@maths_workout_total_xp', ledger: '@maths_workout_xp_ledger' };
const POOL = ['add.3digit', 'sub.3digit', 'mul.tables.mid', 'div.basic', 'placevalue'];

function answer(st: AnswerState, o: { skill: string; correct: boolean; now: number; kind?: 'entry' }) {
  return recordAnswer(st, {
    question: { questionText: `q-${o.now}`, answer: 7, choices: o.kind === 'entry' ? [] : [1, 2, 3, 7],
      interaction: o.kind === 'entry' ? { kind: 'entry', inputMode: 'integer' } : undefined } as never,
    chosen: o.correct ? '7' : '1', correct: o.correct, latencyMs: 5000, timedOut: false,
    plannedSkill: o.skill as never, cls: '4th', sessionCategory: 'addition',
    difficulty: 'medium', isTablesMode: false, now: o.now,
  });
}
const blank = (): AnswerState => ({ log: [], ledger: {}, totalXp: 0 });

describe('S1 · "my streak disappeared" — the most likely support ticket', () => {
  it('a kill on the last question of the day can cost the whole day', async () => {
    const store = new FakeStorage();
    let st = blank();

    // 29 days of practice, each properly flushed.
    for (let d = 0; d < 29; d++) {
      for (let i = 0; i < 10; i++) {
        st = answer(st, { skill: POOL[i % POOL.length], correct: true, now: START + d * DAY + i * 60_000 }).state;
      }
      await store.setItem(K.attempts, JSON.stringify(st.log));
    }
    const flushed = [...st.log];

    // Day 30: the child practises, then the OS kills the app during the
    // feedback pause — inside the 1500 ms debounce, before AppState fires.
    for (let i = 0; i < 10; i++) {
      st = answer(st, { skill: POOL[i % POOL.length], correct: true, now: START + 29 * DAY + i * 60_000 }).state;
      await store.setItem(K.xp, String(st.totalXp));   // XP lands
    }
    // log flush never happens.

    const durable = sanitiseLog(JSON.parse((await store.getItem(K.attempts))!));
    const now = START + 29 * DAY + 20 * 3600_000;
    console.log('\n===== S1 · STREAK LOSS =====');
    console.log(`in-memory streak at kill: ${currentStreak(st.log, now)}`);
    console.log(`streak after restart:     ${currentStreak(durable, now)}`);
    console.log(`XP kept: ${Math.round(Number(await store.getItem(K.xp)))} — the day's work is paid but not recorded`);
    expect(durable.length).toBe(flushed.length);
    expect(currentStreak(durable, now)).toBeLessThan(currentStreak(st.log, now));
  });
});

describe('S2 · "the app says I mastered it, then it forgot"', () => {
  it('a crash rolls mastery back while the level stays up', async () => {
    const store = new FakeStorage();
    let st = blank();
    // Practise one skill to mastery over several days, flushing normally.
    for (let d = 0; d < 6; d++) {
      for (let i = 0; i < 12; i++) {
        st = answer(st, { skill: 'add.3digit', correct: true, now: START + d * DAY + i * 60_000, kind: 'entry' }).state;
      }
      await store.setItem(K.attempts, JSON.stringify(st.log));
      await store.setItem(K.xp, String(st.totalXp));
      await store.setItem(K.ledger, JSON.stringify(st.ledger));
    }
    const masteredBefore = estimateAll(st.log, START + 6 * DAY)['add.3digit'].value;

    // Final session pushes it over the line, then the device dies.
    for (let i = 0; i < 12; i++) {
      st = answer(st, { skill: 'add.3digit', correct: true, now: START + 6 * DAY + i * 60_000, kind: 'entry' }).state;
      await store.setItem(K.xp, String(st.totalXp));
      await store.setItem(K.ledger, JSON.stringify(st.ledger));   // ledger lands
    }
    const durable = sanitiseLog(JSON.parse((await store.getItem(K.attempts))!));
    const durableLedger = JSON.parse((await store.getItem(K.ledger))!);
    const masteryAfter = estimateAll(durable, START + 7 * DAY)['add.3digit'].value;

    console.log('\n===== S2 · MASTERY ROLLBACK =====');
    console.log(`mastery in memory at crash: ${estimateAll(st.log, START + 7 * DAY)['add.3digit'].value.toFixed(3)}`);
    console.log(`mastery after restart:      ${masteryAfter.toFixed(3)}`);
    console.log(`ledger high-water on disk:  ${JSON.stringify(durableLedger)}`);
    console.log(`level shown:                ${levelForXp(Number(await store.getItem(K.xp))).level}`);
    console.log('→ the ledger records mastery ALREADY PAID FOR that the log no');
    console.log('   longer evidences, so re-earning it pays only the floor.');
    // The ledger records mastery already PAID FOR. After the crash the log no
    // longer evidences that level, so the two disagree — the ledger is at least
    // as high as the rebuildable mastery, and re-earning pays only the floor.
    expect(durableLedger['add.3digit']).toBeGreaterThanOrEqual(masteryAfter);
  });
});

describe('S3 · reinstall with server sync', () => {
  it('server round-trip cannot restore the attempt log', async () => {
    // pushProgress sends { highScores, progressStats, tablesBest, wrongAnswers }.
    // `attempts` is NOT in ProgressData, so it is never uploaded — but loadAll
    // READS remote.attempts when merging. The field can only ever be undefined.
    let st = blank();
    for (let d = 0; d < 30; d++) {
      for (let i = 0; i < 15; i++) {
        st = answer(st, { skill: POOL[i % POOL.length], correct: i % 5 !== 0, now: START + d * DAY + i * 60_000 }).state;
      }
    }
    const uploaded = {
      highScores: {}, progressStats: {}, tablesBest: {}, wrongAnswers: [],
    } as Record<string, unknown>;
    const restoredAttempts = sanitiseLog(uploaded.attempts);

    console.log('\n===== S3 · REINSTALL =====');
    console.log(`attempts before reinstall: ${st.log.length}`);
    console.log(`attempts restorable from server: ${restoredAttempts.length}`);
    console.log(`XP restorable from server: none — totalXp and xpLedger are not in ProgressData`);
    const est = estimateAll(restoredAttempts, START + 30 * DAY);
    console.log(`mastery after restore: ${Object.keys(est).length} skills, index ${masteryIndex(Object.values(est).map(e => e.value))}`);
    console.log('→ a reinstall loses 100% of mastery, XP, level and achievements.');
    expect(restoredAttempts.length).toBe(0);
  });
});

describe('S4 · low-storage device over a week', () => {
  it('writes fail silently and progress quietly stops persisting', async () => {
    const store = new FakeStorage();
    store.fault = { kind: 'full', afterWrites: 3 };   // 7 daily flushes issued; fail from the 4th
    let st = blank();
    let silentFailures = 0;

    for (let d = 0; d < 7; d++) {
      for (let i = 0; i < 10; i++) {
        st = answer(st, { skill: POOL[i % POOL.length], correct: true, now: START + d * DAY + i * 60_000 }).state;
      }
      try { await store.setItem(K.attempts, JSON.stringify(st.log)); }
      catch { silentFailures++; }                    // GameContext: catch {}
    }
    const durable = sanitiseLog(JSON.parse((await store.getItem(K.attempts)) ?? '[]'));
    console.log('\n===== S4 · DEVICE FULL FOR A WEEK =====');
    console.log(`in-memory attempts: ${st.log.length}, durable: ${durable.length}`);
    console.log(`failed writes swallowed: ${silentFailures}`);
    console.log('→ the learner sees a working app; nothing has been saved for days.');
    expect(durable.length).toBeLessThan(st.log.length);
  });
});

describe('S5 · what self-heals and what does not', () => {
  it('classifies every persistent value by recoverability', () => {
    const rows = [
      { value: 'attempts log', authoritative: 'YES', derivable: 'no — it IS the source', onLoss: 'unrecoverable' },
      { value: 'mastery estimates', authoritative: 'no', derivable: 'yes, from log', onLoss: 'self-heals' },
      { value: 'progressStats', authoritative: 'no (dual-written)', derivable: 'yes, from log', onLoss: 'self-heals' },
      { value: 'achievements', authoritative: 'no', derivable: 'yes, from log', onLoss: 'self-heals' },
      { value: 'scheduler input', authoritative: 'no', derivable: 'yes, from log', onLoss: 'self-heals' },
      { value: 'totalXp', authoritative: 'YES (accumulator)', derivable: 'yes, by replay', onLoss: 'recoverable but never rebuilt' },
      { value: 'xpLedger', authoritative: 'YES', derivable: 'yes, by replay', onLoss: 'recoverable but never rebuilt' },
      { value: 'highScores', authoritative: 'YES', derivable: 'no', onLoss: 'unrecoverable' },
      { value: 'tablesBest', authoritative: 'YES', derivable: 'no', onLoss: 'unrecoverable' },
      { value: 'savedMistakes', authoritative: 'YES', derivable: 'partially, from log', onLoss: 'degraded' },
      { value: 'deviceId', authoritative: 'YES', derivable: 'no', onLoss: 'orphans server data' },
    ];
    console.log('\n===== S5 · RECOVERABILITY MATRIX =====');
    for (const r of rows) console.log(`${r.value.padEnd(20)} auth=${r.authoritative.padEnd(18)} derivable=${r.derivable.padEnd(24)} onLoss=${r.onLoss}`);
    const unrecoverable = rows.filter(r => r.onLoss === 'unrecoverable').length;
    console.log(`\nunrecoverable on loss: ${unrecoverable}/${rows.length}`);
    expect(unrecoverable).toBeGreaterThan(0);
  });
});
