import { describe, it, expect } from 'vitest';
import {
  normaliseSet, normaliseSequence, normaliseEntry, expectedAnswer, grade,
  entryQuestion, multiSelectQuestion, orderingQuestion,
  pickInteraction, toEntry, inversionCount, selectionAccuracy,
} from '../interactions';
import {
  genFactorSelect, genPrimeSelect, genMultipleSelect,
  genOrderNumbers, genOrderDecimals, genOrderFractions,
  genMissingNumber, genTableRecall, genDoubleHalve,
} from '../topics-interactive';
import { isPrime } from '../helpers';
import type { SchoolClass, Difficulty } from '../types';

const CLASSES: SchoolClass[] = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];

describe('normalisation', () => {
  it('makes set answers order-independent', () => {
    expect(normaliseSet([3, 1, 2])).toBe(normaliseSet([2, 3, 1]));
  });

  it('sorts sets numerically, not lexically', () => {
    expect(normaliseSet([2, 10, 1])).toBe('1,2,10');
  });

  it('keeps sequence answers order-dependent', () => {
    expect(normaliseSequence([1, 2, 3])).not.toBe(normaliseSequence([3, 2, 1]));
  });

  it('normalises typed input', () => {
    expect(normaliseEntry('  24 ')).toBe('24');
    expect(normaliseEntry('24.0')).toBe('24');
    expect(normaliseEntry('')).toBe('');
    expect(normaliseEntry('-')).toBe('');
  });
});

describe('grading is uniform across interaction types', () => {
  it('grades typed entry', () => {
    const q = entryQuestion('7 + 5 = ?', 12);
    expect(grade(q, '12')).toBe(true);
    expect(grade(q, '13')).toBe(false);
    expect(grade(q, '')).toBe(false);
  });

  it('grades multi-select regardless of tap order', () => {
    const q = multiSelectQuestion('Tap the factors of 6', [2, 3], [4, 5]);
    expect(grade(q, normaliseSet([3, 2]))).toBe(true);
    expect(grade(q, normaliseSet([2]))).toBe(false);        // incomplete
    expect(grade(q, normaliseSet([2, 3, 4]))).toBe(false);  // over-selected
  });

  it('grades ordering strictly', () => {
    const q = orderingQuestion('Order these', [1, 2, 3]);
    expect(grade(q, normaliseSequence([1, 2, 3]))).toBe(true);
    expect(grade(q, normaliseSequence([2, 1, 3]))).toBe(false);
  });

  it('still grades legacy multiple choice', () => {
    const q = { questionText: '2 + 2 = ?', answer: 4, choices: [3, 4, 5, 6] };
    expect(grade(q, '4')).toBe(true);
    expect(grade(q, '5')).toBe(false);
  });
});

describe('builders produce well-formed questions', () => {
  it('entry questions carry no visible choices', () => {
    const q = entryQuestion('12 × 12 = ?', 144);
    expect(q.choices).toHaveLength(0);
    expect(q.interaction?.kind).toBe('entry');
  });

  it('multi-select options contain every correct value', () => {
    const q = multiSelectQuestion('x', [2, 3], [7, 9]);
    if (q.interaction?.kind !== 'multiSelect') throw new Error('wrong kind');
    for (const c of q.interaction.correct) {
      expect(q.interaction.options.map(String)).toContain(String(c));
    }
  });

  it('ordering never presents an already-solved sequence', () => {
    for (let i = 0; i < 200; i++) {
      const q = orderingQuestion('x', [1, 2, 3, 4]);
      if (q.interaction?.kind !== 'ordering') throw new Error('wrong kind');
      expect(normaliseSequence(q.interaction.items)).not.toBe(normaliseSequence(q.interaction.correctOrder));
    }
  });

  it('ordering presents exactly the items to be ordered', () => {
    const q = orderingQuestion('x', [5, 1, 9]);
    if (q.interaction?.kind !== 'ordering') throw new Error('wrong kind');
    expect(normaliseSet(q.interaction.items)).toBe(normaliseSet(q.interaction.correctOrder));
  });
});

describe('the interaction ladder', () => {
  it('keeps struggling learners on multiple choice', () => {
    expect(pickInteraction(0.2, { entry: true })).toBe('choice');
    expect(pickInteraction(0.6, { entry: true })).toBe('choice');
    expect(pickInteraction(0.79, { entry: true })).toBe('choice');
  });

  it('moves secure learners to typed recall', () => {
    expect(pickInteraction(0.85, { entry: true })).toBe('entry');
    expect(pickInteraction(1.0, { entry: true })).toBe('entry');
  });

  it('falls back to choice when entry is not supported', () => {
    expect(pickInteraction(0.95, { entry: false })).toBe('choice');
  });

  it('converts numeric questions to entry, leaving text answers alone', () => {
    const numeric = { questionText: '2 + 2 = ?', answer: 4, choices: [3, 4, 5, 6] };
    expect(toEntry(numeric).interaction?.kind).toBe('entry');
    expect(toEntry(numeric).choices).toHaveLength(0);

    const text = { questionText: 'Which shape?', answer: 'Hexagon', choices: ['Hexagon', 'Square'] };
    expect(toEntry(text).interaction).toBeUndefined();
    expect(toEntry(text).choices).toHaveLength(2);
  });
});

describe('diagnostic signals for the new types', () => {
  it('counts inversions as a measure of how wrong an ordering is', () => {
    expect(inversionCount([1, 2, 3], [1, 2, 3])).toBe(0);
    expect(inversionCount([2, 1, 3], [1, 2, 3])).toBe(1);   // one adjacent swap
    expect(inversionCount([3, 2, 1], [1, 2, 3])).toBe(3);   // fully reversed
  });

  it('reports hits, misses and false positives for a selection', () => {
    expect(selectionAccuracy([2, 3], [2, 3, 6])).toEqual({ hits: 2, misses: 1, falsePositives: 0 });
    expect(selectionAccuracy([2, 5], [2, 3])).toEqual({ hits: 1, misses: 1, falsePositives: 1 });
    expect(selectionAccuracy([], [2, 3])).toEqual({ hits: 0, misses: 2, falsePositives: 0 });
  });
});

// ─── The generators themselves ───────────────────────────────────────────────

const INTERACTIVE = [
  ['factor select', genFactorSelect],
  ['prime select', genPrimeSelect],
  ['multiple select', genMultipleSelect],
  ['order numbers', genOrderNumbers],
  ['order decimals', genOrderDecimals],
  ['order fractions', genOrderFractions],
  ['missing number', genMissingNumber],
  ['table recall', genTableRecall],
  ['double/halve', genDoubleHalve],
] as const;

describe('interactive generators', () => {
  for (const [name, gen] of INTERACTIVE) {
    it(`${name}: always produces a gradeable question`, () => {
      for (const cls of CLASSES) {
        for (const diff of DIFFS) {
          for (let i = 0; i < 150; i++) {
            const q = gen(cls, diff);
            // The stated answer must always grade as correct.
            expect(grade(q, expectedAnswer(q)), `${name} ${cls}/${diff}: ${q.questionText}`).toBe(true);
            expect(q.questionText.length).toBeGreaterThan(0);
            expect(q.questionText).not.toMatch(/NaN|undefined|Infinity/);
          }
        }
      }
    });
  }

  it('factor select: every "correct" value really divides the number', () => {
    for (let i = 0; i < 400; i++) {
      const q = genFactorSelect('4th', 'medium');
      const n = Number(q.questionText.match(/of (\d+)/)![1]);
      const it = q.interaction;
      if (it?.kind !== 'multiSelect') throw new Error('wrong kind');
      for (const f of it.correct) expect(n % Number(f)).toBe(0);
      // and no distractor is secretly a factor
      const correctKeys = it.correct.map(String);
      for (const w of it.options.filter(o => !correctKeys.includes(String(o)))) {
        expect(n % Number(w)).not.toBe(0);
      }
    }
  });

  it('prime select: every "correct" value is prime and no distractor is', () => {
    for (let i = 0; i < 400; i++) {
      const q = genPrimeSelect('5th', 'medium');
      const it = q.interaction;
      if (it?.kind !== 'multiSelect') throw new Error('wrong kind');
      for (const c of it.correct) expect(isPrime(Number(c))).toBe(true);
      const correctKeys = it.correct.map(String);
      for (const w of it.options.filter(o => !correctKeys.includes(String(o)))) {
        expect(isPrime(Number(w))).toBe(false);
      }
    }
  });

  it('multiple select: every "correct" value is a real multiple', () => {
    for (let i = 0; i < 400; i++) {
      const q = genMultipleSelect('4th', 'medium');
      const base = Number(q.questionText.match(/of (\d+)/)![1]);
      const it = q.interaction;
      if (it?.kind !== 'multiSelect') throw new Error('wrong kind');
      for (const c of it.correct) expect(Number(c) % base).toBe(0);
      const correctKeys = it.correct.map(String);
      for (const w of it.options.filter(o => !correctKeys.includes(String(o)))) {
        expect(Number(w) % base).not.toBe(0);
      }
    }
  });

  it('order numbers: correct order genuinely sorts, and matches the prompt', () => {
    for (let i = 0; i < 400; i++) {
      const q = genOrderNumbers('4th', 'hard');
      const it = q.interaction;
      if (it?.kind !== 'ordering') throw new Error('wrong kind');
      const nums = it.correctOrder.map(Number);
      const sorted = [...nums].sort((a, b) => it.direction === 'desc' ? b - a : a - b);
      expect(nums).toEqual(sorted);
      // The wording must match the direction, or the task is unanswerable.
      expect(q.questionText).toContain(it.direction === 'desc' ? 'LARGEST' : 'SMALLEST');
    }
  });

  it('order decimals: values are distinct and correctly ascending', () => {
    for (let i = 0; i < 400; i++) {
      const q = genOrderDecimals('5th', 'medium');
      if (q.interaction?.kind !== 'ordering') throw new Error('wrong kind');
      const nums = q.interaction.correctOrder.map(Number);
      expect(new Set(nums).size).toBe(nums.length);
      expect(nums).toEqual([...nums].sort((a, b) => a - b));
    }
  });

  it('order fractions: smaller unit fraction has the larger denominator', () => {
    for (let i = 0; i < 200; i++) {
      const q = genOrderFractions('5th', 'medium');
      if (q.interaction?.kind !== 'ordering') throw new Error('wrong kind');
      const values = q.interaction.correctOrder.map(f => {
        const [n, d] = String(f).split('/').map(Number);
        return n / d;
      });
      expect(values).toEqual([...values].sort((a, b) => a - b));
    }
  });

  it('missing number: substituting the answer satisfies the equation', () => {
    for (const cls of CLASSES) {
      for (const diff of DIFFS) {
        for (let i = 0; i < 300; i++) {
          const q = genMissingNumber(cls, diff);
          const filled = q.questionText.replace('?', String(q.answer));
          const m = filled.match(/^(\d+)\s*([+−])\s*(\d+)\s*=\s*(\d+)$/);
          expect(m, `unparseable: ${filled}`).toBeTruthy();
          const [, a, op, b, result] = m!;
          const got = op === '+' ? Number(a) + Number(b) : Number(a) - Number(b);
          expect(got, filled).toBe(Number(result));
        }
      }
    }
  });

  it('missing number: never asks for a negative answer', () => {
    for (const cls of CLASSES) {
      for (let i = 0; i < 300; i++) {
        const q = genMissingNumber(cls, 'hard');
        expect(Number(q.answer)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('table recall: the arithmetic is correct', () => {
    for (let i = 0; i < 500; i++) {
      const q = genTableRecall('4th', 'hard');
      const [a, b] = q.questionText.match(/(\d+) × (\d+)/)!.slice(1).map(Number);
      expect(q.answer).toBe(a * b);
    }
  });

  it('double/halve: the arithmetic is correct and halves are whole', () => {
    for (let i = 0; i < 500; i++) {
      const q = genDoubleHalve('4th', 'medium');
      const dbl = q.questionText.match(/^Double (\d+)/);
      const half = q.questionText.match(/^Half of (\d+)/);
      if (dbl) expect(q.answer).toBe(Number(dbl[1]) * 2);
      if (half) {
        expect(Number(half[1]) % 2).toBe(0);
        expect(q.answer).toBe(Number(half[1]) / 2);
      }
    }
  });

  it('early classes are kept to age-appropriate magnitudes', () => {
    for (const cls of ['1st', '2nd'] as SchoolClass[]) {
      for (let i = 0; i < 300; i++) {
        const q = genMissingNumber(cls, 'hard');
        const nums = (q.questionText.match(/\d+/g) ?? []).map(Number);
        expect(Math.max(...nums, 0)).toBeLessThanOrEqual(20);
      }
    }
  });
});
