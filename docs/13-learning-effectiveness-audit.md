# 13 · Learning Effectiveness Audit

> **Status: HISTORICAL.** Its 6.4/10 is superseded by **8.1/10** in `29-consolidated-re-audit.md`, re-measured at `d9054dc`. Retained because the dimension rubric below is the instrument docs/29 re-scores with — deleting this would orphan the method. Its prediction that "fixing instruction and visual models alone would move this to roughly 8.0" is now testable, and it was accurate.


**Reviewer stance:** mathematics education, learning science, cognitive
psychology, CBSE curriculum design.
**Scope:** the educational design only. Code quality, architecture and
performance are explicitly out of scope and assumed correct.
**Question:** *will this app produce the best possible mathematical learning
outcomes for children aged 6–12?*

Every quantitative claim below was produced by instrumenting the live
generators and scheduler, not by reading source. Measurement commands and raw
output are shown.

---

## 1 · Executive Summary

This is a **well-built practice engine attached to an incomplete pedagogy**.

The adaptive machinery is genuinely above market standard. Spaced repetition,
Bayesian mastery with decay, prerequisite-aware gap tracing and misconception
diagnosis are real, working, and better than what IXL or SplashLearn expose.
On the *retrieval practice* axis this product is already excellent.

But mathematics is not only retrieval. Measured against the full construct of
primary mathematical competence, three findings are serious:

**Finding 1 — The app assesses but never teaches.** There is no worked example,
no scaffold, no hint, no explanation of method anywhere in the product.

```console
$ grep -ril "workedExample|scaffold|hint" generators/ learning/ app/ components/
# all hits are UI labels or code comments — zero instructional content
```

A child who cannot do fractions is served fraction questions, gets them wrong,
receives a diagnosis, and is served more fraction questions. The diagnosis is
excellent. The instruction that should follow it does not exist.

**Finding 2 — Zero visual or concrete representation.** No number line, no
fraction bar, no array model, no area model, no diagram of any kind.

```console
$ grep -ril "numberLine|fractionBar|areaModel|svg|diagram" generators/ components/
0 files
```

The Concrete → Pictorial → Abstract progression is the backbone of primary
mathematics teaching worldwide, and this product implements only the abstract
stage. For ages 6–9 this is the single largest pedagogical gap.

**Finding 3 — The adaptive engine can trap a struggling learner below the
frustration threshold.** Simulated: a learner failing one skill receives 70% of
their session on a skill they succeed at 5% of the time.

```console
weak skill = 14/20 of session (70%)
mastery estimate = 0.05
→ expected success on those = ~5%
```

Desirable difficulty targets roughly 70–85% success. A 5% success rate is not
desirable difficulty; it is learned helplessness with a progress bar.

Alongside these: **0% estimation questions**, **0 reasoning questions**, and
**17 of 41 skills have no misconception coverage**.

### Verdict in one line

> As a **drill engine**, top decile. As a **mathematics education product**,
> mid-tier — because it optimises the measurable half of mathematics and omits
> the half that matters more for long-term competence.

---

## 2 · Overall Learning Quality Score

### **6.4 / 10**

| Dimension | Weight | Score | Weighted |
|---|---|---|---|
| Retrieval & spacing | 15% | 9.0 | 1.35 |
| Diagnostic quality | 15% | 8.0 | 1.20 |
| Adaptive calibration | 15% | 6.0 | 0.90 |
| Conceptual understanding | 20% | 3.0 | 0.60 |
| Assessment validity | 10% | 6.5 | 0.65 |
| Curriculum coverage | 10% | 6.5 | 0.65 |
| Motivation & affect | 10% | 7.5 | 0.75 |
| Transfer & reasoning | 5% | 2.5 | 0.13 |
| **Total** | | | **6.4** |

For calibration: a good worksheet scores ~4. Khan Academy Kids scores ~7.5.
A best-in-class product would score 8.5+.

The score is held down almost entirely by three weights — conceptual
understanding, transfer, and adaptive calibration. Fixing instruction and
visual models alone would move this to roughly **8.0**.

---

## 3 · Learning Science Evaluation

| Principle | Status | Evidence |
|---|---|---|
| **Retrieval Practice** | ✅ **Correct** | Every interaction is active recall. The interaction ladder promotes secure skills from recognition (4 options) to free recall (typed entry) at mastery > 0.80 — this is *exactly* the right progression and is rarely done well. |
| **Spaced Repetition** | ✅ **Correct** | Measured intervals: mastery 0.3 → 0.5 d; 0.6 → 1 d; 0.8 → 3 d; 0.9 → 17.9 d; 0.95 → 30 d. Expanding schedule, correctly shaped. |
| **Interleaving** | ✅ **Correct** | Sessions mix skills, cap 3 consecutive identical, 70/15/15 focus/maintain/new. Interleaved > blocked practice for retention; correctly implemented. |
| **Immediate Feedback** | ✅ **Correct** | Right/wrong within ~280 ms, with the correct answer revealed. |
| **Error-Based Learning** | ⚠️ **Partial** | Errors are *detected* superbly and *diagnosed* by name. But detection is not remediation — the app names the misconception and then moves on. |
| **Desirable Difficulty** | ❌ **Incorrect** | Target should be 70–85% success. Struggling learners measured at ~5% expected success on 70% of their session. The scheduler optimises for *need* without a floor on *success*. |
| **Deliberate Practice** | ⚠️ **Partial** | Has the targeting and the feedback loop. Missing the coach: no instruction on *how* to improve, only that you must. |
| **Worked Examples** | ❌ **Missing** | Zero. For novices this is the strongest single effect in instructional psychology (worked-example effect, Sweller). Its absence is the most costly omission in the product. |
| **Cognitive Load** | ⚠️ **Partial** | Clean UI, one question at a time, adaptive font sizing — good. But novices face unguided problem solving, which is *maximum* extraneous load. Load is well managed visually and badly managed instructionally. |
| **Mastery Learning** | ✅ **Correct** | Explicit thresholds, prerequisite DAG, gap tracing to root cause. Genuinely strong. |
| **Motivation Theory** | ⚠️ **Partial** | Sparse celebration (4 earned moments), no dark patterns, no leaderboards — commendable restraint. But competence support is weak: the app tells a child they are failing without showing them how to succeed. |

**Score: 6 correct / 4 partial / 1 incorrect / 1 missing.**

The pattern is consistent and diagnostic: **every principle concerning
*practice* is implemented well; every principle concerning *instruction* is
absent.** This product was designed by someone who understands retrieval and
has not yet addressed acquisition.

---

## 4 · Mathematical Pedagogy Evaluation

### Does it build mathematicians, or train speed?

Currently: **it trains accurate recall.** That is more than speed, and less
than mathematics.

| Capability | Coverage | Evidence |
|---|---|---|
| Procedural fluency | ✅ Strong | Core strength; well-calibrated by class |
| Number sense | ⚠️ Weak | Comparison/ordering present; no magnitude, no benchmarks |
| **Estimation** | ❌ **Absent** | **0 / 1,720 questions** across Classes 4–6 |
| **Conceptual understanding** | ❌ **Absent** | No representation, no "why", no multiple models |
| **Reasoning** | ❌ **Absent** | **0** questions asking *why*, *how do you know*, or *which method* |
| Problem solving | ⚠️ Weak | Word problems are single-step templates; ~8 per class band |
| Transfer | ❌ Poor | Same operation, same phrasing, same shape every time |
| Flexibility | ❌ Absent | One method per question; never "solve this another way" |

### Measured composition

```console
bare computation : 1220 (36%)
worded / other   : 2140 (64%)
estimation       :    0 (0.0%)
reasoning        :    0
```

The 64% "worded" figure initially looks healthy, but inspection shows most are
lightly-worded computation ("How many sides does a Hexagon have?"), not
genuine problem solving.

### The missing representation problem

Every fraction question in the app is symbolic:

```
1/2 + 1/4 = ?/4        ½ of 12 = ?        Simplify 4/8 = 1/?
```

Not one shows a bar, a circle, a set, or a number line. The
`frac.add-across` misconception is detected — and the intervention text
correctly says *"use fraction bars to show…"* — but **the app cannot show a
fraction bar.** It advises a remedy it is incapable of delivering.

This is the clearest illustration of the product's central gap: the pedagogy
is understood and written down, but not built.

---

## 5 · Adaptive Learning Evaluation

**Score: 6.0 / 10.** Sophisticated machinery, one serious calibration fault.

### What is right

- **Mastery estimation** — Laplace-smoothed, recency-weighted, decayed on a
  21-day half-life, with an explicit confidence term. This is a genuine
  Bayesian-flavoured model, well above the "percent correct" most competitors
  use.
- **Prerequisite handling** — a real DAG with root-gap tracing. When fraction
  addition fails, the app can say *"equivalence needs work first."* Almost
  nobody in this market does this.
- **Forgetting model** — decay toward 0.5 rather than toward 0 is the correct
  choice; it represents uncertainty, not failure.

### The calibration fault

Simulated a learner failing `mul.tables.mid` for 8 days:

```console
weak skill        = 14/20 of session (70%)
mastery estimate  = 0.05
expected success  = ~5%
```

Three compounding problems:

1. **No success floor.** Nothing prevents the scheduler serving a skill the
   learner almost always fails.
2. **No frustration circuit-breaker.** Grep confirms no handling of consecutive
   failures — no back-off, no easier variant, no switch to a prerequisite.
3. **Difficulty floors at "easy" but the *skill* is still too hard.** The
   correct move is to descend the prerequisite graph, not merely reduce
   operand size within the failing skill.

### Difficulty mapping — verified sound

```console
mastery 0.2 → easy      mastery 0.8 → medium
mastery 0.5 → easy      mastery 0.9 → hard
mastery 0.7 → medium    mastery 0.99 → hard
```

Monotone and sensibly banded. The problem is *skill selection*, not
*difficulty selection*.

---

## 6 · Diagnostic Evaluation

**Score: 8.0 / 10 — the strongest part of the product.**

### Would an experienced teacher trust it?

**For arithmetic, yes.** The misconception library encodes real, documented
error patterns:

| Detected | Example | Teacher verdict |
|---|---|---|
| `sub.smaller-from-larger` | 43 − 27 = 24 | ✅ *The* classic regrouping error |
| `add.digitwise` | 47 + 35 = 712 | ✅ Genuine place-value failure |
| `frac.add-across` | 1/2 + 1/3 = 2/5 | ✅ Most common fraction error worldwide |
| `dec.longer-is-bigger` | 0.45 > 0.5 | ✅ Well-documented decimal misconception |
| `guessing` | latency < 1.2 s | ✅ Behavioural signal, sensibly caught |

Building distractors *from* misconceptions — so the wrong answer identifies the
faulty rule — is a genuinely strong design choice, and better than the random
offsets used by most competitors.

### Coverage gap

```console
skills WITH a misconception : 24 / 41
uncovered: add.2digit.nocarry, sub.2digit.noborrow, mul.2digit, mul.large,
count.objects, count.skip, frac.ofAmount, ratio.basic, factors.basic,
geometry.basic, measurement.basic, data.basic, algebra.basic, wordproblems,
shapes.basic, time.basic, money.basic
```

**41% of skills produce no diagnosis.** Notably absent: word problems (where
comprehension vs computation failure is the key distinction), algebra, and
geometry.

### The remediation gap

Remediation text is well written and pedagogically correct — and is **advice to
an adult, not an intervention for the child**:

> *"Practise regrouping with physical tens and ones before returning to written
> subtraction."*

Excellent guidance. But there is no adult in the loop, no physical apparatus,
and no in-app equivalent. The diagnosis fires and nothing changes: the same
skill returns, in the same form, with the same likely outcome.

**Diagnosis without differentiated response is measurement, not teaching.**

---

## 7 · Curriculum Evaluation

**Score: 6.5 / 10.** Correct sequencing, real gaps in breadth.

### CBSE alignment — verified against Ganita Prakash (Class 6)

| NCERT Chapter | Covered |
|---|---|
| 1 · Patterns in Mathematics | ❌ **Missing** |
| 2 · Lines and Angles | ✅ partial |
| 3 · Number Play | ✅ partial |
| 4 · Data Handling | ✅ |
| 5 · Prime Time | ✅ |
| 6 · Perimeter and Area | ✅ |
| 7 · Fractions | ✅ |
| 8 · Playing with Constructions | ❌ **Missing** |
| 9 · Symmetry | ❌ **Missing** |
| 10 · The Other Side of Zero | ✅ |

**7 of 10 chapters covered.** The three gaps are not incidental — *Patterns* is
Chapter 1 of the new NCERT book, and the framing chapter for mathematical
thinking in NEP 2020.

### Missing concepts (all classes)

| Missing | Severity | Why it matters |
|---|---|---|
| **Patterns / sequences** | 🔴 High | NCERT Ch.1; foundation of algebraic thinking |
| **Estimation** | 🔴 High | 0% coverage; the most-used adult maths skill |
| **Symmetry** | 🟠 Med | NCERT Ch.9 |
| **Number-line reasoning** | 🟠 Med | Central to integers, fractions, decimals |
| **Probability / chance** | 🟢 Low | Light at this level |
| **Constructions** | 🟢 Low | Physically hard on a phone; reasonable to omit |

### Sequencing — verified correct

Introduction points are sound and now board-aware. No concept appears too
early. `multiplication` at Class 1 correctly reflects the new *Joyful
Mathematics* sequence, and the topic-retirement window (counting drops after
Class 2) is a thoughtful touch most products miss.

**One concern:** ICSE operand scaling is a flat ×1.2 multiplier. ICSE is
broader in *conceptual scope*, not merely larger in *number size*. Scaling
magnitude is a proxy that does not represent the real difference.

---

## 8 · Assessment Quality

**Score: 6.5 / 10.** Materially improved by the interaction work; still limited
by format.

### Construct validity — measured

Tested whether the answer is findable *without doing the mathematics*:

```console
answer identifiable by shape alone : 0 / 1600 (0.0%)
```

✅ **Clean.** The historical defect where triangle-area answers were the only
non-integer has been fixed and holds under fuzzing.

### Distractor plausibility — a real weakness

```console
questions with an implausible distractor : 100.0%
```

Every sampled question contains at least one option more than 50% away from the
correct answer. A child can eliminate it at a glance, converting a 1-in-4
question into 1-in-3 or 1-in-2. **Effective guess rate is meaningfully above
25%.**

### Repetition within a session

```console
1st / addition / easy      : 6/10 distinct   ("1+2", "2+1", "4+1", "4+3"…)
1st / subtraction / easy   : 7/10 distinct   ("2−1" appears twice)
2nd / multiplication / easy: 9/10 distinct   ("10×2" appears twice)
```

Class 1 easy addition draws from ~16 possible questions. **40% of a session is
repeats.** Repetition is not inherently bad — but unplanned repetition within
minutes is massed practice, the weakest form.

### Format ceiling

Typed entry (mastery > 0.80) is the right answer and correctly implemented.
Below that threshold, multiple choice still dominates, so most learners —
especially the struggling ones this product should serve best — are practising
recognition rather than construction.

---

## 9 · Motivation Analysis

**Score: 7.5 / 10 — the most ethically careful part of the product.**

### What is right, and rare

- **No leaderboards.** Social comparison demotivates precisely the struggling
  learners who most need to continue. Their absence is a deliberate, correct
  choice.
- **No manipulative mechanics.** No energy timers, no gacha, no pay-to-skip, no
  loss-aversion language.
- **Sparse celebration.** Four earned moments only. Celebrating every correct
  answer devalues the signal and trains reward-seeking over understanding.
- **Streak forgiveness.** Practising yesterday but not yet today keeps the
  streak alive — small, humane, correct.
- **Mistake framing.** "Practice to clear them from your list" frames errors as
  *work to do*, not *failures to hide*. Well judged.

### Risks

| Risk | Severity | Mechanism |
|---|---|---|
| **Competence undermining** | 🔴 High | Self-Determination Theory requires autonomy, competence, relatedness. A learner at 5% success on 70% of their session experiences sustained incompetence. Motivation collapse is the predicted outcome. |
| **Timed questions** | 🟠 Med | 15 s countdown on every question. Timed testing is among the strongest correlates of mathematics anxiety, worst in early primary, and disproportionately affects girls and already-anxious learners. It is **mandatory and cannot be disabled.** |
| **Fixed-mindset framing** | 🟠 Med | "Skill mastery 5%" presented as a state. No language of growth, no "you improved 12% this week" — the trend data exists but is not surfaced motivationally. |
| **Streak pressure** | 🟢 Low | Mitigated by forgiveness, but milestone celebration still creates mild loss aversion. |

**The timer is the most actionable motivation fix in the product.** It is one
setting, and the evidence against mandatory timing at this age is strong.

---

## 10 · Educational Risks

Ordered by expected harm.

### 🔴 1 — Practice without instruction can entrench errors

The most serious risk. A child who holds `sub.smaller-from-larger` will
practise it repeatedly. The app detects it every time and names it — but never
teaches regrouping. **Repeated retrieval of an incorrect procedure strengthens
that procedure** (retrieval strengthens whatever is retrieved). The app may be
making some misconceptions *more durable*.

### 🔴 2 — Multiple choice trains elimination, not construction

Below mastery 0.80 — i.e. for every struggling learner — the dominant
experience is choosing among four visible options. The transferable skill being
practised is "recognise the plausible answer", which does not transfer to a
worksheet, an exam, or life.

### 🟠 3 — Symbolic-only fractions risk instrumental understanding

Fractions taught purely as symbol manipulation, with no area or set model,
reliably produce children who can compute `1/2 + 1/4` and cannot say which is
larger. Skemp's *instrumental vs relational understanding* — this design
produces the former.

### 🟠 4 — Speed signals may be misread as ability

Latency is captured and used to flag guessing (correct). But there is no
counterpart signal for *productive slow thinking*. A careful child and a
distracted child look similar; a fast guesser and a fluent recaller are
distinguished only by accuracy.

### 🟠 5 — Session repetition in early classes

40% repeats in Class 1 easy addition is massed practice, which produces
strong immediate performance and weak retention — and can create false
confidence in both child and parent.

### 🟢 6 — Word problems are formulaic

~8 templates per class band with substituted numbers. Children rapidly learn to
pattern-match the template rather than model the situation — the exact habit
word problems exist to prevent.

---

## 11 · Competitive Position

Learning effectiveness only. Ignoring popularity, graphics, business model.

| Product | Strength | Weakness | Est. score |
|---|---|---|---|
| **Khan Academy Kids** | Instruction + practice; genuine teaching; strong visuals | Weak adaptivity; no diagnosis | **7.5** |
| **IXL** | Enormous coverage; per-question explanations | Punitive SmartScore; drill-heavy; anxiety-inducing | **6.5** |
| **SplashLearn** | Strong visual models; good early-years pedagogy | Shallow adaptivity; heavy gamification | **6.5** |
| **Mathletics** | Curriculum-aligned; teacher tools | Traditional drill; weak diagnosis | **5.5** |
| **Prodigy (practice)** | Engagement; broad coverage | Maths is a toll gate; game/learning disconnect | **5.0** |
| **This app** | **Best-in-class diagnosis, spacing, mastery model** | **No instruction, no visuals, no estimation** | **6.4** |

### Where this product already wins

1. **Misconception diagnosis** — nobody in this list names the specific faulty
   rule and explains it. This is a genuine, defensible advantage.
2. **Mastery modelling** — decay, confidence and prerequisite tracing are more
   sophisticated than IXL's SmartScore.
3. **Ethical restraint** — no dark patterns, no social comparison. Notably
   cleaner than Prodigy or SplashLearn.
4. **Recognition → recall ladder** — the automatic promotion to typed entry at
   mastery is a design nobody else in this list implements.

### Where it loses decisively

1. **Khan Academy Kids teaches; this app only tests.** For a child who does not
   already know the material, Khan is strictly better.
2. **SplashLearn shows fractions; this app only writes them.**
3. **IXL explains every wrong answer step by step.** This app names the
   misconception but does not work the problem.

### Honest positioning

> **The best diagnostic practice engine in this comparison set, and the weakest
> teacher.**

It is currently the strongest *supplement* to instruction and the weakest
*substitute* for it. That is a viable product — but it must be positioned as
practice-after-teaching, not as a child's primary maths resource.

---

## 12 · Top 20 Educational Improvements

Ranked by expected effect on learning outcomes. Effect sizes cited from the
instructional-psychology literature where a robust estimate exists.

### Tier 1 — Transformational

| # | Improvement | Why | Effort |
|---|---|---|---|
| **1** | **Worked examples on repeated failure.** After 2 consecutive misses on a skill, show a step-by-step solution before the next attempt. | Worked-example effect is one of the largest in instructional psychology for novices (d ≈ 0.57). Directly addresses the app's central gap. | 2 wk |
| **2** | **Visual models for fractions, decimals and integers.** Fraction bars, number line, area model. | Converts symbol manipulation into understanding. The remediation text *already tells learners to use fraction bars* — build what you prescribe. | 3 wk |
| **3** | **Success floor in the scheduler.** Never let measured success fall below ~60% for a sustained period; descend the prerequisite graph instead. | Fixes the 5%-success trap. Protects both learning rate and motivation. | 1 wk |
| **4** | **Faded scaffolding.** Full worked example → partially completed → prompt only → unsupported. | Completion-problem effect; the standard way to move a novice to independence. | 2 wk |
| **5** | **Make the timer optional, default off below Class 3.** | Timed testing is a leading correlate of maths anxiety in early primary. One setting, large affective payoff. | 1 day |

### Tier 2 — High impact

| # | Improvement | Why | Effort |
|---|---|---|---|
| **6** | **Estimation strand.** "About how many?", "Is 47×8 closer to 300 or 400?" | 0% coverage today. Estimation is the most-used adult maths skill and the best proxy for number sense. | 1 wk |
| **7** | **Plausible distractors only.** Cap distractor distance at ~25% of the answer. | 100% of questions currently contain an eliminable option, inflating the guess rate above 25%. | 3 days |
| **8** | **Deduplicate within a session.** | 40% repeats in Class 1 is massed practice. | 2 days |
| **9** | **Patterns and sequences strand.** | NCERT Ganita Prakash Chapter 1; foundation of algebraic reasoning. Currently absent entirely. | 1 wk |
| **10** | **Extend misconception coverage to word problems, algebra, geometry.** | 17 of 41 skills currently produce no diagnosis. | 2 wk |
| **11** | **Multi-step word problems with staged grading.** | Isolates *which* step fails: comprehension, operation choice, or computation. Currently indistinguishable. | 2 wk |
| **12** | **Surface the growth trend.** "You improved 18% on subtraction this fortnight." | Trend data already exists in the mastery model and is never shown. Directly supports growth mindset. | 3 days |

### Tier 3 — Meaningful

| # | Improvement | Why | Effort |
|---|---|---|---|
| **13** | Self-explanation prompts — "Which method did you use?" after a correct answer | Self-explanation effect; cheap to implement, strong for transfer | 1 wk |
| **14** | Number-line interaction for magnitude, rounding, negatives | Continuous error signal; strongest single model for number sense | 2 wk |
| **15** | "Solve it another way" for secure skills | Builds flexibility; currently one method per question | 1 wk |
| **16** | Symmetry strand (NCERT Ch. 9) | Curriculum completeness | 1 wk |
| **17** | Retrieval-practice spacing across *sessions*, not only within | Spacing effect is stronger across days than within a session | 1 wk |
| **18** | Confidence rating before answering | Improves metacognitive calibration; identifies confident-but-wrong, the hardest case to remediate | 1 wk |
| **19** | Vary word-problem surface structure, not just numbers | Prevents template pattern-matching; supports transfer | 1 wk |
| **20** | Parent-facing explanation of the diagnosis | Remediation text is already written for adults — route it to one | 1 wk |

### Explicitly **not** recommended

- **More question categories.** 23 exist; 41% lack diagnosis. Depth beats breadth.
- **Leaderboards or social comparison.** Demotivates struggling learners.
- **Heavier gamification.** Erodes intrinsic motivation for learning tasks.
- **Faster feedback.** Already at 280 ms; further reduction harms reflection.
- **Reducing wrong-answer pause.** Deliberately long so the diagnosis is read. Correct as is.

---

## 13 · Final Verdict

### Is this one of the best mathematics practice applications available?

**Not yet — but it is two well-defined pieces of work away.**

The engineering is excellent and the *practice science* is genuinely
best-in-class: spacing, interleaving, mastery modelling and misconception
diagnosis are implemented better here than in products with a hundred times the
users. The ethical design is exemplary — no dark patterns, no social
comparison, no manufactured anxiety beyond the timer.

But the product currently embodies a specific and incomplete theory of
learning: **that mathematics is acquired through corrected retrieval.**
Retrieval is necessary. It is not sufficient. Mathematics is also acquired
through *seeing* structure, *explaining* reasoning, and *estimating* before
computing — and this app does none of those.

The most telling detail in the entire audit: the misconception library advises
*"use fraction bars to show that halves and thirds must be made the same size
first"* — and the app has no fraction bar. **The pedagogy is understood and
documented; it has simply not been built.**

### Would six months here beat six months of worksheets?

**Yes — clearly, for fluency.** Spacing, interleaving and adaptive selection
are decisively better than a static worksheet, and the retention advantage
would be real and measurable.

**No — for conceptual understanding.** A worksheet used by a competent teacher
includes explanation, diagrams and discussion. This app includes none of them.
For a child who does not already understand the concept, a good teacher with
paper still wins.

### Recommendation

Ship it — **as practice, positioned honestly as practice.** Do not market it as
a child's primary mathematics resource until items 1–5 are complete.

With Tier 1 done, this becomes a genuine 8.0+ product and a legitimate
contender for the best mathematics practice application available. The
foundation is strong enough that this is a matter of weeks, not a rebuild.

### The one-sentence summary

> **An outstanding diagnostician that has not yet learned to teach.**
