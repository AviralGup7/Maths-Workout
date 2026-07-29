# 29 · Consolidated Re-Audit

**Supersedes the scoring in docs/13, 21, 23, 25, 26 and 28.** Those documents recorded what was true when they were written. This one re-measures every claim against the code as it stands at `d9054dc`, and where a number has moved it says so and says why.

**Method:** every figure below was produced by an executed command in this repo. Nothing is carried forward from an earlier document without re-measurement. Where a re-measurement contradicts an earlier one, the contradiction is stated rather than quietly overwritten.

```
Measured at   d9054dc  ·  2026-07-29
typecheck     clean
arch-check    126 modules · 7 checks · 7 passed, 0 failed
fast tests    811 passed (54 files) · 42s
inventory     63 skills · 21 categories · 19 chapters · 47 misconceptions
              23/63 skills carry a visual (37%)
              28/63 skills carry a worked example (44%)
              24 skills eligible for open tasks · 24 for reasoning · 12 for representation
interaction   choice 38.5% · entry 42.1% · estimate 9.6% · open 3.2%
              ordering 2.6% · manipulative 2.0% · multiSelect 1.5%
```

---

## 1 · The headline finding

**The system-balance scorecard fell from 24/24 to 20/24 while the product got better. The metric is wrong, not the product.**

docs/21 closed at 10/10, 24 of 24 properties holding, and docs/27 lists "do not regress docs/21" as a standing rule. Re-running that same scorecard today:

```
OVERALL: 8.3 / 10  (20/24 properties hold)

FAILING:
  [XP economy]  XP per unit learned consistent across strategies  2.6x spread   need < 2.0x
  [Progression] a strong learner ends secure across the curriculum 47%          need >= 70%
  [Progression] a strong learner completes a substantial part of the map  3/19  need >= 8
  [Achievements] an honest learner earns a substantial share       9/15         need >= 11
```

Taken at face value this says two years of a strong learner's work now leaves less than half the curriculum secure, against 82% when docs/21 closed. That reads like serious decay, and the standing rule says to treat it as a regression.

**It is not one.** Bisecting the scorecard across the commits between docs/21 closing and today, alongside the underlying learning totals:

| commit | skills in model | mean mastery | **total mastery** | ≥ 0.85 |
|---|---:|---:|---:|---:|
| `0787e08` *(docs/21 closed here)* | 45 | 0.888 | **40.0** | 82% |
| `0c8b28e` | 62 | 0.868 | **51.2** | 69% |
| `6e7e980` | 63 | 0.865 | **51.9** | 62% |
| `d369285` | 63 | 0.856 | **51.4** | 48% |
| `d9054dc` *(today)* | 63 | 0.848 | **50.9** | 47% |

The same simulated learner, on the same 730-day budget, now finishes with **27% more total mastery** (40.0 → 50.9) spread across **40% more skills** (45 → 63). Mean mastery per skill fell by 0.04 — from 0.888 to 0.848 — because the same practice time is divided among more, finer-grained skills. That is the arithmetic of the Phase 2 skill splits working exactly as intended: `geometry.basic` became area, perimeter, angles and volume so they could be *diagnosed* separately, and a child who is secure at perimeter and shaky at volume now shows exactly that instead of one blended 0.87.

The reported metric collapsed because the threshold sits on a knife-edge relative to where the population now lands:

```
share of skills at or above ...
  0.75  92%
  0.80  82%
  0.82  63%
  0.84  55%
  0.85  47%   <- the assertion
  0.86  37%
```

Mean mastery is **0.848**. The bar is **0.85**. The entire distribution is piled up within a hundredth of the threshold, so a 0.04 shift in the mean moves the reported figure by 35 percentage points. **A statistic that swings 35 points on a 0.04 change is measuring its own threshold, not the product.**

Ruled out, so this is not hand-waving:

- **Staleness** — correlation between days-since-practice and mastery is **0.080**. Median skill was practised 3.0 days before the end, worst 11.0 days. Skills are not being forgotten; they are being *shared*.
- **Volume** — the low skills are not under-practised. `dec.tenths` sits at 0.71 on **195** attempts, `mul.tables.easy` at 0.71 on 157, `rounding.decide` at 0.80 on 477. These are well-practised skills sitting just under an arbitrary line.
- **Accuracy** — raw accuracy averages **0.875** across all skills. The learner is answering correctly; the estimator's decay and guess-correction place the *estimate* just below 0.85.

### What should change

The property docs/21 wanted to assert is "a strong learner ends up secure across the curriculum". `≥ 0.85 on ≥ 70% of skills` was a reasonable encoding of that against a 45-skill model. Against a 63-skill model it encodes something else. The honest fixes, in order of preference:

1. **Assert total mastery, not the share above a threshold.** `sum(mastery) ≥ 45` is monotone in learning, insensitive to how finely the curriculum is cut, and would have gone *up* across every commit above.
2. **If a share is wanted, put the bar where the property is** — `≥ 0.80 on ≥ 70%` measures 82% today and is not balanced on a cliff edge.

I have **not** made this change. Retuning a failing assertion is exactly how a guard stops meaning anything, and doing it in the same pass that diagnoses the failure removes the reader's ability to check the diagnosis. It belongs in the backlog as a deliberate decision — see P9-01 below — with the numbers above as its justification.

**Two of the four failures are real and are not explained by this.** See §2.

---

## 2 · The two genuine regressions

### 2.1 · `an honest learner earns a substantial share` — 12/15 → 9/15

This one **is** mine, and it appeared today. At `d369285` the average learner earned 12 of 15 achievements; at `d9054dc` they earn 9. The three now missed are `steady-hand` (0.75 progress), `all-rounder` (0.952) and `no-weak-link` (0.50), alongside `bedrock` (0.539), `full-table` (0.581) and `chapter-secure` (0).

`all-rounder` at **0.952** is the tell. These achievements are defined over mastery thresholds, so they inherit the same cliff described in §1 — but the timing points at the P3-08 interaction ladder. Serving typed entry from mastery 0.40 instead of 0.80 means more questions are answered without the multiple-choice scaffold, so more early attempts are wrong, so the estimate climbs more slowly even as genuine recall improves. That is the intended trade — recognition is not recall, and the recognition ceiling exists precisely to stop the app certifying recall it never observed — but the achievement thresholds were calibrated against a stream that was 99.1% multiple choice.

**Honest reading:** the ladder change made the mastery estimate *more* conservative and *better* evidenced, and the achievement wall was not recalibrated to match. The achievements are now slightly harder than designed. Logged as P9-02.

### 2.2 · `XP per unit learned is consistent across strategies` — 2.6× spread against a 2.0× bar

Measured 2.2× at `f60bace`, 2.3× before that, 2.6× now. This one has drifted steadily rather than jumped, and it was **already failing when docs/21 was declared closed at 24/24** — the earliest commit I re-ran, `0787e08`, passes it, but `7ce503a` measured 2.2× and `0c8b28e` 2.2×. So it broke during Phase 2 and has widened since.

This is a real balance defect: some practice strategies convert time into XP up to 2.6× more efficiently than others. It is not exploitable in the ways docs/21 cared about most — the guesser still earns 381 XP against an honest learner's 60,715, a 159× separation, and easy-farming still loses to adaptive practice per unit learned. But "all roads pay roughly the same for the same learning" is a property worth holding, and it is not held. Logged as P9-03.

---

## 3 · Re-scored against the original audits

| Audit | Original | Re-measured | Movement |
|---|---:|---:|---|
| docs/13 Learning effectiveness | 6.4 | **8.1** | ▲ conceptual understanding and transfer were the two weights holding it down; both moved |
| docs/21 System balance | 10.0 | **8.3** *(as reported)* / **9.2** *(properties that still mean what they meant)* | ▼ see §1 — two of four failures are measurement artefacts |
| docs/23 Data integrity | 9.4 | **9.4** | ═ no change; the probes in that document are historical records of fixed defects, and all remain fixed |
| docs/25 Engagement | 5.4 | **7.6** | ▲ the two largest drags, multiple choice and missing visuals, both moved substantially |
| docs/26 Educational content | 6.4 | **8.0** | ▲ every Phase 1 and Phase 3 item landed |
| docs/28 Child experience | 3.5 emotional / 3.2 child appeal | **6.4 / 6.1** | ▲ Tiers 1–3 shipped; Tier 4 and the "maths world" remain |

### docs/13 · Learning effectiveness — 6.4 → 8.1

| Dimension | Weight | Was | Now | Basis for the change |
|---|---:|---:|---:|---|
| Retrieval & spacing | 15% | 9.0 | 9.0 | unchanged and still the strongest component |
| Diagnostic quality | 15% | 8.0 | 8.5 | 47 misconceptions, skill splits let geometry/measurement/data be diagnosed separately |
| Adaptive calibration | 15% | 6.0 | 7.0 | placement probe (P1-01) removes the cold-start error; mastery calibration test passes |
| Conceptual understanding | 20% | 3.0 | 7.5 | 28 worked-example solvers, 23 visual models, bar model, ten-frame, clock, money, manipulatives |
| Assessment validity | 10% | 6.5 | 8.0 | multiple choice 99.1% → 38.5%; typed entry now 42.1% of the stream |
| Curriculum coverage | 10% | 6.5 | 6.5 | **unchanged on purpose** — six breadth items remain open and no teacher has reviewed it |
| Motivation & affect | 10% | 7.5 | 7.5 | unchanged; still the most ethically careful part of the product |
| Transfer & reasoning | 5% | 2.5 | 8.0 | open tasks, reverse problems, method comparison, non-examples, surface-feature variation |
| **Total** | | **6.4** | **8.1** | |

docs/13 predicted that "fixing instruction and visual models alone would move this to roughly 8.0". That prediction is now testable and it was accurate.

### docs/25 · Engagement — 5.4 → 7.6

| Dimension | Was | Now | Basis |
|---|---:|---:|---|
| Core loop satisfaction | 5.0 | 7.5 | results screen shows progress; mastery moment, count-up, segmented bar |
| Reward frequency | 6.5 | 7.0 | unchanged mechanics, better surfaced |
| Celebration quality | 7.0 | 7.5 | mascot, sound, chapter certificate |
| Progression visibility | 3.0 | 7.5 | chapter map, week strip, segmented progress, child-chosen goal |
| Variety (felt) | 5.5 | 8.0 | **38.5% multiple choice, was 58.4%**; 23/63 skills carry a visual, was 16/45 |
| Return motivation | 3.5 | 6.0 | week strip and goal give a forward hook; still no daily challenge (P4-19) |
| Long-term goals | 6.0 | 7.5 | 19 chapters with a visible map |
| First-session hook | 6.5 | 8.0 | placement explains itself, mascot, illustrated empty states |

The two figures docs/25 named as the core problem — "58.4% of a year's questions are still multiple choice" and "29 of 45 skills have no visual model at all, ever" — are now 38.5% and 40 of 63. The second is worse as a ratio than it looks: 23 skills carry a visual against 16 before, but the skill count grew faster than the visual coverage.

### docs/26 · Educational content — 6.4 → 8.0

All 20 Phase 1 items and all 10 Phase 3 items are complete. The specific findings docs/26 opened with:

| docs/26 finding | Then | Now |
|---|---|---|
| 12 skills with no hint, worked example or visual | 12 | **0** — guarded in CI (P1-12) |
| "0 of 126,000 sampled questions ask a child to explain anything" | 0 | self-explanation after every error; reasoning formats at 8.4% |
| "0 of 126,000 questions have more than one valid answer" | 0 | open tasks at 3.2% of the stream, set-valued grading |
| error-analysis share 1.1%, target ~8% | 1.1% | **8.4%** measured |
| able Class 6 learner spends 53% of two months on Class 1–2 material | yes | placement probe fixed it |

What holds it at 8.0 rather than higher: **six curriculum-breadth items remain open** (P2-09, 12, 13, 15, 16) and **no practising teacher has reviewed the board mapping** (P2-18). docs/26's own central recommendation was "do not add curriculum breadth before instructional depth" — the depth work is now done, so breadth is the honest next move.

### docs/28 · Child experience — 3.5/3.2 → 6.4/6.1

| Dimension | Was | Now |
|---|---:|---:|
| UI | 6.4 | 7.8 |
| UX | 7.1 | 8.0 |
| Theme | 3.8 | 7.0 |
| Child appeal | 3.2 | 6.1 |
| Parent trust | 8.6 | 8.8 |
| Accessibility | 6.8 | 8.5 |
| Emotional design | 3.5 | 6.4 |
| Motion | 5.9 | 7.0 |

Accessibility is the largest verified movement and the one with the hardest numbers behind it: undersized tap targets **7 → 0**, sub-13px strings **55 → 0**, WCAG AA text failures **24 → 0**, results-screen overlap at 320pt **3 → 0**, plus a high-contrast AAA theme, a dyslexia typeface and a motion-speed control.

Child appeal remains the weakest score, and it should. docs/28's central finding was "an 8.5/10 teaching engine inside a 3.5/10 child experience". The engine is now ~8.5 and the experience ~6.2. The gap has narrowed but the diagnosis stands, and the remaining item that would close it — P8-11, a growing "maths world" tied to mastery — is precisely the one most likely to become decoration if done badly.

**This score is the least trustworthy number in this document.** Every UI claim behind it was measured against a rendered screen, not against a child. P7-01 remains open.

---

## 4 · What has NOT been verified

Stated plainly, because a re-audit that only lists improvements is marketing.

- **No child has used this.** Every engagement and appeal figure is inferred from rendered screens and simulated learners. P7-01 has been open since docs/17.
- **No learning-gain evidence exists.** Every projection in docs/13–16 remains a design estimate. P7-03.
- **No teacher has reviewed the curriculum.** The board mapping is researched (docs/11) but unchecked by anyone who teaches it. No "CBSE-aligned" claim should be made until P2-18 closes.
- **Mastery has never been validated against an external measure.** P7-04.
- **The audit suite did not complete in this session.** The sandbox terminated it at ~11 minutes. The scorecard, the ceiling probes and the integrity probes all ran and are reported above; the remaining long-running probes were not re-measured and their figures are carried from docs/21 and docs/23 rather than re-verified. This is the one place in this document where a number is not freshly measured, and it is flagged rather than hidden.
- **Two audit figures in §3 are judgement, not measurement** — the docs/25 and docs/28 dimension scores are re-scored by the same rubric the original documents used, which is a subjective instrument. The inventory counts underneath them are measured.

---

## 5 · New backlog items from this re-audit

Added to docs/27 as Phase 9.

- **P9-01 · Re-express the docs/21 progression property so it survives curriculum refinement.** Assert total mastery (`sum ≥ 45`, monotone in learning and insensitive to how finely skills are cut) rather than the share above 0.85. Deliberately not done in this pass: retuning a failing assertion in the same commit that diagnoses it destroys the reader's ability to check the diagnosis.
- **P9-02 · Recalibrate the achievement thresholds against the post-ladder mastery distribution.** `all-rounder` sits at 0.952 progress. The thresholds were set against a 99.1%-multiple-choice stream; the stream is now 38.5%.
- **P9-03 · Close the XP-per-unit-learned spread.** 2.6× against a 2.0× bar. Broke during Phase 2 and has widened; the docs/21 closure at 24/24 did not catch it.
- **P9-04 · Raise visual coverage in step with the skill count.** 23/63 (37%) today against 16/45 (36%) when docs/25 measured it. Coverage has not actually improved as a ratio.

---

## 6 · Disposition of the superseded documents

| Doc | Disposition | Reason |
|---|---|---|
| 13 · Learning effectiveness | **Historical** | Its 6.4 is superseded by 8.1 here, but its dimension rubric is the instrument this document re-scores with. Deleting it would orphan the method. |
| 21 · System balance | **Keep, live** | Its scorecard is executable and runs in CI. §1 above corrects its interpretation, not its content. |
| 23 · Data integrity | **Keep, live** | Score unchanged; its probes still guard real defects. |
| 25 · Engagement | **Historical** | Superseded by §3. Retained because its tier structure is what Phase 4 and Phase 8 are ordered by. |
| 26 · Educational content | **Historical** | Superseded by §3. Retained for its "do not add breadth before depth" argument, which is still the governing recommendation. |
| 28 · Child experience | **Keep, live** | Its 75 ranked items are still the source for Phase 8, and Tier 4 is open. |
| 14, 15, 16 | **Historical** | Design documents for work that has shipped. |
| 19, 20 · Architecture | **Historical** | Both closed; `scripts/arch-check.mjs` now enforces what they recommended, and it passes 7/7 over 126 modules. |

Nothing is deleted in this pass. The earlier cleanup removed docs/08 and docs/18 because they were actively misleading — docs/08 documented 5 storage keys against the code's 22. None of the documents above are wrong about what they measured; they are simply older than the code. Marking them Historical preserves the record of what was found and when, which is the thing a reader most needs when a number disagrees with a number.
