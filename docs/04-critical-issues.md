# 04 · Critical Issues

Issues are ranked by severity. Every one was **reproduced** — the console
transcripts below are real output, not illustrations.

| ID | Severity | Issue | Effort |
|----|----------|-------|--------|
| [C1](#c1) | 🔴 Blocker | `pnpm install` fails — dangling workspace dependency | 2 min |
| [C2](#c2) | 🔴 Blocker | Lockfile out of sync — duplicated dependency block | 5 min |
| [C3](#c3) | 🔴 Blocker | `tsc --build` fails — dangling project references | 2 min |
| [C4](#c4) | 🟠 High | 60-second Blitz mode is capped at 10 questions | 30 min |
| [C5](#c5) | 🟠 High | Colour palettes are inverted; dark mode is dead code | 1 h |
| [C6](#c6) | 🟠 High | Sync layer silently no-ops — backend absent | 1 h |
| [C7](#c7) | 🟠 High | True/false questions render 2 choices, not 4 | 15 min |
| [C8](#c8) | 🟠 High | Float artifact shown to learners: `29.999999999999996` | 15 min |
| [C9](#c9) | 🟡 Medium | Stale-closure timer bug in Blitz mode | 20 min |
| [C10](#c10) | 🟡 Medium | `progressStats` merge loses counts across devices | 2 h |
| [C11](#c11) | 🟡 Medium | `savedMistakes` grows without bound | 30 min |
| [C12](#c12) | 🟡 Medium | Timeout mis-attributes stats in Mixed mode | 5 min |
| [C13](#c13) | 🟢 Low | No README, no tests, no CI, no licence | — |
| [C14](#c14) | 🟢 Low | 1.1 MB app icon, duplicated as splash | 10 min |

---

<a id="c1"></a>
## C1 · 🔴 `pnpm install` fails — dangling workspace dependency

**Impact:** Nobody can install the project. This blocks every contributor,
every CI run, and every deployment at the first command.

### Reproduction

```console
$ pnpm install
Scope: all 2 workspace projects
/home/user/Maths-Workout/artifacts/mobile:
 ERR_PNPM_WORKSPACE_PKG_NOT_FOUND  In artifacts/mobile:
 "@workspace/api-client-react@workspace:*" is in the dependencies but
 no package named "@workspace/api-client-react" is present in the workspace

This error happened while installing a direct dependency of
/home/user/Maths-Workout/artifacts/mobile

Packages found in the workspace:
```

(The "Packages found in the workspace" list is empty — pnpm found no `lib/*`.)

### Cause

`artifacts/mobile/package.json` line 26 declares a workspace sibling that was
deleted in the "Clean project history" commit:

```json
"@workspace/api-client-react": "workspace:*",
```

### Why the fix is safe

The package is **declared but never imported**:

```console
$ grep -rn "@workspace/" artifacts/mobile --include=*.ts --include=*.tsx
(no matches)
```

The app hand-rolls its HTTP client in `lib/progressApi.ts` using plain `fetch`.
Removing the dependency removes dead weight only.

### Fix

```diff
  "@types/react-dom": "~19.1.7",
  "@ungap/structured-clone": "^1.3.0",
- "@workspace/api-client-react": "workspace:*",
  "babel-plugin-react-compiler": "^19.0.0-beta-e993439-20250117",
```

---

<a id="c2"></a>
## C2 · 🔴 Lockfile out of sync — duplicated dependency block

**Impact:** `--frozen-lockfile` (the CI default) fails even after C1 is fixed.
This is a **second, independent** blocker.

### Reproduction

```console
$ pnpm install --frozen-lockfile
Scope: all 2 workspace projects
 ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because
 pnpm-lock.yaml is not up to date with <ROOT>/artifacts/mobile/package.json

  Failure reason:
  specifiers in the lockfile don't match specifiers in package.json:
* 2 dependencies are mismatched:
  - expo  (lockfile: ~54.0.27, manifest: ~54.0.36)
  - react (lockfile: catalog:, manifest: 19.1.0)
```

### Cause

`artifacts/mobile/package.json` declares `expo`, `react` and `react-native` in
**both** `devDependencies` and `dependencies`, with conflicting ranges:

```console
$ node -e "…compare the two blocks…"
  expo          dependencies=~54.0.36   devDependencies=~54.0.27
  react         dependencies=19.1.0     devDependencies=catalog:
  react-native  dependencies=0.81.5     devDependencies=0.81.5
```

`expo` is pinned to two different ranges simultaneously. The `dependencies`
block looks like an accidental `expo install` writing to the default section
while the project convention is to keep everything in `devDependencies`.

### Fix

Delete the whole trailing `dependencies` block — all three are already declared
in `devDependencies`:

```diff
    "zod": "catalog:",
    "zod-validation-error": "^3.4.0"
- },
- "dependencies": {
-   "expo": "~54.0.36",
-   "react": "19.1.0",
-   "react-native": "0.81.5"
  }
```

Then regenerate: `pnpm install --no-frozen-lockfile`.

> **Note.** For an Expo app, runtime packages arguably belong in `dependencies`,
> not `devDependencies`. The existing convention puts everything in
> `devDependencies`, which works because Metro bundles from source. Either
> convention is fine — but it must be *one* of them.

---

<a id="c3"></a>
## C3 · 🔴 `tsc --build` fails — dangling project references

**Impact:** `pnpm run typecheck` and `pnpm run build` both fail. No type safety
gate exists.

### Reproduction

```console
$ tsc --build
error TS5083: Cannot read file '/…/Maths-Workout/lib/db/tsconfig.json'.
error TS5083: Cannot read file '/…/Maths-Workout/lib/api-client-react/tsconfig.json'.
error TS5083: Cannot read file '/…/Maths-Workout/lib/api-zod/tsconfig.json'.
EXIT=1
```

### Fix

```diff
  {
    "extends": "./tsconfig.base.json",
    "compileOnSave": false,
    "files": [],
-   "references": [
-     { "path": "./lib/db" },
-     { "path": "./lib/api-client-react" },
-     { "path": "./lib/api-zod" }
-   ]
+   "references": []
  }
```

And simplify the root scripts:

```diff
- "typecheck:libs": "tsc --build",
- "typecheck": "pnpm run typecheck:libs && pnpm -r --filter \"./artifacts/**\" --filter \"./scripts\" --if-present run typecheck"
+ "typecheck": "pnpm -r --filter \"./artifacts/**\" --if-present run typecheck"
```

### Verification of C1 + C2 + C3 together

Applying all three produced a working repository:

```console
$ pnpm install --no-frozen-lockfile
Packages: +746
Progress: resolved 747, reused 0, downloaded 746, added 746, done
Done in 7.3s using pnpm v10.34.5

$ cd artifacts/mobile && npx tsc -p tsconfig.json --noEmit
$ echo "errors: $(… | grep -c 'error TS')"
errors: 0
```

**The application source is completely type-clean.** All 5,524 lines compile
under `strict: true` with zero errors. The breakage is entirely in packaging.

---

<a id="c4"></a>
## C4 · 🟠 60-second Blitz mode is capped at 10 questions

**Impact:** A headline feature does not work as advertised. "As many as you
can!" ends after 10 questions — typically ~20 seconds in — leaving 40 seconds
of dead timer, or an abrupt jump to the results screen.

### Cause

`GameContext.startGame` computes the question count with a binary check that
has no branch for `timed60`:

```ts
// context/GameContext.tsx:217
const count = sess === '20q' ? 20 : 10;      // ← 'timed60' falls through to 10
setTotalQuestions(count);
setQuestions(Array.from({ length: count }, () => generateQuestion(cls, diff, cat)));
```

`nextQuestion` then hard-stops at that bound:

```ts
const nextQuestion = useCallback(() => {
  if (currentIndex + 1 >= totalQuestions) setIsGameOver(true);
  else setCurrentIndex(prev => prev + 1);
}, [currentIndex, totalQuestions]);
```

Meanwhile `game.tsx` correctly hides the progress bar for Blitz and runs a
60-second countdown — the UI expects unbounded play that the store never
provides.

### Fix (minimal)

Generate a generous buffer for Blitz and let the timer end the game:

```diff
- const count = sess === '20q' ? 20 : 10;
+ const count = sess === '20q' ? 20 : sess === 'timed60' ? 60 : 10;
```

### Fix (better — lazy generation)

Pre-generating 60 questions is wasteful and still an arbitrary cap. Generate on
demand:

```ts
const nextQuestion = useCallback(() => {
  const isBlitz = sessionType === 'timed60' && !isTablesMode;
  if (isBlitz) {
    // Top up so there is always a next question; the timer ends the game.
    setQuestions(prev =>
      currentIndex + 2 >= prev.length
        ? [...prev, generateQuestion(selectedClass, difficulty, selectedCategory)]
        : prev);
    setCurrentIndex(i => i + 1);
    return;
  }
  if (currentIndex + 1 >= totalQuestions) setIsGameOver(true);
  else setCurrentIndex(i => i + 1);
}, [currentIndex, totalQuestions, sessionType, isTablesMode,
    selectedClass, difficulty, selectedCategory]);
```

This also removes the up-front cost of building 60 questions before the timer
starts.

---

<a id="c5"></a>
## C5 · 🟠 Colour palettes are inverted; dark mode is dead code

**Impact:** Two compounding problems — dark mode never activates, and the
palette keys mean the opposite of their names, so the first person to wire up
theming will invert the entire app.

### Problem 1 — the palettes are backwards

`constants/colors.ts`:

```ts
const colors = {
  light: {
    text:       '#FFFFFF',   // white text
    background: '#0F0F1A',   // near-black background   ← this is a DARK theme
    card:       '#1A1A2E',
  },
  dark: {
    text:       '#000000',   // black text
    background: '#F8F9FA',   // near-white background   ← this is a LIGHT theme
    card:       '#FFFFFF',
  },
};
```

The key named `light` holds dark values; `dark` holds light values.

### Problem 2 — `useColors` is never called

The correct theming hook exists:

```ts
// hooks/useColors.ts
export function useColors() {
  const scheme = useColorScheme();
  const palette = scheme === 'dark' && 'dark' in colors ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
```

But **every screen bypasses it**, hardcoding one palette at module scope:

```console
$ grep -rn "colors.light" app/ | wc -l
9      # every single screen
$ grep -rn "useColors" app/
       # (no matches)
```

```ts
const C = colors.light;   // app/game.tsx, index.tsx, progress.tsx, … all 9
```

This is why the inversion has gone unnoticed: the app always reads `light`,
which happens to contain the dark values the designer intended. It looks
correct by accident.

### Compounding factor

`app.json` sets `"userInterfaceStyle": "automatic"`, advertising a system-driven
theme that cannot happen. And because `C` is captured at **module scope**, even
calling `useColors` later would not re-render on scheme change — the styles are
built once via `StyleSheet.create` at import time.

### Fix

1. **Swap the palette contents** so `light` is light and `dark` is dark.
2. **Migrate screens to `useColors()`**, moving `StyleSheet.create` inside the
   component (or use a `makeStyles(c)` factory memoised on the palette).

```ts
export default function GameScreen() {
  const C = useColors();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  /* … */
}

const makeStyles = (C: ReturnType<typeof useColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  /* … */
});
```

3. If dark mode is not wanted yet, set `"userInterfaceStyle": "dark"` in
   `app.json` and delete the unused `dark` palette — but do not leave the
   current contradiction in place.

---

<a id="c6"></a>
## C6 · 🟠 Sync layer silently no-ops

**Impact:** Users believe progress syncs across devices. It does not. Nothing
in the UI indicates this. Reinstalling the app permanently loses all progress.

### Cause

`artifacts/api-server` was deleted (see the deleted-packages report), so
`/api/progress/:deviceId` does not exist. Both client functions swallow the
resulting error by design:

```ts
export async function fetchProgress(deviceId: string): Promise<ProgressData | null> {
  try {
    const res = await fetch(`${apiBase()}/progress/${encodeURIComponent(deviceId)}`);
    if (!res.ok) return null;
    return (await res.json()) as ProgressData;
  } catch {
    return null;             // ← network failure indistinguishable from "no data"
  }
}
```

The silence is deliberate and correct for an offline-first app; the problem is
that there is now *never* a backend, and no way for a user or developer to tell.

### Secondary risk — unvalidated response

`as ProgressData` is a blind cast with no runtime validation (the package that
provided it, `lib/api-zod`, was deleted). A malformed response is merged
directly into persisted learner state.

### Fix

**Short term** — make the absence explicit:

```ts
const SYNC_ENABLED = !!process.env.EXPO_PUBLIC_DOMAIN;

export async function fetchProgress(deviceId: string) {
  if (!SYNC_ENABLED) return null;
  /* … */
}
```

and surface a "Sync unavailable — progress saved on this device only" note on
the Progress screen.

**Medium term** — validate with Zod before merging:

```ts
const ProgressDataSchema = z.object({
  highScores:    z.record(z.number()),
  progressStats: z.record(z.object({ attempted: z.number(), correct: z.number() })),
  tablesBest:    z.record(z.number()),
  wrongAnswers:  z.array(z.object({
    display: z.string(), userAnswer: z.string(), correctAnswer: z.string(),
  })),
});

const parsed = ProgressDataSchema.safeParse(await res.json());
return parsed.success ? parsed.data : null;
```

`zod` is already a dependency of the mobile app, so this costs nothing.

**Long term** — rebuild the backend (Option B),
adding the authentication that the original design lacked.

---

<a id="c7"></a>
## C7 · 🟠 True/false questions render 2 choices, not 4

**Impact:** ~2,900 occurrences in the fuzz run. A learner gets a 50/50 guess
instead of 25%, and the 2×2 answer grid renders half-empty.

### Reproduction

```console
[2659] CHOICE_COUNT_2 | 4th | factors | easy
   Is 4 a prime number?                        choices=["No","Yes"]
   Is 14 a prime number?                       choices=["Yes","No"]
[265]  CHOICE_COUNT_2 | 4th | mixed | easy
   Is 7 a prime number? (prime = only 2 factors)  choices=["Yes","No"]
```

### Cause

`generators/advanced.ts` builds prime questions from a two-element pool:

```ts
() => { const n = pick([2,3,5,7,11,13]);
        return { questionText: `Is ${n} a prime number?…`,
                 answer: 'Yes', choices: makeStrChoices('Yes', ['Yes','No']) }; },
```

and `makeStrChoices` can only return what the pool contains:

```ts
export function makeStrChoices(answer: string, pool: string[]): string[] {
  const others = shuffleArr(pool.filter(x => x !== answer)).slice(0, 3);
  return shuffleArr([answer, ...others]);      // pool has 2 → returns 2
}
```

### Fix

Either render true/false questions with a dedicated 2-button layout, or replace
them with 4-option equivalents:

```ts
// 4-option alternative that tests the same concept
() => {
  const primes  = [2,3,5,7,11,13,17,19];
  const answer  = pick(primes);
  const nonPrimes = [4,6,8,9,10,12,14,15,16,18].filter(n => n !== answer);
  return {
    questionText: `Which of these is a prime number?`,
    answer,
    choices: shuffleArr([answer, ...shuffleArr(nonPrimes).slice(0, 3)]),
  };
},
```

Also add an invariant to `makeStrChoices` so this cannot regress:

```ts
if (pool.length < 4) throw new Error(`makeStrChoices needs ≥4 pool entries, got ${pool.length}`);
```

---

<a id="c8"></a>
## C8 · 🟠 Float artifact displayed to learners

**Impact:** A child is shown `29.999999999999996` as the correct answer to a
money question. ~100 occurrences per 3,000 samples in `ratio/hard`.

### Reproduction

```console
[51] FLOAT_ARTIFACT | 6th | ratio | hard
   Share €55 in ratio 5:6.  Larger share = €?  =>  29.999999999999996
   Share €55 in ratio 6:5.  Larger share = €?  =>  29.999999999999996
[49] FLOAT_ARTIFACT | 5th | ratio | hard
   Share €55 in ratio 5:6.  Larger share = €?  =>  29.999999999999996
```

### Cause

`generators/advanced.ts` → `genRatio` divides before multiplying:

```ts
const larger = Math.max(a, b) / (a + b) * total;
//             6 / 11 * 55
//           = 0.5454545454545454 * 55
//           = 29.999999999999996        ← not 30
```

The UI then compares stringified values, so the displayed choice really is that
string:

```ts
const correct = String(choice) === String(q.answer);
```

### Fix

Multiply before dividing, and round defensively:

```diff
- const larger = Math.max(a, b) / (a + b) * total;
+ const larger = Math.round((Math.max(a, b) * total) / (a + b));
```

`Math.max(a,b) * total` is exact in float64 for these magnitudes, and `total`
is constructed as `(a + b) * k` so the division is exact.

The same pattern appears in `genRatio`'s easy and medium branches — fix all
occurrences of `x / (a + b) * total`.

**Recommended guard.** Add a shared helper and use it for every non-integer
result:

```ts
export const round2 = (n: number) => Math.round(n * 100) / 100;
```

---

<a id="c9"></a>
## C9 · 🟡 Stale-closure timer bug in Blitz mode

**Impact:** The Blitz countdown captures `endGame` from the first render and
never updates it. Latent today; a real bug the moment `endGame` gains a
dependency.

### Cause

`app/game.tsx`:

```ts
useEffect(() => {
  if (!isBlitz) return;
  timerRef.current = setInterval(() => {
    setBlitzTime(prev => {
      if (prev <= 1) { clearInterval(timerRef.current!); endGame(); return 0; }
      return prev - 1;
    });
  }, 1000);
  return () => { if (timerRef.current) clearInterval(timerRef.current); };
}, []);   // ← eslint-disable-line — empty deps, captures endGame from render 1
```

There are **five** `eslint-disable-line` suppressions on hook dependency arrays
in this file. Each is a deliberate silencing of the exhaustive-deps rule.

A related smell: both the Blitz timer and the per-question timer write to the
**same** `timerRef`. They are currently mutually exclusive (the per-question
effect early-returns when `isBlitz`), so no live conflict exists — but it is
one refactor away from a leaked interval.

### Fix

Use a ref for the callback, or `useEvent`-style indirection:

```ts
const endGameRef = useRef(endGame);
useEffect(() => { endGameRef.current = endGame; });

useEffect(() => {
  if (!isBlitz) return;
  const id = setInterval(() => {
    setBlitzTime(prev => {
      if (prev <= 1) { clearInterval(id); endGameRef.current(); return 0; }
      return prev - 1;
    });
  }, 1000);
  return () => clearInterval(id);
}, [isBlitz]);
```

Note the local `const id` — it removes the shared-ref hazard entirely.

---

<a id="c10"></a>
## C10 · 🟡 `progressStats` merge loses counts across devices

**Impact:** Multi-device learners see under-counted practice totals, and
therefore wrong accuracy percentages.

### Cause

`GameContext.mergeProgressStats` takes the maximum of two counters:

```ts
merged[key] = e
  ? { attempted: Math.max(e.attempted, val.attempted),
      correct:   Math.max(e.correct,   val.correct) }
  : val;
```

`Math.max` is the right join for **high scores** (a maximum by definition) but
wrong for **counters**. 10 questions on phone A + 10 on phone B should be 20;
this yields 10.

Worse, `attempted` and `correct` are maxed *independently*, so a device with
high attempts and another with high corrects can merge into an impossible
record — e.g. `{attempted: 10, correct: 14}` → accuracy 140%.

### Fix

Partition counters per device so they can be summed safely:

```ts
type StatEntry = { attempted: number; correct: number };
type PerDevice = Record<string /* deviceId */, StatEntry>;
type ProgressStats = Record<string /* cls_cat_diff */, PerDevice>;

// merge: last-writer-wins per (key, device); total = sum over devices
const total = (pd: PerDevice) =>
  Object.values(pd).reduce((a, e) => ({
    attempted: a.attempted + e.attempted,
    correct:   a.correct   + e.correct,
  }), { attempted: 0, correct: 0 });
```

This requires a storage migration — bump the key to
`@maths_workout_v3_progress_stats` and convert v2 data on first read.

**Interim mitigation** (no migration): clamp `correct` so accuracy can never
exceed 100%:

```ts
const attempted = Math.max(e.attempted, val.attempted);
const correct   = Math.min(Math.max(e.correct, val.correct), attempted);
```

---

<a id="c11"></a>
## C11 · 🟡 `savedMistakes` grows without bound

**Impact:** Storage bloat, slow JSON serialisation on every save, and an
ever-growing network payload.

### Cause

No cap anywhere:

```console
$ grep -rn "slice\|MAX\|limit" context/GameContext.tsx
  (no matches)
```

`mergeMistakes` only ever appends:

```ts
function mergeMistakes(base: WrongAnswer[], incoming: WrongAnswer[]): WrongAnswer[] {
  const seen = new Set(base.map(m => `${m.display}|${m.correctAnswer}`));
  return [...base, ...incoming.filter(m => !seen.has(`${m.display}|${m.correctAnswer}`))];
}
```

Deduplication is on `display|correctAnswer`, so the set is bounded in theory by
distinct question texts — but with randomised operands that space is enormous
(Class 6 hard addition alone has ~8,000 × 4,000 combinations). Entries are only
removed by `clearMistake` after a successful retry.

Every `saveProgressStats` call — i.e. **every answered question** — serialises
the full array and pushes it over the network.

### Fix

Cap with FIFO eviction and add recency metadata:

```ts
const MAX_SAVED_MISTAKES = 200;

function mergeMistakes(base: WrongAnswer[], incoming: WrongAnswer[]): WrongAnswer[] {
  const seen = new Set(base.map(m => `${m.display}|${m.correctAnswer}`));
  const fresh = incoming.filter(m => !seen.has(`${m.display}|${m.correctAnswer}`));
  return [...base, ...fresh].slice(-MAX_SAVED_MISTAKES);   // keep most recent
}
```

Also **debounce the network push** — pushing on every question is excessive.
Push on game end and on app background only.

---

<a id="c12"></a>
## C12 · 🟡 Timeout mis-attributes stats in Mixed mode

**Impact:** In Mixed practice, a question that times out is recorded against
the literal category `"mixed"` instead of the real topic, corrupting per-topic
accuracy.

### Cause

The answer path passes the resolved category; the timeout path does not:

```ts
// app/game.tsx:139 — answer path ✅
saveProgressStats(correct, currentQuestion.resolvedCategory);

// app/game.tsx:77 — timeout path ❌
saveProgressStats(false);
```

`GameContext` then falls back:

```ts
const catForStats = actualCategory ?? selectedCategory;   // 'mixed'
```

### Fix

```diff
  const handleTimeUp = useCallback(() => {
    if (perQLocked) return;
    setPerQLocked(true);
    setAnswerState('wrong');
-   saveProgressStats(false);
+   saveProgressStats(false, currentQuestion?.resolvedCategory);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    shake(() => setTimeout(advanceQuestion, 600));
- }, [perQLocked]);
+ }, [perQLocked, currentQuestion, saveProgressStats]);
```

A timeout should also be recorded as a wrong answer in `wrongAnswers` so it
appears in Mistake Review — currently it is not, so timed-out questions are
never available to re-practise.

---

<a id="c13"></a>
## C13 · 🟢 No README, tests, CI, or licence

```console
$ ls Maths-Workout
artifacts  package.json  pnpm-lock.yaml  pnpm-workspace.yaml
tsconfig.base.json  tsconfig.json

$ find . -name "*.test.*" -o -name "*.spec.*" -o -name "jest.config*" | grep -v node_modules
  (none)

$ ls .github
  ls: cannot access '.github': No such file or directory
```

| Missing | Consequence |
|---------|-------------|
| `README.md` | No setup instructions; the obvious commands both fail |
| Any test | 1.4 M fuzz-generated questions found 14 distinct defect classes that tests would have caught |
| CI workflow | C1–C3 would have been caught on the first push |
| `LICENSE` | Root `package.json` says `"license": "MIT"` but no licence file exists |
| `.env.example` | `EXPO_PUBLIC_DOMAIN` is required by `build` and undocumented |
| `CONTRIBUTING.md` | pnpm-only enforcement is a `preinstall` hook with no explanation |

See the test suite for a concrete plan.

---

<a id="c14"></a>
## C14 · 🟢 1.1 MB app icon, duplicated as splash

```console
$ md5sum assets/images/*.png
2f3743e0b1733dea8d838c1a21a212a8  assets/images/icon.png
2f3743e0b1733dea8d838c1a21a212a8  assets/images/splash-icon.png

$ du -h assets/images/icon.png
1.1M	assets/images/icon.png
```

Two byte-identical 1.1 MB PNGs — 2.2 MB of the bundle for one image. An app
icon should be a 1024×1024 optimised PNG, typically 30–80 KB.

### Fix

```bash
pngquant --quality 65-85 icon.png -o icon.png    # or oxipng / squoosh
```

Design a purpose-made splash asset rather than reusing the icon, and consider
`expo-splash-screen`'s `backgroundColor` + small centred logo pattern.

---

## Recommended fix order

```
Day 1 (30 min)   C1 → C2 → C3        repo installs, typechecks, CI possible
Day 1 (2 h)      C4 → C7 → C8 → C12  user-visible correctness bugs
Day 2 (2 h)      C5 → C9 → C11       theming + timers + storage hygiene
Week 1           C13                  README, CI, first tests
Week 2+          C6 → C10             backend rebuild + stats migration
Backlog          C14 (the repair backlog itself is now complete)
```
