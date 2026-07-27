# 06 · Improvement Roadmap

Prioritised backlog. Each item carries an effort estimate and a rationale.
Phase 0 is non-negotiable — nothing else can proceed until the repo installs.

---

## Phase 0 · Unblock the repository — ~30 minutes

| # | Task | Effort | Ref |
|---|------|--------|-----|
| 0.1 | Remove `@workspace/api-client-react` from `artifacts/mobile/package.json` | 2 min | [C1](./04-critical-issues.md#c1) |
| 0.2 | Delete the duplicated `dependencies` block (expo/react/react-native) | 5 min | [C2](./04-critical-issues.md#c2) |
| 0.3 | Empty `"references"` in root `tsconfig.json` | 2 min | [C3](./04-critical-issues.md#c3) |
| 0.4 | Prune dead globs from `pnpm-workspace.yaml` (`lib/*`, `lib/integrations/*`, `scripts`) | 2 min | [03](./03-missing-files.md) |
| 0.5 | Simplify root `typecheck` script (drop `typecheck:libs`) | 2 min | [C3](./04-critical-issues.md#c3) |
| 0.6 | Regenerate lockfile: `pnpm install --no-frozen-lockfile` | 1 min | |
| 0.7 | Prune 11 unused catalog entries | 5 min | [03 §3.4](./03-missing-files.md) |

**Verified outcome:** 746 packages install in 7.3 s; `tsc --noEmit` reports
0 errors.

---

## Phase 1 · Fix user-visible correctness — ~1 day

| # | Task | Effort | Ref |
|---|------|--------|-----|
| 1.1 | Make Blitz mode unbounded (lazy question generation) | 30 min | [C4](./04-critical-issues.md#c4) |
| 1.2 | Fix ratio float artifact — multiply before dividing, round | 15 min | [C8](./04-critical-issues.md#c8) |
| 1.3 | Give true/false questions 4 options (or a dedicated 2-button UI) | 30 min | [C7](./04-critical-issues.md#c7) |
| 1.4 | Force integer results in triangle-area and percentage generators | 30 min | [F3](./05-correctness-audit.md#f3) |
| 1.5 | Pass `resolvedCategory` on the timeout path; record timeouts as mistakes | 10 min | [C12](./04-critical-issues.md#c12) |
| 1.6 | Add explicit `1st`/`2nd` cases to `genDivision`; remove `default:` | 20 min | [F5](./05-correctness-audit.md#f5) |
| 1.7 | Suppress negative distractors for young classes in `makeIntChoices` | 20 min | [F6](./05-correctness-audit.md#f6) |
| 1.8 | Fix difficulty non-monotonicity (Class 4–6 subtraction, Class 2/5/6 multiplication) | 1 h | [F4](./05-correctness-audit.md#f4) |
| 1.9 | Deduplicate questions within a session (with a loop guard) | 30 min | [F8](./05-correctness-audit.md#f8) |

---

## Phase 2 · Correct the theming layer — ~1 day

| # | Task | Effort | Ref |
|---|------|--------|-----|
| 2.1 | Swap the inverted `light`/`dark` palette contents | 15 min | [C5](./04-critical-issues.md#c5) |
| 2.2 | Migrate all 9 screens from `const C = colors.light` to `useColors()` | 4 h | [C5](./04-critical-issues.md#c5) |
| 2.3 | Move `StyleSheet.create` into components via a `makeStyles(c)` factory | (in 2.2) | |
| 2.4 | Verify `userInterfaceStyle: "automatic"` now works, or pin to `"dark"` | 30 min | |

<a id="i5"></a>
### Note on the styles migration

Because `C` is captured at module scope, styles are frozen at import time.
The migration pattern:

```ts
const makeStyles = (C: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  /* … */
});

export default function GameScreen() {
  const C = useColors();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  /* … */
}
```

`useColors` must return a referentially stable object for the `useMemo` to be
effective — memoise it on `scheme`:

```ts
export function useColors() {
  const scheme = useColorScheme();
  return React.useMemo(() => {
    const palette = scheme === 'dark' ? colors.dark : colors.light;
    return { ...palette, radius: colors.radius };
  }, [scheme]);
}
```

---

## Phase 3 · Testing & CI — ~3 days

Detailed in [07-testing-strategy.md](./07-testing-strategy.md).

| # | Task | Effort |
|---|------|--------|
| 3.1 | Add Vitest; unit-test `helpers.ts` (carry/borrow, choice builders) | 4 h |
| 3.2 | Property tests: every generator satisfies the 6 invariants from [05](./05-correctness-audit.md) | 1 day |
| 3.3 | Snapshot the difficulty curve; fail CI on regression | 3 h |
| 3.4 | Component tests for `GameContext` reducer logic | 4 h |
| 3.5 | GitHub Actions: install → typecheck → test on every PR | 2 h |
| 3.6 | Add `--frozen-lockfile` to CI to prevent lockfile drift recurring | 15 min |

---

## Phase 4 · State architecture — ~2 days

| # | Task | Effort | Rationale |
|---|------|--------|-----------|
| 4.1 | Split `GameContext` into `SessionContext` + `ProgressContext` | 1 day | 14 state values in one provider means every stat write re-renders every screen |
| 4.2 | Convert session state to `useReducer` | 4 h | Removes the 11-entry dependency array on `saveScore` |
| 4.3 | Memoise the provider `value` object | 30 min | Currently a new object literal on every render |
| 4.4 | Debounce network pushes — on game end and app background only | 2 h | Currently pushes on **every answered question** |
| 4.5 | Stop importing domain constants through the context barrel | 1 h | [02 §2](./02-architecture.md#layer-violation) |

### Suggested context split

```
SessionContext   — questions, currentIndex, score, isGameOver, wrongAnswers
                   (changes many times per minute; only /game and /results consume)

ProgressContext  — highScores, progressStats, tablesBest, savedMistakes
                   (changes rarely; consumed by /index, /progress, /class-select)

ConfigContext    — selectedClass, selectedCategory, difficulty, sessionType
                   (changes only in the selection funnel)
```

---

## Phase 5 · Storage & sync hygiene — ~2 days

| # | Task | Effort | Ref |
|---|------|--------|-----|
| 5.1 | Cap `savedMistakes` at 200 with FIFO eviction | 30 min | [C11](./04-critical-issues.md#c11) |
| 5.2 | Validate API responses with Zod before merging | 2 h | [C6](./04-critical-issues.md#c6) |
| 5.3 | Gate sync on `EXPO_PUBLIC_DOMAIN`; surface status in the UI | 2 h | [C6](./04-critical-issues.md#c6) |
| 5.4 | Fix `progressStats` merge (sum, don't max) + v3 migration | 1 day | [C10](./04-critical-issues.md#c10) |
| 5.5 | Add a storage-schema version key and a migration runner | 4 h | |
| 5.6 | Add an offline write queue with retry | 4 h | |

### Storage migration pattern

There is currently no version marker, so a schema change would silently
corrupt existing data:

```ts
const SCHEMA_VERSION_KEY = '@maths_workout_schema_version';
const CURRENT_VERSION = 3;

const MIGRATIONS: Record<number, () => Promise<void>> = {
  3: async () => { /* v2 flat counters → v3 per-device counters */ },
};

async function migrate() {
  const raw = await AsyncStorage.getItem(SCHEMA_VERSION_KEY);
  let v = raw ? Number(raw) : 2;                 // existing installs are v2
  while (v < CURRENT_VERSION) {
    v++;
    await MIGRATIONS[v]?.();
    await AsyncStorage.setItem(SCHEMA_VERSION_KEY, String(v));
  }
}
```

---

## Phase 6 · Backend rebuild (optional) — ~1 week

Only if cross-device sync is a product requirement. See
[03 Option B](./03-missing-files.md#option-b--rebuild-the-backend-12-days).

| # | Task | Effort |
|---|------|--------|
| 6.1 | Recreate `lib/db` — Drizzle schema + migrations | 1 day |
| 6.2 | Recreate `lib/api-zod` — shared Zod contracts | 4 h |
| 6.3 | Recreate `artifacts/api-server` — Express 5 + Pino | 1 day |
| 6.4 | **Add authentication** — the original design had none | 1 day |
| 6.5 | Rate limiting + payload size caps | 4 h |
| 6.6 | Deployment (Docker, migrations on boot, health check) | 1 day |

### Security requirements for the rebuild

The original contract took the device ID straight from the URL path with no
auth:

```
GET  /api/progress/:deviceId
POST /api/progress/:deviceId
```

Anyone who guesses a UUID can read and overwrite a child's progress. The
rebuild must address:

- **Authentication** — signed device token issued on first contact, sent as a
  bearer header; the path parameter alone must not grant access
- **Rate limiting** — per device and per IP
- **Payload caps** — `savedMistakes` is unbounded client-side ([C11](./04-critical-issues.md#c11)); the
  server must reject oversized bodies
- **Input validation** — Zod on every field before it reaches the database
- **COPPA/GDPR-K** — this is a children's product; document what is stored
  (currently only anonymous scores, which is good) and provide deletion

---

## Phase 7 · Product & UX enhancements

Ordered by estimated learner value per unit of effort.

### High value

| Feature | Effort | Why |
|---------|--------|-----|
| **Spaced repetition for mistakes** | 3 days | Mistake Review exists but is a flat list. SM-2 style scheduling would make it genuinely effective. |
| **Streaks & daily goals** | 2 days | The tagline is "train every day" but nothing tracks daily engagement. |
| **Show the worked solution after a wrong answer** | 2 days | Currently the learner sees the correct option highlighted but no explanation of *why*. |
| **Adaptive difficulty** | 3 days | `progressStats` already tracks per-topic accuracy — use it to auto-tune. |
| **Parent/teacher dashboard** | 1 week | The per-topic data already exists; presenting it to an adult is high leverage. |

### Medium value

| Feature | Effort |
|---------|--------|
| Sound effects (with a mute toggle) | 1 day |
| Achievement badges | 2 days |
| Question bookmarking | 1 day |
| Printable worksheet export | 2 days |
| Multi-profile support (siblings / classrooms) | 3 days |
| Web build (`react-native-web` is already a dependency) | 2 days |

### Accessibility — should be treated as higher priority than "medium"

| Task | Effort | Notes |
|------|--------|-------|
| Screen-reader labels on all touchables | 1 day | No `accessibilityLabel` anywhere currently |
| Verify contrast ratios meet WCAG AA | 4 h | Especially the `+'22'` alpha-suffixed backgrounds |
| Respect `prefers-reduced-motion` | 4 h | Shake animation may be problematic for some users |
| Support OS dynamic type | 1 day | Font sizes are hardcoded numbers |
| Increase touch targets to 44×44 pt minimum | 4 h | Some chips and badges are smaller |
| Add a dyslexia-friendly font option | 1 day | Relevant for the target demographic |

### Content

| Task | Effort |
|------|--------|
| Add the 2 unimplemented categories to `CLASS_TOPICS` where appropriate | 2 h |
| Expand word problems (currently ~5 templates per class band, highly repetitive) | 3 days |
| Add visual/diagram questions (fraction bars, clock faces, shape images) | 1 week |
| Localise for other curricula (UK, US) — the Irish alignment is currently hardcoded | 1 week |

---

## Phase 8 · Build & tooling polish

| # | Task | Effort | Ref |
|---|------|--------|-----|
| 8.1 | Compress `icon.png` (1.1 MB → ~60 KB); create a distinct splash asset | 10 min | [C14](./04-critical-issues.md#c14) |
| 8.2 | Add ESLint + the `react-hooks` plugin | 2 h | 5 `eslint-disable-line` suppressions exist with no linter configured |
| 8.3 | Add Prettier config (`prettier` is a devDependency but unconfigured) | 30 min | |
| 8.4 | Async file I/O + caching headers + gzip in `server/serve.js` | 4 h | [02 §8](./02-architecture.md) |
| 8.5 | Make the Metro startup timeout configurable (currently fixed 60 s) | 30 min | |
| 8.6 | Remove `react-native-reanimated` or start using it | 1 h | Declared but never imported |
| 8.7 | Add `.env.example` documenting all four env vars | 15 min | |
| 8.8 | Add `README.md`, `LICENSE` (root claims MIT), `CONTRIBUTING.md` | 4 h | [C13](./04-critical-issues.md#c13) |

---

## Effort summary

| Phase | Scope | Effort |
|-------|-------|--------|
| 0 | Unblock repository | 30 min |
| 1 | User-visible correctness | 1 day |
| 2 | Theming | 1 day |
| 3 | Testing & CI | 3 days |
| 4 | State architecture | 2 days |
| 5 | Storage & sync | 2 days |
| 6 | Backend rebuild *(optional)* | 1 week |
| 7 | Product & accessibility | ongoing |
| 8 | Tooling polish | 1 day |

**Minimum viable repair: Phase 0 + Phase 1 ≈ 1.5 days** produces a repository
that installs, typechecks, and has no known user-visible correctness defects.
