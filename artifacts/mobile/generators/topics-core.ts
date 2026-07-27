// ─── Core topic generators ────────────────────────────────────────────────────
// Covers: shapes, time, money, place_value, measurement
// Curriculum alignment:
//   Time    — Class 1/2: basic facts & simple duration; Class 3+: full duration & calendars
//   Money   — Class 1: coins to 20c; Class 2: change from ₹1; Class 3+: larger amounts
//   PlaceValue — Class 2: tens/units only; Class 3: HTU; Class 4+: thousands

import { SchoolClass, Difficulty, Question } from './types';
import { ri, pick, shuffleArr, makeIntChoices, makeStrChoices } from './helpers';

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

export function genShapes(cls: SchoolClass, diff: Difficulty): Question {
  // Class 3+ hard: perimeter / basic area
  if (diff === 'hard' && cls !== '1st' && cls !== '2nd') {
    const side = ri(2, 10);
    const t = pick(['perimeter of a square', 'perimeter of an equilateral triangle']);
    const answer = t.includes('square') ? side * 4 : side * 3;
    return { questionText: `What is the ${t} with side ${side}?`, answer, choices: makeIntChoices(answer) };
  }
  // Class 1/2: limit to simple shapes (tri, sq, rect, circle)
  const pool = (cls === '1st' || cls === '2nd')
    ? SHAPE_DATA.filter(s => s.sides <= 4)
    : diff === 'easy'
    ? SHAPE_DATA.filter(s => s.sides <= 4)
    : SHAPE_DATA;
  const shape = pick(pool);
  const shapeNames = SHAPE_DATA.map(s => s.name);

  // docs/21 · F8. Two question shapes over a four-shape pool produced SEVEN
  // distinct questions across all three difficulties, with one item accounting
  // for 25% of every draw. A child meets the same sentence within minutes. The
  // variants below ask genuinely different things about the same shapes —
  // corners, right angles, and recognising them in the world — which is also
  // closer to how shape is actually taught at this age.
  switch (ri(0, 4)) {
    case 0:
      if (shape.name === 'Circle') {
        return { questionText: 'How many corners does a Circle have?', answer: 0, choices: makeIntChoices(0) };
      }
      return {
        questionText: `How many sides does a ${shape.name} have?`,
        answer: shape.sides, choices: makeIntChoices(shape.sides),
      };

    case 1:
      return {
        questionText: `A shape with ${shape.sides === 0 ? 'no' : shape.sides} sides is a ___?`,
        answer: shape.name,
        choices: makeStrChoices(shape.name, shapeNames),
      };

    case 2:
      // Corners equal sides for every polygon here, but asking it separately is
      // not redundant to a young child: "side" and "corner" are distinct ideas
      // and conflating them is a documented early misconception.
      return {
        questionText: `How many corners does a ${shape.name} have?`,
        answer: shape.sides, choices: makeIntChoices(shape.sides),
      };

    case 3: {
      const rightAngles: Record<string, number> = { Square: 4, Rectangle: 4, Triangle: 0, Circle: 0, Pentagon: 0, Hexagon: 0, Octagon: 0 };
      const n = rightAngles[shape.name] ?? 0;
      return {
        questionText: `How many right angles does a ${shape.name} have?`,
        answer: n, choices: makeIntChoices(n),
      };
    }

    default: {
      const objects: Record<string, string[]> = {
        Circle:    ['a wheel', 'a chapati', 'a coin', 'a clock face'],
        Square:    ['a carrom board', 'a chessboard', 'a window pane'],
        Rectangle: ['a door', 'a book cover', 'a cricket pitch', 'a blackboard'],
        Triangle:  ['a samosa', 'a slice of pizza', 'a road sign'],
        Pentagon:  ['a home plate', 'a football patch'],
        Hexagon:   ['a honeycomb cell', 'a pencil end'],
        Octagon:   ['a STOP sign'],
      };
      const opts = objects[shape.name];
      if (!opts) {
        return {
          questionText: `How many sides does a ${shape.name} have?`,
          answer: shape.sides, choices: makeIntChoices(shape.sides),
        };
      }
      return {
        questionText: `What shape is ${pick(opts)}?`,
        answer: shape.name,
        choices: makeStrChoices(shape.name, shapeNames),
      };
    }
  }
}

// ─── Time ────────────────────────────────────────────────────────────────────

export function genTime(cls: SchoolClass, diff: Difficulty): Question {
  type TQ = () => Question;

  // Class 1: basic time facts only
  if (cls === '1st') {
    const facts: TQ[] = [
      () => ({ questionText: 'How many minutes are in 1 hour?', answer: 60, choices: makeIntChoices(60) }),
      () => ({ questionText: 'How many hours are in 1 day?', answer: 24, choices: makeIntChoices(24) }),
      () => ({ questionText: 'How many days are in 1 week?', answer: 7, choices: makeIntChoices(7) }),
      () => ({ questionText: 'How many months are in 1 year?', answer: 12, choices: makeIntChoices(12) }),
      () => ({ questionText: 'How many days are in February (non-leap year)?', answer: 28, choices: makeIntChoices(28) }),
      () => { const n = ri(1, 5); return { questionText: `${n} o'clock — how many hours until ${n + 1} o'clock?`, answer: 1, choices: makeIntChoices(1) }; },
      // docs/21 · F8. The five constants above gave this cell 10 distinct
      // questions across ALL difficulties, so a Class 1 child saw the same
      // sentence every few minutes. These ask the same Class 1 ideas — ordering
      // the day, counting on in hours — with real variation.
      () => {
        const start = ri(1, 8);
        const on = ri(1, 4);
        return {
          questionText: `It is ${start} o'clock.\nWhat time will it be in ${on} hour${on > 1 ? 's' : ''}?`,
          answer: start + on, choices: makeIntChoices(start + on),
        };
      },
      () => {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const i = ri(0, 6);
        return {
          questionText: `What day comes straight after ${days[i]}?`,
          answer: days[(i + 1) % 7],
          choices: makeStrChoices(days[(i + 1) % 7], days),
        };
      },
      () => {
        const months = ['January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'];
        const i = ri(0, 11);
        return {
          questionText: `Which month comes straight after ${months[i]}?`,
          answer: months[(i + 1) % 12],
          choices: makeStrChoices(months[(i + 1) % 12], months),
        };
      },
      () => {
        const w = ri(2, 4);
        return { questionText: `How many days are in ${w} weeks?`, answer: w * 7, choices: makeIntChoices(w * 7) };
      },
    ];
    return pick(facts)();
  }

  // Class 2: facts + simple hour-based duration
  if (cls === '2nd') {
    // docs/21 · F8. Four constants gave this cell four distinct questions.
    const easy: TQ[] = [
      () => ({ questionText: 'How many minutes are in 1 hour?', answer: 60, choices: makeIntChoices(60) }),
      () => ({ questionText: 'How many hours are in 1 day?', answer: 24, choices: makeIntChoices(24) }),
      () => ({ questionText: 'How many days are in 1 week?', answer: 7, choices: makeIntChoices(7) }),
      () => ({ questionText: 'How many months are in 1 year?', answer: 12, choices: makeIntChoices(12) }),
      () => { const w = ri(2, 6); return { questionText: `How many days are in ${w} weeks?`, answer: w * 7, choices: makeIntChoices(w * 7) }; },
      () => { const h = ri(1, 9); const on = ri(1, 3); return { questionText: `It is ${h} o'clock.\nWhat time will it be in ${on} hour${on > 1 ? 's' : ''}?`, answer: h + on, choices: makeIntChoices(h + on) }; },
      () => { const m = ri(1, 11) * 5; return { questionText: `It is ${m} minutes past the hour.\nHow many minutes until the next hour?`, answer: 60 - m, choices: makeIntChoices(60 - m) }; },
      () => {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const i = ri(0, 6);
        return { questionText: `What day comes straight after ${days[i]}?`, answer: days[(i + 1) % 7], choices: makeStrChoices(days[(i + 1) % 7], days) };
      },
    ];
    const medium: TQ[] = [
      () => { const n = ri(2, 6); return { questionText: `How many minutes in ${n} hours?`, answer: n * 60, choices: makeIntChoices(n * 60) }; },
      () => { const h = ri(1, 8); const add = ri(1, 4); return { questionText: `A lesson starts at ${h}:00 and lasts ${add} hour${add > 1 ? 's' : ''}.\nWhat hour does it end?`, answer: h + add, choices: makeIntChoices(h + add) }; },
      () => ({ questionText: 'How many days are in February (non-leap year)?', answer: 28, choices: makeIntChoices(28) }),
      () => { const n = ri(2, 6); return { questionText: `How many hours in ${n} days?`, answer: n * 24, choices: makeIntChoices(n * 24) }; },
      () => { const m = ri(2, 9) * 5; return { questionText: `A game lasts ${m} minutes and starts on the hour.\nHow many minutes before the next hour does it end?`, answer: 60 - m, choices: makeIntChoices(60 - m) }; },
      () => { const w = ri(2, 8); return { questionText: `How many days are in ${w} weeks?`, answer: w * 7, choices: makeIntChoices(w * 7) }; },
      () => { const h = ri(1, 9); const on = ri(2, 4); return { questionText: `School starts at ${h}:00 and lasts ${on} hours.\nWhat hour does it finish?`, answer: h + on, choices: makeIntChoices(h + on) }; },
    ];
    const hard: TQ[] = [
      () => { const start = ri(6, 10); const end = ri(start + 1, start + 6); return { questionText: `How many hours from ${start}:00 to ${end}:00?`, answer: end - start, choices: makeIntChoices(end - start) }; },
      () => { const n = ri(2, 5); return { questionText: `${n} weeks = ___ days?`, answer: n * 7, choices: makeIntChoices(n * 7) }; },
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
    () => ({ questionText: 'How many minutes are in 1 hour?', answer: 60, choices: makeIntChoices(60) }),
    () => ({ questionText: 'How many hours are in 1 day?', answer: 24, choices: makeIntChoices(24) }),
    () => ({ questionText: 'How many days are in 1 week?', answer: 7, choices: makeIntChoices(7) }),
    () => ({ questionText: 'How many months are in 1 year?', answer: 12, choices: makeIntChoices(12) }),
    // Reading a clock face, quarter by quarter.
    () => {
      const h = ri(1, 12);
      const q = pick([15, 30, 45]);
      const label = q === 15 ? 'quarter past' : q === 30 ? 'half past' : 'quarter to';
      const shown = q === 45 ? (h === 12 ? 1 : h + 1) : h;
      return {
        questionText: `The clock reads ${label} ${h}.\nHow many minutes past ${shown === h ? h : h}:00 is that?`,
        answer: q, choices: makeIntChoices(q),
      };
    },
    // Minutes remaining in the hour — the most common real-world time question.
    () => {
      const m = ri(1, 11) * 5;
      return {
        questionText: `It is ${m} minutes past the hour.\nHow many minutes until the next hour?`,
        answer: 60 - m, choices: makeIntChoices(60 - m),
      };
    },
    () => {
      const d = ri(2, 6);
      return { questionText: `How many hours in ${d} days?`, answer: d * 24, choices: makeIntChoices(d * 24) };
    },
    () => {
      const w = ri(2, 8);
      return { questionText: `How many days in ${w} weeks?`, answer: w * 7, choices: makeIntChoices(w * 7) };
    },
  ];
  const medium: TQ[] = [
    () => { const n = ri(2, 6); return { questionText: `How many minutes in ${n} hours?`, answer: n * 60, choices: makeIntChoices(n * 60) }; },
    () => { const n = ri(2, 5); return { questionText: `How many seconds in ${n} minutes?`, answer: n * 60, choices: makeIntChoices(n * 60) }; },
    () => { const h = ri(1, 10); const add = ri(1, 6); return { questionText: `A lesson starts at ${h}:00 and lasts ${add} hours.\nWhat hour does it end?`, answer: h + add, choices: makeIntChoices(h + add) }; },
    () => ({ questionText: 'How many days are in February (non-leap year)?', answer: 28, choices: makeIntChoices(28) }),
    () => { const d = ri(2, 9); return { questionText: `How many hours in ${d} days?`, answer: d * 24, choices: makeIntChoices(d * 24) }; },
    () => { const m = ri(1, 11) * 5; return { questionText: `A bus leaves ${m} minutes past the hour.\nHow many minutes is that before the next hour?`, answer: 60 - m, choices: makeIntChoices(60 - m) }; },
  ];
  const hard: TQ[] = [
    () => { const h = ri(1, 6); const m = ri(15, 45); return { questionText: `A film starts at ${h}:00 and is ${m} minutes long.\nHow many minutes past ${h} does it end?`, answer: m, choices: makeIntChoices(m) }; },
    () => { const start = ri(6, 10); const end = ri(12, 18); return { questionText: `How many hours from ${start}:00 to ${end}:00?`, answer: end - start, choices: makeIntChoices(end - start) }; },
    () => { const n = ri(2, 5); return { questionText: `${n} weeks = ___ days?`, answer: n * 7, choices: makeIntChoices(n * 7) }; },
  ];
  return pick(diff === 'easy' ? easy : diff === 'medium' ? medium : hard)();
}

// ─── Money ───────────────────────────────────────────────────────────────────

export function genMoney(cls: SchoolClass, diff: Difficulty): Question {
  type TQ = () => Question;

  // Class 1: simple coins up to 20c
  if (cls === '1st') {
    const qs: TQ[] = [
      () => { const a = ri(1, 10); const b = ri(1, 10 - a); return { questionText: `${a}c + ${b}c = ?`, answer: a + b, choices: makeIntChoices(a + b) }; },
      () => { const a = ri(3, 15); const b = ri(1, a - 1); return { questionText: `I have ${a}c and spend ${b}c.\nHow much is left?`, answer: a - b, choices: makeIntChoices(a - b) }; },
      () => { const coins = pick([1, 2, 5, 10, 20]); const n = ri(2, 4); return { questionText: `${n} × ${coins}c coins.\nHow much altogether?`, answer: n * coins, choices: makeIntChoices(n * coins) }; },
    ];
    return pick(qs)();
  }

  // Class 2: up to ₹1, change from ₹1
  if (cls === '2nd') {
    const easy: TQ[] = [
      () => { const a = ri(5, 20); const b = ri(1, a - 1); return { questionText: `I have ${a}c and spend ${b}c.\nHow much is left?`, answer: a - b, choices: makeIntChoices(a - b) }; },
      () => { const a = ri(5, 15); const b = ri(2, 5); return { questionText: `${a}c + ${b}c = ?`, answer: a + b, choices: makeIntChoices(a + b) }; },
    ];
    const medium: TQ[] = [
      () => { const price = ri(20, 80); const pay = ri(price + 1, 100); return { questionText: `Price is ${price}c.\nI pay ${pay}c. Change?`, answer: pay - price, choices: makeIntChoices(pay - price) }; },
      () => { const a = ri(2, 5); const price = ri(5, 20); return { questionText: `${a} items cost ${price}c each.\nTotal cost?`, answer: a * price, choices: makeIntChoices(a * price) }; },
    ];
    const hard: TQ[] = [
      () => { const price = ri(40, 95); return { questionText: `An item costs ${price}c.\nI pay ₹1.00. Change = ___c?`, answer: 100 - price, choices: makeIntChoices(100 - price) }; },
      () => { const a = ri(2, 4); const price = ri(15, 35); return { questionText: `${a} books cost ${price}c each.\nTotal cost?`, answer: a * price, choices: makeIntChoices(a * price) }; },
    ];
    return pick(diff === 'easy' ? easy : diff === 'medium' ? medium : hard)();
  }

  // Class 3+: current full range
  const easy: TQ[] = [
    () => { const a = ri(5, 20); const b = ri(1, a - 1); return { questionText: `I have ${a}c and spend ${b}c.\nHow much is left?`, answer: a - b, choices: makeIntChoices(a - b) }; },
    () => { const a = ri(5, 15); const b = ri(2, 5); return { questionText: `${a}c + ${b}c = ?`, answer: a + b, choices: makeIntChoices(a + b) }; },
  ];
  const medium: TQ[] = [
    () => { const price = ri(20, 80); const pay = ri(price + 1, 100); return { questionText: `Price is ${price}c.\nI pay ${pay}c. Change?`, answer: pay - price, choices: makeIntChoices(pay - price) }; },
    () => { const a = ri(2, 5); const price = ri(5, 20); return { questionText: `${a} items cost ${price}c each.\nTotal cost?`, answer: a * price, choices: makeIntChoices(a * price) }; },
  ];
  const hard: TQ[] = [
    () => { const a = ri(2, 5); const each = ri(25, 99); return { questionText: `${a} books cost ₹${(a * each / 100).toFixed(2)} in total.\nOne book costs ___c?`, answer: each, choices: makeIntChoices(each) }; },
    () => { const price = ri(100, 500); const pay = Math.ceil(price / 100) * 100; return { questionText: `An item costs ${price}c.\nI pay ₹${pay / 100}. Change = ___c?`, answer: pay - price, choices: makeIntChoices(pay - price) }; },
  ];
  return pick(diff === 'easy' ? easy : diff === 'medium' ? medium : hard)();
}

// ─── Place Value ─────────────────────────────────────────────────────────────

export function genPlaceValue(cls: SchoolClass, diff: Difficulty): Question {
  // Class 2: tens and units only (2-digit numbers)
  if (cls === '1st' || cls === '2nd') {
    const n = ri(11, 99);
    const tens = Math.floor(n / 10);
    const units = n % 10;
    const types = [
      { q: `What is the TENS digit in ${n}?`, a: tens },
      { q: `What is the UNITS digit in ${n}?`, a: units },
      { q: `${tens} tens and ${units} units = ?`, a: n },
    ];
    const t = pick(types);
    return { questionText: t.q, answer: t.a, choices: makeIntChoices(t.a) };
  }

  // Class 3: hundreds, tens, units
  if (cls === '3rd') {
    if (diff === 'easy') {
      const n = ri(11, 99);
      const tens = Math.floor(n / 10);
      return { questionText: `What is the TENS digit in ${n}?`, answer: tens, choices: makeIntChoices(tens) };
    }
    if (diff === 'medium') {
      const n = ri(100, 999);
      const hundreds = Math.floor(n / 100);
      const t = pick([
        { q: `What digit is in the HUNDREDS place in ${n}?`, a: hundreds },
        { q: `What is the value of the hundreds digit in ${n}?`, a: hundreds * 100 },
        { q: `How many tens are in ${n}?`, a: Math.floor(n / 10) },
      ]);
      return { questionText: t.q, answer: t.a, choices: makeIntChoices(t.a) };
    }
    const h = ri(1, 9); const t = ri(0, 9); const o = ri(0, 9);
    const num = h * 100 + t * 10 + o;
    const tp = pick([
      { q: `${h} hundreds, ${t} tens and ${o} ones = ?`, a: num },
      { q: `What is the value of ${h} in the number ${num}?`, a: h * 100 },
    ]);
    return { questionText: tp.q, answer: tp.a, choices: makeIntChoices(tp.a) };
  }

  // Class 4+: include thousands
  if (diff === 'easy') {
    const n = ri(100, 999);
    const hundreds = Math.floor(n / 100);
    return { questionText: `What digit is in the HUNDREDS place in ${n}?`, answer: hundreds, choices: makeIntChoices(hundreds) };
  }
  if (diff === 'medium') {
    const n = ri(1000, 9999);
    const thousands = Math.floor(n / 1000);
    return { questionText: `What is the THOUSANDS digit in ${n}?`, answer: thousands, choices: makeIntChoices(thousands) };
  }
  const th = ri(1, 9); const h = ri(0, 9); const t = ri(0, 9); const o = ri(0, 9);
  const num = th * 1000 + h * 100 + t * 10 + o;
  return { questionText: `${th} thousands, ${h} hundreds, ${t} tens, ${o} ones = ?`, answer: num, choices: makeIntChoices(num) };
}

// ─── Measurement ─────────────────────────────────────────────────────────────

export function genMeasurement(cls: SchoolClass, diff: Difficulty): Question {
  type TQ = () => Question;
  const allQ: TQ[] = [
    () => { const n = ri(1, 9); return { questionText: `${n} km = ___ m?`, answer: n * 1000, choices: makeIntChoices(n * 1000) }; },
    () => { const n = ri(1, 9); return { questionText: `${n} kg = ___ g?`, answer: n * 1000, choices: makeIntChoices(n * 1000) }; },
    () => { const n = ri(1, 8); return { questionText: `${n} L = ___ mL?`, answer: n * 1000, choices: makeIntChoices(n * 1000) }; },
    () => { const n = ri(1, 9); return { questionText: `${n} m = ___ cm?`, answer: n * 100, choices: makeIntChoices(n * 100) }; },
    () => { const n = ri(1, 9) * 1000; return { questionText: `${n} m = ___ km?`, answer: n / 1000, choices: makeIntChoices(n / 1000) }; },
    () => { const n = ri(2, 9) * 100; return { questionText: `${n} cm = ___ m?`, answer: n / 100, choices: makeIntChoices(n / 100) }; },
    () => { const n = ri(2, 9) * 1000; return { questionText: `${n} g = ___ kg?`, answer: n / 1000, choices: makeIntChoices(n / 1000) }; },
    () => { const n = ri(2, 9) * 1000; return { questionText: `${n} mL = ___ L?`, answer: n / 1000, choices: makeIntChoices(n / 1000) }; },
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
