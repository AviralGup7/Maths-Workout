// ─── Mathematical reasoning ──────────────────────────────────────────────────
// docs/14 §7 (R2 error hunting) and §8 (patterns, symmetry).
//
// The audit found 0 reasoning questions: everything asked "what is the answer",
// nothing asked "why", "how do you know", or "is that right".
//
// The constraint that shapes this file is D5 — if it cannot be graded offline
// and deterministically, it does not ship. That rules out free-text
// explanation, which is the gold standard pedagogically and which we therefore
// deliberately do not attempt. The formats below capture most of the benefit
// inside the constraint.

import type { SchoolClass, Difficulty, Question } from './types';
import { ri, pick, shuffleArr, makeStrChoices } from './helpers';
import { columnwiseAbsDiff, concatDigitwise } from '../learning/misconceptions';
import type { Lang } from '../i18n/strings';

// ─── R2 · Error hunting ──────────────────────────────────────────────────────

/**
 * Show a worked solution containing a planted error; ask which step went wrong.
 *
 * docs/14 calls this the strongest item in §7, for three reasons:
 *   · it requires EVALUATING a procedure rather than executing one, which
 *     builds conceptual understanding more than further practice
 *   · it is fully gradeable — the wrong step is a known index
 *   · the planted error is generated from the existing misconception library,
 *     so it is a real error children make, not an invented one
 *
 * Gated at mastery > 0.60 by the caller: asking a struggling child to audit
 * someone else's method, when they cannot yet execute it themselves, adds
 * cognitive load without adding understanding.
 */
export function genErrorHunt(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  const names = lang === 'hi' ? ['प्रिया', 'आरव', 'मीरा', 'कबीर'] : ['Priya', 'Aarav', 'Meera', 'Kabir'];
  const who = pick(names);
  const n = classNumber(cls);

  type Hunt = { lines: string[]; wrongStep: number; shown: number };
  const builders: (() => Hunt)[] = [];

  // Subtraction with borrowing — sub.smaller-from-larger, the most common
  // misconception in the library.
  builders.push(() => {
    let a = ri(31, 92), b = ri(13, a - 10);
    // Force a borrow, or there is no error to plant.
    if (a % 10 >= b % 10) { const d = (b % 10) - (a % 10) + 1; b = b + d <= a ? b + d : b; }
    if (a % 10 >= b % 10) { a = a - (a % 10) + (b % 10) - 1; }
    const wrongOnes = Math.abs((a % 10) - (b % 10));
    const wrongTens = Math.floor(a / 10) - Math.floor(b / 10);
    return {
      lines: lang === 'hi'
        ? [`इकाई: ${a % 10} − ${b % 10} → ${wrongOnes} लिखा`,
           `दहाई: ${Math.floor(a / 10)} − ${Math.floor(b / 10)} → ${wrongTens} लिखा`]
        : [`Ones: ${a % 10} − ${b % 10} → wrote ${wrongOnes}`,
           `Tens: ${Math.floor(a / 10)} − ${Math.floor(b / 10)} → wrote ${wrongTens}`],
      wrongStep: 1,
      shown: columnwiseAbsDiff(a, b),
    };
  });

  // Addition without carrying — add.forgot-carry.
  if (n >= 2) {
    builders.push(() => {
      const a = ri(24, 78), b = ri(15, 49);
      const onesSum = (a % 10) + (b % 10);
      const carried = onesSum >= 10;
      const tens = Math.floor(a / 10) + Math.floor(b / 10);
      return {
        lines: lang === 'hi'
          ? [`इकाई: ${a % 10} + ${b % 10} = ${onesSum} → ${onesSum % 10} लिखा`,
             `दहाई: ${Math.floor(a / 10)} + ${Math.floor(b / 10)} = ${tens} लिखा`]
          : [`Ones: ${a % 10} + ${b % 10} = ${onesSum} → wrote ${onesSum % 10}`,
             `Tens: ${Math.floor(a / 10)} + ${Math.floor(b / 10)} = ${tens}`],
        // The carry is dropped in the TENS step, not the ones step: the ones
        // digit written is actually correct. That subtlety is the whole point.
        wrongStep: carried ? 2 : 1,
        shown: Number(`${tens}${onesSum % 10}`),
      };
    });
  }

  // Multiplication read as addition — mul.added-instead.
  if (n >= 3) {
    builders.push(() => {
      const a = ri(4, 9), b = ri(4, 9);
      return {
        lines: lang === 'hi'
          ? [`${a} के ${b} समूह गिने`, `${a} + ${b} = ${a + b} लिखा`]
          : [`Counted ${b} groups of ${a}`, `Wrote ${a} + ${b} = ${a + b}`],
        wrongStep: 2,
        shown: a + b,
      };
    });
  }

  const h = pick(builders)();
  const stepLabel = (i: number) => lang === 'hi' ? `चरण ${i}` : `Step ${i}`;
  const neither = lang === 'hi' ? 'कोई गलती नहीं' : 'Neither step';

  const body = h.lines.map((l, i) => `${stepLabel(i + 1)}  ${l}`).join('\n');
  const header = lang === 'hi'
    ? `${who} ने ऐसे हल किया:`
    : `${who} worked it out like this:`;
  const ask = lang === 'hi' ? 'कौन-सा चरण गलत है?' : 'Which step went wrong?';

  const options = [stepLabel(1), stepLabel(2), stepLabel(3), neither];

  return {
    questionText: `${header}\n${body}\n${lang === 'hi' ? 'उत्तर' : 'Answer'}: ${h.shown}\n\n${ask}`,
    answer: stepLabel(h.wrongStep),
    // "Neither" must be present or the task degrades into "spot which of two",
    // and a child could score 50% without evaluating anything.
    choices: shuffleArr(options.slice(0, 3).concat(neither)),
    resolvedCategory: 'number_sense',
  };
}

// ─── R3 · Patterns ───────────────────────────────────────────────────────────

/**
 * Continue a sequence, and — at higher classes — name the rule.
 *
 * NCERT Ganita Prakash Chapter 1, and the entry point to algebraic reasoning.
 * The audit found it entirely missing.
 *
 * Asking for the RULE rather than only the next term matters: a child can often
 * continue `2, 4, 6, __` by ear without any generalisation, and generalisation
 * is the thing that transfers to algebra.
 */
export function genPattern(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  const n = classNumber(cls);

  type Pat = { seq: number[]; next: number; rule: string; wrongRules: string[] };
  const builders: (() => Pat)[] = [];

  // Arithmetic (constant step)
  builders.push(() => {
    const start = ri(1, 9), step = pick([2, 3, 5, 10]);
    const seq = [0, 1, 2, 3].map(i => start + i * step);
    return {
      seq, next: start + 4 * step,
      rule: lang === 'hi' ? `हर बार ${step} जोड़ें` : `Add ${step} each time`,
      wrongRules: lang === 'hi'
        ? [`हर बार ${step + 1} जोड़ें`, `हर बार ${step} गुणा करें`, `हर बार ${step} घटाएँ`]
        : [`Add ${step + 1} each time`, `Multiply by ${step} each time`, `Subtract ${step} each time`],
    };
  });

  // Geometric (doubling)
  if (n >= 3) {
    builders.push(() => {
      const start = pick([1, 2, 3]);
      const seq = [0, 1, 2, 3].map(i => start * Math.pow(2, i));
      return {
        seq, next: start * 16,
        rule: lang === 'hi' ? 'हर बार दुगुना करें' : 'Double each time',
        wrongRules: lang === 'hi'
          ? ['हर बार 2 जोड़ें', 'हर बार तिगुना करें', 'हर बार 4 जोड़ें']
          : ['Add 2 each time', 'Triple each time', 'Add 4 each time'],
      };
    });
  }

  // Growing difference — 2, 6, 12, 20 (n(n+1))
  if (n >= 5) {
    builders.push(() => {
      const seq = [1, 2, 3, 4].map(k => k * (k + 1));
      return {
        seq, next: 5 * 6,
        rule: lang === 'hi' ? 'अंतर हर बार 2 बढ़ता है' : 'The gap grows by 2 each time',
        wrongRules: lang === 'hi'
          ? ['हर बार 4 जोड़ें', 'हर बार दुगुना करें', 'अंतर हर बार 3 बढ़ता है']
          : ['Add 4 each time', 'Double each time', 'The gap grows by 3 each time'],
      };
    });
  }

  const pat = pick(builders)();
  const askRule = n >= 4 && Math.random() < 0.4;

  if (askRule) {
    return {
      questionText: lang === 'hi'
        ? `${pat.seq.join(', ')}, …\nयह पैटर्न किस नियम से चलता है?`
        : `${pat.seq.join(', ')}, …\nWhat is the rule for this pattern?`,
      answer: pat.rule,
      choices: makeStrChoices(pat.rule, [pat.rule, ...pat.wrongRules]),
      resolvedCategory: 'number_sense',
    };
  }

  // Distractors must be DISTINCT: for 1, 2, 4, 8 the answer is 16, and both
  // "next + 1" and "next + first gap" give 17, which would render a grid with
  // a repeated tile and a free elimination.
  const gap = pat.seq[1] - pat.seq[0];
  const lastGap = pat.seq[pat.seq.length - 1] - pat.seq[pat.seq.length - 2];
  const candidates = [
    pat.next + 1, pat.next - 1,
    pat.seq[pat.seq.length - 1] + gap,      // continued with the FIRST gap
    pat.next + lastGap, pat.next + 2, pat.next - 2,
  ];
  const distractors: number[] = [];
  for (const v of candidates) {
    if (distractors.length >= 3) break;
    if (v === pat.next || v <= 0 || distractors.includes(v)) continue;
    distractors.push(v);
  }
  let pad = 3;
  while (distractors.length < 3) {
    const v = pat.next + pad;
    if (v !== pat.next && !distractors.includes(v)) distractors.push(v);
    pad++;
  }
  return {
    questionText: lang === 'hi'
      ? `पैटर्न पूरा करें: ${pat.seq.join(', ')}, ?`
      : `Continue the pattern: ${pat.seq.join(', ')}, ?`,
    answer: pat.next,
    choices: shuffleArr([pat.next, ...distractors]),
    resolvedCategory: 'number_sense',
  };
}

// ─── Symmetry ────────────────────────────────────────────────────────────────

/**
 * Lines of symmetry in a named shape.
 *
 * NCERT Ganita Prakash Chapter 9. Restricted to a fixed library of clean
 * shapes with unambiguous, well-known answers — an irregular shape rendered at
 * phone size would make the question about eyesight rather than geometry.
 */
const SYMMETRY: { en: string; hi: string; lines: number }[] = [
  { en: 'Square',            hi: 'वर्ग',           lines: 4 },
  { en: 'Rectangle',         hi: 'आयत',            lines: 2 },
  { en: 'Equilateral triangle', hi: 'समबाहु त्रिभुज', lines: 3 },
  { en: 'Circle',            hi: 'वृत्त',          lines: 0 },  // handled below
  { en: 'Regular pentagon',  hi: 'सम पंचभुज',      lines: 5 },
  { en: 'Regular hexagon',   hi: 'सम षट्भुज',      lines: 6 },
  { en: 'Isosceles triangle', hi: 'समद्विबाहु त्रिभुज', lines: 1 },
];

export function genSymmetry(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  // A circle has infinitely many lines of symmetry, which is not a number a
  // child can select from four tiles — so it is excluded rather than given a
  // misleading finite answer.
  const pool = SYMMETRY.filter(s => s.en !== 'Circle');
  const shape = pick(pool);
  const name = lang === 'hi' ? shape.hi : shape.en;

  const distractors = new Set<number>();
  for (const s of pool) if (s.lines !== shape.lines) distractors.add(s.lines);
  const wrong = shuffleArr([...distractors]).slice(0, 3);

  return {
    questionText: lang === 'hi'
      ? `${name} में समरूपता की कितनी रेखाएँ हैं?`
      : `How many lines of symmetry does a ${name} have?`,
    answer: shape.lines,
    choices: shuffleArr([shape.lines, ...wrong]),
    resolvedCategory: 'shapes',
  };
}

function classNumber(cls: SchoolClass): number {
  return ['1st', '2nd', '3rd', '4th', '5th', '6th'].indexOf(cls) + 1;
}
