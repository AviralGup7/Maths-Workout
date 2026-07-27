# 02 · Architecture

## 1. System context

The app is designed as **local-first with optional cloud sync**. AsyncStorage is
the source of truth; the network is a best-effort durability layer whose errors
are deliberately swallowed.

```
┌───────────────────────────────────────────────────────────────┐
│                        Mobile device                          │
│                                                               │
│   ┌─────────────────────────────────────────────────────┐     │
│   │            Expo Router (9 screens)                  │     │
│   └──────────────────────┬──────────────────────────────┘     │
│                          │ useGame()                          │
│   ┌──────────────────────▼──────────────────────────────┐     │
│   │              GameContext (single store)             │     │
│   │   session state · persistence · merge · sync        │     │
│   └───────┬────────────────────────────────┬────────────┘     │
│           │                                │                  │
│   ┌───────▼────────┐              ┌────────▼────────┐         │
│   │  generators/   │              │  AsyncStorage   │         │
│   │  (pure logic)  │              │  (5 keys)       │         │
│   └────────────────┘              └────────┬────────┘         │
└────────────────────────────────────────────┼──────────────────┘
                                             │ fetch (fire & forget)
                                    ┌────────▼────────┐
                                    │  /api/progress  │  ❌ MISSING
                                    │  (api-server)   │     from repo
                                    └────────┬────────┘
                                    ┌────────▼────────┐
                                    │  PostgreSQL     │  ❌ MISSING
                                    │  (lib/db)       │     from repo
                                    └─────────────────┘
```

The two greyed boxes are the subject of the deleted-packages report (since retired).

---

## 2. Layered design

The codebase separates cleanly into four layers with a strict one-way
dependency flow:

```
┌──────────────────────────────────────────────────────┐
│ L4  Presentation      app/*.tsx                      │  React, navigation, animation
├──────────────────────────────────────────────────────┤
│ L3  State             context/GameContext.tsx        │  session + persistence + merge
├──────────────────────────────────────────────────────┤
│ L2  Domain            generators/*.ts                │  PURE — no React, no I/O
├──────────────────────────────────────────────────────┤
│ L1  Infrastructure    lib/progressApi.ts             │  AsyncStorage, fetch
│                       constants/, hooks/             │
└──────────────────────────────────────────────────────┘
             dependencies point downward only
```

**The L2 boundary is the codebase's best architectural decision.** The entire
question-generation domain — 21 generators, ~800 lines of the trickiest logic —
imports nothing but its own siblings. It is deterministic given `Math.random`,
framework-free, and therefore trivially testable. The audit in
the correctness audit was only possible because of this boundary: the
generators were bundled with esbuild and fuzzed directly in Node, with zero
React Native mocking.

### Layer violation

`context/GameContext.tsx` re-exports the entire domain layer:

```ts
export type { SchoolClass, Difficulty, /* … 10 types */ } from '../generators';
export { CLASS_CONFIGS, CATEGORY_META, generateQuestion, /* … */ } from '../generators';
```

Every screen then imports domain types *through the context*:

```ts
import { useGame, CLASS_CONFIGS, CATEGORY_META, ChoiceValue } from '@/context/GameContext';
```

This is a convenience barrel that couples presentation to state for purely
static data. `CLASS_CONFIGS` and `CATEGORY_META` are frozen constants — screens
should import them from `@/generators` directly. The current arrangement means
any screen touching a colour constant transitively depends on the store.

---

## 3. Module dependency graph

```
                      ┌─────────────┐
                      │   types.ts  │   (no dependencies)
                      └──────┬──────┘
                             │
                      ┌──────▼──────┐
                      │  helpers.ts │   ri, pick, shuffle, carry/borrow,
                      └──────┬──────┘   makeIntChoices, makeDecChoices
                             │
     ┌───────────┬───────────┼───────────┬──────────────────┐
     │           │           │           │                  │
┌────▼─────┐ ┌───▼──────┐ ┌──▼───────┐ ┌─▼──────────────┐ ┌─▼─────────┐
│arithmetic│ │early-    │ │topics-   │ │fractions-      │ │ advanced  │
│          │ │years     │ │core      │ │decimals        │ │           │
│ + − × ÷  │ │counting  │ │shapes    │ │fractions       │ │word probs │
│ tables   │ │num sense │ │time      │ │decimals        │ │factors    │
│          │ │          │ │money     │ │                │ │geometry   │
│          │ │          │ │place val │ │                │ │%, data    │
│          │ │          │ │measure   │ │                │ │ratio      │
│          │ │          │ │          │ │                │ │integers   │
│          │ │          │ │          │ │                │ │algebra    │
└────┬─────┘ └───┬──────┘ └──┬───────┘ └─┬──────────────┘ └─┬─────────┘
     └───────────┴───────────┼───────────┴──────────────────┘
                      ┌──────▼──────┐
                      │  index.ts   │  CLASS_CONFIGS, CATEGORY_META,
                      │ (dispatcher)│  CLASS_TOPICS, generateQuestion()
                      └──────┬──────┘
                             │
                    ┌────────▼─────────┐
                    │  GameContext.tsx │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │   app/*.tsx      │
                    └──────────────────┘
```

No cycles. Clean tree. `index.ts` is a textbook dispatcher:

```ts
export function generateQuestion(cls: SchoolClass, diff: Difficulty, cat: Category): Question {
  switch (cat) {
    case 'addition':    return genAddition(cls, diff);
    case 'subtraction': return genSubtraction(cls, diff);
    /* … 19 more … */
    case 'tables':      throw new Error('tables category should use startTablesGame');
    case 'mixed': {
      const available = getAvailableCategories(cls).filter(
        c => c !== 'mixed' && c !== 'tables' && c !== 'counting' && c !== 'number_sense');
      const resolved = pick(available);
      return { ...generateQuestion(cls, diff, resolved), resolvedCategory: resolved };
    }
  }
}
```

Because `Category` is a closed union and there is no `default` case, TypeScript
enforces exhaustiveness — adding a category to the union produces a compile
error until a branch is written. This is a deliberate, good pattern.

The `mixed` branch recurses once and tags the result with `resolvedCategory` so
statistics attribute to the real topic rather than to `"mixed"`. Also good —
though see F7 for a place where that tag is
dropped.

---

## 4. State model

`GameContext` is a single provider holding **14 `useState` values** plus one
`useRef`:

### Configuration state (survives a game)
| State | Type | Default |
|-------|------|---------|
| `selectedClass` | `SchoolClass` | `'1st'` |
| `selectedCategory` | `Category` | `'addition'` |
| `difficulty` | `Difficulty` | `'easy'` |
| `sessionType` | `SessionType` | `'10q'` |
| `selectedTable` | `number` | `2` |

### Session state (reset per game)
| State | Type | Notes |
|-------|------|-------|
| `questions` | `Question[]` | Pre-generated up-front |
| `currentIndex` | `number` | |
| `score` | `number` | |
| `isGameOver` | `boolean` | Drives navigation to `/results` |
| `totalQuestions` | `number` | 10 / 20 / 12 |
| `wrongAnswers` | `WrongAnswer[]` | This session only |
| `isTablesMode` | `boolean` | |

### Persisted state (loaded once on mount)
| State | Storage key | Shape |
|-------|-------------|-------|
| `highScores` | `@maths_workout_v2_high_scores` | `Record<"cls_cat_diff", number>` |
| `progressStats` | `@maths_workout_v2_progress_stats` | `Record<"cls_cat_diff", {attempted, correct}>` |
| `tablesBest` | `@maths_workout_v2_tables_best` | `Record<number, number>` |
| `savedMistakes` | `@maths_workout_v2_saved_mistakes` | `WrongAnswer[]` |
| — | `@maths_workout_device_id` | UUID v4 string |

### Architectural observations

**a) Questions are pre-generated.** `startGame` builds the whole array
eagerly:

```ts
setQuestions(Array.from({ length: count }, () => generateQuestion(cls, diff, cat)));
```

This is why 60-second Blitz is broken — `count` is `10` for any session that
isn't `'20q'`, so Blitz runs out after 10 questions regardless of remaining
time. See [C4](./04-critical-issues.md#c4). Lazy or streaming generation would
fix the bug and reduce startup work.

**b) No duplicate-question guard.** Nothing prevents the same question
appearing twice in one session. With Class 1 Easy addition (operands 1–4) there
are only 16 possible questions, so a 10-question session will almost certainly
repeat.

**c) Every callback depends on all persisted state.** `saveScore` has an
11-entry dependency array:

```ts
}, [score, isTablesMode, selectedTable, selectedClass, selectedCategory, difficulty,
    highScores, tablesBest, progressStats, savedMistakes, wrongAnswers,
    getOrCreateDeviceId, buildPayload]);
```

Any stat change re-creates the callback and re-renders every consumer. A
`useReducer` with a single state object, or splitting into two contexts
(session vs. persistence), would remove this. See
the repair backlog (since completed).

**d) Single context = broad re-renders.** All 14 values sit in one provider
value object, which is not memoised. Every state change re-renders every screen
subscribed via `useGame()`.

---

## 5. Data flow: one answered question

```
User taps a choice
        │
        ▼
game.tsx  handleChoice(choice)
        │  ├─ guard: if (perQLocked) return          ← double-tap protection
        │  ├─ clearInterval(timerRef)                 ← stop the per-question timer
        │  ├─ setPerQLocked(true)
        │  ▼
        │  GameContext.submitAnswer(choice)
        │        ├─ correct = String(choice) === String(q.answer)   ← string compare
        │        ├─ if correct  → setScore(prev => prev + 1)
        │        └─ else        → setWrongAnswers([...prev, {display, userAnswer, correctAnswer}])
        │        └─ returns boolean
        │  ▼
        │  GameContext.saveProgressStats(correct, q.resolvedCategory)
        │        ├─ key = `${cls}_${cat}_${diff}`
        │        ├─ setProgressStats(next)
        │        ├─ await AsyncStorage.setItem(STATS_KEY, …)         ← awaited
        │        └─ pushProgress(deviceId, payload)                  ← NOT awaited
        │  ▼
        │  Haptics + Animated (shake on wrong, pulse on correct)
        │  ▼
        │  setTimeout(advanceQuestion, correct ? 450 : 600)
        │        ▼
        │        fade out → nextQuestion() → reset local state → fade in
        │                        │
        │                        └─ if (currentIndex + 1 >= totalQuestions)
        │                               setIsGameOver(true)
        ▼
useEffect([isGameOver]) → router.replace('/results')
        ▼
results.tsx useEffect([]) → saveScore()
```

### Note on `String()` comparison

`submitAnswer` compares stringified values:

```ts
const correct = String(choice) === String(q.answer);
```

This is a pragmatic choice because `ChoiceValue = number | string` and some
categories answer with words (`'Yes'`, `'Hexagon'`). It works, but it is
fragile with floats — `String(29.999999999999996)` is
`"29.999999999999996"`, which is what the learner is shown. See
F4.

---

## 6. Synchronisation & conflict resolution

`loadAll()` runs once on the home screen mount and performs a
**last-writer-wins-by-maximum** merge:

```ts
const remote = await fetchProgress(deviceId);
if (remote) {
  localHS = mergeHighScores(localHS, remote.highScores);      // Math.max per key
  localPS = mergeProgressStats(localPS, remote.progressStats); // Math.max per field
  localTB = mergeTablesBest(localTB, remote.tablesBest);       // Math.max per key
  localSM = mergeMistakes(localSM, remote.wrongAnswers ?? []); // set union
  await Promise.all([ /* write all four back */ ]);
  pushProgress(deviceId, buildPayload(...));                   // echo merged state
}
```

**Strengths.** The merge strategy is well-matched to the data. High scores and
tables bests are monotonic maxima — `Math.max` is the correct CRDT-style join.
Mistakes are a set union keyed on `display|correctAnswer`. Failures are
non-fatal; the app works fully offline.

**Weaknesses.**

1. **`progressStats` max-merge loses counts.** Taking
   `Math.max(local.attempted, remote.attempted)` is wrong for a counter. If a
   learner answers 10 questions on phone A and 10 on phone B, the true total is
   20 but the merge yields 10. Attempts and corrects are monotonically
   increasing *counters* and should be summed with per-device partitioning, or
   the whole structure should move to a proper grow-only counter.

2. **Anonymous device ID is the only identity.** A random UUID in AsyncStorage.
   Clearing app data orphans all server progress permanently; there is no
   account, recovery, or device-linking path.

3. **No authentication on the sync endpoint.** Any client that guesses or
   enumerates a device UUID can read and overwrite that learner's progress. The
   endpoint takes the ID straight from the URL path. Since the backend is
   missing this is currently theoretical, but the client contract bakes it in.

4. **Sync is fire-and-forget with no retry or queue.** `pushProgress` swallows
   every error. A write that fails while offline is simply lost — the next push
   sends whatever state exists then, so intermediate progress never reaches the
   server.

5. **`savedMistakes` grows without bound.** No cap, no TTL, no compaction. A
   heavy user accumulates an ever-growing array that is JSON-serialised on every
   single save, and pushed over the network in full each time.

---

## 7. Rendering & animation

### Screens
Nine routes, all registered explicitly in `app/_layout.tsx` with
`headerShown: false` and `slide_from_right`.

### Provider stack
```
SafeAreaProvider
 └── ErrorBoundary                  (class component, catches render errors)
      └── GestureHandlerRootView
           └── KeyboardProvider
                └── GameProvider
                     └── StatusBar + Stack
```

Sensible ordering — the error boundary sits high enough to catch failures in
every provider below it.

### Animation approach
All animations use `Animated` with `useNativeDriver: true`, which keeps them on
the UI thread. A defensive lazy-init pattern is used throughout:

```ts
const shakeAnimRef = useRef<Animated.Value | null>(null);
const shakeAnim = shakeAnimRef.current ?? (shakeAnimRef.current = new Animated.Value(0));
```

This avoids allocating a new `Animated.Value` on every render — correct, and
notably it is the pattern React Compiler prefers over `useMemo` for mutable
instances.

Interestingly, `react-native-reanimated` is a declared dependency but is
**never imported**. Either adopt it or drop it.

### Responsive typography
`game.tsx` scales the question font to its content length:

```ts
const qFontSize = qtLen > 80 ? 16 : qtLen > 50 ? 19 : qtLen > 30 ? 24 : qtLen > 18 ? 32 : 44;
```

A pragmatic solution to word problems overflowing. It is duplicated logic that
belongs in a shared helper, but the intent is sound.

### Theming — and why it is currently inert

There are two theming mechanisms and they disagree:

```ts
// hooks/useColors.ts — reads the OS colour scheme, returns the right palette
export function useColors() {
  const scheme = useColorScheme();
  const palette = scheme === 'dark' && 'dark' in colors ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
```

```ts
// every single screen — hardcodes one palette at module scope
const C = colors.light;
```

`useColors` is **never called by any screen**. Dark mode is therefore
non-functional despite `userInterfaceStyle: "automatic"` in `app.json`.

Worse, the palettes are **inverted**: `colors.light` contains
`background: '#0F0F1A'` (near-black) and `text: '#FFFFFF'`, while `colors.dark`
contains `background: '#F8F9FA'` (near-white) and `text: '#000000'`. The app
renders a dark theme from the key named `light`. If anyone wires up `useColors`
without noticing, every screen inverts. See [C5](./04-critical-issues.md#c5).

---

## 8. Build & deploy pipeline

```
scripts/build.js
   │
   ├── findWorkspaceRoot()          walk up for pnpm-workspace.yaml
   ├── getDeploymentDomain()        require EXPO_PUBLIC_DOMAIN, else exit 1
   ├── prepareDirectories(ts)       static-build/{ts}/_expo/static/js/{ios,android}
   ├── clearMetroCache()
   ├── startMetro()                 expo start --no-dev --minify --localhost
   │      └── poll /status up to 60×1s
   ├── downloadFile()               fetch the iOS + Android bundles from Metro
   ├── (writes per-platform manifest.json)
   └── kill Metro
                    ▼
server/serve.js  (zero external dependencies)
   ├── GET / or /manifest  + header expo-platform: ios|android  → manifest JSON
   ├── GET /                                                     → landing page HTML
   └── *                                                         → static file from static-build/
```

**Good:** `serve.js` uses only Node built-ins, normalises paths and checks the
resolved path stays inside `STATIC_ROOT` (directory-traversal guard present).

**Issues:**

| Issue | Detail |
|-------|--------|
| Blocking I/O | `serveStaticFile` uses `fs.readFileSync` per request — blocks the event loop under load |
| No caching headers | No `Cache-Control`, `ETag` or `Last-Modified`; hashed bundle assets are re-sent every time |
| No compression | No gzip/brotli; RN bundles are large and highly compressible |
| Fixed 60s Metro timeout | Cold CI machines can exceed this |
| No `--force-exit` handling | Metro is killed by signal; partial `static-build/` can survive a failure |
| No web platform | Only `ios` and `android` bundles are produced, though `react-native-web` is a dependency |

---

## 9. Architectural strengths — summary

Worth stating plainly, because the audit elsewhere is critical:

1. **Pure domain layer.** `generators/` has zero framework coupling. This is
   the single most valuable property of the codebase.
2. **Exhaustive switch dispatch.** Compile-time guarantee that every category
   has a generator.
3. **Local-first design.** Correct choice for a children's education app where
   connectivity is unreliable and latency is felt.
4. **Monotonic merge semantics** for high scores and tables bests.
5. **Curriculum modelling.** `CLASS_TOPICS` and the per-class branches inside
   generators reflect genuine domain knowledge, not generic filler.
6. **Strict TypeScript, zero errors.** With `strict: true` and
   `noImplicitAny`, the app compiles clean.
7. **Error boundary with a real fallback UI** (274 lines), not a bare
   `componentDidCatch`.
8. **Forward-looking platform choices** — New Architecture and React Compiler
   both enabled.

The problems documented in the rest of this audit are almost entirely
**repository/packaging** problems and **isolated logic defects**, not
architectural ones. The bones are sound.
