// ─── Advanced topic generators ────────────────────────────────────────────────
// Covers: word_problems, factors, geometry, percentages, data, ratio, integers, algebra
// Curriculum alignment:
//   Word problems — Class 3: simple 1-step; Class 4: 2-step; Class 5/6: multi-step
//   Factors — Class 4+; Geometry — Class 3+ basic, Class 5/6 full
//   Percentages, Ratio, Integers, Algebra — Class 5/6 as per curriculum

import { SchoolClass, Difficulty, Question } from './types';
import { ri, pick, gcd, lcm, countFactors, shuffleArr, makeIntChoices, makeStrChoices } from './helpers';

// ─── Word Problems ────────────────────────────────────────────────────────────

export function genWordProblems(cls: SchoolClass, diff: Difficulty): Question {
  type TQ = () => Question;

  // Class 3: simple 1-step problems within 100
  if (cls === '3rd') {
    const pool: TQ[] = [
      () => { const a = ri(10, 40); const b = ri(1, a - 5); return { questionText: `Tom has ${a} apples.\nHe gives away ${b}. How many left?`, answer: a - b, choices: makeIntChoices(a - b) }; },
      () => { const a = ri(5, 15); const b = ri(5, 15); return { questionText: `There are ${a} boys and ${b} girls.\nHow many children altogether?`, answer: a + b, choices: makeIntChoices(a + b) }; },
      () => { const a = ri(2, 6); const b = ri(2, 6); return { questionText: `A box has ${a} rows of ${b} eggs.\nHow many eggs in total?`, answer: a * b, choices: makeIntChoices(a * b) }; },
      () => { const n = ri(2, 6); const total = n * ri(4, Math.floor(60 / n)); return { questionText: `${total} sweets shared equally among ${n} children.\nHow many each?`, answer: total / n, choices: makeIntChoices(total / n) }; },
      () => { const a = ri(5, 15); const rate = ri(2, 5); return { questionText: `Jane saves €${a} per week.\nHow much after ${rate} weeks?`, answer: a * rate, choices: makeIntChoices(a * rate) }; },
    ];
    return pick(pool)();
  }

  // Class 4: 2-step or moderate word problems
  if (cls === '4th') {
    const easy: TQ[] = [
      () => { const a = ri(10, 40); const b = ri(1, a - 5); return { questionText: `Tom has ${a} apples.\nHe gives away ${b}. How many left?`, answer: a - b, choices: makeIntChoices(a - b) }; },
      () => { const a = ri(5, 15); const b = ri(5, 15); return { questionText: `There are ${a} boys and ${b} girls.\nHow many children altogether?`, answer: a + b, choices: makeIntChoices(a + b) }; },
      () => { const a = ri(2, 6); const b = ri(2, 6); return { questionText: `A box has ${a} rows of ${b} eggs.\nHow many eggs in total?`, answer: a * b, choices: makeIntChoices(a * b) }; },
    ];
    const medium: TQ[] = [
      () => { const a = ri(3, 8); const each = ri(5, 15); return { questionText: `${a} children each collect ${each} cans.\nHow many cans in total?`, answer: a * each, choices: makeIntChoices(a * each) }; },
      () => { const n = ri(2, 6); const total = n * ri(4, Math.floor(60 / n)); return { questionText: `${total} sweets shared equally among ${n} children.\nHow many each?`, answer: total / n, choices: makeIntChoices(total / n) }; },
      () => { const a = ri(5, 15); const rate = ri(2, 6); return { questionText: `Jane saves €${a} per week.\nHow much after ${rate} weeks?`, answer: a * rate, choices: makeIntChoices(a * rate) }; },
    ];
    const hard: TQ[] = [
      () => { const speed = ri(20, 60); const time = ri(2, 5); return { questionText: `A cyclist travels at ${speed} km/h.\nDistance in ${time} hours?`, answer: speed * time, choices: makeIntChoices(speed * time) }; },
      () => { const a = ri(2, 6); const b = ri(2, 6); const c = ri(b, b + 3); return { questionText: `${a} workers finish a job in ${c} days.\nWith ${a * c / b} workers, it takes ___ days?`, answer: b, choices: makeIntChoices(b) }; },
    ];
    return pick(diff === 'easy' ? easy : diff === 'medium' ? medium : hard)();
  }

  // Class 5/6: multi-step and harder problems
  const easy: TQ[] = [
    () => { const a = ri(10, 40); const b = ri(1, a - 5); return { questionText: `Tom has ${a} apples.\nHe gives away ${b}. How many left?`, answer: a - b, choices: makeIntChoices(a - b) }; },
    () => { const a = ri(2, 6); const b = ri(2, 6); return { questionText: `A box has ${a} rows of ${b} eggs.\nHow many eggs in total?`, answer: a * b, choices: makeIntChoices(a * b) }; },
  ];
  const medium: TQ[] = [
    () => { const a = ri(3, 8); const each = ri(5, 15); return { questionText: `${a} children each collect ${each} cans.\nHow many cans in total?`, answer: a * each, choices: makeIntChoices(a * each) }; },
    () => { const a = ri(5, 15); const rate = ri(2, 6); return { questionText: `Jane saves €${a} per week.\nHow much after ${rate} weeks?`, answer: a * rate, choices: makeIntChoices(a * rate) }; },
  ];
  const hard: TQ[] = [
    () => { const speed = ri(40, 120); const time = ri(2, 5); return { questionText: `A car travels at ${speed} km/h.\nDistance in ${time} hours?`, answer: speed * time, choices: makeIntChoices(speed * time) }; },
    () => { const p = pick([10, 20, 25, 50]); const divisor = 100 / p; const n = divisor * ri(2, Math.floor(200 / divisor)); return { questionText: `${p}% of ${n} children got full marks.\nHow many is that?`, answer: p * n / 100, choices: makeIntChoices(p * n / 100) }; },
    () => { const a = ri(2, 6); const b = ri(2, 6); const c = ri(b, b + 4); return { questionText: `${a} workers finish a job in ${c} days.\nWith ${a * c / b} workers, it takes ___ days?`, answer: b, choices: makeIntChoices(b) }; },
  ];
  return pick(diff === 'easy' ? easy : diff === 'medium' ? medium : hard)();
}

// ─── Factors & Primes ─────────────────────────────────────────────────────────

export function genFactors(cls: SchoolClass, diff: Difficulty): Question {
  type TQ = () => Question;
  const easy: TQ[] = [
    () => { const n = pick([6, 8, 10, 12, 15, 16, 18, 20]); const c = countFactors(n); return { questionText: `How many factors does ${n} have?`, answer: c, choices: makeIntChoices(c) }; },
    () => { const n = pick([2, 3, 5, 7, 11, 13]); return { questionText: `Is ${n} a prime number?\n(prime = only 2 factors)`, answer: 'Yes', choices: makeStrChoices('Yes', ['Yes', 'No']) }; },
    () => { const n = pick([4, 6, 8, 9, 10, 12, 14, 15]); return { questionText: `Is ${n} a prime number?`, answer: 'No', choices: makeStrChoices('No', ['Yes', 'No']) }; },
  ];
  const medium: TQ[] = [
    () => { const a = pick([6, 8, 10, 12, 15, 18, 20, 24]); const b = pick([4, 6, 9, 10, 12, 15, 18]); const g = gcd(a, b); return { questionText: `What is the HCF of ${a} and ${b}?`, answer: g, choices: makeIntChoices(g) }; },
    () => { const a = pick([2, 3, 4, 5, 6]); const bPool = [3, 4, 5, 6, 7, 8].filter(x => x !== a); const b = pick(bPool); const l = lcm(a, b); return { questionText: `What is the LCM of ${a} and ${b}?`, answer: l, choices: makeIntChoices(l) }; },
  ];
  const hard: TQ[] = [
    () => { const a = pick([12, 15, 18, 20, 24, 30, 36]); const bPool = [8, 10, 12, 15, 18, 20, 24].filter(x => x !== a); const b = pick(bPool); const g = gcd(a, b); return { questionText: `HCF of ${a} and ${b} = ?`, answer: g, choices: makeIntChoices(g) }; },
    () => { const vals = [4, 5, 6, 7, 8, 9]; const a = pick(vals); const b = pick(vals.filter(x => x !== a)); const l = lcm(a, b); return { questionText: `LCM of ${a} and ${b} = ?`, answer: l, choices: makeIntChoices(l) }; },
    () => { const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31]; const p = pick(primes); return { questionText: `What is the ${primes.indexOf(p) + 1}th prime number?`, answer: p, choices: makeIntChoices(p) }; },
  ];
  return pick(diff === 'easy' ? easy : diff === 'medium' ? medium : hard)();
}

// ─── Geometry ────────────────────────────────────────────────────────────────

export function genGeometry(cls: SchoolClass, diff: Difficulty): Question {
  type TQ = () => Question;
  const easy: TQ[] = [
    () => { const s = ri(2, 10); return { questionText: `Area of a square with side ${s} = ?`, answer: s * s, choices: makeIntChoices(s * s) }; },
    () => { const s = ri(2, 10); return { questionText: `Perimeter of a square with side ${s} = ?`, answer: 4 * s, choices: makeIntChoices(4 * s) }; },
    () => ({ questionText: 'How many degrees in a right angle?', answer: 90, choices: makeIntChoices(90) }),
    () => ({ questionText: 'How many degrees in a straight line?', answer: 180, choices: makeIntChoices(180) }),
    () => ({ questionText: 'Angles in a triangle add up to ___°?', answer: 180, choices: makeIntChoices(180) }),
  ];
  const medium: TQ[] = [
    () => { const a = ri(3, 12); const b = ri(2, 10); return { questionText: `Area of a rectangle ${a} × ${b} = ?`, answer: a * b, choices: makeIntChoices(a * b) }; },
    () => { const a = ri(3, 12); const b = ri(2, 10); return { questionText: `Perimeter of a rectangle ${a} × ${b} = ?`, answer: 2 * (a + b), choices: makeIntChoices(2 * (a + b)) }; },
    () => { const b = ri(4, 14); const h = ri(3, 10); return { questionText: `Area of a triangle, base ${b}, height ${h}:\n(½ × base × height) = ?`, answer: (b * h) / 2, choices: makeIntChoices((b * h) / 2) }; },
    () => ({ questionText: 'Angles in a quadrilateral add up to ___°?', answer: 360, choices: makeIntChoices(360) }),
  ];
  const hard: TQ[] = [
    () => { const b = ri(4, 16) * 2; const h = ri(4, 12) * 2; return { questionText: `Area of triangle, base ${b} cm, height ${h} cm = ?`, answer: (b * h) / 2, choices: makeIntChoices((b * h) / 2) }; },
    () => { const side = ri(3, 12); return { questionText: `Volume of a cube with side ${side} cm = ?`, answer: side * side * side, choices: makeIntChoices(side * side * side) }; },
    () => ({ questionText: 'Angles on a full turn (circle) = ___°?', answer: 360, choices: makeIntChoices(360) }),
    () => { const a = ri(20, 80); const b = ri(10, a - 5); return { questionText: `Two angles of a triangle are ${a}° and ${b}°.\nThe third angle = ?`, answer: 180 - a - b, choices: makeIntChoices(180 - a - b) }; },
  ];
  return pick(diff === 'easy' ? easy : diff === 'medium' ? medium : hard)();
}

// ─── Percentages ─────────────────────────────────────────────────────────────

export function genPercentages(cls: SchoolClass, diff: Difficulty): Question {
  type TQ = () => Question;
  const easy: TQ[] = [
    () => { const n = pick([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]); const p = pick([10, 20, 50]); return { questionText: `${p}% of ${n} = ?`, answer: p * n / 100, choices: makeIntChoices(p * n / 100) }; },
    () => { const n = pick([20, 40, 60, 80, 100, 200]); return { questionText: `50% of ${n} = ?`, answer: n / 2, choices: makeIntChoices(n / 2) }; },
    () => { const n = pick([10, 20, 30, 50, 100, 200]); return { questionText: `10% of ${n} = ?`, answer: n / 10, choices: makeIntChoices(n / 10) }; },
  ];
  const medium: TQ[] = [
    () => { const n = pick([20, 40, 50, 60, 80, 100]); const p = pick([25, 75]); return { questionText: `${p}% of ${n} = ?`, answer: p * n / 100, choices: makeIntChoices(p * n / 100) }; },
    () => { const n = pick([10, 20, 50, 100]); const k = pick([2, 5, 4, 1]); return { questionText: `What % of ${n} is ${k}?`, answer: k / n * 100, choices: makeIntChoices(k / n * 100) }; },
    () => { const n = pick([40, 60, 80, 100, 120, 200]); const p = pick([5, 15, 25]); return { questionText: `${p}% of ${n} = ?`, answer: p * n / 100, choices: makeIntChoices(p * n / 100) }; },
  ];
  const hard: TQ[] = [
    () => { const n = pick([50, 100, 200, 400]); const p = pick([15, 35, 45, 65]); return { questionText: `${p}% of ${n} = ?`, answer: p * n / 100, choices: makeIntChoices(p * n / 100) }; },
    () => { const n = pick([50, 80, 100, 120, 200]); const p = pick([10, 20, 25]); return { questionText: `Increase ${n} by ${p}% = ?`, answer: n + p * n / 100, choices: makeIntChoices(n + p * n / 100) }; },
    () => { const n = pick([60, 80, 100, 120, 200]); const p = pick([10, 20, 25]); return { questionText: `Decrease ${n} by ${p}% = ?`, answer: n - p * n / 100, choices: makeIntChoices(n - p * n / 100) }; },
  ];
  return pick(diff === 'easy' ? easy : diff === 'medium' ? medium : hard)();
}

// ─── Data & Averages ──────────────────────────────────────────────────────────

export function genData(cls: SchoolClass, diff: Difficulty): Question {
  type TQ = () => Question;
  const easy: TQ[] = [
    () => { const arr = [ri(2, 9), ri(2, 9), ri(2, 9), ri(2, 9)]; const mean = arr.reduce((s, x) => s + x, 0) / arr.length; if (mean % 1 !== 0) arr[0] += 1; const m = arr.reduce((s, x) => s + x, 0) / arr.length; return { questionText: `Find the mean of:\n${arr.join(', ')}`, answer: m, choices: makeIntChoices(m) }; },
    () => { const arr = [ri(1, 8), ri(2, 9), ri(1, 7), ri(3, 9)]; const range = Math.max(...arr) - Math.min(...arr); return { questionText: `Find the range of:\n${arr.join(', ')}`, answer: range, choices: makeIntChoices(range) }; },
  ];
  const medium: TQ[] = [
    () => { const sorted = [ri(1, 4), ri(5, 7), ri(8, 12), ri(13, 18), ri(19, 25)]; const arr = shuffleArr(sorted); return { questionText: `Find the median of:\n${arr.join(', ')}`, answer: sorted[2], choices: makeIntChoices(sorted[2]) }; },
    () => { const repeated = ri(3, 8); const arr = shuffleArr([repeated, repeated, repeated, ri(1, 9), ri(1, 9)]); return { questionText: `What is the mode of:\n${arr.join(', ')}`, answer: repeated, choices: makeIntChoices(repeated) }; },
    () => { const arr = [ri(5, 15), ri(5, 15), ri(5, 15), ri(5, 15)]; const mean = arr.reduce((s, x) => s + x, 0) / 4; if (mean % 1 !== 0) arr[0]++; const m = arr.reduce((s, x) => s + x, 0) / 4; return { questionText: `Mean of ${arr.join(', ')} = ?`, answer: m, choices: makeIntChoices(m) }; },
  ];
  const hard: TQ[] = [
    () => { const arr = [ri(10, 30), ri(10, 30), ri(10, 30), ri(10, 30), ri(10, 30)]; const sorted = [...arr].sort((a, b) => a - b); return { questionText: `Median of:\n${arr.join(', ')}`, answer: sorted[2], choices: makeIntChoices(sorted[2]) }; },
    () => { const avg = ri(5, 15); const total = avg * 4; const a = ri(1, avg - 2); const b = ri(1, avg - 2); const c = ri(1, avg - 2); const d = total - a - b - c; return { questionText: `Mean of ${a}, ${b}, ${c}, ${d} = ?`, answer: avg, choices: makeIntChoices(avg) }; },
  ];
  return pick(diff === 'easy' ? easy : diff === 'medium' ? medium : hard)();
}

// ─── Ratio ───────────────────────────────────────────────────────────────────

export function genRatio(cls: SchoolClass, diff: Difficulty): Question {
  type TQ = () => Question;
  const easy: TQ[] = [
    () => { const g = ri(2, 5); const mA = ri(1, 4); const mB = mA < 4 ? ri(mA + 1, 4) : ri(1, mA - 1); const a = g * mA; const b = g * mB; return { questionText: `Simplify ${a}:${b}.\nThe simplified ratio is ${a / g}:?`, answer: b / g, choices: makeIntChoices(b / g) }; },
    () => { const a = ri(2, 5); const b = ri(2, 5); const total = (a + b) * ri(2, 5); return { questionText: `Ratio ${a}:${b}, total = ${total}.\nSmaller part = ?`, answer: Math.min(a, b) / (a + b) * total, choices: makeIntChoices(Math.min(a, b) / (a + b) * total) }; },
  ];
  const medium: TQ[] = [
    () => { const cost = ri(2, 8); const n = ri(2, 6); let ask = ri(2, 8); if (ask === n) ask = ask < 8 ? ask + 1 : ask - 1; return { questionText: `${n} pens cost €${n * cost}.\nHow much do ${ask} pens cost?`, answer: ask * cost, choices: makeIntChoices(ask * cost) }; },
    () => { const a = ri(2, 5); let b = ri(2, 5); if (a === b) b = b < 5 ? b + 1 : b - 1; const total = (a + b) * ri(3, 6); return { questionText: `Divide ${total} in ratio ${a}:${b}.\nLarger share = ?`, answer: Math.max(a, b) / (a + b) * total, choices: makeIntChoices(Math.max(a, b) / (a + b) * total) }; },
  ];
  const hard: TQ[] = [
    () => { const a = ri(3, 7); let b = ri(2, 6); if (a === b) b = b < 6 ? b + 1 : b - 1; const total = (a + b) * ri(4, 8); const larger = Math.max(a, b) / (a + b) * total; return { questionText: `Share €${total} in ratio ${a}:${b}.\nLarger share = €?`, answer: larger, choices: makeIntChoices(larger) }; },
    () => { const scale = pick([100, 50, 200]); const map = ri(2, 10); return { questionText: `Scale 1:${scale}. Map length = ${map} cm.\nReal length = ___ cm?`, answer: map * scale, choices: makeIntChoices(map * scale) }; },
  ];
  return pick(diff === 'easy' ? easy : diff === 'medium' ? medium : hard)();
}

// ─── Integers ────────────────────────────────────────────────────────────────

export function genIntegers(cls: SchoolClass, diff: Difficulty): Question {
  type TQ = () => Question;
  const easy: TQ[] = [
    () => { const a = -ri(1, 5); const b = ri(-a + 1, 10); return { questionText: `${a} + ${b} = ?`, answer: a + b, choices: makeIntChoices(a + b) }; },
    () => { const n = ri(1, 10); return { questionText: `|−${n}| = ?  (absolute value)`, answer: n, choices: makeIntChoices(n) }; },
    () => { const a = ri(1, 9); const b = ri(a + 1, 15); return { questionText: `Which is colder: −${a}°C or −${b}°C?`, answer: -b, choices: shuffleArr([-a, -b, a, b]) }; },
  ];
  const medium: TQ[] = [
    () => { const a = -ri(3, 10); const b = -ri(3, 10); return { questionText: `${a} + ${b} = ?`, answer: a + b, choices: makeIntChoices(a + b) }; },
    () => { const a = ri(2, 10); const b = ri(a + 1, 15); return { questionText: `${a} − ${b} = ?`, answer: a - b, choices: makeIntChoices(a - b) }; },
    () => { const a = -ri(2, 8); const b = ri(2, 8); return { questionText: `${a} − ${b} = ?`, answer: a - b, choices: makeIntChoices(a - b) }; },
  ];
  const hard: TQ[] = [
    () => { const a = -ri(2, 8); const b = ri(2, 8); return { questionText: `${a} × ${b} = ?`, answer: a * b, choices: makeIntChoices(a * b) }; },
    () => { const a = -ri(2, 6); const b = -ri(2, 6); return { questionText: `${a} × ${b} = ?`, answer: a * b, choices: makeIntChoices(a * b) }; },
    () => { const a = ri(2, 8); const b = -ri(2, 5); return { questionText: `${a * b} ÷ ${b} = ?`, answer: a, choices: makeIntChoices(a) }; },
  ];
  return pick(diff === 'easy' ? easy : diff === 'medium' ? medium : hard)();
}

// ─── Algebra ─────────────────────────────────────────────────────────────────

export function genAlgebra(cls: SchoolClass, diff: Difficulty): Question {
  type TQ = () => Question;
  const easy: TQ[] = [
    () => { const x = ri(2, 12); const a = ri(1, 10); return { questionText: `x + ${a} = ${x + a}\nFind x:`, answer: x, choices: makeIntChoices(x) }; },
    () => { const x = ri(2, 12); const a = ri(1, 8); return { questionText: `x − ${a} = ${x - a}\nFind x:`, answer: x, choices: makeIntChoices(x) }; },
    () => { const x = ri(2, 10); const a = ri(2, 6); return { questionText: `${a}x = ${a * x}\nFind x:`, answer: x, choices: makeIntChoices(x) }; },
  ];
  const medium: TQ[] = [
    () => { const x = ri(2, 10); const a = ri(2, 5); const b = ri(1, 10); return { questionText: `${a}x + ${b} = ${a * x + b}\nFind x:`, answer: x, choices: makeIntChoices(x) }; },
    () => { const x = ri(2, 10); const a = ri(2, 5); const b = ri(1, 8); return { questionText: `${a}x − ${b} = ${a * x - b}\nFind x:`, answer: x, choices: makeIntChoices(x) }; },
    () => { const x = ri(2, 10); const a = ri(2, 6); return { questionText: `x ÷ ${a} = ${Math.floor(x / a)}\n(Hint: x = ? × ${a})`, answer: Math.floor(x / a) * a, choices: makeIntChoices(Math.floor(x / a) * a) }; },
  ];
  const hard: TQ[] = [
    () => { const x = ri(2, 8); const a = ri(2, 4); const b = ri(2, 6); const c = ri(1, 5); return { questionText: `${a}x + ${b} = ${c}x + ${a * x + b - c * x}\nFind x:`, answer: x, choices: makeIntChoices(x) }; },
    () => { const x = ri(1, 8); return { questionText: `x² = ${x * x}   (x is positive)\nFind x:`, answer: x, choices: makeIntChoices(x) }; },
    () => { const x = ri(2, 8); const a = ri(2, 4); const b = ri(1, 5); return { questionText: `${a}(x + ${b}) = ${a * (x + b)}\nFind x:`, answer: x, choices: makeIntChoices(x) }; },
  ];
  return pick(diff === 'easy' ? easy : diff === 'medium' ? medium : hard)();
}
