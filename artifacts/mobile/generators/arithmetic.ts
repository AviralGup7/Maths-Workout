// ─── Arithmetic question generators ──────────────────────────────────────────
// Covers: addition, subtraction, multiplication, division
// Curriculum alignment:
//   Class 1: single-digit; Class 2: carry/borrow 2-digit; Class 3: 3-digit
//   Class 2 multiplication: tables 2, 5, 10 only (Easy), add 3, 4 (Medium), all 2–10 (Hard)
//   Class 3 division: basic ÷2–5 (Easy), ÷2–10 (Medium), larger (Hard)

import { SchoolClass, Difficulty, Question } from './types';
import { ri, pick, addNoCarry, addWithCarry, subNoBorrow, subWithBorrow, makeIntChoices, makeDiagnosticChoices } from './helpers';
import { resolveSkill } from '../learning/skills';
import { diagnosticDistractors } from '../learning/misconceptions';

/**
 * Build a question whose wrong options are the outputs of real misconceptions,
 * so an incorrect answer identifies the faulty rule the learner applied.
 */
function diagnosticQuestion(
  cls: SchoolClass, diff: Difficulty,
  cat: 'addition' | 'subtraction' | 'multiplication' | 'division',
  text: string, a: number, b: number, answer: number,
): Question {
  const skill = resolveSkill(cls, cat, diff);
  const { choices, distractorMap } = makeDiagnosticChoices(
    answer, diagnosticDistractors(skill, a, b, answer),
  );
  return { questionText: text, answer, choices, distractorMap };
}

export function genAddition(cls: SchoolClass, diff: Difficulty): Question {
  let a: number, b: number;
  switch (cls) {
    case '1st':
      // Class 1: single-digit facts, bridging 10 only on hard
      [a, b] = diff === 'easy'
        ? [ri(1, 4), ri(1, 4)]
        : diff === 'medium'
        ? [ri(1, 9), ri(1, 9)]
        : addWithCarry(6, 9, 3, 9);
      break;
    case '2nd':
      // Class 2: explicitly practise no-carry (easy) and carry (medium/hard)
      [a, b] = diff === 'easy'
        ? addNoCarry(10, 49, 1, 9)
        : diff === 'medium'
        ? addWithCarry(10, 49, 1, 9)
        : addWithCarry(12, 79, 11, 29);
      break;
    case '3rd':
      [a, b] = diff === 'easy'
        ? addNoCarry(10, 79, 10, 29)
        : diff === 'medium'
        ? addWithCarry(20, 79, 15, 39)
        : [ri(100, 499), ri(50, 299)];
      break;
    case '4th':
      [a, b] = diff === 'easy'
        ? [ri(100, 499), ri(100, 299)]
        : diff === 'medium'
        ? [ri(200, 699), ri(100, 399)]
        : [ri(500, 999), ri(200, 499)];
      break;
    case '5th':
      [a, b] = diff === 'easy'
        ? [ri(200, 699), ri(100, 499)]
        : diff === 'medium'
        ? [ri(500, 999), ri(200, 599)]
        : [ri(1000, 4999), ri(500, 2999)];
      break;
    default: // 6th
      [a, b] = diff === 'easy'
        ? [ri(500, 2999), ri(200, 1999)]
        : diff === 'medium'
        ? [ri(1000, 4999), ri(500, 2999)]
        : [ri(2000, 9999), ri(1000, 4999)];
  }
  return diagnosticQuestion(cls, diff, 'addition', `${a} + ${b} = ?`, a, b, a + b);
}

export function genSubtraction(cls: SchoolClass, diff: Difficulty): Question {
  let a: number, b: number;
  switch (cls) {
    case '1st':
      // Class 1: subtract within 10 (easy), within 20 (medium/hard)
      a = diff === 'easy' ? ri(2, 10) : ri(5, 20);
      b = ri(1, a - 1);
      break;
    case '2nd':
      // Class 2: explicitly practise no-borrow (easy) and borrow (medium/hard)
      [a, b] = diff === 'easy'
        ? subNoBorrow(20, 59, 1, 9)
        : diff === 'medium'
        ? subWithBorrow(20, 59, 1, 9)
        : subWithBorrow(20, 79, 11, 29);
      break;
    case '3rd':
      [a, b] = diff === 'easy'
        ? subNoBorrow(20, 79, 10, 39)
        : diff === 'medium'
        ? subWithBorrow(30, 99, 12, 49)
        : [ri(100, 499), ri(10, 200)];
      break;
    case '4th':
      a = ri(100, 499); b = ri(10, Math.floor(a * 0.7)); break;
    case '5th':
      a = ri(500, 1999); b = ri(100, Math.floor(a * 0.6)); break;
    default:
      a = ri(1000, 4999); b = ri(200, Math.floor(a * 0.7)); break;
  }
  if (a < b) { const t = a; a = b; b = t; }
  return diagnosticQuestion(cls, diff, 'subtraction', `${a} − ${b} = ?`, a, b, a - b);
}

export function genMultiplication(cls: SchoolClass, diff: Difficulty): Question {
  let a: number, b: number;
  switch (cls) {
    case '1st':
      // Class 1 doesn't formally do multiplication — fall back to easy doubling
      a = pick([2, 3, 4, 5]); b = diff === 'easy' ? 2 : ri(2, 5);
      break;
    case '2nd':
      // Class 2: tables 2, 5, 10 only (Easy); add 3, 4 (Medium); all 2–10 (Hard)
      a = diff === 'easy'
        ? pick([2, 5, 10])
        : diff === 'medium'
        ? pick([2, 3, 4, 5, 10])
        : pick([2, 3, 4, 5, 6, 7, 8, 9, 10]);
      b = ri(1, 10);
      break;
    case '3rd':
      // Class 3: tables 1–10 plus 2-digit × 1-digit
      [a, b] = diff === 'easy'
        ? [ri(2, 5), ri(1, 10)]
        : diff === 'medium'
        ? [ri(2, 10), ri(1, 10)]
        : [ri(6, 12), ri(6, 12)];
      break;
    case '4th':
      [a, b] = diff === 'easy'
        ? [ri(2, 10), ri(1, 12)]
        : diff === 'medium'
        ? [ri(11, 25), ri(2, 9)]
        : [ri(11, 25), ri(11, 25)];
      break;
    case '5th':
      [a, b] = diff === 'easy'
        ? [ri(2, 12), ri(2, 12)]
        : diff === 'medium'
        ? [ri(12, 30), ri(2, 9)]
        : [ri(11, 25), ri(11, 25)];
      break;
    default: // 6th
      [a, b] = diff === 'easy'
        ? [ri(12, 50), ri(2, 12)]
        : diff === 'medium'
        ? [ri(20, 99), ri(2, 12)]
        : [ri(20, 50), ri(20, 50)];
  }
  return diagnosticQuestion(cls, diff, 'multiplication', `${a} × ${b} = ?`, a, b, a * b);
}

export function genDivision(cls: SchoolClass, diff: Difficulty): Question {
  // mkDiv: ensures clean integer division; returns [dividend, divisor, quotient]
  const mkDiv = (minD: number, maxD: number, minQ: number, maxQ: number): [number, number, number] => {
    const d = ri(minD, maxD);
    const q = ri(minQ, maxQ);
    return [d * q, d, q];
  };
  let dividend: number, divisor: number, quotient: number;
  switch (cls) {
    case '1st':
    case '2nd':
      // Division is not in the Class 1/2 curriculum, but the generator must be
      // safe if it is ever enabled — previously these fell through to the
      // Class 6 branch and produced questions like "345 ÷ 15" for a six-year-old.
      [dividend, divisor, quotient] = mkDiv(2, 5, 1, 5);
      break;
    case '3rd':
      // Class 3: basic division ÷2–5 (easy), ÷2–10 (medium), larger (hard)
      [dividend, divisor, quotient] = diff === 'easy'
        ? mkDiv(2, 5, 1, 5)
        : diff === 'medium'
        ? mkDiv(2, 8, 1, 8)
        : mkDiv(2, 10, 2, 10);
      break;
    case '4th':
      [dividend, divisor, quotient] = diff === 'easy'
        ? mkDiv(2, 10, 1, 10)
        : diff === 'medium'
        ? mkDiv(2, 12, 2, 12)
        : mkDiv(2, 12, 5, 20);
      break;
    case '5th':
      [dividend, divisor, quotient] = diff === 'easy'
        ? mkDiv(2, 10, 5, 15)
        : diff === 'medium'
        ? mkDiv(3, 12, 5, 20)
        : mkDiv(5, 15, 10, 30);
      break;
    default: // 6th
      [dividend, divisor, quotient] = diff === 'easy'
        ? mkDiv(5, 15, 10, 30)
        : diff === 'medium'
        ? mkDiv(5, 25, 10, 50)
        : mkDiv(10, 30, 20, 60);
  }
  return diagnosticQuestion(cls, diff, 'division', `${dividend} ÷ ${divisor} = ?`, dividend, divisor, quotient);
}

export function generateTablesQuestions(tableNum: number): Question[] {
  const indices = Array.from({ length: 12 }, (_, i) => i + 1);
  // Shuffle so questions don't appear in order
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.map(n => {
    const answer = tableNum * n;
    return { questionText: `${tableNum} × ${n} = ?`, answer, choices: makeIntChoices(answer) };
  });
}
