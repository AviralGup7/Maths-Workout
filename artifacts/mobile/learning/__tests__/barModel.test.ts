import { describe, it, expect } from 'vitest';
import { barModelFor, shouldShowBarModel, BAR_MODEL_HIDDEN_ABOVE } from '../barModelPolicy';
import { genWordProblemsI18n } from '../../generators/word-problems-i18n';
import type { SchoolClass, Difficulty } from '../../generators/types';

const CLASSES: SchoolClass[] = ['3rd', '4th', '5th', '6th'];
const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];

describe('bar model structure (docs/27 P3-05)', () => {
  it('tells comparison apart from part-whole', () => {
    // The whole reason to classify by SENTENCE rather than arithmetic.
    // "12 − 5" is the answer to both, and they are different pictures. A
    // child who cannot tell them apart guesses the operation.
    expect(barModelFor('A class has 12 boys and 5 girls.\nHow many children in total?')?.structure)
      .toBe('partWhole');
    expect(barModelFor('There are 12 boys and 5 girls.\nHow many more boys than girls?')?.structure)
      .toBe('difference');
  });

  it('tells sharing apart from equal groups', () => {
    // "shared equally among 6 children" also contains "each", so ordering
    // matters — equal groups would otherwise claim it.
    expect(barModelFor('24 chocolates shared equally among 6 children.\nHow many each?')?.structure)
      .toBe('sharing');
    expect(barModelFor('A box has 4 rows of 6 laddoos.\nHow many laddoos in total?')?.structure)
      .toBe('equalGroups');
  });

  it('puts the number of GROUPS first, whichever way the sentence runs', () => {
    // "4 rows of 6" states count then unit; "each crate holds 6, how many in
    // 4 crates" states unit then count. Drawing 6 groups of 4 is a different
    // problem, so the two phrasings must not be folded together.
    const rows = barModelFor('A box has 4 rows of 6 eggs.\nHow many eggs?');
    expect(rows).toEqual({ structure: 'equalGroups', a: 4, b: 6 });

    const crates = barModelFor('Each crate holds 6 apples.\nHow many in 4 crates?');
    expect(crates).toEqual({ structure: 'equalGroups', a: 4, b: 6 });
  });

  it('draws NOTHING for problems a tape diagram would misrepresent', () => {
    // This is a correctness property, not a coverage shortfall. A bar model
    // of speed asserts that distance is made of discrete 40-unit blocks,
    // which is itself a misconception. A diagram that lies about structure is
    // worse than none: the child follows it to the wrong operation, or learns
    // to ignore diagrams.
    for (const text of [
      'A bus travels at 40 km/h.\nHow many km in 3 hours?',
      'A team scored 180 runs in 20 overs.\nWhat is the run rate per over?',
      '20% of 150 students scored full marks.\nHow many students?',
    ]) {
      expect(barModelFor(text), text).toBeNull();
    }
  });

  it('refuses to guess when there are not two numbers', () => {
    expect(barModelFor('How many children altogether?')).toBeNull();
    expect(barModelFor('')).toBeNull();
  });

  it('covers a real share of the live word-problem stream, in both languages', () => {
    // Measured, not asserted. The first pass caught 25% (en) / 38% (hi); the
    // gap was equal-groups phrased as "each crate holds N" rather than
    // "N rows of". Both languages should now be close, because a Hindi-medium
    // child is the one most likely to need the diagram.
    const rate: Record<string, number> = {};
    for (const lang of ['en', 'hi'] as const) {
      let hit = 0;
      let total = 0;
      for (const cls of CLASSES) {
        for (const d of DIFFS) {
          for (let i = 0; i < 40; i++) {
            const q = genWordProblemsI18n(cls, d, lang);
            total++;
            if (barModelFor(q.questionText)) hit++;
          }
        }
      }
      rate[lang] = hit / total;
    }
    expect(rate.en, `en coverage ${(rate.en * 100).toFixed(0)}%`).toBeGreaterThan(0.35);
    expect(rate.hi, `hi coverage ${(rate.hi * 100).toFixed(0)}%`).toBeGreaterThan(0.35);
    // Neither language may be starved relative to the other.
    expect(Math.abs(rate.en - rate.hi), 'language coverage gap').toBeLessThan(0.15);
  });

  it('never produces a spec that cannot be drawn', () => {
    // BarModel bails on non-positive or non-finite operands. If the policy
    // ever emits one, the child sees a caption with no diagram under it.
    for (const lang of ['en', 'hi'] as const) {
      for (const cls of CLASSES) {
        for (const d of DIFFS) {
          for (let i = 0; i < 30; i++) {
            const spec = barModelFor(genWordProblemsI18n(cls, d, lang).questionText);
            if (!spec) continue;
            expect(Number.isFinite(spec.a) && spec.a > 0).toBe(true);
            expect(Number.isFinite(spec.b) && spec.b > 0).toBe(true);
          }
        }
      }
    }
  });

  it('fades out once the child can read the sentence unaided', () => {
    // Same principle as visualPolicy: leaving the scaffold up teaches
    // dependence on it rather than on reading.
    expect(shouldShowBarModel(0.2)).toBe(true);
    expect(shouldShowBarModel(BAR_MODEL_HIDDEN_ABOVE)).toBe(false);
    expect(shouldShowBarModel(0.95)).toBe(false);
  });
});
