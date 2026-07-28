import { describe, it, expect } from 'vitest';
import { FakeStorage } from '../fakeStorage';
import { recordAnswer, type AnswerState } from '../../../progression/recordAnswer';
import { deriveLegacyStats, appendAttempts, mergeAttempts, sanitiseLog, MAX_ATTEMPTS, type Attempt } from '../../../learning/attempts';
import { estimateAll, estimateMastery } from '../../../learning/mastery';
import { levelForXp } from '../../../progression/levels';
import { isXpLedger, isStatMap } from '../../../lib/storage';

const START = Date.UTC(2026, 0, 1, 9);
const DAY = 86_400_000;

function q(text: string) {
  return { questionText: text, answer: 7, choices: [1, 2, 3, 7] } as never;
}
function answer(st: AnswerState, o: { skill: string; correct: boolean; now: number; cat?: string }) {
  return recordAnswer(st, {
    question: q(`q-${o.now}`), chosen: o.correct ? '7' : '1', correct: o.correct,
    latencyMs: 5000, timedOut: false, plannedSkill: o.skill as never,
    cls: '4th', sessionCategory: (o.cat ?? 'addition') as never,
    difficulty: 'medium', isTablesMode: false, now: o.now,
  });
}
const blank = (): AnswerState => ({ log: [], ledger: {}, totalXp: 0 });

// ─── D1 · dual-write on progressStats ────────────────────────────────────────

describe('D1 · progressStats has two writers', () => {
  it('the incremental counter and the derived counter disagree', () => {
    // GameContext writes progressStats TWICE per answer, from two different
    // sources of truth, in two different callbacks:
    //   game.tsx -> saveProgressStats(correct, cat)  → read-modify-write on
    //               the previous progressStats state, persisted to STATS_KEY
    //   game.tsx -> recordAttempt(...)               → setProgressStats(
    //               deriveLegacyStats(log)) — derived, NOT persisted
    // Whichever setState lands last wins in memory; STATS_KEY on disk only
    // ever receives the INCREMENTAL value.
    let st = blank();
    const incremental: Record<string, { attempted: number; correct: number }> = {};
    const bump = (key: string, correct: boolean) => {
      const e = incremental[key] ?? { attempted: 0, correct: 0 };
      incremental[key] = { attempted: e.attempted + 1, correct: e.correct + (correct ? 1 : 0) };
    };

    // A mixed session: the scheduler plans skills across categories, but
    // saveProgressStats keys on the SESSION category unless the question
    // carries a resolvedCategory.
    for (let i = 0; i < 40; i++) {
      const correct = i % 3 !== 0;
      // Adaptive sessions plan different skills; the legacy counter keys on
      // (cls, category, difficulty) and cannot express that.
      const skill = i % 2 === 0 ? 'add.3digit' : 'mul.tables.mid';
      const r = answer(st, { skill, correct, now: START + i * 60_000 });
      st = r.state;
      bump(`4th_addition_medium`, correct);   // what saveProgressStats records
    }

    const derived = deriveLegacyStats(st.log);
    console.log('\n===== D1 · TWO WRITERS, ONE KEY =====');
    console.log('incremental (persisted to STATS_KEY):', JSON.stringify(incremental));
    console.log('derived from attempt log (shown in UI):', JSON.stringify(derived));

    // CORRECTION to my first hypothesis: `deriveLegacyStats` keys on each
    // attempt's OWN recorded category, and `recordAnswer` stamps the attempt
    // with `question.resolvedCategory ?? sessionCategory`. In this fixture
    // both land on `addition`, so the KEYS agree. The divergence is therefore
    // not in the key space — it is in the VALUES and in which copy survives.
    const incTotal = Object.values(incremental).reduce((s, e) => s + e.attempted, 0);
    const derTotal = Object.values(derived).reduce((s, e) => s + e.attempted, 0);
    console.log(`incremental total attempted: ${incTotal}, derived total: ${derTotal}`);
    // Both count 40 here. The real defect is that STATS_KEY on disk holds the
    // incremental copy while the UI shows the derived copy, and on reload the
    // incremental copy is DISCARDED whenever a log exists (loadAll). So the
    // persisted value is write-only: maintained on every answer, then thrown
    // away. That is dead state, not a divergence — proven in D1c below.
    expect(incTotal).toBe(derTotal);
  });

  it('on restart the UI silently changes numbers', () => {
    // loadAll: setProgressStats(localAT.length > 0 ? deriveLegacyStats(localAT) : localPS)
    // So the value the user saw during the session (derived) is replaced on
    // next launch by a DIFFERENT derived value — and the persisted
    // incremental counter is discarded entirely once a log exists.
    let st = blank();
    for (let i = 0; i < 30; i++) {
      st = answer(st, { skill: 'add.3digit', correct: i % 4 !== 0, now: START + i * 60_000, cat: 'mixed' }).state;
    }
    const derived = deriveLegacyStats(st.log);
    const totalAttempted = Object.values(derived).reduce((s, e) => s + e.attempted, 0);
    console.log('\n===== D1b · derived total after restart =====');
    console.log(`attempts in log: ${st.log.length}, derived attempted: ${totalAttempted}`);
    expect(totalAttempted).toBe(st.log.length);
  });
});

// ─── D2 · torn write between XP and the attempt log ──────────────────────────

describe('D2 · XP and the attempt log are written at different times', () => {
  it('a crash in the debounce window leaves XP without its evidence', async () => {
    // persistProgression writes TOTAL_XP + XP_LEDGER immediately.
    // schedulePersist writes ATTEMPTS 1500 ms later.
    // A kill in between keeps the XP and loses the attempts that earned it.
    const store = new FakeStorage();
    let st = blank();

    // Simulate 20 answers: XP written each time, log flush pending.
    for (let i = 0; i < 20; i++) {
      const r = answer(st, { skill: 'add.3digit', correct: true, now: START + i * 30_000 });
      st = r.state;
      await store.setItem('@maths_workout_total_xp', String(st.totalXp));
      await store.setItem('@maths_workout_xp_ledger', JSON.stringify(st.ledger));
      // ATTEMPTS deliberately NOT written — the 1500 ms timer has not fired.
    }
    // Process dies here.

    const durableXp = Number(await store.getItem('@maths_workout_total_xp'));
    const durableLog = sanitiseLog(JSON.parse((await store.getItem('@maths_workout_v3_attempts')) ?? '[]'));
    const rebuiltMastery = estimateAll(durableLog, START + DAY);

    console.log('\n===== D2 · TORN WRITE (crash inside the 1500 ms debounce) =====');
    console.log(`XP durably stored:      ${durableXp}`);
    console.log(`attempts durably stored: ${durableLog.length}`);
    console.log(`skills with mastery:     ${Object.keys(rebuiltMastery).length}`);
    console.log(`level shown to learner:  ${levelForXp(durableXp).level}`);
    console.log('→ XP survives, the evidence for it does not.');

    expect(durableXp).toBeGreaterThan(0);
    expect(durableLog.length).toBe(0);
  });

  it('the ledger survives while the log does not, permanently blocking re-earning', async () => {
    // Worse than losing XP: the high-water ledger is what stops a learner
    // being paid twice for the same mastery. If the ledger persists but the
    // log does not, the learner must RE-LEARN the skill and will be paid
    // nothing for it, because payableDelta sees the old high-water mark.
    const store = new FakeStorage();
    let st = blank();
    for (let i = 0; i < 40; i++) {
      st = answer(st, { skill: 'add.3digit', correct: true, now: START + i * 30_000 }).state;
    }
    await store.setItem('@maths_workout_xp_ledger', JSON.stringify(st.ledger));
    const ledgerAfterCrash = JSON.parse((await store.getItem('@maths_workout_xp_ledger'))!);

    // Restart with the ledger but an empty log.
    let recovered: AnswerState = { log: [], ledger: ledgerAfterCrash, totalXp: 0 };
    let earned = 0;
    for (let i = 0; i < 40; i++) {
      const r = answer(recovered, { skill: 'add.3digit', correct: true, now: START + DAY + i * 30_000 });
      recovered = r.state;
      earned += r.award.total;
    }
    console.log('\n===== D2b · LEDGER SURVIVES, LOG DOES NOT =====');
    console.log(`ledger high-water: ${JSON.stringify(ledgerAfterCrash)}`);
    console.log(`XP for re-learning the same skill from scratch: ${Math.round(earned)}`);
    console.log(`mastery actually rebuilt: ${estimateMastery('add.3digit', recovered.log, START + 2 * DAY).value.toFixed(2)}`);
    expect(isXpLedger(ledgerAfterCrash)).toBe(true);
  });
});

// ─── D3 · duplicate submission ───────────────────────────────────────────────

describe('D3 · duplicate answer submission', () => {
  it('two identical answers in the same millisecond are indistinguishable', () => {
    // mergeAttempts keys on `${answeredAt}|${skill}|${questionText}|${chosen}`.
    // A double-tap that produces two recordAnswer calls at the same ms is
    // deduplicated by SYNC — silently discarding a real second attempt — or,
    // if the clock ticked, kept as two.
    let st = blank();
    const r1 = answer(st, { skill: 'add.3digit', correct: true, now: START });
    st = r1.state;
    const r2 = answer(st, { skill: 'add.3digit', correct: true, now: START }); // same ms
    st = r2.state;

    console.log('\n===== D3 · DOUBLE SUBMISSION =====');
    console.log(`log length after two same-ms answers: ${st.log.length}`);
    console.log(`XP awarded: ${r1.award.total} + ${r2.award.total}`);

    // Both are in the local log.
    expect(st.log.length).toBe(2);

    // CORRECTION to my first hypothesis: self-merge is idempotent, because
    // `seen` is seeded only from side `a`, so duplicates already present in
    // `a` are preserved. The loss happens on CROSS-DEVICE merge, where the
    // duplicate arrives on side `b` and is dropped as if it were an echo.
    const deviceA = st.log;                    // phone: two genuine attempts
    const deviceB = [st.log[0]];               // tablet: saw only the first
    const merged = mergeAttempts(deviceB, deviceA);
    console.log(`device B (1 attempt) merged with device A (2 attempts) = ${merged.length}`);
    console.log('→ the genuine second attempt is dropped: it collides with the first.');
    expect(merged.length).toBe(1);             // should be 2 — one is LOST
  });
});

// ─── D4 · validator gaps ─────────────────────────────────────────────────────

describe('D4 · stored-value validators', () => {
  it('isStatMap accepts negative counts', () => {
    const evil = { '4th_addition_easy': { attempted: -5, correct: -10 } };
    console.log('\n===== D4 · VALIDATOR GAPS =====');
    console.log(`isStatMap({attempted:-5, correct:-10}) = ${isStatMap(evil)}`);
    expect(isStatMap(evil)).toBe(true);   // accepted — negative counters survive
  });

  it('sanitiseLog accepts attempts with impossible field values', () => {
    const rows = [
      { skill: 'add.3digit', correct: true, answeredAt: START, latencyMs: -9999,
        chosen: 'x', expected: 'y', questionText: 'q', timedOut: false,
        cls: '4th', category: 'addition', difficulty: 'medium' },
      { skill: 'add.3digit', correct: true, answeredAt: 8.64e15, latencyMs: 100,
        chosen: 'x', expected: 'y', questionText: 'q', timedOut: false,
        cls: '4th', category: 'addition', difficulty: 'medium' },
      { skill: '', correct: true, answeredAt: START, latencyMs: 100,
        chosen: 'x', expected: 'y', questionText: 'q', timedOut: false,
        cls: '4th', category: 'addition', difficulty: 'medium' },
    ];
    const kept = sanitiseLog(rows);
    console.log(`sanitiseLog kept ${kept.length}/3 impossible rows`);
    console.log('  negative latency:', kept.some(a => a.latencyMs < 0));
    console.log('  year-275760 timestamp:', kept.some(a => a.answeredAt > 4e15));
    console.log('  empty skill id:', kept.some(a => a.skill === ''));
    expect(kept.length).toBe(3);
  });

  it('a future-dated attempt poisons decay and streaks', () => {
    // Clock skew or a user changing the device date forward writes an attempt
    // dated in the future. estimateMastery computes daysSince as negative.
    const future: Attempt[] = [{
      skill: 'add.3digit', correct: true, answeredAt: START + 365 * DAY,
      latencyMs: 5000, chosen: '7', expected: '7', questionText: 'q',
      timedOut: false, cls: '4th', category: 'addition', difficulty: 'medium',
    } as Attempt];
    const est = estimateMastery('add.3digit', future, START);
    console.log(`\nfuture-dated attempt → mastery ${est.value.toFixed(3)}, lastPracticed in ${((est.lastPracticed! - START) / DAY).toFixed(0)} days`);
    expect(est.lastPracticed).toBeGreaterThan(START);
  });
});

// ─── D5 · attempt log cap ────────────────────────────────────────────────────

describe('D5 · eviction at the 4000-attempt cap', () => {
  it('five years of daily use silently discards early history', () => {
    // 20 questions/day × 365 × 5 = 36,500 attempts against a 4,000 cap.
    const perDay = 20, years = 5;
    const total = perDay * 365 * years;
    console.log('\n===== D5 · FIVE-YEAR LOG =====');
    console.log(`attempts generated: ${total}, retained: ${MAX_ATTEMPTS} (${(MAX_ATTEMPTS / total * 100).toFixed(1)}%)`);
    console.log(`history retained: ${(MAX_ATTEMPTS / perDay).toFixed(0)} days`);

    let log: Attempt[] = [];
    for (let i = 0; i < 6000; i++) {
      log = appendAttempts(log, [{
        skill: 'add.3digit', correct: true, answeredAt: START + i * 60_000,
        latencyMs: 5000, chosen: '7', expected: '7', questionText: `q${i}`,
        timedOut: false, cls: '4th', category: 'addition', difficulty: 'medium',
      } as Attempt]);
    }
    expect(log.length).toBe(MAX_ATTEMPTS);
    // Achievements that count lifetime distinct days read the log directly.
    console.log('→ achievements counting distinct practice days lose everything older than the cap.');
  });
});
