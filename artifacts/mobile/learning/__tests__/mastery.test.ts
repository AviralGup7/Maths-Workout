import { describe, it, expect } from 'vitest';
import {
  estimateMastery, estimateAll, applyDecay, isReady, findRootGap,
  MASTERED_THRESHOLD, STRUGGLING_THRESHOLD, DAY_MS,
} from '../mastery';
import {
  appendAttempts, mergeAttempts, currentStreak, todayCount,
  deriveLegacyStats, migrateLegacyStats, sanitiseLog, MAX_ATTEMPTS, dayKey,
} from '../attempts';
import type { Attempt } from '../attempts';
import { resolveSkill, SKILLS, prerequisiteClosure, ALL_SKILL_IDS } from '../skills';
import { buildSession, scheduleSkills, isDue, reviewIntervalDays, difficultyFor } from '../scheduler';

const NOW = 1_700_000_000_000;

function attempt(over: Partial<Attempt> = {}): Attempt {
  return {
    skill: 'add.within10', correct: true, answeredAt: NOW, latencyMs: 3000,
    chosen: '5', expected: '5', questionText: '2 + 3 = ?', timedOut: false,
    cls: '1st', category: 'addition', difficulty: 'easy', ...over,
  };
}

describe('mastery estimation', () => {
  it('returns an uncertain prior for an unpractised skill', () => {
    const e = estimateMastery('add.within10', [], NOW);
    expect(e.value).toBe(0.5);
    expect(e.confidence).toBe(0);
    expect(e.attempts).toBe(0);
  });

  it('rises with consistent success', () => {
    // Typed entry, not multiple choice: the anti-inflation guard caps
    // recognition-only evidence at RECOGNITION_CEILING (0.80), which sits below
    // MASTERED_THRESHOLD by design.
    const log = Array.from({ length: 10 }, (_, i) =>
      attempt({ correct: true, answeredAt: NOW - i * 1000, interaction: 'entry' }));
    const e = estimateMastery('add.within10', log, NOW);
    expect(e.value).toBeGreaterThan(MASTERED_THRESHOLD);
    expect(e.confidence).toBeGreaterThan(0.7);
  });

  it('falls with consistent failure', () => {
    const log = Array.from({ length: 10 }, (_, i) =>
      attempt({ correct: false, answeredAt: NOW - i * 1000 }));
    const e = estimateMastery('add.within10', log, NOW);
    expect(e.value).toBeLessThan(STRUGGLING_THRESHOLD);
  });

  it('stays near the prior when evidence is sparse', () => {
    const e = estimateMastery('add.within10', [attempt({ correct: true })], NOW);
    // One correct answer must not read as mastery.
    expect(e.value).toBeLessThan(MASTERED_THRESHOLD);
    expect(e.confidence).toBeLessThan(0.5);
  });

  it('weights recent evidence more heavily than old', () => {
    // Five early failures, then five recent successes → should read as improving.
    const log = [
      ...Array.from({ length: 5 }, (_, i) => attempt({ correct: false, answeredAt: NOW - (10 - i) * 1000 })),
      ...Array.from({ length: 5 }, (_, i) => attempt({ correct: true, answeredAt: NOW - (5 - i) * 1000 })),
    ];
    const e = estimateMastery('add.within10', log, NOW);
    expect(e.value).toBeGreaterThan(0.5);
    expect(e.trend).toBeGreaterThan(0);
  });

  it('decays toward uncertainty as time passes', () => {
    const log = Array.from({ length: 10 }, () => attempt({ correct: true }));
    const fresh = estimateMastery('add.within10', log, NOW);
    const stale = estimateMastery('add.within10', log, NOW + 60 * DAY_MS);
    expect(stale.value).toBeLessThan(fresh.value);
    expect(stale.confidence).toBeLessThan(fresh.confidence);
  });

  it('decays symmetrically toward 0.5, never past it', () => {
    expect(applyDecay(1.0, 21)).toBeCloseTo(0.75, 2);
    expect(applyDecay(0.0, 21)).toBeCloseTo(0.25, 2);
    expect(applyDecay(0.9, 100_000)).toBeCloseTo(0.5, 3);
    expect(applyDecay(0.9, 0)).toBe(0.9);
  });

  it('keeps values inside [0,1] under any history', () => {
    for (const n of [1, 5, 50, 200]) {
      for (const correct of [true, false]) {
        const log = Array.from({ length: n }, () => attempt({ correct }));
        const e = estimateMastery('add.within10', log, NOW);
        expect(e.value).toBeGreaterThanOrEqual(0);
        expect(e.value).toBeLessThanOrEqual(1);
        expect(e.confidence).toBeGreaterThanOrEqual(0);
        expect(e.confidence).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('prerequisites and gap finding', () => {
  it('treats an untested prerequisite as non-blocking', () => {
    expect(isReady('add.2digit.carry', {})).toBe(true);
  });

  it('blocks a skill whose prerequisite is weak', () => {
    const est = estimateAll(
      Array.from({ length: 10 }, () => attempt({ skill: 'add.2digit.nocarry', correct: false })),
      NOW,
    );
    expect(isReady('add.2digit.carry', est)).toBe(false);
  });

  it('traces a failure back to its weakest prerequisite', () => {
    const log = [
      ...Array.from({ length: 8 }, () => attempt({ skill: 'frac.equivalence', correct: false })),
      ...Array.from({ length: 8 }, () => attempt({ skill: 'frac.addSameDenom', correct: false })),
    ];
    const est = estimateAll(log, NOW);
    expect(findRootGap('frac.addSameDenom', est)).toBe('frac.equivalence');
  });

  it('reports no gap when prerequisites are secure', () => {
    const est = estimateAll(
      Array.from({ length: 10 }, () => attempt({ skill: 'frac.equivalence', correct: true })),
      NOW,
    );
    expect(findRootGap('frac.addSameDenom', est)).toBeNull();
  });
});

describe('skill graph integrity', () => {
  it('has no dangling prerequisite references', () => {
    for (const id of ALL_SKILL_IDS) {
      for (const p of SKILLS[id].prerequisites) {
        expect(SKILLS[p], `${id} → missing prerequisite ${p}`).toBeDefined();
      }
    }
  });

  it('is acyclic', () => {
    for (const id of ALL_SKILL_IDS) {
      expect(prerequisiteClosure(id), `${id} is in its own prerequisite chain`).not.toContain(id);
    }
  });

  it('resolves a real skill for every reachable class/category/difficulty', () => {
    const classes = ['1st', '2nd', '3rd', '4th', '5th', '6th'] as const;
    const diffs = ['easy', 'medium', 'hard'] as const;
    for (const cls of classes) {
      for (const cat of Object.values(SKILLS).map(s => s.category)) {
        for (const d of diffs) {
          const skill = resolveSkill(cls, cat, d);
          expect(SKILLS[skill], `${cls}/${cat}/${d} → unknown skill ${skill}`).toBeDefined();
        }
      }
    }
  });
});

describe('attempt log', () => {
  it('caps growth and evicts oldest first', () => {
    const many = Array.from({ length: MAX_ATTEMPTS + 500 }, (_, i) =>
      attempt({ answeredAt: NOW + i }));
    const log = appendAttempts([], many);
    expect(log).toHaveLength(MAX_ATTEMPTS);
    expect(log[log.length - 1].answeredAt).toBe(NOW + MAX_ATTEMPTS + 499);
  });

  it('merges two device logs without double-counting', () => {
    const shared = attempt({ answeredAt: NOW });
    const a = [shared, attempt({ answeredAt: NOW + 1 })];
    const b = [shared, attempt({ answeredAt: NOW + 2 })];
    expect(mergeAttempts(a, b)).toHaveLength(3);
  });

  it('merge is commutative', () => {
    const a = [attempt({ answeredAt: NOW }), attempt({ answeredAt: NOW + 5 })];
    const b = [attempt({ answeredAt: NOW + 2 })];
    expect(mergeAttempts(a, b).map(x => x.answeredAt))
      .toEqual(mergeAttempts(b, a).map(x => x.answeredAt));
  });

  it('sums counts across devices instead of maxing them', () => {
    // The legacy bug: Math.max(10, 10) = 10 when the true total is 20.
    const a = Array.from({ length: 10 }, (_, i) => attempt({ answeredAt: NOW + i }));
    const b = Array.from({ length: 10 }, (_, i) => attempt({ answeredAt: NOW + 1000 + i }));
    const stats = deriveLegacyStats(mergeAttempts(a, b));
    expect(stats['1st_addition_easy'].attempted).toBe(20);
  });

  it('never derives accuracy above 100%', () => {
    const log = [
      ...Array.from({ length: 7 }, (_, i) => attempt({ correct: true, answeredAt: NOW + i })),
      ...Array.from({ length: 3 }, (_, i) => attempt({ correct: false, answeredAt: NOW + 100 + i })),
    ];
    const s = deriveLegacyStats(log)['1st_addition_easy'];
    expect(s.correct).toBeLessThanOrEqual(s.attempted);
  });

  it('rejects malformed rows from storage', () => {
    expect(sanitiseLog([attempt(), { bogus: true }, null, 42, 'x'])).toHaveLength(1);
    expect(sanitiseLog('not an array')).toEqual([]);
    expect(sanitiseLog(null)).toEqual([]);
  });
});

describe('streaks', () => {
  const day = (n: number) => NOW - n * DAY_MS;

  it('counts consecutive days ending today', () => {
    const log = [0, 1, 2].map(d => attempt({ answeredAt: day(d) }));
    expect(currentStreak(log, NOW)).toBe(3);
  });

  it('survives not having practised yet today', () => {
    const log = [1, 2, 3].map(d => attempt({ answeredAt: day(d) }));
    expect(currentStreak(log, NOW)).toBe(3);
  });

  it('breaks after two missed days', () => {
    const log = [3, 4, 5].map(d => attempt({ answeredAt: day(d) }));
    expect(currentStreak(log, NOW)).toBe(0);
  });

  it('is zero for an empty log', () => {
    expect(currentStreak([], NOW)).toBe(0);
  });

  it('counts only today for the daily goal', () => {
    const log = [attempt({ answeredAt: NOW }), attempt({ answeredAt: day(1) })];
    expect(todayCount(log, NOW)).toBe(1);
  });

  it('uses local day boundaries', () => {
    expect(dayKey(NOW)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('legacy migration', () => {
  it('preserves accuracy while seeding the log', () => {
    const legacy = { '3rd_multiplication_medium': { attempted: 20, correct: 15 } };
    const out = migrateLegacyStats(legacy, NOW, resolveSkill);
    expect(out.length).toBe(20);
    expect(out.filter(a => a.correct).length).toBe(15);
    expect(out[0].skill).toBe(resolveSkill('3rd', 'multiplication', 'medium'));
  });

  it('marks synthesised rows so they are never used for diagnosis', () => {
    const out = migrateLegacyStats({ '1st_addition_easy': { attempted: 5, correct: 5 } }, NOW, resolveSkill);
    out.forEach(a => expect(a.misconception).toBe('legacy-import'));
  });

  it('dates history in the past so real practice supersedes it', () => {
    const out = migrateLegacyStats({ '1st_addition_easy': { attempted: 5, correct: 5 } }, NOW, resolveSkill);
    out.forEach(a => expect(a.answeredAt).toBeLessThan(NOW));
  });

  it('caps synthesis for very large histories', () => {
    const out = migrateLegacyStats({ '1st_addition_easy': { attempted: 5000, correct: 2500 } }, NOW, resolveSkill);
    expect(out.length).toBeLessThanOrEqual(40);
  });

  it('ignores malformed legacy keys', () => {
    expect(migrateLegacyStats({ 'garbage': { attempted: 5, correct: 5 } }, NOW, resolveSkill)).toEqual([]);
  });
});

describe('spaced repetition', () => {
  it('returns weak skills sooner than strong ones', () => {
    expect(reviewIntervalDays(0.3, 10)).toBeLessThan(reviewIntervalDays(0.75, 10));
    expect(reviewIntervalDays(0.75, 10)).toBeLessThan(reviewIntervalDays(0.95, 20));
  });

  it('treats never-practised skills as immediately due', () => {
    const e = estimateMastery('add.within10', [], NOW);
    expect(isDue(e, NOW)).toBe(true);
  });

  it('does not resurface a freshly mastered skill', () => {
    const log = Array.from({ length: 20 }, (_, i) => attempt({ correct: true, answeredAt: NOW - i * 1000 }));
    const e = estimateMastery('add.within10', log, NOW);
    expect(isDue(e, NOW)).toBe(false);
  });

  it('resurfaces a mastered skill after long enough', () => {
    const log = Array.from({ length: 20 }, (_, i) => attempt({ correct: true, answeredAt: NOW - i * 1000 }));
    const e = estimateMastery('add.within10', log, NOW + 40 * DAY_MS);
    expect(isDue(e, NOW + 40 * DAY_MS)).toBe(true);
  });

  it('scales difficulty with mastery', () => {
    expect(difficultyFor(undefined)).toBe('easy');
    const weak = estimateMastery('add.within10',
      Array.from({ length: 8 }, () => attempt({ correct: false })), NOW);
    expect(difficultyFor(weak)).toBe('easy');
    const strong = estimateMastery('add.within10',
      Array.from({ length: 20 }, (_, i) => attempt({ correct: true, interaction: 'entry', answeredAt: NOW - i * 1000 })), NOW);
    expect(difficultyFor(strong)).toBe('hard');
  });
});

describe('session building', () => {
  it('produces exactly the requested number of items', () => {
    for (const n of [5, 10, 20]) {
      expect(buildSession('3rd', {}, n, NOW)).toHaveLength(n);
    }
  });

  it('prioritises a blocking gap over everything else', () => {
    const log = Array.from({ length: 10 }, () =>
      attempt({ skill: 'mul.tables.mid', correct: false, cls: '4th', category: 'multiplication' }));
    const ranked = scheduleSkills('4th', estimateAll(log, NOW), NOW);
    expect(ranked[0].reason).toBe('gap');
    expect(ranked[0].skill).toBe('mul.tables.mid');
  });

  it('does not serve only the weakest skill', () => {
    const log = Array.from({ length: 10 }, () =>
      attempt({ skill: 'mul.tables.mid', correct: false, cls: '4th', category: 'multiplication' }));
    const session = buildSession('4th', estimateAll(log, NOW), 10, NOW);
    expect(new Set(session.map(s => s.skill)).size).toBeGreaterThan(1);
  });

  it('avoids three identical skills in a row', () => {
    const session = buildSession('3rd', {}, 20, NOW);
    for (let i = 2; i < session.length; i++) {
      const same = session[i].skill === session[i - 1].skill && session[i].skill === session[i - 2].skill;
      expect(same).toBe(false);
    }
  });

  it('only schedules skills that exist', () => {
    for (const cls of ['1st', '2nd', '3rd', '4th', '5th', '6th'] as const) {
      buildSession(cls, {}, 15, NOW).forEach(s => {
        expect(SKILLS[s.skill]).toBeDefined();
      });
    }
  });

  it('never introduces a skill whose prerequisites are known-weak', () => {
    const log = Array.from({ length: 12 }, () =>
      attempt({ skill: 'add.within10', correct: false, cls: '1st' }));
    const est = estimateAll(log, NOW);
    const session = buildSession('1st', est, 12, NOW);
    // add.within20 requires add.within10, which is failing → must not be introduced fresh
    const introduced = session.filter(s => s.skill === 'add.within20' && s.reason === 'new');
    expect(introduced).toHaveLength(0);
  });
});
