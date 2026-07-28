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
  // ── Coverage for the 17 previously undiagnosed skills ──────────────────────
  // docs/14 Phase 3 #13. Before this, 17 of 41 skills could detect *that* a
  // child was wrong but never *why* — the engine's best capability was simply
  // absent across half the curriculum. Each entry below is a documented error
  // pattern with a distinguishable numeric signature, not a guess: a
  // misconception we cannot detect reliably is worse than none, because it
  // tells a child something false about their own thinking.

  'count.miscount-by-one': {
    id: 'count.miscount-by-one',
    label: 'Miscounting by one',
    explanation:
      'The count is one out — usually the last object is counted twice, or the first is missed.',
    remediation:
      'Touch each object once while counting aloud, and move it aside as you go.',
    skills: ['count.objects', 'count.skip'],
  },
  'count.skip-wrong-step': {
    id: 'count.skip-wrong-step',
    label: 'Skip counting with the wrong step',
    explanation:
      'The jumps are the wrong size — counting in 2s where the pattern goes up in 5s, for example.',
    remediation:
      'Say the step size aloud before starting, then check the first three jumps together.',
    skills: ['count.skip'],
  },
  'add.nocarry-misaligned': {
    id: 'add.nocarry-misaligned',
    label: 'Columns not lined up',
    explanation:
      'Tens and ones have been added to the wrong columns, so the digits do not line up.',
    remediation:
      'Write the numbers one above the other with the ones digits in a straight line.',
    skills: ['add.2digit.nocarry', 'sub.2digit.noborrow'],
  },
  'mul.partial-product-dropped': {
    id: 'mul.partial-product-dropped',
    label: 'Missing one of the partial products',
    explanation:
      'In long multiplication only part of the number has been multiplied — the tens digit was left out.',
    remediation:
      'Multiply by the ones, then by the tens, then add the two results. Write both lines down.',
    skills: ['mul.2digit', 'mul.large'],
  },
  'mul.place-shift-missing': {
    id: 'mul.place-shift-missing',
    label: 'Forgetting the zero when multiplying by tens',
    explanation:
      'When multiplying by the tens digit the answer must shift one place left — the zero is missing.',
    remediation:
      'Write the 0 in the ones column first, before multiplying by the tens digit.',
    skills: ['mul.2digit', 'mul.large'],
  },
  'frac.numerator-as-whole': {
    id: 'frac.numerator-as-whole',
    label: 'Using the numerator instead of dividing',
    explanation:
      'For a fraction of an amount, the top number has been used directly instead of sharing the amount out.',
    remediation:
      'Divide by the bottom number first to find one part, then multiply by the top number.',
    skills: ['frac.ofAmount'],
  },
  'ratio.treated-as-fraction': {
    id: 'ratio.treated-as-fraction',
    label: 'Reading a ratio as a fraction',
    explanation:
      'A ratio of 2:3 has been read as two thirds. It actually means 2 parts out of 5 in total.',
    remediation:
      'Add the parts together first to find the total number of shares.',
    skills: ['ratio.basic'],
  },
  'factors.multiple-not-factor': {
    id: 'factors.multiple-not-factor',
    label: 'Confusing factors with multiples',
    explanation:
      'A multiple has been given where a factor was asked for. Factors divide into a number; multiples are built from it.',
    remediation:
      'Ask "does it divide exactly into the number?" A factor is never larger than the number itself.',
    skills: ['factors.basic'],
  },
  'geometry.area-perimeter-swap': {
    id: 'geometry.area-perimeter-swap',
    label: 'Swapping area and perimeter',
    explanation:
      'The sides have been added when they should be multiplied, or the other way round.',
    remediation:
      'Perimeter is the walk around the edge; area is the number of squares that fill it.',
    skills: ['geometry.basic', 'geometry.area', 'geometry.perimeter'],
  },
  // docs/27 P2-01. The split makes a NEW error visible that the broad node
  // could not express: using a formula correctly but on the wrong dimension.
  'geometry.wrong-dimension': {
    id: 'geometry.wrong-dimension',
    label: 'Using one side where two are needed',
    explanation:
      'Only one measurement was used, so a rectangle was treated as if it were a square.',
    remediation:
      'Label both the length and the width before choosing what to multiply or add.',
    skills: ['geometry.area', 'geometry.perimeter'],
  },
  'geometry.angle-sum-wrong': {
    id: 'geometry.angle-sum-wrong',
    label: 'Using the wrong angle total',
    explanation:
      'The angles were subtracted from the wrong total — 180° used where 360° was needed, or the reverse.',
    remediation:
      'Name the shape first: a straight line is 180°, a triangle 180°, a quadrilateral 360°, a full turn 360°.',
    skills: ['geometry.angles', 'geometry.basic'],
  },
  'measurement.unit-conversion': {
    id: 'measurement.unit-conversion',
    label: 'Converting units the wrong way',
    explanation:
      'The answer is out by a factor of ten, a hundred or a thousand — the conversion went the wrong direction.',
    remediation:
      'Ask whether the answer should be a bigger or smaller number before converting.',
    skills: [
      'measurement.basic',
      'measurement.length', 'measurement.mass', 'measurement.capacity',
    ],
  },
  'data.mean-vs-median': {
    id: 'data.mean-vs-median',
    label: 'Using the wrong average',
    explanation:
      'The middle value has been given where the mean was asked for, or the other way round.',
    remediation:
      'Mean is add-then-divide. Median is the middle value once the numbers are in order.',
    skills: ['data.basic', 'data.mean', 'data.median'],
  },
  'data.forgot-divide': {
    id: 'data.forgot-divide',
    label: 'Adding without dividing',
    explanation:
      'The values were totalled correctly but never divided by how many there are.',
    remediation:
      'After adding, count how many numbers there were and divide by that.',
    skills: ['data.basic', 'data.mean'],
  },
  // docs/27 P2-03. Only expressible once median has its own node: the child
  // takes the middle of the list AS WRITTEN, which is the single most common
  // median error and is invisible when median shares a skill with mean.
  'data.median-unsorted': {
    id: 'data.median-unsorted',
    label: 'Taking the middle without sorting',
    explanation:
      'The middle value of the list as written was given, but the numbers were not in order first.',
    remediation:
      'Rewrite the numbers smallest to largest, then point to the middle one.',
    skills: ['data.median'],
  },
  'data.mode-counted-not-named': {
    id: 'data.mode-counted-not-named',
    label: 'Giving how often instead of which value',
    explanation:
      'The count of the most frequent value was given rather than the value itself.',
    remediation:
      'The mode is the number that repeats, not the number of times it repeats.',
    skills: ['data.mode'],
  },
  'data.range-gave-extreme': {
    id: 'data.range-gave-extreme',
    label: 'Giving the largest value as the range',
    explanation:
      'The biggest number in the set was given instead of the gap between biggest and smallest.',
    remediation:
      'Range is a subtraction: largest − smallest.',
    skills: ['data.range'],
  },
  'algebra.inverse-not-applied': {
    id: 'algebra.inverse-not-applied',
    label: 'Applying the same operation instead of the inverse',
    explanation:
      'To undo an operation you need its opposite — the same operation was used again instead.',
    remediation:
      'To undo adding, subtract. To undo multiplying, divide. Do it to both sides.',
    skills: ['algebra.basic'],
  },
  'wordproblems.wrong-operation': {
    id: 'wordproblems.wrong-operation',
    label: 'Choosing the wrong operation',
    explanation:
      'The arithmetic is correct but the wrong operation was chosen for the story.',
    remediation:
      'Retell the problem in your own words first. Is something being combined, taken away, grouped or shared?',
    skills: ['wordproblems'],
  },
  'shapes.side-corner-confusion': {
    id: 'shapes.side-corner-confusion',
    label: 'Counting corners instead of sides',
    explanation:
      'Corners have been counted where sides were asked for, or the other way round.',
    remediation:
      'Trace the shape with a finger: sides are the lines, corners are where they meet.',
    skills: ['shapes.basic'],
  },
  'time.sixty-not-hundred': {
    id: 'time.sixty-not-hundred',
    label: 'Treating an hour as 100 minutes',
    explanation:
      'Time has been calculated in hundreds. An hour is 60 minutes, not 100.',
    remediation:
      'Count on in minutes to the next hour first, then add the remaining minutes.',
    skills: ['time.basic'],
  },
  'money.change-not-subtracted': {
    id: 'money.change-not-subtracted',
    label: 'Adding instead of finding the change',
    explanation:
      'The amounts were added together when the change should have been worked out by subtracting.',
    remediation:
      'Count up from the price to the money handed over — that difference is the change.',
    skills: ['money.basic'],
  },
  'numsense.computed-not-estimated': {
    id: 'numsense.computed-not-estimated',
    label: 'Working it out exactly instead of estimating',
    explanation:
      'The exact answer was calculated and then a band chosen. Estimating means judging the size before computing — it is a different and faster skill.',
    remediation:
      'Round each number to something easy first, then work with the rounded numbers.',
    skills: ['numsense.estimate'],
  },
  'numsense.magnitude-blind': {
    id: 'numsense.magnitude-blind',
    label: 'Answer is the wrong size altogether',
    explanation:
      'The estimate is out by a factor of ten or more, which suggests the size of the numbers has not been taken in.',
    remediation:
      'Before answering, ask whether the result should be in tens, hundreds or thousands.',
    skills: ['numsense.estimate', 'numsense.reasonable'],
  },
  'numsense.accepts-implausible': {
    id: 'numsense.accepts-implausible',
    label: 'Accepting an unreasonable answer',
    explanation:
      'An answer that could not be right was judged sensible — the check against common sense was skipped.',
    remediation:
      'Ask "should this be bigger or smaller than what I started with?" before deciding.',
    skills: ['numsense.reasonable'],
  },
  'patterns.additive-only': {
    id: 'patterns.additive-only',
    label: 'Assuming every pattern adds the same amount',
    explanation:
      'The sequence was continued by adding a constant, but this pattern grows in a different way — by doubling, or by a gap that itself increases.',
    remediation:
      'Write the gaps between the terms underneath. If the gaps are not equal, the rule is not simple addition.',
    skills: ['patterns.basic'],
  },
  'symmetry.miscounts-lines': {
    id: 'symmetry.miscounts-lines',
    label: 'Missing lines of symmetry',
    explanation:
      'Only the obvious vertical and horizontal folds were counted — regular shapes also fold along their diagonals.',
    remediation:
      'Imagine folding the shape so both halves match exactly, and try every direction, not just up-down and left-right.',
    skills: ['symmetry.basic'],
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

  // ── Counting ───────────────────────────────────────────────────────────────
  if (skill.startsWith('count.') && numeric) {
    if (Math.abs(exp - got) === 1) return 'count.miscount-by-one';
    // A skip-count answered with a different, consistent step size.
    if (skill === 'count.skip' && operands.length >= 2) {
      const step = operands[1] - operands[0];
      const wrongStep = got - operands[operands.length - 1];
      if (step !== 0 && wrongStep !== 0 && wrongStep !== step) return 'count.skip-wrong-step';
    }
  }

  // ── Column alignment (no-carry / no-borrow) ────────────────────────────────
  if ((skill === 'add.2digit.nocarry' || skill === 'sub.2digit.noborrow')
      && operands.length >= 2 && numeric) {
    const [a, b] = operands;
    // Adding the tens digit into the ones column, or vice versa.
    const misaligned = skill.startsWith('add.')
      ? a + Math.floor(b / 10) + (b % 10) * 10
      : a - (Math.floor(b / 10) + (b % 10) * 10);
    if (got === misaligned && got !== exp) return 'add.nocarry-misaligned';
    if (Math.abs(exp - got) === 1) return 'arith.off-by-one';
  }

  // ── Long multiplication ────────────────────────────────────────────────────
  if ((skill === 'mul.2digit' || skill === 'mul.large') && operands.length >= 2 && numeric) {
    const [a, b] = operands;
    // Only the ones digit of the multiplier was used.
    if (got === a * (b % 10)) return 'mul.partial-product-dropped';
    // The tens partial product was not shifted left.
    if (got === a * (b % 10) + a * Math.floor(b / 10)) return 'mul.place-shift-missing';
    if (a + b === got) return 'mul.added-instead';
  }

  // ── Fractions of an amount ─────────────────────────────────────────────────
  if (skill === 'frac.ofAmount' && numeric) {
    const fracs = extractFractions(questionText);
    const amounts = operands.filter(n => n > 0);
    if (fracs.length >= 1 && amounts.length >= 1) {
      const { n, d } = fracs[0];
      const amount = amounts[amounts.length - 1];
      if (d !== 0) {
        if (got === n) return 'frac.numerator-as-whole';
        if (got === amount / d && n !== 1) return 'frac.numerator-as-whole';
      }
    }
  }

  // ── Ratio ──────────────────────────────────────────────────────────────────
  if (skill === 'ratio.basic' && operands.length >= 2 && numeric) {
    const [a, b] = operands;
    const total = a + b;
    // Divided by one part rather than by the total number of shares.
    if (total !== 0 && b !== 0 && Math.abs(got - exp * total / b) < 1e-9) {
      return 'ratio.treated-as-fraction';
    }
  }

  // ── Factors ────────────────────────────────────────────────────────────────
  if (skill === 'factors.basic' && operands.length >= 1 && numeric) {
    const n = operands[0];
    if (n !== 0 && got !== 0 && got % n === 0 && got > n) {
      return 'factors.multiple-not-factor';
    }
  }

  // ── Geometry ───────────────────────────────────────────────────────────────
  if (skill.startsWith('geometry.') && operands.length >= 2 && numeric) {
    const [a, b] = operands;
    if (got === 2 * (a + b) && exp === a * b) return 'geometry.area-perimeter-swap';
    if (got === a * b && exp === 2 * (a + b)) return 'geometry.area-perimeter-swap';
    // docs/27 P2-01. Squaring one side of a rectangle, or perimeter as 4×one
    // side — both are "the formula for a square, applied to a rectangle".
    if (a !== b && (got === a * a || got === b * b) && exp === a * b) {
      return 'geometry.wrong-dimension';
    }
    if (a !== b && (got === 4 * a || got === 4 * b) && exp === 2 * (a + b)) {
      return 'geometry.wrong-dimension';
    }
  }
  if (skill === 'geometry.angles' && numeric && exp !== 0) {
    // Subtracted from the wrong total: the error is exactly the difference
    // between two of the standard angle sums.
    for (const [wrong, right] of [[180, 90], [90, 180], [360, 180], [180, 360]]) {
      if (Math.abs(got - (exp + wrong - right)) < 1e-9) return 'geometry.angle-sum-wrong';
    }
  }

  // ── Measurement ────────────────────────────────────────────────────────────
  if (skill.startsWith('measurement.') && numeric && exp !== 0 && got !== 0) {
    const ratio = got / exp;
    for (const f of [10, 100, 1000, 0.1, 0.01, 0.001]) {
      if (Math.abs(ratio - f) < 1e-9) return 'measurement.unit-conversion';
    }
  }

  // ── Data and averages ──────────────────────────────────────────────────────
  if (skill.startsWith('data.') && operands.length >= 2 && numeric) {
    const sum = operands.reduce((x, y) => x + y, 0);
    if (got === sum && exp !== sum) return 'data.forgot-divide';
    const sorted = [...operands].sort((x, y) => x - y);
    const mid = (xs: number[]) => xs.length % 2
      ? xs[(xs.length - 1) / 2]
      : (xs[xs.length / 2 - 1] + xs[xs.length / 2]) / 2;
    const median = mid(sorted);

    // Checked BEFORE mean-vs-median: the middle of the unsorted list is a
    // more specific claim, and when both match the specific one is the truer
    // description of what the child did.
    if (skill === 'data.median') {
      const unsorted = mid(operands);
      if (got === unsorted && got !== exp) return 'data.median-unsorted';
    }
    if (skill === 'data.range') {
      if (got === Math.max(...operands) && got !== exp) return 'data.range-gave-extreme';
    }
    if (skill === 'data.mode') {
      const counts = new Map<number, number>();
      for (const v of operands) counts.set(v, (counts.get(v) ?? 0) + 1);
      const best = Math.max(...counts.values());
      if (got === best && got !== exp) return 'data.mode-counted-not-named';
    }
    if (got === median && exp !== median) return 'data.mean-vs-median';
  }

  // ── Algebra ────────────────────────────────────────────────────────────────
  if (skill === 'algebra.basic' && operands.length >= 2 && numeric) {
    const [a, b] = operands;
    // Repeating the operation rather than inverting it.
    if (got === a + b && exp === b - a) return 'algebra.inverse-not-applied';
    if (got === a * b && exp === b / a) return 'algebra.inverse-not-applied';
    if (Math.abs(exp - got) === 1) return 'arith.off-by-one';
  }

  // ── Word problems ──────────────────────────────────────────────────────────
  if (skill === 'wordproblems' && operands.length >= 2 && numeric) {
    const [a, b] = operands;
    // The arithmetic is sound but the operation chosen does not match the story.
    for (const alt of [a + b, a - b, b - a, a * b]) {
      if (got === alt && got !== exp) return 'wordproblems.wrong-operation';
    }
  }

  // ── Shapes ─────────────────────────────────────────────────────────────────
  if (skill === 'shapes.basic' && numeric) {
    // For polygons sides === corners, so this only fires where they differ
    // (a circle has 0 corners), which keeps the claim honest.
    if (/corner/i.test(questionText) && exp === 0 && got > 0) {
      return 'shapes.side-corner-confusion';
    }
  }

  // ── Time ───────────────────────────────────────────────────────────────────
  if (skill === 'time.basic' && numeric) {
    // Out by exactly the 100-vs-60 difference for whole hours.
    const diff = Math.abs(got - exp);
    if (diff !== 0 && diff % 40 === 0) return 'time.sixty-not-hundred';
  }

  // ── Number sense ───────────────────────────────────────────────────────────
  if (skill === 'numsense.estimate' && numeric) {
    // Bands are strings like "40-60"; a wildly distant pick is magnitude blindness.
    const band = chosen.match(/^(-?[\d.]+)-(-?[\d.]+)$/);
    const want = expected.match(/^(-?[\d.]+)-(-?[\d.]+)$/);
    if (band && want) {
      const mid = (Number(band[1]) + Number(band[2])) / 2;
      const target = (Number(want[1]) + Number(want[2])) / 2;
      if (target !== 0 && (mid / target >= 5 || mid / target <= 0.2)) {
        return 'numsense.magnitude-blind';
      }
    }
  }

  // ── Patterns ───────────────────────────────────────────────────────────────
  if (skill === 'patterns.basic' && operands.length >= 3 && numeric) {
    // Continued with a constant step where the real rule grows.
    const step = operands[1] - operands[0];
    if (operands[operands.length - 1] + step === got && got !== exp) {
      return 'patterns.additive-only';
    }
  }

  // ── Symmetry ───────────────────────────────────────────────────────────────
  if (skill === 'symmetry.basic' && numeric) {
    // Undercounting is the characteristic error: diagonals get missed.
    if (got > 0 && got < exp) return 'symmetry.miscounts-lines';
  }

  // ── Money ──────────────────────────────────────────────────────────────────
  if (skill === 'money.basic' && operands.length >= 2 && numeric) {
    const [a, b] = operands;
    if (got === a + b && exp !== a + b) return 'money.change-not-subtracted';
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
