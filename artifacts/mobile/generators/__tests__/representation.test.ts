// ─── docs/27 P3-07 / P3-09 guards ────────────────────────────────────────────
//
// These generators are asserting mathematical FACTS about equivalence and
// category membership, so the guard checks the mathematics, not the plumbing.
// A conversion item that says 3/4 = 0.7 would typecheck, render, and teach a
// child something false — that is the failure mode worth testing for.

import { describe, it, expect } from 'vitest';
import {
  genRepresentationConvert, genRepresentationMatch,
  genNonExample, genNonExampleSet, conceptCases,
} from '../representation';
import type { SchoolClass, Difficulty } from '../types';
import type { Lang } from '../../i18n/strings';

const CLASSES: SchoolClass[] = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];
const LANGS: Lang[] = ['en', 'hi'];

/** Parse any of "3/4", "0.75", "75%" to a number. */
function valueOf(s: string): number {
  const t = s.trim();
  if (t.endsWith('%')) return Number(t.slice(0, -1)) / 100;
  if (t.includes('/')) {
    const [a, b] = t.split('/').map(Number);
    return a / b;
  }
  return Number(t);
}

describe('P3-07 · multi-representation conversion', () => {
  it('the correct answer names the same quantity as the stem', () => {
    for (const cls of CLASSES) for (const d of DIFFS) for (const lang of LANGS) {
      for (let i = 0; i < 200; i++) {
        const q = genRepresentationConvert(cls, d, lang);
        // Pull the quantity out of the stem — the only token that parses.
        const shown = q.questionText.match(/\d+\/\d+|\d+(\.\d+)?%|\d+\.\d+|\b\d+\b/g) ?? [];
        const stemValues = shown.map(valueOf).filter(v => Number.isFinite(v));
        const answerValue = valueOf(String(q.answer));
        expect(Number.isFinite(answerValue), `${q.questionText} => ${q.answer}`).toBe(true);
        expect(
          stemValues.some(v => Math.abs(v - answerValue) < 1e-9),
          `${lang} ${cls} ${d}: "${q.questionText}" answered "${q.answer}" — no token in the stem equals it`,
        ).toBe(true);
      }
    }
  });

  it('exactly one tile is correct — no accidental second right answer', () => {
    // 50/100 and 1/2 are the SAME number, so a grid holding both has two
    // correct tiles and marks a right answer wrong. This is the defect the
    // `pct/100` guard in the generator exists for.
    for (const cls of CLASSES) for (const d of DIFFS) for (const lang of LANGS) {
      for (let i = 0; i < 200; i++) {
        const q = genRepresentationConvert(cls, d, lang);
        const target = valueOf(String(q.answer));
        const equal = q.choices.filter(c => {
          const v = valueOf(String(c));
          return Number.isFinite(v) && Math.abs(v - target) < 1e-9;
        });
        expect(equal.length, `${q.questionText} choices ${JSON.stringify(q.choices)}`).toBe(1);
      }
    }
  });

  it('presents four tiles and includes the answer', () => {
    for (const cls of CLASSES) for (const d of DIFFS) {
      for (let i = 0; i < 100; i++) {
        const q = genRepresentationConvert(cls, d);
        expect(q.choices).toHaveLength(4);
        expect(q.choices.map(String)).toContain(String(q.answer));
      }
    }
  });

  it('rotates the direction rather than always asking the easy way', () => {
    // Fraction to percentage is a rule most children can apply without
    // understanding. If the generator only ever asked that, it would measure
    // recall and report magnitude knowledge.
    const seen = new Set<string>();
    for (let i = 0; i < 600; i++) {
      const q = genRepresentationConvert('6th', 'hard');
      const to = String(q.answer).includes('%') ? 'percent'
               : String(q.answer).includes('/') ? 'fraction' : 'decimal';
      const from = q.questionText.includes('%') && to !== 'percent' ? 'percent'
                 : /\d\/\d/.test(q.questionText) && to !== 'fraction' ? 'fraction' : 'decimal';
      seen.add(`${from}->${to}`);
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });
});

describe('P3-07 · multi-representation matching', () => {
  it('every correct tile equals the anchor, and no distractor does', () => {
    for (const cls of CLASSES) for (const d of DIFFS) for (const lang of LANGS) {
      for (let i = 0; i < 150; i++) {
        const q = genRepresentationMatch(cls, d, lang);
        const it = q.interaction;
        expect(it?.kind).toBe('multiSelect');
        if (it?.kind !== 'multiSelect') continue;
        const anchorTok = q.questionText.match(/\d+\/\d+/);
        expect(anchorTok, q.questionText).not.toBeNull();
        const anchor = valueOf(anchorTok![0]);
        for (const c of it.correct) {
          expect(Math.abs(valueOf(String(c)) - anchor) < 1e-9,
            `${q.questionText}: "${c}" marked correct but is not equal`).toBe(true);
        }
        const wrong = it.options.filter(o => !it.correct.map(String).includes(String(o)));
        for (const w of wrong) {
          expect(Math.abs(valueOf(String(w)) - anchor) < 1e-9,
            `${q.questionText}: "${w}" is a distractor but IS equal to the anchor`).toBe(false);
        }
        expect(it.correct.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('never shows the anchor itself as a tile', () => {
    for (let i = 0; i < 400; i++) {
      const q = genRepresentationMatch('5th', 'medium');
      const it = q.interaction;
      if (it?.kind !== 'multiSelect') continue;
      const anchor = q.questionText.match(/\d+\/\d+/)![0];
      expect(it.options.map(String), q.questionText).not.toContain(anchor);
    }
  });
});

describe('P3-09 · non-examples', () => {
  it('every declared non-example genuinely fails the concept, and every example passes', () => {
    // Hand-checked against the definitions. Encoding the check here means a
    // future edit to the table cannot silently make a square "not a rectangle".
    const truth: Record<string, { notMembers: string[]; members: string[] }> = {
      'a rectangle': {
        notMembers: ['a parallelogram', 'a trapezium', 'a rhombus', 'a triangle'],
        members: ['a square', 'a long thin oblong'],
      },
      'a square': {
        notMembers: ['a rhombus', 'an oblong', 'a kite'],
        members: ['a tile with four equal sides and square corners'],
      },
      'a prime number': { notMembers: ['1', '9', '15', '21'], members: ['7', '13', '2', '29'] },
      'a multiple of 3': { notMembers: ['13', '20', '31'], members: ['12', '18', '27', '30'] },
      'an equivalent fraction to 1/2': { notMembers: ['2/3', '1/3', '3/5'], members: ['2/4', '5/10', '50/100'] },
      'a right angle': { notMembers: ['89°', '180°', '45°'], members: ['the corner of a book', '90°'] },
    };
    for (const c of conceptCases()) {
      const t = truth[c.concept.en];
      expect(t, `no truth table for "${c.concept.en}"`).toBeDefined();
      expect(c.nonExamples.map(e => e.en).sort()).toEqual([...t.notMembers].sort());
      expect(c.examples.map(e => e.en).sort()).toEqual([...t.members].sort());
    }
    // Independently verifiable cases, computed rather than tabulated.
    for (const s of ['1', '9', '15', '21']) {
      const n = Number(s);
      const isPrime = n > 1 && Array.from({ length: n - 2 }, (_, i) => i + 2).every(d => n % d !== 0);
      expect(isPrime, `${n} is listed as NOT prime`).toBe(false);
    }
    for (const s of ['7', '13', '2', '29']) {
      const n = Number(s);
      const isPrime = n > 1 && Array.from({ length: Math.max(0, n - 2) }, (_, i) => i + 2).every(d => n % d !== 0);
      expect(isPrime, `${n} is listed as prime`).toBe(true);
    }
    for (const s of ['13', '20', '31']) expect(Number(s) % 3, `${s} listed as NOT a multiple of 3`).not.toBe(0);
    for (const s of ['12', '18', '27', '30']) expect(Number(s) % 3, `${s} listed as a multiple of 3`).toBe(0);
    for (const s of ['2/4', '5/10', '50/100']) {
      const [a, b] = s.split('/').map(Number);
      expect(a / b, `${s} listed as equal to 1/2`).toBeCloseTo(0.5, 10);
    }
    for (const s of ['2/3', '1/3', '3/5']) {
      const [a, b] = s.split('/').map(Number);
      expect(a / b, `${s} listed as NOT equal to 1/2`).not.toBeCloseTo(0.5, 10);
    }
  });

  it('the answer is always a non-example OF THE CONCEPT ASKED, and never an example of it', () => {
    // Deliberately scoped per concept, not globally. "13" is an EXAMPLE of a
    // prime number and a NON-EXAMPLE of a multiple of 3 — both correct, and a
    // global membership set conflates them. The first draft of this test did
    // exactly that and failed on a generator that was right.
    for (const cls of CLASSES) for (const d of DIFFS) for (const lang of LANGS) {
      for (let i = 0; i < 200; i++) {
        const q = genNonExample(cls, d, lang);
        const c = conceptCases().find(cc =>
          q.questionText.includes(lang === 'hi' ? cc.concept.hi : cc.concept.en));
        expect(c, `no concept matched "${q.questionText}"`).toBeDefined();
        const non = new Set(c!.nonExamples.map(e => (lang === 'hi' ? e.hi : e.en)));
        const ex = new Set(c!.examples.map(e => (lang === 'hi' ? e.hi : e.en)));
        expect(non.has(String(q.answer)), `${q.questionText} => ${q.answer}`).toBe(true);
        expect(ex.has(String(q.answer)), `${q.questionText} => ${q.answer} is an EXAMPLE`).toBe(false);
        expect(q.choices.map(String)).toContain(String(q.answer));
        // Every other tile must be a member of the category, or the question
        // has more than one right answer.
        for (const t of q.choices.filter(x => String(x) !== String(q.answer))) {
          expect(ex.has(String(t)), `${q.questionText}: tile "${t}" is not an example of this concept`).toBe(true);
        }
      }
    }
  });

  it('capitalises the negation so a skim-reader is not silently penalised', () => {
    for (let i = 0; i < 200; i++) {
      expect(genNonExample('6th', 'medium', 'en').questionText).toContain('NOT');
      expect(genNonExampleSet('6th', 'medium', 'en').questionText).toContain('NOT');
      expect(genNonExample('6th', 'medium', 'hi').questionText).toContain('नहीं');
    }
  });

  it('the set form marks only non-examples correct', () => {
    for (const cls of CLASSES) for (const d of DIFFS) for (const lang of LANGS) {
      const nonSet = new Set(conceptCases().flatMap(c => c.nonExamples.map(e => (lang === 'hi' ? e.hi : e.en))));
      const exSet = new Set(conceptCases().flatMap(c => c.examples.map(e => (lang === 'hi' ? e.hi : e.en))));
      for (let i = 0; i < 120; i++) {
        const q = genNonExampleSet(cls, d, lang);
        const it = q.interaction;
        expect(it?.kind).toBe('multiSelect');
        if (it?.kind !== 'multiSelect') continue;
        for (const c of it.correct) expect(nonSet.has(String(c)), `correct tile "${c}"`).toBe(true);
        const wrong = it.options.filter(o => !it.correct.map(String).includes(String(o)));
        for (const w of wrong) expect(exSet.has(String(w)), `distractor "${w}" is not an example`).toBe(true);
      }
    }
  });

  it('keeps numerals Western Arabic in Hindi, per the semi-Hindi policy', () => {
    const devanagariDigits = /[\u0966-\u096F]/;
    for (const cls of CLASSES) for (const d of DIFFS) {
      for (let i = 0; i < 100; i++) {
        for (const q of [
          genNonExample(cls, d, 'hi'), genNonExampleSet(cls, d, 'hi'),
          genRepresentationConvert(cls, d, 'hi'), genRepresentationMatch(cls, d, 'hi'),
        ]) {
          expect(devanagariDigits.test(q.questionText), q.questionText).toBe(false);
          expect(devanagariDigits.test(String(q.answer)), String(q.answer)).toBe(false);
          for (const c of q.choices) expect(devanagariDigits.test(String(c)), String(c)).toBe(false);
        }
      }
    }
  });
});
