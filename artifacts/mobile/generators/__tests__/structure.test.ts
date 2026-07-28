import { describe, it, expect } from 'vitest';
import {
  genNumberBond, genBondFamily, genEquality, genFractionLine,
  genCompareFractions, genMultiplicativeCompare, genInverse, genRounding,
} from '../structure';
import { generateForSkill } from '../index';
import { grade } from '../interactions';
import { diagnose } from '../../learning/misconceptions';
import { SKILLS } from '../../learning/skills';
import type { SchoolClass } from '../types';

const CLASSES: SchoolClass[] = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
const ALL = [
  genNumberBond, genBondFamily, genEquality, genFractionLine,
  genCompareFractions, genMultiplicativeCompare, genInverse, genRounding,
];

describe('structural concept generators', () => {
  it('always offer the correct answer among the choices', () => {
    // The most basic property, and the one that makes a question unanswerable
    // when it breaks.
    for (const gen of ALL) {
      for (const cls of CLASSES) {
        for (let i = 0; i < 80; i++) {
          const q = gen(cls, 'medium');
          if (q.interaction && q.interaction.kind !== 'choice') continue;
          expect(q.choices.map(String), `${gen.name} @ ${cls}: ${q.questionText}`)
            .toContain(String(q.answer));
        }
      }
    }
  });

  it('never offer a duplicated tile', () => {
    // A repeated tile is a free elimination — the defect docs/27 records for
    // genPattern.
    for (const gen of ALL) {
      for (const cls of CLASSES) {
        for (let i = 0; i < 80; i++) {
          const q = gen(cls, 'medium');
          if (q.interaction && q.interaction.kind !== 'choice') continue;
          expect(new Set(q.choices.map(String)).size, `${gen.name}: ${q.questionText}`)
            .toBe(q.choices.length);
        }
      }
    }
  });

  it('grade their own answer as correct', () => {
    for (const gen of ALL) {
      for (let i = 0; i < 60; i++) {
        const q = gen('5th', 'medium');
        expect(grade(q, String(q.answer)), `${gen.name}: ${q.questionText}`).toBe(true);
      }
    }
  });
});

describe('equality as balance (P2-06)', () => {
  it('never presents the canonical a + b = □ form', () => {
    // The whole point: children read `=` operationally BECAUSE every equation
    // they meet has the answer immediately after it. A generator that emitted
    // canonical forms would reinforce the misconception it exists to repair.
    for (const cls of CLASSES) {
      for (let i = 0; i < 200; i++) {
        const q = genEquality(cls, 'medium');
        expect(q.questionText, q.questionText).not.toMatch(/[+\-]\s*\d+\s*=\s*_+\s*$/);
      }
    }
  });

  it('offers the operational-reading answer as a diagnostic distractor', () => {
    // Choosing "12" for 8 + 4 = □ + 5 must be DIAGNOSED, not merely marked
    // wrong — that answer is the single most informative thing a child can do
    // on this item.
    let found = 0;
    for (let i = 0; i < 300; i++) {
      const q = genEquality('4th', 'medium');
      const m = q.questionText.match(/^(\d+) \+ (\d+) = ___ \+ (\d+)$/);
      if (!m) continue;
      const left = Number(m[1]) + Number(m[2]);
      if (left === Number(q.answer)) continue;
      expect(q.choices.map(String)).toContain(String(left));
      expect(diagnose({
        skill: 'equality.balance', questionText: q.questionText,
        chosen: String(left), expected: String(q.answer),
        latencyMs: 6000, timedOut: false,
      })).toBe('equality.operational-reading');
      found++;
    }
    expect(found).toBeGreaterThan(20);
  });
});

describe('comparing fractions (P2-08)', () => {
  it('whole-number bias gives the wrong answer often enough to be corrected', () => {
    // A generated set where "bigger denominator wins" usually happens to work
    // would train the bias rather than defeat it.
    let biasWrong = 0;
    let sameNumerator = 0;
    for (let i = 0; i < 600; i++) {
      const q = genCompareFractions('5th', 'medium');
      const m = q.questionText.match(/(\d+)\/(\d+) or (\d+)\/(\d+)/);
      if (!m) continue;
      const [n1, d1, n2, d2] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
      if (n1 !== n2) continue;
      sameNumerator++;
      // The biased child picks the larger denominator.
      const biased = d1 > d2 ? `${n1}/${d1}` : `${n2}/${d2}`;
      if (biased !== String(q.answer)) biasWrong++;
    }
    expect(sameNumerator).toBeGreaterThan(50);
    // Same-numerator items are constructed so the bias is ALWAYS wrong.
    expect(biasWrong / sameNumerator).toBeGreaterThan(0.95);
  });

  it('is mathematically correct on every comparison', () => {
    for (let i = 0; i < 400; i++) {
      const q = genCompareFractions('5th', 'medium');
      const m = q.questionText.match(/(\d+)\/(\d+) or (\d+)\/(\d+)/);
      if (!m) continue;
      const v1 = Number(m[1]) / Number(m[2]);
      const v2 = Number(m[3]) / Number(m[4]);
      const truth = v1 > v2 ? `${m[1]}/${m[2]}` : `${m[3]}/${m[4]}`;
      expect(String(q.answer), q.questionText).toBe(truth);
    }
  });
});

describe('multiplicative comparison (P2-10)', () => {
  it('generates both additive and multiplicative phrasings', () => {
    // The contrast IS the teaching. Only one phrasing would leave the child
    // pattern-matching on the presence of a name and a number.
    let times = 0;
    let more = 0;
    for (let i = 0; i < 400; i++) {
      const t = genMultiplicativeCompare('5th', 'medium').questionText;
      if (/times as many/.test(t)) times++;
      else if (/more than/.test(t)) more++;
    }
    expect(times).toBeGreaterThan(100);
    expect(more).toBeGreaterThan(100);
  });

  it('is arithmetically correct in both phrasings', () => {
    for (let i = 0; i < 400; i++) {
      const q = genMultiplicativeCompare('5th', 'medium');
      const base = Number(q.questionText.match(/has (\d+) marbles/)![1]);
      const k = Number(q.questionText.match(/has (\d+) (?:times as many as|more than)/)![1]);
      const expected = /times as many/.test(q.questionText) ? base * k : base + k;
      expect(Number(q.answer), q.questionText).toBe(expected);
    }
  });
});

describe('number bonds (P2-05)', () => {
  it('varies which part of the relationship is missing', () => {
    // A generator that always hides the same slot teaches position, not
    // structure — the same habit that produces the equality misconception.
    const forms = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const t = genNumberBond('2nd', 'medium').questionText;
      if (/how many more/.test(t)) forms.add('part');
      else if (/altogether/.test(t)) forms.add('whole-end');
      else if (/^___/.test(t)) forms.add('whole-start');
    }
    expect(forms.size).toBe(3);
  });

  it('parts always sum to the whole', () => {
    for (const cls of CLASSES) {
      for (let i = 0; i < 200; i++) {
        const q = genNumberBond(cls, 'medium');
        const nums = (q.questionText.match(/\d+/g) ?? []).map(Number);
        const all = [...nums, Number(q.answer)].sort((a, b) => b - a);
        expect(all[0], q.questionText).toBe(all.slice(1).reduce((x, y) => x + y, 0));
      }
    }
  });
});

describe('wiring', () => {
  it('every new skill is served by its dedicated generator', () => {
    // Without this, generateForSkill silently falls through to the category
    // dispatcher and the child never meets the concept at all.
    const map: Record<string, RegExp> = {
      'bonds.basic': /how many more|altogether|is made of|makes/i,
      'equality.balance': /=|true/i,
      'frac.numberline': /between 0 and 1|sit between|equal parts/i,
      'frac.compare': /bigger|order/i,
      'compare.multiplicative': /times as many|more than/i,
      'inverse.basic': /You know/i,
      'rounding.decide': /Round|report that number/i,
    };
    for (const [skill, re] of Object.entries(map)) {
      expect(SKILLS[skill], `${skill} missing from SKILLS`).toBeDefined();
      for (const cls of ['3rd', '4th', '5th', '6th'] as SchoolClass[]) {
        const q = generateForSkill(cls, 'medium', SKILLS[skill].category, skill);
        expect(q.questionText, `${skill} @ ${cls}: ${q.questionText}`).toMatch(re);
      }
    }
  });

  it('renders in Hindi with Western Arabic numerals only', () => {
    for (const gen of ALL) {
      for (let i = 0; i < 60; i++) {
        const q = gen('5th', 'medium', 'hi');
        expect(q.questionText).not.toMatch(/[०-९]/);
        expect(q.questionText).not.toContain('${');
        for (const c of q.choices) expect(String(c)).not.toMatch(/[०-९]/);
      }
    }
  });
});
