# 21 · System Balancing & Simulation Audit

**Scope:** behaviour of the complete learning ecosystem over months and years.
**Not in scope:** implementation quality, UI, architecture. Every feature is assumed correctly implemented.
**Method:** every number below was produced by executing the real engine — `buildSession`, `estimateAll`, `recordAnswer`, `awardXp`, `evaluateAchievements`, `chapterStatus`, `generateQuestion` — under a simulated learner population. No claim in this document is an estimate unless labelled as one.

Harness: `artifacts/mobile/audit/harness.ts`
Probes: `artifacts/mobile/audit/__tests__/*.test.ts` (all runnable via `npx vitest run audit/`)
Baseline: commit `8ae6433`, typecheck clean, arch-check 7/7, 539 pre-existing tests passing.

---

---

> **STATUS — remediated.** Every finding in this document has been closed. The
> overall stability score moved from **5.4 to 10.0** (23 of 23 measured
> properties hold), and two further exploits were found by attacking the
> remediated build. See **`22-balancing-remediation.md`** for before/after
> measurements, the permanent CI guards, and the three cases where a guard had
> to be rewritten because it passed against its own injected regression.
>
> The findings below are preserved as written, including the corrections noted
> in §1 — an audit that edits away its own mistakes is not worth acting on.

---

## 1 · Executive Summary

The engine's **core thesis is sound and empirically confirmed**: XP is paid for movement in the mastery model, mastery cannot be farmed because a mastered skill cannot move, and the high-water ledger (`payableDelta`) correctly kills the primary oscillation exploit. Measured directly: 400 identical questions in one day drove `sessionDecay → 0.1`, `skillSaturation → 0.15`, `repetitionDecay → 0.1`, and base XP to **exactly 0**. That layer works precisely as designed.

**The economy is nevertheless broken, because the bonus layer sits outside every defence the core layer provides.**

`awardXp` computes `base` through the full suppressor stack, then adds `bonuses.reduce(...)` on top — unsuppressed, uncapped, and unconditioned on whether `computeXp` paid anything at all. Three measured consequences:

| Measurement | Result |
|---|---|
| 400 taps at 120 ms, every one flagged `suppressed: 'non-attempt'` | **3,020 XP, level 7, mastery 0.256**, 100 minutes |
| Sawtooth cycling one skill around the struggling threshold, 846 questions | **7,983 XP, level 10, mastery unchanged at 0.718; 98.5% of XP from bonuses** |
| 200 questions, honest 100%-correct vs deliberate 60%-correct cycler | honest **350 XP / level 2**; cycler **1,840 XP / level 5** |

The last row is the finding that matters most: **answering worse is worth 5.3× more XP than answering perfectly.** Because wrong answers cost nothing (`total: 0, suppressed: 'incorrect'`) while re-crossing `STRUGGLING_THRESHOLD` re-pays `breakthrough` (40) and `recovered` (30) without limit, the optimal strategy is deliberate, rhythmic failure. This is not a theoretical exploit — it emerged unprompted in the population simulation, where over 365 days the two profiles that learn *nothing* (`never-perfect`, `guesser`) finished at **levels 28 and 22 on 68,278 and 40,153 XP**, against the honest average learner's level 31. A child who learns nothing all year lands within 10% of a child who learns properly.

Two further systemic findings:

- **`patterns.basic` is unreachable from every class menu** (`resolveSkill` never returns it). Because `chapterStatus` averages `mastery[s] ?? 0`, the `number-sense` chapter is mathematically capped at mean 0.67 — below the 0.70 unlock gate — which **permanently locks `word-problems` and `integers-algebra` by cascade, for every learner, forever.** Confirmed against a perfect learner at 100% attendance for 730 days: 4 chapters still locked, 9 of 18 ever completed.
- **Mastery is well-calibrated for honest learners and badly inflated for guessers.** Average learner: bias −0.002, 0/26 skills overstated. Guesser: bias **+0.376**, 12/16 skills overstated by >0.25, with `confidence` reported as **0.98** on skills where true ability is 0.03. The estimator's confidence signal is measuring evidence *volume*, not evidence *quality*.

The recognition-ceiling ↔ interaction-ladder handshake, which I initially suspected of deadlocking, **is correct** — 0 of 44 skills are trapped. That result required routing the harness through `GameContext.buildQuestion`; a first pass that called `generateQuestion` directly showed a false 41/44 deadlock. Recorded here because it is the single most load-bearing negative result in the audit.

**Overall System Stability Score: 5.4 / 10 — not ready for a large launch.** The learning engine deserves roughly 8.5; the reward economy deserves roughly 2.5, and the reward economy is what children optimise against. Three defects (E1, C1, M1 below) are launch-blocking. All are narrow, well-localised fixes — the architecture is right, the arithmetic on top of it is not.

---

## 2 · Overall System Stability Score

| Subsystem | Score | Basis |
|---|---|---|
| Mastery estimation (honest learners) | **8.7** | bias −0.002, 0/26 overstated over 365 d |
| Mastery estimation (adversarial) | **3.0** | bias +0.376, confidence 0.98 on ability 0.03 |
| Adaptive / in-session | **8.0** | projected success held in band; no frustration spirals observed |
| Scheduler | **6.8** | correct concentration; coverage plateaus at 20 skills |
| Question distribution | **5.5** | 24 (class, cat, difficulty) cells under 100 unique items |
| Progression / chapters | **4.0** | 2 chapters permanently unreachable by cascade |
| Achievement economy | **7.5** | genuinely learning-tied; 4 of 15 farmable by attendance |
| **XP economy** | **2.5** | learning nothing out-earns learning; 5.3× inversion |
| **Weighted total** | **5.4** | economy weighted heaviest — it drives behaviour |

---

## 3 · XP Balance

### What works — verified, not assumed

The Δmastery core is genuinely exploit-resistant. Probe X2, 300 identical questions in a single day:

```
n    sessionDecay  saturation  repetition  baseXp  bonusXp  totalXp
60   0.6           0.15        0.1         0       0        266
300  0.1           0.15        0.1         0       0        266
```

Base XP is 0 from question 60 onward. `totalXp` is frozen at 266 for 240 consecutive questions. Grinding a mastered skill is worthless *by arithmetic identity*, exactly as `xp.ts` claims. This is a real achievement and should not be weakened by any fix below.

### XP inflation — CONFIRMED, severe

XP per question **falls** over time for honest learners (average: 20.9 → 9.1 → 5.7 → 4.1 per question across 30/90/180/365 days) because Δmastery shrinks as skills saturate. That is correct design. But total XP keeps climbing for learners with **zero** Δmastery, because bonuses are volume-linked in practice:

| Profile (365 d) | Answered | XP | Level | Mastery index | True skills ≥0.85 |
|---|---|---|---|---|---|
| gifted | 6,340 | 189,502 | 46 | 87 | 31 |
| average | 4,100 | 83,259 | 31 | 84 | 16 |
| **never-perfect** | 5,460 | **68,278** | **28** | 53 | **0** |
| **guesser** | 5,100 | **40,153** | **22** | 45 | **0** |
| struggling | 3,800 | 29,677 | 19 | 69 | 0 |

A learner with a latent learn-rate of 0.0001 — who by construction cannot improve — reaches **level 28 and 82% of the honest learner's XP**. The struggling learner, who genuinely improves, is beaten by both. The XP number is therefore not a signal of effort *or* learning; it is a signal of **time-on-device with periodic failure**.

### XP source decomposition (180 d, daily practice, probe `probe-xp`)

```
profile         answered  totalXp  learningXp  floorXp  firstContact  breakthrough  recovered  mastery  trueRecall
honest-average  3600      16141    6126        3227     180           1520          870        4020     200
pure-guesser    3600      27750    0           0        90            1080          26580      0        0
never-improves  3600      46776    3712        1237     200           10520         31110      0        0
```

This table is the whole diagnosis. The guesser's `learningXp` is **0.00** — the core is perfect. Yet the guesser earns **1.7× the honest learner's total**, of which **26,580 XP (96%) is the `recovered` bonus alone**. `never-improves` collects 31,110 from `recovered` plus 10,520 from `breakthrough`.

`BONUS.recovered` fires whenever `masteryBefore < 0.5 && priorOnSkill > 3`. For a learner permanently below 0.5, **that is every single correct answer, forever, at 30 XP each**, with no cooldown, no high-water gate, and no suppression. It is an unconditional 30 XP/answer income for being persistently bad.

### Optimal farming route (measured, 100 minutes)

1. Pick any skill. Answer wrong ~6 times to push mastery under 0.5.
2. Tap answers at random as fast as possible. ~25% land correct on 4 tiles.
3. Every correct tap pays `recovered` = 30 XP. Every threshold re-crossing adds `breakthrough` = 40.
4. Measured: **3,020 XP, level 7, in 100 minutes, final mastery 0.256.**

An honest learner needs roughly 6,458 XP for level 10 — about 28 days of genuine practice. The farm reaches level 7 in under two hours while learning nothing.

### XP starvation — CONFIRMED for the population that most needs reward

The struggling learner is the **lowest earner in the entire population** at every horizon (29,677 XP over 365 days vs 83,259 average) despite the highest effort-per-unit-progress. This is the exact inversion an educational economy must avoid: the child who finds maths hardest gets the least encouragement, while the child gaming it gets the most.

### Dead progression

- `comebackMultiplier` (up to 2.0×) — `recordAnswer` is the only caller of `awardXp` and **never passes `daysAvoided`**, so it is hardcoded to 1.0. The primary designed incentive for returning to an avoided skill does not exist at runtime.
- `BONUS.chapterMastery` (250 XP, the largest in the table) — defined in `xp.ts`, **never emitted** by `detectBonuses`. Completing a chapter pays nothing.
- `detectAvoidance`, `overReachRatio`, `dayCountsForStreak`, `STREAK_GRACE_DAYS_PER_WEEK` — all exported, none called from app code. The entire streak-integrity and avoidance-detection layer is inert.

`MAX_XP_PER_QUESTION = 250` also does not bound a question's payout: it caps `breakdown.total`, but `award.total = base + bonuses`, which can exceed it.

---

## 4 · Mastery Balance

### Rise rate — correct

`estimateAll` with Laplace smoothing (`PRIOR_STRENGTH = 2`) and a 12-attempt recency window produces a well-paced climb. Honest learners cross 0.85 only after sustained accurate performance, and the `RECOGNITION_CEILING = 0.80` guard correctly withholds the top band until recall-bearing evidence exists.

### Decay — correct and load-bearing

21-day half-life toward 0.5. The `long-breaks` profile (alternating 30-day-on/30-day-off) ends 365 days at mastery index 76 with **0 skills truly ≥0.85** — the model correctly reports erosion rather than flattering the learner. `exam-crammer` (4 sessions/day for 10 days each 90-day cycle) reaches index 82 with 23 true skills, showing cramming registers but the decay between cycles is honestly priced.

### Exploitable — YES, via confidence, not value

Guesser, after 365 days (probe V1):

```
skill                est   truth  attempts  conf
mul.tables.mid       0.08  0.03   536       0.98
placevalue           0.20  0.03   404       0.98
sub.within20         0.26  0.03   502       0.98
numsense.reasonable  0.29  0.03   176       0.98
```

The `value` estimates are appropriately low — the model is not fooled about ability. But `confidence = evidence × (0.4 + 0.6 × freshness)` where `evidence = min(1, n/8)`. After 8 attempts of *any* quality, confidence saturates at ~0.98. The model is maximally confident about a learner it has only ever observed guessing. Anything downstream that trusts `confidence` as a reliability weight — parent reports, diagnostics, any future cloud aggregation — will read pure noise as near-certain.

Overall aggregate bias by profile:

| Profile | mean est | mean truth | bias | overstated >0.25 |
|---|---|---|---|---|
| average | 0.834 | 0.836 | **−0.002** | 0/26 |
| struggling | 0.723 | 0.460 | +0.263 | 11/20 |
| guesser | 0.406 | 0.030 | **+0.376** | 12/16 |
| never-perfect | 0.506 | 0.031 | **+0.475** | 19/20 |

For honest learners the estimator is excellent. The +0.475 bias on `never-perfect` is largely the 0.5 prior refusing to fall — a learner who is genuinely at 0.03 is reported at ~0.5 because Laplace smoothing pulls sparse-per-skill evidence toward the middle and decay pulls stale evidence toward the middle too. Both pulls are toward 0.5, so **there is no force that can drive a persistently-failing learner's estimate to a low value.** This directly weakens `findRootGap` and `descendToPrerequisite`, both of which trigger on `< STRUGGLING_THRESHOLD (0.55)`.

### Predicts actual ability?

Yes for honest learners, no in general. Cross-skill Pearson correlation between estimate and latent ability is unstable and frequently negative (−0.53 to +0.93 across profiles at 365 d). This is partly an artefact of range restriction — when nearly every skill sits at 0.80, correlation is dominated by noise — but the `avoider` profile's consistently high correlation (0.88–0.93) versus `always-hard`'s consistently negative (−0.53) indicates the estimate tracks *engagement pattern* as much as ability.

---

## 5 · Adaptive Learning Balance

**This subsystem is the strongest in the product.** No changes recommended.

- **Stay challenged:** projected session success stayed inside or near the 0.70–0.85 target band for all honest profiles across all horizons. `applySuccessFloor` with the `MAX_DILUTION_RATIO = 0.5` cap behaved exactly as documented — it lifts pathological sessions without flattering the learner.
- **Frustration:** the struggling learner's realised accuracy was 0.555 → 0.614 → 0.647 → 0.668 across 30/90/180/365 days. Rising, and never near the ~5% catastrophe the original audit found. M1/M2/M3 are working.
- **Boredom:** `always-easy` reached mastery index 87 with 14 skills mastered and 31 skills touched — the ladder and fresh-budget kept it moving despite the learner always choosing easy. Good.
- **Trapped:** no profile stalled. The `openWork >= 6 ? 0 : openWork >= 3 ? 1 : count*0.20` fresh budget correctly gates expansion on consolidation.
- **Skip prerequisites:** `isReady` held. No profile practised a skill whose prerequisites were unmet and attempted.

One caveat: the `gap` reason requires `est.value < STRUGGLING_THRESHOLD`, and §4 shows a persistently failing learner's estimate cannot reach 0.55. **The prerequisite-descent machinery may therefore never fire for the learners it was built for.** This is a consequence of the mastery-floor issue, not a defect in `adaptation.ts`.

---

## 6 · Scheduler Balance

### Repetitive — bounded, acceptable

Distribution is flat and healthy. Class 4, 365 days, 5,940 questions: top skill 6.3%, top-3 share 18%. Weighted rotation concentrates without excluding. No skill dominates.

### Ignores important skills — YES

Coverage plateaus hard:

| Class | Answered | Skills touched | Never seen |
|---|---|---|---|
| 1st | 5,900 | 14 / 45 | 31 |
| 3rd | 5,940 | 20 / 45 | 25 |
| 4th | 5,940 | 20 / 45 | 25 |
| 6th | 5,880 | 20 / 45 | 25 |

A Class 4 learner practising ~16 questions/day for a full year **never once meets** `add.3digit`, `sub.3digit`, `mul.tables.full`, `mul.2digit`, `div.tables`, `frac.equivalence`, `dec.tenths`, `factors.basic`, `geometry.basic` or `wordproblems`. These are core Class 4 content.

The cause is compositional, not a bug: the fresh budget collapses to 0 once `openWork >= 6`, and because mastery pins near 0.80 (below `MASTERED_THRESHOLD = 0.85`) for skills lacking recall evidence, `openWork` **never drops back below 6**. The learner is permanently in "consolidate, do not expand" mode. Note the strong learner (learnRate 0.45) escapes this and reaches 31 skills — so the plateau specifically punishes average and below-average learners, who need curriculum breadth most.

### Over-focuses weak skills — no. Under-reviews mastered skills — no

Probe S3, strong learner over 365 days: maximum inter-practice gap across all 20 mastered skills was **6 days**, against nominal intervals of 3–30 days. Maintenance is if anything *over*-serviced — `numsense.estimate` at mastery 0.93 has a nominal 30-day interval but was practised with a max gap of 5 days. The `OVER_PRACTICE_CAP = 0.25` is doing its job on the upper bound, but the interval stretch in `reviewIntervalDays` is not translating into actual spacing, because the maintenance pool is small enough that round-robin revisits everything quickly.

---

## 7 · Progression Balance

### Chapters — BROKEN, launch-blocking

`patterns.basic` is in `SKILLS`, is named by the `number-sense` chapter, and is **returned by `resolveSkill` for no (class, category, difficulty) triple**. It is generated only as a 20% random branch inside `generateQuestion`'s `number_sense` case, which means it can be *answered* but is never *scheduled* and never resolves as its own skill.

`chapterStatus` computes prerequisite readiness as `meanMastery(...) >= 0.70` over `mastery[s] ?? 0`. With one of three skills permanently absent, `number-sense` is capped at **mean 0.67**. It can never unlock its descendants:

```
chapter        skills  unreachable     maxAttainableMean  canEverUnlockDescendants
number-sense   3       patterns.basic  0.67               NO — PERMANENT LOCK

CHAPTERS PERMANENTLY UNREACHABLE BY CASCADE: word-problems, integers-algebra
```

`integers-algebra` is the terminal Class 6 chapter — the intended destination of the entire curriculum. It is unreachable for every learner who will ever use the app.

Confirmed empirically against the best possible case (probe G3): perfect learner, Class 6, **730 days, 100% attendance, 14,600 questions**. Result: **9 of 18 chapters complete, 4 still locked**, including `number-sense` at mean 0.86 — locked *despite* 0.86 mean, because the average includes a 0 for a skill the learner cannot be served.

Two further gate anomalies visible in the same run: `first-sums` shows `locked` at mean 0.91 and `place-value` at 0.90, both blocked by `counting` (mean 0.61, `count.skip` unseen). A single unserved skill silently freezes a whole branch.

### Unlock speed and stuck-ness

Where chapters do work, mastery-gating (never XP-gating) is the right call and behaves well. The `CHAPTER_UNLOCK_MASTERY = 0.70` / `CHAPTER_COMPLETE_MASTERY = 0.85` pair is sensible. The problem is entirely the `?? 0` treatment of unserved skills.

### Late-game pacing — healthy curve, wrong inputs

The `110 · (n−1)^1.15` curve itself is well-shaped:

| Level | Cumulative XP | gifted | average | struggling |
|---|---|---|---|---|
| 10 | 6,458 | 12 d | 28 d | 79 d |
| 20 | 30,362 | 58 d | 133 d | 373 d |
| 30 | 73,957 | 142 d | 324 d | 910 d |
| 50 | 225,073 | 434 d | 987 d | 2,768 d |
| 100 | 1,009,870 | 1,945 d | 4,427 d | 12,420 d |

Level 50 in ~1.2 years for a gifted learner and ~2.7 years for an average one is a defensible primary-school arc. No wall, no stall. But the struggling learner needing **7.6 years to reach level 30** while a guesser reaches level 22 in one year is the §3 inversion showing up in the pacing layer.

---

## 8 · Achievement Balance

Genuinely the best-designed reward surface in the product. Every achievement is tied to a state of learning; none counts raw questions. The design brief's "answer 100 questions" archetype is correctly absent.

Measured after 365 days (probe A1):

| Achievement | category | average | gifted | struggling | guesser |
|---|---|---|---|---|---|
| bedrock | mastery | 0.09 | 0.55 | 0.00 | 0.00 |
| full-table | mastery | 0.00 | 0.67 | 0.00 | 0.00 |
| chapter-secure | mastery | 0.00 | **1.00** | 0.00 | 0.00 |
| turned-it-around | overcoming | 0.00 | 0.00 | 0.00 | 0.00 |
| misconception-broken | overcoming | 0.00 | 0.00 | 0.00 | 0.00 |
| came-back | overcoming | 0.00 | 0.00 | 0.00 | 0.00 |
| fortnight | consistency | **1.00** | **1.00** | **1.00** | **1.00** |
| season | consistency | **1.00** | **1.00** | **1.00** | **1.00** |
| steady-hand | consistency | 0.50 | **1.00** | 0.50 | **1.00** |
| all-rounder | diversity | **1.00** | **1.00** | 0.18 | 0.00 |
| no-weak-link | diversity | **1.00** | **1.00** | 0.00 | 0.00 |
| recall-not-recognition | depth | 0.20 | **1.00** | 0.00 | 0.00 |
| long-memory | depth | **1.00** | **1.00** | 0.00 | 0.00 |
| right-sized | habits | **1.00** | **1.00** | **1.00** | **1.00** |
| reviewer | habits | **1.00** | **1.00** | **1.00** | 0.23 |

**Too easy / rewards attendance:** `fortnight`, `season`, `right-sized` and `reviewer` are earned by the pure guesser. All four count days or returns, not learning. `right-sized` in particular ("5–60 questions on 20 days") is pure attendance — the archetype the module's own header says it avoids.

**Too difficult / dead:** the entire `overcoming` category — `turned-it-around`, `misconception-broken`, `came-back` — scored **0.00 for every profile at every horizon**, including gifted and perfect. Three of fifteen achievements are unreachable in practice. `turned-it-around` requires early accuracy ≤0.35 on a skill that later exceeds 0.75; the success floor and prerequisite descent are specifically designed to prevent a learner ever sitting at 0.35, so the app's own remediation makes its own achievement unwinnable.

**Encourages bad behaviour:** mildly. `steady-hand` is earned by the guesser and not by the struggling learner, rewarding attendance over progress. No achievement rewards grinding volume directly — that part of the design holds.

**Distribution:** struggling learner earns 4 of 15 with 9 at exactly zero progress. A child who is genuinely improving sees two-thirds of the achievement wall permanently greyed out, with no partial credit visible on most of it.

---

## 9 · Economy Balance

Bringing §3 and §8 together — the currency question is *what does this product actually pay for?*

| Behaviour | Learning value | XP earned (365 d) |
|---|---|---|
| Honest sustained practice (average) | high | 83,259 |
| Never improving, high volume | **zero** | 68,278 |
| Random tapping, high volume | **zero** | 40,153 |
| Genuine struggle + slow real progress | **high** | 29,677 |

The economy pays, in descending order: **volume, then failure-cycling, then learning.** The design document asserts the opposite, and the *core formula* delivers the opposite — but the bonus layer inverts it before the number reaches the child.

The separation of Player Level (cumulative, never falls) from Mastery Index (honest, can fall) is excellent design and should be retained. It is currently the only thing preventing the XP inversion from also corrupting the ability signal: `masteryIndex` correctly reports 45 and 53 for the guesser and never-improver while their levels read 22 and 28. A parent looking at the level sees a thriving child; a parent looking at the mastery band sees the truth. **These two numbers currently tell contradictory stories, and the more prominent one is the false one.**

---

## 10 · Exploit Analysis

Ordered by profitability per unit of effort. All verified by execution.

| ID | Exploit | Status | Measured yield |
|---|---|---|---|
| **E1** | **`recovered`-bonus farm.** Stay below mastery 0.5, tap randomly. Every correct tap = 30 XP, no cooldown, no gate. | **OPEN — critical** | 26,580 XP over 180 d for a pure guesser; 96% of their total |
| **E2** | **Threshold sawtooth.** Cycle a skill across `STRUGGLING_THRESHOLD` to re-collect `breakthrough` + `recovered`. | **OPEN — critical** | 7,983 XP / level 10 from 846 questions on one skill, mastery unchanged at 0.718 |
| **E3** | **Deliberate-failure premium.** Wrong answers cost 0 XP and reset bonus eligibility. | **OPEN — critical** | 60%-correct cycler beats 100%-correct honest learner **5.3×** (1,840 vs 350 XP) |
| **E4** | **Non-attempt bypass.** `computeXp` returns `suppressed: 'non-attempt'` and 0, but `awardXp` adds bonuses anyway. | **OPEN — critical** | 100 of 400 fully-suppressed answers still paid; 3,020 XP in 100 min |
| **E5** | **Per-question cap bypass.** `MAX_XP_PER_QUESTION` caps `breakdown.total`, not `award.total`. | **OPEN — moderate** | Single answer can exceed 250 by the sum of concurrent bonuses (up to 210 extra) |
| **E6** | Infinite XP from mastered content | **CLOSED** | Base XP = 0 for 240 consecutive identical questions |
| **E7** | Mastery oscillation for `learningXp` | **CLOSED** | `payableDelta` high-water gate held in every run; guesser `learningXp` = 0.00 |
| **E8** | Difficulty-multiplier stacking | **CLOSED** | `MAX_MULTIPLIER_PRODUCT = 2.0` held; `always-hard` earned 47,911 vs average 83,259 |
| **E9** | Speed farming | **CLOSED** | Bonus gated on mastery ≥0.85 and a plausibility floor; `speed-focused` earned 32,609, below average |
| **E10** | Scheduler manipulation (choose only easy) | **CLOSED (beneficial)** | `always-easy` reached index 87 — the ladder converted easy practice into real progress |
| **E11** | Achievement farming by volume | **PARTIAL** | 4 of 15 earned by a pure guesser, all attendance-based |
| **E12** | Review farming | **CLOSED** | `retention` bonus requires `wasDue && masteryBefore >= 0.85` |

**Speedrunner's optimal route, end to end:** open any skill, miss six times, then tap at maximum speed forever. Never think. Yield ≈ 30 XP/answer at ~4 answers/minute ≈ **1,800 XP/hour**, indefinitely, with mastery frozen near 0.25. An honest learner peaks around 400 XP/hour early on and falls to ~80 XP/hour as skills saturate. **The exploit is 4.5× to 22× more efficient than learning.**

The single structural cause of E1–E5 is one line in `award.ts`:

```ts
total: base + bonuses.reduce((s, b) => s + b.xp, 0),
```

`base` has passed through every defence. The second term has passed through none.

---

## 11 · Long-Term Simulation Results

14 profiles × 4 horizons, driving the real engine. Mastery index is the app's own honest number; "true ≥0.85" counts latent ability the app cannot see.

### Expected mastery over time (mastery index, app's own metric)

| Profile | 30 d | 90 d | 180 d | 365 d |
|---|---|---|---|---|
| gifted | 81 | 81 | 80 | **87** |
| average | 79 | 77 | 79 | **84** |
| accuracy-focused | 80 | 79 | 81 | **85** |
| always-easy | 77 | 81 | 82 | **87** |
| avoider | 74 | 78 | 75 | **75** |
| exam-crammer | 0 | 80 | 80 | **82** |
| long-breaks | 67 | 77 | 61 | **76** |
| always-hard | 56 | 75 | 76 | **73** |
| speed-focused | 68 | 74 | 73 | **72** |
| inconsistent | 65 | 70 | 69 | **71** |
| struggling | 61 | 68 | 68 | **69** |
| never-perfect | 52 | 51 | 54 | **53** |
| guesser | 46 | 47 | 48 | **45** |

### Where learning slows

Three distinct plateaus, all visible in the data:

1. **The 0.80 wall (days 30–120).** Skills without recall-bearing evidence pin at exactly `RECOGNITION_CEILING`. Probe S2 showed 15 of 20 skills sitting at precisely 0.80. The ladder does break this — but only once mastery *reaches* 0.80, and only for skills where `toEntry` accepts the answer. Five skills have non-numeric answers (`shapes.basic`, `symmetry.basic`, `numsense.compare/estimate/reasonable`) where `toEntry` silently returns the question unchanged; these rely on their interactive variants or estimation bands instead, which is why they still clear the ceiling (49.7%–82% recall-bearing at mastery 0.80).

2. **The coverage plateau (days 60+).** 20 skills reached and held for the rest of the year for every average-or-below profile (§6). Monthly distinct-skill count over 365 days: 24, 25, 25, 25, 25, 25, 26, 26, 26. Flat from month 2.

3. **The chapter wall (permanent).** §7. Never resolves.

Repeat rate stays healthy for the average learner (0.194 → 0.10 across the year), so within the skills that *are* served, content variety holds up.

### Notable profile behaviours

- **exam-crammer** (4 sessions/day for 10 days, then 80 days off) ends at index 82 with 23 true skills — the second-best true outcome in the population. Massed practice followed by long decay is being priced roughly correctly, though the decay model is arguably generous to cramming.
- **avoider** (refuses division and fractions) plateaus at 75 and never recovers. `detectAvoidance` and `comebackMultiplier` exist to fix precisely this and are both inert (§3). This profile is the clearest demonstration of the cost of the dead levers.
- **long-breaks** oscillates 67 → 77 → 61 → 76, correctly tracking decay across absence cycles. Model behaving well.

---

## 12 · High-Risk Failure Modes

| # | Failure mode | Likelihood | Impact | Evidence |
|---|---|---|---|---|
| **F1** | **Reward inflation destroys the XP signal.** Levels stop meaning anything; parents see level 28 for a child who learned nothing. | **Certain** | Critical | §3, §9 |
| **F2** | **Deliberate failure becomes the meta.** Children share "answer wrong first, then tap" — it is 5.3× optimal and trivially discoverable by any child who notices XP after a bad run. | **High** | Critical | E3 |
| **F3** | **Progression collapse — curriculum terminus unreachable.** `integers-algebra` and `word-problems` locked for 100% of users forever. | **Certain** | Critical | §7, probe G3 |
| **F4** | **Motivation collapse in struggling learners.** Lowest XP, 4/15 achievements, 9 at zero progress, 0 chapters. The child who needs encouragement most receives least. | **High** | High | §3, §8 |
| **F5** | **Curriculum imbalance.** Average learners never meet half their own class's core content in a year. | **High** | High | §6 |
| **F6** | **Mastery inflation in the confidence channel.** Confidence 0.98 on ability 0.03 will corrupt parent reports and any future cross-device aggregation. | **Medium** | High | §4 |
| **F7** | **Adaptive remediation never fires for the worst-off.** Estimates cannot fall below ~0.5 under Laplace + decay, so `< 0.55` gap/descent triggers may never activate. | **Medium** | High | §4, §5 |
| **F8** | **Content exhaustion in low-variety cells.** 24 of 62 sampled cells produce <100 unique questions; `1st/multiplication/easy` produces **4**, `4th/time/easy` produces **4**, top item 25.5% of all draws. | **Medium** | Medium | §13 note |
| **F9** | **Achievement wall reads as permanently locked.** 3 of 15 unwinnable by anyone; the `overcoming` category is entirely dead. | **Medium** | Medium | §8 |
| **F10** | **Streak integrity absent.** `dayCountsForStreak` uncalled — "streak" currently means "opened the app", the attendance theatre the design explicitly rejects. | **Medium** | Medium | §3 |

On F8, the measured extremes (20,000 draws per cell): `1st/multiplication/easy` → 4 unique; `4th/time/easy` → 4; `1st/shapes/*` → 7; `4th/geometry/easy` → 21. Against `repetitionDecay`'s 60-question window, the probability of a repeat is ~1.0 in all of these. By contrast `4th/addition/*` yields ~18,700 unique per 20,000. The variance across cells is the problem, not the mean.

---

## 13 · Top 25 Balancing Improvements

Each solves a demonstrated problem. No new features.

### Launch-blocking

1. **Route bonuses through the suppressor stack.** Multiply `bonuses` by the same `decay` (`sessionDecay × skillSaturation × repetitionDecay`) already applied to base. Kills E1, E2, E4 in one line. *Fixes F1, F2.*
2. **Return zero bonuses when `computeXp` sets `suppressed`.** If the engine has declared an answer a non-attempt or incorrect, it must not pay. Currently 100 of 400 suppressed answers paid out. *Fixes E4.*
3. **Gate `BONUS.recovered` on the high-water ledger.** Pay it at most once per skill per genuine decay-and-recovery cycle — require `masteryAfter > ledger[skill]` or a minimum elapsed interval since the last `recovered` on that skill. This single change removes 96% of the guesser's income. *Fixes E1.*
4. **Gate `BONUS.breakthrough` on the high-water ledger** identically. Crossing 0.55 for the eleventh time is not a breakthrough. *Fixes E2.*
5. **Make `patterns.basic` reachable** — add it to `resolveSkill` (natural home: `number_sense`/`hard`, or its own difficulty branch). Unblocks `number-sense`, `word-problems`, `integers-algebra`. *Fixes F3.*
6. **Exclude never-served skills from chapter means.** `chapterStatus` should compute over skills with `attempts > 0`, or treat absent skills as "not yet counted" rather than 0 — a single unserved skill must never permanently freeze a branch. Defence-in-depth for the same class of bug as #5. *Fixes F3.*
7. **Apply `MAX_XP_PER_QUESTION` to `award.total`, not `breakdown.total`.** *Fixes E5.*

### High priority

8. **Add a per-day bonus budget** (suggest ~150 XP/day across all bonus types). Bonuses are peak events; peaks should be rare by construction.
9. **Wire `daysAvoided` into `recordAnswer`** so `comebackMultiplier` becomes live. The avoider profile plateaus at 75 for want of exactly this.
10. **Emit `BONUS.chapterMastery`** on chapter completion — currently the largest bonus in the table pays nothing.
11. **Add a struggling-learner XP floor.** Guarantee genuine effort on weak skills out-earns high-volume tapping. Currently struggling = 29,677 vs guesser = 40,153; this must invert. *Fixes F4.*
12. **Decouple `confidence` from raw attempt count.** Weight evidence by latency plausibility and answer-pattern entropy so 536 random taps do not read as 0.98 confidence. *Fixes F6.*
13. **Let mastery fall below the prior.** Introduce an asymmetric floor, or make `PRIOR_STRENGTH` decay with attempt count, so a learner at true 0.03 can be estimated below 0.5 and the `< 0.55` remediation triggers actually fire. *Fixes F7.*
14. **Break the `openWork >= 6 → freshBudget 0` deadlock.** Add a time-based escape (e.g. force one new skill if none introduced in 14 days) so average learners do not freeze at 20 skills. *Fixes F5.*
15. **Call `dayCountsForStreak`** wherever streaks are displayed. *Fixes F10.*

### Medium priority

16. **Raise question variety in the 24 thin cells.** Priority: `1st/multiplication/easy` (4 unique), `4th/time/easy` (4), `1st/shapes/*` (7), `1st/time/*` (10), `4th/shapes/easy` (13), `4th/geometry/easy` (21). *Fixes F8.*
17. **Loosen `turned-it-around`** to trigger on early accuracy ≤0.50 — the success floor makes ≤0.35 unreachable by design. *Fixes F9.*
18. **Reduce `misconception-broken` from 20 clear attempts to 12**, matching the 12-attempt recency window the mastery model already uses. Currently 0.00 for every profile.
19. **Rebalance `came-back`** — requiring a 21-day gap on a *mastered* skill conflicts with a scheduler whose measured max review gap is 6 days. It is unwinnable while the scheduler works correctly.
20. **Add partial-credit display** to the 9 achievements sitting at zero for struggling learners, so the wall reads as "not yet" rather than "not for you". *Fixes F4, F9.*
21. **Make `right-sized` require nonzero learning XP** on qualifying days — currently pure attendance, earned by the guesser.
22. **Honour `reviewIntervalDays` in maintenance selection.** Measured max gap was 6 days against nominal intervals up to 30; the stretch is computed and then ignored.
23. **Call `detectAvoidance`** from the session builder so avoided skills are surfaced rather than merely detectable.

### Lower priority

24. **Down-weight cramming slightly.** `exam-crammer` achieves the second-best true outcome (23 skills) on 10-day bursts; the decay model may be under-penalising massed practice relative to the research the design cites.
25. **Add per-attempt `id`** (device id + counter) to make the log a true CRDT. Not a balance issue today, but the current merge key collides at ms resolution and will corrupt XP and mastery on multi-device sync — the moment that ships, every finding in this document becomes harder to reason about.

---

## 14 · Final Verdict

**Do not launch to hundreds of thousands of learners in the current state.**

The learning engine is genuinely good. The mastery model is well-calibrated for honest learners (bias −0.002 over a simulated year). The adaptive layer holds learners in their productive band without frustration spirals. The Δmastery XP core is a genuinely novel and correct idea, and it survived every direct attack: 240 consecutive identical questions paid exactly zero, and the guesser's `learningXp` was 0.00 across 3,600 answers. The separation of a cumulative effort number from an honest ability number is the right architecture for telling children the truth without discouraging them.

**But the bonus layer nullifies all of it.** Bonuses are added after every defence, and the result is that this product currently pays children more for failing repeatedly than for learning — 5.3× more, measured. Over a simulated year, two learners who by construction cannot improve reached levels 28 and 22 against an honest learner's 31. That is not a tuning problem; it is a sign inversion in the incentive that children will actually optimise against. Compounding it, the terminal chapter of the curriculum is unreachable for every user who will ever install the app, because one skill in one prerequisite chapter is never scheduled.

The encouraging finding is that the causes are narrow. Four of the seven launch-blocking fixes touch a single function (`awardXp`), and one touches a single lookup table (`resolveSkill`). This is not an ecosystem that needs redesigning — the design is already right, and is written down correctly in `xp.ts`'s own header comments. The implementation of the bonus layer simply does not obey the design the rest of the file follows. Items 1–7 are, on the evidence, a few days of work, and I would expect the stability score to move from 5.4 to roughly 8.3 on their strength alone.

Two caveats on this audit's own authority, stated plainly. First, the learner model is mine, not the product's — latent ability, learn rates and forgetting curves are parameterised from the literature but not fitted to real children, so absolute mastery trajectories should be read as directional and the *comparisons between profiles* trusted far more than the levels. Second, I initially reported a 41-of-44-skill mastery deadlock that proved to be an artefact of my harness bypassing `GameContext.buildQuestion`; correcting it produced 0 of 44. The interaction ladder works. I have left that error visible in §1 because it is the clearest evidence in this document that findings must be produced by executing the real pipeline, and because an audit that hides its own corrections is not worth acting on.

**Verdict: fix items 1–7, re-run `npx vitest run audit/`, and confirm that the honest learner out-earns the guesser at every horizon. That single assertion — encoded as a permanent CI test — is the one guarantee this economy most needs and currently does not have.**

---

### Reproducing this audit

```bash
cd artifacts/mobile
npx vitest run audit/                     # all probes
npx vitest run audit/__tests__/probe-exploits.test.ts   # E1–E3
npx vitest run audit/__tests__/probe-bonusgate.test.ts  # E4, dead levers
npx vitest run audit/__tests__/probe-gates.test.ts      # chapter cascade
npx vitest run audit/__tests__/sim-profiles.test.ts     # 14 profiles × 4 horizons
```

Runtime ~5 minutes total. All probes are read-only against the engine; `npm run verify` (typecheck + arch-check 7/7 + 539 tests) still passes unchanged.
