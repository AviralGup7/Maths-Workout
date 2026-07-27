// ─── Shared utilities for question generators ────────────────────────────────

export const ri = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const pick = <T,>(arr: T[]): T => arr[ri(0, arr.length - 1)];

export const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
export const lcm = (a: number, b: number): number => (a * b) / gcd(a, b);

export function countFactors(n: number): number {
  let c = 0;
  for (let i = 1; i <= n; i++) if (n % i === 0) c++;
  return c;
}

export function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i <= Math.sqrt(n); i++) if (n % i === 0) return false;
  return true;
}

export function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = ri(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Carry / borrow helpers ───────────────────────────────────────────────────

export const hasCarryOnes  = (a: number, b: number) => (a % 10) + (b % 10) >= 10;
export const hasBorrowOnes = (a: number, b: number) => (a % 10) < (b % 10);

export function addNoCarry(minA: number, maxA: number, minB: number, maxB: number): [number, number] {
  let a: number, b: number, t = 0;
  do { a = ri(minA, maxA); b = ri(minB, maxB); t++; } while (hasCarryOnes(a, b) && t < 200);
  return [a, b];
}

export function addWithCarry(minA: number, maxA: number, minB: number, maxB: number): [number, number] {
  let a: number, b: number, t = 0;
  do { a = ri(minA, maxA); b = ri(minB, maxB); t++; } while (!hasCarryOnes(a, b) && t < 200);
  return [a, b];
}

export function subNoBorrow(minA: number, maxA: number, minB: number, maxB: number): [number, number] {
  let a: number, b: number, t = 0;
  do { a = ri(minA, maxA); b = ri(minB, Math.min(maxB, a)); t++; }
  while ((hasBorrowOnes(a, b) || b >= a) && t < 200);
  return [a, b];
}

export function subWithBorrow(minA: number, maxA: number, minB: number, maxB: number): [number, number] {
  let a = minA;
  let b = minB;
  let t = 0;
  do {
    a = ri(minA, maxA);
    const upper = Math.min(maxB, a - 1);
    if (upper < minB) { t++; continue; }
    b = ri(minB, upper);
    t++;
  }
  while ((!hasBorrowOnes(a, b) || b >= a) && t < 200);
  return [a, b];
}

// ─── Choice generators ────────────────────────────────────────────────────────

// ─── Distractor plausibility (§5A of docs/14) ────────────────────────────────
//
// The audit measured that 100% of sampled questions contained at least one
// option more than 50% away from the answer. A child who cannot compute 47 × 8
// can still eliminate 12 and 900, so a "correct" answer often measured
// test-wiseness rather than arithmetic. Every numeric distractor is now bounded
// by DISTRACTOR_MAX_RATIO of the answer's magnitude.
//
// The absolute floor exists because a ratio alone collapses on small answers:
// 25% of 4 is 1, which leaves no room for three distinct wrong options.

/** Hard cap on how far a distractor may sit from the answer, as a ratio. */
export const DISTRACTOR_MAX_RATIO = 0.25;
/** Absolute floor, so small answers still have a usable window. */
export const DISTRACTOR_MIN_SPREAD = 2;

/** Maximum permitted distance between a distractor and the answer. */
export function distractorSpread(answer: number): number {
  return Math.max(DISTRACTOR_MIN_SPREAD, Math.round(Math.abs(answer) * DISTRACTOR_MAX_RATIO));
}

/**
 * Structured near-misses, in the order a child is most likely to produce them.
 *
 * Priority 2 of the three-tier scheme: priority 1 is misconception output
 * (`diagnosticDistractors`), priority 3 is a random value inside the cap.
 * These are the errors that arise from a slip rather than a faulty rule —
 * off-by-one, a dropped or spurious ten, a reversed pair of digits.
 */
export function structuredNearMisses(answer: number): number[] {
  const out: number[] = [answer + 1, answer - 1];
  const spread = distractorSpread(answer);
  if (spread >= 10) out.push(answer + 10, answer - 10);
  // Digit reversal: 63 → 36. Only meaningful for two-digit-plus answers.
  const digits = String(Math.abs(Math.trunc(answer)));
  if (digits.length >= 2) {
    const reversed = Number([...digits].reverse().join(''));
    if (reversed !== Math.abs(answer)) out.push(Math.sign(answer || 1) * reversed);
  }
  return out;
}

export function makeIntChoices(answer: number, opts: { allowNegative?: boolean } = {}): number[] {
  // Negative distractors confuse learners who have not met negative numbers yet
  // (they are introduced in Class 6). Default to suppressing them unless the
  // answer is itself negative, i.e. we are already in the integers topic.
  const allowNegative = opts.allowNegative ?? answer < 0;
  const spread = distractorSpread(answer);
  const wrong = new Set<number>();
  const admit = (w: number) => {
    if (w === answer || !Number.isFinite(w)) return;
    if (!allowNegative && w < 0) return;
    if (Math.abs(w - answer) > spread) return;
    if (wrong.size < 3) wrong.add(w);
  };

  // Priority 2 — structured near-misses first, so the options a child would
  // actually arrive at are the ones on screen.
  for (const w of structuredNearMisses(answer)) admit(w);

  // Priority 3 — random fill, still inside the cap.
  let tries = 0;
  while (wrong.size < 3 && tries < 300) {
    tries++;
    const delta = ri(-spread, spread);
    if (delta !== 0) admit(answer + delta);
  }
  // Guarantee four options even when the non-negative window is tight. The cap
  // is relaxed here only as a last resort — it is better to show a slightly
  // distant option than a grid with three tiles.
  let step = 1;
  while (wrong.size < 3 && step < 1000) {
    const w = answer + step;
    if (w !== answer && (allowNegative || w >= 0)) wrong.add(w);
    step++;
  }
  return shuffleArr([answer, ...Array.from(wrong)]);
}

export function makeDecChoices(answer: number, step = 0.1, opts: { allowNegative?: boolean } = {}): number[] {
  // As with makeIntChoices, negative distractors are suppressed unless the
  // answer is itself negative — decimals are taught long before integers.
  const allowNegative = opts.allowNegative ?? answer < 0;
  const round = (n: number) => Math.round(n * 100) / 100;
  const wrong = new Set<number>();
  // Decimals are compared, not estimated, so the cap is expressed in steps:
  // never more than 4 steps away, and never beyond the 25% ratio either.
  const cap = Math.max(step * 2, Math.abs(answer) * DISTRACTOR_MAX_RATIO);
  let tries = 0;
  while (wrong.size < 3 && tries < 300) {
    tries++;
    const delta = ri(1, 4) * step * (Math.random() < 0.5 ? 1 : -1);
    const w = round(answer + delta);
    if (!allowNegative && w < 0) continue;
    if (Math.abs(w - answer) > cap + 1e-9) continue;
    if (w !== answer) wrong.add(w);
  }
  // Guarantee four options when the non-negative window is tight.
  let k = 1;
  while (wrong.size < 3 && k < 200) {
    const w = round(answer + k * step);
    if (w !== answer && (allowNegative || w >= 0)) wrong.add(w);
    k++;
  }
  return shuffleArr([answer, ...Array.from(wrong)]);
}

export function makeStrChoices(answer: string, pool: string[]): string[] {
  // The answer grid renders four tiles. A pool smaller than four silently
  // produces a half-empty grid and an easier guess, so fail loudly in dev.
  if (pool.length < 4) {
    console.warn(`[generators] makeStrChoices needs >=4 pool entries, got ${pool.length} for "${answer}"`);
  }
  const others = shuffleArr(pool.filter(x => x !== answer)).slice(0, 3);
  return shuffleArr([answer, ...others]);
}

// ─── Diagnostic choice builder (Direction D) ─────────────────────────────────

/**
 * Build choices where each wrong option is the result of a *named misconception*
 * rather than a random offset.
 *
 * The legacy `makeIntChoices` produced distractors as `answer ± spread`, so a
 * wrong answer carried almost no diagnostic information. Here every distractor
 * we can attribute is tagged, and any remaining slots are filled with plausible
 * near-misses so the option count is always four.
 *
 * @param answer     the correct value
 * @param diagnostic candidate wrong values, each tagged with a misconception id
 * @param allowNegative whether negative distractors are acceptable (integers topic only)
 */
export function makeDiagnosticChoices(
  answer: number,
  diagnostic: { value: number; misconception: string }[],
  allowNegative = false,
): { choices: number[]; distractorMap: Record<string, string> } {
  const chosen: number[] = [];
  const map: Record<string, string> = {};

  for (const { value, misconception } of diagnostic) {
    if (chosen.length >= 3) break;
    if (value === answer) continue;
    if (!allowNegative && value < 0) continue;
    if (!Number.isFinite(value)) continue;
    if (chosen.includes(value)) continue;
    chosen.push(value);
    map[String(value)] = misconception;
  }

  // Priority 2 — structured near-misses, then priority 3 — random within the
  // ±25% cap. Both are bounded so an eliminable option cannot reach the grid.
  const spread = distractorSpread(answer);
  const admit = (candidate: number) => {
    if (!Number.isFinite(candidate)) return;
    if (!allowNegative && candidate < 0) return;
    if (candidate === answer || chosen.includes(candidate)) return;
    if (Math.abs(candidate - answer) > spread) return;
    if (chosen.length < 3) chosen.push(candidate);
  };
  for (const w of structuredNearMisses(answer)) admit(w);

  let guard = 0;
  while (chosen.length < 3 && guard < 400) {
    guard++;
    const delta = ri(-spread, spread);
    if (delta !== 0) admit(answer + delta);
  }

  // Last-resort fill, guaranteeing four distinct options.
  let step = 1;
  while (chosen.length < 3) {
    const candidate = answer + step;
    if (candidate !== answer && !chosen.includes(candidate) && (allowNegative || candidate >= 0)) {
      chosen.push(candidate);
    }
    step++;
    if (step > 1000) break;
  }

  return { choices: shuffleArr([answer, ...chosen]), distractorMap: map };
}
