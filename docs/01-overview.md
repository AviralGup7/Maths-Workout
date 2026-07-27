# 01 · Overview & Quick Start

## What this project is

**Maths Workout** is a mobile app for drilling primary-school mental
arithmetic. It targets the **Irish primary curriculum**, Classes 1st–6th
(ages 6–12), and is built with React Native via Expo.

The learner flow is a four-step funnel:

```
Home  →  Class (1st–6th)  →  Category (topic)  →  Difficulty + Session  →  Game  →  Results
```

Alongside the main funnel are three side modes reachable from the home screen:

- **Times Tables** — a fixed 12-question drill of one table (1×–12×)
- **Mistake Review** — re-practise previously wrong answers until cleared
- **My Progress** — accuracy and high scores broken down by class and topic

### Feature inventory

| Feature | Detail |
|---------|--------|
| Classes | 6 (1st–6th), each with its own curriculum-mapped topic list |
| Categories | 23 declared (`addition` … `algebra`), 21 with generators |
| Difficulties | `easy`, `medium`, `hard` |
| Session types | 10 questions, 20 questions, 60-second Blitz |
| Question format | Multiple choice, 4 options (see known defect F3) |
| Feedback | Haptics, shake animation, colour state, per-question timer |
| Persistence | AsyncStorage (local) + optional REST sync |
| Progress metrics | High scores, per-topic accuracy, tables bests, saved mistakes |
| Accessibility | Dynamic font sizing by question length; error boundary |

### Curriculum mapping

Topics available per class, from `generators/index.ts` → `CLASS_TOPICS`:

| Class | Theme | Topics |
|-------|-------|--------|
| 1st | Counting & Basics | counting, number_sense, addition, subtraction, shapes, time, money |
| 2nd | Tables & Place Value | addition, subtraction, multiplication, mixed, tables, place_value, measurement, money, time, shapes |
| 3rd | All Operations | + division, fractions, word_problems, geometry |
| 4th | Decimals & Geometry | multiplication, division, mixed, fractions, decimals, factors, geometry, money, measurement, word_problems, place_value |
| 5th | Percentages & Data | + percentages, data, ratio |
| 6th | Algebra & Integers | integers, algebra, percentages, ratio, fractions, geometry, data, word_problems, multiplication, division |

This mapping is thoughtful and is one of the stronger parts of the codebase —
Class 1 correctly excludes multiplication and division, Class 2 restricts
multiplication to the 2/5/10 tables on Easy, and carry/borrow practice is
explicitly separated by difficulty.

---

## Tech stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | React Native | 0.81.5 |
| Framework | Expo (New Architecture enabled) | ~54.0 |
| Language | TypeScript (`strict: true`) | ~5.9.3 |
| Routing | expo-router (file-based, typed routes) | ~6.0.17 |
| State | React Context + hooks | 19.1.0 |
| Storage | `@react-native-async-storage/async-storage` | 2.2.0 |
| Animation | React Native `Animated` (native driver) | built-in |
| Icons | `@expo/vector-icons` (Feather) | ^15.0.3 |
| Fonts | `@expo-google-fonts/inter` | ^0.4.0 |
| Compiler | React Compiler (babel plugin, experimental) | beta |
| Package manager | pnpm workspaces | 10.x |

Notably the project enables **React Compiler** and the **New Architecture**
(Fabric/TurboModules) — both forward-looking choices.

---

## Repository layout

```
Maths-Workout/
├── package.json              # workspace root, pnpm-only guard
├── pnpm-workspace.yaml       # globs: artifacts/*, lib/*, scripts  ← 3 of 4 missing
├── pnpm-lock.yaml            # 10 importers  ← 6 no longer exist on disk
├── tsconfig.json             # project references  ← all 3 dangling
├── tsconfig.base.json        # shared strict compiler options
└── artifacts/
    └── mobile/               # the ONLY package that actually exists
        ├── app/              # expo-router screens (9 routes)
        │   ├── _layout.tsx           # providers, fonts, splash
        │   ├── index.tsx             # home
        │   ├── class-select.tsx
        │   ├── category-select.tsx
        │   ├── difficulty-select.tsx
        │   ├── game.tsx              # core game loop
        │   ├── results.tsx
        │   ├── mistake-review.tsx
        │   ├── tables-mode.tsx
        │   ├── progress.tsx
        │   └── +not-found.tsx
        ├── generators/       # pure question-generation logic
        │   ├── types.ts              # shared types
        │   ├── helpers.ts            # RNG, carry/borrow, choice builders
        │   ├── index.ts              # metadata + dispatcher
        │   ├── arithmetic.ts         # + − × ÷ and tables
        │   ├── early-years.ts        # counting, number sense
        │   ├── topics-core.ts        # shapes, time, money, place value, measurement
        │   ├── fractions-decimals.ts
        │   └── advanced.ts           # word problems, factors, geometry, %, data, ratio, integers, algebra
        ├── context/GameContext.tsx   # single global store (362 LOC)
        ├── components/       # ErrorBoundary, ErrorFallback, keyboard compat
        ├── constants/colors.ts       # design tokens  ← palettes inverted
        ├── hooks/useColors.ts        # theme hook  ← never used by screens
        ├── lib/progressApi.ts        # REST sync client  ← backend missing
        ├── scripts/build.js          # Metro → static bundle pipeline
        └── server/serve.js           # zero-dependency static server
```

**Source of truth:** `generators/` is pure and framework-free. This is a good
boundary — it means the question logic is directly unit-testable without any
React or native mocking. See the test suite.

---

## Quick start

### ⚠️ The documented commands do not work

`README` instructions do not exist, and the natural commands both fail:

```console
$ pnpm install
ERR_PNPM_WORKSPACE_PKG_NOT_FOUND  In artifacts/mobile:
"@workspace/api-client-react@workspace:*" is in the dependencies but
no package named "@workspace/api-client-react" is present in the workspace

$ pnpm install --frozen-lockfile
ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because
pnpm-lock.yaml is not up to date with <ROOT>/artifacts/mobile/package.json
  - expo  (lockfile: ~54.0.27, manifest: ~54.0.36)
  - react (lockfile: catalog:,  manifest: 19.1.0)
```

### Working setup (verified)

Apply the three repairs from [04-critical-issues.md](./04-critical-issues.md),
then:

```bash
# 1 · Repair the manifest
#    artifacts/mobile/package.json:
#      - delete  "@workspace/api-client-react": "workspace:*"  from devDependencies
#      - delete  the entire "dependencies" block (it duplicates devDependencies)
#
# 2 · Repair the root tsconfig
#    tsconfig.json:  "references": []
#
# 3 · Install
pnpm install --no-frozen-lockfile

# 4 · Run
cd artifacts/mobile
pnpm dev            # expo start --localhost
```

Verified results after this repair:

```console
$ pnpm install --no-frozen-lockfile
Packages: +746
Done in 7.3s using pnpm v10.34.5

$ cd artifacts/mobile && npx tsc -p tsconfig.json --noEmit
# 0 errors
```

### Available scripts

**Root:**

| Script | Command | Status |
|--------|---------|--------|
| `build` | `pnpm run typecheck && pnpm -r run build` | ❌ fails — typecheck broken |
| `typecheck` | `tsc --build` then per-package | ❌ fails — dangling references |
| `typecheck:libs` | `tsc --build` | ❌ fails — `lib/*` missing |

**`artifacts/mobile`:**

| Script | Command | Status |
|--------|---------|--------|
| `dev` | `expo start --localhost` | ✅ works after repair |
| `typecheck` | `tsc -p tsconfig.json --noEmit` | ✅ 0 errors after repair |
| `build` | `node scripts/build.js` | ⚠️ requires `EXPO_PUBLIC_DOMAIN` |
| `serve` | `node server/serve.js` | ⚠️ requires a prior `build` |
| `android` / `ios` | `expo run:*` | ⚠️ needs native toolchain |

### Environment variables

| Variable | Used by | Required | Purpose |
|----------|---------|----------|---------|
| `EXPO_PUBLIC_DOMAIN` | `build.js`, `progressApi.ts` | for `build` | Deployment host; API base becomes `https://$DOMAIN/api` |
| `EXPO_PUBLIC_REPL_ID` | `build.js` | no | Passed through to Metro |
| `BASE_PATH` | `build.js`, `serve.js` | no | Sub-path mounting, default `/` |
| `PORT` | `serve.js` | no | Listen port, default `3000` |

There is no `.env.example` in the repository — adding one is recommended in
the repair backlog (since completed).
