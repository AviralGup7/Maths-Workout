import { describe, it, expect } from 'vitest';
import {
  parseExpression, analyseSlots, gradeOpen, checkConstraint, describeSpec,
  type OpenSpec, type OpenConstraint,
} from '../openResponse';
import { grade, expectedAnswer } from '../interactions';
import { genOpenEnded, genOpenMiddle, genReverse, exemplarIsValid } from '../openTasks';
import type { SchoolClass, Question } from '../types';

const CLASSES: SchoolClass[] = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

// ─── The expression parser ───────────────────────────────────────────────────

describe('parseExpression', () => {
  it('evaluates with correct precedence', () => {
    expect(parseExpression('2+3*4').value).toBe(14);
    expect(parseExpression('(2+3)*4').value).toBe(20);
    expect(parseExpression('20/4-1').value).toBe(4);
  });

  it('accepts the Unicode glyphs the app actually renders', () => {
    // docs/27 measured U+2212 (not ASCII hyphen) in the algebra question forms,
    // and × / ÷ throughout. A child copying what is on screen must be graded.
    expect(parseExpression('7×6').value).toBe(42);
    expect(parseExpression('48÷6').value).toBe(8);
    expect(parseExpression('50\u22128').value).toBe(42);
  });

  it('is total: half-typed input returns null rather than throwing', () => {
    // The child sees this state on every keystroke. A throw here is a crash
    // in the middle of answering.
    for (const bad of ['', '7+', '+', '((', '7++3', 'abc', '7/0']) {
      expect(() => parseExpression(bad)).not.toThrow();
      expect(parseExpression(bad).value).toBeNull();
    }
  });

  it('extracts parts, ops and digits separately', () => {
    const s = parseExpression('42+18');
    expect(s.parts).toEqual([42, 18]);
    expect(s.ops).toEqual(['+']);
    expect(s.digits).toEqual([4, 2, 1, 8]);
  });

  it('does not execute code', () => {
    const s = parseExpression('constructor');
    expect(s.value).toBeNull();
    expect(s.parts).toEqual([]);
  });
});

describe('analyseSlots', () => {
  it('ignores empty slots', () => {
    expect(analyseSlots([18, null, 32]).parts).toEqual([18, 32]);
  });
});

// ─── Constraints ─────────────────────────────────────────────────────────────

const spec = (constraints: OpenConstraint[], exemplar: string, mode: OpenSpec['mode'] = 'slots'): OpenSpec =>
  ({ mode, slots: 2, constraints, exemplar });

describe('gradeOpen', () => {
  it('accepts EVERY member of the valid set, not one privileged answer', () => {
    // This is the property P1-17 exists for. 49 answers, all correct.
    const s = spec([{ type: 'sum', total: 50 }, { type: 'partCount', count: 2 }], '25, 25');
    for (let a = 1; a < 50; a++) {
      expect(gradeOpen(s, `${a},${50 - a}`).correct).toBe(true);
    }
    expect(gradeOpen(s, '20,20').correct).toBe(false);
  });

  it('is order-independent for sums and products', () => {
    const s = spec([{ type: 'product', total: 24 }], '4, 6');
    expect(gradeOpen(s, '4,6').correct).toBe(true);
    expect(gradeOpen(s, '6,4').correct).toBe(true);
  });

  it('reports WHICH constraint failed, in the child\'s terms', () => {
    const s = spec([{ type: 'sum', total: 50 }, { type: 'distinctParts' }], '18, 32');
    const v = gradeOpen(s, '18,30');
    expect(v.correct).toBe(false);
    expect(v.message).toContain('48');
    expect(v.message).toContain('50');
  });

  it('counts partial satisfaction honestly', () => {
    const s = spec([
      { type: 'partCount', count: 2 },
      { type: 'sum', total: 50 },
      { type: 'distinctParts' },
    ], '18, 32');
    const v = gradeOpen(s, '25,25');
    expect(v.met).toBe(2);
    expect(v.total).toBe(3);
    expect(v.correct).toBe(false);
  });

  it('enforces a digit pool with each digit usable once', () => {
    const s: OpenSpec = {
      mode: 'expression',
      constraints: [{ type: 'usesDigits', digits: [2, 3, 4, 5], eachOnce: true }],
      exemplar: '23+45',
    };
    expect(gradeOpen(s, '23+45').correct).toBe(true);
    expect(gradeOpen(s, '22+45').correct).toBe(false);   // 2 reused
    expect(gradeOpen(s, '23+49').correct).toBe(false);   // 9 not in pool
  });

  it('rejects disallowed operations', () => {
    const s: OpenSpec = {
      mode: 'expression',
      constraints: [{ type: 'usesOperations', ops: ['*'], min: 1 }],
      exemplar: '4*6',
    };
    expect(gradeOpen(s, '4*6').correct).toBe(true);
    expect(gradeOpen(s, '4+6').correct).toBe(false);
  });

  it('treats floating point closeness as equality', () => {
    const s = spec([{ type: 'sum', total: 0.3 }], '0.1, 0.2');
    expect(gradeOpen(s, '0.1,0.2').correct).toBe(true);
  });

  it('honours strict vs inclusive bounds', () => {
    const strict = spec([{ type: 'valueBetween', low: 3, high: 4, exclusive: true }], '3.5');
    expect(gradeOpen(strict, '3').correct).toBe(false);
    expect(gradeOpen(strict, '3.5').correct).toBe(true);
    const loose = spec([{ type: 'valueBetween', low: 3, high: 4 }], '3');
    expect(gradeOpen(loose, '3').correct).toBe(true);
  });

  it('produces a Hindi message with Western Arabic numerals', () => {
    // Semi-Hindi policy: what is being learned is translated, numerals never
    // are. A Devanagari digit here would be a policy regression.
    const s = spec([{ type: 'sum', total: 50 }], '18, 32');
    const v = gradeOpen(s, '18,30', 'hi');
    expect(v.message).toBeTruthy();
    expect(v.message).toMatch(/50/);
    expect(v.message).not.toMatch(/[०-९]/);
    expect(describeSpec(s, 'hi')).not.toMatch(/[०-९]/);
  });
});

// ─── Integration with the shared grading pipeline ────────────────────────────

describe('open questions inside the shared pipeline', () => {
  it('grade() routes open interactions to the constraint grader', () => {
    const q = genOpenEnded('4th', 'medium');
    const it = q.interaction as Extract<Question['interaction'], { kind: 'open' }>;
    expect(it.kind).toBe('open');
    expect(grade(q, it.exemplar)).toBe(true);
    expect(grade(q, 'nonsense')).toBe(false);
  });

  it('expectedAnswer() yields the exemplar, so reviews and a11y keep working', () => {
    const q = genReverse('5th', 'medium');
    const it = q.interaction as Extract<Question['interaction'], { kind: 'open' }>;
    expect(expectedAnswer(q)).toBe(it.exemplar);
  });
});

// ─── The generators ──────────────────────────────────────────────────────────

describe('open task generators', () => {
  it('every generated exemplar satisfies its own constraints', () => {
    // The one silent failure mode of this family: a task the child cannot win
    // because its stated answer is wrong. Caught 28 of 7,200 during
    // development (two-step reverse drew its target independently of the
    // route that was supposed to reach it).
    const bad: string[] = [];
    for (const cls of CLASSES) {
      for (let i = 0; i < 300; i++) {
        for (const gen of [genOpenEnded, genOpenMiddle, genReverse]) {
          const q = gen(cls, 'medium');
          if (!exemplarIsValid(q)) bad.push(`${cls} ${q.questionText} → ${(q.interaction as any).exemplar}`);
        }
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it('every generated task carries a non-empty constraint list', () => {
    for (const cls of CLASSES) {
      for (const gen of [genOpenEnded, genOpenMiddle, genReverse]) {
        for (let i = 0; i < 40; i++) {
          const it = gen(cls, 'medium').interaction as any;
          expect(it.kind).toBe('open');
          expect(it.constraints.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('open-ended tasks genuinely admit more than one answer', () => {
    // If a generated "open" task had a unique answer it would be a closed
    // question wearing an open interface, and would justify none of the cost.
    for (let i = 0; i < 60; i++) {
      const q = genOpenEnded('4th', 'medium');
      const it = q.interaction as any;
      let solutions = 0;
      if (it.slots === 1) {
        // Single-slot tasks include "a number between 5 and 6", whose answers
        // are all non-integers — searching whole numbers alone would report
        // zero solutions for a task with infinitely many.
        for (let a = 0; a <= 2000 && solutions < 2; a++) {
          if (gradeOpen(it, String(a / 10)).correct) solutions++;
        }
      } else {
        for (let a = 0; a <= 200 && solutions < 2; a++) {
          for (let b = 0; b <= 200 && solutions < 2; b++) {
            if (gradeOpen(it, `${a},${b}`).correct) solutions++;
          }
        }
      }
      expect(solutions).toBeGreaterThanOrEqual(2);
    }
  });

  it('Open Middle tasks are not offered below Class 3', () => {
    // Not a generator property — a policy one, asserted where it is visible.
    const q = genOpenMiddle('1st', 'easy');
    expect(q.interaction?.kind).toBe('open');
  });

  it('renders both languages without leaking Devanagari numerals', () => {
    for (const gen of [genOpenEnded, genOpenMiddle, genReverse]) {
      for (let i = 0; i < 50; i++) {
        const q = gen('5th', 'medium', 'hi');
        expect(q.questionText).not.toMatch(/[०-९]/);
        expect(q.questionText.length).toBeGreaterThan(5);
      }
    }
  });
});
