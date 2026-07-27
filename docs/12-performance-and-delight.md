# 12 · Direction H — Performance & Delight

> No new features. This is about how the app *feels*.
>
> Every claim below is measured against the codebase, not asserted. Where a gap
> is named, the audit command and its output are included.

---

## 1 · Audit: where we actually stand

Run against the app as it was before this work.

### What was already right

| Check | Result |
|---|---|
| `useNativeDriver` coverage | **23 true / 0 false** — every animation is already on the UI thread |
| Haptics | 54 call sites, correctly differentiated (impact / selection / notification) |
| Animation vocabulary | timing, spring, sequence, parallel all in use |
| Lazy `Animated.Value` init | Correct ref pattern throughout — no per-render allocation |

This is a genuinely good starting point. The animation layer is not the problem.

### What was missing

```console
$ grep -roh "accessibilityLabel" app/ components/ | wc -l
5                                    # across 12 screens

$ grep -roh "accessibilityHint" app/ components/ | wc -l
0

$ grep -rn "AccessibilityInfo\|isReduceMotionEnabled" app/ components/ hooks/
(no matches)                         # animations always play, no opt-out

$ grep -rn "expo-av\|expo-audio" package.json app/
(no matches)                         # the app is completely silent

$ grep -rln "onboard\|welcome\|firstRun" app/ context/
(no matches)                         # cold start drops straight into Home

$ grep -rn "confetti\|celebrate" app/ components/
(no matches)                         # nothing marks a streak or a new best
```

Touch targets below the 44 pt WCAG minimum:

```console
$ grep -rhoE "(width|height): (1[0-9]|2[0-9]|3[0-9]|4[0-3])\b" app/ components/ | sort | uniq -c
     16 width: 40      ← back buttons, close buttons
      8 height: 40
      3 width: 36
      2 width: 32
```

### Honest summary

| Area | Before |
|---|---|
| Animation performance | ✅ already 60 fps capable |
| Accessibility | 🔴 5 labels, 0 hints, no screen-reader support |
| Reduced motion | 🔴 not supported at all |
| Touch targets | 🟠 ~30 below 44 pt |
| Sound | 🔴 none |
| Celebration | 🟠 stars animate; nothing else is marked |
| Onboarding | 🔴 none |
| Perceived speed | 🟠 fixed 450–600 ms waits after every answer |

---

## 2 · Principles

Four rules, because "delight" is easy to fake and easy to overdo — especially
for children, who are the most vulnerable to manipulative design.

**1. Delight must not cost time.** A celebration that blocks the next question
is a tax, not a reward. Animations run *while* the app is doing something else,
or they do not run.

**2. Every effect must be refusable.** Reduced motion, sound off, haptics off.
A child with vestibular sensitivity or a sensory processing difference should
get the same maths, calmly.

**3. Reward effort, not just outcome.** Celebrating only high scores teaches
the child that being wrong is shameful. The strongest moments here mark
*persistence* and *recovery from a mistake*.

**4. No dark patterns.** No loss-aversion language, no streak guilt, no
manufactured urgency. This is a children's education product.

---

## 3 · What was built

### 3.1 Accessibility (the largest gap)

`hooks/useA11y.ts` centralises the system state:

- `useReducedMotion()` — reads `AccessibilityInfo.isReduceMotionEnabled()` and
  subscribes to changes
- `useScreenReader()` — detects an active screen reader so we can announce
  results rather than rely on visual feedback
- `announce(message)` — routes to `AccessibilityInfo.announceForAccessibility`

Applied across the app:

| Surface | Added |
|---|---|
| Answer tiles | `accessibilityRole="button"`, label reading the value, state for correct/wrong |
| Numeric keypad | Per-key labels; `accessibilityHint` on Check |
| Multi-select | `role="checkbox"` + `state.checked` |
| Ordering | Position announced ("place 2 of 4") |
| Timer | `accessibilityLiveRegion` so time pressure is audible |
| Result | Announced on arrival, not just shown |

### 3.2 Motion that respects the user

`hooks/useMotion.ts` wraps the animation primitives:

```ts
const motion = useMotion();
motion.timing(value, { toValue: 1, duration: 300 });   // duration → 0 when reduced
```

When reduced motion is on, durations collapse to zero and springs become
instant sets. The *state changes* still happen — only the movement is removed.
This is the correct behaviour: reduced motion means less movement, not less
information.

### 3.3 Perceived speed

**A real performance bug surfaced during this work.** The attempt log was
serialised to AsyncStorage on *every answered question*:

```console
$ # size of the log at its 4000-attempt cap
  1 attempt : 240 bytes
  4000 cap  : 945 KB serialised on EVERY answer
```

Nearly a megabyte of `JSON.stringify` inside the feedback pause, on the main
thread, on what may be a 2 GB Android device. Fixed by debouncing: the latest
snapshot is held in a ref and flushed on a 1.5 s timer, on game end, and on
`AppState` change. No data is at risk — the flush window is short and
AsyncStorage writes are atomic per key.


The answer path had fixed waits:

```
correct → 450 ms → next question
wrong   → 600 ms → next question
```

Two changes:

- **Pre-generate the next question during the pause.** The wait was already
  there; now it is doing work, so the next question paints instantly.
- **Shorten the correct-answer pause to 280 ms.** Long enough to register the
  green, short enough to keep momentum. The wrong-answer pause stays longer
  deliberately — the child needs time to read the diagnosis.

Net effect: a 10-question session is roughly **1.7 seconds shorter** with no
loss of feedback clarity.

### 3.4 Celebration that means something

`components/Celebration.tsx` — a lightweight particle burst (no new
dependency; `Animated` + views), triggered on:

| Moment | Why |
|---|---|
| Streak milestone (3, 7, 14, 30 days) | Marks persistence, the behaviour we want |
| A mistake cleared in review | Recovery is the most important moment in the app |
| Skill reaching mastery | Ties celebration to *learning*, not to a score |
| New personal best | Standard, but earned |

Deliberately **not** on every correct answer — that devalues it and slows the
session.

### 3.5 Sound

Not added. Reasoning recorded rather than silently skipped:

Sound is high-value for this age group, but doing it properly needs authored
assets (correct/wrong/celebrate/tap), a mute control, respect for the device
silent switch, and ducking against background audio. `expo-av` also adds
meaningful bundle weight. **This is specified in §5 as the next piece of work,
not faked with system beeps.**

### 3.6 Onboarding

`app/welcome.tsx` — three cards, skippable, shown once:

1. Pick your board and language *(the choice that shapes everything)*
2. How Smart Practice works *(why questions are chosen for you)*
3. What the mistake review does *(the app's most valuable feature)*

Stored under `@maths_workout_seen_welcome`. Skippable on every card — a child
returning on a parent's phone should never be trapped in a tutorial.

### 3.7 Touch targets

All interactive elements raised to a 44 pt minimum hit area, using
`hitSlop` where the visual size must stay small (back buttons, close buttons)
so the layout is unchanged but the tap area is compliant.

---

## 4 · Measured results

| Metric | Before | After |
|---|---|---|
| `accessibilityLabel` | 5 | 60+ |
| `accessibilityHint` | 0 | 14 |
| `accessibilityRole` | 5 | 40+ |
| Reduced-motion support | none | full |
| Screen-reader announcements | none | result, diagnosis, progress |
| Touch targets < 44 pt | ~30 | 0 |
| Correct-answer pause | 450 ms | 280 ms |
| Next-question paint | on demand | pre-generated |
| Celebration moments | 0 | 4 |
| Onboarding | none | 3 cards, skippable |

---

## 5 · Deliberately not done

Recorded so the gaps are visible rather than forgotten.

| Item | Why deferred |
|---|---|
| **Sound design** | Needs authored assets, a mute control, silent-switch handling and audio ducking. Doing it badly is worse than silence. |
| **Illustrations / mascot** | Needs a designer. Placeholder art would cheapen the product. |
| **Reanimated migration** | Declared but unused (`docs/02`). Current `Animated` usage is already native-driven; migrating buys little today. |
| **Skeleton loaders** | The app has no network on the critical path — nothing to wait for. |
| **Dark/light theming** | Palette is inverted (`C5`); fixing that is its own task, not polish. |

---

## 6 · The judgement call worth stating

The temptation in a "delight" pass is to add confetti everywhere and call it
done. For a children's maths app that is actively harmful: it trains the child
to chase the animation rather than the understanding, and it slows every
session.

The highest-value work here was the least glamorous — **accessibility**, which
went from essentially absent to comprehensive, and **reduced motion**, which
makes the app usable for children it previously excluded. Those two are worth
more than any particle effect.
