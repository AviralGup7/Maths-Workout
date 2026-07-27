// Hot-path complexity guard — docs/19 W2.
//
// `estimateAll` runs on every answered question and on every render that reads
// derived mastery. It used to filter the WHOLE attempt log once per skill,
// which is O(skills x log). Measured, that was 4.6 ms at today's 45 skills and
// 98.3 ms at 10x curriculum growth — a dropped frame on every answer.
//
// These tests pin BOTH halves of the fix: that bucketing produces identical
// results to filtering, and that the cost no longer grows with skill count.

import { describe, it, expect } from 'vitest';
import { estimateAll, estimateMastery } from '../mastery';
import type { Attempt } from '../attempts';
import { ALL_SKILL_IDS, SKILLS } from '../skills';

const NOW = 1_700_000_000_000;

function makeLog(rows: number, skills: string[] = ALL_SKILL_IDS): Attempt[] {
  const out: Attempt[] = [];
  for (let i = 0; i < rows; i++) {
    const s = skills[i % skills.length];
    out.push({
      skill: s, correct: i % 4 !== 0, answeredAt: NOW - (rows - i) * 60_000,
      latencyMs: 5000, chosen: '1', expected: '1', questionText: `q${i}`,
      timedOut: false, interaction: i % 5 === 0 ? 'entry' : 'choice',
      cls: '4th', category: SKILLS[s].category, difficulty: 'medium',
    });
  }
  return out;
}

describe('estimateAll is equivalent to per-skill estimation', () => {
  it('produces identical estimates to estimateMastery for every skill', () => {
    // The refactor must be behaviour-preserving. If bucketing ever diverges
    // from filtering, mastery silently changes meaning for every learner.
    const log = makeLog(1500, ALL_SKILL_IDS.slice(0, 20));
    const bulk = estimateAll(log, NOW);
    for (const skill of Object.keys(bulk)) {
      const single = estimateMastery(skill, log, NOW);
      expect(bulk[skill].value, skill).toBeCloseTo(single.value, 12);
      expect(bulk[skill].attempts, skill).toBe(single.attempts);
      expect(bulk[skill].correct, skill).toBe(single.correct);
      expect(bulk[skill].trend, skill).toBeCloseTo(single.trend, 12);
      expect(bulk[skill].confidence, skill).toBeCloseTo(single.confidence, 12);
      expect(bulk[skill].lastPracticed, skill).toBe(single.lastPracticed);
      expect(bulk[skill].rawAccuracy, skill).toBeCloseTo(single.rawAccuracy, 12);
    }
  });

  it('still requires chronological order within a skill', () => {
    // Bucketing must sort each bucket: recency weighting and `trend` are both
    // order-dependent, and the log is not guaranteed sorted after a merge.
    const ordered = makeLog(40, ['add.within10']);
    const shuffled = [...ordered].reverse();
    expect(estimateAll(shuffled, NOW)['add.within10'].value)
      .toBeCloseTo(estimateAll(ordered, NOW)['add.within10'].value, 12);
  });

  it('ignores skills that no longer exist in the graph', () => {
    const log = makeLog(20, ['add.within10']);
    log.push({ ...log[0], skill: 'removed.skill.id' });
    expect(Object.keys(estimateAll(log, NOW))).not.toContain('removed.skill.id');
  });
});

describe('estimateAll does not scale with skill count', () => {
  it('costs roughly the same for many skills as for few, at equal log size', () => {
    // The regression this guards: reverting to filter-per-skill makes the
    // wide case ~N times slower than the narrow one. Bucketing makes them
    // comparable, because total work is driven by log length, not skill count.
    const ROWS = 6000;
    const narrow = makeLog(ROWS, ALL_SKILL_IDS.slice(0, 2));
    const wide = makeLog(ROWS, ALL_SKILL_IDS);

    const time = (log: Attempt[]) => {
      estimateAll(log, NOW);                       // warm
      const t = process.hrtime.bigint();
      for (let i = 0; i < 5; i++) estimateAll(log, NOW);
      return Number(process.hrtime.bigint() - t) / 1e6 / 5;
    };

    const tNarrow = Math.max(time(narrow), 0.05);  // floor: timer resolution
    const tWide = time(wide);

    // With filter-per-skill this ratio was ~20x for a 45-skill graph. A
    // generous ceiling keeps the test stable on noisy CI while still failing
    // loudly if the quadratic scan returns.
    expect(tWide / tNarrow, `narrow ${tNarrow.toFixed(2)}ms vs wide ${tWide.toFixed(2)}ms`)
      .toBeLessThan(6);
  });

  it('stays well inside a frame budget at the storage cap', () => {
    const log = makeLog(4000);
    estimateAll(log, NOW);
    const t = process.hrtime.bigint();
    for (let i = 0; i < 10; i++) estimateAll(log, NOW);
    const ms = Number(process.hrtime.bigint() - t) / 1e6 / 10;
    // 16.7 ms is one frame at 60fps; this runs on every answer, so it must be
    // a small fraction of that on hardware far slower than CI.
    expect(ms, `${ms.toFixed(2)} ms`).toBeLessThan(8);
  });
});
