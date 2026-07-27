# 09 · Improvement Directions

> **Scope.** Doc 06 is the *repair* backlog — the ordered list of things that
> are broken. This document is different: it asks **where this product could
> go** as a standalone mathematics practice app, and what each direction costs.
>
> Directions are independent. You are not meant to do all of them. Pick one or
> two and go deep — a drill app that does one thing excellently beats one that
> does six things adequately.

---

## The single most important finding

Before the directions, one verified fact that constrains almost all of them:

```console
$ grep -rn "Date\.\|new Date\|timestamp" --include=*.ts --include=*.tsx .
  NONE — no time data recorded at all

$ grep -rn "performance.now\|responseTime" …
  NONE

$ grep -rn "streak\|daily\|today" …
  NONE
```

**The app has no concept of time.** It records *that* a question was answered
correctly, never *when*, and never *how long it took*.

This is the highest-leverage gap in the codebase. A single field added to the
data model unlocks, directly or indirectly:

| Blocked today | Needs |
|---|---|
| Streaks and daily goals | a date per session |
| Spaced repetition | a timestamp per skill attempt |
| Forgetting-curve decay | timestamps |
| "You've improved 12% this week" | timestamps |
| Fluency measurement (speed as mastery) | response latency |
| Retention analytics / churn detection | timestamps |
| Detecting guessing (implausibly fast answers) | response latency |

The cost is roughly **half a day**. The unlock is four of the six directions
below. If you do nothing else from this document, do this.

```ts
// today
interface StatEntry { attempted: number; correct: number }

// the change
interface Attempt {
  skill: string;
  correct: boolean;
  answeredAt: number;      // epoch ms   ← unlocks streaks, SRS, decay, trends
  latencyMs: number;       // ← unlocks fluency, guess detection
  chosenAnswer: string;    // ← unlocks misconception analysis (Direction D)
}
```

Store attempts as an append-only log and *derive* the aggregates. You can always
compute `{attempted, correct}` from a log; you can never recover a log from
`{attempted, correct}`.

---

## Direction map

```
                        HIGH IMPACT
                             │
        D. Diagnostic  ●     │     ● C. Mastery Engine
          (moat)             │        (retention + efficacy)
                             │
        F. Classroom  ●      │  ● B. Retention Loop
          (revenue)          │    (cheapest real win)
                             │
    ─────────────────────────┼─────────────────────────  EFFORT
                             │
        E. Content     ●     │     ● G. Polish & Trust
           Platform          │
        (unlocks CBSE)       │
                             │
                        LOW IMPACT
```

---

## Direction A · Fix and ship *(prerequisite, not a strategy)*

Everything in doc 06 Phases 0–1. Roughly **1.5 days**.

Not a direction — a precondition. The app does not currently install
(doc 04, C1–C3), 60-second Blitz is capped at 10 questions (C4), and learners
are shown `29.999999999999996` as a money answer (C8).

**Do this first regardless of which direction you choose.** Nothing below is
worth building on a foundation that fails `pnpm install`.

---

## Direction B · The Retention Loop
### *Cheapest real win · ~1 week · high impact*

The app's tagline is *"Train your mental arithmetic every day"* — but nothing
in the product supports a daily habit. There is no streak, no reminder, no
sense of a session having happened *today*.

**Build:**

| Feature | Notes |
|---|---|
| Daily streak | The single most proven retention mechanic in education apps |
| Daily goal | "10 questions a day" — small, achievable, visible |
| Streak freeze / forgiveness | Critical for children; one missed day shouldn't destroy 40 days of effort |
| Local notification | One per day, at a parent-configured time. Local only — no server needed |
| Weekly summary | "You practised 5 days and answered 87 questions" |
| Session history | A simple calendar heatmap |

**Why it works.** Retention is the entire business of a practice app. A child
who returns daily for 60 days learns vastly more than one who binges once. This
direction changes the product's *behaviour loop*, not its content.

**Cost:** ~1 week, and it is almost entirely gated on the timestamp change above.

**Risk:** streak mechanics can create anxiety and guilt in children. Mitigate
with generous forgiveness rules, no loss-aversion language, and a parent
setting to disable streaks entirely.

---

## Direction C · The Mastery Engine
### *Highest educational impact · ~3 weeks*

Replace "practice random questions in a category" with "practise what you're
about to forget, at the edge of what you can do."

**Build:**

1. **A skill model, not a category list.** Today a skill is a string like
   `3rd_multiplication_medium`. Replace with named skills
   (`multiply-2digit-by-1digit`) carrying an explicit mastery estimate.

2. **Spaced repetition.** A simple SM-2 or Leitner scheduler over skills.
   Practise what is due, not what is random. This is the single
   best-evidenced intervention in all of learning science, and it is
   *cheap* — a few hundred lines.

3. **Mastery decay.** A skill practised once in March is not mastered in June.
   Decay the estimate over time and resurface it.

4. **Adaptive difficulty.** The app already collects per-topic accuracy and
   does nothing with it. Use it: keep the learner in the 70–85% success band
   where learning is fastest, and stop making them choose easy/medium/hard.

5. **Prerequisite awareness.** Fraction addition failing because equivalence
   isn't secure should route the child *back* to equivalence, not repeat the
   failure.

**Why it matters.** This converts the app from a *worksheet dispenser* into
something that genuinely adapts. It is also the honest answer to "does this
app actually work?" — you can measure learning gain per skill.

**Cost:** ~3 weeks. Requires the timestamp change and the skill-model refactor.

**Risk:** the difficulty selector becomes redundant, which is a UX change
parents may notice. Keep a manual override.

---

## Direction D · The Diagnostic
### *Strongest differentiation · ~4 weeks*

Nobody in this market does this well, and it is the most defensible thing the
product could build.

Today, a wrong answer records only *that* the child was wrong. But maths errors
are **systematic and diagnosable**:

| Child answers | Misconception | Targeted remediation |
|---|---|---|
| `1/2 + 1/3 = 2/5` | Adds numerators and denominators | Equivalence before addition |
| `43 − 27 = 24` | Subtracts smaller digit from larger, per column | Regrouping |
| `0.5 < 0.45` | "More digits means bigger" | Decimal place value |
| `6 × 0 = 6` | Treats 0 like the identity for × | Zero property |

**Build:**

1. **Capture the wrong answer's structure** — currently `chosenAnswer` is
   discarded after scoring.
2. **A misconception library** — named error patterns per skill, each with a
   detection rule and an intervention.
3. **Deliberate distractors.** Right now distractors are random offsets
   (`makeIntChoices` adds ±spread). Instead, make each distractor *diagnostic*
   — the answer a child gets from a specific misconception. Then the wrong
   answer tells you which one they hold.
4. **Typed input for some questions.** Verified: there is no `TextInput`
   anywhere — the app is 100% multiple choice. Free-response reveals far more
   than a 1-of-4 pick, and removes the "eliminate the odd one out" strategy
   (doc 05 showed the half-integer triangle-area answers are identifiable
   *without doing the maths*).
5. **A parent-facing explanation** — "Aarav is confident with addition but
   consistently forgets to regroup when subtracting. Here's what to practise."

**Why it matters.** "Your child got 68%" is worthless to a parent.
"Your child has a specific, fixable misconception about regrouping, and here's
the fix" is worth paying for. This is the most compelling thing a practice app
can offer, and it compounds — every session improves the library.

**Cost:** ~4 weeks. Depends on capturing `chosenAnswer`.

---

## Direction E · The Content Platform
### *Unlocks the Indian market · ~3 weeks*

Two verified facts sit uncomfortably together:

```console
$ grep -c "€" generators/   →  13
$ grep -c "₹" generators/   →   0
$ grep -rn "Irish" generators/index.ts
  // Based on Irish primary school curriculum
```

**The app teaches the Irish primary curriculum in euros.** If the intended
audience is Indian (CBSE), the content is currently wrong for the market — a
product problem, not a code problem.

Separately, all **182 question templates are hardcoded JavaScript closures**
with zero content data files. That means:

- Only an engineer can add or edit a question
- Every content change requires an app-store release
- Localising to another curriculum means editing code
- The content cannot be reviewed by a teacher

**Build:**

1. **Content as data.** Move templates from closures to validated JSON/YAML,
   with a schema and CI validation (the fuzz harness in doc 05 becomes the
   quality gate).
2. **Curriculum as a swappable layer.** `CLASS_TOPICS` becomes one of several
   curriculum maps: CBSE, ICSE, Irish, UK KS1/KS2.
3. **Localise currency, names and contexts.** ₹ not €; Aarav and Priya, not
   Tom and Jane; cricket scores, not euros saved per week.
4. **Language support.** Hindi first, then regional languages. Maths practice
   in a child's first language is measurably more effective in early primary.

**Why it matters.** This is the difference between a hobby project and a
product with a market. It also decouples content velocity from engineering
throughput — the constraint that will otherwise cap growth permanently.

**Cost:** ~3 weeks for the pipeline, plus ongoing curriculum work (which is
the real cost, and is not engineering).

---

## Direction F · The Classroom Product
### *Clearest revenue path · ~6 weeks · requires a backend*

Direct-to-parent education apps have brutal churn. Schools don't churn.

**Build:**

1. Rebuild the backend deleted in the "Clean project history" commit
   (doc 03) — **with the authentication the original design lacked.**
2. Teacher accounts, class rosters, student profiles.
3. Assignment flow: "Class 4B, fractions, by Friday."
4. A teacher dashboard showing per-skill mastery across a class — *which
   children are stuck, and on what*.
5. A parent view: weekly progress, specific next steps.

**Why it matters.** Higher contract value, dramatically lower churn, and the
per-skill data from Direction C/D is exactly what teachers want and cannot get
elsewhere. Ten schools is a business; ten thousand individual parents is a
marketing problem.

**Cost:** ~6 weeks minimum, and it changes the company — you acquire
compliance obligations (DPDP Act, COPPA/GDPR-K), support load, and a sales
motion.

**Hard prerequisite:** identity and auth done properly. The previous sync
design took the device UUID straight from the URL path with no authentication
(doc 02 §6) — anyone could read or overwrite a child's data. That must not
carry forward into a product holding classroom rosters.

---

## Direction G · Polish and Trust
### *Underrated · ~2 weeks*

Not glamorous, but this is what separates apps parents keep from apps they
delete.

| Item | Why | Ref |
|---|---|---|
| **Make timers optional** | Timed testing is among the strongest correlates of maths anxiety, worst in early primary. It is currently mandatory on every question. | doc 04 |
| **Fix the inverted palette and ship real dark mode** | `colors.light` contains dark values; `useColors()` is never called by any screen. | C5 |
| **Accessibility** | No `accessibilityLabel` anywhere. Screen-reader support, dynamic type, 44pt touch targets, reduced-motion. | doc 06 |
| **Teach, don't only test** | The app exclusively assesses. Add a worked example after repeated failure — a child who can't do fractions currently just learns they're bad at fractions. | doc 05 |
| **Kill duplicate questions** | Class 1 easy addition has only 16 possible questions → ~97% chance of a repeat in a 10-question set. | F8 |
| **Fix the difficulty curve** | "Hard" is not harder than "medium" in 6 of 24 measured cells. | F4 |
| **Compress the 1.1 MB icon** | Shipped twice, byte-identical, for 2.2 MB total. | C14 |

**Why it matters.** Anxiety-inducing, inaccessible, repetitive practice is
worse than no practice. This direction is mostly about *removing harm*, which
is a legitimate and often-skipped form of improvement.

---

## Effort / impact summary

| Direction | Effort | Impact | Needs backend? | Depends on |
|---|---|---|---|---|
| A · Fix and ship | 1.5 days | — *(prerequisite)* | no | — |
| B · Retention loop | 1 week | High | no | timestamps |
| C · Mastery engine | 3 weeks | Very high | no | timestamps, skill model |
| D · Diagnostic | 4 weeks | Very high *(moat)* | no | chosen-answer capture |
| E · Content platform | 3 weeks | High *(market fit)* | no | — |
| F · Classroom | 6 weeks+ | High *(revenue)* | **yes** | C or D to be useful |
| G · Polish and trust | 2 weeks | Medium *(retention)* | no | — |

Note that **B, C, D, E and G need no server at all.** The app can become
substantially better while remaining fully offline — which suits the target
market well.

---

## Recommended sequence

If I had to pick one path:

```
Week 1        A  ·  Fix and ship            (unblock everything)
Week 1        ★  Add timestamps + attempt log   (half a day, unlocks B/C/D)
Week 2        B  ·  Retention loop          (cheapest real win)
Weeks 3–5     C  ·  Mastery engine          (the product actually adapts)
Weeks 6–9     D  ·  Diagnostic              (the differentiator)
Parallel      E  ·  CBSE + ₹ + Hindi        (curriculum work, not engineering)
Ongoing       G  ·  Polish                  (fold in continuously)
Later         F  ·  Classroom               (only after C+D prove value)
```

**Rationale.** B is cheap and compounds immediately. C and D are what make the
app genuinely good, and D is the only thing here that competitors can't
trivially copy. E runs in parallel because it is curriculum work, not
engineering, and can be done by a different person. F comes last because
selling to schools is only credible once you have something worth selling —
the per-skill mastery data from C and D *is* the product for a teacher.

---

## What I would explicitly not build

Worth stating, because these are tempting:

| Tempting | Why not |
|---|---|
| **More question categories** | 23 already exist and 6 of 24 difficulty cells are miscalibrated. Depth beats breadth. |
| **Leaderboards / social comparison** | Demotivates exactly the struggling children who most need to keep practising. |
| **Heavy gamification** (coins, gacha, energy timers) | Extrinsic rewards reliably erode intrinsic motivation for learning, and monetising children's attention is an ethical and regulatory risk. |
| **Cloud sync before auth** | The previous design had none. Do not rebuild an unauthenticated endpoint holding children's data. |
| **A web version** | `react-native-web` is already a dependency, so it looks cheap. It isn't — it doubles the QA surface for an audience that is overwhelmingly on mobile. |

---

## The honest summary

As it stands, this is a **competent drill app with no memory of time, no model
of the learner, content for the wrong country, and multiple choice as its only
interaction.**

The good news is that the fixes are unusually well-ordered: one small data-model
change (timestamps + an attempt log) unlocks the two directions that matter
most, and the pure `generators/` layer means the pedagogy can be improved
without touching the UI.

The most valuable thing you could do in the next month is not add features. It
is:

1. Make it install *(1.5 days)*
2. Start recording *when* and *how long* and *what they chose* *(half a day)*
3. Use that data to practise the right thing at the right time *(3 weeks)*

That is a meaningfully better product than 90% of what is in this category —
without a backend, without a rebuild, and without a single new question type.
