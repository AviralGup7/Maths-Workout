// Tests for §1 — worked examples.
//
// The trigger gates matter more than the content here. A worked example shown
// to the wrong learner at the wrong moment is worse than none at all:
// expertise reversal means it actively degrades a competent learner, and an
// ungated one turns a practice app into an interruption.

import { describe, it, expect } from 'vitest';
import type { Attempt } from '../attempts';
import type { MasteryEstimate } from '../mastery';
import {
  shouldTeach, hasFaded, buildWorkedExample, canTeach, TAUGHT_SKILLS,
  WE_COOLDOWN_ATTEMPTS, WE_FADE_STREAK,
} from '../workedExamples';
import { MISCONCEPTIONS } from '../misconceptions';
import { hasDevanagariDigits } from '../../i18n/strings';

const NOW = 1_700_000_000_000;

function mk(skill: string, correct: boolean, i = 0, over: Partial<Attempt> = {}): Attempt {
  return {
    skill, correct, answeredAt: NOW + i * 1000, latencyMs: 4000,
    chosen: correct ? '1' : '2', expected: '1', questionText: 'q', timedOut: false,
    cls: '4th', category: 'addition', difficulty: 'medium', ...over,
  };
}

function est(values: Record<string, number>): Record<string, MasteryEstimate> {
  const out: Record<string, MasteryEstimate> = {};
  for (const [skill, value] of Object.entries(values)) {
    out[skill] = {
      skill, value, confidence: 0.8, attempts: 10, correct: 5,
      lastPracticed: NOW, trend: 0, rawAccuracy: value,
    };
  }
  return out;
}

/** A log long enough that the cooldown is not the thing under test. */
function warm(skill: string, n = WE_COOLDOWN_ATTEMPTS + 5): Attempt[] {
  return Array.from({ length: n }, (_, i) => mk(skill, i % 2 === 0, i));
}

describe('worked example triggers', () => {
  const skill = 'sub.2digit.borrow';

  it('teaches after two consecutive misses on a struggling skill', () => {
    const sessionLog = [mk(skill, false, 0), mk(skill, false, 1)];
    expect(shouldTeach({
      skill, sessionLog, log: warm(skill), estimates: est({ [skill]: 0.3 }),
    })).toBe(true);
  });

  it('does not teach after a single miss', () => {
    expect(shouldTeach({
      skill, sessionLog: [mk(skill, false)], log: warm(skill), estimates: est({ [skill]: 0.3 }),
    })).toBe(false);
  });

  it('never interrupts a competent learner having a bad moment', () => {
    // Expertise reversal — this gate is the reason the feature is tolerable.
    const sessionLog = [mk(skill, false, 0), mk(skill, false, 1)];
    expect(shouldTeach({
      skill, sessionLog, log: warm(skill), estimates: est({ [skill]: 0.75 }),
    })).toBe(false);
  });

  it('respects the cooldown after teaching', () => {
    const sessionLog = [mk(skill, false, 0), mk(skill, false, 1)];
    const log = warm(skill, 30);
    const taughtAt = [log.filter(a => a.skill === skill).length - 2];  // just taught
    expect(shouldTeach({
      skill, sessionLog, log, estimates: est({ [skill]: 0.3 }), taughtAt,
    })).toBe(false);
  });

  it('teaches again once the cooldown has elapsed', () => {
    const sessionLog = [mk(skill, false, 0), mk(skill, false, 1)];
    const log = warm(skill, 60);
    const taughtAt = [0];
    expect(shouldTeach({
      skill, sessionLog, log, estimates: est({ [skill]: 0.3 }), taughtAt,
    })).toBe(true);
  });

  it('teaches on a repeated misconception even without back-to-back misses', () => {
    const log = [
      ...warm(skill, 25),
      mk(skill, false, 100, { misconception: 'sub.smaller-from-larger' }),
      mk(skill, true, 101),
      mk(skill, false, 102, { misconception: 'sub.smaller-from-larger' }),
    ];
    expect(shouldTeach({
      skill, sessionLog: [mk(skill, false, 102)], log, estimates: est({ [skill]: 0.3 }),
    })).toBe(true);
  });

  it('ignores synthesised legacy rows when counting misconceptions', () => {
    const log = [
      ...warm(skill, 25),
      mk(skill, false, 100, { misconception: 'legacy-import' }),
      mk(skill, false, 101, { misconception: 'legacy-import' }),
    ];
    expect(shouldTeach({
      skill, sessionLog: [mk(skill, true, 102)], log, estimates: est({ [skill]: 0.3 }),
    })).toBe(false);
  });
});

describe('worked examples fade', () => {
  it('retires after consecutive correct twins', () => {
    const log = [mk('add.3digit', true, 0), mk('add.3digit', true, 1)];
    expect(hasFaded(log, 'add.3digit')).toBe(true);
  });

  it('does not retire on a single success', () => {
    expect(hasFaded([mk('add.3digit', false, 0), mk('add.3digit', true, 1)], 'add.3digit')).toBe(false);
  });

  it('requires exactly the documented streak', () => {
    expect(WE_FADE_STREAK).toBe(2);
  });
});

describe('step solvers', () => {
  const explain = (id: string) => MISCONCEPTIONS[id]?.explanation;

  it('covers the arithmetic spine', () => {
    for (const s of ['add.2digit.carry', 'sub.2digit.borrow', 'mul.tables.mid', 'div.basic']) {
      expect(canTeach(s)).toBe(true);
    }
    expect(TAUGHT_SKILLS.length).toBeGreaterThanOrEqual(12);
  });

  it('does not pretend to teach recall-only topics', () => {
    // A "worked example" for shape names would dress memorisation up as method.
    for (const s of ['shapes.basic', 'time.basic', 'data.basic']) {
      expect(canTeach(s)).toBe(false);
    }
  });

  it('works the actual failed problem, with correct arithmetic', () => {
    const we = buildWorkedExample({
      skill: 'sub.2digit.borrow', questionText: '43 − 27 = ?',
      operands: [43, 27], answer: 16,
    })!;
    expect(we).not.toBeNull();
    expect(we.problem).toBe('43 − 27 = ?');
    expect(we.answer).toBe(16);
    // The final step must state the true result.
    expect(we.steps[we.steps.length - 1].work).toContain('16');
  });

  it('names borrowing when a column needs it', () => {
    const we = buildWorkedExample({
      skill: 'sub.2digit.borrow', questionText: '43 − 27 = ?', operands: [43, 27], answer: 16,
    })!;
    expect(we.steps[0].text.en.toLowerCase()).toContain('borrow');
  });

  it('names carrying when a column needs it', () => {
    const we = buildWorkedExample({
      skill: 'add.2digit.carry', questionText: '47 + 35 = ?', operands: [47, 35], answer: 82,
    })!;
    expect(we.steps.some(s => /carry/i.test(s.text.en))).toBe(true);
    expect(we.steps[we.steps.length - 1].work).toContain('82');
  });

  it('never exceeds four steps', () => {
    // Beyond four the child taps through without reading.
    for (const [skill, a, b] of [
      ['add.2digit.carry', 47, 35], ['sub.2digit.borrow', 43, 27],
      ['mul.tables.mid', 7, 8], ['div.basic', 24, 6], ['add.within20', 8, 7],
    ] as [string, number, number][]) {
      const we = buildWorkedExample({
        skill, questionText: 'q', operands: [a, b], answer: 0,
      });
      expect(we!.steps.length).toBeLessThanOrEqual(4);
      expect(we!.steps.length).toBeGreaterThan(0);
    }
  });

  it('numbers steps consecutively from 1', () => {
    const we = buildWorkedExample({
      skill: 'add.2digit.carry', questionText: 'q', operands: [47, 35], answer: 82,
    })!;
    expect(we.steps.map(s => s.n)).toEqual(we.steps.map((_, i) => i + 1));
  });

  it('returns null rather than nonsense for degenerate input', () => {
    expect(buildWorkedExample({ skill: 'div.basic', questionText: 'q', operands: [5, 0], answer: 0 })).toBeNull();
    expect(buildWorkedExample({ skill: 'div.basic', questionText: 'q', operands: [7, 2], answer: 3.5 })).toBeNull();
    expect(buildWorkedExample({ skill: 'add.2digit.carry', questionText: 'q', operands: [5], answer: 5 })).toBeNull();
    expect(buildWorkedExample({ skill: 'shapes.basic', questionText: 'q', operands: [1, 2], answer: 3 })).toBeNull();
  });

  it('names the learner’s own error when one was diagnosed', () => {
    const we = buildWorkedExample({
      skill: 'sub.2digit.borrow', questionText: '43 − 27 = ?', operands: [43, 27], answer: 16,
      chosen: '24', misconception: 'sub.smaller-from-larger', explain,
    })!;
    expect(we.errorNote).toBeDefined();
    expect(we.errorNote!.en).toContain('24');
  });

  it('omits the error note when nothing was diagnosed', () => {
    const we = buildWorkedExample({
      skill: 'sub.2digit.borrow', questionText: 'q', operands: [43, 27], answer: 16, chosen: '24',
    })!;
    expect(we.errorNote).toBeUndefined();
  });

  it('provides Hindi for every step, with Western Arabic numerals', () => {
    // Semi-Hindi policy: the method is translated, the digits never are.
    for (const [skill, a, b] of [
      ['add.2digit.carry', 47, 35], ['sub.2digit.borrow', 43, 27],
      ['mul.tables.mid', 7, 8], ['div.basic', 24, 6],
      ['add.within20', 8, 7], ['sub.within20', 15, 8],
    ] as [string, number, number][]) {
      const we = buildWorkedExample({ skill, questionText: 'q', operands: [a, b], answer: 0 })!;
      for (const s of we.steps) {
        expect(s.text.hi.length).toBeGreaterThan(0);
        expect(hasDevanagariDigits(s.text.hi)).toBe(false);
      }
    }
  });

  it('produces arithmetically sound steps across many operand pairs', () => {
    for (let a = 21; a < 99; a += 7) {
      for (let b = 12; b < a; b += 5) {
        const sub = buildWorkedExample({
          skill: 'sub.2digit.borrow', questionText: 'q', operands: [a, b], answer: a - b,
        })!;
        expect(sub.steps[sub.steps.length - 1].work).toBe(`${a} − ${b} = ${a - b}`);

        const add = buildWorkedExample({
          skill: 'add.2digit.carry', questionText: 'q', operands: [a, b], answer: a + b,
        })!;
        expect(add.steps[add.steps.length - 1].work).toBe(`${a} + ${b} = ${a + b}`);
      }
    }
  });
});
