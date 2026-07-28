import { describe, it, expect } from 'vitest';
import { generateQuestion, getAvailableCategories, generateForSkill } from '../../generators';
import { classifyQuestion } from '../../learning/skillSplit';
import { qp, QP } from '../questions';
import type { SchoolClass, Difficulty, Category } from '../../generators/types';

const CLASSES: SchoolClass[] = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];

/** Three or more consecutive Latin letters — a word, not a unit or an `x`. */
const LATIN_WORD = /[A-Za-z]{3,}/;

/**
 * Units, symbols and acronyms that stay Latin in Hindi BY POLICY.
 *
 * The user's rule: translate what is being LEARNED, keep what is being
 * NAVIGATED recognisable in both scripts. A child reads "km" on a road sign
 * and "STOP" on an octagon whichever language they are taught in.
 */
const ALLOWED_LATIN = /\b(km|kg|cm|mm|mL|L|g|m|STOP|HCF|LCM|CBSE|ICSE)\b/g;

function stripAllowed(s: string): string {
  return s.replace(ALLOWED_LATIN, '');
}

describe('Hindi question stream', () => {
  it('serves no English words to a Hindi-medium learner', () => {
    // The defect: `generateQuestion` had no `lang` parameter, so the i18n
    // dictionary could not be reached from the code that builds questions.
    // Measured before the fix: 4,642 of 9,000 sampled questions (51.6%)
    // contained English words, across 16 of 21 categories — every shapes,
    // time, place-value, counting, geometry, data, factors, algebra and ratio
    // question, and most of money.
    const offenders: string[] = [];
    let total = 0;
    for (const cls of CLASSES) {
      for (const cat of getAvailableCategories(cls)) {
        if (cat === 'tables') continue;
        for (const d of DIFFS) {
          for (let i = 0; i < 25; i++) {
            let q;
            try { q = generateQuestion(cls, d, cat as Category, undefined, 'hi'); }
            catch { continue; }
            total++;
            const text = stripAllowed(`${q.questionText} ${q.choices.map(String).join(' ')}`);
            if (LATIN_WORD.test(text) && offenders.length < 8) {
              offenders.push(`${cls}/${cat}/${d}: ${q.questionText.replace(/\n/g, ' | ')}`);
            }
          }
        }
      }
    }
    expect(total).toBeGreaterThan(3000);
    expect(offenders).toEqual([]);
  });

  it('keeps numerals Western Arabic in Hindi — the semi-Hindi rule', () => {
    // "कक्षा 5", never "कक्षा ५". A child must be able to read the numbers
    // after an accidental language switch, and Indian schooling uses Western
    // Arabic digits in maths regardless of medium.
    for (const cls of CLASSES) {
      for (const cat of getAvailableCategories(cls)) {
        if (cat === 'tables') continue;
        for (const d of DIFFS) {
          for (let i = 0; i < 12; i++) {
            let q;
            try { q = generateQuestion(cls, d, cat as Category, undefined, 'hi'); }
            catch { continue; }
            const text = `${q.questionText} ${q.choices.map(String).join(' ')}`;
            expect(text, `Devanagari numeral in ${cat}`).not.toMatch(/[०-९]/);
          }
        }
      }
    }
  });

  it('still serves English to an English-medium learner', () => {
    // The mirror of the first test: a fix that made everything Hindi would
    // pass that one and be equally broken.
    let english = 0;
    let total = 0;
    for (const cls of CLASSES) {
      for (const cat of getAvailableCategories(cls)) {
        if (cat === 'tables') continue;
        for (let i = 0; i < 12; i++) {
          let q;
          try { q = generateQuestion(cls, 'medium', cat as Category, undefined, 'en'); }
          catch { continue; }
          total++;
          if (!/[\u0900-\u097F]/.test(q.questionText)) english++;
        }
      }
    }
    expect(total).toBeGreaterThan(200);
    expect(english).toBe(total);
  });

  it('routes Hindi questions to the right sub-skill', () => {
    // `classifyQuestion` drives BOTH sub-skill routing and the P2-04 history
    // migration. An English-only matcher would leave every Hindi geometry,
    // measurement and data attempt stranded on the retired parent skill, which
    // the scheduler no longer serves — the child would silently stop being
    // given those concepts.
    for (const [parent, cat] of [
      ['geometry.basic', 'geometry'], ['measurement.basic', 'measurement'], ['data.basic', 'data'],
    ] as const) {
      let classified = 0;
      let total = 0;
      for (const cls of ['4th', '5th', '6th'] as SchoolClass[]) {
        for (const d of DIFFS) {
          for (let i = 0; i < 30; i++) {
            let q;
            try { q = generateQuestion(cls, d, cat as Category, undefined, 'hi'); }
            catch { continue; }
            total++;
            if (classifyQuestion(parent, q.questionText)) classified++;
          }
        }
      }
      expect(classified / total, `${parent} classified ${classified}/${total} in Hindi`)
        .toBeGreaterThan(0.9);
    }
  });

  it('every phrase has both languages and they differ', () => {
    // A Hindi entry copy-pasted from the English one would pass the stream
    // test only by accident of the word filter.
    for (const key of Object.keys(QP) as (keyof typeof QP)[]) {
      const entry = QP[key] as { en: (...a: any[]) => string; hi: (...a: any[]) => string };
      expect(typeof entry.en, `${key}.en`).toBe('function');
      expect(typeof entry.hi, `${key}.hi`).toBe('function');
    }
    // Spot-check a representative sample renders differently.
    expect(qp('howManySides', 'hi', 'वर्ग')).not.toBe(qp('howManySides', 'en', 'Square'));
    expect(qp('minsInHour', 'hi')).not.toBe(qp('minsInHour', 'en'));
    expect(qp('findMean', 'hi', '1, 2')).not.toBe(qp('findMean', 'en', '1, 2'));
  });

  it('localises skill-targeted generation too, not just category play', () => {
    // `generateForSkill` is what the adaptive scheduler calls. It has its own
    // dispatch table, so it can regress independently of `generateQuestion`.
    const offenders: string[] = [];
    for (const skill of ['geometry.area', 'data.mean', 'measurement.length',
                         'numsense.compare', 'patterns.basic', 'symmetry.basic']) {
      for (let i = 0; i < 25; i++) {
        const q = generateForSkill('5th', 'medium', 'geometry', skill, undefined, 'hi');
        const text = stripAllowed(`${q.questionText} ${q.choices.map(String).join(' ')}`);
        if (LATIN_WORD.test(text) && offenders.length < 5) {
          offenders.push(`${skill}: ${q.questionText.replace(/\n/g, ' | ')}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
