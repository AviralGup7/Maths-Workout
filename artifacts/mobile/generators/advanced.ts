// ─── Advanced topic generators ────────────────────────────────────────────────
// Covers: word_problems, factors, geometry, percentages, data, ratio, integers, algebra
// Curriculum alignment:
//   Word problems — Class 3: simple 1-step; Class 4: 2-step; Class 5/6: multi-step
//   Factors — Class 4+; Geometry — Class 3+ basic, Class 5/6 full
//   Percentages, Ratio, Integers, Algebra — Class 5/6 as per curriculum

import { SchoolClass, Difficulty, Question } from './types';
import { ri, pick, gcd, lcm, countFactors, shuffleArr, makeIntChoices, makeStrChoices } from './helpers';
import type { Lang } from '../i18n/strings';
import { qp } from '../i18n/questions';

/** Smallest base for which `pct`% is a whole number, scaled into a sensible range. */
function cleanPercentBase(pct: number, maxBase = 200): number {
  const step = 100 / gcd(pct, 100);
  return step * ri(1, Math.max(1, Math.floor(maxBase / step)));
}

// ─── Word Problems ────────────────────────────────────────────────────────────
//
// REMOVED. `genWordProblems` lived here with hardcoded "Tom has 12 apples" and
// "Jane saves ₹15 per week" templates and no `lang` parameter, so a Hindi-
// medium child reading a word problem — the one category where reading IS the
// task — always met English. `generators/word-problems-i18n.ts` has replaced
// it since the i18n work: Indian names, rupees, board-scaled bounds, both
// languages. The dispatcher now calls that unconditionally, so there is no
// longer an English-only path to fall down.

// ─── Factors & Primes ─────────────────────────────────────────────────────────

export function genFactors(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  type TQ = () => Question;
  const easy: TQ[] = [
    () => { const n = pick([6, 8, 10, 12, 15, 16, 18, 20]); const c = countFactors(n); return { questionText: qp('howManyFactors', lang, n), answer: c, choices: makeIntChoices(c) }; },
    // F1/C7: these were true/false, which rendered only 2 options in a grid
    // built for 4 and reduced a guess from 25% to 50%. Reframed as "pick the
    // prime", which tests the same understanding with four real options.
    () => {
      const primes = [2, 3, 5, 7, 11, 13, 17, 19];
      const answer = pick(primes);
      const composites = [4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21].filter(n => n !== answer);
      return {
        // docs/21 · F8. The text was constant, so all variation lived in the
        // choices and this cell collapsed to two distinct question strings —
        // 33% of every draw was one of them. Naming the candidates in the text
        // makes each draw genuinely different to read.
        questionText: qp('whichIsPrime', lang),
        answer,
        choices: shuffleArr([answer, ...shuffleArr(composites).slice(0, 3)]),
      };
    },
    () => {
      const composites = [4, 6, 8, 9, 10, 12, 14, 15, 16, 18];
      const answer = pick(composites);
      const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23];
      return {
        questionText: qp('whichNotPrime', lang),
        answer,
        choices: shuffleArr([answer, ...shuffleArr(primes).slice(0, 3)]),
      };
    },
    // Parameterised factor work, so the cell is not three fixed sentences.
    () => {
      const n = pick([12, 16, 18, 20, 24, 28, 30, 36, 40, 42, 45, 48, 50, 54, 60]);
      const d = pick([2, 3, 4, 5, 6, 7, 8, 9]);
      const yes = n % d === 0;
      return {
        questionText: qp('isFactorOf', lang, d, n),
        answer: yes ? qp('yes', lang) : qp('no', lang),
        choices: shuffleArr([qp('yes', lang), qp('no', lang)]),
      };
    },
    () => {
      const n = pick([10, 12, 14, 15, 16, 18, 20, 21, 24, 25, 27, 28, 30, 32, 36]);
      const factors: number[] = [];
      for (let i = 1; i <= n; i++) if (n % i === 0) factors.push(i);
      const answer = factors[factors.length - 2];   // largest factor below n
      return {
        questionText: qp('largestFactor', lang, n),
        answer, choices: makeIntChoices(answer),
      };
    },
    () => {
      const n = pick([6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 22, 24, 25, 26, 27, 28]);
      const smallest = [2, 3, 5, 7, 11, 13].find(p => n % p === 0) ?? n;
      return {
        questionText: qp('smallestPrimeFactor', lang, n),
        answer: smallest, choices: makeIntChoices(smallest),
      };
    },
    () => {
      const m = pick([3, 4, 6, 7, 8, 9, 11, 12]);
      const k = ri(2, 9);
      return {
        questionText: qp('multipleAfter', lang, m, m * k),
        answer: m * (k + 1), choices: makeIntChoices(m * (k + 1)),
      };
    },
  ];
  const medium: TQ[] = [
    () => { const a = pick([6, 8, 10, 12, 15, 18, 20, 24]); const b = pick([4, 6, 9, 10, 12, 15, 18]); const g = gcd(a, b); return { questionText: qp('hcfOf', lang, a, b), answer: g, choices: makeIntChoices(g) }; },
    () => { const a = pick([2, 3, 4, 5, 6]); const bPool = [3, 4, 5, 6, 7, 8].filter(x => x !== a); const b = pick(bPool); const l = lcm(a, b); return { questionText: qp('lcmOf', lang, a, b), answer: l, choices: makeIntChoices(l) }; },
  ];
  const hard: TQ[] = [
    () => { const a = pick([12, 15, 18, 20, 24, 30, 36]); const bPool = [8, 10, 12, 15, 18, 20, 24].filter(x => x !== a); const b = pick(bPool); const g = gcd(a, b); return { questionText: qp('hcfEq', lang, a, b), answer: g, choices: makeIntChoices(g) }; },
    () => { const vals = [4, 5, 6, 7, 8, 9]; const a = pick(vals); const b = pick(vals.filter(x => x !== a)); const l = lcm(a, b); return { questionText: qp('lcmEq', lang, a, b), answer: l, choices: makeIntChoices(l) }; },
    () => { const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31]; const p = pick(primes); return { questionText: qp('nthPrime', lang, primes.indexOf(p) + 1), answer: p, choices: makeIntChoices(p) }; },
  ];
  return pick(diff === 'easy' ? easy : diff === 'medium' ? medium : hard)();
}

// ─── Geometry ────────────────────────────────────────────────────────────────

export function genGeometry(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  type TQ = () => Question;
  const easy: TQ[] = [
    () => { const s = ri(2, 10); return { questionText: qp('areaSquareSide', lang, s), answer: s * s, choices: makeIntChoices(s * s) }; },
    () => { const s = ri(2, 10); return { questionText: qp('periSquareSide', lang, s), answer: 4 * s, choices: makeIntChoices(4 * s) }; },
    () => ({ questionText: qp('degRightAngle', lang), answer: 90, choices: makeIntChoices(90) }),
    () => ({ questionText: qp('degStraightLine', lang), answer: 180, choices: makeIntChoices(180) }),
    () => ({ questionText: qp('triAnglesSum', lang), answer: 180, choices: makeIntChoices(180) }),
    // docs/21 · F8. Three of the five items above are CONSTANTS, so this band
    // produced 21 distinct questions in 20,000 draws with one item at 20% of
    // every appearance. The parameterised items below exercise the same facts
    // (right angle, straight line) as something to USE rather than recite.
    () => {
      const a = ri(15, 75);
      return {
        questionText: qp('twoAnglesRight', lang, a),
        answer: 90 - a, choices: makeIntChoices(90 - a),
      };
    },
    () => {
      const a = ri(20, 160);
      return {
        questionText: qp('twoAnglesLine', lang, a),
        answer: 180 - a, choices: makeIntChoices(180 - a),
      };
    },
    () => {
      const s = ri(2, 12);
      return {
        questionText: qp('squarePeriSide', lang, 4 * s),
        answer: s, choices: makeIntChoices(s),
      };
    },
    () => {
      const w = ri(2, 9);
      const l = ri(w + 1, w + 8);
      return {
        questionText: qp('rectLongWide', lang, l, w),
        answer: l - w, choices: makeIntChoices(l - w),
      };
    },
  ];
  const medium: TQ[] = [
    () => { const a = ri(3, 12); const b = ri(2, 10); return { questionText: qp('areaRect', lang, a, b), answer: a * b, choices: makeIntChoices(a * b) }; },
    () => { const a = ri(3, 12); const b = ri(2, 10); return { questionText: qp('periRect', lang, a, b), answer: 2 * (a + b), choices: makeIntChoices(2 * (a + b)) }; },
    () => { const b = ri(2, 7) * 2; const h = ri(3, 10); return { questionText: qp('areaTriangleBH', lang, b, h), answer: (b * h) / 2, choices: makeIntChoices((b * h) / 2) }; },
    () => ({ questionText: qp('quadAnglesSum', lang), answer: 360, choices: makeIntChoices(360) }),
    () => {
      const a = ri(60, 140), b = ri(50, 130), c = ri(40, 120);
      const d = 360 - a - b - c;
      if (d < 20) return { questionText: qp('quadAnglesSum', lang), answer: 360, choices: makeIntChoices(360) };
      return {
        questionText: qp('quadFourth', lang, a, b, c),
        answer: d, choices: makeIntChoices(d),
      };
    },
    () => {
      const s = ri(3, 15);
      return { questionText: qp('squareAreaSide', lang, s * s), answer: s, choices: makeIntChoices(s) };
    },
  ];
  const hard: TQ[] = [
    () => { const b = ri(4, 16) * 2; const h = ri(4, 12) * 2; return { questionText: qp('areaTriangle', lang, b, h), answer: (b * h) / 2, choices: makeIntChoices((b * h) / 2) }; },
    () => { const side = ri(3, 12); return { questionText: qp('volumeCube', lang, side), answer: side * side * side, choices: makeIntChoices(side * side * side) }; },
    () => ({ questionText: qp('fullTurnDeg', lang), answer: 360, choices: makeIntChoices(360) }),
    () => {
      const a = ri(30, 150);
      return {
        questionText: qp('twoAnglesPoint', lang, a),
        answer: 360 - a, choices: makeIntChoices(360 - a),
      };
    },
    () => {
      const l = ri(4, 15), w = ri(3, 12);
      return {
        questionText: qp('rectAreaWidthLen', lang, l * w, w),
        answer: l, choices: makeIntChoices(l),
      };
    },
    () => { const a = ri(20, 80); const b = ri(10, a - 5); return { questionText: qp('triThirdAngle', lang, a, b), answer: 180 - a - b, choices: makeIntChoices(180 - a - b) }; },
  ];
  return pick(diff === 'easy' ? easy : diff === 'medium' ? medium : hard)();
}

// ─── Percentages ─────────────────────────────────────────────────────────────

export function genPercentages(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  type TQ = () => Question;
  const easy: TQ[] = [
    () => { const n = pick([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]); const p = pick([10, 20, 50]); return { questionText: qp('percentOf', lang, p, n), answer: p * n / 100, choices: makeIntChoices(p * n / 100) }; },
    () => { const n = pick([20, 40, 60, 80, 100, 200]); return { questionText: qp('percentOf', lang, 50, n), answer: n / 2, choices: makeIntChoices(n / 2) }; },
    () => { const n = pick([10, 20, 30, 50, 100, 200]); return { questionText: qp('percentOf', lang, 10, n), answer: n / 10, choices: makeIntChoices(n / 10) }; },
  ];
  const medium: TQ[] = [
    () => { const p = pick([25, 75]); const n = cleanPercentBase(p, 200); return { questionText: qp('percentOf', lang, p, n), answer: p * n / 100, choices: makeIntChoices(p * n / 100) }; },
    () => { const n = pick([10, 20, 50, 100]); const pctChoices = [10, 20, 25, 50].filter(q => (q * n) % 100 === 0); const p = pick(pctChoices.length ? pctChoices : [50]); const k = (p * n) / 100; return { questionText: qp('whatPercentIs', lang, n, k), answer: p, choices: makeIntChoices(p) }; },
    () => { const p = pick([5, 15, 25]); const n = cleanPercentBase(p, 300); return { questionText: qp('percentOf', lang, p, n), answer: p * n / 100, choices: makeIntChoices(p * n / 100) }; },
  ];
  const hard: TQ[] = [
    () => { const p = pick([15, 35, 45, 65]); const n = cleanPercentBase(p, 400); return { questionText: qp('percentOf', lang, p, n), answer: p * n / 100, choices: makeIntChoices(p * n / 100) }; },
    () => { const p = pick([10, 20, 25]); const n = cleanPercentBase(p, 250); return { questionText: qp('increaseBy', lang, n, p), answer: n + p * n / 100, choices: makeIntChoices(n + p * n / 100) }; },
    () => { const p = pick([10, 20, 25]); const n = cleanPercentBase(p, 250); return { questionText: qp('decreaseBy', lang, n, p), answer: n - p * n / 100, choices: makeIntChoices(n - p * n / 100) }; },
  ];
  return pick(diff === 'easy' ? easy : diff === 'medium' ? medium : hard)();
}

// ─── Data & Averages ──────────────────────────────────────────────────────────

export function genData(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  type TQ = () => Question;
  const easy: TQ[] = [
    () => { const arr = [ri(2, 9), ri(2, 9), ri(2, 9), ri(2, 9)]; const mean = arr.reduce((s, x) => s + x, 0) / arr.length; if (mean % 1 !== 0) arr[0] += 1; const m = arr.reduce((s, x) => s + x, 0) / arr.length; return { questionText: qp('findMean', lang, arr.join(', ')), answer: m, choices: makeIntChoices(m) }; },
    () => { const arr = [ri(1, 8), ri(2, 9), ri(1, 7), ri(3, 9)]; const range = Math.max(...arr) - Math.min(...arr); return { questionText: qp('findRange', lang, arr.join(', ')), answer: range, choices: makeIntChoices(range) }; },
  ];
  const medium: TQ[] = [
    () => { const sorted = [ri(1, 4), ri(5, 7), ri(8, 12), ri(13, 18), ri(19, 25)]; const arr = shuffleArr(sorted); return { questionText: qp('findMedian', lang, arr.join(', ')), answer: sorted[2], choices: makeIntChoices(sorted[2]) }; },
    () => { const repeated = ri(3, 8); const arr = shuffleArr([repeated, repeated, repeated, ri(1, 9), ri(1, 9)]); return { questionText: qp('whatIsModeOf', lang, arr.join(', ')), answer: repeated, choices: makeIntChoices(repeated) }; },
    () => { const arr = [ri(5, 15), ri(5, 15), ri(5, 15), ri(5, 15)]; const mean = arr.reduce((s, x) => s + x, 0) / 4; if (mean % 1 !== 0) arr[0]++; const m = arr.reduce((s, x) => s + x, 0) / 4; return { questionText: qp('meanOfEq', lang, arr.join(', ')), answer: m, choices: makeIntChoices(m) }; },
  ];
  const hard: TQ[] = [
    () => { const arr = [ri(10, 30), ri(10, 30), ri(10, 30), ri(10, 30), ri(10, 30)]; const sorted = [...arr].sort((a, b) => a - b); return { questionText: qp('medianOf', lang, arr.join(', ')), answer: sorted[2], choices: makeIntChoices(sorted[2]) }; },
    () => { const avg = ri(5, 15); const total = avg * 4; const a = ri(1, avg - 2); const b = ri(1, avg - 2); const c = ri(1, avg - 2); const d = total - a - b - c; return { questionText: qp('meanOfEq', lang, `${a}, ${b}, ${c}, ${d}`), answer: avg, choices: makeIntChoices(avg) }; },
  ];
  return pick(diff === 'easy' ? easy : diff === 'medium' ? medium : hard)();
}

// ─── Ratio ───────────────────────────────────────────────────────────────────

export function genRatio(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  type TQ = () => Question;
  const easy: TQ[] = [
    () => { const g = ri(2, 5); const mA = ri(1, 4); const mB = mA < 4 ? ri(mA + 1, 4) : ri(1, mA - 1); const a = g * mA; const b = g * mB; return { questionText: qp('simplifyRatioIs', lang, a, b, a / g), answer: b / g, choices: makeIntChoices(b / g) }; },
    () => { const a = ri(2, 5); const b = ri(2, 5); const total = (a + b) * ri(2, 5); return { questionText: qp('ratioSmaller', lang, a, b, total), answer: Math.round((Math.min(a, b) * total) / (a + b)), choices: makeIntChoices(Math.round((Math.min(a, b) * total) / (a + b))) }; },
  ];
  const medium: TQ[] = [
    () => { const cost = ri(2, 8); const n = ri(2, 6); let ask = ri(2, 8); if (ask === n) ask = ask < 8 ? ask + 1 : ask - 1; return { questionText: qp('pensCost', lang, n, n * cost, ask), answer: ask * cost, choices: makeIntChoices(ask * cost) }; },
    () => { const a = ri(2, 5); let b = ri(2, 5); if (a === b) b = b < 5 ? b + 1 : b - 1; const total = (a + b) * ri(3, 6); return { questionText: qp('divideInRatio', lang, total, a, b), answer: Math.round((Math.max(a, b) * total) / (a + b)), choices: makeIntChoices(Math.round((Math.max(a, b) * total) / (a + b))) }; },
  ];
  const hard: TQ[] = [
    () => { const a = ri(3, 7); let b = ri(2, 6); if (a === b) b = b < 6 ? b + 1 : b - 1; const total = (a + b) * ri(4, 8); const larger = Math.round((Math.max(a, b) * total) / (a + b)); return { questionText: qp('shareRupeeRatio', lang, total, a, b), answer: larger, choices: makeIntChoices(larger) }; },
    () => { const scale = pick([100, 50, 200]); const map = ri(2, 10); return { questionText: qp('scaleMapReal', lang, scale, map), answer: map * scale, choices: makeIntChoices(map * scale) }; },
  ];
  return pick(diff === 'easy' ? easy : diff === 'medium' ? medium : hard)();
}

// ─── Integers ────────────────────────────────────────────────────────────────

export function genIntegers(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  type TQ = () => Question;
  const easy: TQ[] = [
    () => { const a = -ri(1, 5); const b = ri(-a + 1, 10); return { questionText: `${a} + ${b} = ?`, answer: a + b, choices: makeIntChoices(a + b, { allowNegative: true }) }; },
    () => { const n = ri(1, 10); return { questionText: qp('absoluteValue', lang, n), answer: n, choices: makeIntChoices(n) }; },
    () => { const a = ri(1, 9); const b = ri(a + 1, 15); return { questionText: qp('whichColderNeg', lang, a, b), answer: -b, choices: shuffleArr([-a, -b, a, b]) }; },
  ];
  const medium: TQ[] = [
    () => { const a = -ri(3, 10); const b = -ri(3, 10); return { questionText: `${a} + ${b} = ?`, answer: a + b, choices: makeIntChoices(a + b, { allowNegative: true }) }; },
    () => { const a = ri(2, 10); const b = ri(a + 1, 15); return { questionText: `${a} − ${b} = ?`, answer: a - b, choices: makeIntChoices(a - b, { allowNegative: true }) }; },
    () => { const a = -ri(2, 8); const b = ri(2, 8); return { questionText: `${a} − ${b} = ?`, answer: a - b, choices: makeIntChoices(a - b, { allowNegative: true }) }; },
  ];
  const hard: TQ[] = [
    () => { const a = -ri(2, 8); const b = ri(2, 8); return { questionText: `${a} × ${b} = ?`, answer: a * b, choices: makeIntChoices(a * b, { allowNegative: true }) }; },
    () => { const a = -ri(2, 6); const b = -ri(2, 6); return { questionText: `${a} × ${b} = ?`, answer: a * b, choices: makeIntChoices(a * b, { allowNegative: true }) }; },
    () => { const a = ri(2, 8); const b = -ri(2, 5); return { questionText: `${a * b} ÷ ${b} = ?`, answer: a, choices: makeIntChoices(a) }; },
  ];
  return pick(diff === 'easy' ? easy : diff === 'medium' ? medium : hard)();
}

// ─── Algebra ─────────────────────────────────────────────────────────────────

export function genAlgebra(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  type TQ = () => Question;
  const easy: TQ[] = [
    () => { const x = ri(2, 12); const a = ri(1, 10); return { questionText: `x + ${a} = ${x + a}\n${qp('findX', lang)}`, answer: x, choices: makeIntChoices(x) }; },
    () => { const x = ri(2, 12); const a = ri(1, 8); return { questionText: `x − ${a} = ${x - a}\n${qp('findX', lang)}`, answer: x, choices: makeIntChoices(x) }; },
    () => { const x = ri(2, 10); const a = ri(2, 6); return { questionText: `${a}x = ${a * x}\n${qp('findX', lang)}`, answer: x, choices: makeIntChoices(x) }; },
  ];
  const medium: TQ[] = [
    () => { const x = ri(2, 10); const a = ri(2, 5); const b = ri(1, 10); return { questionText: `${a}x + ${b} = ${a * x + b}\n${qp('findX', lang)}`, answer: x, choices: makeIntChoices(x) }; },
    () => { const x = ri(2, 10); const a = ri(2, 5); const b = ri(1, 8); return { questionText: `${a}x − ${b} = ${a * x - b}\n${qp('findX', lang)}`, answer: x, choices: makeIntChoices(x) }; },
    () => { const x = ri(2, 10); const a = ri(2, 6); return { questionText: `x ÷ ${a} = ${Math.floor(x / a)}\n${qp('divHint', lang, a)}`, answer: Math.floor(x / a) * a, choices: makeIntChoices(Math.floor(x / a) * a) }; },
  ];
  const hard: TQ[] = [
    () => { const x = ri(2, 8); const a = ri(2, 4); const b = ri(2, 6); const c = ri(1, 5); return { questionText: `${a}x + ${b} = ${c}x + ${a * x + b - c * x}\n${qp('findX', lang)}`, answer: x, choices: makeIntChoices(x) }; },
    () => { const x = ri(1, 8); return { questionText: `x² = ${x * x}   ${qp('xPositive', lang)}\n${qp('findX', lang)}`, answer: x, choices: makeIntChoices(x) }; },
    () => { const x = ri(2, 8); const a = ri(2, 4); const b = ri(1, 5); return { questionText: `${a}(x + ${b}) = ${a * (x + b)}\n${qp('findX', lang)}`, answer: x, choices: makeIntChoices(x) }; },
  ];
  return pick(diff === 'easy' ? easy : diff === 'medium' ? medium : hard)();
}
