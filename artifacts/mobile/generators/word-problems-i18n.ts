// ─── Localised word problems ─────────────────────────────────────────────────
// Replaces the euro-and-Tom-and-Jane templates with Indian names, rupees and
// familiar contexts, in English or Hindi.
//
// Word problems are the one category where language matters most: the child has
// to *read* before they can compute, so a Hindi-medium learner practising in
// English is being tested on English, not mathematics.

import type { SchoolClass, Difficulty, Question } from './types';
import { ri, pick, makeIntChoices } from './helpers';
import type { Lang } from '../i18n/strings';
import { names, item } from '../i18n/strings';
import type { Board } from '../curriculum/boards';
import { scaleBound, DEFAULT_BOARD } from '../curriculum/boards';

type Ctx = { lang: Lang; board: Board; cls: SchoolClass; diff: Difficulty };

/** A template returns the question text and its answer. */
type Template = (c: Ctx) => { text: string; answer: number };

const N = (c: Ctx) => pick(names(c.lang));

// ─── Class 3: single-step problems within 100 ────────────────────────────────

const CLASS3: Template[] = [
  c => {
    const a = scaleBound(c.board, ri(10, 40), 5);
    const b = ri(1, Math.max(2, a - 5));
    const who = N(c);
    return {
      text: c.lang === 'hi'
        ? `${who} के पास ${a} ${item('mangoes', 'hi')} हैं।\nवह ${b} दे देता है। कितने बचे?`
        : `${who} has ${a} ${item('mangoes', 'en')}.\nGives away ${b}. How many are left?`,
      answer: a - b,
    };
  },
  c => {
    const a = ri(5, 15), b = ri(5, 15);
    return {
      text: c.lang === 'hi'
        ? `कक्षा में ${a} लड़के और ${b} लड़कियाँ हैं।\nकुल कितने बच्चे हैं?`
        : `A class has ${a} boys and ${b} girls.\nHow many children in total?`,
      answer: a + b,
    };
  },
  c => {
    const rows = ri(2, 6), each = ri(2, 6);
    return {
      text: c.lang === 'hi'
        ? `एक डिब्बे में ${rows} पंक्तियाँ हैं, हर पंक्ति में ${each} ${item('laddoos', 'hi')}।\nकुल कितने ${item('laddoos', 'hi')}?`
        : `A box has ${rows} rows of ${each} ${item('laddoos', 'en')}.\nHow many ${item('laddoos', 'en')} in total?`,
      answer: rows * each,
    };
  },
  c => {
    const kids = ri(2, 6);
    const total = kids * ri(4, Math.max(5, Math.floor(60 / kids)));
    return {
      text: c.lang === 'hi'
        ? `${total} ${item('chocolates', 'hi')} ${kids} बच्चों में बराबर बाँटी गईं।\nहर बच्चे को कितनी मिलीं?`
        : `${total} ${item('chocolates', 'en')} shared equally among ${kids} children.\nHow many each?`,
      answer: total / kids,
    };
  },
  c => {
    const perWeek = scaleBound(c.board, ri(5, 15), 2);
    const weeks = ri(2, 5);
    const who = N(c);
    return {
      text: c.lang === 'hi'
        ? `${who} हर हफ़्ते ₹${perWeek} बचाता है।\n${weeks} हफ़्तों में कितने रुपये?`
        : `${who} saves ₹${perWeek} each week.\nHow much after ${weeks} weeks?`,
      answer: perWeek * weeks,
    };
  },
];

// ─── Class 4: two-step and rate problems ─────────────────────────────────────

const CLASS4: Template[] = [
  c => {
    const kids = ri(3, 8);
    const each = scaleBound(c.board, ri(5, 15), 3);
    return {
      text: c.lang === 'hi'
        ? `${kids} बच्चों ने हर एक ने ${each} ${item('flowers', 'hi')} इकट्ठे किए।\nकुल कितने ${item('flowers', 'hi')}?`
        : `${kids} children each collected ${each} ${item('flowers', 'en')}.\nHow many in total?`,
      answer: kids * each,
    };
  },
  c => {
    const price = scaleBound(c.board, ri(5, 20), 2);
    const qty = ri(2, 8);
    return {
      text: c.lang === 'hi'
        ? `एक ${item('pencils', 'hi').slice(0, -2)} की कीमत ₹${price} है।\n${qty} की कीमत कितनी?`
        : `One pencil costs ₹${price}.\nWhat do ${qty} pencils cost?`,
      answer: price * qty,
    };
  },
  c => {
    const note = pick([50, 100, 200, 500]);
    const spent = ri(10, note - 10);
    const who = N(c);
    return {
      text: c.lang === 'hi'
        ? `${who} ने ₹${note} का नोट दिया और ₹${spent} खर्च किए।\nकितने रुपये वापस मिले?`
        : `${who} paid with a ₹${note} note and spent ₹${spent}.\nHow much change?`,
      answer: note - spent,
    };
  },
  c => {
    const speed = scaleBound(c.board, ri(20, 60), 10);
    const hours = ri(2, 5);
    return {
      text: c.lang === 'hi'
        ? `एक साइकिल ${speed} किमी/घंटा की गति से चलती है।\n${hours} घंटे में कितनी दूरी?`
        : `A cyclist travels at ${speed} km/h.\nHow far in ${hours} hours?`,
      answer: speed * hours,
    };
  },
];

// ─── Class 5–6: multi-step ───────────────────────────────────────────────────

const CLASS5PLUS: Template[] = [
  c => {
    const speed = scaleBound(c.board, ri(40, 120), 20);
    const hours = ri(2, 5);
    return {
      text: c.lang === 'hi'
        ? `एक बस ${speed} किमी/घंटा से चलती है।\n${hours} घंटे में कितने किलोमीटर?`
        : `A bus travels at ${speed} km/h.\nHow many km in ${hours} hours?`,
      answer: speed * hours,
    };
  },
  c => {
    // Percentage of a class — base chosen so the answer is a whole number.
    const pct = pick([10, 20, 25, 50]);
    const step = 100 / pct;
    const n = step * ri(2, Math.max(3, Math.floor(200 / step)));
    return {
      text: c.lang === 'hi'
        ? `${n} विद्यार्थियों में से ${pct}% को पूरे अंक मिले।\nकितने विद्यार्थी?`
        : `${pct}% of ${n} students scored full marks.\nHow many students?`,
      answer: (pct * n) / 100,
    };
  },
  c => {
    const total = scaleBound(c.board, ri(20, 60), 10);
    const boxes = pick([2, 3, 4, 5]);
    const perBox = total;
    return {
      text: c.lang === 'hi'
        ? `हर पेटी में ${perBox} ${item('apples', 'hi')} हैं।\n${boxes} पेटियों में कुल कितने?`
        : `Each crate holds ${perBox} ${item('apples', 'en')}.\nHow many in ${boxes} crates?`,
      answer: perBox * boxes,
    };
  },
  c => {
    const runs = ri(20, 90);
    const overs = pick([2, 4, 5]);
    const total = runs * overs;
    return {
      text: c.lang === 'hi'
        ? `एक टीम ने ${overs} ओवर में ${total} रन बनाए।\nप्रति ओवर औसत कितना?`
        : `A team scored ${total} runs in ${overs} overs.\nWhat is the run rate per over?`,
      answer: runs,
    };
  },
];

/**
 * Localised, board-scaled word problems.
 * Falls back to the Class 3 pool for lower classes so the category is never
 * empty if it is ever enabled earlier.
 */
export function genWordProblemsI18n(
  cls: SchoolClass,
  diff: Difficulty,
  lang: Lang = 'en',
  board: Board = DEFAULT_BOARD,
): Question {
  const ctx: Ctx = { lang, board, cls, diff };
  const pool =
    cls === '5th' || cls === '6th' ? CLASS5PLUS
    : cls === '4th' ? CLASS4
    : CLASS3;

  const { text, answer } = pick(pool)(ctx);
  return {
    questionText: text,
    answer,
    choices: makeIntChoices(answer),
    resolvedCategory: 'word_problems',
  };
}
