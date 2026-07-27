# 14 · Educational Improvement Roadmap

**Input:** [13 · Learning Effectiveness Audit](./13-learning-effectiveness-audit.md), treated as validated.
**Task:** design the best solution to each weakness — not find new ones.
**Constraint:** this stays a focused mathematics *practice* app. Not a teaching
platform, not a game, not an LMS. Fast sessions, offline-first, low cognitive
load.

---

## 0 · Design doctrine

Five rules that every proposal below obeys. They exist because the obvious
solution to "the app doesn't teach" is to bolt on a teaching platform, and that
would destroy the product.

**D1 · Instruction is earned, not offered.** Nothing appears until the learner
has demonstrably needed it. No lessons, no intro videos, no "learn" tab. The
app stays a practice app; instruction appears *inside* the practice loop at the
moment of failure and disappears when it is no longer needed.

**D2 · Every intervention must terminate.** Any scaffold, visual or hint has an
explicit fade condition. Support that never withdraws produces dependence — the
scaffolding literature is unambiguous. If we cannot state when it disappears,
we do not build it.

**D3 · Adding a screen costs more than adding a question.** Session length is a
product feature. An intervention that adds 30 s to every session is worse than
one that adds 60 s to one session in ten.

**D4 · Reuse the existing seams.** The codebase already has the right joints:
`Interaction` (discriminated union), `Attempt` (append-only log), `SKILLS`
(prerequisite DAG), `grade()`. Every design below plugs into one of these.
Nothing here requires a new architecture.

**D5 · If it cannot be graded offline and deterministically, it does not ship.**
This rules out free-text explanation, LLM marking, and anything needing a
server. It shapes §7 heavily.

---

## 1 · Worked Examples

### Educational Goal
Convert a detected misconception into corrected procedural knowledge. Currently
the app names the error and moves on; the child repeats it. Worked examples are
the highest-leverage fix available (worked-example effect, d ≈ 0.57 for novices).

### Design Specification

**Trigger — narrow and evidence-gated.** A worked example appears only when
*all* hold:

```
· 2 consecutive misses on the same skill in this session, OR
  the same misconception detected twice in the last 5 attempts
· mastery(skill) < 0.55            (struggling, not slipping)
· no worked example for this skill in the last 20 attempts
```

The middle condition matters: a strong learner having a bad moment does not
need re-teaching, and interrupting them is patronising.

**Form — a solved instance of the question they just failed**, not a generic
lesson. Same operands, worked in steps, with the child's actual error named.

```
┌──────────────────────────────────────┐
│  Let's work this one through          │
│                                       │
│      4 3                              │
│  −   2 7                              │
│  ─────────                            │
│                                       │
│  ① 3 is smaller than 7.               │
│     Borrow 1 ten from the 4.          │
│                                       │
│      3 ¹3                             │
│  −   2  7                             │
│  ─────────                            │
│                                       │
│  ② 13 − 7 = 6                         │
│  ③ 3 − 2  = 1                         │
│  ─────────                            │
│         1 6                           │
│                                       │
│  You answered 24 — that happens when  │
│  the smaller digit is taken from the  │
│  larger one in each column.           │
│                                       │
│            [ Got it ]                 │
└──────────────────────────────────────┘
```

**Progressive disclosure.** Steps reveal one tap at a time. This is the
difference between a worked example and a wall of text: the child must act to
advance, which keeps attention engaged and lets them stop early if they see it.

**Immediate transfer.** On dismissal, the *next* question is a structurally
identical twin of the failed one (same skill, same difficulty, new operands).
This is the completion-problem step — the child applies what they just saw
while it is still in working memory. Success on the twin is what earns the fade.

**Disappearance.** Worked examples stop for a skill once the learner answers
2 consecutive twins correctly. They can return later if mastery decays and the
trigger fires again.

### UX Flow
```
answer wrong → diagnosis banner (existing)
  ↓  (2nd consecutive miss, mastery < 0.55)
worked example, step-by-step, tap to advance
  ↓  [Got it]
twin question, same structure, new numbers
  ↓  correct ×2 → suppressed for 20 attempts
  ↓  wrong     → descend to prerequisite skill (see §3)
```

### Learning Science Justification
Worked-example effect (Sweller, Cooper); completion-problem effect (Van
Merriënboer). Both are strongest for novices and *reverse* for experts — the
expertise-reversal effect — which is precisely why the mastery < 0.55 gate is
non-negotiable.

### Engineering Complexity — **Medium (2 wk)**
Steps are data, not prose: each skill gets a `solve(a, b)` returning an ordered
step list. Roughly 12 solvers cover the arithmetic spine. Renders through the
existing question surface; no new navigation.

### Risks
| Risk | Mitigation |
|---|---|
| Becomes passive reading | Tap-to-advance; ≤ 4 steps; twin question mandatory |
| Interrupts flow too often | Triple-gated trigger; 20-attempt cooldown |
| Child taps through without reading | Twin question is the check — it cannot be skipped |
| Content authoring burden | Solvers are parameterised, not per-question |

### Alternatives Considered
- **Video lessons** — rejected: breaks offline-first, breaks session length, turns the product into a teaching platform.
- **A "Learn" tab** — rejected: violates D1. Nobody visits it; the children who need it least are the ones who do.
- **Always show the method after a wrong answer** — rejected: expertise reversal; annoys competent learners and dilutes the signal.

### Final Recommendation
**Build.** Highest-ROI item in this document. Start with the 6 skills that
already have misconceptions and the highest failure volume.

---

## 2 · Visual Mathematics

### Educational Goal
Deliver the Concrete → Pictorial stage that the app currently omits entirely,
so that symbols acquire meaning rather than being manipulated blindly
(Skemp: relational vs instrumental understanding).

### Which concepts genuinely need a visual

This is the important judgement. Visuals are not free — they cost screen space,
render time and attention. The test: *does the symbol alone mislead?*

| Concept | Visual? | Reasoning |
|---|:--:|---|
| **Fractions** | ✅ **Essential** | `1/2 + 1/3 = 2/5` is only obviously wrong when you see the pieces |
| **Integers** | ✅ **Essential** | Negative magnitude is genuinely counter-intuitive; the number line *is* the concept |
| **Decimals** | ✅ **Essential** | Targets `dec.longer-is-bigger` directly — the misconception is spatial |
| **Place value** | ✅ **High** | Base-ten blocks are the canonical model; explains carrying/borrowing |
| **Multiplication** | ✅ **High** | Array model unifies ×, area and factors into one object |
| **Division** | ⚠️ **Medium** | Sharing/grouping visual helps early only; fades by Class 5 |
| **Geometry** | ✅ **Essential** | Area/perimeter without a shape is meaningless recall of a formula |
| **Algebra** | ❌ **No** | Balance model is powerful but Class 6 algebra here is single-step; symbols suffice |
| **Times tables** | ❌ **No** | Goal is automaticity. A visual *slows* retrieval — actively counterproductive |
| **Word problems** | ❌ **No** | Building the mental model from text is the skill being trained |

Four primitives cover everything marked essential/high:

```
NumberLine   → integers, decimals, magnitude, rounding, fractions
PartModel    → fractions (bar + circle + set)
ArrayGrid    → multiplication, area, factors
BaseTen      → place value, carrying, borrowing
```

All render in `react-native-svg`, **already a dependency** — no new package.

### Design Specification

Visuals attach to a question, they do not replace it. New interaction kind:

```ts
| { kind: 'visual';
    model: 'numberLine' | 'partModel' | 'arrayGrid' | 'baseTen';
    spec: VisualSpec;          // pure data, deterministic
    input: 'tap' | 'drag' | 'none' }   // 'none' = illustration beside a normal answer
```

Two modes, and the distinction matters:

- **Illustrative** (`input: 'none'`) — the visual sits above a normal question. Used while a concept is new.
- **Interactive** (`tap`/`drag`) — the visual *is* the answer. "Tap where 0.45 goes." "Shade two thirds." This is where the real learning happens, because the child's wrong action reveals their model.

### The fade rule (D2)

```
mastery < 0.55   →  visual always shown, interactive
0.55 – 0.80      →  visual shown, illustrative only
mastery > 0.80   →  no visual; symbolic only
```

Concrete → Pictorial → Abstract, driven automatically by the mastery model that
already exists. The child is never told they have "graduated" — it simply stops
appearing.

### UX Flow
```
fraction question, mastery 0.4
  ↓
[▓▓▓▓░░░░]  ← tap to shade
"Shade 1/2 of the bar"
  ↓ child shades 4 of 8 → correct
  ↓ mastery climbs past 0.55
next time: bar shown, but the question is symbolic
  ↓ mastery past 0.80
bar disappears
```

### Learning Science Justification
CPA / Bruner's enactive-iconic-symbolic progression; the Singapore Maths
model-method. Dual coding (Paivio) predicts better retention from paired
verbal + visual encoding. The fade is required by the expertise-reversal
effect — visuals that persist past mastery *reduce* performance.

### Engineering Complexity — **High (3 wk)**
Four SVG primitives, each with a spec type and a hit-test. `NumberLine` and
`PartModel` first: they cover fractions, decimals and integers, which is where
three of the app's five documented misconceptions live.

### Risks
| Risk | Mitigation |
|---|---|
| Visuals slow sessions | Only below mastery 0.80; automatic fade |
| Small screens | Fixed aspect ratios, max 4 partitions visible below Class 3 |
| Becomes a toy | Every visual carries a gradeable assertion; no free play |
| Accessibility | Each visual ships an equivalent text label and an accessible fallback question |

### Alternatives Considered
- **Static images per question** — rejected: not parameterisable, huge asset burden, cannot be interactive.
- **Animation of the procedure** — rejected: passive, and animation is worse than static for schema formation (transient information effect).
- **Visuals everywhere, always** — rejected: expertise reversal; slows fluent learners.

### Final Recommendation
**Build `NumberLine` and `PartModel` first.** Together they address fractions,
decimals and integers — three of five documented misconceptions — at roughly
half the cost of the full set.

---

## 3 · Adaptive Scheduler Redesign

### Educational Goal
Keep the learner in the productive band (~70–85% success) at all times. The
audit measured a struggling learner receiving 70% of their session on a skill
with ~5% expected success. That is the single most damaging finding in the
report, because it harms both learning *and* motivation.

### Design Specification — four mechanisms

**M1 · Success floor.** Before committing a session, project expected success:

```
projected = Σ mastery(skill_i) / n
```

If `projected < 0.60`, swap the weakest items for prerequisite or maintenance
work until it clears. Guarantees the child answers roughly 6 in 10 correctly,
whatever their state.

**M2 · Prerequisite descent — the key fix.** Currently a failing skill is
retried at lower operand size. That is the wrong axis: the child does not need
*smaller numbers*, they need *the missing prerequisite*.

```
2 consecutive misses on skill S
  → findRootGap(S)                    ← already exists in mastery.ts
  → if a weak prerequisite P exists:
        practise P, not S
        return to S only when mastery(P) > 0.70
  → if no prerequisite is weak:
        trigger a worked example (§1)
```

`findRootGap` is already implemented and currently only used for a progress-screen
label. This makes it load-bearing.

**M3 · Frustration circuit-breaker.** Three consecutive misses in a session →
force a confidence item (mastery > 0.85) before returning. Cheap, and it
prevents the failure spiral that the audit simulated.

**M4 · Anti-inflation guard.** Mastery may not exceed 0.80 on evidence that is
entirely multiple-choice. Recognition is not recall; a 4-option correct answer
carries ~25% guess probability. Promotion past 0.80 requires typed-entry
evidence. This also closes the loop with the existing interaction ladder.

### Over-practice
Add an upper bound to the existing spacing: a skill above 0.90 mastery is capped
at ~15% of any session. Ceiling effects waste session time that should go to
the frontier.

### UX Flow — invisible
The child sees no dial, no message, no "we've made this easier". They simply
notice the work is hard but doable. **Adaptivity the learner can perceive is
adaptivity that damages self-concept.**

### Learning Science Justification
Zone of proximal development (Vygotsky); desirable difficulty (Bjork) — the
band is roughly 70–85%, not "as hard as possible". Mastery learning (Bloom)
requires prerequisite security before progression, which is exactly M2.

### Engineering Complexity — **Low (1 wk)**
All four mechanisms are modifications to `buildSession` and `scheduleSkills`.
No new data, no new UI, no migration. **Best learning-per-hour ratio in this
document.**

### Risks
| Risk | Mitigation |
|---|---|
| Success floor hides real weakness | Weak skills still appear, just diluted; mastery still reports honestly |
| Prerequisite descent loops | Cap descent at 2 levels; then worked example |
| Slower progression | Correct trade: secure progress beats fast failure |

### Alternatives Considered
- **Simply lower difficulty on failure** — rejected: current behaviour; treats symptom not cause.
- **Let the child choose difficulty** — rejected: learners are poor judges of their own need, and choice under failure biases toward avoidance.

### Final Recommendation
**Build first.** One week, no dependencies, fixes the most harmful finding.

---

## 4 · Scaffolding System

### Educational Goal
Provide the minimum support that lets a child succeed *by their own reasoning*,
then remove it. Distinct from §1: worked examples show a completed solution;
scaffolds help the child produce their own.

### Design Specification — a strict three-level hierarchy

Hints are **earned by time, not requested on demand.** A visible "hint" button
invites help-avoidance in some children and help-abuse in others; both are
documented failure modes.

```
Level 0  (0–20 s)   nothing
Level 1  (after 20 s of no input)
         Orientation — reframes, gives nothing away
         "What do you need to do first?"
Level 2  (after 40 s, or 1 wrong attempt)
         Strategy — names the method, not the answer
         "The ones column needs regrouping."
Level 3  (after 60 s, or 2 wrong attempts)
         Directed — narrows to one step, still not the answer
         "Borrow 1 ten from the 4, making 13 ones."
         → beyond this: worked example (§1)
```

**Fading.** Each level's delay lengthens as mastery grows:

```
mastery < 0.55   →  20 s / 40 s / 60 s
0.55 – 0.80      →  35 s / 70 s / never reach L3
mastery > 0.80   →  no hints at all
```

**Dependence prevention.** Three rules:
1. Hints never contain the answer — L3 stops one step short.
2. A hinted correct answer contributes **half weight** to mastery. The estimate stays honest.
3. Hint usage is tracked per skill; heavy use triggers prerequisite descent (§3 M2) rather than more hints.

### UX Flow
A single line fades in beneath the question. No modal, no button, no
interruption. The child may ignore it entirely.

### Learning Science Justification
Contingent scaffolding (Wood, Bruner, Ross) — support calibrated to need and
withdrawn as competence grows. Time-triggered rather than request-triggered
avoids the help-seeking asymmetry: the children who most need help are least
likely to ask.

### Engineering Complexity — **Medium (2 wk)**
Hint text is one 3-tuple per skill (~41 skills, ~123 short strings), authored
alongside the existing misconception copy and translated to Hindi the same way.
Timer logic reuses the existing per-question timer.

### Risks
| Risk | Mitigation |
|---|---|
| Hint dependence | Half-weight mastery; no answer in any hint; automatic fade |
| Hints as time pressure | They appear calmly, never flash or animate |
| Authoring burden | 3 short lines per skill; bounded and one-off |

### Alternatives Considered
- **On-demand hint button** — rejected: help-avoidance in anxious learners, help-abuse in others.
- **Always show a hint** — rejected: eliminates productive struggle, which is where the learning is.

### Final Recommendation
**Build after worked examples.** They share the step-solver data, so sequencing
them together roughly halves the second one's cost.

---

## 5 · Assessment Improvements

### Educational Goal
Make a correct answer mean "understood" rather than "eliminated successfully".

### Design Specification

**A · Plausible distractors only.** Cap distance at 25% of the answer, and
prefer misconception-derived values. The audit measured 100% of questions
containing an eliminable option.

```
priority 1  misconception outputs (already built)
priority 2  ±1, ±10, digit-reversal, off-by-one-group
priority 3  random within ±25%          ← hard cap
```

**B · Free response as the default above 0.80** — already built via the
interaction ladder; the change is to *lower the threshold to 0.70* once
worked examples exist to catch the resulting failures.

**C · Confidence rating — only where it pays.** Not on every question; that
doubles interaction cost. Once per session, on one item:

```
"How sure are you?"     [ Sure ]  [ Not sure ]
```

The valuable cell is **confident-and-wrong** — the hardest misconception to
shift, because the child has no reason to revise. Flag it for priority
remediation.

**D · Partial credit — captured, not scored.** Multi-select and ordering
already produce partial data (`selectionAccuracy`, `inversionCount`). Log it;
do **not** feed it into mastery. Mastery must stay binary and interpretable;
partial data belongs in diagnosis.

**E · Reasoning capture without free text** — see §7.

### Learning Science Justification
Construct validity: an assessment must measure the intended construct, not
test-wiseness. Confidence-accuracy quadrants are well established in
metacognition research; confident-error is the highest-value diagnostic state.

### Engineering Complexity — **Low (3 days for A, 1 wk total)**
A is a change to `makeIntChoices`. C is one extra screen state per session.

### Risks
| Risk | Mitigation |
|---|---|
| Tighter distractors raise difficulty | Intended; offset by the §3 success floor |
| Confidence rating adds friction | Once per session only, two taps |

### Alternatives Considered
- **Remove multiple choice entirely** — rejected: it is a correct scaffold below mastery 0.55.
- **Score partial credit into mastery** — rejected: makes the estimate uninterpretable and inflates it.

### Final Recommendation
**Build A immediately** (3 days, pure win). C and D after Phase 1.

---

## 6 · Number Sense Framework

### Educational Goal
Build the intuition that lets a child know `47 × 8` is "about 400" before
computing, and recognise `0.45 < 0.5`. The audit found **0 of 1,720 questions**
involve estimation — the single largest content gap.

### Design Specification — five strands

| Strand | Question form | Skill |
|---|---|---|
| **Estimation** | "About how many? 300 / 400 / 600" | Magnitude before computation |
| **Comparison** | "Which is larger: 3/5 or 0.7?" | Cross-representation fluency |
| **Magnitude** | Tap where 0.45 sits on a 0–1 line | Spatial number sense |
| **Mental strategy** | "48 + 27: which is easier — (48+2)+25 or 40+20+8+7?" | Flexible decomposition |
| **Reasonableness** | "Ravi says 6 × 0.5 = 30. Is that sensible?" | Error detection |

**The estimation question type is the important one**, and it needs a different
grading rule: the answer is a *range*, not a value.

```ts
| { kind: 'estimate'; low: number; high: number; unit?: string }
```

Grading: correct if the answer falls in the band. This rewards approximate
reasoning and — critically — **punishes exact computation followed by rounding**,
because the band is offered as coarse buckets the child must choose between.

**Integration with mastery.** Number sense becomes 5 new skills in the existing
DAG, positioned as *prerequisites*, not extras:

```
numsense.estimate     →  prerequisite of  add.3digit, mul.2digit
numsense.magnitude    →  prerequisite of  dec.tenths, integers.basic
numsense.reasonable   →  prerequisite of  wordproblems
```

This is what makes them real: the scheduler will route to them automatically
when downstream skills fail, using machinery that already exists.

### Learning Science Justification
Number sense is the strongest early predictor of later mathematics achievement
(Jordan; Siegler). Estimation is the most frequently used adult mathematics
skill and the best cheap proxy for conceptual grasp.

### Engineering Complexity — **Medium (1.5 wk)**
One new interaction kind, five generators, five skill-graph nodes. The
magnitude strand depends on `NumberLine` from §2.

### Risks
| Risk | Mitigation |
|---|---|
| Children compute exactly then round | Coarse buckets + a shorter time budget make estimation the faster path |
| "About" feels like being marked wrong when right | Explicit framing: "Estimate — don't work it out" |

### Alternatives Considered
- **Estimation as a difficulty variant of existing topics** — rejected: it is a distinct construct and needs its own mastery track.

### Final Recommendation
**Build.** Highest-value content addition; small surface area.

---

## 7 · Mathematical Reasoning

### Educational Goal
Move beyond "what is the answer" to "why", "how do you know", and "is there
another way" — **without free text**, which cannot be graded offline (D5).

### Design Specification — four gradeable reasoning formats

**R1 · Method selection.** After a correct answer, occasionally:
```
"Which did you use?"
 [ I counted on ]  [ I knew it ]  [ I used a fact I know ]
```
No wrong answer. Self-explanation effect fires from the act of classifying, and
the response is a genuine strategy signal for the learner model.

**R2 · Error hunting.** Show worked solutions containing a planted error:
```
Priya worked out 43 − 27:
   Step 1  3 − 7 → she wrote 4
   Step 2  4 − 2 → she wrote 2
   Answer: 24
Which step went wrong?     [ Step 1 ]  [ Step 2 ]  [ Neither ]
```
This is the strongest item in this section. It requires evaluating a procedure
rather than executing one, it is fully gradeable, and it can be **generated
directly from the existing misconception library** — the planted error *is* a
known misconception.

**R3 · Pattern continuation.** `2, 6, 12, 20, __` with a follow-up:
"What is the rule?" → select from generated candidates. Covers the missing
NCERT *Patterns* chapter (§8).

**R4 · Multiple solution paths.** For a secure skill: "Both are correct — which
is quicker?" Builds flexibility, which the audit found entirely absent.

### What is deliberately excluded
Free-text explanation. It is the gold standard pedagogically and **cannot be
graded offline, deterministically, or in Hindi and English equally**. Shipping
it ungraded would be theatre. R1–R4 capture most of the benefit within the
constraint.

### Learning Science Justification
Self-explanation effect (Chi); error-detection tasks build conceptual
understanding more than additional practice; pattern generalisation is the
entry point to algebraic reasoning.

### Engineering Complexity — **Medium (2 wk)**
R2 reuses the misconception library and the worked-example step solver — most
of its cost is already paid by §1.

### Risks
| Risk | Mitigation |
|---|---|
| R1 becomes a meaningless tap | Show on ~1 in 8 questions only |
| Error hunting confuses weak learners | Gate at mastery > 0.60 |

### Alternatives Considered
- **Free-text with LLM marking** — rejected: violates offline-first, unpredictable for children, unequal across languages.
- **Voice explanation** — rejected: same grading problem, plus privacy considerations for minors.

### Final Recommendation
**Build R2 first.** Best ratio: nearly free given §1, and it targets conceptual
understanding directly.

---

## 8 · Curriculum Expansion

### Educational Goal
Close the 3 of 10 missing NCERT Ganita Prakash chapters and the number-line gap.

### Design Specification

| Topic | Why | Form | Integrates as |
|---|---|---|---|
| **Patterns** | NCERT Ch. 1; foundation of algebraic thinking | Continue a sequence; identify the rule (R3) | New skill `patterns.basic`; prerequisite of `algebra.basic` |
| **Symmetry** | NCERT Ch. 9 | Tap the line of symmetry; count lines; complete the reflection | New skill `symmetry.basic`; child of `shapes.basic` |
| **Number line** | Not a chapter but load-bearing across integers, decimals, fractions | The `NumberLine` primitive from §2 | Not a skill — a *representation* used by existing skills |
| **Constructions** | NCERT Ch. 8 | — | **Deliberately excluded**: ruler-and-compass on a phone teaches phone skills, not geometry |

**Integration mechanism.** Each new topic is a node in the existing DAG with
declared prerequisites, an entry in `TOPIC_AVAILABILITY` per board, and
generators following the existing signature. Nothing structural changes —
this is the payoff of the skill-graph design.

```
patterns.basic   introducedIn 1st (simple repeats) → 6th (quadratic-ish growth)
symmetry.basic   introducedIn 3rd, prerequisite shapes.basic
```

### Engineering Complexity — **Medium (2 wk total)**
Patterns 1 wk, symmetry 1 wk (needs simple SVG shapes, reusing §2 infrastructure).

### Risks
| Risk | Mitigation |
|---|---|
| Pattern questions become guessable | Require the *rule*, not only the next term |
| Symmetry needs good shape rendering | Restrict to a fixed library of clean polygons |

### Final Recommendation
**Build Patterns in Phase 2** (it is NCERT Chapter 1 and feeds algebra).
Symmetry in Phase 3. Skip constructions permanently, and say so.

---

## 9 · Motivation

### Educational Goal
Sustain effort through competence, autonomy and mastery — not extrinsic reward.
The audit scored this 7.5/10 already; the fixes are narrow.

### Design Specification

**M1 · Make the timer optional; default off below Class 3.**
*One setting.* Timed testing is a leading correlate of mathematics anxiety in
early primary. This is the highest-value motivation change in the product and
costs a day.

**M2 · Surface the growth trend.** The mastery model already computes `trend`
and shows it nowhere.
```
"Subtraction: 41% → 68% this fortnight"
```
Growth-mindset framing requires evidence of growth. The data exists; it needs a
sentence.

**M3 · Effort attribution in feedback.** Replace outcome praise with process
praise. "You worked that out" beats "Correct!" — outcome praise given to
children reliably produces fixed-mindset attribution (Mueller & Dweck).

**M4 · Autonomy within structure.** Before a session:
```
"Practise what you need"   ← default, adaptive
"Choose a topic"           ← learner-selected
```
Self-Determination Theory needs autonomy. Two options is enough; more is
choice paralysis.

**M5 · Mastery visible as a journey, not a score.** Show the skill graph as a
path with secured nodes behind and the frontier ahead. Competence made concrete
without any currency.

### What we explicitly reject
Coins, gems, energy, strealks-as-pressure, leaderboards, avatars, loot. All
undermine intrinsic motivation for learning tasks (overjustification effect),
and several are ethically inappropriate for children.

### Engineering Complexity — **Low (1 wk total)**
M1 one day. M2 and M3 are copy changes over existing data. M4 is one screen
state. M5 is a view over the existing DAG.

### Final Recommendation
**Build M1 immediately.** M2/M3 alongside Phase 1 — they are nearly free.

---

## 10 · Parent Support

### Educational Goal
Give a parent the one thing they cannot get elsewhere — *what to do next* —
without building a dashboard.

### Design Specification — one screen, three sentences

```
┌────────────────────────────────────────┐
│  This week                              │
│                                         │
│  Aarav practised on 5 of 7 days.        │
│                                         │
│  Strongest: multiplication tables (91%) │
│  Needs work: subtraction with borrowing │
│                                         │
│  ── What would help most ──             │
│  When subtracting 43 − 27, Aarav takes  │
│  the smaller digit from the larger in   │
│  each column, giving 24 instead of 16.  │
│                                         │
│  Try this together: use 4 bundles of    │
│  ten and 3 single sticks, and physically│
│  break one bundle open.                 │
│                                         │
│  [ Got it ]                             │
└────────────────────────────────────────┘
```

**Why this and nothing more.** The remediation text is *already written for an
adult* — the audit noted it advises physical apparatus no child has alone. This
routes existing content to the person who can act on it. No charts, no login,
no separate app.

**Delivery.** A weekly card on the home screen, dismissible. No account, no
server, no notification (D5 keeps it offline).

**Deliberately excluded:** progress graphs, comparison to peers or grade level,
time-on-task, daily reports. Parents do not lack data; they lack a next action.

### Learning Science Justification
Parental involvement improves outcomes when specific and actionable, and has
near-zero effect when it is generic reporting. Naming one misconception and one
concrete activity is the highest-yield form.

### Engineering Complexity — **Low (4 days)**
Composes existing data: `currentStreak`, `estimateAll`, `topMisconceptions`.
No new model.

### Risks
| Risk | Mitigation |
|---|---|
| Parental pressure on the child | Neutral language; no scores, no comparison |
| Parent never sees it | Weekly card in-app; deliberately not a notification |

### Final Recommendation
**Build.** Four days for the app's strongest differentiator with parents.

---

## 11 · Prioritised Roadmap

Ordered by **learning outcome per engineering hour**, not feature count.

### Phase 1 — Highest ROI · ~4 weeks

| # | Item | Effort | Why first |
|---|---|---|---|
| 1 | **Scheduler: success floor + prerequisite descent + circuit-breaker** (§3) | 1 wk | Fixes the most harmful finding. No dependencies. Reuses `findRootGap`. |
| 2 | **Optional timer, off below Class 3** (§9 M1) | 1 d | One setting; removes a documented anxiety driver |
| 3 | **Plausible distractors, ±25% cap** (§5 A) | 3 d | Raises assessment validity across every question |
| 4 | **Worked examples on repeated failure** (§1) | 2 wk | Largest single effect size; closes detect-but-don't-teach |
| 5 | **Growth trend + process praise** (§9 M2/M3) | 2 d | Data already exists; copy change |

**Outcome:** the app stops trapping struggling learners and starts teaching.
Estimated score movement **6.4 → 7.4**.

### Phase 2 — Conceptual foundation · ~4 weeks

| # | Item | Effort | Depends on |
|---|---|---|---|
| 6 | **`NumberLine` + `PartModel` visuals** (§2) | 2 wk | — |
| 7 | **Number sense strand** (§6) | 1.5 wk | NumberLine |
| 8 | **Scaffolding hint hierarchy** (§4) | 1 wk* | Shares step-solvers with #4 |
| 9 | **Parent weekly card** (§10) | 4 d | — |

**Outcome:** the app teaches concepts, not just procedures. **7.4 → 8.2**.

### Phase 3 — Reasoning and coverage · ~4 weeks

| # | Item | Effort |
|---|---|---|
| 10 | Error-hunting questions (§7 R2) | 1 wk |
| 11 | Patterns strand (§8) | 1 wk |
| 12 | `ArrayGrid` + `BaseTen` visuals (§2) | 1.5 wk |
| 13 | Misconceptions for the 17 uncovered skills | 1 wk |
| 14 | Confidence rating, once per session (§5 C) | 3 d |

**Outcome:** reasoning and curriculum completeness. **8.2 → 8.6**.

### Nice-to-have

| Item | Why deferred |
|---|---|
| Symmetry strand | Real but low frequency |
| Method selection (§7 R1) | Small effect relative to cost |
| Multiple solution paths (§7 R4) | Needs a secure base first |
| Mastery journey view (§9 M5) | Motivational polish, not learning |
| Multi-step staged word problems | High value, high cost — revisit after Phase 3 |

### Explicitly never

- Constructions (phone skills, not geometry)
- Free-text explanation (ungradeable offline)
- Coins / gems / energy / leaderboards
- More question categories before the existing 17 undiagnosed skills are covered

---

## 12 · Summary

**Total: ~12 weeks to move from 6.4 to ~8.6.**

The sequencing follows one principle: **fix harm before adding value.** The
scheduler change is one week and stops the app frustrating the children it
should serve best — it must ship before anything else, however unglamorous.

Three observations worth carrying into the work:

1. **Most of this is additive.** The skill DAG, mastery model, interaction
   union and attempt log were built well enough that patterns, symmetry,
   estimation and visuals all attach without structural change. That is the
   dividend of the earlier architecture work.

2. **The cheapest items are among the most valuable.** Optional timer (1 day),
   distractor cap (3 days), growth trend (2 days) together cost under a week
   and address an anxiety driver, a validity flaw and a motivation gap.

3. **One thing must not be compromised.** Every scaffold, visual and hint in
   this document has an explicit fade condition tied to the mastery model.
   Support that never withdraws produces dependence — which would leave the app
   worse than the honest, if incomplete, practice engine it is today.
