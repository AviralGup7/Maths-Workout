// ─── Interaction types ───────────────────────────────────────────────────────
// Question engine evolution — see docs/10-question-engine-evolution.md
//
// Previously every question in the app was answered the same way: read text,
// tap one of four tiles. That single modality has to serve counting, fractions,
// place value, geometry and algebra alike, and it teaches elimination as much
// as arithmetic.
//
// This module adds *interaction types*. Each is a different physical act the
// learner performs, which unlocks whole families of questions and — critically
// — improves diagnosis, because the shape of a wrong action reveals the
// underlying mental model.
//
// The change is additive: `interaction` is optional on `Question`, and its
// absence means multiple choice. Every pre-existing generator keeps working.

import type { ChoiceValue, Question } from './types';
import { shuffleArr, ri } from './helpers';

export type Interaction =
  /** Tap one of four tiles. The historical default. */
  | { kind: 'choice' }
  /**
   * Type the answer on a numeric keypad.
   * Removes the answer from the screen entirely, so elimination is impossible
   * and every wrong answer is observable rather than one of three.
   */
  | { kind: 'entry'; inputMode: 'integer' | 'decimal'; unit?: string }
  /**
   * Tap every option that applies.
   * The natural shape for factors, primes, multiples and classification.
   */
  | { kind: 'multiSelect'; options: ChoiceValue[]; correct: ChoiceValue[]; minRequired?: number }
  /**
   * Place items into a sequence.
   * The natural shape for comparing and ordering; the inversion count is a
   * richer error signal than right/wrong.
   */
  | { kind: 'ordering'; items: ChoiceValue[]; correctOrder: ChoiceValue[]; direction: 'asc' | 'desc' }
  /**
   * Choose the band the answer falls into, without computing it exactly.
   *
   * Estimation needs a genuinely different grading rule — the answer is a
   * RANGE, not a value — which is why it is an interaction kind rather than a
   * generator flag. Grading against a band is what makes approximate reasoning
   * the skill under test.
   *
   * The bands are offered as coarse buckets on purpose: a child who computes
   * exactly and then rounds gets the right answer but learns nothing, so the
   * buckets are spaced widely enough that estimating is the faster path.
   */
  | { kind: 'estimate'; low: number; high: number; unit?: string; bands: [number, number][] };

export type InteractionKind = Interaction['kind'];

// ─── Normalisation ───────────────────────────────────────────────────────────
// Every interaction reduces to a comparable string so that grading, the attempt
// log and misconception diagnosis need no knowledge of how the answer was
// entered. This is what keeps one pipeline behind four input surfaces.

/** Canonical string for a set-valued answer (order-independent). */
export function normaliseSet(values: ChoiceValue[]): string {
  return [...values].map(String).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(',');
}

/** Canonical string for a sequence-valued answer (order matters). */
export function normaliseSequence(values: ChoiceValue[]): string {
  return values.map(String).join(',');
}

/** Canonical string for a typed numeric answer. */
export function normaliseEntry(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '-') return '';
  const n = Number(trimmed);
  return Number.isFinite(n) ? String(n) : trimmed;
}

/** The expected answer for a question, in normalised form. */
export function expectedAnswer(q: Question): string {
  const it = q.interaction;
  if (!it || it.kind === 'choice') return String(q.answer);
  if (it.kind === 'entry') return normaliseEntry(String(q.answer));
  if (it.kind === 'multiSelect') return normaliseSet(it.correct);
  if (it.kind === 'estimate') return normaliseBand(it.low, it.high);
  return normaliseSequence(it.correctOrder);
}

/** Canonical string for a band-valued answer. */
export function normaliseBand(low: number, high: number): string {
  return `${low}-${high}`;
}

/**
 * Grade a normalised submission against the question.
 *
 * Estimation is the one kind that is NOT string equality: any band that
 * overlaps the acceptable range is correct, because the construct being
 * measured is "is your sense of magnitude right", not "did you pick the
 * identical label".
 */
export function grade(q: Question, submitted: string): boolean {
  const it = q.interaction;
  if (it?.kind === 'estimate') {
    const m = submitted.match(/^(-?[\d.]+)-(-?[\d.]+)$/);
    if (!m) return false;
    const lo = Number(m[1]);
    const hi = Number(m[2]);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return false;
    // Correct when the chosen band contains the true value.
    return lo <= it.high && hi >= it.low;
  }
  return submitted === expectedAnswer(q);
}

/**
 * Build an estimation question.
 *
 * `answer` is the true value; the acceptable band is derived from it with a
 * tolerance, and distractor bands sit clearly outside. Bands never overlap, so
 * exactly one option can be right.
 */
export function estimateQuestion(
  questionText: string,
  answer: number,
  opts: { tolerance?: number; unit?: string; resolvedCategory?: Question['resolvedCategory'] } = {},
): Question {
  const tol = opts.tolerance ?? 0.2;
  const round = (n: number) => {
    // Round to a readable magnitude so bands look like estimates, not answers.
    const mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.abs(n) || 1)) - 1));
    return Math.round(n / mag) * mag;
  };
  const low = round(answer * (1 - tol));
  const high = round(answer * (1 + tol));
  const width = Math.max(1, high - low);

  // Distractor bands sit clearly outside the true range, and NEVER below zero:
  // browser testing surfaced a band of "-10-100" on a money question, which is
  // nonsense to a child and quietly teaches that negative quantities of
  // notebooks are plausible. When the low side has no room, the extra bands go
  // above instead.
  const above = (k: number): [number, number] =>
    [round(high + width * (2 * k - 1)), round(high + width * 2 * k)];

  const belowLo = round(low - width * 2);
  const belowHi = round(low - width);
  const hasRoomBelow = belowLo > 0 && belowHi > belowLo;

  const bands: [number, number][] = hasRoomBelow
    ? [[belowLo, belowHi], [low, high], above(1), above(2)]
    : [[low, high], above(1), above(2), above(3)];

  return {
    questionText,
    answer: normaliseBand(low, high),
    choices: [],
    resolvedCategory: opts.resolvedCategory,
    interaction: { kind: 'estimate', low, high, unit: opts.unit, bands: shuffleArr(bands) },
  };
}

// ─── Builders ────────────────────────────────────────────────────────────────

/** A question answered by typing on a numeric keypad. */
export function entryQuestion(
  questionText: string,
  answer: number,
  opts: { decimal?: boolean; unit?: string; resolvedCategory?: Question['resolvedCategory'] } = {},
): Question {
  return {
    questionText,
    answer,
    choices: [],
    resolvedCategory: opts.resolvedCategory,
    interaction: {
      kind: 'entry',
      inputMode: opts.decimal ? 'decimal' : 'integer',
      unit: opts.unit,
    },
  };
}

/**
 * A question answered by selecting every option that applies.
 * `correct` must be a subset of `options`; the caller supplies both so the
 * distractor set is deliberate rather than random.
 */
export function multiSelectQuestion(
  questionText: string,
  correct: ChoiceValue[],
  distractors: ChoiceValue[],
  opts: { resolvedCategory?: Question['resolvedCategory'] } = {},
): Question {
  const options = shuffleArr([...correct, ...distractors]);
  return {
    questionText,
    answer: normaliseSet(correct),
    choices: [],
    resolvedCategory: opts.resolvedCategory,
    interaction: { kind: 'multiSelect', options, correct, minRequired: 1 },
  };
}

/**
 * A question answered by placing items in order.
 * `items` is shuffled for presentation; a shuffle equal to the answer is
 * re-rolled so the task is never already solved.
 */
export function orderingQuestion(
  questionText: string,
  correctOrder: ChoiceValue[],
  opts: { direction?: 'asc' | 'desc'; resolvedCategory?: Question['resolvedCategory'] } = {},
): Question {
  let items = shuffleArr(correctOrder);
  let guard = 0;
  while (normaliseSequence(items) === normaliseSequence(correctOrder) && guard < 20) {
    items = shuffleArr(correctOrder);
    guard++;
  }
  return {
    questionText,
    answer: normaliseSequence(correctOrder),
    choices: [],
    resolvedCategory: opts.resolvedCategory,
    interaction: {
      kind: 'ordering',
      items,
      correctOrder,
      direction: opts.direction ?? 'asc',
    },
  };
}

// ─── The interaction ladder ──────────────────────────────────────────────────

/**
 * Choose an interaction type for a question, based on how secure the learner is.
 *
 * Recognition precedes recall. A struggling learner benefits from seeing the
 * answer among options — it scaffolds. A confident learner does not, and
 * leaving them on multiple choice lets them practise *elimination*, a strategy
 * that transfers to nothing.
 *
 * @param mastery  current estimate for the skill, 0–1
 * @param supports which interaction types this question could be expressed as
 */
export function pickInteraction(
  mastery: number,
  supports: { entry?: boolean } = {},
): InteractionKind {
  // Below this, keep the answer visible: the learner needs the scaffold.
  if (mastery < 0.8) return 'choice';
  // Secure learners type, so that recall replaces recognition.
  return supports.entry ? 'entry' : 'choice';
}

/**
 * Convert a multiple-choice question into a typed-entry one.
 *
 * Used by the adaptive scheduler to raise the demand on skills the learner has
 * already secured, without needing a parallel set of generators.
 * Only applied when the answer is numeric — string answers (shape names,
 * yes/no) are not sensibly typed by a child.
 */
export function toEntry(q: Question): Question {
  if (typeof q.answer !== 'number' || !Number.isFinite(q.answer)) return q;
  return {
    ...q,
    choices: [],
    interaction: {
      kind: 'entry',
      inputMode: Number.isInteger(q.answer) ? 'integer' : 'decimal',
    },
  };
}

// ─── Diagnostic helpers for the new types ────────────────────────────────────

/**
 * Number of pairs out of order relative to the correct sequence.
 *
 * A continuous measure of *how* wrong an ordering is: one adjacent swap is a
 * slip, a fully reversed sequence is a misread instruction, and a decimal
 * ordering that sorts by digit count is a recognisable misconception.
 */
export function inversionCount(submitted: ChoiceValue[], correct: ChoiceValue[]): number {
  const rank = new Map(correct.map((v, i) => [String(v), i]));
  const idx = submitted.map(v => rank.get(String(v)) ?? -1);
  let inversions = 0;
  for (let i = 0; i < idx.length; i++) {
    for (let j = i + 1; j < idx.length; j++) {
      if (idx[i] > idx[j]) inversions++;
    }
  }
  return inversions;
}

/** Overlap statistics for a multi-select submission. */
export function selectionAccuracy(
  submitted: ChoiceValue[],
  correct: ChoiceValue[],
): { hits: number; misses: number; falsePositives: number } {
  const want = new Set(correct.map(String));
  const got = new Set(submitted.map(String));
  let hits = 0;
  for (const v of got) if (want.has(v)) hits++;
  return {
    hits,
    misses: want.size - hits,
    falsePositives: got.size - hits,
  };
}

/** Small helper for building distractor pools around a value. */
export function nearbyValues(target: number, count: number, spread = 6): number[] {
  const out = new Set<number>();
  let guard = 0;
  while (out.size < count && guard < 200) {
    guard++;
    const v = target + ri(-spread, spread);
    if (v !== target && v >= 0) out.add(v);
  }
  return [...out];
}
