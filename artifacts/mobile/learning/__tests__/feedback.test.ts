// Tests for §9 M1/M2/M3 — timer policy, growth trend, process praise.

import { describe, it, expect } from 'vitest';
import type { Attempt } from '../attempts';
import { DAY_MS } from '../mastery';
import {
  biggestGain, growthSentence, praiseFor, praiseText, PRAISE,
  MIN_GROWTH_EVIDENCE, MIN_GROWTH_DELTA,
} from '../feedback';
import { timerEnabled, timerEnabledForSession, TIMER_DEFAULT_FROM_CLASS } from '../timerPolicy';
import { hasDevanagariDigits } from '../../i18n/strings';

const NOW = 1_700_000_000_000;

function mk(skill: string, correct: boolean, daysAgo: number): Attempt {
  return {
    skill, correct, answeredAt: NOW - daysAgo * DAY_MS, latencyMs: 4000,
    chosen: '1', expected: '1', questionText: 'q', timedOut: false,
    cls: '4th', category: 'addition', difficulty: 'medium',
  };
}

// ─── M1 · Timer policy ───────────────────────────────────────────────────────

describe('M1 · timer policy', () => {
  it('defaults off for Classes 1 and 2', () => {
    expect(timerEnabled('auto', '1st')).toBe(false);
    expect(timerEnabled('auto', '2nd')).toBe(false);
  });

  it('defaults on from Class 3', () => {
    for (const c of ['3rd', '4th', '5th', '6th'] as const) {
      expect(timerEnabled('auto', c)).toBe(true);
    }
  });

  it('lets an explicit preference override the age default in both directions', () => {
    expect(timerEnabled('on', '1st')).toBe(true);    // a child who wants to race
    expect(timerEnabled('off', '6th')).toBe(false);  // an anxious older learner
  });

  it('keeps the clock in Blitz whatever the preference', () => {
    // Blitz is a challenge the child chose; without the clock it is not a mode.
    expect(timerEnabledForSession('off', '1st', true)).toBe(true);
  });

  it('does not time ordinary practice for a Class 1 learner', () => {
    expect(timerEnabledForSession('auto', '1st', false)).toBe(false);
  });

  it('documents its own threshold', () => {
    expect(TIMER_DEFAULT_FROM_CLASS).toBe(3);
  });
});

// ─── M2 · Growth trend ───────────────────────────────────────────────────────

describe('M2 · growth trend', () => {
  it('reports a genuine improvement', () => {
    const log: Attempt[] = [];
    for (let i = 0; i < 10; i++) log.push(mk('add.3digit', i < 3, 12));  // 30% early
    for (let i = 0; i < 10; i++) log.push(mk('add.3digit', i < 8, 2));   // 80% late
    const g = biggestGain(log, NOW);
    expect(g).not.toBeNull();
    expect(g!.skill).toBe('add.3digit');
    expect(g!.before).toBeCloseTo(0.3, 5);
    expect(g!.after).toBeCloseTo(0.8, 5);
  });

  it('stays silent without enough evidence in both halves', () => {
    const log: Attempt[] = [];
    for (let i = 0; i < 2; i++) log.push(mk('add.3digit', false, 12));
    for (let i = 0; i < 10; i++) log.push(mk('add.3digit', true, 2));
    expect(biggestGain(log, NOW)).toBeNull();
  });

  it('stays silent when the change is noise', () => {
    const log: Attempt[] = [];
    for (let i = 0; i < 10; i++) log.push(mk('add.3digit', i < 5, 12));
    for (let i = 0; i < 10; i++) log.push(mk('add.3digit', i < 5, 2));
    expect(biggestGain(log, NOW)).toBeNull();
  });

  it('reports nothing for a learner who is declining', () => {
    const log: Attempt[] = [];
    for (let i = 0; i < 10; i++) log.push(mk('add.3digit', i < 9, 12));
    for (let i = 0; i < 10; i++) log.push(mk('add.3digit', i < 2, 2));
    expect(biggestGain(log, NOW)).toBeNull();
  });

  it('ignores synthesised legacy rows', () => {
    const log: Attempt[] = [];
    for (let i = 0; i < 10; i++) log.push({ ...mk('add.3digit', false, 12), misconception: 'legacy-import' });
    for (let i = 0; i < 10; i++) log.push({ ...mk('add.3digit', true, 2), misconception: 'legacy-import' });
    expect(biggestGain(log, NOW)).toBeNull();
  });

  it('picks the largest gain when several skills improved', () => {
    const log: Attempt[] = [];
    for (let i = 0; i < 10; i++) log.push(mk('add.3digit', i < 5, 12));
    for (let i = 0; i < 10; i++) log.push(mk('add.3digit', i < 7, 2));   // +20
    for (let i = 0; i < 10; i++) log.push(mk('sub.3digit', i < 2, 12));
    for (let i = 0; i < 10; i++) log.push(mk('sub.3digit', i < 9, 2));   // +70
    expect(biggestGain(log, NOW)!.skill).toBe('sub.3digit');
  });

  it('renders the sentence with Western Arabic numerals in Hindi', () => {
    const log: Attempt[] = [];
    for (let i = 0; i < 10; i++) log.push(mk('add.3digit', i < 3, 12));
    for (let i = 0; i < 10; i++) log.push(mk('add.3digit', i < 8, 2));
    const g = biggestGain(log, NOW)!;
    const hi = growthSentence(g, 'hi');
    // Semi-Hindi policy: digits never become Devanagari.
    expect(hasDevanagariDigits(hi)).toBe(false);
    expect(hi).toContain('30%');
    expect(hi).toContain('80%');
    expect(growthSentence(g, 'en')).toContain('this fortnight');
  });
});

// ─── M3 · Process praise ─────────────────────────────────────────────────────

describe('M3 · process praise', () => {
  it('names recovery above everything else', () => {
    expect(praiseFor({ mastery: 0.9, latencyMs: 1000, afterMistake: true })).toBe('recovery');
  });

  it('names persistence for a slow, correct answer', () => {
    expect(praiseFor({ mastery: 0.6, latencyMs: 9000, afterMistake: false })).toBe('persistence');
  });

  it('names effort on a skill still being built', () => {
    expect(praiseFor({ mastery: 0.3, latencyMs: 4000, afterMistake: false })).toBe('effort');
  });

  it('names fluency only when fast on a secure skill', () => {
    expect(praiseFor({ mastery: 0.9, latencyMs: 2000, afterMistake: false })).toBe('fluency');
    expect(praiseFor({ mastery: 0.6, latencyMs: 2000, afterMistake: false })).toBe('plain');
  });

  it('does not call a scaffolded success fluency', () => {
    expect(praiseFor({ mastery: 0.9, latencyMs: 2000, afterMistake: false, scaffolded: true }))
      .toBe('effort');
  });

  it('praises the process, never the child', () => {
    // Trait praise ("clever", "genius") produces fixed-mindset attribution.
    const banned = /clever|genius|smart|brilliant|तेज़ दिमाग|होशियार/i;
    for (const entry of Object.values(PRAISE)) {
      expect(entry.en).not.toMatch(banned);
      expect(entry.hi).not.toMatch(banned);
    }
  });

  it('has Hindi copy for every praise kind, free of Devanagari digits', () => {
    for (const kind of Object.keys(PRAISE) as (keyof typeof PRAISE)[]) {
      const hi = praiseText(kind, 'hi');
      expect(hi.length).toBeGreaterThan(0);
      expect(hasDevanagariDigits(hi)).toBe(false);
    }
  });
});
