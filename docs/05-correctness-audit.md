# 05 · Correctness Audit

This document reports the results of **fuzzing the question generators**. The
generator layer is pure and framework-free, so it was bundled with esbuild and
executed directly in Node — no React Native mocking required.

**Scale of the run:** 21 categories × 6 classes × 3 difficulties × 4,000
iterations, plus 12 tables × 300 iterations ≈ **1.4 million generated
questions**.

---

## Summary of findings

| ID | Finding | Occurrences | Severity |
|----|---------|-------------|----------|
| [F1](#f1) | True/false questions produce only 2 choices | ~2,924 | 🟠 High |
| [F2](#f2) | Float precision artifact shown as the answer | ~100 / 3,000 | 🟠 High |
| [F3](#f3) | Non-integer answers in integer-styled questions | ~2,100 | 🟡 Medium |
| [F4](#f4) | Difficulty is non-monotonic in 6 of 24 cells | 6 cells | 🟡 Medium |
| [F5](#f5) | Class 1–2 division generates 3-digit dividends | latent | 🟡 Medium |
| [F6](#f6) | Negative distractors offered to 6-year-olds | 24.1% | 🟡 Medium |
| [F7](#f7) | Timeout drops `resolvedCategory` in Mixed mode | all timeouts | 🟡 Medium |
| [F8](#f8) | No duplicate-question protection within a session | — | 🟢 Low |

**What passed.** These invariants held across all 1.4 M questions:

- ✅ The correct answer is always present among the choices — **0 failures**
- ✅ No `NaN`, `Infinity` or `undefined` in question text or choices — **0**
- ✅ No duplicate choices within one question — **0**
- ✅ No generator threw an exception — **0**
- ✅ Arithmetic is *semantically correct*: re-deriving `a+b`, `a−b`, `a×b`,
  `a÷b` from the rendered text matched the stated answer in every case — **0
  mismatches**
- ✅ Tables mode always returns exactly 12 questions with valid choices

The generators are **logically sound**. The findings below are presentation
and calibration defects, not broken maths.

---

<a id="f1"></a>
## F1 · 🟠 True/false questions produce only 2 choices

Also documented as [C7](./04-critical-issues.md#c7).

```
[2659] CHOICE_COUNT_2 | 4th | factors | easy
   Is 4 a prime number?                            choices=["No","Yes"]
   Is 14 a prime number?                           choices=["Yes","No"]
   Is 14 a prime number?                           choices=["Yes","No"]

[265]  CHOICE_COUNT_2 | 4th | mixed | easy
   Is 4 a prime number?                            choices=["No","Yes"]
   Is 7 a prime number? (prime = only 2 factors)   choices=["Yes","No"]
```

The UI renders a 2×2 grid and expects 4 choices; these questions leave it
half-empty and reduce a guess from 25% to 50%.

**Root cause** — `makeStrChoices` can only return as many options as the pool
contains, and the prime-check generators pass a 2-element pool:

```ts
choices: makeStrChoices('Yes', ['Yes', 'No'])
```

**Fix:** see [C7](./04-critical-issues.md#c7).

---

<a id="f2"></a>
## F2 · 🟠 Float precision artifact shown as the answer

Also documented as [C8](./04-critical-issues.md#c8).

```
[51] FLOAT_ARTIFACT | 6th | ratio | hard
   Share €55 in ratio 5:6.  Larger share = €?  =>  29.999999999999996
   Share €55 in ratio 6:5.  Larger share = €?  =>  29.999999999999996

[49] FLOAT_ARTIFACT | 5th | ratio | hard
   Share €55 in ratio 5:6.  Larger share = €?  =>  29.999999999999996
```

`6 / 11 * 55` evaluates to `29.999999999999996` in IEEE-754. Because the UI
compares and renders `String(answer)`, the learner is literally shown
`29.999999999999996` as a money amount.

**Fix:** multiply before dividing and round —
`Math.round((Math.max(a,b) * total) / (a + b))`.

---

<a id="f3"></a>
## F3 · 🟡 Non-integer answers in integer-styled questions

Two families of questions return `x.5` values while presenting as whole-number
problems:

### Triangle area — `.5` is inherent

```
[245] NON_INT_ANSWER | 6th | geometry | medium
   Area of a triangle, base 13, height 9: (½ × base × height) = ?   ans=58.5
   Area of a triangle, base 11, height 7: (½ × base × height) = ?   ans=38.5
[231] NON_INT_ANSWER | 4th | geometry | medium
   Area of a triangle, base 9,  height 7: (½ × base × height) = ?   ans=31.5
```

When `base × height` is odd, the area is a half-integer. Mathematically correct
but pedagogically awkward for Class 4, and `makeIntChoices` generates integer
distractors around a `.5` answer — making the correct option trivially
identifiable as "the only one with a decimal point".

**Fix:** force an even product.

```diff
- const b = ri(4, 14); const h = ri(3, 10);
+ const b = ri(2, 7) * 2;          // always even → area is always an integer
+ const h = ri(3, 10);
```

(The `hard` branch already does this: `const b = ri(4,16)*2; const h = ri(4,12)*2;`.)

### Percentages — `.5` from odd bases

```
[444] NON_INT_ANSWER | 5th | percentages | hard
   15% of 50 = ?          ans=7.5
   35% of 50 = ?          ans=17.5
[431] NON_INT_ANSWER | 6th | percentages | hard
   45% of 50 = ?          ans=22.5
   Increase 50 by 25% = ? ans=62.5
[247] NON_INT_ANSWER | 5th | percentages | medium
   25% of 50 = ?          ans=12.5
   75% of 50 = ?          ans=37.5
```

**Fix:** choose the base so the result divides cleanly.

```ts
const pct  = pick([10, 20, 25, 40, 50, 60, 75, 80]);
const step = 100 / gcd(pct, 100);       // smallest base giving an integer
const base = step * ri(1, Math.floor(200 / step));
const answer = (pct * base) / 100;      // guaranteed integer
```

Note the same generators already contain a correct example — `genWordProblems`
hard branch does exactly this:

```ts
const p = pick([10, 20, 25, 50]); const divisor = 100 / p;
const n = divisor * ri(2, Math.floor(200 / divisor));
```

So the fix is to apply an existing in-repo idiom consistently.

---

<a id="f4"></a>
## F4 · 🟡 Difficulty is non-monotonic in 6 of 24 cells

Measured as the **mean largest operand** over 2,000 samples per cell. Easy
should be ≤ medium should be ≤ hard.

```
class cat              easy    med   hard
─────────────────────────────────────────────────────────────
1st   addition            3      6      8
1st   subtraction         6     13     12   ← NOT MONOTONIC
1st   multiplication      3      4      4
1st   division          197    453    808   ← see F5
2nd   addition           28     32     47
2nd   subtraction        41     38     48   ← NOT MONOTONIC
2nd   multiplication      7      7      7   ← flat: no progression
2nd   division          199    453    810   ← see F5
3rd   addition           44     51    316
3rd   subtraction        50     64    302
3rd   multiplication      6      7     10
3rd   division           11     22     36
4th   addition          318    462    748
4th   subtraction       299    300    296   ← NOT MONOTONIC (flat)
4th   multiplication      8     18     21
4th   division           32     50     87
5th   addition          472    749   3161
5th   subtraction      1247   1241   1261   ← NOT MONOTONIC (flat)
5th   multiplication      9     21     20   ← NOT MONOTONIC
5th   division           60     93    204
6th   addition         1887   3087   6083
6th   subtraction      3007   3010   3016   ← flat
6th   multiplication     31     60     40   ← NOT MONOTONIC
6th   division          203    449    803
```

### Cause A — subtraction ignores difficulty for Class 4+

```ts
case '4th': a = ri(100, 499); b = ri(10, Math.floor(a * 0.7)); break;
case '5th': a = ri(500, 1999); b = ri(100, Math.floor(a * 0.6)); break;
default:    a = ri(1000, 4999); b = ri(200, Math.floor(a * 0.7)); break;
```

There is **no `diff` branch at all** — easy, medium and hard are identical.
Classes 1–3 do vary by difficulty; 4–6 do not.

### Cause B — Class 5/6 multiplication hard is *narrower* than medium

```ts
case '5th':
  [a, b] = diff === 'easy'   ? [ri(2, 12),  ri(2, 12)]
         : diff === 'medium' ? [ri(12, 30), ri(2, 9)]     // max operand 30
         :                     [ri(11, 25), ri(11, 25)];  // max operand 25  ← lower!
default: // 6th
  [a, b] = diff === 'easy'   ? [ri(12, 50), ri(2, 12)]
         : diff === 'medium' ? [ri(20, 99), ri(2, 12)]    // max operand 99
         :                     [ri(20, 50), ri(20, 50)];  // max operand 50  ← lower!
```

By *largest operand* hard is easier; by *product* it is harder
(25×25=625 vs 30×9=270). So the metric is arguably measuring the wrong thing —
but the inconsistency between the two definitions is itself the problem, and
Class 2 multiplication is genuinely flat at 7/7/7.

### Cause C — Class 1 subtraction

```ts
case '1st':
  a = diff === 'easy' ? ri(2, 10) : ri(5, 20);   // medium and hard identical
  b = ri(1, a - 1);
```

Medium and hard use the same range; the 13-vs-12 difference is sampling noise.

### Fix

Add explicit difficulty branches to Class 4–6 subtraction, widen Class 2
multiplication, and make Class 5/6 multiplication monotonic on *product*:

```ts
// subtraction, class 4
case '4th':
  a = diff === 'easy' ? ri(100, 299) : diff === 'medium' ? ri(300, 699) : ri(700, 999);
  b = ri(10, Math.floor(a * 0.7));
  break;
```

Then add a **regression test** asserting monotonicity — see
[07-testing-strategy.md](./07-testing-strategy.md#difficulty-monotonicity).

---

<a id="f5"></a>
## F5 · 🟡 Class 1–2 division generates 3-digit dividends

```console
1st/easy: 70 ÷ 5 = ?   145 ÷ 5 = ?   345 ÷ 15 = ?   150 ÷ 5 = ?   297 ÷ 11 = ?
2nd/easy: 125 ÷ 5 = ?  216 ÷ 8 = ?   260 ÷ 13 = ?   126 ÷ 6 = ?   336 ÷ 14 = ?
```

Six-year-olds being asked `345 ÷ 15`.

### Cause

`genDivision`'s switch has **no case for `'1st'` or `'2nd'`** — they fall
through to `default`, which is the Class-6 branch:

```ts
switch (cls) {
  case '3rd': /* … */ break;
  case '4th': /* … */ break;
  case '5th': /* … */ break;
  default:                       // ← 1st and 2nd land here
    [dividend, divisor, quotient] = diff === 'easy'
      ? mkDiv(5, 15, 10, 30) : /* … */;
}
```

### Mitigating factor — currently unreachable

```console
$ node -e "…"
division in CLASS_TOPICS['1st']:  false
division in CLASS_TOPICS['2nd']:  false
```

Division is not offered to Classes 1–2, and the `mixed` branch filters to
`getAvailableCategories(cls)`. So **no user can currently reach this**. It is a
latent trap: the day someone adds `'division'` to a Class 2 topic list, Class 2
learners get Class 6 division.

The same structural risk exists in `genMultiplication`, whose `default` branch
serves Class 6 — Class 1 is explicitly handled there, so it is safer, but the
pattern is the same.

### Fix

Replace `default:` with explicit exhaustive cases so TypeScript enforces
coverage:

```ts
case '1st':
case '2nd':
  // Not in the curriculum, but must be safe if ever enabled:
  [dividend, divisor, quotient] = mkDiv(2, 5, 1, 5);
  break;
case '6th':
  [dividend, divisor, quotient] = /* … */;
  break;
// no `default` → adding a class to SchoolClass becomes a compile error
```

---

<a id="f6"></a>
## F6 · 🟡 Negative distractors offered to 6-year-olds

```console
1st/easy/subtraction: 24.1% of questions offer a NEGATIVE distractor
```

Nearly a quarter of Class 1 easy subtraction questions include an answer option
below zero — a concept not introduced until Class 6 (`integers`).

### Cause

`makeIntChoices` applies a symmetric delta with no floor:

```ts
export function makeIntChoices(answer: number): number[] {
  const spread = Math.abs(answer) <= 15 ? 2 : /* … */;
  const wrong = new Set<number>();
  while (wrong.size < 3 && tries < 300) {
    const delta = ri(-spread, spread);
    if (delta === 0) continue;
    wrong.add(answer + delta);          // ← can go negative
  }
  return shuffleArr([answer, ...Array.from(wrong)]);
}
```

For `answer = 1`, spread 2 → candidates include `-1`.

Interestingly, `mistake-review.tsx` **already solves this** in its own local
choice generator:

```ts
// Keep distractors non-negative for simple questions
if (candidate < 0 && num >= 0 && magnitude < 30) continue;
```

The guard exists in the app but not in the shared helper — two independent
choice generators have diverged.

### Fix

Add an options parameter to the shared helper and delete the duplicate in
`mistake-review.tsx`:

```ts
export function makeIntChoices(answer: number, opts: { allowNegative?: boolean } = {}): number[] {
  const allowNegative = opts.allowNegative ?? answer < 0;
  /* … */
    const w = answer + delta;
    if (!allowNegative && w < 0) continue;
    if (w !== answer) wrong.add(w);
  /* … */
}
```

Callers in `genIntegers` pass `{ allowNegative: true }`.

---

<a id="f7"></a>
## F7 · 🟡 Timeout drops `resolvedCategory` in Mixed mode

Same as [C12](./04-critical-issues.md#c12). Included here because it corrupts
the accuracy data this audit relies on.

```ts
// answer path — correct
saveProgressStats(correct, currentQuestion.resolvedCategory);

// timeout path — loses the resolved category, records against 'mixed'
saveProgressStats(false);
```

A timed-out question is also never added to `wrongAnswers`, so it cannot appear
in Mistake Review.

---

<a id="f8"></a>
## F8 · 🟢 No duplicate-question protection

`startGame` generates independently:

```ts
setQuestions(Array.from({ length: count }, () => generateQuestion(cls, diff, cat)));
```

Nothing prevents repeats. For small question spaces this is very likely:

| Cell | Distinct questions | P(≥1 duplicate in 10) |
|------|-------------------|----------------------|
| 1st / easy / addition (`ri(1,4) + ri(1,4)`) | 16 | ~97% |
| 1st / easy / subtraction | ~45 | ~65% |
| 2nd / easy / multiplication (`[2,5,10] × 1–10`) | 30 | ~81% |

### Fix

Deduplicate on `questionText` with a bounded retry:

```ts
function generateUnique(cls, diff, cat, count) {
  const out: Question[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (out.length < count && guard < count * 30) {
    guard++;
    const q = generateQuestion(cls, diff, cat);
    if (seen.has(q.questionText)) continue;   // small spaces will exhaust the guard
    seen.add(q.questionText);
    out.push(q);
  }
  while (out.length < count) out.push(generateQuestion(cls, diff, cat));  // accept repeats
  return out;
}
```

The guard matters: with only 16 possible questions, requesting 20 unique ones
would loop forever.

---

<a id="harness"></a>
## Reproducing this audit

The generators are pure, so the harness is short. From the repo root:

```bash
mkdir -p /tmp/audit && cd /tmp/audit
cp -r <repo>/artifacts/mobile/generators .
npm i -D esbuild@0.27.3
npx esbuild generators/index.ts --bundle --format=esm --outfile=gen.mjs
node fuzz.mjs
```

### `fuzz.mjs` — invariant checks

```js
import { generateQuestion, getAvailableCategories, generateTablesQuestions } from './gen.mjs';

const CLASSES = ['1st','2nd','3rd','4th','5th','6th'];
const DIFFS   = ['easy','medium','hard'];
const N = 4000;
const issues = new Map();
const log = (k, d) => {
  if (!issues.has(k)) issues.set(k, { count: 0, samples: [] });
  const e = issues.get(k); e.count++;
  if (e.samples.length < 3) e.samples.push(d);
};

for (const cls of CLASSES) {
  for (const cat of getAvailableCategories(cls)) {
    if (cat === 'tables') continue;
    for (const diff of DIFFS) {
      for (let i = 0; i < N; i++) {
        let q;
        try { q = generateQuestion(cls, diff, cat); }
        catch (e) { log(`THROW|${cls}|${cat}|${diff}`, e.message); continue; }
        const tag = `${cls}|${cat}|${diff}`;

        if (!q.choices.some(c => String(c) === String(q.answer)))
          log(`ANSWER_NOT_IN_CHOICES|${tag}`, q.questionText);
        if (q.choices.length !== 4)
          log(`CHOICE_COUNT_${q.choices.length}|${tag}`, q.questionText + ' ' + JSON.stringify(q.choices));
        if (new Set(q.choices.map(String)).size !== q.choices.length)
          log(`DUPLICATE_CHOICES|${tag}`, q.questionText);
        if (typeof q.answer === 'number' && !Number.isFinite(q.answer))
          log(`NAN_ANSWER|${tag}`, q.questionText);
        if (/NaN|undefined|Infinity/.test(q.questionText))
          log(`BAD_TEXT|${tag}`, q.questionText);
      }
    }
  }
}

for (const [k, v] of [...issues].sort((a, b) => b[1].count - a[1].count))
  console.log(`[${v.count}] ${k}\n   ` + v.samples.join('\n   '));
```

### `fuzz2.mjs` — semantic verification & difficulty curve

```js
// Re-derive the arithmetic from the rendered question text.
const reAdd = /^(-?\d+) \+ (-?\d+) = \?$/;
const reMul = /^(-?\d+) × (-?\d+) = \?$/;
// … then compare against q.answer.  Result: 0 mismatches.

// Measure difficulty progression.
for (const cls of CLASSES) for (const cat of ['addition','subtraction','multiplication','division'])
  for (const diff of DIFFS) {
    let sum = 0;
    for (let i = 0; i < 2000; i++) {
      const q = generateQuestion(cls, diff, cat);
      sum += Math.max(...(q.questionText.match(/\d+/g) || []).map(Number), 0);
    }
    console.log(cls, cat, diff, Math.round(sum / 2000));
  }
```

These checks are the natural basis for the property-based test suite proposed
in [07-testing-strategy.md](./07-testing-strategy.md).
