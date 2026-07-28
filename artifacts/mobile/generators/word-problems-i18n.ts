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
import { names, item, itemOne, ITEM_KEYS } from '../i18n/strings';
import type { Board } from '../curriculum/boards';
import { scaleBound, DEFAULT_BOARD } from '../curriculum/boards';

type Ctx = {
  lang: Lang; board: Board; cls: SchoolClass; diff: Difficulty;
  /**
   * The surface noun for this question, drawn INDEPENDENTLY of the structure.
   *
   * docs/27 P3-10 · systematic surface-feature variation. Every template used
   * to hardcode its own noun, which produced a perfect confound: measured over
   * 9,600 word problems, `mangoes` was subtraction 100% of the time, `laddoos`
   * multiplication 100%, `chocolates` division 100%, `flowers` addition 100%.
   * A child could choose the operation from the noun without reading the
   * sentence — and would then fail the moment a school test said "apples".
   *
   * Variation theory's claim is the inverse: hold the STRUCTURE constant and
   * vary the SURFACE, so what is learned is the relationship rather than the
   * wording. Drawing the noun per question, from a pool shared by every
   * template, is the whole mechanism.
   */
  it: string;
};

/**
 * The mathematical relationship a template expresses.
 *
 * Declared by the template rather than inferred from its wording. The first
 * version of the P3-10 guard inferred it with a keyword regex and measured
 * every noun as ~75% "multiplication" — which was the CLASSIFIER collapsing
 * several distinct structures onto one keyword, not a confound in the content.
 * A guard that reports a defect that is not there is worse than no guard, so
 * the structure is now ground truth carried on the template.
 */
export type ProblemStructure =
  | 'takeAway' | 'combine' | 'equalGroups' | 'sharing'
  | 'rate' | 'change' | 'unitPrice' | 'percentOf' | 'average';

/** A template returns the question text, its answer, and its structure. */
type Template = (c: Ctx) => { text: string; answer: number; structure: ProblemStructure };

const N = (c: Ctx) => pick(names(c.lang));
/** This question's noun, plural and singular. */
const IT = (c: Ctx) => item(c.it, c.lang);
const IT1 = (c: Ctx) => itemOne(c.it, c.lang);

// ─── Class 3: single-step problems within 100 ────────────────────────────────

const CLASS3: Template[] = [
  c => {
    const a = scaleBound(c.board, ri(10, 40), 5);
    const b = ri(1, Math.max(2, a - 5));
    const who = N(c);
    return {
      text: c.lang === 'hi'
        ? `${who} के पास ${a} ${IT(c)} हैं।\nवह ${b} दे देता है। कितने बचे?`
        : `${who} has ${a} ${IT(c)}.\nGives away ${b}. How many are left?`,
      answer: a - b, structure: 'takeAway',
    };
  },
  c => {
    const a = ri(5, 15), b = ri(5, 15);
    return {
      text: c.lang === 'hi'
        ? `कक्षा में ${a} लड़के और ${b} लड़कियाँ हैं।\nकुल कितने बच्चे हैं?`
        : `A class has ${a} boys and ${b} girls.\nHow many children in total?`,
      answer: a + b, structure: 'combine',
    };
  },
  c => {
    const rows = ri(2, 6), each = ri(2, 6);
    return {
      text: c.lang === 'hi'
        ? `एक डिब्बे में ${rows} पंक्तियाँ हैं, हर पंक्ति में ${each} ${IT(c)}।\nकुल कितने ${IT(c)}?`
        : `A box has ${rows} rows of ${each} ${IT(c)}.\nHow many ${IT(c)} in total?`,
      answer: rows * each, structure: 'equalGroups',
    };
  },
  c => {
    const kids = ri(2, 6);
    const total = kids * ri(4, Math.max(5, Math.floor(60 / kids)));
    return {
      text: c.lang === 'hi'
        ? `${total} ${IT(c)} ${kids} बच्चों में बराबर बाँटी गईं।\nहर बच्चे को कितनी मिलीं?`
        : `${total} ${IT(c)} shared equally among ${kids} children.\nHow many each?`,
      answer: total / kids, structure: 'sharing',
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
      answer: perWeek * weeks, structure: 'rate',
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
        ? `${kids} बच्चों ने हर एक ने ${each} ${IT(c)} इकट्ठे किए।\nकुल कितने ${IT(c)}?`
        : `${kids} children each collected ${each} ${IT(c)}.\nHow many in total?`,
      answer: kids * each, structure: 'equalGroups',
    };
  },
  c => {
    const price = scaleBound(c.board, ri(5, 20), 2);
    const qty = ri(2, 8);
    return {
      text: c.lang === 'hi'
        ? `एक ${IT1(c)} की कीमत ₹${price} है।\n${qty} की कीमत कितनी?`
        : `One ${IT1(c)} costs ₹${price}.\nWhat do ${qty} ${IT(c)} cost?`,
      answer: price * qty, structure: 'unitPrice',
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
      answer: note - spent, structure: 'change',
    };
  },
  c => {
    const speed = scaleBound(c.board, ri(20, 60), 10);
    const hours = ri(2, 5);
    return {
      text: c.lang === 'hi'
        ? `एक साइकिल ${speed} किमी/घंटा की गति से चलती है।\n${hours} घंटे में कितनी दूरी?`
        : `A cyclist travels at ${speed} km/h.\nHow far in ${hours} hours?`,
      answer: speed * hours, structure: 'rate',
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
      answer: speed * hours, structure: 'rate',
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
      answer: (pct * n) / 100, structure: 'percentOf',
    };
  },
  c => {
    const total = scaleBound(c.board, ri(20, 60), 10);
    const boxes = pick([2, 3, 4, 5]);
    const perBox = total;
    return {
      text: c.lang === 'hi'
        ? `हर पेटी में ${perBox} ${IT(c)} हैं।\n${boxes} पेटियों में कुल कितने?`
        : `Each crate holds ${perBox} ${IT(c)}.\nHow many in ${boxes} crates?`,
      answer: perBox * boxes, structure: 'equalGroups',
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
      answer: runs, structure: 'average',
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
  // The noun is drawn ONCE per question and shared by every template, so the
  // surface varies independently of the structure.
  const ctx: Ctx = { lang, board, cls, diff, it: pick(ITEM_KEYS) };
  const pool =
    cls === '5th' || cls === '6th' ? CLASS5PLUS
    : cls === '4th' ? CLASS4
    : CLASS3;

  const { text, answer, structure } = pick(pool)(ctx);
  return {
    questionText: text,
    answer,
    choices: makeIntChoices(answer),
    resolvedCategory: 'word_problems',
    structure,
  };
}
