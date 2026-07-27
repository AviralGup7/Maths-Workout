// ─── Misconception diagnosis ─────────────────────────────────────────────────
// Direction D core — the differentiating capability.
//
// A wrong answer is not noise. Children's arithmetic errors are overwhelmingly
// *systematic*: they apply a consistent but faulty rule. Recording only
// "incorrect" throws away the most useful signal in the entire product.
//
// This module works in two directions:
//
//   1. DETECT   — given the question, the correct answer and what the learner
//                 actually chose, infer which faulty rule they applied.
//   2. GENERATE — build distractors that *are* the outputs of those faulty
//                 rules, so a wrong answer is diagnostic by construction.
//
// (2) matters as much as (1). The legacy distractors were random offsets
// (`answer ± spread`), so a wrong answer carried almost no information. Making
// each distractor the product of a named misconception turns every question
// into a diagnostic probe.

import type { SkillId } from './skills';

export interface Misconception {
  id: string;
  label: string;
  /** Learner-facing explanation of what went wrong. */
  explanation: string;
  /** Concrete next step for a parent or teacher. */
  remediation: string;
  /** Skills this error pattern applies to. */
  skills: SkillId[];
}

export const MISCONCEPTIONS: Record<string, Misconception> = {
  'sub.smaller-from-larger': {
    id: 'sub.smaller-from-larger',
    label: 'Subtracting the smaller digit from the larger',
    explanation:
      'When a column needs borrowing, the smaller digit is being taken from the larger one instead. For 43 − 27 this gives 24 rather than 16.',
    remediation:
      'Practise regrouping with physical tens and ones before returning to written subtraction.',
    skills: ['sub.2digit.borrow', 'sub.3digit', 'sub.large'],
  },
  'add.forgot-carry': {
    id: 'add.forgot-carry',
    label: 'Forgetting to carry',
    explanation:
      'The ones column is added correctly but the carried ten is not added into the next column.',
    remediation:
      'Write the carried digit above the tens column every time, even when it is zero.',
    skills: ['add.2digit.carry', 'add.3digit', 'add.large'],
  },
  'add.digitwise': {
    id: 'add.digitwise',
    label: 'Adding each column independently',
    explanation:
      'Each column is added separately with no carrying at all, so 47 + 35 becomes 712.',
    remediation:
      'Revisit place value — show that ten ones must be exchanged for one ten.',
    skills: ['add.2digit.carry', 'add.3digit'],
  },
  'frac.add-across': {
    id: 'frac.add-across',
    label: 'Adding numerators and denominators',
    explanation:
      'Both parts of the fraction are being added, so 1/2 + 1/3 becomes 2/5. Denominators name the size of the piece and are not added.',
    remediation:
      'Use fraction bars to show that halves and thirds must be made the same size first.',
    skills: ['frac.addSameDenom', 'frac.equivalence'],
  },
  'dec.longer-is-bigger': {
    id: 'dec.longer-is-bigger',
    label: 'Assuming more digits means a bigger number',
    explanation:
      'Decimals are being compared by digit count, so 0.45 is judged larger than 0.5.',
    remediation:
      'Line up decimal points and compare place by place, starting from the tenths.',
    skills: ['dec.tenths', 'dec.hundredths'],
  },
  'mul.added-instead': {
    id: 'mul.added-instead',
    label: 'Adding instead of multiplying',
    explanation:
      'The operation was read as addition — 6 × 4 answered as 10.',
    remediation:
      'Reinforce multiplication as repeated addition using arrays or groups.',
    skills: ['mul.tables.easy', 'mul.tables.mid', 'mul.tables.full'],
  },
  'mul.off-by-one-group': {
    id: 'mul.off-by-one-group',
    label: 'Counting one group too many or too few',
    explanation:
      'The answer is one multiple away from correct, which usually means a skip-counting slip.',
    remediation:
      'Practise skip counting aloud for this table before answering.',
    skills: ['mul.tables.easy', 'mul.tables.mid', 'mul.tables.full'],
  },
  'arith.off-by-one': {
    id: 'arith.off-by-one',
    label: 'Off by one',
    explanation:
      'The answer is one away from correct — usually a miscount on the final step rather than a misunderstanding.',
    remediation:
      'Slow down and recount the last step, using fingers or a number line to check.',
    skills: ['add.within10', 'add.within20', 'sub.within10', 'sub.within20',
             'add.2digit.carry', 'sub.2digit.borrow'],
  },
  'div.reversed': {
    id: 'div.reversed',
    label: 'Dividing the wrong way round',
    explanation:
      'The divisor and dividend have been swapped.',
    remediation:
      'Read the question aloud as "how many groups of ___ fit into ___".',
    skills: ['div.basic', 'div.tables', 'div.large'],
  },
  'sub.reversed': {
    id: 'sub.reversed',
    label: 'Reversing the subtraction',
    explanation:
      'The smaller number has been subtracted from the larger regardless of the order written.',
    remediation:
      'Use a number line and move left from the starting number.',
    skills: ['sub.within20', 'sub.2digit.borrow', 'integers.basic'],
  },
  'percent.wrong-base': {
    id: 'percent.wrong-base',
    label: 'Using the wrong base for the percentage',
    explanation:
      'The percentage has been applied to the wrong quantity, or read as a fraction of 10 rather than 100.',
    remediation:
      'Find 10% first, then scale — it makes the base explicit.',
    skills: ['percent.basic'],
  },
  'placevalue.digit-confusion': {
    id: 'placevalue.digit-confusion',
    label: 'Confusing place-value columns',
    explanation:
      'Tens and ones (or hundreds and tens) have been read in the wrong column.',
    remediation:
      'Practise with a place-value chart and physical base-ten blocks.',
    skills: ['placevalue', 'numsense.compare'],
  },
  'guessing': {
    id: 'guessing',
    label: 'Answering without working',
    explanation:
      'Answers are arriving faster than the problem can reasonably be solved, which usually means guessing.',
    remediation:
      'Encourage working the problem out before choosing. Speed is not the goal.',
    skills: [],
  },
};

/** Answers faster than this are implausible for genuine calculation. */
const GUESS_LATENCY_MS = 1200;

export interface DiagnosisInput {
  questionText: string;
  expected: string;
  chosen: string;
  skill: SkillId;
  latencyMs: number;
  timedOut: boolean;
}

/**
 * Infer which faulty rule produced a wrong answer.
 * Returns a misconception id, or null when the error has no recognised pattern.
 */
export function diagnose(input: DiagnosisInput): string | null {
  const { questionText, expected, chosen, skill, latencyMs, timedOut } = input;
  if (timedOut || chosen === '') return null;
  if (chosen === expected) return null;

  const exp = Number(expected);
  const got = Number(chosen);
  const numeric = Number.isFinite(exp) && Number.isFinite(got);

  // Implausibly fast answers indicate guessing rather than a faulty rule.
  if (numeric && latencyMs > 0 && latencyMs < GUESS_LATENCY_MS) {
    return 'guessing';
  }

  const operands = extractOperands(questionText);

  // ── Addition ───────────────────────────────────────────────────────────────
  if (skill.startsWith('add.') && operands.length >= 2 && numeric) {
    const [a, b] = operands;
    if (concatDigitwise(a, b) === got) return 'add.digitwise';
    // Dropping a carry loses exactly one ten per affected column.
    if (exp - got === 10 || exp - got === 100) return 'add.forgot-carry';
    if (Math.abs(exp - got) === 1) return 'arith.off-by-one';
  }

  // ── Subtraction ────────────────────────────────────────────────────────────
  if (skill.startsWith('sub.') && operands.length >= 2 && numeric) {
    const [a, b] = operands;
    if (columnwiseAbsDiff(a, b) === got && got !== exp) return 'sub.smaller-from-larger';
    if (b - a === got && got !== exp) return 'sub.reversed';
    if (got - exp === 10 || got - exp === 100) return 'sub.smaller-from-larger';
    if (Math.abs(exp - got) === 1) return 'arith.off-by-one';
  }

  // ── Multiplication ─────────────────────────────────────────────────────────
  if (skill.startsWith('mul.') && operands.length >= 2 && numeric) {
    const [a, b] = operands;
    if (a + b === got) return 'mul.added-instead';
    if (got === exp - a || got === exp + a || got === exp - b || got === exp + b) {
      return 'mul.off-by-one-group';
    }
  }

  // ── Division ───────────────────────────────────────────────────────────────
  if (skill.startsWith('div.') && operands.length >= 2 && numeric) {
    const [a, b] = operands;
    if (b !== 0 && a !== 0 && Math.abs(b / a - got) < 1e-9) return 'div.reversed';
  }

  // ── Fractions ──────────────────────────────────────────────────────────────
  if (skill.startsWith('frac.')) {
    const fracs = extractFractions(questionText);
    if (fracs.length >= 2) {
      const [f1, f2] = fracs;
      if (f1.d !== f2.d && got === f1.n + f2.n) return 'frac.add-across';
    }
  }

  // ── Decimals ───────────────────────────────────────────────────────────────
  if (skill.startsWith('dec.') && numeric) {
    const expDigits = decimalDigits(expected);
    const gotDigits = decimalDigits(chosen);
    if (gotDigits > expDigits && got < exp) return 'dec.longer-is-bigger';
  }

  // ── Percentages ────────────────────────────────────────────────────────────
  if (skill.startsWith('percent.') && numeric && exp !== 0) {
    const ratio = got / exp;
    if (Math.abs(ratio - 10) < 1e-6 || Math.abs(ratio - 0.1) < 1e-6) {
      return 'percent.wrong-base';
    }
  }

  // ── Place value ────────────────────────────────────────────────────────────
  if (skill.startsWith('placevalue') && numeric) {
    if (got * 10 === exp || got === exp * 10) return 'placevalue.digit-confusion';
  }

  return null;
}

// ─── Diagnostic distractor generation ────────────────────────────────────────

/**
 * Build wrong answers that are the *outputs of real misconceptions*.
 *
 * This is what makes a wrong answer informative. Callers supply the operands
 * and the correct answer; we return plausible faulty results, each tagged with
 * the misconception that produces it.
 */
export function diagnosticDistractors(
  skill: SkillId,
  a: number,
  b: number,
  answer: number,
): { value: number; misconception: string }[] {
  const out: { value: number; misconception: string }[] = [];
  const push = (value: number, misconception: string) => {
    if (!Number.isFinite(value)) return;
    if (value === answer) return;
    if (value < 0) return; // never offer negatives to young learners
    if (out.some(o => o.value === value)) return;
    out.push({ value, misconception });
  };

  if (skill.startsWith('add.')) {
    push(answer - 10, 'add.forgot-carry');
    const dw = concatDigitwise(a, b);
    if (dw < answer * 12) push(dw, 'add.digitwise');
    push(answer - 1, 'arith.off-by-one');
  } else if (skill.startsWith('sub.')) {
    push(columnwiseAbsDiff(a, b), 'sub.smaller-from-larger');
    push(answer + 10, 'sub.smaller-from-larger');
    push(answer + 1, 'arith.off-by-one');
  } else if (skill.startsWith('mul.')) {
    push(a + b, 'mul.added-instead');
    push(answer - a, 'mul.off-by-one-group');
    push(answer + a, 'mul.off-by-one-group');
  } else if (skill.startsWith('div.')) {
    push(answer + 1, 'arith.off-by-one');
    push(answer - 1, 'arith.off-by-one');
    if (b !== 0) push(Math.round(b / Math.max(1, a)), 'div.reversed');
  }

  return out;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Leading integers in the question text, ignoring any trailing "= ?". */
export function extractOperands(text: string): number[] {
  const cleaned = text.split('=')[0];
  const matches = cleaned.match(/-?\d+(?!\/)/g);
  return matches ? matches.map(Number) : [];
}

export function extractFractions(text: string): { n: number; d: number }[] {
  const matches = text.match(/(\d+)\s*\/\s*(\d+)/g);
  if (!matches) return [];
  return matches.map(m => {
    const [n, d] = m.split('/').map(s => Number(s.trim()));
    return { n, d };
  });
}

/** Digit-count after the decimal point. */
function decimalDigits(s: string): number {
  const parts = s.split('.');
  return parts.length > 1 ? parts[1].length : 0;
}

/**
 * The "smaller from larger" error: each column subtracts the smaller digit
 * from the larger, ignoring borrowing entirely.
 */
export function columnwiseAbsDiff(a: number, b: number): number {
  const as = String(Math.abs(a)).split('').reverse();
  const bs = String(Math.abs(b)).split('').reverse();
  const len = Math.max(as.length, bs.length);
  let result = '';
  for (let i = 0; i < len; i++) {
    const da = Number(as[i] ?? 0);
    const db = Number(bs[i] ?? 0);
    result = String(Math.abs(da - db)) + result;
  }
  return Number(result);
}

/**
 * The "no carrying at all" error: each column is summed independently and the
 * results are concatenated, so 47 + 35 becomes 712.
 */
export function concatDigitwise(a: number, b: number): number {
  const as = String(Math.abs(a)).split('').reverse();
  const bs = String(Math.abs(b)).split('').reverse();
  const len = Math.max(as.length, bs.length);
  let result = '';
  for (let i = 0; i < len; i++) {
    const da = Number(as[i] ?? 0);
    const db = Number(bs[i] ?? 0);
    result = String(da + db) + result;
  }
  return Number(result);
}

/** Summarise the dominant misconceptions in a set of attempts. */
export function summariseMisconceptions(
  ids: (string | undefined)[],
): { id: string; count: number; info: Misconception }[] {
  const counts = new Map<string, number>();
  for (const id of ids) {
    if (!id || id === 'legacy-import') continue;
    if (!MISCONCEPTIONS[id]) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count, info: MISCONCEPTIONS[id] }))
    .sort((x, y) => y.count - x.count);
}
