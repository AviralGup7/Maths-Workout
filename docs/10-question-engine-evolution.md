# 10 · Question Engine Evolution

> **Status.** Plan + implementation record. Phase 1 and Phase 2 are **built and
> tested**; Phases 3–5 are specified for later work.

---

## 1 · The problem

The app has 21 generators covering 23 categories — and exactly **one way to
answer anything**:

```ts
interface Question {
  questionText: string;
  answer: ChoiceValue;
  choices: ChoiceValue[];   // ← always 4 tiles, always tap one
}
```

```console
$ grep -rln "TextInput" app/ components/
  none — 100% multiple choice
```

Everything — counting, fractions, place value, geometry, algebra — is squeezed
through "read text, tap one of four." That single decision causes four distinct
problems:

**a) It teaches elimination, not mathematics.** With the answer visibly present,
the optimal strategy is often "which of these looks right" rather than
computing. Doc 05 documented the extreme case: triangle-area answers were
half-integers while every distractor was an integer, so the correct tile was
identifiable *without doing any maths*.

**b) It caps diagnostic resolution.** A learner picks one of four. Even with
diagnostic distractors (Direction D), we only learn which of three faulty rules
they *might* hold. A typed answer reveals what they actually computed — the
space of wrong answers is unbounded and far more informative.

**c) Some mathematics is not expressible as a list.** "Put these in order",
"how many groups of 4 fit in 12", "shade one third", "is the scale balanced" —
these are natural mathematical acts that a 4-tile grid cannot represent.

**d) It is monotonous.** Twenty identical interactions per session. Variety of
*interaction* is a retention lever we currently do not pull.

---

## 2 · Design principle

> **Add interaction types, not just more question text.**

The unit of expansion is the **input modality** — the physical act the child
performs. Each new modality unlocks whole families of questions and improves
diagnosis, because the *shape* of a wrong action reveals the mental model.

We deliberately keep the change additive: `Question` gains an optional
`interaction` field. Anything without one renders as multiple choice exactly as
before, so all 21 existing generators keep working untouched.

---

## 3 · The interaction taxonomy

| # | Type | Child does | Unlocks | Diagnostic gain | Phase |
|---|------|-----------|---------|-----------------|-------|
| 1 | `choice` | Taps one of 4 | *(existing)* | Low — bounded to 3 wrong options | — |
| 2 | `entry` | Types the answer | All arithmetic, at higher fidelity | **High** — unbounded wrong-answer space | **1 ✅** |
| 3 | `multi-select` | Taps all that apply | Factors, primes, multiples, properties | Medium — partial credit reveals partial understanding | **2 ✅** |
| 4 | `ordering` | Drags into sequence | Comparing, place value, fractions, decimals | High — inversion count measures how wrong | **2 ✅** |
| 5 | `number-line` | Taps/drags a position | Magnitude, rounding, negatives, fractions | High — distance from target is a continuous error signal | 3 |
| 6 | `partition` | Splits a shape/set | Fractions, division, sharing | High — the concrete stage of CPA | 3 |
| 7 | `array-builder` | Builds rows × columns | Multiplication, area, factors | High — shows whether they grasp the array model | 4 |
| 8 | `balance` | Adds/removes to balance | Equations, algebra | High — models equality as a relation | 4 |
| 9 | `steps` | Solves in stages | Multi-step word problems, long division | **Very high** — isolates *which step* fails | 5 |

Phases 1–2 are implemented. Phases 3–5 are specified below and deliberately
deferred — they need gesture handling and custom drawing, which is a
significantly larger surface than the input work.

---

## 4 · Architecture

### The `interaction` discriminated union

```ts
type Interaction =
  | { kind: 'choice' }                                        // default; may be omitted
  | { kind: 'entry';       inputMode: 'integer' | 'decimal'; unit?: string }
  | { kind: 'multiSelect'; options: ChoiceValue[]; correct: ChoiceValue[]; minRequired?: number }
  | { kind: 'ordering';    items: ChoiceValue[]; correctOrder: ChoiceValue[]; direction: 'asc' | 'desc' };
```

`Question` gains one optional field:

```ts
interface Question {
  questionText: string;
  answer: ChoiceValue;
  choices: ChoiceValue[];        // still populated for `choice`; empty otherwise
  resolvedCategory?: Category;
  distractorMap?: Record<string, string>;
  interaction?: Interaction;     // ← absent means multiple choice
}
```

**Why a union rather than separate question types?** Because the surrounding
machinery — scheduling, mastery, the attempt log, diagnosis — must treat all
interactions uniformly. A session interleaves types freely; the learner model
does not care how an answer was entered, only whether it was right and what was
produced. The union keeps one pipeline.

### Answer normalisation

Every interaction reduces to a comparable string so the existing
grading/logging path is unchanged:

| Type | Normalised form | Example |
|------|-----------------|---------|
| `choice` | the chosen value | `"24"` |
| `entry` | trimmed numeric string | `"24"` |
| `multiSelect` | sorted, comma-joined | `"2,3,5"` |
| `ordering` | comma-joined in placed order | `"3,7,12,20"` |

This is why `submitAnswer` and the attempt log needed **no changes at all** —
a design goal, not a coincidence.

---

## 5 · Implemented: Phase 1 — Typed entry

**The most important addition.** Removes the answer from the screen.

```ts
// generators/interactions.ts
export function entryQuestion(text: string, answer: number, opts?): Question
```

Applied to arithmetic when mastery is high enough that recognition is no longer
the bottleneck — see §7 for the fade-in policy.

### Diagnostic payoff

With four tiles, a learner who computes `43 − 27 = 24` can only be detected if
`24` happens to be among the distractors. With typed entry, **every** wrong
answer is observable, so `diagnose()` sees the real computation. The
misconception library (doc 09 · Direction D) becomes far more effective.

### Accessibility and UX notes

- Numeric keypad, custom-built rather than the OS keyboard: predictable layout
  for children, no autocorrect, no keyboard-dismiss pitfalls.
- Large 60pt targets, clear delete, explicit submit.
- No auto-submit on digit count — a child typing `12` for answer `1` must not
  be graded early.

---

## 6 · Implemented: Phase 2 — Multi-select and ordering

**Multi-select** ("tap all the factors of 12") is the natural form for factors,
primes, multiples and classification. It also yields *partial* credit
information: selecting `{1,2,3,4,6}` but missing `12` is very different from
selecting `{5,7,9}`.

**Ordering** ("drag smallest to largest") is the natural form for comparison,
place value, decimals and fractions. Its diagnostic signal is unusually rich:
the **inversion count** measures *how* wrong the ordering is, and the specific
pattern often identifies the misconception directly — e.g. ordering
`0.45 > 0.5` is the "more digits means bigger" error.

Implementation uses tap-to-place rather than drag-and-drop. Tap-to-place is
more reliable on small screens, works without gesture handlers, and is more
accessible.

---

## 7 · The interaction ladder (how types are chosen)

New interaction types are **not** applied uniformly. They fade in as mastery
grows, which is itself pedagogically motivated: recognition precedes recall.

```
mastery < 0.55   →  choice          scaffolded; the answer is visible
0.55 – 0.80      →  choice + multiSelect / ordering where the topic suits
mastery > 0.80   →  entry preferred; recall without cues
```

This is deliberate. Forcing typed entry on a struggling learner increases
frustration and failure without improving learning. Withholding it from a
confident learner leaves them practising a strategy — elimination — that does
not transfer.

Implemented in `pickInteraction(skill, mastery, category)`.

---

## 8 · UI change plan

### Screens affected

| Screen | Change | Status |
|--------|--------|--------|
| `game.tsx` | Render by interaction type; keep timer/progress/diagnosis shared | ✅ built |
| `components/answer/ChoiceGrid.tsx` | Extracted from existing inline grid | ✅ built |
| `components/answer/NumericEntry.tsx` | Keypad + display + submit | ✅ built |
| `components/answer/MultiSelect.tsx` | Toggle chips + confirm | ✅ built |
| `components/answer/OrderingTray.tsx` | Tap-to-place sequence builder | ✅ built |
| `progress.tsx` | Unchanged — interactions are invisible to the learner model | ✅ n/a |
| `mistake-review.tsx` | Still multiple choice by design (see below) | ✅ n/a |

### Why the game screen splits

Before, `game.tsx` owned the entire answer surface inline. With four
interaction types that becomes unmaintainable. The refactor extracts a single
boundary:

```
game.tsx                          owns: timer, progress, question text,
   │                                    feedback, diagnosis, advance logic
   └── <AnswerSurface />          owns: dispatch on interaction.kind
         ├── ChoiceGrid
         ├── NumericEntry
         ├── MultiSelect
         └── OrderingTray
```

Every surface exposes the same contract:

```ts
interface AnswerSurfaceProps {
  question: Question;
  locked: boolean;                       // post-answer, awaiting advance
  onSubmit: (normalised: string) => void;
  palette: Palette;
}
```

`game.tsx` therefore needs **no knowledge** of any interaction type. Adding
Phase 3–5 types means adding a component and a case — no changes to timing,
scoring, logging or diagnosis.

### Deliberate UI decisions

- **Mistake Review stays multiple choice.** It re-presents past errors; the
  learner has already produced the wrong answer once. Recognition is the right
  affordance for a review drill, and it keeps that screen simple.
- **The timer is not shown for `entry`.** Typing takes longer than tapping;
  applying the same 15s budget would punish the harder modality. (See doc 09
  Direction G on timers and maths anxiety — the wider fix is making timers
  opt-in.)
- **Feedback is uniform across types.** Same correct/wrong colours, same shake,
  same diagnosis banner. Only the input differs.

---

## 9 · Phases 3–5 (specified, not built)

### Phase 3 — `number-line` and `partition`

Both need a drawing surface (`react-native-svg`, already a dependency) and
touch tracking. High value: they deliver the **concrete** stage of
Concrete→Pictorial→Abstract, which is the strongest pedagogical argument for a
screen over a worksheet.

- **Number line** — tap a position for magnitude, rounding, negatives,
  fractions. Error signal is continuous (distance), not binary.
- **Partition** — split a shape or set into equal parts. This is *the* natural
  representation for fractions and division, and directly targets the
  `frac.add-across` misconception.

### Phase 4 — `array-builder` and `balance`

- **Array builder** — drag to build rows × columns. Makes multiplication,
  area and factor pairs the same object, which is a genuine conceptual unlock.
- **Balance** — add/remove from two pans. Models `=` as a *relation* rather
  than "the answer goes here", which is the single most important idea for
  early algebra.

### Phase 5 — `steps`

Multi-step problems solved stage by stage, each stage graded. Highest
diagnostic value in the whole taxonomy: it identifies *which step* fails, so a
word-problem failure can be attributed to comprehension, operation choice, or
computation.

---

## 10 · Risks

| Risk | Mitigation |
|------|------------|
| Typed entry frustrates weaker learners | Mastery-gated ladder (§7); never below 0.80 |
| More interaction types → more surface to break | One shared contract; each type has invariant tests |
| Ordering/multi-select are slower per question | Fewer per session; used where they teach best |
| Partial credit complicates the learner model | Deliberately excluded — all types grade binary; partial data is captured in the attempt log for later analysis without changing mastery semantics |
| Scope creep into a game engine | Phases 3–5 gated behind evidence that 1–2 improve outcomes |

---

## 11 · What was actually built in this pass

```
generators/interactions.ts              interaction types + builders + ladder
generators/topics-interactive.ts        new generators using the new types
components/answer/AnswerSurface.tsx     dispatcher
components/answer/ChoiceGrid.tsx        extracted
components/answer/NumericEntry.tsx      new
components/answer/MultiSelect.tsx       new
components/answer/OrderingTray.tsx      new
app/game.tsx                            refactored to use AnswerSurface
```

Tests: `generators/__tests__/interactions.test.ts` (38) and
`learning/__tests__/session-variety.test.ts` (6), plus the existing invariant
suite extended with a four-choice check. **136 tests pass; typecheck clean.**

### Bugs this work surfaced and fixed

Building the engine exposed three defects that were invisible before:

1. **Mastered skills were never scheduled.** `buildSession` split candidates
   into "focus" and "confident", but sorted `new` above `maintain` — so a
   secure skill was never revisited. Two consequences: the mastery model
   decayed skills that the learner was never given a chance to refresh, and
   typed entry (gated on high mastery) could never appear. Fixed by reserving
   ~15% of every session for maintenance.

2. **Interactive question types were exclusive to Smart Practice.** The manual
   funnel called `generateQuestion` directly, so a learner choosing "Factors"
   from the menu never met "tap all the factors". Fixed by extracting
   `buildQuestion` and sharing it between both paths.

3. **The timer punished the harder modality.** Typing an answer was given the
   same 15 seconds as tapping a tile. Fixed with `secondsFor()` — 15s for
   choice, 45s for constructed response.

Additionally, `submitAnswer` was extended to accept an explicit grade. Composite
answers (`"2,3,6"`) cannot be compared against `q.answer` by string equality,
and the initial workaround would have written `__wrong__…` sentinel strings into
the learner's saved-mistakes list.
