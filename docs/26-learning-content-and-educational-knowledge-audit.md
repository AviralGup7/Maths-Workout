# 26 · Learning Content & Educational Knowledge Audit

> **Status: HISTORICAL.** Its 6.4/10 is superseded by **8.0/10** in `29-consolidated-re-audit.md`. All 20 Phase 1 and all 10 Phase 3 items have landed: 12 unsupported skills → 0, error analysis 1.1% → 8.4%, open tasks 0 → 3.2% of the stream. Retained for its central recommendation — *do not add curriculum breadth before instructional depth* — which still governs, and which now points at breadth as the honest next move.


**Question:** does this app contain enough educational knowledge, instructional depth and curriculum coverage to become one of the world's best mathematics learning applications?

**Answer: not yet — and the gap is instructional, not architectural.** It is an outstanding *assessment* engine attached to a thin *teaching* layer.

**Scope:** educational content and learning design only. Engineering assumed excellent (docs/21–25 verified it).
**Method:** measured against the running content — 45 skills, 126,000 sampled generated questions, per-skill instructional-asset coverage, cold-start simulation. No product code changed.

---

## 1 · Executive Summary

The diagnostic machinery here is genuinely world-class and I want to state that plainly before the criticism. **35 named misconceptions cover 45 of 45 skills.** Not "we detect wrong answers" — the app knows that a child who answers 42 to `1/2 + 1/3` added numerators and denominators, and it says so by name. Mastery is a calibrated probability with decay, a recognition ceiling that refuses to certify recall it has never observed, and difficulty-weighted evidence. Worked examples are triple-gated on the expertise-reversal effect. Praise is process-based. Prerequisites are a real DAG that the scheduler descends when a downstream skill fails.

That is a better assessment model than DreamBox, SplashLearn or Prodigy ship, and better than most research prototypes.

**The teaching layer does not match it.** Four measurements, each from the running content:

| Measurement | Result |
|---|---|
| Questions asking for an **explanation or "why"** (126,000 sampled) | **0** |
| Questions with **more than one valid answer** | **0** |
| Skills with **no worked example, no hint, and no visual** | **12 of 45** |
| Class 6 learner's first two months spent on **Class 1–2 material** | **53%** |

Zero open-ended tasks and zero explanation prompts is the finding that matters most. Boaler & Staples, and the Open Middle literature, both find that conceptually-oriented tasks produce higher *and more equitable* outcomes than procedure-oriented practice; comparing solution methods specifically benefits lower-achieving students. This app currently cannot ask a child to compare two methods, justify an answer, or find a second solution — because every question has exactly one right answer and grades by string equality.

The twelve unsupported skills include **all four Class 1 topics** (`shapes.basic`, `time.basic`, `money.basic`, `count.objects`). A six-year-old who does not understand telling the time receives more time questions. That is testing, not teaching.

**Overall Educational Content Score: 6.4 / 10.** Diagnosis ~9.5, curriculum breadth ~7, instructional depth ~4.5, mathematical thinking ~4.

The encouraging part: the hard infrastructure — misconception taxonomy, mastery model, spaced scheduler, CRA visual components — is built and working. The missing pieces are *content authored against that infrastructure*, not new systems.

---

## 2 · Overall Educational Content Score — 6.4 / 10

| Dimension | Score | Basis |
|---|---|---|
| Diagnostic assessment | **9.5** | 35 misconceptions, 45/45 skill coverage |
| Mastery validity | **9.0** | Calibrated, decaying, recognition-ceilinged, difficulty-weighted |
| Curriculum sequencing | **8.0** | Real DAG; prerequisites load-bearing |
| Curriculum breadth | **6.5** | 45 skills; large topics collapsed to one node |
| Spaced retrieval / interleaving | **8.5** | Genuine spacing, genuine interleaving |
| Worked examples | **5.5** | Excellent design, 19/45 coverage, arithmetic only |
| Multiple representations (CRA) | **5.0** | 16/45 skills; concrete stage largely absent |
| Procedural fluency | **8.0** | Well served — arguably the only thing fully served |
| Conceptual understanding | **4.5** | Few tasks require it; none require explaining it |
| Mathematical reasoning | **3.5** | 1.1% metacognitive, 0.8% pattern, 0.5% comparison |
| Problem solving / modelling | **4.0** | 7.8% multi-step, 7.1% real-world |
| Metacognition | **5.0** | Confidence rating exists; no self-explanation |
| Formative feedback | **8.5** | Misconception-specific, explains the error |
| Placement / entry assessment | **2.0** | **None exists** |
| Inclusivity | **7.5** | Bilingual, board-aware, UDL-conscious; no extension ceiling |

---

## 3 · Curriculum Completeness

45 skills, distributed:

```
sub 6 · add 6 · mul 5 · numsense 3 · frac 3 · div 3 · dec 2 · count 2
time 1 · symmetry 1 · shapes 1 · ratio 1 · percent 1 · patterns 1 · money 1
measurement 1 · integers 1 · geometry 1 · factors 1 · data 1 · algebra 1
```

**The distribution is the finding.** 20 of 45 skills are the four operations. Meanwhile:

- **`geometry.basic` = "Area, perimeter and angles"** — one node for three distinct concepts with different misconceptions. Confusing area with perimeter is among the most-documented errors in primary geometry and cannot be diagnosed when both live in one skill.
- **`measurement.basic` = "Measurement and units"** — length, mass, capacity, conversion, all one node.
- **`data.basic` = "Mean, median, mode and range"** — four concepts, one node.
- **`frac` = 3 skills** — no comparing fractions, no fractions on a number line, no subtraction, no unlike denominators, no mixed numbers, no fraction-decimal-percentage equivalence as a single idea.

### Missing concepts, by research importance

| Missing | Why it matters |
|---|---|
| **Number bonds / part-whole** | The Singapore Math spine. Underpins mental strategy, missing-addend, and algebraic thinking. Absent entirely. |
| **Comparing fractions** | The canonical site of the whole-number bias misconception. |
| **Fractions on a number line** | NAEP evidence: children who can place fractions on a line understand magnitude; those who only shade pizzas do not. |
| **Multiplicative comparison** ("3 times as many") | Distinct from repeated addition; the bridge to ratio and proportion. |
| **Inverse relationships** | Addition↔subtraction, multiplication↔division as structure, not separate topics. |
| **Equality as balance** | `8 + 4 = □ + 5`. McNeil's work shows procedural practice actively *degrades* this understanding. Absent. |
| **Area vs perimeter as contrast** | Variation theory: the concept is learned through the contrast. |
| **Rounding as a decision** | Present only as estimation, not as "round to what, and why". |
| **Negative number arithmetic** | `integers.basic` recognises negatives; no operations on them. |
| **Probability / chance** | Absent. In CBSE, ICSE and virtually every international curriculum. |
| **Nets, 3D shapes, volume** | Absent. Spatial reasoning is the single strongest predictor of later STEM attainment. |
| **Time intervals / elapsed time** | `time.basic` reads clocks; elapsed time is the harder and more useful skill. |

**Recommended split:** 45 → roughly 75 skills, concentrated in geometry, measurement, fractions and data — not by adding topics, but by separating concepts that currently share a node and therefore cannot be diagnosed separately.

---

## 4 · Instructional Quality

Measured per-skill asset coverage:

```
worked examples: 19/45      hints: 15/45      visuals: 16/45
skills with NO support at all: 12/45
```

The twelve: `mul.large`, `count.objects`, `count.skip`, `numsense.reasonable`, `symmetry.basic`, `ratio.basic`, `measurement.basic`, `data.basic`, `algebra.basic`, `shapes.basic`, `time.basic`, `money.basic`.

**Four of those are Class 1 topics.** The youngest, most support-dependent learners have the least support.

Worked examples run on **6 solvers** (`addSimple`, `addWithCarry`, `subSimple`, `subWithBorrow`, `mul`, `div`) covering 19 arithmetic skills. There is **no worked example anywhere for fractions, decimals, percentages, ratio, geometry, algebra or data** — precisely the topics where children most need to see a method demonstrated.

The *design* of the worked-example system is excellent and should be preserved exactly: triple-gated on repeated failure, mastery below 0.55, and a cooldown; faded after two correct twins. The comment cites expertise reversal correctly. The problem is coverage, not design.

**What is missing instructionally:**

- **No explicit instruction before first contact.** A skill's first appearance is a test. Kirschner, Sweller & Clark's critique of minimal guidance applies directly: novices need worked examples *before* problem-solving, not only after failing twice.
- **No concrete stage.** CRA is Representational→Abstract here. `BaseTen` and `PartModel` are illustrations, not manipulables — a child cannot regroup a ten-rod and watch it become ten ones. DreamBox's core differentiator is exactly this.
- **No guided discovery.** Every question is answer-then-verdict.
- **No comparison of methods** — 0.2% of questions ask about strategy at all.

---

## 5 · Mathematical Thinking Coverage

Cognitive demand across 126,000 generated questions:

| Demand | Share |
|---|---|
| Contextual single-step | 57.3% |
| Bare computation | 26.5% |
| Word problem / modelling | 12.7% |
| Metacognitive / error analysis | **1.1%** |
| Estimation | **1.0%** |
| Pattern | **0.8%** |
| Comparison / classification | **0.5%** |

Structural properties:

| Property | Share |
|---|---|
| Multi-step reasoning | 7.8% |
| Real-world context | 7.1% |
| Non-choice interaction | 1.0% |
| Strategy / method choice | 0.2% |
| **Open-ended (>1 valid answer)** | **0.00%** |
| **Asks "why" / explanation** | **0.00%** |

| Capability | Status |
|---|---|
| Number sense | **Partial** — estimation exists at 1.0%; no number bonds, no benchmarks |
| Estimation | **Weak** — 1.0%, and `numsense.reasonable` has no instructional support |
| Mental mathematics | **Weak** — "easiest way to work out 57 + 25" exists but is 0.2% |
| Logical reasoning | **Very weak** |
| Pattern recognition | **Weak** — 0.8%, one skill |
| Spatial reasoning | **Very weak** — 2D naming only; no nets, rotation, volume |
| Algebraic thinking | **Very weak** — one skill, no equality-as-balance |
| Modelling | **Weak** — 7.1% context, all single-model |
| Problem solving | **Weak** — 7.8% multi-step |
| Communication | **Absent** — 0% explanation |

---

## 6 · Question Diversity Analysis

| Category | Present? |
|---|---|
| Visual questions | Partial — 16/45 skills, illustrative not interactive |
| Interactive questions | Weak — 1.0% non-choice |
| **Open-ended** | **Absent — 0** |
| Multi-step | Weak — 7.8% |
| Real-world | Weak — 7.1% |
| Error analysis | Present but rare — ~1.1%, and genuinely good |
| Comparison | Rare — 0.5% |
| Pattern | Rare — 0.8% |
| Estimation | Rare — 1.0% |
| **Reasoning / justification** | **Absent** |

The error-analysis items (`"Rohan says 42 + 22 = 64. Does that seem sensible?"`) are the most pedagogically sophisticated content in the app and are ~1% of it. That ratio should be roughly inverted with bare computation.

---

## 7 · Learning Experience Analysis

| Experience | Status |
|---|---|
| Retrieval practice | **Excellent** — the whole app is retrieval |
| Spaced review | **Excellent** — genuine intervals, decay-driven |
| Interleaving | **Excellent** — sessions mix skills by design |
| Error correction | **Strong** — misconception named and explained |
| Mastery reinforcement | **Strong** |
| Productive struggle | **Partial** — success floor at 0.60 may over-protect |
| Confidence building | **Partial** — rating exists, calibration barely surfaced |
| Exploration | **Absent** |
| Discovery | **Absent** |
| Reflection | **Absent** |
| **Self-explanation** | **Absent** — one of the largest effect sizes in the literature (Chi et al.), zero implementation |

Three of the "big five" learning-science techniques (retrieval, spacing, interleaving) are implemented to a standard I would call exemplary. Two (self-explanation, elaborative interrogation) are entirely absent. That is a strikingly uneven adoption of the same body of research.

---

## 8 · Assessment Analysis

**Formative: 9/10.** Every answer updates a calibrated model; wrong answers are diagnosed by name.

**Mastery validity: 9/10.** The recognition ceiling, decay, guessing correction and difficulty weighting together make this estimate mean what it says.

**Diagnostic / placement: 2/10 — the largest single defect in the app.**

There is no placement test. Measured: an able Class 6 learner practising daily for 60 days spends **53% of 1,200 questions on Class 1–2 material**, meets 19 Class 1–2 skills, and does not reach `algebra.basic` until **day 43** or `mul.large` until **day 48**.

The scheduler is behaving correctly — it cannot know what it has not observed. But a 20-question adaptive placement probe would establish an entry point in one session instead of two months. Every serious adaptive product (DreamBox, ALEKS, SplashLearn) opens with one. This is the highest expected-value change in this document.

**Summative: absent, and correctly so** — no high-stakes testing is appropriate here.

---

## 9 · Feedback Quality Analysis — 8.5/10

Genuinely strong. Feedback names the misconception rather than the error, explains the faulty rule, and is available in both languages. Process praise ("You came straight back", "You took your time — it paid off") follows Mueller & Dweck correctly, avoiding both trait praise and bare outcome praise.

**Two gaps:**

1. **Feedback tells; it never asks.** The response to a wrong answer is an explanation delivered *to* the child. Prompting them to explain first — "what do you think went wrong?" — produces larger gains than being told (self-explanation effect).
2. **No comparison feedback.** When a child uses an inefficient valid method, nothing says "here is a quicker way, and here is why it works." Rittle-Johnson & Star's comparison research shows this is one of the most effective interventions available.

---

## 10 · Long-Term Learning Analysis — 8/10

The strongest area after diagnosis. Spacing intervals stretch with mastery, decay is modelled at a 21-day half-life, review chapters generate from decay, and interleaving is structural.

**Gap: transfer.** Retention of *the same question type* is well served. Transfer to unfamiliar problems is not — 7.8% multi-step, 0% open-ended, and near-zero variation in surface features means a child who masters `frac.ofAmount` has practised one presentation of it many times. Variation theory would systematically vary the irrelevant features while holding the concept constant; the generators vary operands, not structure.

---

## 11 · Benchmark Comparison

| Product | Beats this app at | This app beats it at |
|---|---|---|
| **Beast Academy** | Conceptual depth, puzzles, multiple solution paths, "why does this work?", 20,000 authored problems | Adaptive diagnosis, spaced retrieval, misconception naming, accessibility |
| **DreamBox** | Interactive manipulatives, concrete stage, strategy-level adaptation, placement | Misconception taxonomy, mastery honesty, curriculum transparency |
| **Khan Academy Kids** | Early-years instruction, narrative, explicit teaching before practice | Adaptive scheduling, diagnostic depth |
| **SplashLearn** | Visual variety, breadth of question formats | Mastery validity, no pay-gating |
| **DragonBox** | Concept-embodying interaction — the manipulation *is* the mathematics | Curriculum breadth, board alignment |
| **Prodigy** | Engagement pull | Educational integrity by a wide margin |
| **Duolingo Math** | Polish, mental-maths framing | Depth, diagnosis, curriculum coverage |

**Position: best-in-class assessment engine, mid-tier instructional content.**

The closest analogue is DreamBox, and the gap is specific: DreamBox adapts on *how a child solves*, not just whether they were right. Its manipulatives are the assessment surface. This app's adaptation is answer-level; its visuals are decoration alongside the question rather than the question itself.

Against Beast Academy the gap is philosophical: Beast Academy asks "why does this work?" and accepts multiple solution paths. This app asks "what is the answer?" 100% of the time.

---

## 12 · Top 100 Educational Improvements

Ranked by expected learning impact. Each is supported by cited evidence and is achievable against infrastructure that already exists.

### Tier A — Transformative (1–12)

1. **Adaptive placement probe** (~20 questions, binary search over the DAG). Removes 53% wasted practice for above-entry learners. *Adaptive testing; DreamBox/ALEKS precedent.*
2. **Self-explanation prompts** after errors on high-value skills: "what went wrong?" before revealing. *Chi et al.; among the largest effect sizes available.*
3. **Open-ended tasks** — "find two numbers that add to 50", "give an example of a fraction between 1/2 and 3/4". Requires set-valued grading, which `multiSelect` already models. *Boaler & Staples: higher and more equitable outcomes.*
4. **Open Middle problems** — fixed start and end, multiple routes. *Comparing solution approaches especially benefits lower attainers.*
5. **Worked examples for fractions, decimals, percentages, ratio, geometry, algebra** — 6 more solvers against an excellent existing system. Closes 19/45 → ~35/45.
6. **Instructional support for the 12 unsupported skills**, Class 1 first.
7. **Number bonds / part-whole model** as a first-class skill family. *Singapore Math spine.*
8. **Equality as balance** (`8 + 4 = □ + 5`). *McNeil: procedural practice degrades this without explicit attention.*
9. **Interactive manipulatives** — regroupable base-ten, draggable fraction bars, where the manipulation IS the answer. *DreamBox's core differentiator; CRA concrete stage.*
10. **Split `geometry.basic`** into area / perimeter / angles, taught by contrast. *Variation theory.*
11. **Fractions on a number line** as a distinct skill. *NAEP: the strongest predictor of fraction understanding.*
12. **Method-comparison items** — "Priya did it this way, Rohan this way; which is quicker and why?" *Rittle-Johnson & Star.*

### Tier B — High impact (13–40)

13. Split `measurement.basic` into length / mass / capacity / conversion.
14. Split `data.basic` into mean / median / mode / range.
15. Comparing fractions (whole-number bias).
16. Fraction subtraction; unlike denominators; mixed numbers.
17. Multiplicative comparison as distinct from repeated addition.
18. Inverse relationships taught explicitly as structure.
19. Elapsed-time problems.
20. Probability and chance.
21. 3D shapes, nets, volume. *Spatial reasoning predicts STEM attainment.*
22. Rounding as a decision, not a rule.
23. Negative-number arithmetic.
24. Raise error-analysis items from 1.1% toward ~8%.
25. Raise estimation from 1.0% toward ~8%.
26. Raise multi-step from 7.8% toward ~20%.
27. Systematic surface-feature variation while holding structure constant.
28. Non-examples ("which of these is NOT a rectangle, and why?").
29. Explicit teaching *before* first contact for each new skill.
30. Ten-frames for Class 1–2.
31. Array/grid model for all times tables.
32. Clock faces; coin and note images.
33. Bar-model / tape-diagram tool for word problems. *Singapore.*
34. Multi-representation items — same quantity as fraction, decimal, percentage, point on a line.
35. "What do you notice?" reflection at session end.
36. Surface confidence calibration to the learner.
37. Estimate-then-calculate paired items.
38. Word problems with irrelevant information.
39. Word problems with insufficient information ("what else do you need?").
40. Two-step word problems as a distinct progression.

### Tier C — Meaningful (41–70)

41. Pattern-generalisation ("what is the 10th term?").
42. Function machines.
43. Missing-operator items (`6 □ 3 = 2`).
44. Balance-scale visual for equations.
45. Number-line jumps for mental strategy.
46. Compensation strategy (`57 + 29` as `57 + 30 − 1`).
47. Doubling and halving.
48. Bridging through ten.
49. Partitioning strategies.
50. Divisibility rules with reasoning.
51. Prime factorisation trees.
52. Factor pairs as arrays.
53. Equivalent-ratio tables.
54. Unit-rate problems.
55. Percentage increase/decrease.
56. Fraction-decimal-percentage triads.
57. Perimeter with missing sides.
58. Compound-shape area.
59. Angle reasoning (angles on a line, in a triangle).
60. Symmetry completion tasks.
61. Coordinate plotting.
62. Transformations (translation, reflection, rotation).
63. Data interpretation from charts.
64. Choosing an appropriate average.
65. Misleading-graph analysis.
66. Measurement estimation ("about how tall?").
67. Unit-choice reasoning.
68. Money problems with change and multiple coins.
69. Timetable reading.
70. Multi-day retention checks on previously mastered skills.

### Tier D — Valuable (71–100)

71. Mathematical vocabulary glossary in both languages.
72. Sentence stems for explanation.
73. Worked examples with a deliberate error to find.
74. Faded worked examples (steps progressively removed). *Renkl & Atkinson.*
75. Completion problems (partial solution supplied).
76. Analogical pairs (structurally identical, surface-different).
77. Skill-connection map visible to the learner.
78. "Where this is used" real-world notes.
79. History-of-mathematics snippets.
80. Puzzle mode (non-curricular reasoning).
81. Logic grid puzzles.
82. Magic squares.
83. Cryptarithms.
84. Estimation Fermi problems.
85. "Convince me" items.
86. Peer-explanation framing ("explain to a younger child").
87. Common-error gallery per skill.
88. Self-assessment before the mastery reveal.
89. Goal-setting per chapter.
90. Learning-journal prompts.
91. Parent conversation starters tied to current skills.
92. Teacher-facing misconception report.
93. Extension tasks for learners who exceed the curriculum.
94. Deliberate under-specified tasks.
95. Multiple-representation matching games.
96. Estimation-first framing on all large-number arithmetic.
97. Reverse problems ("the answer is 24 — what was the question?").
98. Error-pattern feedback across sessions.
99. Cross-topic synthesis tasks.
100. Cumulative end-of-chapter reasoning tasks.

---

## 13 · Missing Learning Experiences

The five with the strongest evidence-to-absence ratio:

1. **Self-explanation** — large documented effect, zero implementation.
2. **Open-ended tasks** — equity-positive, zero implementation.
3. **Interactive manipulatives** — CRA's concrete stage, absent.
4. **Method comparison** — strong evidence, 0.2% of content.
5. **Placement assessment** — costs a capable learner two months.

---

## 14 · Research References (summarised)

- **Retrieval practice** (Roediger & Karpicke) — testing outperforms restudy. *Implemented.*
- **Spacing** (Cepeda et al.) — distributed beats massed. *Implemented.*
- **Interleaving** (Rohrer & Taylor) — mixed practice improves discrimination. *Implemented.*
- **Worked examples & expertise reversal** (Sweller; Kalyuga) — help novices, harm experts. *Implemented, narrow coverage.*
- **Self-explanation** (Chi et al.) — explaining beats being told. *Absent.*
- **Comparison of methods** (Rittle-Johnson & Star) — improves flexibility and conceptual knowledge, especially for lower attainers. *Near-absent.*
- **Productive failure** (Kapur) — struggle before instruction aids conceptual learning. *Partially contradicted by the 0.60 success floor.*
- **CRA** (Bruner; EEF) — concrete → representational → abstract. *Concrete stage absent.*
- **Variation theory** (Marton) — concepts learned through systematic contrast. *Absent.*
- **Singapore Math** — number bonds, bar models, part-whole. *Absent.*
- **Mastery learning** (Bloom) — progress on demonstrated understanding. *Implemented well.*
- **Equality misconception** (McNeil) — procedural practice degrades relational understanding. *Unaddressed.*
- **Fractions on a number line** (Siegler; NAEP) — magnitude predicts later attainment. *Absent.*
- **Spatial reasoning** (Wai et al.) — predicts STEM outcomes. *Minimal.*
- **Growth mindset / process praise** (Mueller & Dweck) — praise effort and method, not traits. *Implemented correctly.*
- **Cognitive load** (Sweller) — manage intrinsic/extraneous load. *Respected.*
- **UDL** — multiple means of representation, engagement, expression. *Representation and engagement partial; expression single-mode.*
- **Open-ended assessment** (Boaler & Staples; Gullie) — conceptually-oriented tasks produce higher and more equitable outcomes; open-response performance predicts later proficiency. *Absent.*

---

## 15 · Final Verdict

**This is the best-diagnosing primary mathematics app I have examined, and it is not yet a great teaching one.**

The distinction is precise. It knows, with genuine rigour, what a child can and cannot do — 35 named misconceptions across 45 of 45 skills, a mastery estimate that refuses to overstate itself, and spaced retrieval implemented to a standard most research prototypes do not reach. An earlier internal audit called it *"an outstanding diagnostician that has not yet learned to teach"*, and after measuring the content I would say that verdict was correct and remains only partly addressed: worked examples were added for the arithmetic spine, and the other 26 skills were left as assessment-only.

The three numbers I would put in front of a curriculum committee:

- **0 questions in 126,000 ask a child to explain anything.**
- **0 questions have more than one valid answer.**
- **12 of 45 skills — including every Class 1 topic — have no worked example, no hint, and no visual.**

A child using this app practises retrieving answers. They rarely explain, never justify, never choose between methods, never encounter a problem with two right answers, and never manipulate a mathematical object. Those are the activities that distinguish knowing arithmetic from understanding mathematics, and they are the activities Beast Academy and DreamBox are built around.

**None of this requires rebuilding anything.** The misconception taxonomy is the hard part of an intelligent tutor and it exists. The mastery model is honest. The scheduler routes to prerequisites. The visual components are written. What is missing is *content authored against that infrastructure* — six more worked-example solvers, an open-ended grading path that `multiSelect` already half-implements, a 20-question placement probe, and instructional support for twelve orphaned skills.

**Recommendation: do not pursue further curriculum breadth until instructional depth catches up.** Adding topics to an app that cannot teach the ones it has would make it worse. Tier A items 1–12 would move this from 6.4 to roughly 8.5, and items 1, 2, 3 and 5 alone — placement, self-explanation, open-ended tasks, and worked examples beyond arithmetic — address the four measurements above directly.

The ceiling here is genuinely high. An app that diagnoses this well and then *teaches* in response to the diagnosis would have no real competitor. It is closer than the score suggests, because the half that is usually missing is the half that is already built.

---

### Reproducing

Measurements in this report come from probes run against the live content; they were removed after use to keep the audit read-only. `npm run verify` (typecheck + arch-check 7/7 + 675 tests) passes unchanged, and no product code was modified.

Key figures, for re-derivation:
- per-skill assets — cross-reference `TAUGHT_SKILLS`, `HINTED_SKILLS`, `visualFor()` against `SKILLS`
- cognitive demand — classify 126,000 questions from `generateQuestion` across all class/category/difficulty cells
- cold start — `runLearner` at Class 6, learnRate 0.40, 60 days, count attempts on Class 1–2 skills
