// ─── Fractions & Decimals generators ─────────────────────────────────────────
// Curriculum alignment:
//   Class 3 fractions: ½, ¼, ⅓ of amounts and simple same-denominator sums only
//   Class 4: equivalent fractions, adding with same denominator
//   Class 5+: full range (mixed numbers, different denominators, multiply)
//   Decimals start at Class 4 (tenths easy, hundredths medium/hard)

import { SchoolClass, Difficulty, Question } from './types';
import { ri, pick, makeIntChoices, makeDecChoices } from './helpers';
import type { Lang } from '../i18n/strings';
import { qp } from '../i18n/questions';

export function genFractions(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  type TQ = () => Question;

  // Class 3: ½, ¼, ⅓ of amounts — simple, picture-able fractions
  if (cls === '3rd') {
    const class3: TQ[] = [
      () => { const whole = pick([2, 4, 6, 8, 10, 12]); return { questionText: qp('glyphOf', lang, '½', whole), answer: whole / 2, choices: makeIntChoices(whole / 2) }; },
      () => { const whole = pick([4, 8, 12, 16, 20]); return { questionText: qp('glyphOf', lang, '¼', whole), answer: whole / 4, choices: makeIntChoices(whole / 4) }; },
      () => { const whole = pick([3, 6, 9, 12, 15]); return { questionText: qp('glyphOf', lang, '⅓', whole), answer: whole / 3, choices: makeIntChoices(whole / 3) }; },
      () => { const whole = pick([4, 8, 12, 16, 20]); return { questionText: qp('glyphOf', lang, '¾', whole), answer: (whole / 4) * 3, choices: makeIntChoices((whole / 4) * 3) }; },
      () => { const d = pick([2, 4]); const a = ri(1, d - 1); const b = ri(1, d - a); return { questionText: `${a}/${d} + ${b}/${d} = ?/${d}`, answer: a + b, choices: makeIntChoices(a + b) }; },
    ];
    // Class 3 always gets from the simpler pool regardless of difficulty
    const pool = diff === 'hard' ? class3 : class3.slice(0, 3);
    return pick(pool)();
  }

  // Class 4: equivalent fractions, same-denominator sums
  if (cls === '4th') {
    const easy: TQ[] = [
      () => { const d = pick([2, 4, 8]); const n = ri(1, d - 1); const whole = d * ri(2, 10); return { questionText: qp('fracOfWhole', lang, n, d, whole), answer: n * whole / d, choices: makeIntChoices(n * whole / d) }; },
      () => { const d = pick([2, 3, 4]); return { questionText: qp('completeSum', lang, d), answer: 2, choices: makeIntChoices(2) }; },
      () => { const n = ri(2, 4); const d = n * 2; return { questionText: qp('simplifyTo', lang, n, d), answer: d / n, choices: makeIntChoices(d / n) }; },
    ];
    const medium: TQ[] = [
      () => { const d = pick([3, 4, 5, 6]); const n = ri(2, d - 1); const whole = d * ri(2, 8); return { questionText: qp('fracOfWhole', lang, n, d, whole), answer: n * whole / d, choices: makeIntChoices(n * whole / d) }; },
      () => { const d = pick([4, 6, 8, 10]); const a = ri(1, Math.floor(d / 2)); const b = ri(1, Math.floor(d / 2) - a + 1); return { questionText: `${a}/${d} + ${b}/${d} = ?/${d}`, answer: a + b, choices: makeIntChoices(a + b) }; },
    ];
    const hard: TQ[] = [
      () => { const d = pick([6, 8, 10, 12]); const a = ri(3, d - 2); const b = ri(1, 3); return { questionText: `${a}/${d} − ${b}/${d} = ?/${d}`, answer: a - b, choices: makeIntChoices(a - b) }; },
      () => { const d1 = pick([2, 3, 4]); const d2 = d1 * 2; return { questionText: `1/${d1} + 1/${d2} = ?/${d2}`, answer: 3, choices: makeIntChoices(3) }; },
    ];
    return pick(diff === 'easy' ? easy : diff === 'medium' ? medium : hard)();
  }

  // Class 5+: full range including mixed numbers
  const easy: TQ[] = [
    () => { const d = pick([2, 4, 8]); const n = ri(1, d - 1); const whole = d * ri(2, 10); return { questionText: qp('fracOfWhole', lang, n, d, whole), answer: n * whole / d, choices: makeIntChoices(n * whole / d) }; },
    () => { const d = pick([2, 3, 4]); return { questionText: qp('completeSum', lang, d), answer: 2, choices: makeIntChoices(2) }; },
    () => { const n = ri(2, 4); const d = n * 2; return { questionText: qp('simplifyTo', lang, n, d), answer: d / n, choices: makeIntChoices(d / n) }; },
  ];
  const medium: TQ[] = [
    () => { const d = pick([3, 4, 5, 6]); const n = ri(2, d - 1); const whole = d * ri(2, 8); return { questionText: qp('fracOfWhole', lang, n, d, whole), answer: n * whole / d, choices: makeIntChoices(n * whole / d) }; },
    () => { const d = pick([4, 6, 8, 10]); const a = ri(1, Math.floor(d / 2)); const b = ri(1, Math.floor(d / 2) - a + 1); return { questionText: `${a}/${d} + ${b}/${d} = ?/${d}`, answer: a + b, choices: makeIntChoices(a + b) }; },
    () => { const g = ri(2, 4); const a = g * ri(2, 4); const b = g * ri(2, 4); return { questionText: qp('hcfSimplify', lang, a, b), answer: g, choices: makeIntChoices(g) }; },
  ];
  const hard: TQ[] = [
    () => { const d = pick([6, 8, 10, 12]); const a = ri(3, d - 2); const b = ri(1, 3); return { questionText: `${a}/${d} − ${b}/${d} = ?/${d}`, answer: a - b, choices: makeIntChoices(a - b) }; },
    () => { const d1 = pick([2, 3, 4]); const d2 = d1 * 2; return { questionText: `1/${d1} + 1/${d2} = ?/${d2}`, answer: 3, choices: makeIntChoices(3) }; },
    () => { const n = ri(2, 5); const d = ri(2, 4); const whole = d * ri(3, 8); return { questionText: qp('wholeAndFrac', lang, n, d, whole), answer: n * whole + whole / d, choices: makeIntChoices(n * whole + whole / d) }; },
  ];
  return pick(diff === 'easy' ? easy : diff === 'medium' ? medium : hard)();
}

export function genDecimals(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  const round = (n: number) => Math.round(n * 100) / 100;
  type TQ = () => Question;
  const easy: TQ[] = [
    () => { const a = ri(1, 9); const b = ri(1, 9 - a); return { questionText: `0.${a} + 0.${b} = ?`, answer: round((a + b) / 10), choices: makeDecChoices(round((a + b) / 10), 0.1) }; },
    () => { const a = ri(2, 9); const b = ri(1, a - 1); return { questionText: `0.${a} − 0.${b} = ?`, answer: round((a - b) / 10), choices: makeDecChoices(round((a - b) / 10), 0.1) }; },
    () => { const n = ri(11, 39); return { questionText: qp('roundToWhole', lang, n / 10), answer: Math.round(n / 10), choices: makeIntChoices(Math.round(n / 10)) }; },
  ];
  const medium: TQ[] = [
    () => { const a = ri(11, 29); const b = ri(1, 9); return { questionText: `${a / 10} + ${b / 10} = ?`, answer: round((a + b) / 10), choices: makeDecChoices(round((a + b) / 10), 0.1) }; },
    () => { const a = ri(11, 29); const b = ri(1, a - 1); return { questionText: `${a / 10} − ${b / 10} = ?`, answer: round((a - b) / 10), choices: makeDecChoices(round((a - b) / 10), 0.1) }; },
    () => { const n = ri(2, 9); const m = ri(1, 4); return { questionText: `0.${n} × ${m} = ?`, answer: round(n * m / 10), choices: makeDecChoices(round(n * m / 10), 0.1) }; },
  ];
  const hard: TQ[] = [
    () => { const a = ri(101, 499); const b = ri(1, 9); return { questionText: `${a / 100} + ${b / 100} = ?`, answer: round((a + b) / 100), choices: makeDecChoices(round((a + b) / 100), 0.01) }; },
    () => { const n = ri(105, 299); return { questionText: qp('roundTo1dp', lang, n / 100), answer: round(Math.round(n / 10) / 10), choices: makeDecChoices(round(Math.round(n / 10) / 10), 0.1) }; },
    () => { const n = ri(11, 25); const m = ri(2, 5); return { questionText: `${n / 10} × ${m} = ?`, answer: round(n * m / 10), choices: makeDecChoices(round(n * m / 10), 0.1) }; },
  ];
  return pick(diff === 'easy' ? easy : diff === 'medium' ? medium : hard)();
}
