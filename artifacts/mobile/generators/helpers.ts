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

export function makeIntChoices(answer: number, opts: { allowNegative?: boolean } = {}): number[] {
  // Negative distractors confuse learners who have not met negative numbers yet
  // (they are introduced in Class 6). Default to suppressing them unless the
  // answer is itself negative, i.e. we are already in the integers topic.
  const allowNegative = opts.allowNegative ?? answer < 0;
  const spread = Math.abs(answer) <= 15 ? 2 : Math.abs(answer) <= 100 ? 7 : Math.abs(answer) <= 1000 ? 25 : 100;
  const wrong = new Set<number>();
  let tries = 0;
  while (wrong.size < 3 && tries < 300) {
    tries++;
    const delta = ri(-spread, spread);
    if (delta === 0) continue;
    const w = answer + delta;
    if (!allowNegative && w < 0) continue;
    if (w !== answer) wrong.add(w);
  }
  // Guarantee four options even when the non-negative window is tight.
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
  let tries = 0;
  while (wrong.size < 3 && tries < 300) {
    tries++;
    const delta = ri(1, 4) * step * (Math.random() < 0.5 ? 1 : -1);
    const w = round(answer + delta);
    if (!allowNegative && w < 0) continue;
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

  // Top up with plausible near-misses so there are always four options.
  const spread = Math.abs(answer) <= 15 ? 2 : Math.abs(answer) <= 100 ? 7 : Math.abs(answer) <= 1000 ? 25 : 100;
  let guard = 0;
  while (chosen.length < 3 && guard < 400) {
    guard++;
    const delta = ri(-spread, spread);
    if (delta === 0) continue;
    const candidate = answer + delta;
    if (!allowNegative && candidate < 0) continue;
    if (candidate === answer || chosen.includes(candidate)) continue;
    chosen.push(candidate);
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
