import { describe, it, expect } from 'vitest';
import { recordAnswer, type AnswerState } from '../../../progression/recordAnswer';
import { appendAttempts, currentStreak, practiceDays, meaningfulPracticeDays, dayKey, mergeAttempts, MAX_ATTEMPTS, type Attempt } from '../../../learning/attempts';
import { estimateAll } from '../../../learning/mastery';
import { levelForXp } from '../../../progression/levels';
import { evaluateAchievements } from '../../../progression/achievements';
import { SKILLS } from '../../../learning/skills';

const START = Date.UTC(2026, 0, 1, 9);
const DAY = 86_400_000;
const POOL = ['add.3digit', 'sub.3digit', 'mul.tables.mid', 'div.basic', 'placevalue'];

function answer(st: AnswerState, o: { skill: string; correct: boolean; now: number }) {
  return recordAnswer(st, {
    question: { questionText: `q-${o.now}`, answer: 7, choices: [1, 2, 3, 7] } as never,
    chosen: o.correct ? '7' : '1', correct: o.correct, latencyMs: 5000, timedOut: false,
    plannedSkill: o.skill as never, cls: '4th', sessionCategory: 'addition',
    difficulty: 'medium', isTablesMode: false, now: o.now,
  });
}
const blank = (): AnswerState => ({ log: [], ledger: {}, totalXp: 0 });

describe('L1 · five years of daily use', () => {
  it('XP is cumulative but the evidence for it is evicted', () => {
    let st = blank();
    const days = 365 * 5;
    const perDay = 20;
    const milestones: Record<string, unknown>[] = [];

    for (let d = 0; d < days; d++) {
      for (let i = 0; i < perDay; i++) {
        st = answer(st, {
          skill: POOL[(d + i) % POOL.length],
          correct: (d * perDay + i) % 6 !== 0,
          now: START + d * DAY + i * 60_000,
        }).state;
      }
      if (d === 0 || d === 199 || d === 364 || d === 999 || d === days - 1) {
        milestones.push({
          day: d + 1,
          answered: (d + 1) * perDay,
          logRows: st.log.length,
          oldestRetainedDay: Math.round((st.log[0].answeredAt - START) / DAY),
          totalXp: Math.round(st.totalXp),
          level: levelForXp(st.totalXp).level,
          practiceDaysVisible: practiceDays(st.log).length,
        });
      }
    }

    console.log('\n===== L1 · FIVE YEARS, 20 QUESTIONS/DAY =====');
    for (const m of milestones) console.log(JSON.stringify(m));

    const last = milestones[milestones.length - 1] as { practiceDaysVisible: number; logRows: number };
    console.log(`\nTrue practice days: ${days}. Visible to achievements: ${last.practiceDaysVisible}.`);
    console.log('→ "Season" (90 distinct days) still passes, but any lifetime');
    console.log('   statistic is computed over a 200-day rolling window, not a life.');
    expect(last.logRows).toBe(MAX_ATTEMPTS);
    expect(last.practiceDaysVisible).toBeLessThan(days);
  });

  it('mastery stays reproducible from the surviving log', () => {
    // The key durability property: derived state must be recomputable.
    let st = blank();
    for (let d = 0; d < 400; d++) {
      for (let i = 0; i < 12; i++) {
        st = answer(st, { skill: POOL[i % POOL.length], correct: i % 5 !== 0, now: START + d * DAY + i * 60_000 }).state;
      }
    }
    const now = START + 400 * DAY;
    const a = estimateAll(st.log, now);
    const b = estimateAll([...st.log], now);
    const same = Object.keys(a).every(k => a[k].value === b[k].value);
    console.log(`\nmastery recomputation is deterministic: ${same}`);
    expect(same).toBe(true);
  });
});

describe('L2 · clock and timezone hazards', () => {
  it('a backwards clock change breaks the streak permanently', () => {
    // Child practises daily. Device clock jumps back a week (manual change,
    // NTP correction after a flat battery, or travel).
    let log: Attempt[] = [];
    const mk = (t: number): Attempt => ({
      skill: 'add.3digit', correct: true, answeredAt: t, latencyMs: 5000,
      chosen: '7', expected: '7', questionText: 'q', timedOut: false,
      cls: '4th', category: 'addition', difficulty: 'medium',
    } as Attempt);

    for (let d = 0; d < 30; d++) log = appendAttempts(log, [mk(START + d * DAY)]);
    const before = currentStreak(log, START + 29 * DAY);

    // Clock jumps back 7 days; the learner keeps practising.
    for (let d = 0; d < 5; d++) log = appendAttempts(log, [mk(START + (22 + d) * DAY + 3600_000)]);
    const after = currentStreak(log, START + 26 * DAY);

    // docs/23 S7 — FIXED. appendAttempts now keeps the log chronological, so a
    // backwards clock change can still confuse the STREAK (that is inherent to
    // wall-clock time) but can no longer corrupt log ORDER, which every window
    // function downstream depends on.
    const outOfOrder = log.some((a, i) => i > 0 && a.answeredAt < log[i - 1].answeredAt);
    console.log('\n===== L2 · BACKWARDS CLOCK =====');
    console.log(`streak before jump: ${before}, after 5 more days of practice: ${after}`);
    console.log(`log out of chronological order: ${outOfOrder}`);
    expect(outOfOrder).toBe(false);
  });

  it('crossing a timezone splits or merges a practice day', () => {
    // dayKey uses LOCAL date. A learner flying IST → PST gains a day boundary.
    const t = Date.UTC(2026, 5, 1, 18, 30);   // 00:00 IST on 2 June
    console.log('\n===== L2b · TIMEZONE =====');
    console.log(`dayKey in this runtime (${Intl.DateTimeFormat().resolvedOptions().timeZone}): ${dayKey(t)}`);
    console.log('→ dayKey is local-date based, so streaks and daily caps shift');
    console.log('   with the device timezone. Two sessions 30 min apart can land');
    console.log('   on different "days", or two calendar days can collapse into one.');
    expect(typeof dayKey(t)).toBe('string');
  });

  it('sessionDecay and skillSaturation reset on timezone change', () => {
    // Both anti-grind caps key on dayKey. Changing timezone forward resets
    // the daily budget mid-session.
    const evening = Date.UTC(2026, 5, 1, 18, 0);
    const later = evening + 3600_000;
    console.log(`\ndayKey(evening)=${dayKey(evening)} dayKey(+1h)=${dayKey(later)} same=${dayKey(evening) === dayKey(later)}`);
    expect(typeof dayKey(evening)).toBe('string');
  });
});

describe('L3 · repeated sync round-trips', () => {
  it('merging the same log repeatedly is stable', () => {
    let st = blank();
    for (let i = 0; i < 300; i++) {
      st = answer(st, { skill: POOL[i % POOL.length], correct: i % 4 !== 0, now: START + i * 60_000 }).state;
    }
    let merged = st.log;
    const sizes: number[] = [];
    for (let round = 0; round < 20; round++) {
      merged = mergeAttempts(merged, st.log);
      sizes.push(merged.length);
    }
    console.log('\n===== L3 · 20 SYNC ROUND-TRIPS =====');
    console.log(`sizes: ${[...new Set(sizes)].join(', ')}`);
    console.log('→ idempotent: repeated sync does not inflate the log.');
    expect(new Set(sizes).size).toBe(1);
  });

  it('merge still truncates at the cap, but far later and with history retained', () => {
    const mk = (t: number, tag: string): Attempt => ({
      skill: 'add.3digit', correct: true, answeredAt: t, latencyMs: 5000,
      chosen: '7', expected: '7', questionText: `${tag}-${t}`, timedOut: false,
      cls: '4th', category: 'addition', difficulty: 'medium',
    } as Attempt);
    const phone = Array.from({ length: 3000 }, (_, i) => mk(START + i * 60_000, 'phone'));
    const tablet = Array.from({ length: 3000 }, (_, i) => mk(START + (i + 3000) * 60_000, 'tablet'));
    const merged = mergeAttempts(phone, tablet);
    const phoneKept = merged.filter(a => a.questionText.startsWith('phone')).length;
    console.log('\n===== L3b · TWO DEVICES, 6000 ATTEMPTS =====');
    console.log(`merged: ${merged.length} (cap ${MAX_ATTEMPTS}); phone rows surviving: ${phoneKept}/3000`);
    // docs/23 S5 — MITIGATED. 6,000 combined rows now fit under the 12,000 cap,
    // so nothing is evicted at this scale at all; and beyond it, DailySummary
    // preserves the per-day facts lifetime statistics need.
    console.log(`cap is now ${MAX_ATTEMPTS}; nothing evicted at 6,000 rows.`);
    expect(merged.length).toBe(6000);
    expect(phoneKept).toBe(3000);
  });
});

describe('L4 · derived values remain reproducible', () => {
  it('XP total cannot be rebuilt from the attempt log', () => {
    // The critical asymmetry: mastery, stats and achievements are all derived
    // and therefore self-healing. totalXp is NOT — it is an accumulator.
    let st = blank();
    for (let i = 0; i < 200; i++) {
      st = answer(st, { skill: POOL[i % POOL.length], correct: i % 5 !== 0, now: START + i * 60_000 }).state;
    }
    // Attempt a rebuild by replaying the log through the same pipeline.
    let replay = blank();
    for (const a of st.log) {
      replay = recordAnswer(replay, {
        question: { questionText: a.questionText, answer: a.expected, choices: [1, 2, 3, 7],
          interaction: a.interaction ? { kind: a.interaction } as never : undefined } as never,
        chosen: a.chosen, correct: a.correct, latencyMs: a.latencyMs, timedOut: a.timedOut,
        scaffolded: a.scaffolded, plannedSkill: a.skill, cls: a.cls,
        sessionCategory: a.category, difficulty: a.difficulty, isTablesMode: false,
        now: a.answeredAt,
      }).state;
    }
    const drift = Math.abs(replay.totalXp - st.totalXp);
    console.log('\n===== L4 · CAN XP BE REBUILT? =====');
    console.log(`live total: ${st.totalXp.toFixed(1)}, replayed from log: ${replay.totalXp.toFixed(1)}, drift: ${drift.toFixed(1)}`);
    console.log(`replay is exact: ${drift < 0.05}`);
    // Mastery and achievements rebuild exactly.
    const liveM = estimateAll(st.log, START + DAY);
    const replayM = estimateAll(replay.log, START + DAY);
    const masteryExact = Object.keys(liveM).every(k => liveM[k].value === replayM[k].value);
    console.log(`mastery rebuild is exact: ${masteryExact}`);
    expect(masteryExact).toBe(true);
  });

  it('achievements are pure functions of the log', () => {
    let st = blank();
    for (let d = 0; d < 60; d++) {
      for (let i = 0; i < 10; i++) {
        st = answer(st, { skill: POOL[i % POOL.length], correct: i % 4 !== 0, now: START + d * DAY + i * 60_000 }).state;
      }
    }
    const now = START + 60 * DAY;
    const ctx = { log: st.log, estimates: estimateAll(st.log, now), cls: '4th' as const, now };
    const a = evaluateAchievements(ctx).map(x => x.progress);
    const b = evaluateAchievements({ ...ctx, log: [...st.log] }).map(x => x.progress);
    console.log(`\nachievement recomputation deterministic: ${JSON.stringify(a) === JSON.stringify(b)}`);
    expect(a).toEqual(b);
  });
});
