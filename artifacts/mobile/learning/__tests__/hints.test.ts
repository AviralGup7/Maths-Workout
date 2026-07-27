// Scaffolding hint hierarchy — docs/14 §4.
//
// The properties that matter here are the ones that stop scaffolding becoming
// dependence: hints must never contain the answer, must fade with competence,
// and must give way to prerequisite repair when they stop working.

import { describe, it, expect } from 'vitest';
import {
  hintLevelFor, hintDelays, hintText, hintsFor, HINTS, HINTED_SKILLS,
  hintUsageFor, needsDescentNotHints, HEAVY_HINT_THRESHOLD,
} from '../hints';
import { SKILLS, ALL_SKILL_IDS } from '../skills';
import type { Attempt } from '../attempts';
import { hasDevanagariDigits } from '../../i18n/strings';

const NOW = 1_700_000_000_000;
const mk = (skill: string, scaffolded: boolean, i: number): Attempt => ({
  skill, correct: true, answeredAt: NOW + i * 1000, latencyMs: 5000,
  chosen: '1', expected: '1', questionText: 'q', timedOut: false,
  scaffolded: scaffolded || undefined,
  cls: '4th', category: SKILLS[skill].category, difficulty: 'medium',
});

describe('hints are earned by time, not requested', () => {
  const struggling = { mastery: 0.3, wrongAttempts: 0, hasCopy: true };

  it('shows nothing for the first 20 seconds', () => {
    expect(hintLevelFor({ ...struggling, elapsedSeconds: 5 })).toBe(0);
    expect(hintLevelFor({ ...struggling, elapsedSeconds: 19 })).toBe(0);
  });

  it('escalates through the three levels on the clock', () => {
    expect(hintLevelFor({ ...struggling, elapsedSeconds: 20 })).toBe(1);
    expect(hintLevelFor({ ...struggling, elapsedSeconds: 40 })).toBe(2);
    expect(hintLevelFor({ ...struggling, elapsedSeconds: 60 })).toBe(3);
  });

  it('escalates on wrong attempts without waiting out the clock', () => {
    // A child who has already tried twice has shown need more clearly than one
    // who paused; making them wait as well would be perverse.
    expect(hintLevelFor({ ...struggling, elapsedSeconds: 0, wrongAttempts: 1 })).toBe(2);
    expect(hintLevelFor({ ...struggling, elapsedSeconds: 0, wrongAttempts: 2 })).toBe(3);
  });
});

describe('hints fade as competence grows', () => {
  it('waits longer for a mid-band learner', () => {
    const mid = { mastery: 0.65, wrongAttempts: 0, hasCopy: true };
    expect(hintLevelFor({ ...mid, elapsedSeconds: 20 })).toBe(0);
    expect(hintLevelFor({ ...mid, elapsedSeconds: 35 })).toBe(1);
    expect(hintLevelFor({ ...mid, elapsedSeconds: 70 })).toBe(2);
  });

  it('never reaches the directed level for a mid-band learner', () => {
    // At that mastery they can get there themselves; a directed hint would
    // short-circuit the struggle doing the work.
    const mid = { mastery: 0.65, hasCopy: true };
    expect(hintLevelFor({ ...mid, elapsedSeconds: 600, wrongAttempts: 0 })).toBe(2);
    expect(hintLevelFor({ ...mid, elapsedSeconds: 600, wrongAttempts: 5 })).toBe(2);
  });

  it('shows no hints at all above 0.80', () => {
    const secure = { mastery: 0.9, hasCopy: true };
    expect(hintLevelFor({ ...secure, elapsedSeconds: 600, wrongAttempts: 5 })).toBe(0);
    expect(hintDelays(0.9)[0]).toBe(Infinity);
  });

  it('is monotone — support never increases as mastery rises', () => {
    let previous = 4;
    for (let m = 0; m <= 1.0001; m += 0.05) {
      const level = hintLevelFor({ elapsedSeconds: 600, wrongAttempts: 3, mastery: m, hasCopy: true });
      expect(level, `mastery ${m.toFixed(2)}`).toBeLessThanOrEqual(previous);
      previous = level;
    }
  });
});

describe('hints never give the answer away', () => {
  it('contains no digits at level 1 or 2', () => {
    // Orientation and strategy describe the METHOD. A number in them would
    // usually be part of the answer.
    for (const [skill, t] of Object.entries(HINTS)) {
      expect(t!.orient.en, `${skill} L1`).not.toMatch(/\d/);
      expect(t!.strategy.en, `${skill} L2`).not.toMatch(/^\D*\d+\s*$/);
    }
  });

  it('never states an equality at any level', () => {
    // "= 16" would be the answer, not a hint.
    for (const [skill, t] of Object.entries(HINTS)) {
      for (const level of [t!.orient, t!.strategy, t!.directed]) {
        expect(level.en, skill).not.toMatch(/=\s*\d/);
        expect(level.hi, skill).not.toMatch(/=\s*\d/);
      }
    }
  });

  it('level 1 poses a question rather than instructing', () => {
    for (const [skill, t] of Object.entries(HINTS)) {
      expect(t!.orient.en.trim().endsWith('?'), `${skill}: "${t!.orient.en}"`).toBe(true);
    }
  });
});

describe('hint copy', () => {
  it('exists in both languages for every authored skill', () => {
    for (const [skill, t] of Object.entries(HINTS)) {
      for (const level of [t!.orient, t!.strategy, t!.directed]) {
        expect(level.en.length, skill).toBeGreaterThan(10);
        expect(level.hi.length, skill).toBeGreaterThan(5);
      }
    }
  });

  it('follows the semi-Hindi policy', () => {
    for (const t of Object.values(HINTS)) {
      for (const level of [t!.orient, t!.strategy, t!.directed]) {
        expect(hasDevanagariDigits(level.hi)).toBe(false);
      }
    }
  });

  it('only names real skills', () => {
    for (const s of HINTED_SKILLS) expect(SKILLS[s], s).toBeDefined();
  });

  it('reaches most of the curriculum through family fallbacks', () => {
    // Authoring one triple per family rather than per skill: the method for
    // add.2digit.carry and add.3digit is the same, and duplicating it would
    // guarantee the two drift apart.
    const covered = ALL_SKILL_IDS.filter(s => hintsFor(s) !== null);
    expect(covered.length / ALL_SKILL_IDS.length).toBeGreaterThan(0.7);
  });

  it('returns nothing at level 0', () => {
    expect(hintText('add.2digit.carry', 0, 'en')).toBeNull();
  });
});

describe('dependence prevention', () => {
  it('counts scaffolded attempts per skill', () => {
    const log = [
      ...Array.from({ length: 4 }, (_, i) => mk('add.2digit.carry', true, i)),
      ...Array.from({ length: 3 }, (_, i) => mk('add.2digit.carry', false, i + 4)),
    ];
    expect(hintUsageFor(log, 'add.2digit.carry')).toBe(4);
  });

  it('routes to prerequisite repair when hints stop working', () => {
    // Heavy hint use means the hints are NOT working. The correct response is
    // not more hints — a child who needs a directed hint on most attempts is
    // not being scaffolded, they are being carried.
    const heavy = Array.from({ length: HEAVY_HINT_THRESHOLD + 1 },
      (_, i) => mk('add.2digit.carry', true, i));
    expect(needsDescentNotHints(heavy, 'add.2digit.carry')).toBe(true);

    const light = Array.from({ length: 10 }, (_, i) => mk('add.2digit.carry', i < 2, i));
    expect(needsDescentNotHints(light, 'add.2digit.carry')).toBe(false);
  });
});
