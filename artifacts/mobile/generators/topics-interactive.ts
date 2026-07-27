// ─── Interactive-topic generators ────────────────────────────────────────────
// Question types that were not expressible as "tap one of four".
//
// Each generator here targets a topic where multiple choice was actively
// distorting the mathematics — ordering, set selection, and recall.

import type { SchoolClass, Difficulty, Question } from './types';
import { ri, pick, shuffleArr, isPrime } from './helpers';
import { multiSelectQuestion, orderingQuestion, entryQuestion } from './interactions';

// ─── Multi-select: factors, primes, multiples ────────────────────────────────

/** All factors of n, ascending. */
function factorsOf(n: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= n; i++) if (n % i === 0) out.push(i);
  return out;
}

/**
 * "Tap all the factors of 12."
 *
 * As multiple choice this had to become "how many factors does 12 have?",
 * which tests counting rather than the concept. Selecting the actual set is
 * the mathematics.
 */
export function genFactorSelect(cls: SchoolClass, diff: Difficulty): Question {
  const pool = diff === 'easy' ? [6, 8, 10, 12] : diff === 'medium' ? [12, 16, 18, 20, 24] : [24, 30, 36, 40, 48];
  const n = pick(pool);
  const correct = factorsOf(n).filter(f => f !== 1 && f !== n); // proper factors keep it interesting
  const notFactors = shuffleArr(
    Array.from({ length: 30 }, (_, i) => i + 2).filter(v => n % v !== 0 && v < n),
  ).slice(0, Math.max(2, 6 - correct.length));

  // Guard: if a number has too few proper factors, fall back to the full set.
  const finalCorrect = correct.length >= 2 ? correct : factorsOf(n).filter(f => f !== n);

  return multiSelectQuestion(
    `Tap ALL the factors of ${n}`,
    finalCorrect,
    notFactors,
    { resolvedCategory: 'factors' },
  );
}

/** "Tap all the prime numbers." */
export function genPrimeSelect(cls: SchoolClass, diff: Difficulty): Question {
  const ceiling = diff === 'easy' ? 20 : diff === 'medium' ? 30 : 50;
  const primes = Array.from({ length: ceiling }, (_, i) => i + 2).filter(isPrime);
  const composites = Array.from({ length: ceiling }, (_, i) => i + 2).filter(n => !isPrime(n));
  const correct = shuffleArr(primes).slice(0, 3);
  const distractors = shuffleArr(composites).slice(0, 4);
  return multiSelectQuestion(
    `Tap ALL the prime numbers`,
    correct,
    distractors,
    { resolvedCategory: 'factors' },
  );
}

/** "Tap all the multiples of 4." */
export function genMultipleSelect(cls: SchoolClass, diff: Difficulty): Question {
  const base = diff === 'easy' ? pick([2, 5, 10]) : diff === 'medium' ? pick([3, 4, 6]) : pick([7, 8, 9, 12]);
  const ceiling = base * 12;
  const multiples = Array.from({ length: 12 }, (_, i) => base * (i + 1));
  const nonMultiples = Array.from({ length: ceiling }, (_, i) => i + 1).filter(v => v % base !== 0);
  return multiSelectQuestion(
    `Tap ALL the multiples of ${base}`,
    shuffleArr(multiples).slice(0, 3),
    shuffleArr(nonMultiples).slice(0, 4),
    { resolvedCategory: 'multiplication' },
  );
}

// ─── Ordering: comparison, place value, decimals, fractions ──────────────────

/**
 * "Put these in order, smallest first."
 *
 * As multiple choice this collapsed to "which is smallest?" — one comparison
 * instead of a full ordering. The inversion count also tells us *how* wrong a
 * wrong ordering is.
 */
export function genOrderNumbers(cls: SchoolClass, diff: Difficulty): Question {
  const isEarly = cls === '1st' || cls === '2nd';
  const max = isEarly ? 20 : cls === '3rd' ? 100 : diff === 'hard' ? 9999 : 999;
  const count = isEarly ? 3 : 4;

  const set = new Set<number>();
  let guard = 0;
  while (set.size < count && guard < 200) {
    guard++;
    set.add(ri(isEarly ? 1 : 10, max));
  }
  const values = [...set];
  const descending = diff === 'hard' && Math.random() < 0.5;
  const correctOrder = [...values].sort((a, b) => (descending ? b - a : a - b));

  return orderingQuestion(
    descending ? 'Put these in order — LARGEST first' : 'Put these in order — SMALLEST first',
    correctOrder,
    { direction: descending ? 'desc' : 'asc', resolvedCategory: 'number_sense' },
  );
}

/**
 * Ordering decimals.
 *
 * Deliberately includes values with differing digit counts (0.5 vs 0.45) so
 * the "more digits means bigger" misconception is exposed rather than hidden.
 */
export function genOrderDecimals(cls: SchoolClass, diff: Difficulty): Question {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const set = new Set<number>();
  let guard = 0;
  while (set.size < 4 && guard < 200) {
    guard++;
    // Mix tenths and hundredths so digit-count is not a reliable cue.
    set.add(Math.random() < 0.5 ? round2(ri(1, 9) / 10) : round2(ri(11, 99) / 100));
  }
  const correctOrder = [...set].sort((a, b) => a - b);
  return orderingQuestion(
    'Put these decimals in order — SMALLEST first',
    correctOrder,
    { resolvedCategory: 'decimals' },
  );
}

/** Ordering unit fractions — targets "bigger denominator means bigger". */
export function genOrderFractions(cls: SchoolClass, diff: Difficulty): Question {
  const denominators = shuffleArr([2, 3, 4, 5, 6, 8, 10]).slice(0, 4);
  const correctOrder = denominators
    .sort((a, b) => b - a)          // larger denominator = smaller fraction
    .map(d => `1/${d}`);
  return orderingQuestion(
    'Put these fractions in order — SMALLEST first',
    correctOrder,
    { resolvedCategory: 'fractions' },
  );
}

// ─── Typed entry: recall without cues ────────────────────────────────────────

/**
 * Missing-number equations.
 *
 * "7 + ? = 12" is a genuinely different cognitive task from "7 + 5 = ?" — it
 * requires inverse reasoning, and it is the bridge to algebra. Typed entry
 * suits it because the answer space is small but the cue must be absent.
 */
export function genMissingNumber(cls: SchoolClass, diff: Difficulty): Question {
  const early = cls === '1st' || cls === '2nd';
  const max = early ? (diff === 'easy' ? 10 : 20) : diff === 'easy' ? 50 : diff === 'medium' ? 100 : 500;

  const total = ri(Math.max(3, Math.floor(max / 3)), max);
  const part = ri(1, total - 1);
  const missingFirst = Math.random() < 0.4;

  if (Math.random() < 0.6) {
    const text = missingFirst
      ? `? + ${part} = ${total}`
      : `${part} + ? = ${total}`;
    return entryQuestion(text, total - part, { resolvedCategory: 'addition' });
  }
  const text = missingFirst
    ? `? − ${part} = ${total - part}`
    : `${total} − ? = ${total - part}`;
  return entryQuestion(text, missingFirst ? total : part, { resolvedCategory: 'subtraction' });
}

/** Typed times-table recall — no options to eliminate. */
export function genTableRecall(cls: SchoolClass, diff: Difficulty): Question {
  const ceiling = diff === 'easy' ? 5 : diff === 'medium' ? 10 : 12;
  const a = ri(2, ceiling);
  const b = ri(2, 12);
  return entryQuestion(`${a} × ${b} = ?`, a * b, { resolvedCategory: 'multiplication' });
}

/** Typed doubling and halving — a core mental-arithmetic strategy. */
export function genDoubleHalve(cls: SchoolClass, diff: Difficulty): Question {
  const early = cls === '1st' || cls === '2nd';
  if (Math.random() < 0.5) {
    const n = early ? ri(1, 20) : ri(10, diff === 'hard' ? 500 : 100);
    return entryQuestion(`Double ${n} = ?`, n * 2, { resolvedCategory: 'addition' });
  }
  const half = early ? ri(1, 10) : ri(5, diff === 'hard' ? 250 : 50);
  return entryQuestion(`Half of ${half * 2} = ?`, half, { resolvedCategory: 'division' });
}
