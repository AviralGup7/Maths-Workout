// Number sense strand — docs/14 §6.
//
// The audit measured 0 estimation questions in 27,000 sampled. The point of
// this strand is not merely to add a topic but to add a *construct*: knowing
// roughly how big an answer should be, before and independently of computing it.
//
// The tests below therefore check the pedagogy, not just the plumbing — in
// particular that estimating is genuinely easier than computing, which is what
// stops the strand collapsing back into arithmetic with extra steps.

import { describe, it, expect } from 'vitest';
import {
  genEstimation, genComparison, genReasonableness, genMentalStrategy,
  genNumberSenseStrand,
} from '../number-sense';
import { grade, expectedAnswer } from '../interactions';
import { generateQuestion } from '../index';
import type { SchoolClass, Difficulty } from '../types';
import { hasDevanagariDigits } from '../../i18n/strings';

const CLASSES: SchoolClass[] = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];

describe('estimation questions', () => {
  it('are gradeable by their own rule', () => {
    for (const cls of CLASSES) {
      for (let i = 0; i < 60; i++) {
        const q = genEstimation(cls, 'medium');
        expect(grade(q, expectedAnswer(q)), q.questionText).toBe(true);
      }
    }
  });

  it('offer exactly one band containing the true value', () => {
    // Two overlapping correct bands would make the question unanswerable.
    for (const cls of CLASSES) {
      for (let i = 0; i < 80; i++) {
        const q = genEstimation(cls, 'medium');
        const it = q.interaction as { kind: 'estimate'; bands: [number, number][]; low: number; high: number };
        const hits = it.bands.filter(([lo, hi]) => lo <= it.high && hi >= it.low);
        expect(hits.length, `${q.questionText} → ${JSON.stringify(it.bands)}`).toBe(1);
      }
    }
  });

  it('never present overlapping bands', () => {
    for (const cls of CLASSES) {
      for (let i = 0; i < 60; i++) {
        const q = genEstimation(cls, 'medium');
        const { bands } = q.interaction as { bands: [number, number][] };
        const sorted = [...bands].sort((a, b) => a[0] - b[0]);
        for (let j = 1; j < sorted.length; j++) {
          expect(sorted[j][0], `${q.questionText}`).toBeGreaterThan(sorted[j - 1][1]);
        }
      }
    }
  });

  it('use bands wide enough that estimating beats computing', () => {
    // If the band were narrow the child would have to compute exactly and then
    // place the result, which measures arithmetic and defeats the purpose.
    for (const cls of CLASSES) {
      for (let i = 0; i < 40; i++) {
        const q = genEstimation(cls, 'medium');
        const it = q.interaction as { low: number; high: number };
        const mid = (it.low + it.high) / 2;
        const width = it.high - it.low;
        expect(width / Math.max(1, mid), q.questionText).toBeGreaterThan(0.15);
      }
    }
  });

  it('never produce a negative band', () => {
    // Regression: browser testing found "-10–100" offered for a money question.
    // Negative quantities are nonsense to a child and quietly teach that a
    // negative number of notebooks is a plausible estimate.
    for (const cls of CLASSES) {
      for (let i = 0; i < 200; i++) {
        const { bands } = genEstimation(cls, 'medium').interaction as { bands: [number, number][] };
        for (const [lo, hi] of bands) {
          expect(lo, `${lo}-${hi}`).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('never produce a non-finite or inverted band', () => {
    for (const cls of CLASSES) {
      for (let i = 0; i < 60; i++) {
        const { bands } = genEstimation(cls, 'medium').interaction as { bands: [number, number][] };
        for (const [lo, hi] of bands) {
          expect(Number.isFinite(lo) && Number.isFinite(hi)).toBe(true);
          expect(hi).toBeGreaterThan(lo);
        }
      }
    }
  });

  it('grade any overlapping band as correct, not just the exact label', () => {
    const q = genEstimation('4th', 'medium');
    const it = q.interaction as { low: number; high: number };
    // A band that straddles the true range is a correct estimate.
    expect(grade(q, `${it.low - 1}-${it.high + 1}`)).toBe(true);
    // One clearly outside it is not.
    expect(grade(q, `${it.high * 10}-${it.high * 20}`)).toBe(false);
  });

  it('are phrased as estimates in both languages', () => {
    for (const lang of ['en', 'hi'] as const) {
      for (let i = 0; i < 20; i++) {
        const q = genEstimation('4th', 'medium', lang);
        const marker = lang === 'hi' ? /लगभग/ : /about/i;
        expect(q.questionText, q.questionText).toMatch(marker);
        if (lang === 'hi') expect(hasDevanagariDigits(q.questionText)).toBe(false);
      }
    }
  });
});

describe('the other strands', () => {
  it('reasonableness is either a binary judgement or a correction', () => {
    // docs/21. The generator used to answer Yes/No ONLY, so the answer was
    // never numeric, `toEntry` always refused, and the skill was pinned at the
    // recognition ceiling (0.80) permanently — which made it the learner's only
    // never-consolidated skill and consumed 25.6% of a Class 1 learner's year.
    //
    // A wrong claim may now instead ask the child to CORRECT it, which tests
    // the same construct while producing recall evidence. Both forms must
    // remain well-formed: the answer is always among the choices, and the
    // binary form stays exactly two options (padding a judgement to four with
    // nonsense would make it easier, not harder).
    let binary = 0;
    let correction = 0;
    for (const cls of ['3rd', '5th'] as SchoolClass[]) {
      for (let i = 0; i < 200; i++) {
        const q = genReasonableness(cls, 'medium');
        expect(q.choices.map(String)).toContain(String(q.answer));
        if (q.choices.length === 2) binary++;
        else { correction++; expect(typeof q.answer).toBe('number'); }
      }
    }
    // Both forms must actually occur, or one of them has silently died.
    expect(binary).toBeGreaterThan(0);
    expect(correction).toBeGreaterThan(0);
  });

  it('comparison questions have a single unambiguous largest value', () => {
    for (let i = 0; i < 40; i++) {
      const q = genComparison('5th', 'medium');
      expect(q.choices.length).toBe(4);
      expect(new Set(q.choices.map(String)).size).toBe(4);
      expect(q.choices.map(String)).toContain(String(q.answer));
    }
  });

  it('mental strategy questions offer four distinct methods', () => {
    for (let i = 0; i < 30; i++) {
      const q = genMentalStrategy('4th', 'medium');
      expect(q.choices.length).toBe(4);
      expect(new Set(q.choices.map(String)).size).toBe(4);
    }
  });

  it('the dispatcher never throws and always grades', () => {
    for (const cls of CLASSES) {
      for (const d of DIFFS) {
        for (let i = 0; i < 40; i++) {
          const q = genNumberSenseStrand(cls, d);
          expect(grade(q, expectedAnswer(q)), q.questionText).toBe(true);
        }
      }
    }
  });

  it('every strand tags itself as number_sense for attribution', () => {
    for (let i = 0; i < 40; i++) {
      expect(genNumberSenseStrand('5th', 'medium').resolvedCategory).toBe('number_sense');
    }
  });
});

describe('the estimation gap is actually closed', () => {
  it('estimation reaches the live question stream', () => {
    // The regression this guards: the strand exists but is never dispatched,
    // which is exactly the state the audit found (0 of 1,720).
    let est = 0;
    let total = 0;
    for (const cls of CLASSES) {
      for (const d of DIFFS) {
        for (let i = 0; i < 60; i++) {
          const q = generateQuestion(cls, d, 'number_sense');
          total++;
          if (q.interaction?.kind === 'estimate') est++;
        }
      }
    }
    expect(total).toBeGreaterThan(0);
    expect(est / total, `${est}/${total} were estimation`).toBeGreaterThan(0.15);
  });
});
