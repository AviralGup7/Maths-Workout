// Achievements, parent report and confidence — docs/16 §8, docs/14 §10 and §5C.

import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS, evaluateAchievements, newlyEarned } from '../achievements';
import type { AchievementContext } from '../achievements';
import { buildParentReport, MIN_ATTEMPTS_FOR_REPORT } from '../../learning/parentReport';
import {
  quadrant, confidenceIndexFor, shouldAskConfidence, confidentlyWrongSkills,
  calibration, CONFIDENCE_COPY,
} from '../../learning/confidence';
import { estimateAll, DAY_MS, MASTERED_THRESHOLD } from '../../learning/mastery';
import type { Attempt } from '../../learning/attempts';
import { SKILLS } from '../../learning/skills';
import { hasDevanagariDigits } from '../../i18n/strings';

const NOW = 1_700_000_000_000;

const mk = (skill: string, correct: boolean, at: number, over: Partial<Attempt> = {}): Attempt => ({
  skill, correct, answeredAt: at, latencyMs: 5000,
  chosen: correct ? '1' : '2', expected: '1', questionText: 'q', timedOut: false,
  cls: '4th', category: SKILLS[skill]?.category ?? 'addition', difficulty: 'medium', ...over,
});

const ctxOf = (log: Attempt[]): AchievementContext => ({
  log, estimates: estimateAll(log, NOW), cls: '4th', now: NOW,
});

describe('achievements reward learning, never volume', () => {
  it('has no achievement that can be earned by answering many questions', () => {
    // The archetype the brief rules out: "answer 100 questions" rewards
    // attendance, is trivially farmable, and says nothing about the child.
    const log = Array.from({ length: 500 }, (_, i) =>
      mk('add.within10', true, NOW - (500 - i) * 60_000));
    const states = evaluateAchievements(ctxOf(log));
    const earned = states.filter(s => s.earned).map(s => s.achievement.id);
    // A single-day grind on one skill must not unlock consistency, diversity
    // or depth achievements.
    for (const id of ['fortnight', 'season', 'steady-hand', 'all-rounder',
                      'no-weak-link', 'recall-not-recognition', 'right-sized']) {
      expect(earned, `${id} was farmable`).not.toContain(id);
    }
  });

  it('counts distinct DAYS for consistency, not questions', () => {
    const oneDay = Array.from({ length: 300 }, (_, i) => mk('add.within10', true, NOW - i * 1000));
    const fourteenDays = Array.from({ length: 14 }, (_, d) =>
      Array.from({ length: 6 }, (_, i) => mk('add.within10', true, NOW - d * DAY_MS - i * 1000))).flat();

    const grind = evaluateAchievements(ctxOf(oneDay))
      .find(s => s.achievement.id === 'fortnight')!;
    const spread = evaluateAchievements(ctxOf(fourteenDays))
      .find(s => s.achievement.id === 'fortnight')!;

    expect(grind.earned).toBe(false);
    expect(spread.earned).toBe(true);
  });

  it('rewards not bingeing', () => {
    // "Right Sized" counts days of sensible practice — a 200-question day is
    // explicitly excluded.
    const binge = Array.from({ length: 20 }, (_, d) =>
      Array.from({ length: 200 }, (_, i) => mk('add.within10', true, NOW - d * DAY_MS - i * 1000))).flat();
    const steady = Array.from({ length: 20 }, (_, d) =>
      Array.from({ length: 15 }, (_, i) => mk('add.within10', true, NOW - d * DAY_MS - i * 1000))).flat();

    expect(evaluateAchievements(ctxOf(binge)).find(s => s.achievement.id === 'right-sized')!.earned)
      .toBe(false);
    expect(evaluateAchievements(ctxOf(steady)).find(s => s.achievement.id === 'right-sized')!.earned)
      .toBe(true);
  });

  it('requires produced evidence for the memory achievement', () => {
    // Recognition is not recall: mastering by choosing from four tiles must not
    // unlock "From Memory".
    const byChoice = Array.from({ length: 200 }, (_, i) =>
      mk(['add.within10', 'add.within20', 'sub.within10'][i % 3], true, NOW - i * 60_000,
        { interaction: 'choice' }));
    expect(evaluateAchievements(ctxOf(byChoice))
      .find(s => s.achievement.id === 'recall-not-recognition')!.progress).toBe(0);
  });

  it('rewards turning a weak skill around', () => {
    const log = [
      ...Array.from({ length: 8 }, (_, i) => mk('mul.tables.mid', i < 2, NOW - (40 - i) * DAY_MS)),
      ...Array.from({ length: 14 }, (_, i) =>
        mk('mul.tables.mid', true, NOW - (10 - i * 0.5) * DAY_MS, { interaction: 'entry' })),
    ];
    expect(evaluateAchievements(ctxOf(log))
      .find(s => s.achievement.id === 'turned-it-around')!.earned).toBe(true);
  });

  it('reports progress between 0 and 1 for every achievement, on any input', () => {
    for (const log of [[], [mk('add.within10', true, NOW)], Array.from({ length: 50 },
      (_, i) => mk('add.within10', i % 2 === 0, NOW - i * DAY_MS))]) {
      for (const s of evaluateAchievements(ctxOf(log))) {
        expect(s.progress, s.achievement.id).toBeGreaterThanOrEqual(0);
        expect(s.progress, s.achievement.id).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is described in both languages, following the semi-Hindi policy', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.title.en.length).toBeGreaterThan(2);
      expect(a.title.hi.length).toBeGreaterThan(2);
      expect(a.description.en.length).toBeGreaterThan(10);
      expect(hasDevanagariDigits(a.title.hi), a.id).toBe(false);
      expect(hasDevanagariDigits(a.description.hi), a.id).toBe(false);
    }
  });

  it('covers all six categories', () => {
    const cats = new Set(ACHIEVEMENTS.map(a => a.category));
    expect([...cats].sort()).toEqual(
      ['consistency', 'depth', 'diversity', 'habits', 'mastery', 'overcoming']);
  });

  it('detects newly earned achievements against a snapshot', () => {
    const log = Array.from({ length: 14 }, (_, d) =>
      Array.from({ length: 6 }, (_, i) => mk('add.within10', true, NOW - d * DAY_MS - i * 1000))).flat();
    const after = evaluateAchievements(ctxOf(log));
    expect(newlyEarned({}, after).map(s => s.achievement.id)).toContain('fortnight');
    expect(newlyEarned({ fortnight: true }, after).map(s => s.achievement.id))
      .not.toContain('fortnight');
  });
});

describe('the parent report gives an action, not a dashboard', () => {
  const log = [
    ...Array.from({ length: 30 }, (_, i) =>
      mk('sub.2digit.borrow', i % 3 === 0, NOW - (6 - (i % 6)) * DAY_MS - i * 60_000,
        { misconception: i % 3 === 0 ? undefined : 'sub.smaller-from-larger' })),
    ...Array.from({ length: 20 }, (_, i) =>
      mk('add.within10', true, NOW - (5 - (i % 5)) * DAY_MS - i * 60_000, { interaction: 'entry' })),
  ];

  it('names one misconception and one concrete activity', () => {
    const r = buildParentReport({ log, estimates: estimateAll(log, NOW), lang: 'en', now: NOW });
    expect(r.focus).not.toBeNull();
    expect(r.focus!.misconceptionId).toBe('sub.smaller-from-larger');
    // The activity must be something a parent can actually do at a table.
    expect(r.focus!.tryThis.length).toBeGreaterThan(30);
  });

  it('reports days, not minutes, as the practice measure', () => {
    const r = buildParentReport({ log, estimates: estimateAll(log, NOW), lang: 'en', now: NOW });
    expect(r.daysPractised).toBeGreaterThan(0);
    expect(r.daysInWindow).toBe(7);
  });

  it('refuses to characterise a learner on too little evidence', () => {
    // Parents act on what they are told; saying something definite from five
    // questions would be worse than saying nothing.
    const thin = [mk('add.within10', true, NOW)];
    const r = buildParentReport({ log: thin, estimates: estimateAll(thin, NOW), lang: 'en', now: NOW });
    expect(r.insufficientData).toBe(true);
  });

  it('caps per-question time so an idle app does not inflate the total', () => {
    const idle = [mk('add.within10', true, NOW, { latencyMs: 3_600_000 })];
    const r = buildParentReport({ log: idle, estimates: estimateAll(idle, NOW), lang: 'en', now: NOW });
    expect(r.minutes).toBeLessThanOrEqual(1);
  });

  it('works in Hindi', () => {
    const r = buildParentReport({ log, estimates: estimateAll(log, NOW), lang: 'hi', now: NOW });
    expect(r.focus).not.toBeNull();
    expect(hasDevanagariDigits(r.focus!.tryThis)).toBe(false);
  });
});

describe('confidence rating', () => {
  it('identifies the four quadrants', () => {
    expect(quadrant('sure', false)).toBe('confident-wrong');
    expect(quadrant('sure', true)).toBe('confident-correct');
    expect(quadrant('unsure', true)).toBe('unsure-correct');
    expect(quadrant('unsure', false)).toBe('unsure-wrong');
  });

  it('asks once per session, in the middle', () => {
    expect(shouldAskConfidence(5, 10)).toBe(true);
    const asked = Array.from({ length: 10 }, (_, i) => shouldAskConfidence(i, 10));
    expect(asked.filter(Boolean).length).toBe(1);
  });

  it('does not interrupt a very short session', () => {
    expect(confidenceIndexFor(3)).toBe(-1);
  });

  it('flags confidently-wrong skills for priority remediation', () => {
    // The highest-value diagnostic state: the child has no reason to revise.
    const flags = confidentlyWrongSkills([
      { skill: 'mul.tables.mid', confidence: 'sure', correct: false, at: NOW },
      { skill: 'mul.tables.mid', confidence: 'sure', correct: false, at: NOW + 1000 },
      { skill: 'add.within10', confidence: 'unsure', correct: false, at: NOW },
      { skill: 'div.basic', confidence: 'sure', correct: true, at: NOW },
    ]);
    expect(flags.map(f => f.skill)).toEqual(['mul.tables.mid']);
    expect(flags[0].occurrences).toBe(2);
  });

  it('measures calibration only with enough evidence', () => {
    expect(calibration([{ confidence: 'sure', correct: true }])).toBeNull();
    const wellCalibrated = [
      ...Array.from({ length: 5 }, () => ({ confidence: 'sure' as const, correct: true })),
      ...Array.from({ length: 5 }, () => ({ confidence: 'unsure' as const, correct: false })),
    ];
    expect(calibration(wellCalibrated)!).toBeLessThan(0);
  });

  it('has copy in both languages', () => {
    for (const entry of Object.values(CONFIDENCE_COPY)) {
      expect(entry.en.length).toBeGreaterThan(2);
      expect(entry.hi.length).toBeGreaterThan(2);
      expect(hasDevanagariDigits(entry.hi)).toBe(false);
    }
  });
});
