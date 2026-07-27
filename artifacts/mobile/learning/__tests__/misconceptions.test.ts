import { describe, it, expect } from 'vitest';
import {
  diagnose, columnwiseAbsDiff, concatDigitwise, extractOperands,
  extractFractions, diagnosticDistractors, summariseMisconceptions, MISCONCEPTIONS,
} from '../misconceptions';

const base = { latencyMs: 5000, timedOut: false };

describe('error-pattern arithmetic', () => {
  it('models "smaller from larger" subtraction', () => {
    // 43 − 27: columns give |3-7|=4 and |4-2|=2 → 24 (real answer 16)
    expect(columnwiseAbsDiff(43, 27)).toBe(24);
    expect(columnwiseAbsDiff(52, 38)).toBe(26); // real answer is 14
    expect(columnwiseAbsDiff(90, 12)).toBe(82);
  });

  it('models digit-wise addition with no carrying', () => {
    // 47 + 35 → 7+5=12, 4+3=7 → "712"
    expect(concatDigitwise(47, 35)).toBe(712);
    expect(concatDigitwise(23, 45)).toBe(68); // no carry needed → correct
  });

  it('extracts operands, ignoring the answer placeholder', () => {
    expect(extractOperands('43 − 27 = ?')).toEqual([43, 27]);
    expect(extractOperands('6 × 4 = ?')).toEqual([6, 4]);
    expect(extractOperands('What is 15 more than 20?')).toEqual([15, 20]);
  });

  it('extracts fractions', () => {
    expect(extractFractions('1/2 + 1/3 = ?')).toEqual([{ n: 1, d: 2 }, { n: 1, d: 3 }]);
  });
});

describe('diagnose — subtraction', () => {
  it('detects subtracting the smaller digit from the larger', () => {
    expect(diagnose({
      ...base, questionText: '43 − 27 = ?', expected: '16', chosen: '24',
      skill: 'sub.2digit.borrow',
    })).toBe('sub.smaller-from-larger');
  });

  it('detects a reversed subtraction', () => {
    expect(diagnose({
      ...base, questionText: '27 − 43 = ?', expected: '-16', chosen: '16',
      skill: 'sub.2digit.borrow',
    })).toBe('sub.reversed');
  });
});

describe('diagnose — addition', () => {
  it('detects a dropped carry', () => {
    expect(diagnose({
      ...base, questionText: '47 + 35 = ?', expected: '82', chosen: '72',
      skill: 'add.2digit.carry',
    })).toBe('add.forgot-carry');
  });

  it('detects fully digit-wise addition', () => {
    expect(diagnose({
      ...base, questionText: '47 + 35 = ?', expected: '82', chosen: '712',
      skill: 'add.2digit.carry',
    })).toBe('add.digitwise');
  });
});

describe('diagnose — multiplication and division', () => {
  it('detects addition substituted for multiplication', () => {
    expect(diagnose({
      ...base, questionText: '6 × 4 = ?', expected: '24', chosen: '10',
      skill: 'mul.tables.mid',
    })).toBe('mul.added-instead');
  });

  it('detects a skip-counting slip', () => {
    expect(diagnose({
      ...base, questionText: '6 × 4 = ?', expected: '24', chosen: '18',
      skill: 'mul.tables.mid',
    })).toBe('mul.off-by-one-group');
  });

  it('detects a reversed division', () => {
    expect(diagnose({
      ...base, questionText: '2 ÷ 8 = ?', expected: '0.25', chosen: '4',
      skill: 'div.basic',
    })).toBe('div.reversed');
  });
});

describe('diagnose — fractions and decimals', () => {
  it('detects adding across numerator and denominator', () => {
    expect(diagnose({
      ...base, questionText: '1/2 + 1/3 = ?', expected: '5', chosen: '2',
      skill: 'frac.addSameDenom',
    })).toBe('frac.add-across');
  });

  it('detects "more digits means bigger"', () => {
    expect(diagnose({
      ...base, questionText: 'Which is bigger? 0.5 or 0.45', expected: '0.5', chosen: '0.45',
      skill: 'dec.hundredths',
    })).toBe('dec.longer-is-bigger');
  });
});

describe('diagnose — behavioural signals', () => {
  it('flags implausibly fast answers as guessing', () => {
    expect(diagnose({
      questionText: '347 + 285 = ?', expected: '632', chosen: '600',
      skill: 'add.3digit', latencyMs: 400, timedOut: false,
    })).toBe('guessing');
  });

  it('does not diagnose timeouts', () => {
    expect(diagnose({
      questionText: '43 − 27 = ?', expected: '16', chosen: '',
      skill: 'sub.2digit.borrow', latencyMs: 15000, timedOut: true,
    })).toBeNull();
  });

  it('does not diagnose correct answers', () => {
    expect(diagnose({
      ...base, questionText: '43 − 27 = ?', expected: '16', chosen: '16',
      skill: 'sub.2digit.borrow',
    })).toBeNull();
  });

  it('returns null for unrecognised error patterns', () => {
    expect(diagnose({
      ...base, questionText: '43 − 27 = ?', expected: '16', chosen: '99',
      skill: 'sub.2digit.borrow',
    })).toBeNull();
  });
});

describe('diagnostic distractors', () => {
  it('produces distractors that map back to real misconceptions', () => {
    const d = diagnosticDistractors('add.2digit.carry', 47, 35, 82);
    expect(d.length).toBeGreaterThan(0);
    for (const { value, misconception } of d) {
      expect(value).not.toBe(82);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(MISCONCEPTIONS[misconception]).toBeDefined();
    }
  });

  it('offers the classic wrong answer for borrowing', () => {
    const d = diagnosticDistractors('sub.2digit.borrow', 43, 27, 16);
    expect(d.map(x => x.value)).toContain(24);
  });

  it('offers the add-instead-of-multiply answer', () => {
    const d = diagnosticDistractors('mul.tables.mid', 6, 4, 24);
    expect(d.map(x => x.value)).toContain(10);
  });

  it('never offers negative values', () => {
    for (const skill of ['add.within10', 'sub.within10', 'mul.tables.easy', 'div.basic']) {
      for (let a = 1; a <= 12; a++) {
        for (let b = 1; b <= 12; b++) {
          const d = diagnosticDistractors(skill, a, b, a + b);
          d.forEach(x => expect(x.value).toBeGreaterThanOrEqual(0));
        }
      }
    }
  });

  it('never duplicates a distractor value', () => {
    const d = diagnosticDistractors('add.2digit.carry', 20, 20, 40);
    expect(new Set(d.map(x => x.value)).size).toBe(d.length);
  });
});

describe('summarising', () => {
  it('ranks misconceptions by frequency and ignores unknown ids', () => {
    const s = summariseMisconceptions([
      'add.forgot-carry', 'add.forgot-carry', 'mul.added-instead',
      undefined, 'legacy-import', 'not-a-real-id',
    ]);
    expect(s[0].id).toBe('add.forgot-carry');
    expect(s[0].count).toBe(2);
    expect(s).toHaveLength(2);
  });
});

describe('library integrity', () => {
  it('every misconception has complete guidance', () => {
    for (const [id, m] of Object.entries(MISCONCEPTIONS)) {
      expect(m.id).toBe(id);
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.explanation.length).toBeGreaterThan(20);
      expect(m.remediation.length).toBeGreaterThan(20);
    }
  });
});
