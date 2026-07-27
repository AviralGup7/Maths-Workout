// Regression suite derived from the correctness audit (docs/05).
// Each block corresponds to a finding that was verified by fuzzing.

import { describe, it, expect } from 'vitest';
import { generateQuestion, getAvailableCategories, generateTablesQuestions } from '../index';
import type { SchoolClass, Difficulty, Category } from '../types';
import { MISCONCEPTIONS } from '../../learning/misconceptions';

const CLASSES: SchoolClass[] = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];
const N = 400;

function eachCell(fn: (cls: SchoolClass, cat: Category, diff: Difficulty) => void) {
  for (const cls of CLASSES) {
    for (const cat of getAvailableCategories(cls)) {
      if (cat === 'tables') continue;
      for (const diff of DIFFS) fn(cls, cat, diff);
    }
  }
}

describe('universal invariants', () => {
  it('always includes the correct answer among the choices', () => {
    eachCell((cls, cat, diff) => {
      for (let i = 0; i < N; i++) {
        const q = generateQuestion(cls, diff, cat);
        expect(q.choices.map(String), `${cls}/${cat}/${diff}: ${q.questionText}`)
          .toContain(String(q.answer));
      }
    });
  });

  // docs/05 · F1 / C7 — true/false questions rendered only 2 options
  it('always offers exactly four choices', () => {
    eachCell((cls, cat, diff) => {
      for (let i = 0; i < N; i++) {
        const q = generateQuestion(cls, diff, cat);
        expect(q.choices.length, `${cls}/${cat}/${diff}: ${q.questionText} → ${q.choices}`).toBe(4);
      }
    });
  });

  it('never repeats a choice within a question', () => {
    eachCell((cls, cat, diff) => {
      for (let i = 0; i < N; i++) {
        const q = generateQuestion(cls, diff, cat);
        expect(new Set(q.choices.map(String)).size).toBe(q.choices.length);
      }
    });
  });

  it('never renders NaN, Infinity or undefined', () => {
    eachCell((cls, cat, diff) => {
      for (let i = 0; i < N; i++) {
        const q = generateQuestion(cls, diff, cat);
        expect(q.questionText).not.toMatch(/NaN|Infinity|undefined/);
        q.choices.forEach(c => expect(String(c)).not.toMatch(/NaN|Infinity|undefined/));
      }
    });
  });

  it('never throws', () => {
    eachCell((cls, cat, diff) => {
      for (let i = 0; i < 50; i++) {
        expect(() => generateQuestion(cls, diff, cat)).not.toThrow();
      }
    });
  });
});

// docs/05 · F2 / C8 — "Share €55 in ratio 5:6" produced 29.999999999999996
describe('F2 — no float precision artifacts', () => {
  it('never shows a value with more than two decimal places', () => {
    eachCell((cls, cat, diff) => {
      for (let i = 0; i < N; i++) {
        const q = generateQuestion(cls, diff, cat);
        for (const c of [q.answer, ...q.choices]) {
          if (typeof c !== 'number' || Number.isInteger(c)) continue;
          const decimals = String(c).split('.')[1] ?? '';
          expect(decimals.length, `${cls}/${cat}/${diff}: ${q.questionText} → ${c}`)
            .toBeLessThanOrEqual(2);
        }
      }
    });
  });
});

// docs/05 · F3 — triangle area and percentages produced x.5 answers
describe('F3 — integer answers where the topic implies whole numbers', () => {
  it('triangle-area questions have whole-number answers', () => {
    for (const cls of ['3rd', '4th', '5th', '6th'] as SchoolClass[]) {
      for (const diff of DIFFS) {
        for (let i = 0; i < 600; i++) {
          const q = generateQuestion(cls, diff, 'geometry');
          if (!q.questionText.includes('triangle')) continue;
          expect(Number.isInteger(q.answer as number), q.questionText).toBe(true);
        }
      }
    }
  });

  it('percentage questions have whole-number answers', () => {
    for (const cls of ['5th', '6th'] as SchoolClass[]) {
      for (const diff of DIFFS) {
        for (let i = 0; i < 600; i++) {
          const q = generateQuestion(cls, diff, 'percentages');
          expect(Number.isInteger(q.answer as number), q.questionText).toBe(true);
        }
      }
    }
  });

  it('ratio questions have whole-number answers', () => {
    for (const cls of ['5th', '6th'] as SchoolClass[]) {
      for (const diff of DIFFS) {
        for (let i = 0; i < 600; i++) {
          const q = generateQuestion(cls, diff, 'ratio');
          expect(Number.isInteger(q.answer as number), q.questionText).toBe(true);
        }
      }
    }
  });
});

// docs/05 · F5 — Class 1/2 division fell through to the Class 6 branch
describe('F5 — division is age-appropriate', () => {
  it('keeps Class 1 and 2 dividends small', () => {
    for (const cls of ['1st', '2nd'] as SchoolClass[]) {
      for (const diff of DIFFS) {
        for (let i = 0; i < 400; i++) {
          const q = generateQuestion(cls, diff, 'division');
          const nums = (q.questionText.match(/\d+/g) ?? []).map(Number);
          expect(Math.max(...nums), q.questionText).toBeLessThanOrEqual(30);
        }
      }
    }
  });
});

// docs/05 · F6 — 24.1% of Class 1 subtraction offered a negative distractor
describe('F6 — no negative options before negative numbers are taught', () => {
  it('offers no negative choices outside the integers topic', () => {
    eachCell((cls, cat, diff) => {
      if (cat === 'integers') return;
      for (let i = 0; i < N; i++) {
        const q = generateQuestion(cls, diff, cat);
        for (const c of q.choices) {
          if (typeof c === 'number') {
            expect(c, `${cls}/${cat}/${diff}: ${q.questionText} → ${q.choices}`)
              .toBeGreaterThanOrEqual(0);
          }
        }
      }
    });
  });
});

// Semantic verification — re-derive the maths from the rendered text
describe('arithmetic is semantically correct', () => {
  const PATTERNS: [RegExp, (a: number, b: number) => number][] = [
    [/^(-?\d+) \+ (-?\d+) = \?$/, (a, b) => a + b],
    [/^(-?\d+) − (-?\d+) = \?$/, (a, b) => a - b],
    [/^(-?\d+) × (-?\d+) = \?$/, (a, b) => a * b],
    [/^(-?\d+) ÷ (-?\d+) = \?$/, (a, b) => a / b],
  ];

  it('matches the value re-derived from the question text', () => {
    for (const cls of CLASSES) {
      for (const cat of ['addition', 'subtraction', 'multiplication', 'division'] as Category[]) {
        for (const diff of DIFFS) {
          for (let i = 0; i < 300; i++) {
            const q = generateQuestion(cls, diff, cat);
            for (const [re, fn] of PATTERNS) {
              const m = q.questionText.match(re);
              if (m) expect(fn(+m[1], +m[2]), q.questionText).toBe(q.answer);
            }
          }
        }
      }
    }
  });

  it('division always yields a whole number', () => {
    for (const cls of CLASSES) {
      for (const diff of DIFFS) {
        for (let i = 0; i < 300; i++) {
          const q = generateQuestion(cls, diff, 'division');
          expect(Number.isInteger(q.answer as number), q.questionText).toBe(true);
        }
      }
    }
  });
});

// Direction D — distractors must be diagnostic
describe('diagnostic distractors', () => {
  it('tags arithmetic distractors with real misconceptions', () => {
    let tagged = 0;
    let total = 0;
    for (const cls of CLASSES) {
      for (const cat of ['addition', 'subtraction', 'multiplication', 'division'] as Category[]) {
        for (const diff of DIFFS) {
          for (let i = 0; i < 100; i++) {
            const q = generateQuestion(cls, diff, cat);
            total++;
            if (q.distractorMap && Object.keys(q.distractorMap).length > 0) tagged++;
            for (const id of Object.values(q.distractorMap ?? {})) {
              expect(MISCONCEPTIONS[id], `unknown misconception "${id}"`).toBeDefined();
            }
          }
        }
      }
    }
    // The overwhelming majority of arithmetic questions should carry a probe.
    expect(tagged / total).toBeGreaterThan(0.9);
  });

  it('never maps the correct answer to a misconception', () => {
    for (const cls of CLASSES) {
      for (const cat of ['addition', 'subtraction', 'multiplication'] as Category[]) {
        for (let i = 0; i < 200; i++) {
          const q = generateQuestion(cls, 'medium', cat);
          expect(q.distractorMap?.[String(q.answer)]).toBeUndefined();
        }
      }
    }
  });
});

describe('tables mode', () => {
  it('returns 12 valid questions for every table', () => {
    for (let t = 1; t <= 12; t++) {
      for (let r = 0; r < 30; r++) {
        const qs = generateTablesQuestions(t);
        expect(qs).toHaveLength(12);
        for (const q of qs) {
          expect(q.choices.map(String)).toContain(String(q.answer));
          expect(new Set(q.choices.map(String)).size).toBe(q.choices.length);
        }
      }
    }
  });
});
