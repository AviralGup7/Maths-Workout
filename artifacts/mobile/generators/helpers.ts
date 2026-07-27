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

export function makeIntChoices(answer: number): number[] {
  const spread = Math.abs(answer) <= 15 ? 2 : Math.abs(answer) <= 100 ? 7 : Math.abs(answer) <= 1000 ? 25 : 100;
  const wrong = new Set<number>();
  let tries = 0;
  while (wrong.size < 3 && tries < 300) {
    tries++;
    const delta = ri(-spread, spread);
    if (delta === 0) continue;
    const w = answer + delta;
    if (w !== answer) wrong.add(w);
  }
  return shuffleArr([answer, ...Array.from(wrong)]);
}

export function makeDecChoices(answer: number, step = 0.1): number[] {
  const round = (n: number) => Math.round(n * 100) / 100;
  const wrong = new Set<number>();
  let tries = 0;
  while (wrong.size < 3 && tries < 300) {
    tries++;
    const delta = ri(1, 4) * step * (Math.random() < 0.5 ? 1 : -1);
    const w = round(answer + delta);
    if (w !== answer) wrong.add(w);
  }
  return shuffleArr([answer, ...Array.from(wrong)]);
}

export function makeStrChoices(answer: string, pool: string[]): string[] {
  const others = shuffleArr(pool.filter(x => x !== answer)).slice(0, 3);
  return shuffleArr([answer, ...others]);
}
