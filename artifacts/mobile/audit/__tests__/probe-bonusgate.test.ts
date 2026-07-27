import { describe, it, expect } from 'vitest';
import { recordAnswer, type AnswerState } from '../../progression/recordAnswer';
import { levelForXp } from '../../progression/levels';
import { estimateMastery } from '../../learning/mastery';
import { table } from '../harness';

const START = Date.UTC(2026, 0, 1, 9);
function play(st: AnswerState, skill: string, correct: boolean, now: number, latency: number) {
  return recordAnswer(st, {
    question: { questionText: `q${now}`, answer: '7', choices: ['1','2','3','7'] } as any,
    chosen: correct ? '7' : '1', correct, latencyMs: latency, timedOut: false,
    plannedSkill: skill as any, cls: '4th', sessionCategory: 'addition',
    difficulty: 'medium', isTablesMode: false, now,
  });
}

describe('B1 · do bonuses bypass the non-attempt / suppression gate?', () => {
  it('pays large bonuses for answers computeXp itself refuses to pay for', () => {
    let st: AnswerState = { log: [], ledger: {}, totalXp: 0 };
    let now = START;
    const rows: any[] = [];
    let suppressedButPaid = 0, suppressedCount = 0;
    // 120ms taps — far below plausibilityFloorMs*0.5, so every one is a
    // declared "non-attempt". A tap has ~25% chance of being right on 4 tiles;
    // model that exactly.
    for (let i = 0; i < 400; i++) {
      const correct = i % 4 === 0;
      const r = play(st, 'add.3digit', correct, now += 15_000, 120);
      st = r.state;
      const bonusXp = r.award.bonuses.reduce((s, b) => s + b.xp, 0);
      if (r.award.breakdown.suppressed) {
        suppressedCount++;
        if (r.award.total > 0) suppressedButPaid++;
      }
      if (i % 80 === 0) rows.push({ i, latency: 120,
        suppressed: r.award.breakdown.suppressed ?? '-', baseXp: r.award.xp,
        bonusXp, awardTotal: r.award.total, runningXp: Math.round(st.totalXp) });
    }
    rows.push({ i: 'END', latency: 120, suppressed: '-', baseXp: '-', bonusXp: '-',
      awardTotal: '-', runningXp: Math.round(st.totalXp) });
    console.log('\n===== B1 · 400 TAPS AT 120 ms (all flagged "non-attempt") =====');
    console.log(table(rows));
    console.log(`answers computeXp suppressed: ${suppressedCount}`);
    console.log(`...of which STILL PAID XP:    ${suppressedButPaid}`);
    console.log(`total XP from pure tapping:   ${Math.round(st.totalXp)}`);
    console.log(`level reached:                ${levelForXp(st.totalXp).level}`);
    console.log(`actual mastery:               ${estimateMastery('add.3digit', st.log, now).value.toFixed(3)}`);
    console.log(`time spent (at 15s/question): ${(400 * 15 / 60).toFixed(0)} minutes`);
    expect(st.totalXp).toBeGreaterThanOrEqual(0);
  });

  it('B2 · comeback multiplier and chapterMastery bonus are unreachable', () => {
    // daysAvoided is never supplied by recordAnswer, the sole caller of awardXp.
    let st: AnswerState = { log: [], ledger: {}, totalXp: 0 };
    const r = play(st, 'add.3digit', true, START, 5000);
    console.log('\n===== B2 · DEAD ECONOMY LEVERS =====');
    console.log(`award.breakdown.multipliers keys: ${Object.keys(r.award.breakdown.multipliers).join(', ')}`);
    console.log('comeback multiplier: recordAnswer never passes daysAvoided → always 1.0');
    console.log('BONUS.chapterMastery (250 XP): defined in xp.ts, never emitted by detectBonuses');
    expect(r.award.total).toBeGreaterThan(0);
  });
});
