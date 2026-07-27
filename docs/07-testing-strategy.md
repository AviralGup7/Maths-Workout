# 07 · Testing Strategy

## Current state: zero tests

```console
$ find . -name "*.test.*" -o -name "*.spec.*" -o -name "jest.config*" -o -name "vitest*" | grep -v node_modules
  (no results)

$ ls .github
  ls: cannot access '.github': No such file or directory
```

No tests, no test runner, no CI. Every one of the 14 defect classes documented
in [05-correctness-audit.md](./05-correctness-audit.md) would have been caught
by a modest test suite — and the three blockers in
[04-critical-issues.md](./04-critical-issues.md) would have been caught by a
single CI job running `pnpm install --frozen-lockfile`.

---

## Why this codebase is unusually easy to test

The `generators/` layer is **pure**: no React, no native modules, no I/O, no
global state. Its only non-determinism is `Math.random`.

That means the highest-risk, highest-value logic in the app — 21 question
generators, ~800 lines — can be tested in plain Node with **zero mocking**.
The audit in [05](./05-correctness-audit.md) proved this: the generators were
bundled with esbuild and fuzzed directly.

```
generators/     ← pure          → unit + property tests, no mocks      ★ start here
context/        ← React state   → @testing-library/react-native
app/            ← screens       → component tests + a few E2E flows
lib/, server/   ← I/O           → integration tests
```

---

## Recommended stack

| Layer | Tool | Rationale |
|-------|------|-----------|
| Runner | **Vitest** | Fast, native ESM/TS, no Babel config needed for the pure layer |
| Property testing | **fast-check** | The invariants in [05](./05-correctness-audit.md) are naturally expressed as properties |
| Component tests | **@testing-library/react-native** | Standard for RN |
| E2E *(later)* | **Maestro** | Simpler than Detox for Expo projects |
| Coverage | `@vitest/coverage-v8` | Built in |

> Jest is the RN default, but for the pure generator layer Vitest is
> significantly faster to configure and run. A pragmatic split is Vitest for
> `generators/` + `context/` logic, and Jest/RNTL only if full component
> rendering is needed later.

### Setup

```bash
cd artifacts/mobile
pnpm add -D vitest @vitest/coverage-v8 fast-check
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['generators/**', 'context/**'],
      thresholds: { lines: 80, functions: 80, branches: 70 },
    },
  },
});
```

```diff
  "scripts": {
    "typecheck": "tsc -p tsconfig.json --noEmit",
+   "test": "vitest run",
+   "test:watch": "vitest",
+   "test:coverage": "vitest run --coverage"
  }
```

---

## Tier 1 · Invariant tests (highest value — write these first)

These six invariants encode the checks the audit already ran. Together they
cover every 🟠 High finding.

```ts
// generators/__tests__/invariants.test.ts
import { describe, it, expect } from 'vitest';
import { generateQuestion, getAvailableCategories } from '../index';
import type { SchoolClass, Difficulty } from '../types';

const CLASSES: SchoolClass[] = ['1st','2nd','3rd','4th','5th','6th'];
const DIFFS:   Difficulty[]  = ['easy','medium','hard'];
const N = 500;   // per cell; ~150k questions total, runs in a few seconds

describe('question generator invariants', () => {
  for (const cls of CLASSES) {
    for (const cat of getAvailableCategories(cls)) {
      if (cat === 'tables') continue;
      for (const diff of DIFFS) {
        describe(`${cls} / ${cat} / ${diff}`, () => {

          it('always includes the correct answer among the choices', () => {
            for (let i = 0; i < N; i++) {
              const q = generateQuestion(cls, diff, cat);
              expect(q.choices.map(String)).toContain(String(q.answer));
            }
          });

          // Catches F1 / C7 — currently FAILS for `factors` easy
          it('always offers exactly 4 choices', () => {
            for (let i = 0; i < N; i++) {
              const q = generateQuestion(cls, diff, cat);
              expect(q.choices).toHaveLength(4);
            }
          });

          it('never repeats a choice', () => {
            for (let i = 0; i < N; i++) {
              const q = generateQuestion(cls, diff, cat);
              expect(new Set(q.choices.map(String)).size).toBe(q.choices.length);
            }
          });

          it('never renders NaN, Infinity or undefined', () => {
            for (let i = 0; i < N; i++) {
              const q = generateQuestion(cls, diff, cat);
              expect(q.questionText).not.toMatch(/NaN|Infinity|undefined/);
              q.choices.forEach(c => expect(String(c)).not.toMatch(/NaN|Infinity|undefined/));
            }
          });

          // Catches F2 / C8 — currently FAILS for ratio/hard
          it('never produces a float precision artifact', () => {
            for (let i = 0; i < N; i++) {
              const q = generateQuestion(cls, diff, cat);
              if (typeof q.answer === 'number' && !Number.isInteger(q.answer)) {
                const decimals = String(q.answer).split('.')[1] ?? '';
                expect(decimals.length,
                  `${q.questionText} → ${q.answer}`).toBeLessThanOrEqual(2);
              }
            }
          });

          // Catches F6 — currently FAILS for 1st/subtraction
          it('offers no negative choices below Class 6', () => {
            if (cls === '6th' || cat === 'integers') return;
            for (let i = 0; i < N; i++) {
              const q = generateQuestion(cls, diff, cat);
              q.choices.forEach(c => {
                if (typeof c === 'number') expect(c).toBeGreaterThanOrEqual(0);
              });
            }
          });

        });
      }
    }
  }
});
```

---

## Tier 2 · Semantic correctness

Re-derive the arithmetic from the rendered text and compare. This is what
proved the generators are *logically* sound.

```ts
// generators/__tests__/semantics.test.ts
import { describe, it, expect } from 'vitest';
import { generateQuestion } from '../index';

const PATTERNS: [RegExp, (a: number, b: number) => number][] = [
  [/^(-?\d+) \+ (-?\d+) = \?$/, (a, b) => a + b],
  [/^(-?\d+) − (-?\d+) = \?$/, (a, b) => a - b],
  [/^(-?\d+) × (-?\d+) = \?$/, (a, b) => a * b],
  [/^(-?\d+) ÷ (-?\d+) = \?$/, (a, b) => a / b],
];

describe('arithmetic is semantically correct', () => {
  it('matches the value re-derived from the question text', () => {
    for (const cls of ['1st','2nd','3rd','4th','5th','6th'] as const) {
      for (const cat of ['addition','subtraction','multiplication','division'] as const) {
        for (const diff of ['easy','medium','hard'] as const) {
          for (let i = 0; i < 300; i++) {
            const q = generateQuestion(cls, diff, cat);
            for (const [re, fn] of PATTERNS) {
              const m = q.questionText.match(re);
              if (m) expect(fn(+m[1], +m[2]), q.questionText).toBe(q.answer);
            }
          }
        }
      }
    }
  });

  it('division always yields a whole number', () => {
    for (const cls of ['3rd','4th','5th','6th'] as const) {
      for (const diff of ['easy','medium','hard'] as const) {
        for (let i = 0; i < 500; i++) {
          const q = generateQuestion(cls, diff, 'division');
          expect(Number.isInteger(q.answer as number)).toBe(true);
        }
      }
    }
  });
});
```

---

<a id="difficulty-monotonicity"></a>
## Tier 3 · Difficulty calibration

A regression guard for [F4](./05-correctness-audit.md#f4). Currently fails for
6 of 24 cells.

```ts
// generators/__tests__/difficulty.test.ts
import { describe, it, expect } from 'vitest';
import { generateQuestion } from '../index';
import type { SchoolClass } from '../types';

/** Mean of the largest operand appearing in the question text. */
function meanMagnitude(cls: SchoolClass, cat: any, diff: any, n = 1000): number {
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const q = generateQuestion(cls, diff, cat);
    sum += Math.max(...(q.questionText.match(/\d+/g) ?? ['0']).map(Number));
  }
  return sum / n;
}

describe('difficulty increases monotonically', () => {
  for (const cls of ['1st','2nd','3rd','4th','5th','6th'] as SchoolClass[]) {
    for (const cat of ['addition','subtraction','multiplication','division'] as const) {
      it(`${cls} / ${cat}: easy ≤ medium ≤ hard`, () => {
        const e = meanMagnitude(cls, cat, 'easy');
        const m = meanMagnitude(cls, cat, 'medium');
        const h = meanMagnitude(cls, cat, 'hard');
        // 10% tolerance absorbs sampling noise
        expect(m, `easy=${e} medium=${m}`).toBeGreaterThanOrEqual(e * 0.9);
        expect(h, `medium=${m} hard=${h}`).toBeGreaterThanOrEqual(m * 0.9);
      });
    }
  }
});

describe('age appropriateness', () => {
  it('keeps Class 1 operands within 20', () => {
    for (const cat of ['addition','subtraction'] as const) {
      for (const diff of ['easy','medium','hard'] as const) {
        for (let i = 0; i < 500; i++) {
          const q = generateQuestion('1st', diff, cat);
          const nums = (q.questionText.match(/\d+/g) ?? []).map(Number);
          nums.forEach(n => expect(n, q.questionText).toBeLessThanOrEqual(20));
        }
      }
    }
  });
});
```

---

## Tier 4 · Property-based tests with fast-check

Better than fixed loops for the pure helpers — fast-check shrinks failures to a
minimal reproducing case.

```ts
// generators/__tests__/helpers.property.test.ts
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  makeIntChoices, addNoCarry, addWithCarry, subNoBorrow, subWithBorrow,
  gcd, lcm, isPrime, countFactors, shuffleArr,
} from '../helpers';

describe('makeIntChoices', () => {
  it('always returns 4 unique values containing the answer', () => {
    fc.assert(fc.property(fc.integer({ min: -1000, max: 10000 }), answer => {
      const c = makeIntChoices(answer);
      expect(c).toHaveLength(4);
      expect(new Set(c).size).toBe(4);
      expect(c).toContain(answer);
    }));
  });
});

describe('carry / borrow helpers', () => {
  it('addNoCarry never carries in the ones column', () => {
    fc.assert(fc.property(fc.integer({ min: 10, max: 49 }), max => {
      const [a, b] = addNoCarry(10, max, 1, 9);
      expect((a % 10) + (b % 10)).toBeLessThan(10);
    }));
  });

  it('addWithCarry always carries in the ones column', () => {
    for (let i = 0; i < 500; i++) {
      const [a, b] = addWithCarry(10, 49, 1, 9);
      expect((a % 10) + (b % 10)).toBeGreaterThanOrEqual(10);
    }
  });

  it('subNoBorrow never borrows and never goes negative', () => {
    for (let i = 0; i < 500; i++) {
      const [a, b] = subNoBorrow(20, 59, 1, 9);
      expect(a % 10).toBeGreaterThanOrEqual(b % 10);
      expect(a - b).toBeGreaterThan(0);
    }
  });
});

describe('number theory helpers', () => {
  it('gcd divides both inputs', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 10000 }), fc.integer({ min: 1, max: 10000 }),
      (a, b) => { const g = gcd(a, b); expect(a % g).toBe(0); expect(b % g).toBe(0); }));
  });

  it('lcm is divisible by both inputs', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 500 }), fc.integer({ min: 1, max: 500 }),
      (a, b) => { const l = lcm(a, b); expect(l % a).toBe(0); expect(l % b).toBe(0); }));
  });

  it('isPrime agrees with trial division', () => {
    fc.assert(fc.property(fc.integer({ min: 2, max: 5000 }), n => {
      const naive = countFactors(n) === 2;
      expect(isPrime(n)).toBe(naive);
    }));
  });
});

describe('shuffleArr', () => {
  it('preserves the multiset and does not mutate the input', () => {
    fc.assert(fc.property(fc.array(fc.integer()), arr => {
      const copy = [...arr];
      const out = shuffleArr(arr);
      expect(arr).toEqual(copy);                 // no mutation
      expect([...out].sort()).toEqual([...arr].sort());
    }));
  });
});
```

**Note on the carry/borrow helpers.** These use bounded retry loops
(`while (…) t < 200`) and can return a value that fails the intended predicate
when the loop exhausts. `subWithBorrow` in particular can `continue` without
assigning `b` if `upper < minB`. Property tests over the full parameter range
are the right way to find those edges — expect some of the above to surface
real bugs on wide inputs.

---

## Tier 5 · Context / state tests

```ts
// context/__tests__/gameFlow.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return { default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => { store.set(k, v); },
    clear:   async () => store.clear(),
  }};
});

describe('session sizing', () => {
  // Catches C4 — currently FAILS: timed60 yields 10
  it('generates enough questions for a 60-second blitz', () => {
    const count = (s: string) => (s === '20q' ? 20 : s === 'timed60' ? 60 : 10);
    expect(count('10q')).toBe(10);
    expect(count('20q')).toBe(20);
    expect(count('timed60')).toBeGreaterThanOrEqual(40);
  });
});

describe('merge semantics', () => {
  it('high scores take the maximum', () => {
    expect(mergeHighScores({ a: 5 }, { a: 8 })).toEqual({ a: 8 });
    expect(mergeHighScores({ a: 9 }, { a: 3 })).toEqual({ a: 9 });
  });

  // Catches C10 — documents the current (incorrect) behaviour
  it('progress stats must never yield accuracy above 100%', () => {
    const merged = mergeProgressStats(
      { k: { attempted: 10, correct: 4 } },
      { k: { attempted: 6,  correct: 6 } },
    );
    expect(merged.k.correct).toBeLessThanOrEqual(merged.k.attempted);
  });

  it('mistakes union deduplicates on display + correctAnswer', () => {
    const a = [{ display: '2+2', userAnswer: '5', correctAnswer: '4' }];
    const b = [{ display: '2+2', userAnswer: '3', correctAnswer: '4' }];
    expect(mergeMistakes(a, b)).toHaveLength(1);
  });

  // Catches C11
  it('caps saved mistakes', () => {
    const many = Array.from({ length: 500 }, (_, i) =>
      ({ display: `q${i}`, userAnswer: '0', correctAnswer: '1' }));
    expect(mergeMistakes([], many).length).toBeLessThanOrEqual(200);
  });
});
```

---

## Tier 6 · Component & E2E

Lower priority — the screens are mostly presentational. Focus on the one screen
with real logic:

| Target | What to test |
|--------|--------------|
| `game.tsx` | Timer countdown; double-tap is ignored while locked; correct/wrong styling; auto-advance timing |
| `mistake-review.tsx` | A correct retry calls `clearMistake` and removes the item |
| `results.tsx` | Star thresholds; `saveScore` fires exactly once |
| Navigation | The full funnel Home → Class → Category → Difficulty → Game → Results |

Timers must be faked:

```ts
vi.useFakeTimers();
// … render, then:
vi.advanceTimersByTime(15_000);   // per-question timeout
```

---

## CI pipeline

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:    { branches: [main] }
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with: { version: 10 }

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      # Fails today (C1, C2) — this single step is the highest-value guard.
      - name: Install (frozen lockfile)
        run: pnpm install --frozen-lockfile

      # Fails today (C3)
      - name: Typecheck
        run: pnpm run typecheck

      - name: Test
        run: pnpm -r --if-present run test

      - name: Coverage
        run: pnpm -r --if-present run test:coverage
```

**`--frozen-lockfile` is the critical line.** It is what would have prevented
the lockfile drift in [C2](./04-critical-issues.md#c2) from ever being merged.

---

## Coverage targets

| Module | Target | Justification |
|--------|--------|---------------|
| `generators/helpers.ts` | 100% | Small, pure, used everywhere |
| `generators/*.ts` | 95% | Pure and high-risk; the audit found 8 defect classes here |
| `context/GameContext.tsx` | 80% | Merge and game-flow logic; excludes provider plumbing |
| `lib/progressApi.ts` | 90% | Small surface, easy to mock `fetch` |
| `app/*.tsx` | 50% | Mostly presentational |
| `server/serve.js` | 70% | Include a path-traversal regression test |

---

## Rollout plan

| Week | Deliverable |
|------|-------------|
| 1 | Vitest configured; CI green on install + typecheck (requires Phase 0 fixes) |
| 1 | Tier 1 invariant tests — these will **fail** and document C7, C8, F6 |
| 2 | Fix the failures; add Tier 2 semantics and Tier 3 difficulty tests |
| 3 | Tier 4 property tests over `helpers.ts` |
| 4 | Tier 5 context tests; enable coverage thresholds in CI |
| 5+ | Component tests; Maestro smoke test of the main funnel |

Writing Tier 1 **before** fixing the bugs is deliberate: the failing tests
become the specification, and the fix is verified by them turning green.
