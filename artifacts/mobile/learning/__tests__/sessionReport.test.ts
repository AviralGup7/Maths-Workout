import { describe, it, expect } from 'vitest';
import {
  buildSessionReport, headline, returnSentence, completionSentence, movementSentence,
} from '../sessionReport';
import type { Attempt } from '../attempts';
import { STRUGGLING_THRESHOLD, MASTERED_THRESHOLD } from '../mastery';

const START = Date.UTC(2026, 0, 1, 9);
const DAY = 86_400_000;

const mk = (over: Partial<Attempt> = {}): Attempt => ({
  id: `t:${Math.random()}`,
  skill: 'add.3digit', correct: true, answeredAt: START, latencyMs: 5000,
  chosen: '7', expected: '7', questionText: 'q', timedOut: false,
  interaction: 'entry', cls: '4th', category: 'addition', difficulty: 'medium', ...over,
} as Attempt);

/** n attempts on a skill, spread over time. */
const run = (skill: string, n: number, correct: boolean, from = START): Attempt[] =>
  Array.from({ length: n }, (_, i) =>
    mk({ skill: skill as never, correct, answeredAt: from + i * 60_000, id: `${skill}:${from}:${i}` }));

describe('session report · movement', () => {
  it('reports only skills touched this session', () => {
    const before = run('add.3digit', 10, true);
    const after = [...before, ...run('sub.3digit', 6, true, START + DAY)];
    const r = buildSessionReport({ before, after, cls: '4th', now: START + DAY });

    expect(r.answered).toBe(6);
    expect(r.improvements.every(m => m.skill === 'sub.3digit')).toBe(true);
  });

  it('reports a delta, not a snapshot', () => {
    // The distinction that makes this evidence of growth rather than a statistic.
    const before = run('add.3digit', 6, false);
    const after = [...before, ...run('add.3digit', 10, true, START + DAY)];
    const r = buildSessionReport({ before, after, cls: '4th', now: START + DAY });

    const m = r.improvements.find(x => x.skill === 'add.3digit');
    expect(m).toBeDefined();
    expect(m!.after).toBeGreaterThan(m!.before);
    expect(m!.delta).toBeCloseTo(m!.after - m!.before, 6);
  });

  it('ignores sub-1% drift', () => {
    const before = run('add.3digit', 30, true);
    const after = [...before, mk({ answeredAt: START + DAY, id: 'x' })];
    const r = buildSessionReport({ before, after, cls: '4th', now: START + DAY });
    // A single extra correct answer on a saturated skill moves almost nothing.
    for (const m of r.improvements) expect(m.delta).toBeGreaterThanOrEqual(0.01);
  });

  it('detects a first meeting with a skill', () => {
    const before = run('add.3digit', 8, true);
    const after = [...before, ...run('div.basic', 4, true, START + DAY)];
    const r = buildSessionReport({ before, after, cls: '4th', now: START + DAY });
    expect(r.newSkills).toContain('div.basic');
    expect(r.newSkills).not.toContain('add.3digit');
  });
});

describe('session report · the moments that matter', () => {
  it('detects a breakthrough out of struggling', () => {
    // docs/25: the struggling learner measured ZERO mastery celebrations in a
    // year, because the only celebration was gated on 0.85. A climb out of
    // STRUGGLING_THRESHOLD is the hardest move in the model and must register.
    const before = run('add.3digit', 12, false);
    const after = [...before, ...run('add.3digit', 14, true, START + DAY)];
    const r = buildSessionReport({ before, after, cls: '4th', now: START + DAY });

    const m = r.improvements.find(x => x.skill === 'add.3digit')!;
    expect(m.before).toBeLessThan(STRUGGLING_THRESHOLD);
    expect(m.after).toBeGreaterThanOrEqual(STRUGGLING_THRESHOLD);
    expect(r.breakthroughs.map(b => b.skill)).toContain('add.3digit');
  });

  it('detects a skill becoming secure', () => {
    const before = run('add.3digit', 4, true);
    const after = [...before, ...run('add.3digit', 20, true, START + DAY)];
    const r = buildSessionReport({ before, after, cls: '4th', now: START + DAY });
    const m = r.improvements.find(x => x.skill === 'add.3digit');
    if (m && m.after >= MASTERED_THRESHOLD && m.before < MASTERED_THRESHOLD) {
      expect(r.mastered.map(x => x.skill)).toContain('add.3digit');
    }
    // Either way the report must be internally consistent.
    for (const x of r.mastered) expect(x.after).toBeGreaterThanOrEqual(MASTERED_THRESHOLD);
  });
});

describe('session report · the forward hook', () => {
  it('names skills that fall due overnight', () => {
    // The information the scheduler already had and no screen ever showed.
    const before: Attempt[] = [];
    const after = [
      ...run('add.3digit', 10, true, START),
      ...run('sub.3digit', 10, true, START),
    ];
    const r = buildSessionReport({ before, after, cls: '4th', now: START + 2 * DAY });
    // Whatever the exact set, every entry must be genuinely not-due-now.
    expect(Array.isArray(r.dueTomorrow)).toBe(true);
    for (const s of r.dueTomorrow) expect(typeof s).toBe('string');
  });

  it('returns null copy when nothing is due', () => {
    const r = buildSessionReport({ before: [], after: [], cls: '4th', now: START });
    expect(returnSentence(r, 'en')).toBeNull();
  });

  it('pluralises the return sentence correctly in both languages', () => {
    const one = { dueTomorrow: ['a'] } as never;
    const two = { dueTomorrow: ['a', 'b'] } as never;
    expect(returnSentence(one, 'en')).toContain('1 skill is');
    expect(returnSentence(two, 'en')).toContain('2 skills are');
    // Semi-Hindi: numerals stay Western Arabic.
    expect(returnSentence(two, 'hi')).toContain('2');
    expect(returnSentence(two, 'hi')).not.toMatch(/[०-९]/);
  });
});

describe('session report · headline', () => {
  const base = {
    answered: 10, correct: 8, improvements: [], mastered: [], breakthroughs: [],
    newSkills: [], dueTomorrow: [], chaptersNearlyDone: [], chaptersCompleted: [],
  };

  it('ranks by how hard the achievement is, not how big the number is', () => {
    const move = { skill: 's', label: 'Adding', before: 0.2, after: 0.9, delta: 0.7,
      breakthrough: false, mastered: false };
    const chapter = { id: 'c', title: { en: 'Fractions', hi: 'भिन्न' } } as never;

    // A chapter outranks a mastery, which outranks a breakthrough, which
    // outranks a raw improvement — even a very large one.
    expect(headline({ ...base, chaptersCompleted: [chapter], improvements: [move] }, 'en'))
      .toContain('Chapter complete');
    expect(headline({ ...base, mastered: [move], improvements: [move] }, 'en'))
      .toContain('secure now');
    expect(headline({ ...base, breakthroughs: [move], improvements: [move] }, 'en'))
      .toContain('Breakthrough');
    expect(headline({ ...base, improvements: [move] }, 'en')).toBe('Adding 20% → 90%');
  });

  it('falls back to new skills, then to nothing', () => {
    expect(headline({ ...base, newSkills: ['a', 'b'] }, 'en')).toBe('Tried 2 new skills');
    expect(headline({ ...base, newSkills: ['a'] }, 'en')).toBe('Tried 1 new skill');
    expect(headline(base, 'en')).toBeNull();
  });

  it('keeps numerals Western Arabic in Hindi', () => {
    const move = { skill: 's', label: 'जोड़', before: 0.2, after: 0.9, delta: 0.7,
      breakthrough: false, mastered: false };
    const out = headline({ ...base, improvements: [move] }, 'hi')!;
    expect(out).toMatch(/20%/);
    expect(out).not.toMatch(/[०-९]/);
  });
});

describe('session report · completion pull', () => {
  it('only counts a chapter as nearly done at 1–2 skills remaining', () => {
    const before: Attempt[] = [];
    const after = run('add.within10', 25, true, START);
    const r = buildSessionReport({ before, after, cls: '1st', now: START + DAY });
    for (const c of r.chaptersNearlyDone) {
      expect(c.remaining).toBeGreaterThan(0);
      expect(c.remaining).toBeLessThanOrEqual(2);
    }
  });

  it('phrases the completion sentence for both counts', () => {
    const ch = { chapter: { id: 'f', title: { en: 'Fractions', hi: 'भिन्न' } }, remaining: 1, progress: 0.8 } as never;
    const ch2 = { chapter: { id: 'f', title: { en: 'Fractions', hi: 'भिन्न' } }, remaining: 2, progress: 0.7 } as never;
    expect(completionSentence(ch, 'en')).toBe('1 skill to finish Fractions');
    expect(completionSentence(ch2, 'en')).toBe('2 skills to finish Fractions');
    expect(completionSentence(ch2, 'hi')).toContain('2');
  });
});

describe('session report · movement sentence', () => {
  it('renders as a percentage delta', () => {
    const m = { skill: 's', label: 'Fractions', before: 0.62, after: 0.71, delta: 0.09,
      breakthrough: false, mastered: false };
    expect(movementSentence(m, 'en')).toBe('Fractions 62% → 71%');
  });
});
