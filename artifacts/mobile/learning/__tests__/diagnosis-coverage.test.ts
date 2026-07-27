// Diagnostic coverage for the 17 previously undiagnosed skills.
// docs/14 Phase 3 #13.
//
// Before this work, 24 of 41 skills could detect *that* a child was wrong but
// never *why* — the engine's differentiating capability was absent across
// almost half the curriculum.
//
// The important property here is not that the misconceptions EXIST but that
// they FIRE. A misconception that is defined and never detected is worse than
// none at all: it inflates the apparent coverage of the diagnostic engine while
// telling the child nothing.

import { describe, it, expect } from 'vitest';
import { MISCONCEPTIONS, diagnose } from '../misconceptions';
import { MISCONCEPTIONS_HI } from '../../i18n/misconceptions-hi';
import { ALL_SKILL_IDS, SKILLS } from '../skills';
import { hasDevanagariDigits } from '../../i18n/strings';

const base = { latencyMs: 6000, timedOut: false };

describe('every skill can be diagnosed', () => {
  it('all 41 skills have at least one misconception', () => {
    const covered = new Set<string>();
    for (const m of Object.values(MISCONCEPTIONS)) for (const s of m.skills) covered.add(s);
    const uncovered = ALL_SKILL_IDS.filter(s => !covered.has(s));
    expect(uncovered, `uncovered: ${uncovered.join(', ')}`).toEqual([]);
  });

  it('every misconception names only real skills', () => {
    for (const m of Object.values(MISCONCEPTIONS)) {
      for (const s of m.skills) {
        expect(SKILLS[s], `${m.id} references unknown skill ${s}`).toBeDefined();
      }
    }
  });

  it('every misconception has Hindi copy', () => {
    for (const id of Object.keys(MISCONCEPTIONS)) {
      expect(MISCONCEPTIONS_HI[id], `${id} has no Hindi translation`).toBeDefined();
    }
  });

  it('Hindi copy follows the semi-Hindi policy', () => {
    for (const [id, m] of Object.entries(MISCONCEPTIONS_HI)) {
      expect(hasDevanagariDigits(m.label), id).toBe(false);
      expect(hasDevanagariDigits(m.explanation), id).toBe(false);
      expect(hasDevanagariDigits(m.remediation), id).toBe(false);
    }
  });

  it('every misconception explains the error and gives a next step', () => {
    for (const m of Object.values(MISCONCEPTIONS)) {
      expect(m.explanation.length, m.id).toBeGreaterThan(30);
      expect(m.remediation.length, m.id).toBeGreaterThan(20);
    }
  });
});

describe('the new detectors actually fire', () => {
  const cases: [string, Parameters<typeof diagnose>[0], string][] = [
    ['miscount by one', {
      ...base, skill: 'count.objects', questionText: 'How many 🍎?\n🍎🍎🍎🍎🍎🍎🍎',
      expected: '7', chosen: '8',
    }, 'count.miscount-by-one'],

    ['columns misaligned in no-carry addition', {
      ...base, skill: 'add.2digit.nocarry', questionText: '23 + 41 = ?',
      expected: '64', chosen: String(23 + 4 + 10),
    }, 'add.nocarry-misaligned'],

    ['dropped partial product', {
      ...base, skill: 'mul.2digit', questionText: '23 × 14 = ?',
      expected: '322', chosen: String(23 * 4),
    }, 'mul.partial-product-dropped'],

    ['missing place shift', {
      ...base, skill: 'mul.2digit', questionText: '23 × 14 = ?',
      expected: '322', chosen: String(23 * 4 + 23 * 1),
    }, 'mul.place-shift-missing'],

    ['fraction numerator used as the whole', {
      ...base, skill: 'frac.ofAmount', questionText: 'What is 3/4 of 20?',
      expected: '15', chosen: '3',
    }, 'frac.numerator-as-whole'],

    ['factor confused with multiple', {
      ...base, skill: 'factors.basic', questionText: 'Which is a factor of 12?',
      expected: '4', chosen: '24',
    }, 'factors.multiple-not-factor'],

    ['area and perimeter swapped', {
      ...base, skill: 'geometry.basic', questionText: 'Area of a rectangle 5 × 3 = ?',
      expected: '15', chosen: '16',
    }, 'geometry.area-perimeter-swap'],

    ['unit conversion the wrong way', {
      ...base, skill: 'measurement.basic', questionText: 'How many cm in 3 m?',
      expected: '300', chosen: '3000',
    }, 'measurement.unit-conversion'],

    ['totalled without dividing', {
      ...base, skill: 'data.basic', questionText: 'Mean of 2, 4, 6 = ?',
      expected: '4', chosen: '12',
    }, 'data.forgot-divide'],

    ['change added instead of subtracted', {
      ...base, skill: 'money.basic', questionText: 'Cost ₹30, paid ₹50. Change?',
      expected: '20', chosen: '80',
    }, 'money.change-not-subtracted'],

    ['corners counted on a circle', {
      ...base, skill: 'shapes.basic', questionText: 'How many corners does a Circle have?',
      expected: '0', chosen: '3',
    }, 'shapes.side-corner-confusion'],

    ['wrong operation in a word problem', {
      ...base, skill: 'wordproblems', questionText: 'Aarav has 12 mangoes and gives away 5. How many left?',
      expected: '7', chosen: '17',
    }, 'wordproblems.wrong-operation'],
  ];

  for (const [name, input, expectedId] of cases) {
    it(name, () => {
      expect(diagnose(input)).toBe(expectedId);
    });
  }
});

describe('diagnosis stays honest', () => {
  it('never diagnoses a correct answer', () => {
    expect(diagnose({
      ...base, skill: 'add.2digit.nocarry', questionText: '23 + 41 = ?',
      expected: '64', chosen: '64',
    })).toBeNull();
  });

  it('never diagnoses a timeout', () => {
    expect(diagnose({
      ...base, timedOut: true, skill: 'data.basic',
      questionText: 'Mean of 2, 4, 6 = ?', expected: '4', chosen: '',
    })).toBeNull();
  });

  it('prefers a guess diagnosis when the answer arrived impossibly fast', () => {
    // Speed evidence outranks pattern-matching: an answer in 300ms was not
    // reasoned, so attributing a specific faulty rule would be a fiction.
    expect(diagnose({
      skill: 'mul.2digit', questionText: '23 × 14 = ?', expected: '322',
      chosen: String(23 * 4), latencyMs: 300, timedOut: false,
    })).toBe('guessing');
  });

  it('returns null for an unrecognised error rather than guessing a cause', () => {
    expect(diagnose({
      ...base, skill: 'geometry.basic', questionText: 'Area of a rectangle 5 × 3 = ?',
      expected: '15', chosen: '9999',
    })).toBeNull();
  });

  it('does not fire the shapes detector where sides and corners agree', () => {
    // A square has 4 sides and 4 corners, so "counted the wrong one" is
    // undetectable there — and claiming it would be a false accusation.
    expect(diagnose({
      ...base, skill: 'shapes.basic', questionText: 'How many corners does a Square have?',
      expected: '4', chosen: '5',
    })).not.toBe('shapes.side-corner-confusion');
  });
});
