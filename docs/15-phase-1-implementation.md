# 15 · Phase 1 Implementation

> **Status: HISTORICAL.** A design document for work that has shipped. The live backlog is `27-implementation-roadmap.md`.


**Input:** [14 · Educational Improvement Roadmap](./14-educational-improvement-roadmap.md), Phase 1.
**Status:** shipped. All five Phase 1 items implemented, tested and verified in a browser.

Doc 14 was design only. This document records what was actually built, what was
**measured** rather than asserted, and — importantly — the places where the
implementation deliberately diverges from the design.

---

## 0 · Summary

| # | Item | Design | Status |
|---|---|---|---|
| 1 | Scheduler: success floor, prerequisite descent, circuit-breaker, anti-inflation | §3 | ✅ Built |
| 2 | Optional timer, default off below Class 3 | §9 M1 | ✅ Built |
| 3 | Plausible distractors, ±25% cap | §5 A | ✅ Built |
| 4 | Worked examples on repeated failure | §1 | ✅ Built |
| 5 | Growth trend + process praise | §9 M2/M3 | ✅ Built |

**Tests:** 230 → **307** (77 added). Typecheck clean. Verified in Chromium.

### Files added

```
learning/adaptation.ts        M2/M3 — in-session adaptation, pure functions
learning/timerPolicy.ts       M1    — timer defaults by class
learning/feedback.ts          M2/M3 — growth trend and process praise
learning/workedExamples.ts    §1    — triggers, fade rules, 19 step solvers
components/WorkedExample.tsx  §1    — progressive-disclosure panel
learning/__tests__/{adaptation,feedback,workedExamples}.test.ts
```

---

## 1 · Measured results

Everything below was produced by executing code, not by reading it.

### Distractor plausibility (§5 A)

Instrumented over **197,631 numeric distractors** across every class, category
and difficulty:

```
                                    before        after
over the ±25% cap, untagged         100%*         0.86%
over the cap, misconception-tagged  —             8.88%   (intended)
```

\* the audit's measure was "≥1 eliminable option per question"; the after
figure is per-distractor, so these are not the same denominator — but the
eliminable-option problem is gone.

The residual 0.86% is a single structural case: questions whose answer is `0`
("How many corners does a Circle have?"), where a ratio cap is meaningless.
Misconception-derived distractors are *deliberately* exempt from the cap — a
distractor that is the output of a real faulty rule is plausible by
construction, which is the entire point of the diagnostic engine.

### Scheduler success floor (§3 M1)

Simulated struggling learner, 10 days × 10 questions, weak on `mul.tables.mid`:

```
                          floor off    floor on
projected success (mean)     ~0.58        ~0.65
weak-skill count (10 days)      2            5
realised accuracy            0.92         0.96
```

The weak skill is practised **more**, not less, with the floor on. That is the
correct direction and it was not obvious in advance — see §2 below for the two
bugs found while getting there.

### Timer policy (§9 M1) — verified in-browser

| preference | class | timer visible |
|---|---|---|
| auto | Class 1 | **false** ✅ |
| auto | Class 4 | true ✅ |
| on | Class 1 | true ✅ |
| off | Class 5 | **false** ✅ |

Blitz keeps its clock in every case: there the time limit *is* the activity the
child chose, and the distinction that matters is consent.

### Worked examples (§1) — verified in-browser

Triggered after two consecutive misses on `sub.2digit.borrow` with mastery
below 0.55. Rendered, stepped through, and served a twin:

```
23 − 7 = ?
① 3 is smaller than 7, so borrow 1 ten from the 2.    1 ¹3
② Now the ones are 13: 13 − 7 = 6.
③ Tens: 1 − 0 = 1.
④ So 23 − 7 = 16.                                     23 − 7 = 16
[ Got it ]  → twin question served
```

Hindi verified in the same flow, with **zero Devanagari digits** — the
semi-Hindi policy holds inside generated instructional text, which is the
hardest place to keep it.

---

## 2 · Bugs found and fixed during implementation

Four defects, three of which were introduced by this work and caught by
measurement rather than review.

### B1 · The success floor could delete the weak skill entirely

The first implementation swapped out whichever item had the lowest mastery,
repeatedly. On a session dominated by one weak skill it removed **every**
instance of it — the child stopped being shown the one thing they most needed.

An app that quietly abandons a learner's actual gap while reporting a healthy
success rate is worse than the problem it replaced. Fixed with two guards: a
skill may never lose its last remaining copy, and `reason: 'gap'` items (weak
skills that *block* other skills) are never swapped at all.

### B2 · The floor piled all relief onto one skill

Relief items were drawn from the single most secure skill, converting a
demoralising session into a monotonous one. Fixed by cycling through distinct
relief skills.

### B3 · A pre-existing 10.5% test flake, previously masked

`integration.test.ts > concentrates practice on the weak skill` failed
intermittently. Initially this looked like a regression from the scheduler
change. Measuring it properly on the **unmodified** code showed a **10.5%
failure rate over 200 runs** — it had always been flaky, and a short manual
re-run had simply got lucky.

Two fixes, and the second matters more than the first:

1. The simulation's RNG is now seeded (mulberry32), so runs are reproducible.
2. The assertion is now **statistical**. Measured over 300 seeds the weak skill
   outranks the median skill in ~86% of runs. The pedagogical claim is about a
   population of learners, not one trajectory, so asserting it per-run was
   asserting something the scheduler does not — and deliberately should not —
   guarantee, since interleaving varies every session.

### B4 · Process praise was unreadable

Browser testing showed the praise line was painted and then removed after
280 ms. This was invisible in code review and would have shipped as pure cost:
a render with no communicated information.

Fixed with a separate `correctPraised` (950 ms) budget, applied *only* when a
praise line is actually shown, so ordinary correct answers keep the fast path.

This exposed a second, latent problem: `feedbackDelay` clamps to 400 ms under
reduced motion, which would have made praise unreadable for exactly the users
who enable that setting — contradicting the module's own stated contract that
"reduced motion means less movement, not less information." Added
`readingDelay`, which preserves reading time regardless of the motion setting.

### B5 · The difficulty screen was never localised (pre-existing)

Found while testing Hindi worked examples: `difficulty-select.tsx` never
imported the i18n layer, so a Hindi-medium child met a fully English screen
mid-flow ("Set Up Game", "Easy", "10 Questions"). The strings already existed
in `i18n/strings.ts` — they had simply never been wired up. Now localised.

---

## 3 · Deliberate divergences from doc 14

Three places where the design did not survive contact with implementation.
Each is a judgement call worth flagging.

### D1 · The success floor is a target, not a guarantee

Doc 14 §3 M1 says "if `projected < 0.60`, swap the weakest items until it
clears." Implemented literally, this conflicts with the dilution cap: a learner
weak at *everything* in their session can only be lifted to 0.60 by replacing
so much of it that no remediation remains.

**The dilution cap wins.** `MAX_DILUTION_RATIO = 0.5` is a hard ceiling; the
floor raises success as far as it honestly can and then stops. The alternative
is an app that flatters children instead of teaching them. This is documented
in the constant's own comment so no future caller assumes attainment, and the
test asserts the improvement rather than the threshold.

### D2 · The anti-inflation guard clamps *to* 0.80, not below it

§3 M4 says mastery "may not exceed 0.80" on multiple-choice evidence. The
interaction ladder promotes to typed entry at `mastery >= 0.80`. Clamping below
0.80 would make the cap a permanent trap — the learner could never earn the
typed-entry evidence needed to escape it. Clamping exactly *to* 0.80 keeps the
gate passable. There is a test asserting precisely this.

### D3 · Worked examples cover 19 skills, not "the arithmetic spine plus"

Solvers exist only where there is a genuine *method* to show. Shapes, time and
data deliberately have none: a "worked example" for the number of sides on a
hexagon would dress memorisation up as procedure and teach the wrong lesson
about what mathematics is. `canTeach()` returns false for these, and the
scheduler falls through to ordinary practice.

---

## 4 · What was NOT done

- **Phases 2 and 3 are untouched.** No visuals, no number-sense strand, no
  scaffolding hierarchy, no parent card, no patterns, no error-hunting.
- **The scaffolding hint hierarchy (§4) is not built**, but its data model is:
  `Attempt.scaffolded` exists, is recorded, and already halves an attempt's
  weight in the mastery estimate. Worked examples set it. Hints will reuse it.
- **`hasFaded` is implemented and tested but not yet wired.** The 20-attempt
  cooldown currently does the suppression work. The fade rule is the more
  precise mechanism and should replace it when hints land.
- **No learning-gain measurement.** Doc 14 projects 6.4 → 7.4 for Phase 1.
  Nothing here validates that. These are engineering completions against a
  design, not evidence of improved learning outcomes — only a study with real
  children can supply that, and the projection should not be quoted as a
  result.
- **The inverted colour palette (docs/04 C5) remains unfixed**, still deferred
  as its own task.
- **Curriculum mapping still unreviewed by a practising Indian teacher.**

---

## 5 · Verification commands

```bash
cd artifacts/mobile
npx vitest run                          # 307 passed
npx tsc -p tsconfig.json --noEmit       # clean
npx expo export --platform web --output-dir /tmp/wb
```

Browser tests require an SPA fallback (Expo's static export has no server-side
routing), otherwise every route but `/` returns 404:

```python
class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        p = self.path.split('?')[0].lstrip('/')
        if p and not os.path.exists(p): self.path = '/index.html'
        return super().do_GET()
```

---

## 6 · Follow-on work: Phase 3 #13 and Phase 2 #7

Two further backlog items closed after Phase 1. Both were chosen because they
were **measured** gaps, not because they were next in the list.

### Diagnostic coverage — all 41 skills (Phase 3 #13)

**Measured before:** 24 of 41 skills had a misconception; **17 had none**. Half
the curriculum could detect *that* a child was wrong but never *why* — the
engine's differentiating capability was simply absent there.

**Now:** 43 of 43 (the two new number-sense skills included). 17 new
misconceptions with detection logic and Hindi copy:

```
count.miscount-by-one          mul.partial-product-dropped
count.skip-wrong-step          mul.place-shift-missing
add.nocarry-misaligned         frac.numerator-as-whole
ratio.treated-as-fraction      factors.multiple-not-factor
geometry.area-perimeter-swap   measurement.unit-conversion
data.mean-vs-median            data.forgot-divide
algebra.inverse-not-applied    wordproblems.wrong-operation
shapes.side-corner-confusion   time.sixty-not-hundred
money.change-not-subtracted
```

**The standard applied:** a misconception must have a *distinguishable numeric
signature*, not a plausible story. A misconception we cannot detect reliably is
worse than none, because it tells a child something false about their own
thinking. Two consequences of holding that line:

- `shapes.side-corner-confusion` only fires where sides and corners actually
  differ — a square has 4 of each, so "you counted the wrong one" is
  undetectable there and is not claimed. There is a test asserting it stays
  silent for squares.
- Guess detection still outranks pattern-matching. An answer in 300 ms was not
  reasoned, so attributing a specific faulty rule to it would be fiction.

### Number sense strand (Phase 2 #7)

**Measured before:** **0 estimation questions in 27,000 sampled** (0.00%) — the
largest single content gap in the product, and number sense is the strongest
early predictor of later mathematics achievement.

**Now:** four strands live — estimation, reasonableness, mental strategy and
cross-representation comparison — reaching ~1.2% of the whole question stream
and >15% of number-sense sessions.

**Estimation needed a new interaction kind, not a new generator.** Its grading
rule is genuinely different: the answer is a *range*, and any band overlapping
the true value is correct. Expressing that as a normal multiple-choice question
would have measured arithmetic-then-rounding, which is the opposite of the
construct.

Design details that carry pedagogical weight:

- **Operands are deliberately awkward** (47 × 8, not 50 × 8) so estimating is
  genuinely faster than computing. If the exact answer were easy the question
  would measure arithmetic.
- **Bands must be ≥15% wide** relative to their midpoint, asserted in tests, for
  the same reason.
- **The new skills are prerequisites, not extras.** `numsense.estimate` gates
  `add.3digit` and `mul.2digit`; `numsense.reasonable` gates `wordproblems`. The
  scheduler's existing prerequisite descent therefore routes a child to
  estimation automatically when their 3-digit addition falls apart — no new
  routing code.
- **Reasonableness questions have two options, not four.** Padding a genuine
  binary judgement to four with nonsense makes it easier, not harder.

### Bug found by browser testing

Estimation shipped a band of **`-10–100`** on a money question. Negative
quantities are nonsense to a child and quietly teach that a negative number of
notebooks is a plausible estimate. Distractor bands now never fall below zero;
when there is no room below, the extra bands go above. Regression test added.

The three unit-test suites that assumed *every* question has exactly four
`choices` were updated rather than weakened: four tiles is a property of the
**interaction**, not of every question.

**Tests:** 360 → **396**. Typecheck clean. Estimation verified answerable and
correctly graded in Chromium.
