// Storage manifest and validators — docs/19 R1.
//
// The failure mode these guard against is silent: JSON.parse succeeds, the
// shape is wrong, and the engine misbehaves in ways that look like bugs
// somewhere else entirely. A corrupt XP ledger would mis-price every future
// answer without ever throwing.

import { describe, it, expect } from 'vitest';
import {
  KEYS, MANIFEST_VERSION,
  isXpLedger, isNumberMap, isStatMap, isWrongAnswerList,
} from '../storage';

describe('the manifest covers every persisted key', () => {
  it('declares a unique storage key for each entry', () => {
    const values = Object.values(KEYS);
    expect(new Set(values).size, 'duplicate storage keys').toBe(values.length);
  });

  it('namespaces every key, so nothing collides with another app', () => {
    for (const [name, key] of Object.entries(KEYS)) {
      expect(key.startsWith('@maths_workout'), `${name} is not namespaced`).toBe(true);
    }
  });

  it('has a monotonic version', () => {
    expect(MANIFEST_VERSION).toBeGreaterThanOrEqual(4);
    expect(Number.isInteger(MANIFEST_VERSION)).toBe(true);
  });
});

describe('the XP ledger validator', () => {
  it('accepts a well-formed ledger', () => {
    expect(isXpLedger({ 'add.within10': 0.85, 'sub.within10': 0 })).toBe(true);
    expect(isXpLedger({})).toBe(true);
  });

  it('rejects values outside the mastery range', () => {
    // A high-water mark above 1 would permanently suppress payout for a skill;
    // below 0 would pay repeatedly for the same climb.
    expect(isXpLedger({ 'add.within10': 1.5 })).toBe(false);
    expect(isXpLedger({ 'add.within10': -0.2 })).toBe(false);
  });

  it('rejects NaN, which JSON.parse can produce from a partial write', () => {
    expect(isXpLedger({ 'add.within10': NaN })).toBe(false);
  });

  it('rejects the wrong container type', () => {
    expect(isXpLedger([])).toBe(false);
    expect(isXpLedger(null)).toBe(false);
    expect(isXpLedger('0.5')).toBe(false);
  });
});

describe('the stats validator', () => {
  it('accepts a well-formed cell', () => {
    expect(isStatMap({ '4th_addition_easy': { attempted: 10, correct: 7 } })).toBe(true);
  });

  it('rejects more correct than attempted', () => {
    // This is not hypothetical: the legacy Math.max merge across devices could
    // produce it, and every downstream view would then show accuracy > 100%.
    expect(isStatMap({ '4th_addition_easy': { attempted: 5, correct: 9 } })).toBe(false);
  });

  it('rejects missing fields', () => {
    expect(isStatMap({ k: { attempted: 5 } })).toBe(false);
    expect(isStatMap({ k: null })).toBe(false);
  });
});

describe('the remaining validators', () => {
  it('checks number maps', () => {
    expect(isNumberMap({ a: 1, b: 2 })).toBe(true);
    expect(isNumberMap({ a: 'x' })).toBe(false);
    expect(isNumberMap({ a: Infinity })).toBe(false);
  });

  it('checks saved mistakes', () => {
    expect(isWrongAnswerList([{ display: 'q', userAnswer: '1', correctAnswer: '2' }])).toBe(true);
    expect(isWrongAnswerList([{ display: 'q' }])).toBe(false);
    expect(isWrongAnswerList({})).toBe(false);
  });

  it('accepts empty collections — a fresh install is not corrupt', () => {
    expect(isNumberMap({})).toBe(true);
    expect(isStatMap({})).toBe(true);
    expect(isWrongAnswerList([])).toBe(true);
  });
});
