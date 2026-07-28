// ─── Open-ended tasks ────────────────────────────────────────────────────────
// docs/27 P1-18 (open-ended generators), P1-19 (Open Middle), P1-20 (reverse
// problems). All three depend on P1-17's set-valued grading, which is what
// lets a question have many right answers.
//
// docs/26 A3/A4/D97: every question in the bank had exactly one answer. That
// is a real limitation, not a stylistic one — a closed question can only ever
// measure whether a procedure was executed. An open one measures whether the
// child can *search* the space the procedure lives in, which is where number
// sense actually shows up. A child who answers "25 and 25" to "two numbers
// that add to 50" and a child who answers "37 and 13" have demonstrably
// different fluency, and no closed item can tell them apart.
//
// Three formats, deliberately distinct:
//
//   · open-ended  — one constraint, a large answer set. Low floor.
//   · Open Middle — fixed start and end, a restricted digit pool in between.
//                   High ceiling: the child must reason about which digits can
//                   possibly work, not try them all.
//   · reverse     — "the answer is 24, what was the question?" Inverts the
//                   direction of the procedure, which is the cheapest way to
//                   test whether it was understood or memorised.

import type { SchoolClass, Difficulty, Question } from './types';
import { ri, pick, shuffleArr } from './helpers';
import type { OpenConstraint, OpenSpec } from './openResponse';
import { openQuestion, gradeOpen } from './openResponse';
import type { Lang } from '../i18n/strings';

function classNumber(cls: SchoolClass): number {
  return ['1st', '2nd', '3rd', '4th', '5th', '6th'].indexOf(cls) + 1;
}

/** Round a target to something a child recognises as "a nice number". */
function friendly(n: number): number {
  return Math.max(10, Math.round(n / 10) * 10);
}

// ─── P1-18 · Open-ended tasks ────────────────────────────────────────────────

/**
 * "Find two numbers that add to 50."
 *
 * The floor is deliberately at the floor: 0 + 50 is a valid answer, and a
 * child who gives it has still produced a decomposition. The `distinctParts`
 * constraint is applied only from Class 3, where the halving answer stops
 * being a discovery and starts being an avoidance.
 */
export function genOpenEnded(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  const n = classNumber(cls);
  const hi = lang === 'hi';
  const builders: (() => Question)[] = [];

  // Additive decomposition — the number-bond idea, stated openly.
  builders.push(() => {
    const total = n <= 1 ? ri(5, 10) : n === 2 ? friendly(ri(20, 60)) : friendly(ri(40, 200));
    const constraints: OpenConstraint[] = [
      { type: 'partCount', count: 2 },
      { type: 'integerParts' },
      { type: 'sum', total },
      { type: 'partsBetween', low: 1, high: total - 1 },
    ];
    if (n >= 3) constraints.push({ type: 'distinctParts' });
    const a = n >= 3 ? ri(1, total - 1) : Math.floor(total / 2);
    const spec: OpenSpec = {
      mode: 'slots', slots: 2, constraints,
      exemplar: n >= 3 && a * 2 === total ? `${a - 1}, ${total - a + 1}` : `${a}, ${total - a}`,
    };
    return openQuestion(
      hi ? `दो संख्याएँ खोजें जिनका जोड़ ${total} हो।`
         : `Find two numbers that add to ${total}.`,
      spec, { resolvedCategory: 'addition' },
    );
  });

  // Multiplicative decomposition — factor pairs, without the word "factor".
  if (n >= 3) {
    builders.push(() => {
      const total = pick([12, 18, 24, 36, 48, 60, 72]);
      const a = pick(divisorsOf(total).filter(d => d > 1 && d < total));
      const spec: OpenSpec = {
        mode: 'slots', slots: 2,
        constraints: [
          { type: 'partCount', count: 2 },
          { type: 'integerParts' },
          { type: 'product', total },
          { type: 'excludes', values: [1, total] },
        ],
        exemplar: `${a}, ${total / a}`,
      };
      return openQuestion(
        hi ? `दो संख्याएँ खोजें जिनका गुणनफल ${total} हो। 1 का प्रयोग न करें।`
           : `Find two numbers that multiply to ${total}. Do not use 1.`,
        spec, { resolvedCategory: 'multiplication' },
      );
    });
  }

  // A number between two others — the density idea. Class 4+ because it needs
  // decimals to be non-trivial at the interesting spacings.
  if (n >= 4) {
    builders.push(() => {
      const lo = ri(2, 8);
      const hi2 = lo + 1;
      const spec: OpenSpec = {
        mode: 'slots', slots: 1,
        constraints: [
          { type: 'partCount', count: 1 },
          { type: 'valueBetween', low: lo, high: hi2, exclusive: true },
        ],
        exemplar: `${lo}.5`,
      };
      return openQuestion(
        hi ? `${lo} और ${hi2} के बीच कोई एक संख्या लिखें।`
           : `Write any number between ${lo} and ${hi2}.`,
        spec, { resolvedCategory: 'decimals' },
      );
    });
  }

  // A multiple in a window — combines two constraints, which is where open
  // tasks start doing work multiple choice cannot.
  if (n >= 4) {
    builders.push(() => {
      const k = pick([3, 4, 6, 7, 8, 9]);
      const lo = ri(20, 60);
      const hi2 = lo + ri(20, 40);
      const options: number[] = [];
      for (let v = Math.ceil(lo / k) * k; v <= hi2; v += k) options.push(v);
      const spec: OpenSpec = {
        mode: 'slots', slots: 1,
        constraints: [
          { type: 'partCount', count: 1 },
          { type: 'integerParts' },
          { type: 'multipleOf', k },
          { type: 'valueBetween', low: lo, high: hi2 },
        ],
        exemplar: String(options[0] ?? Math.ceil(lo / k) * k),
      };
      return openQuestion(
        hi ? `${k} का एक गुणज लिखें जो ${lo} और ${hi2} के बीच हो।`
           : `Write a multiple of ${k} that is between ${lo} and ${hi2}.`,
        spec, { resolvedCategory: 'factors' },
      );
    });
  }

  return pick(builders)();
}

function divisorsOf(n: number): number[] {
  const out: number[] = [];
  for (let d = 1; d * d <= n; d++) {
    if (n % d === 0) { out.push(d); if (d !== n / d) out.push(n / d); }
  }
  return out.sort((a, b) => a - b);
}

// ─── P1-19 · Open Middle ─────────────────────────────────────────────────────

/**
 * Fixed start, fixed end, restricted middle.
 *
 * The defining property of the format (Robert Kaplinsky's): the digits are
 * given, each may be used once, and the child must work out which arrangement
 * satisfies the target. That converts a one-step calculation into a search
 * with a reason — "the ones digits have to make 4, so 6 and 8 go there".
 *
 * Every task is generated from a KNOWN solution and then verified against its
 * own grader before it ships (see the guard test): an Open Middle prompt with
 * no solution is not a hard question, it is a broken one.
 */
export function genOpenMiddle(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  const n = classNumber(cls);
  const hi = lang === 'hi';
  const builders: (() => Question)[] = [];

  // Two 2-digit numbers from four given digits, summing to a target.
  builders.push(() => {
    const d = shuffleArr([ri(1, 9), ri(1, 9), ri(1, 9), ri(1, 9)]);
    const a = d[0] * 10 + d[1];
    const b = d[2] * 10 + d[3];
    const target = a + b;
    const spec: OpenSpec = {
      mode: 'expression',
      digitPool: [...d].sort((x, y) => x - y),
      opPool: ['+'],
      constraints: [
        { type: 'usesDigits', digits: d, eachOnce: true },
        { type: 'usesOperations', ops: ['+'], min: 1 },
        { type: 'equals', target },
      ],
      exemplar: `${a}+${b}`,
    };
    return openQuestion(
      hi ? `अंक ${[...d].sort((x, y) => x - y).join(', ')} — हर एक एक बार।\nदो 2-अंकीय संख्याएँ बनाएँ जिनका जोड़ ${target} हो।`
         : `Digits ${[...d].sort((x, y) => x - y).join(', ')} — each used once.\nMake two 2-digit numbers that add to ${target}.`,
      spec, { resolvedCategory: 'addition' },
    );
  });

  // Largest-possible framing, expressed as a threshold so it stays gradeable
  // offline: "get above X", where X is reachable but not by the obvious route.
  if (n >= 3) {
    builders.push(() => {
      const d = shuffleArr([ri(2, 9), ri(2, 9), ri(2, 9)]);
      const sorted = [...d].sort((x, y) => y - x);
      // Best product with digits p q r as (2-digit) × (1-digit).
      let best = 0;
      for (const [i, j, k] of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
        best = Math.max(best, (d[i] * 10 + d[j]) * d[k]);
      }
      const threshold = Math.floor(best * 0.8);
      const spec: OpenSpec = {
        mode: 'expression',
        digitPool: sorted,
        opPool: ['*'],
        constraints: [
          { type: 'usesDigits', digits: d, eachOnce: true },
          { type: 'usesOperations', ops: ['*'], min: 1 },
          { type: 'valueBetween', low: threshold, high: Number.MAX_SAFE_INTEGER },
        ],
        exemplar: bestProductExpression(d),
      };
      return openQuestion(
        hi ? `अंक ${sorted.join(', ')} — हर एक एक बार।\nएक 2-अंकीय संख्या को 1-अंकीय संख्या से गुणा करें ताकि उत्तर ${threshold} से बड़ा हो।`
           : `Digits ${sorted.join(', ')} — each used once.\nMultiply a 2-digit number by a 1-digit number so the answer is more than ${threshold}.`,
        spec, { resolvedCategory: 'multiplication' },
      );
    });
  }

  // Subtraction with a target difference — the hardest of the three, because
  // the child has to reason about place value in both directions.
  if (n >= 4) {
    builders.push(() => {
      const d = shuffleArr([ri(1, 9), ri(1, 9), ri(1, 9), ri(1, 9)]);
      const a = d[0] * 10 + d[1];
      const b = d[2] * 10 + d[3];
      const [hiN, loN] = a >= b ? [a, b] : [b, a];
      const target = hiN - loN;
      const spec: OpenSpec = {
        mode: 'expression',
        digitPool: [...d].sort((x, y) => x - y),
        opPool: ['-'],
        constraints: [
          { type: 'usesDigits', digits: d, eachOnce: true },
          { type: 'usesOperations', ops: ['-'], min: 1 },
          { type: 'equals', target },
        ],
        exemplar: `${hiN}-${loN}`,
      };
      return openQuestion(
        hi ? `अंक ${[...d].sort((x, y) => x - y).join(', ')} — हर एक एक बार।\nदो 2-अंकीय संख्याएँ बनाएँ जिनका अंतर ${target} हो।`
           : `Digits ${[...d].sort((x, y) => x - y).join(', ')} — each used once.\nMake two 2-digit numbers with a difference of ${target}.`,
        spec, { resolvedCategory: 'subtraction' },
      );
    });
  }

  return pick(builders)();
}

function bestProductExpression(d: number[]): string {
  let best = 0;
  let expr = '';
  for (const [i, j, k] of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
    const v = (d[i] * 10 + d[j]) * d[k];
    if (v > best) { best = v; expr = `${d[i] * 10 + d[j]}*${d[k]}`; }
  }
  return expr;
}

// ─── P1-20 · Reverse problems ────────────────────────────────────────────────

/**
 * "The answer is 24 — what was the question?"
 *
 * docs/26 D97. Running a procedure backwards is the cheapest available test of
 * whether it was understood rather than memorised, and it is the one format
 * where a child who has only pattern-matched visibly stalls.
 *
 * The operation is constrained (not "any sentence making 24") so the task
 * still practises a named skill and the attempt can be logged against it —
 * otherwise a child would answer every reverse problem with `24+0` and the
 * scheduler would read that as division practice.
 */
export function genReverse(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  const n = classNumber(cls);
  const hi = lang === 'hi';
  const builders: (() => Question)[] = [];

  builders.push(() => {
    const target = n <= 1 ? ri(6, 10) : n === 2 ? ri(20, 60) : ri(40, 300);
    const a = ri(2, Math.max(3, target - 2));
    const spec: OpenSpec = {
      mode: 'expression',
      opPool: ['+'],
      constraints: [
        { type: 'usesOperations', ops: ['+'], min: 1 },
        { type: 'equals', target },
        { type: 'partsBetween', low: 1, high: target - 1 },
      ],
      exemplar: `${a}+${target - a}`,
    };
    return openQuestion(
      hi ? `उत्तर ${target} है।\nजोड़ का एक ऐसा वाक्य बनाएँ जिसका उत्तर यही आए।`
         : `The answer is ${target}.\nWrite an addition that makes it.`,
      spec, { resolvedCategory: 'addition' },
    );
  });

  if (n >= 3) {
    builders.push(() => {
      const target = pick([12, 16, 18, 24, 30, 36, 42, 48, 56, 64, 72]);
      const a = pick(divisorsOf(target).filter(d => d > 1 && d < target && d <= 12));
      const spec: OpenSpec = {
        mode: 'expression',
        opPool: ['*'],
        constraints: [
          { type: 'usesOperations', ops: ['*'], min: 1 },
          { type: 'equals', target },
          { type: 'excludes', values: [1] },
        ],
        exemplar: `${a}*${target / a}`,
      };
      return openQuestion(
        hi ? `उत्तर ${target} है।\nगुणा का एक ऐसा वाक्य बनाएँ जिसका उत्तर यही आए। 1 का प्रयोग न करें।`
           : `The answer is ${target}.\nWrite a multiplication that makes it. Do not use 1.`,
        spec, { resolvedCategory: 'multiplication' },
      );
    });
  }

  if (n >= 4) {
    builders.push(() => {
      const q = ri(3, 12);
      const b = ri(2, 9);
      const target = q;
      const spec: OpenSpec = {
        mode: 'expression',
        opPool: ['/'],
        constraints: [
          { type: 'usesOperations', ops: ['/'], min: 1 },
          { type: 'equals', target },
          { type: 'excludes', values: [1] },
        ],
        exemplar: `${q * b}/${b}`,
      };
      return openQuestion(
        hi ? `उत्तर ${target} है।\nभाग का एक ऐसा वाक्य बनाएँ जिसका उत्तर यही आए। 1 से भाग न दें।`
           : `The answer is ${target}.\nWrite a division that makes it. Do not divide by 1.`,
        spec, { resolvedCategory: 'division' },
      );
    });
  }

  // Two-step: forces a plan rather than one recalled fact.
  if (n >= 5) {
    builders.push(() => {
      // The target is DERIVED from a known two-step route, not drawn
      // independently: drawing both freely produced targets like 37 with an
      // exemplar of `7*6+0` = 42, i.e. a task whose own stated answer was
      // wrong. Measured at 28 of 7,200 generated tasks before this fix.
      const a = ri(2, 9);
      const b = ri(2, 9);
      const rest = ri(1, 30);
      const target = a * b + rest;
      const spec: OpenSpec = {
        mode: 'expression',
        opPool: ['+', '*'],
        constraints: [
          { type: 'usesOperations', ops: ['+', '*'], min: 2 },
          { type: 'equals', target },
        ],
        exemplar: `${a}*${b}+${rest}`,
      };
      return openQuestion(
        hi ? `उत्तर ${target} है।\nएक ऐसा वाक्य बनाएँ जिसमें × और + दोनों हों।`
           : `The answer is ${target}.\nWrite a sentence that uses both × and +.`,
        spec, { resolvedCategory: 'mixed' },
      );
    });
  }

  return pick(builders)();
}

// ─── Self-check ──────────────────────────────────────────────────────────────

/**
 * Does this question's own exemplar pass its own grader?
 *
 * Exported rather than kept in the test file on purpose: an open task whose
 * stated answer does not satisfy its stated constraints is the single failure
 * mode of this whole family, and it is silent — the child simply cannot win.
 * The guard test runs this over thousands of generated tasks.
 */
export function exemplarIsValid(q: Question): boolean {
  const it = q.interaction;
  if (it?.kind !== 'open') return false;
  return gradeOpen(it, it.exemplar).correct;
}
