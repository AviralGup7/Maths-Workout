// ─── Number sense ────────────────────────────────────────────────────────────
// docs/14 §6. The audit measured 0 estimation questions out of 1,720 (and a
// later 27,000-question sample confirmed 0.00%) — the single largest content
// gap in the product.
//
// Number sense is the strongest early predictor of later mathematics
// achievement (Jordan; Siegler), and estimation is the most frequently used
// adult mathematics skill. An app that never asks "about how many?" is training
// a child to compute without ever training them to know whether the answer is
// sensible.
//
// Four strands are implemented here. The fifth (magnitude on a number line)
// needs the NumberLine visual primitive and is deliberately deferred rather
// than faked with text.

import type { SchoolClass, Difficulty, Question } from './types';
import { ri, pick, shuffleArr, makeIntChoices } from './helpers';
import { estimateQuestion } from './interactions';
import type { Lang } from '../i18n/strings';

// ─── Strand 1 · Estimation ───────────────────────────────────────────────────

/**
 * "About how many?" — magnitude before computation.
 *
 * Operands are deliberately awkward (47 × 8, not 50 × 8) so that estimating is
 * genuinely faster than computing. If the exact answer were easy the question
 * would measure arithmetic, not number sense.
 */
export function genEstimation(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  const n = classNumber(cls);

  const forms: (() => { text: string; value: number; tol?: number })[] = [];

  if (n <= 2) {
    forms.push(() => {
      const a = ri(11, 39), b = ri(11, 39);
      return {
        text: lang === 'hi' ? `${a} + ${b} लगभग कितना है?` : `About how much is ${a} + ${b}?`,
        value: a + b, tol: 0.25,
      };
    });
  }

  if (n >= 2) {
    forms.push(() => {
      const a = ri(23, 89), b = ri(18, 76);
      return {
        text: lang === 'hi' ? `${a} + ${b} लगभग कितना है?` : `About how much is ${a} + ${b}?`,
        value: a + b, tol: 0.2,
      };
    });
  }

  if (n >= 3) {
    forms.push(() => {
      const a = ri(17, 49), b = ri(3, 9);
      return {
        text: lang === 'hi' ? `${a} × ${b} लगभग कितना है?` : `About how much is ${a} × ${b}?`,
        value: a * b, tol: 0.2,
      };
    });
    forms.push(() => {
      const price = ri(17, 48), count = ri(3, 8);
      return {
        text: lang === 'hi'
          ? `एक कॉपी ₹${price} की है। ${count} कॉपियों की कीमत लगभग कितनी होगी?`
          : `A notebook costs ₹${price}. About how much for ${count} notebooks?`,
        value: price * count, tol: 0.2,
      };
    });
  }

  if (n >= 4) {
    forms.push(() => {
      const a = ri(120, 480), b = ri(90, 390);
      return {
        text: lang === 'hi' ? `${a} + ${b} लगभग कितना है?` : `About how much is ${a} + ${b}?`,
        value: a + b, tol: 0.15,
      };
    });
    forms.push(() => {
      const total = ri(140, 720), by = ri(4, 9);
      return {
        text: lang === 'hi' ? `${total} ÷ ${by} लगभग कितना है?` : `About how much is ${total} ÷ ${by}?`,
        value: Math.round(total / by), tol: 0.25,
      };
    });
  }

  const f = pick(forms)();
  return estimateQuestion(f.text, f.value, { tolerance: f.tol, resolvedCategory: 'number_sense' });
}

// ─── Strand 2 · Cross-representation comparison ──────────────────────────────

/**
 * "Which is larger: 3/5 or 0.7?"
 *
 * Fluency across representations is what stops a child treating fractions,
 * decimals and percentages as three unrelated topics that happen to share a
 * textbook.
 */
export function genComparison(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  const n = classNumber(cls);
  const pairs: [string, number][][] = [];

  if (n >= 4) {
    pairs.push([['1/2', 0.5], ['0.45', 0.45], ['2/5', 0.4], ['0.55', 0.55]]);
    pairs.push([['3/4', 0.75], ['0.7', 0.7], ['0.8', 0.8], ['2/3', 2 / 3]]);
  }
  if (n >= 5) {
    pairs.push([['3/5', 0.6], ['0.65', 0.65], ['55%', 0.55], ['0.58', 0.58]]);
    pairs.push([['40%', 0.4], ['1/3', 1 / 3], ['0.45', 0.45], ['3/8', 0.375]]);
  }
  if (pairs.length === 0) {
    pairs.push([['1/2', 0.5], ['1/4', 0.25], ['1/3', 1 / 3], ['1/5', 0.2]]);
  }

  const set = pick(pairs);
  const largest = set.reduce((a, b) => (b[1] > a[1] ? b : a));
  return {
    questionText: lang === 'hi' ? 'इनमें सबसे बड़ा कौन है?' : 'Which of these is largest?',
    answer: largest[0],
    choices: shuffleArr(set.map(p => p[0])),
    resolvedCategory: 'number_sense',
  };
}

// ─── Strand 3 · Reasonableness ───────────────────────────────────────────────

/**
 * "Ravi says 6 × 0.5 = 30. Is that sensible?"
 *
 * Error detection builds conceptual understanding more effectively than further
 * practice, because it requires evaluating a procedure rather than executing
 * one. It is also the entry point to the error-hunting format (docs/14 §7 R2).
 */
export function genReasonableness(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  const n = classNumber(cls);
  const names = lang === 'hi'
    ? ['आरव', 'प्रिया', 'रोहन', 'अनन्या']
    : ['Aarav', 'Priya', 'Rohan', 'Ananya'];
  const who = pick(names);

  type Claim = { text: string; sensible: boolean };
  const claims: (() => Claim)[] = [];

  claims.push(() => {
    const a = ri(21, 48), b = ri(21, 48);
    const wrong = Math.random() < 0.5;
    const shown = wrong ? (a + b) * 10 : a + b;
    return {
      text: lang === 'hi'
        ? `${who} कहते हैं ${a} + ${b} = ${shown}. क्या यह ठीक लगता है?`
        : `${who} says ${a} + ${b} = ${shown}. Does that seem sensible?`,
      sensible: !wrong,
    };
  });

  if (n >= 3) {
    claims.push(() => {
      const a = ri(6, 12), b = ri(4, 9);
      const wrong = Math.random() < 0.5;
      const shown = wrong ? a + b : a * b;
      return {
        text: lang === 'hi'
          ? `${who} कहते हैं ${a} × ${b} = ${shown}. क्या यह ठीक लगता है?`
          : `${who} says ${a} × ${b} = ${shown}. Does that seem sensible?`,
        sensible: !wrong,
      };
    });
  }

  if (n >= 5) {
    claims.push(() => {
      const a = ri(4, 9);
      const wrong = Math.random() < 0.5;
      // The classic "multiplying always makes bigger" misconception.
      const shown = wrong ? a * 5 : a / 2;
      return {
        text: lang === 'hi'
          ? `${who} कहते हैं ${a} × 0.5 = ${shown}. क्या यह ठीक लगता है?`
          : `${who} says ${a} × 0.5 = ${shown}. Does that seem sensible?`,
        sensible: !wrong,
      };
    });
  }

  const claim = pick(claims)();
  const yes = lang === 'hi' ? 'हाँ, ठीक है' : 'Yes, that looks right';
  const no = lang === 'hi' ? 'नहीं, कुछ गड़बड़ है' : 'No, something is wrong';

  return {
    questionText: claim.text,
    answer: claim.sensible ? yes : no,
    // Only two options, and that is correct: the construct is a judgement, and
    // padding it to four with nonsense would make the task easier, not harder.
    choices: [yes, no],
    resolvedCategory: 'number_sense',
  };
}

// ─── Strand 4 · Mental strategy ──────────────────────────────────────────────

/**
 * "48 + 27: which is easier?"
 *
 * There is no wrong answer to *which* strategy a child prefers, but there is a
 * more efficient one, and naming strategies is what turns arithmetic from
 * recall into flexible reasoning.
 */
export function genMentalStrategy(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  const a = ri(38, 68), b = ri(17, 29);
  const toNext = 10 - (a % 10);
  const best = lang === 'hi'
    ? `पहले ${toNext} जोड़कर ${a + toNext} बनाएँ, फिर ${b - toNext} जोड़ें`
    : `Add ${toNext} to make ${a + toNext}, then add ${b - toNext}`;
  const others = lang === 'hi'
    ? [`${a} में से ${b} घटाएँ`, `दोनों को 10 से गुणा करें`, `${b} को दो बार जोड़ें`]
    : [`Subtract ${b} from ${a}`, `Multiply both by 10`, `Add ${b} twice`];

  return {
    questionText: lang === 'hi'
      ? `${a} + ${b} हल करने का सबसे आसान तरीका कौन-सा है?`
      : `What is the easiest way to work out ${a} + ${b}?`,
    answer: best,
    choices: shuffleArr([best, ...others]),
    resolvedCategory: 'number_sense',
  };
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

export function genNumberSenseStrand(
  cls: SchoolClass, diff: Difficulty, lang: Lang = 'en',
): Question {
  const n = classNumber(cls);
  const pool: ((c: SchoolClass, d: Difficulty, l: Lang) => Question)[] = [
    genEstimation, genReasonableness,
  ];
  if (n >= 3) pool.push(genMentalStrategy);
  if (n >= 4) pool.push(genComparison);
  return pick(pool)(cls, diff, lang);
}

function classNumber(cls: SchoolClass): number {
  return ['1st', '2nd', '3rd', '4th', '5th', '6th'].indexOf(cls) + 1;
}
