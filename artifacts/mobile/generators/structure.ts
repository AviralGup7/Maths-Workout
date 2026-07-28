// ─── Structural number concepts ──────────────────────────────────────────────
// docs/27 P2-05 … P2-11 and P2-14. The concepts docs/26 found missing that
// carry the strongest evidence behind them.
//
// What these have in common is that none of them is a new *procedure*. Each is
// a way of SEEING relationships the child is already computing:
//
//   number bonds        7 and 3 live inside 10, permanently (Singapore spine)
//   equality as balance `=` means "the same as", not "write the answer here"
//   fractions on a line a fraction is a NUMBER with a position, not a picture
//   comparing fractions defeating whole-number bias directly
//   multiplicative cmp  "3 times as many" as distinct from "3 more"
//   inverse relations   × and ÷ as one fact, not two
//   rounding            a decision about precision, not a digit rule
//
// Two of these have unusually strong empirical support and are the reason this
// file exists at all:
//   · McNeil: most primary children read `=` operationally. Shown `8 + 4 = □ + 5`
//     they answer 12, because they have only ever met `=` at the end of a sum.
//     The fix is exposure to non-canonical forms, which the app had zero of.
//   · Siegler (NAEP): fraction magnitude knowledge is the strongest single
//     predictor of later algebra attainment, and a number line is how it is
//     measured and taught.

import type { SchoolClass, Difficulty, Question } from './types';
import { ri, pick, shuffleArr, makeIntChoices, makeStrChoices } from './helpers';
import { multiSelectQuestion, entryQuestion, orderingQuestion } from './interactions';
import type { Lang } from '../i18n/strings';

function classNumber(cls: SchoolClass): number {
  return ['1st', '2nd', '3rd', '4th', '5th', '6th'].indexOf(cls) + 1;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

// ─── P2-05 · Number bonds / part-whole ───────────────────────────────────────

/**
 * "10 is 7 and ___."
 *
 * The Singapore spine, and the reason it is a first-class family rather than
 * addition practice: a bond is a STATIC fact about how a number is composed,
 * not an operation performed on two others. A child who knows the bonds of 10
 * does not compute 7 + 3; they recall that 7 and 3 are the two parts of 10.
 *
 * The missing part rotates between whole and part positions so the child
 * cannot settle into "the box is always at the end" — which is the same habit
 * that produces the equality misconception below.
 */
export function genNumberBond(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  const n = classNumber(cls);
  const hi = lang === 'hi';
  const whole = n <= 1 ? pick([5, 6, 7, 8, 9, 10])
              : n === 2 ? pick([10, 20])
              : pick([20, 50, 100]);
  const partA = ri(1, whole - 1);
  const partB = whole - partA;

  const form = ri(1, 3);
  if (form === 1) {
    return {
      questionText: hi ? `${whole} में ${partA} और कितना?` : `${whole} is ${partA} and how many more?`,
      answer: partB,
      choices: makeIntChoices(partB),
      resolvedCategory: 'addition',
    };
  }
  if (form === 2) {
    return {
      questionText: hi ? `${partA} और ${partB} मिलकर कितना बनाते हैं?`
                       : `${partA} and ${partB} make how many altogether?`,
      answer: whole,
      choices: makeIntChoices(whole),
      resolvedCategory: 'addition',
    };
  }
  // The whole is missing from the middle of the statement — the hardest form,
  // and the one that proves the relationship is understood in both directions.
  return {
    questionText: hi ? `___ में ${partA} और ${partB} हैं।` : `___ is made of ${partA} and ${partB}.`,
    answer: whole,
    choices: makeIntChoices(whole),
    resolvedCategory: 'addition',
  };
}

/** "Tap every pair that makes 10." Set-shaped, because bonds come in families. */
export function genBondFamily(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  const whole = classNumber(cls) <= 2 ? 10 : pick([10, 20, 100]);
  const step = whole === 100 ? 10 : 1;
  const correct: string[] = [];
  for (let a = step; a < whole; a += step) {
    if (correct.length >= 3) break;
    if (Math.random() < 0.35) correct.push(`${a} + ${whole - a}`);
  }
  while (correct.length < 3) {
    const a = ri(1, whole / step - 1) * step;
    const s = `${a} + ${whole - a}`;
    if (!correct.includes(s)) correct.push(s);
  }
  const wrong: string[] = [];
  while (wrong.length < 3) {
    const a = ri(1, whole / step - 1) * step;
    const b = ri(1, whole / step - 1) * step;
    const s = `${a} + ${b}`;
    if (a + b !== whole && !wrong.includes(s) && !correct.includes(s)) wrong.push(s);
  }
  return multiSelectQuestion(
    lang === 'hi' ? `हर वह जोड़ी चुनें जो ${whole} बनाती है` : `Tap every pair that makes ${whole}`,
    correct, wrong, { resolvedCategory: 'addition' },
  );
}

// ─── P2-06 · Equality as balance ─────────────────────────────────────────────

/**
 * `8 + 4 = □ + 5`.
 *
 * McNeil's result: most primary children answer 12 here, because every `=`
 * they have ever met sat immediately before the answer. They are not making an
 * arithmetic error — they are applying a consistent rule, "`=` means write the
 * total", which happens to be wrong.
 *
 * The distractor set is built to catch exactly that: 12 (the left total) is
 * always offered, so choosing it is diagnostic rather than random.
 */
export function genEquality(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  const n = classNumber(cls);
  const hi = lang === 'hi';
  const cap = n <= 2 ? 12 : n <= 4 ? 40 : 120;

  const form = n >= 4 ? ri(1, 3) : ri(1, 2);

  if (form === 1) {
    // a + b = □ + d
    const a = ri(2, cap / 2);
    const b = ri(2, cap / 2);
    const total = a + b;
    const d = ri(1, total - 1);
    const answer = total - d;
    return {
      questionText: `${a} + ${b} = ___ + ${d}`,
      answer,
      // `total` is the operational-reading answer; `a`/`b` catch pattern
      // matching on the visible numbers.
      choices: shuffleArr([answer, total, ...makeIntChoices(answer).filter(c => c !== answer && c !== total).slice(0, 2)]),
      distractorMap: { [String(total)]: 'equality.operational-reading' },
      resolvedCategory: 'addition',
    };
  }

  if (form === 2) {
    // a + b = c + □, presented as a balance question in words.
    const a = ri(2, cap / 2);
    const b = ri(2, cap / 2);
    const total = a + b;
    const c = ri(1, total - 1);
    const answer = total - c;
    return {
      questionText: hi
        ? `दोनों ओर बराबर होना चाहिए।\n${a} + ${b} = ${c} + ___`
        : `Both sides must be equal.\n${a} + ${b} = ${c} + ___`,
      answer,
      choices: shuffleArr([answer, total, ...makeIntChoices(answer).filter(c2 => c2 !== answer && c2 !== total).slice(0, 2)]),
      distractorMap: { [String(total)]: 'equality.operational-reading' },
      resolvedCategory: 'addition',
    };
  }

  // True/false: is the sentence balanced? No box to fill, so there is nothing
  // to compute into — the child must evaluate both sides and compare.
  const a = ri(3, cap / 2);
  const b = ri(3, cap / 2);
  const c = ri(3, cap / 2);
  const balanced = Math.random() < 0.5;
  const d = balanced ? a + b - c : a + b - c + pick([1, 2, -1, -2]);
  const isTrue = a + b === c + d;
  const yes = hi ? 'सही' : 'True';
  const no = hi ? 'गलत' : 'False';
  return {
    questionText: hi
      ? `क्या यह वाक्य सही है?\n${a} + ${b} = ${c} + ${d}`
      : `Is this sentence true?\n${a} + ${b} = ${c} + ${d}`,
    answer: isTrue ? yes : no,
    choices: [yes, no],
    resolvedCategory: 'addition',
  };
}

// ─── P2-07 · Fractions on a number line ──────────────────────────────────────

/**
 * "What fraction is the arrow pointing at?"
 *
 * Siegler: fraction magnitude is the strongest single predictor of later
 * algebra attainment, and the number line is where magnitude lives. The app
 * taught fractions exclusively as part-of-a-shape, which supports "3 of 4
 * pieces" but not "3/4 is a number slightly less than 1" — and it is the
 * second understanding that transfers.
 *
 * Rendered in text as a scale, because a number-line VISUAL already exists
 * (components/visuals/NumberLine) and is attached by visualPolicy.
 */
export function genFractionLine(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  const hi = lang === 'hi';
  const denom = pick(classNumber(cls) <= 3 ? [2, 4] : [2, 3, 4, 5, 6, 8, 10]);
  const num = ri(1, denom - 1);

  const form = ri(1, 2);
  if (form === 1) {
    // Name the marked point.
    const answer = `${num}/${denom}`;
    const wrong = new Set<string>();
    // The classic errors: reading the tick INDEX rather than the fraction,
    // and inverting numerator and denominator.
    wrong.add(`${denom}/${num}`);
    wrong.add(`${num}/${denom + 1}`);
    wrong.add(`${num + 1}/${denom}`);
    const choices = makeStrChoices(answer, [answer, ...[...wrong].filter(w => w !== answer)]);
    return {
      questionText: hi
        ? `0 और 1 के बीच की रेखा ${denom} बराबर भागों में बँटी है।\nनिशान बाएँ से ${num} भाग पर है। वह कौन-सी भिन्न है?`
        : `A line from 0 to 1 is split into ${denom} equal parts.\nThe mark is ${num} parts from the left. Which fraction is it?`,
      answer,
      choices,
      resolvedCategory: 'fractions',
    };
  }

  // Which side of a half does it fall? Magnitude without exact computation.
  const half = denom / 2;
  const nearer = num < half ? (hi ? '0 के पास' : 'Nearer 0')
               : num > half ? (hi ? '1 के पास' : 'Nearer 1')
               : (hi ? 'ठीक बीच में' : 'Exactly halfway');
  return {
    questionText: hi
      ? `0 और 1 के बीच ${num}/${denom} कहाँ बैठती है?`
      : `Where does ${num}/${denom} sit between 0 and 1?`,
    answer: nearer,
    choices: [
      hi ? '0 के पास' : 'Nearer 0',
      hi ? 'ठीक बीच में' : 'Exactly halfway',
      hi ? '1 के पास' : 'Nearer 1',
    ],
    resolvedCategory: 'fractions',
  };
}

// ─── P2-08 · Comparing fractions ─────────────────────────────────────────────

/**
 * Which is bigger, 1/3 or 1/5?
 *
 * Whole-number bias: children apply integer ordering to the denominator and
 * conclude 1/5 > 1/3 because 5 > 3. Comparisons are generated so that the
 * bias gives the WRONG answer roughly half the time — a set where the bias
 * usually works would reinforce it.
 */
export function genCompareFractions(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  const hi = lang === 'hi';
  const form = ri(1, 3);

  if (form === 1) {
    // Same numerator — the pure whole-number-bias trap.
    const num = 1;
    let d1 = pick([2, 3, 4, 5, 6, 8]);
    let d2 = pick([2, 3, 4, 5, 6, 8, 10].filter(d => d !== d1));
    const bigger = d1 < d2 ? `${num}/${d1}` : `${num}/${d2}`;
    return {
      questionText: hi ? `कौन बड़ी है: ${num}/${d1} या ${num}/${d2}?`
                       : `Which is bigger: ${num}/${d1} or ${num}/${d2}?`,
      answer: bigger,
      choices: shuffleArr([`${num}/${d1}`, `${num}/${d2}`]),
      distractorMap: {
        [d1 > d2 ? `${num}/${d1}` : `${num}/${d2}`]: 'frac.whole-number-bias',
      },
      resolvedCategory: 'fractions',
    };
  }

  if (form === 2) {
    // Same denominator — the case where the bias happens to work, included so
    // the child cannot pass by simply inverting the rule.
    const d = pick([4, 5, 6, 8, 10]);
    const a = ri(1, d - 1);
    let b = ri(1, d - 1);
    if (b === a) b = a < d - 1 ? a + 1 : a - 1;
    const bigger = a > b ? `${a}/${d}` : `${b}/${d}`;
    return {
      questionText: hi ? `कौन बड़ी है: ${a}/${d} या ${b}/${d}?`
                       : `Which is bigger: ${a}/${d} or ${b}/${d}?`,
      answer: bigger,
      choices: shuffleArr([`${a}/${d}`, `${b}/${d}`]),
      resolvedCategory: 'fractions',
    };
  }

  // Order three fractions — richer signal than a pairwise choice, because the
  // inversion count says HOW the ordering failed.
  const denoms = shuffleArr([2, 3, 4, 6]).slice(0, 3);
  const fracs = denoms.map(d => ({ label: `1/${d}`, value: 1 / d }));
  const ordered = [...fracs].sort((x, y) => x.value - y.value).map(f => f.label);
  return orderingQuestion(
    hi ? 'छोटी से बड़ी क्रम में लगाएँ' : 'Put these in order, smallest first',
    ordered,
    { direction: 'asc', resolvedCategory: 'fractions' },
  );
}

// ─── P2-10 · Multiplicative comparison ───────────────────────────────────────

/**
 * "Priya has 3 times as many as Rohan" versus "3 more than Rohan".
 *
 * A well-documented confusion, and one the app could not even present: every
 * word problem in the bank used additive comparison. The two phrasings are
 * generated in the same session so the contrast is available.
 */
export function genMultiplicativeCompare(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  const hi = lang === 'hi';
  const names = hi ? ['प्रिया', 'रोहन', 'मीरा', 'कबीर'] : ['Priya', 'Rohan', 'Meera', 'Kabir'];
  const s = shuffleArr(names);
  const base = ri(3, 12);
  const k = ri(2, 5);
  const times = Math.random() < 0.5;

  const answer = times ? base * k : base + k;
  const trap = times ? base + k : base * k;

  const item = hi ? 'कंचे' : 'marbles';
  return {
    questionText: hi
      ? `${s[1]} के पास ${base} ${item} हैं।\n${s[0]} के पास ${s[1]} से ${k} ${times ? 'गुना' : 'ज़्यादा'} हैं।\n${s[0]} के पास कितने हैं?`
      : `${s[1]} has ${base} ${item}.\n${s[0]} has ${k} ${times ? 'times as many as' : 'more than'} ${s[1]}.\nHow many does ${s[0]} have?`,
    answer,
    choices: shuffleArr([answer, trap, ...makeIntChoices(answer).filter(c => c !== answer && c !== trap).slice(0, 2)]),
    distractorMap: { [String(trap)]: 'compare.additive-for-multiplicative' },
    resolvedCategory: 'word_problems',
  };
}

// ─── P2-11 · Inverse relationships ───────────────────────────────────────────

/**
 * Given 7 × 8 = 56, what is 56 ÷ 8?
 *
 * Taught as STRUCTURE: the fact is given, so nothing is being computed. What
 * is being tested is whether the child sees × and ÷ as one relationship or as
 * two unrelated procedures — which is the difference between recalling 24
 * facts and recalling 12.
 */
export function genInverse(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  const hi = lang === 'hi';
  const useMul = Math.random() < 0.5;

  if (useMul) {
    const a = ri(3, 12);
    const b = ri(3, 12);
    const p = a * b;
    return {
      questionText: hi ? `आप जानते हैं कि ${a} × ${b} = ${p}।\nतो ${p} ÷ ${b} = ?`
                       : `You know ${a} × ${b} = ${p}.\nSo ${p} ÷ ${b} = ?`,
      answer: a,
      choices: makeIntChoices(a),
      resolvedCategory: 'division',
    };
  }

  const a = ri(15, 80);
  const b = ri(5, 40);
  const s = a + b;
  return {
    questionText: hi ? `आप जानते हैं कि ${a} + ${b} = ${s}।\nतो ${s} − ${b} = ?`
                     : `You know ${a} + ${b} = ${s}.\nSo ${s} − ${b} = ?`,
    answer: a,
    choices: makeIntChoices(a),
    resolvedCategory: 'subtraction',
  };
}

// ─── P2-14 · Rounding as a decision ──────────────────────────────────────────

/**
 * Rounding presented as a judgement about precision, not a digit rule.
 *
 * The existing bank had "round 47 to the nearest ten", which a child passes by
 * applying a memorised rule about the digit after the place. These items ask
 * WHICH precision is appropriate, which is the actual skill: nobody rounds in
 * real life without a reason.
 */
export function genRounding(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  const hi = lang === 'hi';
  const form = ri(1, 2);

  if (form === 1) {
    // Two numbers round to the same value — so a rounded answer cannot
    // distinguish them. The point is that rounding LOSES information.
    const ten = ri(3, 9) * 10;
    const a = ten + ri(1, 4);
    const b = ten + ri(1, 4) === a ? ten + 5 : ten + ri(1, 4);
    return {
      questionText: hi
        ? `${a} और ${b} — दोनों को निकटतम दहाई तक पूर्णांकित करें।\nक्या उत्तर एक ही आएगा?`
        : `Round both ${a} and ${b} to the nearest ten.\nDo they give the same answer?`,
      answer: Math.round(a / 10) === Math.round(b / 10) ? (hi ? 'हाँ' : 'Yes') : (hi ? 'नहीं' : 'No'),
      choices: [hi ? 'हाँ' : 'Yes', hi ? 'नहीं' : 'No'],
      resolvedCategory: 'number_sense',
    };
  }

  // Choosing the precision that fits the purpose.
  //
  // The thousands digit is capped BELOW 5 so that rounding to the nearest
  // thousand and to the nearest ten-thousand cannot land on the same value.
  // Measured: 9678 gives "About 10000" twice, a duplicated tile and a free
  // elimination.
  const crowd = ri(1, 4) * 1000 + ri(1, 999);
  return {
    questionText: hi
      ? `एक मेले में ${crowd} लोग आए।\nअख़बार में यह संख्या कैसे लिखी जानी चाहिए?`
      : `${crowd} people came to a fair.\nHow should a newspaper report that number?`,
    answer: hi ? `लगभग ${Math.round(crowd / 1000) * 1000}` : `About ${Math.round(crowd / 1000) * 1000}`,
    choices: shuffleArr([
      hi ? `लगभग ${Math.round(crowd / 1000) * 1000}` : `About ${Math.round(crowd / 1000) * 1000}`,
      hi ? `ठीक ${crowd}` : `Exactly ${crowd}`,
      hi ? `लगभग ${Math.round(crowd / 10000) * 10000}` : `About ${Math.round(crowd / 10000) * 10000}`,
    ]),
    resolvedCategory: 'number_sense',
  };
}
