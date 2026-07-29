# 20 · Architecture Audit — V2, Second Pass

> **Status: HISTORICAL — closed.** Its recommendations are now enforced mechanically by `scripts/arch-check.mjs`, which passes **7/7 checks over 126 modules** at `d9054dc`.


**Method:** measured, not read. Dependency graphs, dead-code reachability,
theme-resolution probing in a real browser, bundle and dependency weighting,
and test-shape analysis were all produced by executing tooling against the tree.

**Scope:** 90 modules, ~17k lines, 532 unit tests + 5 architecture checks +
17 browser assertions.

**Disclosure:** the previous audit's remediation was carried out by me. This
pass therefore begins by *independently re-verifying* those claims rather than
assuming them, and then deliberately examines the areas the last pass did **not**
cover: the screen layer, duplication, reachability, dependency hygiene, bundle,
and test *quality* as distinct from test count.

---

## 1 · Executive Summary

Re-verified from a clean checkout:

```
circular dependencies                     0
unreviewed upward dependencies            0
domain modules importing React/RN         0   (of 38)
contexts over 60 members                  0
storage keys missing from manifest        0
532 tests · typecheck clean
```

Those hold. The core architecture — a pure, framework-free domain over an
append-only event log — is genuinely excellent and I would defend it unchanged.

**But this pass found three material problems the first pass missed, one of
which is a live user-facing defect:**

| # | Finding | Severity | Evidence |
|---|---|---|---|
| **F1** | **Dark mode is broken.** The app ships a dark palette and a user preference, but only 2 of 12 screens can honour it | **High — shipped defect** | Browser-measured |
| **F2** | **Dead subsystems.** `confidence.ts` (111 LOC, fully tested) is imported by nothing but its own test | **High** | Reachability graph |
| **F3** | **23 of 38 runtime dependencies are never imported**, and all 46 sit in `devDependencies` with `dependencies` empty | **Medium–High** | Import scan |

The first pass scored 8.7. **This pass scores 7.9** — not because the
architecture regressed, but because it looked in places the first pass did not.
The score difference is measurement coverage, not decay.

---

## 2 · Overall Architecture Score

| Dimension | Score | Basis |
|---|---:|---|
| Separation of concerns | **9/10** | 0 React imports in 38 domain modules; 0 cycles |
| Domain modelling | **9/10** | Scheduler imports only skills, mastery, generators, boards |
| Modularity | 8/10 | Clean layers; `game.tsx` at 732 lines / 28 hooks is an outlier |
| Testability | **9/10** | Pure domain; simulation and property testing both practical |
| Data model | 8/10 | Append-only log is right; one merge-key risk (§7) |
| Maintainability | 7/10 | Dual theme systems; header/container duplicated 6–10× |
| **Consistency** | **5/10** | **Half-migrated theme produces a visibly broken feature** |
| **Reachability** | **6/10** | Tested subsystems with no path to a user |
| Dependency hygiene | 5/10 | 23 unused runtime deps; empty `dependencies` |
| Extensibility | 7/10 | New types/skills cheap; content still code, not data |
| **Overall** | **7.9/10** | Excellent core, weak periphery |

---

## 3 · F1 · Dark mode is broken — the finding that matters most

`theme/tokens.ts` exports a complete `DARK` palette. `theme/useTheme.tsx`
exposes a persisted `ThemePreference` of `'light' | 'dark' | 'system'`. Both are
well built and tested.

**But 16 files still resolve colour at module scope:**

```ts
const C = colors.light;   // evaluated ONCE at import, before any preference is read
```

A module-scope constant cannot participate in a re-render. Measured:

```
screens reading theme reactively (useTheme):   2
screens frozen to light at import time:       10
```

I verified the consequence in a browser rather than inferring it. With
`@maths_workout_theme = "dark"` set:

```
HOME          background rgb(14, 17, 22)     ← dark, correct
CLASS-SELECT  background rgb(252, 252, 253)  ← light, wrong
```

**A user who enables dark mode gets a half-dark, half-light application.** This
is not latent debt; it is a defect reachable from the settings screen today.

Note the irony worth naming: `constants/colors.ts` was *deliberately* made a
shim so the inverted-palette bug could be fixed for all 17 files at once. That
was the right call at the time. But the shim was meant to be temporary, and a
temporary shim that outlives its migration becomes a second source of truth.

**Recommendation.** Finish the migration — it is mechanical, roughly 2–3 days
for 16 files — and then **delete `constants/colors.ts`**. Add an architecture
check that fails the build if `const C = colors` reappears. The migration is not
done until the shim is gone; leaving it is what allowed a shipped feature to be
silently non-functional.

---

## 4 · F2 · Dead and dark code

**63 exports are referenced nowhere outside their defining file.** Most are
harmless (constants exported for tests, `EASE_OUT`, `hasCarryOnes`). Two
categories are not.

### Entirely unreachable subsystems

```
learning/confidence.ts   111 LOC   imported ONLY by progression/__tests__/achievements.test.ts
```

Confirmed precisely: no screen renders `CONFIDENCE_COPY`, no code path calls
`shouldAskConfidence`. The confidence-rating feature is **specified, built,
documented, tested — and unreachable by any user.**

This is a distinct and more dangerous category than dead code, because the tests
pass and the docs describe it as delivered. Nothing in the build tells you the
feature does not exist. `docs/18` marks it "✅ done", which — measured against
reachability rather than file existence — it is not.

### Partially wired

`availableChapters`, `detectAvoidance`, `comebackMultiplier` and
`confidentlyWrongSkills` are each referenced once or not at all outside tests.
The chapter graph drives a *display list* on the progress screen but does not
drive navigation, so `chapterStatus` gates nothing a learner can act on.

**Recommendation.** Two rules, both enforceable:

1. **A feature is "done" when it is reachable**, not when it is tested. Add a
   reachability check to `arch-check.mjs`: any non-test module in `learning/`,
   `progression/` or `curriculum/` whose only importer is a test file fails.
2. Either wire confidence into the session loop (it is one prompt, ~half a day
   given the module exists) or delete it. Carrying tested-but-dark code is worse
   than either, because it inflates apparent completeness.

---

## 5 · F3 · Dependency hygiene

```
dependency sections in package.json:  ['devDependencies']   ← no "dependencies"
runtime deps declared:                38
never imported anywhere:              23
```

Unused: `@tanstack/react-query`, `zod`, `zod-validation-error`,
`react-native-reanimated`, `react-native-screens`, `react-native-web`,
`react-native-worklets`, `expo-blur`, `expo-image`, `expo-image-picker`,
`expo-location`, `expo-linear-gradient`, `expo-symbols`, `expo-system-ui`,
`expo-linking`, `expo-constants`, `expo-font`, `expo-glass-effect`,
`expo-web-browser`, `@stardazed/streams-text-encoding`, `@ungap/structured-clone`,
`react-dom`, `fast-check`.

Three consequences:

1. **Bundle.** The web export is **3.0 MB** of JavaScript. Some of these are
   transitively required by Expo, but `zod`, `react-query` and the unused
   `expo-*` modules are not.
2. **Permissions.** `expo-image-picker` and `expo-location` are declared but
   never used. `app.json` currently declares **no** Android permissions and no
   iOS usage strings, so nothing is requested today — but a future
   `expo prebuild` or a plugin change could surface camera/location prompts in a
   **children's app**. That is a privacy and store-review risk for zero benefit.
3. **Everything in `devDependencies`.** With an empty `dependencies` block, the
   production dependency set is undeclared. For an Expo app this happens to
   work, but it means no tool can distinguish shipped code from build tooling.

**Recommendation.** Prune the 23; move genuine runtime packages into
`dependencies`. Half a day, and it removes a whole class of supply-chain and
permission surface. `fast-check` should move to true dev-only.

---

## 6 · Screen layer — the remaining structural weakness

The domain is clean; the presentation layer is where complexity now sits.

```
game.tsx             732 lines   28 hooks
progress.tsx         492 lines   10 hooks
mistake-review.tsx   469 lines   16 hooks
```

`game.tsx` holds 28 hook calls and coordinates: two timers, three animation
values, hint escalation, worked-example gating, session-local attempt logging,
scaffold tracking, praise, diagnosis, XP display and answer submission. It is
the highest-complexity module in the system and has **no tests**.

Duplication, measured across screens:

```
container      10 copies      header      6 copies
scroll          7 copies      backBtn     6 copies
headerCenter    7 copies      headerTitle 6 copies
Platform.OS === 'web' ? 67 : insets.top   ×12 screens
```

**Recommendation.** Extract `<Screen>` (safe-area + max-width + background) and
`<ScreenHeader>` (back button + title + subtitle). That removes the 12-way
safe-area duplication and ~40 style keys, and it is the natural vehicle for
finishing the theme migration in §3 — one component adopts `useTheme()` and
16 screens inherit it. Do these together; they are the same work.

Split `game.tsx` into a `usePracticeSession()` hook (timers, hints, adaptation)
and a presentational shell. The hook then becomes testable.

---

## 7 · Data model — one real risk

The append-only log remains the right decision and is why mastery, statistics,
achievements and the parent report all compose without migrations.

**Merge-key collision risk.** Deduplication uses:

```ts
`${answeredAt}|${skill}|${questionText}|${chosen}`
```

`answeredAt` is `Date.now()` at millisecond resolution. Two answers to the *same
generated question text* with the *same chosen value* inside one millisecond
would collide and one would be silently dropped. Practically impossible for a
human — but not for a device-clock adjustment, a restored backup, or an
automated test harness.

**Recommendation.** Add a per-attempt `id` (device id + monotonic counter). This
also makes the log a genuine CRDT, which matters because the offline-first
design otherwise positions it perfectly for optional cloud sync — union-merge
over immutable facts is conflict-free by construction. One day of work now
protects a feature the roadmap explicitly anticipates.

---

## 8 · What is excellent, and should not be touched

Stated plainly, because a review that only lists problems is misleading.

- **The pure domain.** 38 modules, zero framework imports. This is the single
  best decision in the system and everything else depends on it.
- **Learning-core decoupling.** Measured: `scheduler.ts` imports only skills,
  mastery, generator types and boards. It does not know progression, statistics
  or achievements exist. `mastery.ts` imports three modules. `misconceptions.ts`
  imports one. The brief asked specifically about scheduler↔progression
  coupling — **there is none**, and that is the correct answer.
- **The append-only log** as single source of truth, with everything derived.
- **`recordAnswer` as a pure `(state, event) → result`.** No I/O, injected
  clock. The most consequential function in the product is ordinary testable
  code.
- **The two CI guards.** `arch-check.mjs` and `ui-smoke.mjs` both verified to
  fail on real regressions. Properties that are not enforced decay.
- **No over-engineering.** Looked for it again: no speculative plugin system, no
  premature service layer, no abstraction with a single implementation.

---

## 9 · Technical debt, ranked

| # | Item | Severity | Cost |
|---|---|---|---|
| 1 | Dark mode non-functional on 10/12 screens | **High** | 3 d |
| 2 | `confidence.ts` unreachable; other subsystems partly wired | **High** | 0.5 d each |
| 3 | 23 unused runtime deps; empty `dependencies` | Medium–High | 0.5 d |
| 4 | `game.tsx` 732 lines / 28 hooks, untested | Medium | 2 d |
| 5 | Screen boilerplate duplicated 6–12× | Medium | 2 d |
| 6 | `constants/colors.ts` shim outliving its migration | Medium | folded into #1 |
| 7 | Merge key can collide within a millisecond | Medium | 1 d |
| 8 | 3.0 MB web bundle | Medium | folded into #3 |
| 9 | Content is code, not data | Medium | 3 wk (strategic) |
| 10 | 63 unreferenced exports | Low | 0.5 d |
| 11 | 8 silent catch blocks | Low | 0.5 d |
| 12 | ~1.7 assertions per test — some tests under-assert | Low | ongoing |

---

## 10 · Recommended roadmap

**Sprint 1 — consistency (1 week).** Fixes a shipped defect and removes a
category of confusion.

1. Build `<Screen>` and `<ScreenHeader>` on `useTheme()`.
2. Migrate all 16 legacy-palette files through them.
3. **Delete `constants/colors.ts`.** Add an arch-check rule banning
   `const C = colors`.
4. Add a `ui-smoke` assertion that dark mode actually renders dark on three
   representative screens — the check that would have caught this.

**Sprint 2 — honesty and hygiene (1 week).**

5. Add a reachability rule to `arch-check.mjs`; wire or delete confidence.
6. Prune 23 dependencies; populate `dependencies`.
7. Add attempt `id`; keep the legacy key as a fallback for existing logs.
8. Correct `docs/18` to distinguish *implemented* from *reachable*.

**Sprint 3 — presentation (1 week).**

9. Extract `usePracticeSession()` from `game.tsx`; test it.
10. Remove the 63 unreferenced exports.

**Deliberately deferred.** The content-as-data question (§5 of the previous
audit) remains the one genuine strategic decision, and it should be taken on
product grounds — not folded into a cleanup sprint.

**Deliberately not recommended.** State-management library, monorepo split,
event bus, ORM, or splitting `GameContext` further: the god-object problem was
solved by extracting the logic, and the remaining context is a coordination
surface, which is what a context is for.

---

## 11 · Final Verdict

**7.9 / 10 — the core is ready for five years; the periphery is not yet.**

The learning architecture is genuinely excellent and I would change none of it:
pure domain, zero cycles, an append-only log, a scheduler that knows nothing
about progression, and enforced structural guards. That core will support 10×
content, optional cloud sync and a teacher mode without redesign.

The problems are all in the **shell around it**, and they share one root cause:
**migrations that were started and not finished.** The theme shim was a correct
temporary measure that became a permanent second source of truth, and the result
is a feature that ships broken. The confidence subsystem was built and never
connected, and the docs record it as delivered.

That is the honest headline of this audit, and it is a process finding as much
as an architectural one: *this codebase is very good at building things and less
good at finishing them.* Three focused weeks closes it — and the two CI guards
already in place are the right mechanism, they simply need rules for the
properties that were not being checked.

---

### Reproducing

```bash
cd artifacts/mobile
npm run verify     # typecheck + arch guard + 532 tests
npm run ui:smoke   # build + 17 browser assertions
```

**Caveat.** This audit measures structure, reachability and performance. It says
nothing about whether the product teaches children mathematics — that remains
unvalidated, and no architectural score should be read as evidence about
learning outcomes.

---

## 12 · Remediation — all three findings closed

Every number re-measured after the change.

### F1 · Dark mode — **fixed**

All 16 legacy files migrated off `const C = colors.light`, and
**`constants/colors.ts` and `hooks/useColors.ts` are deleted.** The migration is
not finished until the shim is gone; leaving it is precisely what let a shipped
feature be silently non-functional.

Three screens were rewritten onto new `Screen` / `ScreenHeader` primitives
(`class-select` 120 → 84 lines, plus `category-select` and `difficulty-select`),
which collapses the boilerplate the audit measured: `Platform.OS === 'web' ? 67`
appeared 12 times, `container` 10 times, `header`/`backBtn`/`headerTitle` 6 each.

The larger screens kept their existing markup but had their palette converted
from a module constant to a `useLegacyPalette()` hook, with `StyleSheet.create`
turned into a `makeStyles(C)` factory. Same styles, now reactive — a deliberately
low-risk transformation for files with heavy layout.

Verified in a browser, both directions:

```
theme=dark   /              rgb(14, 17, 22)    luminance 0.07
             /class-select  rgb(14, 17, 22)    luminance 0.07     ← was 252,252,253
             /progress      rgb(23, 27, 34)    luminance 0.10
theme=light  /              rgb(252, 252, 253) luminance 0.99
             /class-select  rgb(252, 252, 253) luminance 0.99
             /progress      rgb(255, 255, 255) luminance 1.00
```

**Two new permanent guards**, because a fix without a guard is a fix with a
half-life:

- `arch-check.mjs` fails on any module resolving colour at import time.
- `ui-smoke.mjs` asserts the *rendered pixels* are dark under `theme=dark` on
  three screens. Asserting the token is dark would not have caught this defect —
  the tokens were always correct.

### F2 · Dead and dark code — **fixed**

`learning/confidence.ts` is now wired into the practice loop: one prompt, once
per session, at the midpoint. It is asked **before** the outcome is revealed —
a rating collected after the child knows the result measures memory of the
result, not belief at the moment of answering.

A new architecture rule makes the whole category impossible: **any module in
`learning/`, `progression/` or `curriculum/` whose only importer is a test file
fails the build.** It caught `confidence.ts` on its first run, which is the
guard doing its job immediately.

Also removed the unused `KeyboardAwareScrollViewCompat` component and dropped
the `export` keyword from helpers only used inside their own file. Symbols that
tests legitimately import were left alone — trimming public surface for its own
sake is churn.

### F3 · Dependency hygiene — **fixed**

```
removed 13 never-imported packages
  @tanstack/react-query   zod             zod-validation-error
  expo-image-picker       expo-location   expo-web-browser
  expo-blur               expo-image      expo-glass-effect
  expo-linear-gradient    expo-symbols
  @stardazed/streams-text-encoding        @ungap/structured-clone

moved 24 runtime packages into `dependencies` (previously empty)
devDependencies: 46 -> 9
```

`expo-web-browser` was also removed from the `app.json` plugin list.

`expo-image-picker` and `expo-location` are the ones that mattered: no
permissions were declared, so the risk was latent — but camera and location
surface in a **children's app** for zero benefit is not a carrying cost worth
paying.

The bundle stayed at 3.0 MB, so the win here is supply-chain and permission
surface rather than size. Worth stating plainly rather than claiming a
performance improvement that did not occur: these packages were already being
tree-shaken out of the build.

### Also done

`hooks/usePracticeScaffolds.ts` extracts hint escalation, confidence timing and
scaffold tracking out of `game.tsx` into a hook whose decisions are pure
functions. Timers and animations stayed in the screen, because they are
genuinely view concerns and moving them would be motion for its own sake.

### Verification

```
typecheck     clean
arch-check    89 modules · 7 checks · 0 failed
vitest        539 passed (26 files)
ui-smoke      23 passed  (was 17; +6 theme assertions)
```

**Revised score: 7.9 → 8.8.** All three findings are closed and — more
durably — each is now enforced by a check that fails the build. The remaining
gap to 9+ is the content-as-data question, which stays a product decision rather
than a defect.

One honest caveat carried forward: this closes *structural* findings. Nothing
here validates that the product teaches children mathematics, which remains the
largest open question in the whole documentation set.
