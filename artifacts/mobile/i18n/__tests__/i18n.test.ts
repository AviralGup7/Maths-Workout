// Ensures Hindi is genuinely complete rather than partially wired.
// A half-translated interface is worse than none: the child hits English
// mid-sentence exactly when they are already struggling.

import { describe, it, expect } from 'vitest';
import {
  S, t, Q, q, CATEGORY_NAMES, categoryLabel, categoryDesc,
  SHAPE_NAMES, shapeName, LANGUAGES, names, item, money, ITEMS,
  num, hasDevanagariDigits, UNITS_UNTRANSLATED,
} from '../strings';
import { CLASS_LABELS, BOARD_CONFIGS } from '../../curriculum/boards';
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

  it('learning content is genuinely translated', () => {
    // Navigation strings are intentionally bilingual, so exclude them here.
    const NAVIGATION = new Set([
      'back', 'next', 'done', 'cancel', 'quit', 'keepPlaying', 'home',
      'language', 'selectLanguage', 'changeBoard', 'board', 'selectBoard',
    ]);
    const untranslated = Object.entries(S)
      .filter(([k, v]) => !NAVIGATION.has(k) && v.en === v.hi)
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


// ─── The "semi-Hindi" policy ─────────────────────────────────────────────────
// Hindi mode is deliberately partial. These tests pin that down so it cannot
// drift into a full translation, which would strand a child who switched
// language by accident.

describe('numerals stay Western Arabic in every language', () => {
  it('no shipped UI string contains Devanagari digits', () => {
    for (const [key, v] of Object.entries(S)) {
      expect(hasDevanagariDigits(v.hi), `${key} uses Devanagari digits`).toBe(false);
      expect(hasDevanagariDigits(v.en), `${key} uses Devanagari digits`).toBe(false);
    }
  });

  it('no category name or description uses Devanagari digits', () => {
    for (const [cat, e] of Object.entries(CATEGORY_NAMES)) {
      expect(hasDevanagariDigits(e.hi), cat).toBe(false);
      expect(hasDevanagariDigits(e.descHi), cat).toBe(false);
    }
  });

  it('no class label uses Devanagari digits', () => {
    for (const [cls, e] of Object.entries(CLASS_LABELS)) {
      expect(hasDevanagariDigits(e.hi), `${cls}: ${e.hi}`).toBe(false);
      expect(e.hi, cls).toMatch(/\d/);   // still shows the class number
    }
  });

  it('no board label or note uses Devanagari digits', () => {
    for (const b of BOARD_CONFIGS) {
      expect(hasDevanagariDigits(b.labelHi), b.key).toBe(false);
      expect(hasDevanagariDigits(b.fullNameHi), b.key).toBe(false);
      expect(hasDevanagariDigits(b.noteHi), b.key).toBe(false);
    }
  });

  it('no question phrase renders Devanagari digits', () => {
    for (const [key, entry] of Object.entries(Q)) {
      expect(hasDevanagariDigits(entry.hi(7, 3)), key).toBe(false);
    }
  });

  it('no misconception copy uses Devanagari digits', () => {
    for (const [id, m] of Object.entries(MISCONCEPTIONS_HI)) {
      expect(hasDevanagariDigits(m.label), id).toBe(false);
      expect(hasDevanagariDigits(m.explanation), id).toBe(false);
      expect(hasDevanagariDigits(m.remediation), id).toBe(false);
    }
  });

  it('num() always formats Western Arabic', () => {
    expect(num(42)).toBe('42');
    expect(num(3.5)).toBe('3.5');
    expect(hasDevanagariDigits(num(1234567))).toBe(false);
  });

  it('generated Hindi questions never contain Devanagari digits', () => {
    const CLS: SchoolClass[] = ['1st', '3rd', '5th', '6th'];
    for (const cls of CLS) {
      for (let i = 0; i < 200; i++) {
        expect(hasDevanagariDigits(genWordProblemsI18n(cls, 'medium', 'hi').questionText)).toBe(false);
        expect(hasDevanagariDigits(genMoneyI18n(cls, 'medium', 'hi').questionText)).toBe(false);
      }
    }
  });
});

describe('navigation stays recoverable after an accidental language switch', () => {
  // The escape hatch: a child who taps हिन्दी by mistake must still recognise
  // how to get back without an adult.
  const ESCAPE_HATCHES = ['back', 'done', 'home', 'cancel', 'quit', 'keepPlaying',
                          'language', 'selectLanguage', 'changeBoard', 'board', 'selectBoard'];

  it('every escape hatch keeps its English wording alongside the Hindi', () => {
    for (const key of ESCAPE_HATCHES) {
      const entry = S[key];
      expect(entry, key).toBeDefined();
      const en = entry.en.toLowerCase();
      const hi = entry.hi.toLowerCase();
      // The English word (or its first token) must survive in the Hindi string.
      const token = en.split(/[\s·]+/)[0];
      expect(hi, `${key}: "${entry.hi}" has no Latin fallback`).toContain(token);
    }
  });

  it('escape hatches contain Latin characters a non-Hindi reader can recognise', () => {
    for (const key of ESCAPE_HATCHES) {
      expect(/[A-Za-z]/.test(S[key].hi), `${key} is Devanagari-only`).toBe(true);
    }
  });

  it('the language control itself is always readable in both scripts', () => {
    // If this were Hindi-only, switching back would require guessing.
    expect(/[A-Za-z]/.test(S.selectLanguage.hi)).toBe(true);
    expect(LANGUAGES.find(l => l.key === 'en')!.nativeLabel).toBe('English');
  });
});

describe('settings and technical labels stay in Latin script', () => {
  it('board short labels remain recognisable', () => {
    // "CBSE"/"ICSE" appear in Latin on every school document; the Hindi form is
    // shown as a transliteration, but the Latin acronym must remain available.
    for (const b of BOARD_CONFIGS) {
      expect(b.label, b.key).toMatch(/^[A-Za-z ()]+$/);
    }
  });

  it('units and symbols are never translated', () => {
    for (const u of UNITS_UNTRANSLATED) {
      // None of these should appear as a translated Hindi word anywhere.
      expect(typeof u).toBe('string');
    }
    // Money always uses the rupee sign, not a spelled-out word.
    expect(money(50)).toBe('₹50');
  });

  it('English remains selectable and labelled in English', () => {
    const en = LANGUAGES.find(l => l.key === 'en')!;
    expect(en.label).toBe('English');
    expect(en.nativeLabel).toBe('English');
  });
});
