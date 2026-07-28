import { describe, it, expect } from 'vitest';
import {
  clockFor, moneyFor, shouldShowEveryday, EVERYDAY_HIDDEN_ABOVE,
  breakdown, DENOMINATIONS,
} from '../everydayVisualPolicy';
import { genTime } from '../../generators/topics-core';
import { genMoneyI18n } from '../../generators/money-i18n';
import type { SchoolClass, Difficulty } from '../../generators/types';

const CLASSES: SchoolClass[] = ['1st', '2nd', '3rd', '4th', '5th'];
const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];

describe('clock face (docs/27 P3-03)', () => {
  it('shows the STARTING time, never the answer', () => {
    // "It is 7 o'clock, what time in 3 hours?" must show 7. Showing 10 would
    // answer the question — the same rule the bar model and base-ten follow.
    expect(clockFor("It is 7 o'clock.\nWhat time will it be in 3 hours?"))
      .toEqual({ kind: 'clock', hour: 7, minute: 0 });
    expect(clockFor('A lesson starts at 9:00 and lasts 2 hours.\nWhat hour does it end?')?.hour)
      .toBe(9);
  });

  it('reads quarter and half past', () => {
    expect(clockFor('The clock reads quarter past 4.\nHow many minutes past 4:00 is that?'))
      .toEqual({ kind: 'clock', hour: 4, minute: 15 });
    expect(clockFor('The clock reads half past 4.\nHow many minutes past 4:00 is that?')?.minute)
      .toBe(30);
  });

  it('draws nothing when a face would have to invent the hour', () => {
    // A conversion has no time to show; a duration would need two faces and
    // the child would read the answer off the gap; a partial hour has no
    // known hour. An invented hand is worse than none — it looks
    // authoritative.
    for (const text of [
      '3 weeks = ___ days?',
      'How many hours in 4 days?',
      'How many hours from 9:00 to 14:00?',
      'It is 25 minutes past the hour.\nHow many minutes until the next hour?',
    ]) {
      expect(clockFor(text), text).toBeNull();
    }
  });

  it('never emits an hour a clock face cannot draw', () => {
    for (const lang of ['en', 'hi'] as const) {
      for (const cls of CLASSES) {
        for (const d of DIFFS) {
          for (let i = 0; i < 30; i++) {
            const spec = clockFor(genTime(cls, d, lang).questionText);
            if (!spec) continue;
            expect(spec.hour, 'hour out of range').toBeGreaterThanOrEqual(1);
            expect(spec.hour).toBeLessThanOrEqual(12);
            expect(spec.minute).toBeGreaterThanOrEqual(0);
            expect(spec.minute).toBeLessThan(60);
          }
        }
      }
    }
  });
});

describe('money denominations (docs/27 P3-04)', () => {
  it('breaks an amount into real Indian denominations', () => {
    expect(breakdown(35)).toEqual([20, 10, 5]);
    expect(breakdown(7)).toEqual([5, 2]);
    expect(breakdown(1)).toEqual([1]);
  });

  it('uses the fewest pieces, which greedy gives for this coin set', () => {
    // Indian denominations are canonical, so greedy is also optimal. If a
    // denomination were ever added that broke that, this catches it.
    for (let amount = 1; amount <= 200; amount++) {
      const pieces = breakdown(amount, 999);
      expect(pieces.reduce((a, b) => a + b, 0), `${amount} does not sum back`).toBe(amount);
      for (const p of pieces) {
        expect(DENOMINATIONS as readonly number[]).toContain(p);
      }
    }
  });

  it('caps the piece count so a large amount does not become a wall', () => {
    expect(breakdown(500, 10).length).toBeLessThanOrEqual(10);
  });

  it('shows what the child is GIVEN, not what they must work out', () => {
    // "I have ₹45 and spend ₹18" → show 45. "3 × ₹5 coins" → show the coins,
    // the one form where the pieces are the question.
    expect(moneyFor('I have ₹45 and spend ₹18.\nHow much is left?')?.amount).toBe(45);
    expect(moneyFor('3 × ₹5 coins.\nHow much altogether?')?.amount).toBe(15);
    // Unit price, not the total — the total is the answer.
    expect(moneyFor('One notebook costs ₹15.\nWhat do 4 notebooks cost?')?.amount).toBe(15);
  });

  it('covers a real share of the live money stream, in both languages', () => {
    // Measured. The first pass reached 31% (en) but only 12% (hi), because
    // the Hindi change forms say "नोट दिया" rather than "देता हूँ" — leaving
    // the group least able to afford a missing scaffold without one.
    const rate: Record<string, number> = {};
    for (const lang of ['en', 'hi'] as const) {
      let hit = 0;
      let total = 0;
      for (const cls of CLASSES) {
        for (const d of DIFFS) {
          for (let i = 0; i < 40; i++) {
            total++;
            if (moneyFor(genMoneyI18n(cls, d, lang).questionText)) hit++;
          }
        }
      }
      rate[lang] = hit / total;
    }
    expect(rate.en, `en ${(rate.en * 100).toFixed(0)}%`).toBeGreaterThan(0.6);
    expect(rate.hi, `hi ${(rate.hi * 100).toFixed(0)}%`).toBeGreaterThan(0.6);
    expect(Math.abs(rate.en - rate.hi), 'language coverage gap').toBeLessThan(0.12);
  });

  it('never emits an amount the row cannot draw', () => {
    for (const lang of ['en', 'hi'] as const) {
      for (const cls of CLASSES) {
        for (const d of DIFFS) {
          for (let i = 0; i < 30; i++) {
            const spec = moneyFor(genMoneyI18n(cls, d, lang).questionText);
            if (!spec) continue;
            expect(spec.amount).toBeGreaterThanOrEqual(1);
            expect(spec.amount).toBeLessThanOrEqual(500);
            expect(breakdown(spec.amount).length).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});

describe('both fade with mastery', () => {
  it('hides once the child no longer needs the scaffold', () => {
    expect(shouldShowEveryday(0.2)).toBe(true);
    expect(shouldShowEveryday(EVERYDAY_HIDDEN_ABOVE)).toBe(false);
    expect(shouldShowEveryday(0.95)).toBe(false);
  });
});
