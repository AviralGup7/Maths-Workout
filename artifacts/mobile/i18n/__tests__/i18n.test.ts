// Ensures Hindi is genuinely complete rather than partially wired.
// A half-translated interface is worse than none: the child hits English
// mid-sentence exactly when they are already struggling.

import { describe, it, expect } from 'vitest';
import {
  S, t, Q, q, CATEGORY_NAMES, categoryLabel, categoryDesc,
  SHAPE_NAMES, shapeName, LANGUAGES, names, item, money, ITEMS,
} from '../strings';
import { MISCONCEPTIONS_HI } from '../misconceptions-hi';
import { MISCONCEPTIONS } from '../../learning/misconceptions';
import { TOPIC_AVAILABILITY } from '../../curriculum/boards';
import { genWordProblemsI18n } from '../../generators/word-problems-i18n';
import { genMoneyI18n, INDIAN_COINS } from '../../generators/money-i18n';
import type { SchoolClass, Difficulty, Category } from '../../generators/types';

describe('translation completeness', () => {
  it('every UI string has a non-empty Hindi value', () => {
    for (const [key, val] of Object.entries(S)) {
      expect(val.en.length, `${key}.en`).toBeGreaterThan(0);
      expect(val.hi.length, `${key}.hi`).toBeGreaterThan(0);
    }
  });

  it('Hindi differs from English (nothing left untranslated)', () => {
    const untranslated = Object.entries(S)
      .filter(([, v]) => v.en === v.hi)
      // Proper nouns and symbols may legitimately match.
      .map(([k]) => k);
    expect(untranslated).toEqual([]);
  });

  it('every category has a Hindi name and description', () => {
    for (const cat of Object.keys(TOPIC_AVAILABILITY) as Category[]) {
      const entry = CATEGORY_NAMES[cat];
      expect(entry, `${cat} has no translation`).toBeDefined();
      expect(entry.hi.length).toBeGreaterThan(0);
      expect(entry.descHi.length).toBeGreaterThan(0);
    }
  });

  it('every misconception has Hindi copy', () => {
    for (const id of Object.keys(MISCONCEPTIONS)) {
      const hi = MISCONCEPTIONS_HI[id];
      expect(hi, `${id} has no Hindi translation`).toBeDefined();
      expect(hi.label.length).toBeGreaterThan(0);
      expect(hi.explanation.length).toBeGreaterThan(15);
      expect(hi.remediation.length).toBeGreaterThan(15);
    }
  });

  it('has no orphaned Hindi misconception entries', () => {
    for (const id of Object.keys(MISCONCEPTIONS_HI)) {
      expect(MISCONCEPTIONS[id], `${id} exists only in Hindi`).toBeDefined();
    }
  });

  it('every shape has a Hindi name', () => {
    for (const [name, e] of Object.entries(SHAPE_NAMES)) {
      expect(e.hi.length, name).toBeGreaterThan(0);
      expect(e.hi).not.toBe(e.en);
    }
  });

  it('every word-problem item has a Hindi name', () => {
    for (const [key, e] of Object.entries(ITEMS)) {
      expect(e.hi.length, key).toBeGreaterThan(0);
    }
  });
});

describe('lookup helpers', () => {
  it('returns the right language', () => {
    expect(t('check', 'en')).toBe('Check');
    expect(t('check', 'hi')).toBe('जाँचें');
    expect(categoryLabel('addition', 'hi')).toBe('जोड़');
    expect(shapeName('Triangle', 'hi')).toBe('त्रिभुज');
  });

  it('degrades gracefully on an unknown key', () => {
    expect(t('no_such_key', 'hi')).toBe('no_such_key');
    expect(categoryLabel('no_such_cat', 'hi')).toBe('no_such_cat');
    expect(categoryDesc('no_such_cat', 'hi')).toBe('');
  });

  it('renders question phrases in both languages', () => {
    expect(q('double', 'en', 4)).toBe('Double 4 = ?');
    expect(q('double', 'hi', 4)).toContain('दुगुना');
    expect(q('tapAllFactors', 'hi', 12)).toContain('गुणनखंड');
    expect(q('whichIsBigger', 'en')).toBe('Which is bigger?');
  });

  it('every question phrase exists in both languages', () => {
    for (const [key, entry] of Object.entries(Q)) {
      expect(typeof entry.en, key).toBe('function');
      expect(typeof entry.hi, key).toBe('function');
      const en = entry.en(5, 3);
      const hi = entry.hi(5, 3);
      expect(en.length, key).toBeGreaterThan(0);
      expect(hi.length, key).toBeGreaterThan(0);
      expect(hi, `${key} appears untranslated`).not.toBe(en);
    }
  });

  it('offers exactly English and Hindi', () => {
    expect(LANGUAGES.map(l => l.key)).toEqual(['en', 'hi']);
    expect(LANGUAGES.find(l => l.key === 'hi')!.nativeLabel).toBe('हिन्दी');
  });
});

describe('Indian localisation of content', () => {
  it('uses Indian names, not Tom and Jane', () => {
    const en = names('en');
    expect(en).toContain('Aarav');
    expect(en).not.toContain('Tom');
    expect(en).not.toContain('Jane');
    expect(names('hi')).toContain('आरव');
  });

  it('formats money in rupees', () => {
    expect(money(50)).toBe('₹50');
    expect(money(50)).not.toContain('€');
  });

  it('translates items', () => {
    expect(item('mangoes', 'hi')).toBe('आम');
    expect(item('mangoes', 'en')).toBe('mangoes');
  });
});

describe('localised money questions', () => {
  const ALL: SchoolClass[] = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

  it('always uses rupees, never euros or cents', () => {
    for (const lang of ['en', 'hi'] as const) {
      for (const cls of ALL) {
        for (let i = 0; i < 200; i++) {
          const qn = genMoneyI18n(cls, 'medium', lang);
          expect(qn.questionText).toContain('₹');
          expect(qn.questionText).not.toContain('€');
          // "9c + 2c" style euro-cent phrasing must be gone.
          expect(qn.questionText).not.toMatch(/\d+c\b/);
        }
      }
    }
  });

  it('produces valid, whole-rupee answers', () => {
    for (const lang of ['en', 'hi'] as const) {
      for (const cls of ALL) {
        for (const diff of ['easy', 'medium', 'hard'] as Difficulty[]) {
          for (let i = 0; i < 120; i++) {
            const qn = genMoneyI18n(cls, diff, lang);
            expect(qn.choices.map(String)).toContain(String(qn.answer));
            expect(qn.choices).toHaveLength(4);
            expect(Number.isInteger(Number(qn.answer))).toBe(true);
            expect(Number(qn.answer)).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  it('uses only real Indian coin denominations', () => {
    expect(INDIAN_COINS).toEqual([1, 2, 5, 10]);
  });

  it('renders in Hindi when selected', () => {
    let hits = 0;
    for (let i = 0; i < 150; i++) {
      const qn = genMoneyI18n('3rd', 'medium', 'hi');
      if (/[\u0900-\u097F]/.test(qn.questionText)) hits++;
    }
    expect(hits).toBe(150);
  });
});

describe('localised word problems', () => {
  const CLASSES: SchoolClass[] = ['3rd', '4th', '5th', '6th'];
  const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];

  it('generates valid questions in both languages', () => {
    for (const lang of ['en', 'hi'] as const) {
      for (const cls of CLASSES) {
        for (const diff of DIFFS) {
          for (let i = 0; i < 150; i++) {
            const qn = genWordProblemsI18n(cls, diff, lang);
            expect(qn.choices.map(String)).toContain(String(qn.answer));
            expect(qn.choices).toHaveLength(4);
            expect(qn.questionText).not.toMatch(/NaN|undefined|Infinity/);
            expect(Number(qn.answer)).toBeGreaterThanOrEqual(0);
            expect(Number.isInteger(Number(qn.answer))).toBe(true);
          }
        }
      }
    }
  });

  it('never uses euros', () => {
    for (const lang of ['en', 'hi'] as const) {
      for (const cls of CLASSES) {
        for (let i = 0; i < 300; i++) {
          expect(genWordProblemsI18n(cls, 'medium', lang).questionText).not.toContain('€');
        }
      }
    }
  });

  it('renders Devanagari when Hindi is selected', () => {
    let devanagari = 0;
    for (let i = 0; i < 200; i++) {
      const qn = genWordProblemsI18n('4th', 'medium', 'hi');
      if (/[\u0900-\u097F]/.test(qn.questionText)) devanagari++;
    }
    expect(devanagari).toBe(200);
  });

  it('keeps numerals in Western Arabic form, as Indian schools teach', () => {
    for (let i = 0; i < 200; i++) {
      const qn = genWordProblemsI18n('4th', 'medium', 'hi');
      // Devanagari digits ०–९ must not appear inside arithmetic.
      expect(qn.questionText).not.toMatch(/[\u0966-\u096F]/);
    }
  });

  it('scales operand size with the board', () => {
    const sample = (board: 'cbse' | 'icse' | 'state') => {
      let total = 0;
      for (let i = 0; i < 400; i++) {
        const qn = genWordProblemsI18n('5th', 'hard', 'en', board);
        total += Math.max(...(qn.questionText.match(/\d+/g) ?? ['0']).map(Number));
      }
      return total / 400;
    };
    expect(sample('icse')).toBeGreaterThan(sample('state'));
  });
});
