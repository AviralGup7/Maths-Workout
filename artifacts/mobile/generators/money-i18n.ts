// ─── Localised money questions ───────────────────────────────────────────────
// The originals used euro cents ("9c + 2c"), and coin denominations that do not
// exist in India. Indian currency in circulation is:
//   coins ₹1, ₹2, ₹5, ₹10   ·   notes ₹10, ₹20, ₹50, ₹100, ₹200, ₹500
// Paise coins are effectively out of circulation, so amounts are whole rupees.

import type { SchoolClass, Difficulty, Question } from './types';
import { ri, pick, makeIntChoices } from './helpers';
import type { Lang } from '../i18n/strings';
import { names } from '../i18n/strings';
import type { Board } from '../curriculum/boards';
import { scaleBound, DEFAULT_BOARD } from '../curriculum/boards';

const COINS = [1, 2, 5, 10];
const NOTES = [10, 20, 50, 100, 200, 500];

type Ctx = { lang: Lang; board: Board };
type Template = (c: Ctx) => { text: string; answer: number };

// ─── Class 1–2: coins, small sums ────────────────────────────────────────────

const EARLY: Template[] = [
  c => {
    const a = pick(COINS), b = pick(COINS);
    return {
      text: c.lang === 'hi' ? `₹${a} + ₹${b} = ?` : `₹${a} + ₹${b} = ?`,
      answer: a + b,
    };
  },
  c => {
    const have = ri(5, 20), spend = ri(1, have - 1);
    const who = pick(names(c.lang));
    return {
      text: c.lang === 'hi'
        ? `${who} के पास ₹${have} हैं और वह ₹${spend} खर्च करता है।\nकितने बचे?`
        : `${who} has ₹${have} and spends ₹${spend}.\nHow much is left?`,
      answer: have - spend,
    };
  },
  c => {
    const coin = pick(COINS), n = ri(2, 5);
    return {
      text: c.lang === 'hi'
        ? `₹${coin} के ${n} सिक्के।\nकुल कितने रुपये?`
        : `${n} coins of ₹${coin}.\nHow much altogether?`,
      answer: coin * n,
    };
  },
];

// ─── Class 3–4: change from a note ───────────────────────────────────────────

const MIDDLE: Template[] = [
  c => {
    const note = pick([20, 50, 100]);
    const price = ri(5, note - 5);
    return {
      text: c.lang === 'hi'
        ? `कीमत ₹${price} है।\n₹${note} का नोट दिया। कितने वापस मिलेंगे?`
        : `An item costs ₹${price}.\nYou pay with ₹${note}. What is the change?`,
      answer: note - price,
    };
  },
  c => {
    const price = scaleBound(c.board, ri(10, 40), 5);
    const qty = ri(2, 6);
    return {
      text: c.lang === 'hi'
        ? `एक कॉपी ₹${price} की है।\n${qty} कॉपियों की कीमत?`
        : `One notebook costs ₹${price}.\nWhat do ${qty} notebooks cost?`,
      answer: price * qty,
    };
  },
  c => {
    const total = pick([60, 80, 100, 120]);
    const people = pick([2, 4, 5]);
    return {
      text: c.lang === 'hi'
        ? `₹${total} को ${people} दोस्तों में बराबर बाँटा।\nहर एक को कितने?`
        : `₹${total} shared equally among ${people} friends.\nHow much each?`,
      answer: total / people,
    };
  },
];

// ─── Class 5–6: multi-item bills ─────────────────────────────────────────────

const LATER: Template[] = [
  c => {
    const p1 = scaleBound(c.board, ri(15, 60), 5);
    const p2 = scaleBound(c.board, ri(15, 60), 5);
    const note = 500;
    return {
      text: c.lang === 'hi'
        ? `दो चीज़ों की कीमत ₹${p1} और ₹${p2} है।\n₹${note} देने पर कितने वापस?`
        : `Two items cost ₹${p1} and ₹${p2}.\nChange from ₹${note}?`,
      answer: note - p1 - p2,
    };
  },
  c => {
    const price = scaleBound(c.board, ri(20, 80), 10);
    const qty = ri(3, 9);
    return {
      text: c.lang === 'hi'
        ? `${qty} टिकट, हर एक ₹${price} का।\nकुल कितना खर्च?`
        : `${qty} tickets at ₹${price} each.\nTotal cost?`,
      answer: price * qty,
    };
  },
  c => {
    // Simple discount — introduces percentage in a money context.
    const pct = pick([10, 20, 25, 50]);
    const step = 100 / pct;
    const price = step * ri(2, 20);
    return {
      text: c.lang === 'hi'
        ? `₹${price} की वस्तु पर ${pct}% छूट है।\nकितनी छूट मिली?`
        : `An item costs ₹${price} with ${pct}% off.\nHow much is the discount?`,
      answer: (price * pct) / 100,
    };
  },
];

/** Money questions in rupees, localised and board-scaled. */
export function genMoneyI18n(
  cls: SchoolClass,
  diff: Difficulty,
  lang: Lang = 'en',
  board: Board = DEFAULT_BOARD,
): Question {
  const ctx: Ctx = { lang, board };
  const pool =
    cls === '1st' || cls === '2nd' ? EARLY
    : cls === '3rd' || cls === '4th' ? MIDDLE
    : LATER;

  const { text, answer } = pick(pool)(ctx);
  return {
    questionText: text,
    answer,
    choices: makeIntChoices(answer),
    resolvedCategory: 'money',
  };
}

/** Denominations, exported for any UI that wants to show real coins/notes. */
export const INDIAN_COINS = COINS;
export const INDIAN_NOTES = NOTES;
