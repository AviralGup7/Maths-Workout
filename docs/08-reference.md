# 08 · Reference

Quick-lookup reference for the codebase: types, APIs, storage, configuration
and terminology.

---

## 1. Core types

From `generators/types.ts`:

```ts
export type SchoolClass = '1st' | '2nd' | '3rd' | '4th' | '5th' | '6th';
export type Difficulty  = 'easy' | 'medium' | 'hard';
export type Operation   = '+' | '-' | '×' | '÷';
export type ChoiceValue = number | string;
export type SessionType = '10q' | '20q' | 'timed60';

export type Category =
  | 'addition' | 'subtraction' | 'multiplication' | 'division' | 'mixed' | 'tables'
  | 'counting' | 'number_sense' | 'shapes' | 'time' | 'money'
  | 'place_value' | 'measurement' | 'fractions' | 'word_problems'
  | 'decimals' | 'factors' | 'geometry' | 'percentages'
  | 'data' | 'ratio' | 'integers' | 'algebra';

export interface Question {
  questionText: string;
  answer: ChoiceValue;
  choices: ChoiceValue[];
  /** Actual category used when 'mixed' was selected */
  resolvedCategory?: Category;
}

export interface WrongAnswer {
  display: string;        // the question text
  userAnswer: string;
  correctAnswer: string;
}

export interface StatEntry { attempted: number; correct: number; }
export type ProgressStats = Record<string, StatEntry>;   // key: `${cls}_${cat}_${diff}`

export interface ClassConfig {
  key: SchoolClass;
  label: string;
  ageRange: string;
  color: string;
}
```

**Note.** `Operation` is declared but never used anywhere in the codebase —
safe to remove.

---

## 2. Generator API

### Dispatcher

```ts
generateQuestion(cls: SchoolClass, diff: Difficulty, cat: Category): Question
```

Throws if `cat === 'tables'` — that mode uses a separate entry point.
`cat === 'mixed'` recurses once into a randomly chosen concrete category and
tags the result with `resolvedCategory`.

```ts
generateTablesQuestions(tableNum: number): Question[]
```

Returns exactly 12 shuffled questions for `tableNum × 1..12`.

```ts
getAvailableCategories(cls: SchoolClass): Category[]
```

### Individual generators

All share the signature `(cls: SchoolClass, diff: Difficulty) => Question`.

| Module | Exports |
|--------|---------|
| `arithmetic.ts` | `genAddition`, `genSubtraction`, `genMultiplication`, `genDivision`, `generateTablesQuestions` |
| `early-years.ts` | `genCounting`, `genNumberSense` |
| `topics-core.ts` | `genShapes`, `genTime`, `genMoney`, `genPlaceValue`, `genMeasurement` |
| `fractions-decimals.ts` | `genFractions`, `genDecimals` |
| `advanced.ts` | `genWordProblems`, `genFactors`, `genGeometry`, `genPercentages`, `genData`, `genRatio`, `genIntegers`, `genAlgebra` |

21 generators for 23 declared categories — `mixed` and `tables` are handled by
the dispatcher rather than by a generator.

### Helpers (`helpers.ts`)

| Function | Signature | Purpose |
|----------|-----------|---------|
| `ri` | `(min, max) => number` | Random integer, inclusive both ends |
| `pick` | `<T>(arr: T[]) => T` | Random element |
| `shuffleArr` | `<T>(arr: T[]) => T[]` | Fisher–Yates, returns a copy |
| `gcd` / `lcm` | `(a, b) => number` | Euclidean |
| `isPrime` | `(n) => boolean` | Trial division to √n |
| `countFactors` | `(n) => number` | O(n) loop |
| `hasCarryOnes` | `(a, b) => boolean` | `(a%10)+(b%10) >= 10` |
| `hasBorrowOnes` | `(a, b) => boolean` | `(a%10) < (b%10)` |
| `addNoCarry` / `addWithCarry` | `(minA,maxA,minB,maxB) => [a,b]` | Bounded retry (200 attempts) |
| `subNoBorrow` / `subWithBorrow` | `(minA,maxA,minB,maxB) => [a,b]` | Bounded retry (200 attempts) |
| `makeIntChoices` | `(answer) => number[]` | 4 integer options; spread scales with magnitude |
| `makeDecChoices` | `(answer, step=0.1) => number[]` | 4 decimal options |
| `makeStrChoices` | `(answer, pool) => string[]` | ⚠️ returns `min(4, pool.length)` — see [C7](./04-critical-issues.md#c7) |

**Retry-loop caveat.** The carry/borrow helpers give up after 200 attempts and
return whatever they last produced, which may violate the intended predicate.
`subWithBorrow` can also `continue` without assigning `b` when
`upper < minB`. See the test suite.

### `makeIntChoices` spread table

```ts
const spread = Math.abs(answer) <= 15   ? 2
             : Math.abs(answer) <= 100  ? 7
             : Math.abs(answer) <= 1000 ? 25
             :                            100;
```

No lower bound is applied, which is why negative distractors reach Class 1 —
F6.

---

## 3. `GameContext` API

Accessed via `useGame()`, which throws outside a `GameProvider`.

### Configuration
| Member | Type |
|--------|------|
| `selectedClass` / `setSelectedClass` | `SchoolClass` |
| `selectedCategory` / `setSelectedCategory` | `Category` |
| `difficulty` / `setDifficulty` | `Difficulty` |
| `sessionType` / `setSessionType` | `SessionType` |
| `selectedTable` / `setSelectedTable` | `number` |

### Session
| Member | Type | Notes |
|--------|------|-------|
| `questions` | `Question[]` | Pre-generated |
| `currentIndex` | `number` | |
| `score` | `number` | |
| `totalQuestions` | `number` | 10 / 20 / 12 — ⚠️ [C4](./04-critical-issues.md#c4) |
| `isGameOver` | `boolean` | |
| `wrongAnswers` | `WrongAnswer[]` | This session only |
| `isTablesMode` | `boolean` | |

### Actions
| Method | Signature |
|--------|-----------|
| `startGame` | `(cls, diff, cat, sess) => void` |
| `startTablesGame` | `(tableNum: number) => void` |
| `submitAnswer` | `(choice: ChoiceValue) => boolean` |
| `nextQuestion` | `() => void` |
| `endGame` | `() => void` |

### Persistence
| Member | Type |
|--------|------|
| `highScores` | `Record<string, number>` |
| `progressStats` | `ProgressStats` |
| `tablesBest` | `Record<number, number>` |
| `savedMistakes` | `WrongAnswer[]` |
| `saveScore` | `() => Promise<void>` |
| `saveProgressStats` | `(correct: boolean, actualCategory?: Category) => Promise<void>` |
| `clearMistake` | `(display: string, correctAnswer: string) => Promise<void>` |
| `loadAll` | `() => Promise<void>` |
| `getHighScore` | `(cls, diff, cat) => number` |

---

## 4. Storage keys

| Key | Value shape |
|-----|-------------|
| `@maths_workout_v2_high_scores` | `Record<"cls_cat_diff", number>` |
| `@maths_workout_v2_progress_stats` | `Record<"cls_cat_diff", {attempted, correct}>` |
| `@maths_workout_v2_tables_best` | `Record<number, number>` |
| `@maths_workout_v2_saved_mistakes` | `WrongAnswer[]` — ⚠️ uncapped, [C11](./04-critical-issues.md#c11) |
| `@maths_workout_device_id` | UUID v4 string |

**Composite key format:** `` `${SchoolClass}_${Category}_${Difficulty}` ``
e.g. `3rd_multiplication_medium`.

⚠️ There is **no schema version key**. A future shape change would silently
corrupt existing installs — see
the repair backlog.

---

## 5. HTTP API contract

Defined by `lib/progressApi.ts`. **The server implementing it is missing** —
see the deleted-packages report.

```
Base URL:  process.env.EXPO_PUBLIC_DOMAIN
             ? `https://${EXPO_PUBLIC_DOMAIN}/api`
             : `/api`
```

### `GET /api/progress/:deviceId`

```ts
// 200 → ProgressData    non-2xx → client treats as null
{
  highScores:    Record<string, number>,
  progressStats: Record<string, { attempted: number; correct: number }>,
  tablesBest:    Record<string, number>,
  wrongAnswers:  Array<{ display: string; userAnswer: string; correctAnswer: string }>
}
```

### `POST /api/progress/:deviceId`

Body is the same `ProgressData`. Response ignored; errors swallowed.

⚠️ **No authentication.** The device ID in the path is the only identifier.
⚠️ **No response validation** — the client casts with `as ProgressData`.

---

## 6. Merge semantics

| Data | Strategy | Correct? |
|------|----------|----------|
| `highScores` | `Math.max` per key | ✅ yes — a high score is a maximum |
| `tablesBest` | `Math.max` per key | ✅ yes |
| `progressStats` | `Math.max` per field, independently | ❌ no — counters must sum; can yield >100% accuracy ([C10](./04-critical-issues.md#c10)) |
| `savedMistakes` | Set union on `display\|correctAnswer` | ⚠️ correct but unbounded ([C11](./04-critical-issues.md#c11)) |

---

## 7. Environment variables

| Variable | Consumers | Required | Default | Purpose |
|----------|-----------|----------|---------|---------|
| `EXPO_PUBLIC_DOMAIN` | `scripts/build.js`, `lib/progressApi.ts` | for `build` | — | Deployment host; sets the API base |
| `EXPO_PUBLIC_REPL_ID` | `scripts/build.js` | no | — | Passed through to Metro |
| `BASE_PATH` | `scripts/build.js`, `server/serve.js` | no | `/` | Sub-path mounting |
| `PORT` | `server/serve.js` | no | `3000` | Listen port |

No `.env.example` exists — recommended in the repair backlog.

---

## 8. Routes

| Path | File | Purpose |
|------|------|---------|
| `/` | `app/index.tsx` | Home — stats snapshot, quick actions |
| `/class-select` | `app/class-select.tsx` | Choose 1st–6th |
| `/category-select` | `app/category-select.tsx` | Choose topic (grouped Arithmetic / Curriculum) |
| `/difficulty-select` | `app/difficulty-select.tsx` | Difficulty + session type |
| `/game` | `app/game.tsx` | Core loop |
| `/results` | `app/results.tsx` | Score, stars, new-best |
| `/mistake-review` | `app/mistake-review.tsx` | Review and re-practise |
| `/tables-mode` | `app/tables-mode.tsx` | Times-table drill picker |
| `/progress` | `app/progress.tsx` | Per-class / per-topic stats |
| `*` | `app/+not-found.tsx` | Fallback |

All registered in `app/_layout.tsx` with `headerShown: false`,
`animation: 'slide_from_right'`.

---

## 9. Design tokens

`constants/colors.ts` — ⚠️ **palettes are inverted**, see [C5](./04-critical-issues.md#c5).

### Currently used palette (`colors.light`, actually dark values)

| Token | Value |
|-------|-------|
| `background` | `#0F0F1A` |
| `card` | `#1A1A2E` |
| `foreground` / `text` | `#FFFFFF` |
| `primary` | `#6C63FF` |
| `muted` / `secondary` | `#252540` |
| `mutedForeground` | `#8888BB` |
| `border` / `input` | `#2A2A45` |
| `easy` / `correct` | `#4CAF50` |
| `medium` / `timerWarning` | `#FF9800` |
| `hard` / `wrong` / `destructive` | `#F44336` |
| `gold` / `silver` / `bronze` | `#FFD700` / `#C0C0C0` / `#CD7F32` |
| `radius` | `16` |

### Class colours

| Class | Colour |
|-------|--------|
| 1st | `#FF6B6B` |
| 2nd | `#FF9F43` |
| 3rd | `#FDD835` |
| 4th | `#26C6DA` |
| 5th | `#42A5F5` |
| 6th | `#AB47BC` |

### Alpha convention

Transparency is applied by string concatenation of a hex alpha suffix:

```ts
backgroundColor: meta.color + '22'   // ≈13% opacity
borderColor:     cls.color  + '44'   // ≈27% opacity
```

Common suffixes in use: `'14'`, `'18'`, `'22'`, `'44'`, `'55'`.

---

## 10. Timing constants

| Constant | Value | Location |
|----------|-------|----------|
| `PER_Q_SECS` | 15 s | `app/game.tsx` |
| `BLITZ_SECS` | 60 s | `app/game.tsx` |
| Advance after correct | 450 ms (300 ms blitz) | `app/game.tsx` |
| Advance after wrong | 600 ms (400 ms blitz) | `app/game.tsx` |
| Fade out / in | 120 ms / 180 ms | `app/game.tsx` |
| Shake | 5 × 55 ms | `app/game.tsx` |
| Metro health poll | 60 × 1 s | `scripts/build.js` |
| Bundle download timeout | 5 min | `scripts/build.js` |

### Responsive question font

```ts
const qFontSize = qtLen > 80 ? 16 : qtLen > 50 ? 19 : qtLen > 30 ? 24 : qtLen > 18 ? 32 : 44;
```

### Choice font

```ts
const choiceFontSize = hasStringChoices ? 16
                     : choices.some(c => Math.abs(c) > 999) ? 22
                     : 28;
```

---

## 11. Command reference

| Command | Location | Status |
|---------|----------|--------|
| `pnpm install` | root | ❌ [C1](./04-critical-issues.md#c1) |
| `pnpm install --frozen-lockfile` | root | ❌ [C2](./04-critical-issues.md#c2) |
| `pnpm run typecheck` | root | ❌ [C3](./04-critical-issues.md#c3) |
| `pnpm run build` | root | ❌ depends on typecheck |
| `pnpm dev` | `artifacts/mobile` | ✅ after repair |
| `pnpm typecheck` | `artifacts/mobile` | ✅ 0 errors after repair |
| `pnpm build` | `artifacts/mobile` | ⚠️ needs `EXPO_PUBLIC_DOMAIN` |
| `pnpm serve` | `artifacts/mobile` | ⚠️ needs a prior build |
| `pnpm android` / `pnpm ios` | `artifacts/mobile` | ⚠️ needs native toolchain |

The root `preinstall` hook enforces pnpm:

```sh
rm -f package-lock.json yarn.lock
case "$npm_config_user_agent" in pnpm/*) ;; *) echo "Use pnpm instead" >&2; exit 1 ;; esac
```

---

## 12. File inventory

45 files, 5,524 lines.

| File | LOC | Role |
|------|-----|------|
| `scripts/build.js` | 581 | Metro → static bundle pipeline |
| `app/mistake-review.tsx` | 467 | Review + practice modes |
| `server/templates/landing-page.html` | 460 | Expo Go landing page |
| `context/GameContext.tsx` | 362 | Global store |
| `app/game.tsx` | 337 | Core game loop |
| `components/ErrorFallback.tsx` | 274 | Error UI |
| `app/progress.tsx` | 269 | Stats screen |
| `generators/topics-core.ts` | 242 | shapes/time/money/place value/measurement |
| `app/index.tsx` | 226 | Home |
| `generators/advanced.ts` | 214 | 8 advanced generators |
| `generators/arithmetic.ts` | 195 | + − × ÷ + tables |
| `app/results.tsx` | 195 | Results |
| `app/category-select.tsx` | 185 | Topic picker |
| `app/difficulty-select.tsx` | 170 | Difficulty + session |
| `server/serve.js` | 135 | Static server |
| `generators/index.ts` | 130 | Metadata + dispatcher |
| `app/tables-mode.tsx` | 126 | Tables picker |
| `app/class-select.tsx` | 114 | Class picker |
| `generators/helpers.ts` | 103 | Shared utilities |
| `generators/early-years.ts` | 91 | counting / number sense |
| `generators/fractions-decimals.ts` | 84 | fractions / decimals |
| `constants/colors.ts` | 83 | Design tokens |
| `artifacts/mobile/package.json` | 65 | Manifest |
| `app/_layout.tsx` | 57 | Providers |
| `components/ErrorBoundary.tsx` | 53 | Error catcher |
| `lib/progressApi.ts` | 44 | Sync client |
| `app/+not-found.tsx` | 44 | 404 |
| `generators/types.ts` | 39 | Shared types |
| `app.json` | 35 | Expo config |
| `components/KeyboardAwareScrollViewCompat.tsx` | 32 | Keyboard helper |
| `tsconfig.base.json` | 26 | Compiler options |
| `hooks/useColors.ts` | 23 | Theme hook (unused) |
| `tsconfig.json` (mobile) | 18 | App TS config |
| `package.json` (root) | 16 | Workspace root |
| `tsconfig.json` (root) | 16 | Project references |
| `metro.config.js` | 7 | Metro |
| `babel.config.js` | 6 | Babel |

---

## 13. Glossary

| Term | Meaning |
|------|---------|
| **Class** | Irish primary school year, 1st–6th (ages 6–12) |
| **Category** | A question topic (`addition`, `fractions`, …) |
| **Mixed** | Pseudo-category that samples a random real category per question |
| **Tables** | Times-table drill mode; 12 fixed questions, bypasses `generateQuestion` |
| **Blitz** | The `timed60` session type — 60 seconds, unlimited questions *(currently capped, [C4](./04-critical-issues.md#c4))* |
| **Session** | One game run: 10q, 20q, or Blitz |
| **Carry / Borrow** | Column arithmetic requiring a 10 to be carried or borrowed; explicitly drilled by difficulty |
| **Resolved category** | The concrete category chosen behind a `mixed` question, used for stat attribution |
| **Device ID** | Anonymous UUID v4 in AsyncStorage; the only sync identity |
| **Importer** | A pnpm workspace package as recorded in `pnpm-lock.yaml` |
| **Catalog** | pnpm's centralised version pinning (`"react": "catalog:"`) |
| **Artifact** | This repo's term for a deployable app (`artifacts/mobile`) |

---

## 14. External references

- [Expo SDK 54](https://docs.expo.dev/) · [expo-router](https://docs.expo.dev/router/introduction/)
- [React Native 0.81](https://reactnative.dev/) · [New Architecture](https://reactnative.dev/architecture/landing-page)
- [React Compiler](https://react.dev/learn/react-compiler)
- [pnpm workspaces](https://pnpm.io/workspaces) · [catalogs](https://pnpm.io/catalogs) · [`minimumReleaseAge`](https://pnpm.io/settings#minimumreleaseage)
- [Drizzle ORM](https://orm.drizzle.team/) — used by the missing `lib/db`
- [Orval](https://orval.dev/) — used by the missing `lib/api-spec`
- [Vitest](https://vitest.dev/) · [fast-check](https://fast-check.dev/)
- [Irish Primary Mathematics Curriculum](https://curriculumonline.ie/primary/curriculum-areas/mathematics/)
