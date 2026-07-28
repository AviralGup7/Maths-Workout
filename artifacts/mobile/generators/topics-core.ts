// ─── Core topic generators ────────────────────────────────────────────────────
// Covers: shapes, time, money, place_value, measurement
// Curriculum alignment:
//   Time    — Class 1/2: basic facts & simple duration; Class 3+: full duration & calendars
//   Money   — Class 1: coins to 20c; Class 2: change from ₹1; Class 3+: larger amounts
//   PlaceValue — Class 2: tens/units only; Class 3: HTU; Class 4+: thousands

import { SchoolClass, Difficulty, Question } from './types';
import { ri, pick, shuffleArr, makeIntChoices, makeStrChoices } from './helpers';
import type { Lang } from '../i18n/strings';
import { shapeName } from '../i18n/strings';
import { qp, dayNames, monthNames, shapeObjects } from '../i18n/questions';

// ─── Shapes ──────────────────────────────────────────────────────────────────

const SHAPE_DATA = [
  { name: 'Triangle',   sides: 3, corners: 3 },
  { name: 'Square',     sides: 4, corners: 4 },
  { name: 'Rectangle',  sides: 4, corners: 4 },
  { name: 'Pentagon',   sides: 5, corners: 5 },
  { name: 'Hexagon',    sides: 6, corners: 6 },
  { name: 'Octagon',    sides: 8, corners: 8 },
  { name: 'Circle',     sides: 0, corners: 0 },
];

export function genShapes(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  // Class 3+ hard: perimeter / basic area
  if (diff === 'hard' && cls !== '1st' && cls !== '2nd') {
    const side = ri(2, 10);
    const isSq = Math.random() < 0.5;
    const answer = isSq ? side * 4 : side * 3;
    const t = qp(isSq ? 'periSquare' : 'periEquiTri', lang);
    return { questionText: qp('perimeterOfWithSide', lang, t, side), answer, choices: makeIntChoices(answer) };
  }
  // Class 1/2: limit to simple shapes (tri, sq, rect, circle)
  const pool = (cls === '1st' || cls === '2nd')
    ? SHAPE_DATA.filter(s => s.sides <= 4)
    : diff === 'easy'
    ? SHAPE_DATA.filter(s => s.sides <= 4)
    : SHAPE_DATA;
  const shape = pick(pool);
  // Shape NAMES are localised through the existing SHAPE_NAMES map, and the
  // distractor list must be localised too — a Hindi question with English
  // options would be worse than either language alone.
  const shapeNames = SHAPE_DATA.map(s => shapeName(s.name, lang));
  const thisShape = shapeName(shape.name, lang);

  // docs/21 · F8. Two question shapes over a four-shape pool produced SEVEN
  // distinct questions across all three difficulties, with one item accounting
  // for 25% of every draw. A child meets the same sentence within minutes. The
  // variants below ask genuinely different things about the same shapes —
  // corners, right angles, and recognising them in the world — which is also
  // closer to how shape is actually taught at this age.
  switch (ri(0, 4)) {
    case 0:
      if (shape.name === 'Circle') {
        return { questionText: qp('howManyCorners', lang, shapeName('Circle', lang)), answer: 0, choices: makeIntChoices(0) };
      }
      return {
        questionText: qp('howManySides', lang, thisShape),
        answer: shape.sides, choices: makeIntChoices(shape.sides),
      };

    case 1:
      return {
        questionText: qp('shapeWithSides', lang, shape.sides === 0 ? qp('noSides', lang) : String(shape.sides)),
        answer: thisShape,
        choices: makeStrChoices(thisShape, shapeNames),
      };

    case 2:
      // Corners equal sides for every polygon here, but asking it separately is
      // not redundant to a young child: "side" and "corner" are distinct ideas
      // and conflating them is a documented early misconception.
      return {
        questionText: qp('howManyCorners', lang, thisShape),
        answer: shape.sides, choices: makeIntChoices(shape.sides),
      };

    case 3: {
      const rightAngles: Record<string, number> = { Square: 4, Rectangle: 4, Triangle: 0, Circle: 0, Pentagon: 0, Hexagon: 0, Octagon: 0 };
      const n = rightAngles[shape.name] ?? 0;
      return {
        questionText: qp('howManyRightAng', lang, thisShape),
        answer: n, choices: makeIntChoices(n),
      };
    }

    default: {
      const opts = shapeObjects(shape.name, lang);
      if (!opts) {
        return {
          questionText: qp('howManySides', lang, thisShape),
          answer: shape.sides, choices: makeIntChoices(shape.sides),
        };
      }
      return {
        questionText: qp('whatShapeIs', lang, pick(opts)),
        answer: thisShape,
        choices: makeStrChoices(thisShape, shapeNames),
      };
    }
  }
}

// ─── Time ────────────────────────────────────────────────────────────────────

export function genTime(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  type TQ = () => Question;

  // Class 1: basic time facts only
  if (cls === '1st') {
    const facts: TQ[] = [
      () => ({ questionText: qp('minsInHour', lang), answer: 60, choices: makeIntChoices(60) }),
      () => ({ questionText: qp('hoursInDay', lang), answer: 24, choices: makeIntChoices(24) }),
      () => ({ questionText: qp('daysInWeek', lang), answer: 7, choices: makeIntChoices(7) }),
      () => ({ questionText: qp('monthsInYear', lang), answer: 12, choices: makeIntChoices(12) }),
      () => ({ questionText: qp('daysInFeb', lang), answer: 28, choices: makeIntChoices(28) }),
      () => { const n = ri(1, 5); return { questionText: qp('oclockUntil', lang, n), answer: 1, choices: makeIntChoices(1) }; },
      // docs/21 · F8. The five constants above gave this cell 10 distinct
      // questions across ALL difficulties, so a Class 1 child saw the same
      // sentence every few minutes. These ask the same Class 1 ideas — ordering
      // the day, counting on in hours — with real variation.
      () => {
        const start = ri(1, 8);
        const on = ri(1, 4);
        return {
          questionText: qp('itIsOclockIn', lang, start, on),
          answer: start + on, choices: makeIntChoices(start + on),
        };
      },
      () => {
        const days = dayNames(lang);
        const i = ri(0, 6);
        return {
          questionText: qp('dayAfter', lang, days[i]),
          answer: days[(i + 1) % 7],
          choices: makeStrChoices(days[(i + 1) % 7], days),
        };
      },
      () => {
        const months = monthNames(lang);
        const i = ri(0, 11);
        return {
          questionText: qp('monthAfter', lang, months[i]),
          answer: months[(i + 1) % 12],
          choices: makeStrChoices(months[(i + 1) % 12], months),
        };
      },
      () => {
        const w = ri(2, 4);
        return { questionText: qp('daysInWeeks', lang, w), answer: w * 7, choices: makeIntChoices(w * 7) };
      },
    ];
    return pick(facts)();
  }

  // Class 2: facts + simple hour-based duration
  if (cls === '2nd') {
    // docs/21 · F8. Four constants gave this cell four distinct questions.
    const easy: TQ[] = [
      () => ({ questionText: qp('minsInHour', lang), answer: 60, choices: makeIntChoices(60) }),
      () => ({ questionText: qp('hoursInDay', lang), answer: 24, choices: makeIntChoices(24) }),
      () => ({ questionText: qp('daysInWeek', lang), answer: 7, choices: makeIntChoices(7) }),
      () => ({ questionText: qp('monthsInYear', lang), answer: 12, choices: makeIntChoices(12) }),
      () => { const w = ri(2, 6); return { questionText: qp('daysInWeeks', lang, w), answer: w * 7, choices: makeIntChoices(w * 7) }; },
      () => { const h = ri(1, 9); const on = ri(1, 3); return { questionText: qp('itIsOclockIn', lang, h, on), answer: h + on, choices: makeIntChoices(h + on) }; },
      () => { const m = ri(1, 11) * 5; return { questionText: qp('minsPastHour', lang, m), answer: 60 - m, choices: makeIntChoices(60 - m) }; },
      () => {
        const days = dayNames(lang);
        const i = ri(0, 6);
        return { questionText: qp('dayAfter', lang, days[i]), answer: days[(i + 1) % 7], choices: makeStrChoices(days[(i + 1) % 7], days) };
      },
    ];
    const medium: TQ[] = [
      () => { const n = ri(2, 6); return { questionText: qp('minsInHours', lang, n), answer: n * 60, choices: makeIntChoices(n * 60) }; },
      () => { const h = ri(1, 8); const add = ri(1, 4); return { questionText: qp('lessonStarts', lang, h, add), answer: h + add, choices: makeIntChoices(h + add) }; },
      () => ({ questionText: qp('daysInFeb', lang), answer: 28, choices: makeIntChoices(28) }),
      () => { const n = ri(2, 6); return { questionText: qp('hoursInDays', lang, n), answer: n * 24, choices: makeIntChoices(n * 24) }; },
      () => { const m = ri(2, 9) * 5; return { questionText: qp('gameLasts', lang, m), answer: 60 - m, choices: makeIntChoices(60 - m) }; },
      () => { const w = ri(2, 8); return { questionText: qp('daysInWeeks', lang, w), answer: w * 7, choices: makeIntChoices(w * 7) }; },
      () => { const h = ri(1, 9); const on = ri(2, 4); return { questionText: qp('schoolStarts', lang, h, on), answer: h + on, choices: makeIntChoices(h + on) }; },
    ];
    const hard: TQ[] = [
      () => { const start = ri(6, 10); const end = ri(start + 1, start + 6); return { questionText: qp('hoursFromTo', lang, start, end), answer: end - start, choices: makeIntChoices(end - start) }; },
      () => { const n = ri(2, 5); return { questionText: qp('weeksEqDays', lang, n), answer: n * 7, choices: makeIntChoices(n * 7) }; },
    ];
    return pick(diff === 'easy' ? easy : diff === 'medium' ? medium : hard)();
  }

  // Class 3+: full time generators.
  //
  // docs/21 · F8. The `easy` band held four CONSTANT facts and nothing else, so
  // 20,000 draws produced 4 distinct questions and a single item was 25% of
  // everything a Class 4 child ever saw in this cell. Against the 60-question
  // repetition window the probability of a repeat was 1.0, which both bores the
  // learner and lets them memorise a string rather than read a clock.
  //
  // The parameterised items below ask the same underlying skills — unit
  // conversion and clock reading — with real variation.
  const easy: TQ[] = [
    () => ({ questionText: qp('minsInHour', lang), answer: 60, choices: makeIntChoices(60) }),
    () => ({ questionText: qp('hoursInDay', lang), answer: 24, choices: makeIntChoices(24) }),
    () => ({ questionText: qp('daysInWeek', lang), answer: 7, choices: makeIntChoices(7) }),
    () => ({ questionText: qp('monthsInYear', lang), answer: 12, choices: makeIntChoices(12) }),
    // Reading a clock face, quarter by quarter.
    () => {
      const h = ri(1, 12);
      const q = pick([15, 30, 45]);
      const label = qp(q === 15 ? 'quarterPast' : q === 30 ? 'halfPast' : 'quarterTo', lang);
      return {
        questionText: qp('clockReads', lang, label, h),
        answer: q, choices: makeIntChoices(q),
      };
    },
    // Minutes remaining in the hour — the most common real-world time question.
    () => {
      const m = ri(1, 11) * 5;
      return {
        questionText: qp('minsPastHour', lang, m),
        answer: 60 - m, choices: makeIntChoices(60 - m),
      };
    },
    () => {
      const d = ri(2, 6);
      return { questionText: qp('hoursInDays', lang, d), answer: d * 24, choices: makeIntChoices(d * 24) };
    },
    () => {
      const w = ri(2, 8);
      return { questionText: qp('daysInWeeks', lang, w), answer: w * 7, choices: makeIntChoices(w * 7) };
    },
  ];
  const medium: TQ[] = [
    () => { const n = ri(2, 6); return { questionText: qp('minsInHours', lang, n), answer: n * 60, choices: makeIntChoices(n * 60) }; },
    () => { const n = ri(2, 5); return { questionText: qp('secsInMins', lang, n), answer: n * 60, choices: makeIntChoices(n * 60) }; },
    () => { const h = ri(1, 10); const add = ri(1, 6); return { questionText: qp('lessonStarts', lang, h, add), answer: h + add, choices: makeIntChoices(h + add) }; },
    () => ({ questionText: qp('daysInFeb', lang), answer: 28, choices: makeIntChoices(28) }),
    () => { const d = ri(2, 9); return { questionText: qp('hoursInDays', lang, d), answer: d * 24, choices: makeIntChoices(d * 24) }; },
    () => { const m = ri(1, 11) * 5; return { questionText: qp('busLeaves', lang, m), answer: 60 - m, choices: makeIntChoices(60 - m) }; },
  ];
  const hard: TQ[] = [
    () => { const h = ri(1, 6); const m = ri(15, 45); return { questionText: qp('filmStarts', lang, h, m), answer: m, choices: makeIntChoices(m) }; },
    () => { const start = ri(6, 10); const end = ri(12, 18); return { questionText: qp('hoursFromTo', lang, start, end), answer: end - start, choices: makeIntChoices(end - start) }; },
    () => { const n = ri(2, 5); return { questionText: qp('weeksEqDays', lang, n), answer: n * 7, choices: makeIntChoices(n * 7) }; },
  ];
  return pick(diff === 'easy' ? easy : diff === 'medium' ? medium : hard)();
}

// ─── Money ───────────────────────────────────────────────────────────────────

export function genMoney(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  type TQ = () => Question;

  // Class 1: simple coins up to 20c
  if (cls === '1st') {
    const qs: TQ[] = [
      () => { const a = ri(1, 10); const b = ri(1, 10 - a); return { questionText: `${a}c + ${b}c = ?`, answer: a + b, choices: makeIntChoices(a + b) }; },
      () => { const a = ri(3, 15); const b = ri(1, a - 1); return { questionText: qp('haveSpendLeft', lang, a, b), answer: a - b, choices: makeIntChoices(a - b) }; },
      () => { const coins = pick([1, 2, 5, 10, 20]); const n = ri(2, 4); return { questionText: qp('coinsAltogether', lang, n, coins), answer: n * coins, choices: makeIntChoices(n * coins) }; },
    ];
    return pick(qs)();
  }

  // Class 2: up to ₹1, change from ₹1
  if (cls === '2nd') {
    const easy: TQ[] = [
      () => { const a = ri(5, 20); const b = ri(1, a - 1); return { questionText: qp('haveSpendLeft', lang, a, b), answer: a - b, choices: makeIntChoices(a - b) }; },
      () => { const a = ri(5, 15); const b = ri(2, 5); return { questionText: `${a}c + ${b}c = ?`, answer: a + b, choices: makeIntChoices(a + b) }; },
    ];
    const medium: TQ[] = [
      () => { const price = ri(20, 80); const pay = ri(price + 1, 100); return { questionText: qp('priceIPayChange', lang, price, pay), answer: pay - price, choices: makeIntChoices(pay - price) }; },
      () => { const a = ri(2, 5); const price = ri(5, 20); return { questionText: qp('itemsCostEach', lang, a, price), answer: a * price, choices: makeIntChoices(a * price) }; },
    ];
    const hard: TQ[] = [
      () => { const price = ri(40, 95); return { questionText: qp('costsPayRupee', lang, price), answer: 100 - price, choices: makeIntChoices(100 - price) }; },
      () => { const a = ri(2, 4); const price = ri(15, 35); return { questionText: qp('booksCostEach', lang, a, price), answer: a * price, choices: makeIntChoices(a * price) }; },
    ];
    return pick(diff === 'easy' ? easy : diff === 'medium' ? medium : hard)();
  }

  // Class 3+: current full range
  const easy: TQ[] = [
    () => { const a = ri(5, 20); const b = ri(1, a - 1); return { questionText: qp('haveSpendLeft', lang, a, b), answer: a - b, choices: makeIntChoices(a - b) }; },
    () => { const a = ri(5, 15); const b = ri(2, 5); return { questionText: `${a}c + ${b}c = ?`, answer: a + b, choices: makeIntChoices(a + b) }; },
  ];
  const medium: TQ[] = [
    () => { const price = ri(20, 80); const pay = ri(price + 1, 100); return { questionText: qp('priceIPayChange', lang, price, pay), answer: pay - price, choices: makeIntChoices(pay - price) }; },
    () => { const a = ri(2, 5); const price = ri(5, 20); return { questionText: qp('itemsCostEach', lang, a, price), answer: a * price, choices: makeIntChoices(a * price) }; },
  ];
  const hard: TQ[] = [
    () => { const a = ri(2, 5); const each = ri(25, 99); return { questionText: qp('booksTotalOne', lang, a, (a * each / 100).toFixed(2)), answer: each, choices: makeIntChoices(each) }; },
    () => { const price = ri(100, 500); const pay = Math.ceil(price / 100) * 100; return { questionText: qp('costsPayChange', lang, price, pay / 100), answer: pay - price, choices: makeIntChoices(pay - price) }; },
  ];
  return pick(diff === 'easy' ? easy : diff === 'medium' ? medium : hard)();
}

// ─── Place Value ─────────────────────────────────────────────────────────────

export function genPlaceValue(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  // Class 2: tens and units only (2-digit numbers)
  if (cls === '1st' || cls === '2nd') {
    const n = ri(11, 99);
    const tens = Math.floor(n / 10);
    const units = n % 10;
    const types = [
      { q: qp('tensDigitIn', lang, n), a: tens },
      { q: qp('unitsDigitIn', lang, n), a: units },
      { q: qp('tensAndUnits', lang, tens, units), a: n },
    ];
    const t = pick(types);
    return { questionText: t.q, answer: t.a, choices: makeIntChoices(t.a) };
  }

  // Class 3: hundreds, tens, units
  if (cls === '3rd') {
    if (diff === 'easy') {
      const n = ri(11, 99);
      const tens = Math.floor(n / 10);
      return { questionText: qp('tensDigitIn', lang, n), answer: tens, choices: makeIntChoices(tens) };
    }
    if (diff === 'medium') {
      const n = ri(100, 999);
      const hundreds = Math.floor(n / 100);
      const t = pick([
        { q: qp('hundredsDigitIn', lang, n), a: hundreds },
        { q: qp('valueHundreds', lang, n), a: hundreds * 100 },
        { q: qp('howManyTensIn', lang, n), a: Math.floor(n / 10) },
      ]);
      return { questionText: t.q, answer: t.a, choices: makeIntChoices(t.a) };
    }
    const h = ri(1, 9); const t = ri(0, 9); const o = ri(0, 9);
    const num = h * 100 + t * 10 + o;
    const tp = pick([
      { q: qp('hundredsTensOnes', lang, h, t, o), a: num },
      { q: qp('valueOfDigitIn', lang, h, num), a: h * 100 },
    ]);
    return { questionText: tp.q, answer: tp.a, choices: makeIntChoices(tp.a) };
  }

  // Class 4+: include thousands
  if (diff === 'easy') {
    const n = ri(100, 999);
    const hundreds = Math.floor(n / 100);
    return { questionText: qp('hundredsDigitIn', lang, n), answer: hundreds, choices: makeIntChoices(hundreds) };
  }
  if (diff === 'medium') {
    const n = ri(1000, 9999);
    const thousands = Math.floor(n / 1000);
    return { questionText: qp('thousandsDigitIn', lang, n), answer: thousands, choices: makeIntChoices(thousands) };
  }
  const th = ri(1, 9); const h = ri(0, 9); const t = ri(0, 9); const o = ri(0, 9);
  const num = th * 1000 + h * 100 + t * 10 + o;
  return { questionText: qp('thHTO', lang, th, h, t, o), answer: num, choices: makeIntChoices(num) };
}

// ─── Measurement ─────────────────────────────────────────────────────────────

export function genMeasurement(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  type TQ = () => Question;
  const allQ: TQ[] = [
    () => { const n = ri(1, 9); return { questionText: qp('convert', lang, n, 'km', 'm'), answer: n * 1000, choices: makeIntChoices(n * 1000) }; },
    () => { const n = ri(1, 9); return { questionText: qp('convert', lang, n, 'kg', 'g'), answer: n * 1000, choices: makeIntChoices(n * 1000) }; },
    () => { const n = ri(1, 8); return { questionText: qp('convert', lang, n, 'L', 'mL'), answer: n * 1000, choices: makeIntChoices(n * 1000) }; },
    () => { const n = ri(1, 9); return { questionText: qp('convert', lang, n, 'm', 'cm'), answer: n * 100, choices: makeIntChoices(n * 100) }; },
    () => { const n = ri(1, 9) * 1000; return { questionText: qp('convert', lang, n, 'm', 'km'), answer: n / 1000, choices: makeIntChoices(n / 1000) }; },
    () => { const n = ri(2, 9) * 100; return { questionText: qp('convert', lang, n, 'cm', 'm'), answer: n / 100, choices: makeIntChoices(n / 100) }; },
    () => { const n = ri(2, 9) * 1000; return { questionText: qp('convert', lang, n, 'g', 'kg'), answer: n / 1000, choices: makeIntChoices(n / 1000) }; },
    () => { const n = ri(2, 9) * 1000; return { questionText: qp('convert', lang, n, 'mL', 'L'), answer: n / 1000, choices: makeIntChoices(n / 1000) }; },
  ];
  // Simpler conversions for Class 2/3 (only ×1000 direction, no inverse)
  const isEarly = cls === '1st' || cls === '2nd' || cls === '3rd';
  const pool = isEarly
    ? allQ.slice(0, 4)
    : diff === 'easy'
    ? allQ.slice(0, 4)
    : diff === 'medium'
    ? allQ.slice(2, 6)
    : allQ.slice(4);
  return pick(pool)();
}
