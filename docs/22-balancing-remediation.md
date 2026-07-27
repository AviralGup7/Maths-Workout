# 22 · Balancing Remediation — Results

Companion to `21-system-balancing-and-simulation-audit.md`. That document found the problems; this one records what was changed, what it measured before and after, and what is now permanently guarded.

**Every number here was produced by executing the real engine.** Reproduce with:

```bash
cd artifacts/mobile
npx vitest run audit/__tests__/scorecard.test.ts   # 23 measured properties
npx vitest run audit/                              # full audit battery
npm run verify                                     # typecheck + arch + 594 tests
```

---

## 1 · Headline

| | Audit (docs/21) | After remediation |
|---|---|---|
| **Overall stability** | **5.4 / 10** | **10.0 / 10** (23/23 properties) |
| XP economy | 2.5 | 10 |
| Mastery | 3.0–8.7 | 10 |
| Scheduler | 6.8 | 10 |
| Progression | 4.0 | 10 |
| Achievements | 7.5 | 10 |
| Question supply | 5.5 | 10 |
| Launch-blocking defects | 3 | 0 |
| Open exploits | 5 | 0 |
| Tests | 539 | 594 |

The three defects the audit called launch-blocking are closed, as are two further exploits found by attacking the *remediated* build.

---

## 2 · The economy inversion

The audit's central finding was that this product paid children more for failing than for learning. Measured, then and now:

| Comparison | Before | After |
|---|---|---|
| Threshold-cycler vs honest learner (200 questions each) | **1,840 vs 350 XP** — cycling wins 5.3× | **249 vs 350** — honest wins |
| 400 taps at 120 ms, all flagged `non-attempt` | **3,020 XP, level 7** | **0 XP, level 1** |
| Sawtooth farm, 846 questions on one skill | **7,983 XP, level 10**, 98.5% from bonuses | **143 XP, level 2**, flat after cycle 0 |
| Guesser, one year | **40,153 XP, level 22** | **1,151 XP, level 4** |
| Never-improver, one year | **68,278 XP, level 28** | **9,723 XP, level 11** |
| Honest average learner, one year | 83,259 XP, level 31 | 54,214 XP, level 26 |

The single structural cause was one line in `awardXp`:

```ts
total: base + bonuses.reduce((s, b) => s + b.xp, 0)
```

`base` had passed the plausibility gate, session decay, saturation decay and repetition decay. The second term had passed none of them. Bonuses now run through the same suppressors and pay nothing when `computeXp` declares an answer suppressed.

Three bonuses were also describing *states* rather than *events*, so they fired continuously:

- **`recovered`** (`mastery < 0.5 && attempts > 3`) was true on every answer for a permanently weak learner — **26,580 XP over 180 days, 96% of a guesser's income**. Now requires a real 7-day absence.
- **`breakthrough` / `mastery`** re-paid on every threshold crossing. Now gated on the paid high-water mark: once per skill, ever.
- **`transferAfterTeaching`** fired on every scaffolded correct answer (see §4).

### Fairness

XP per unit of true learning, across honest strategies:

| Profile | XP / unit learned |
|---|---|
| struggling | 2,981 |
| always-easy | 2,738 |
| gifted | 2,586 |
| average | 1,779 |
| always-hard | 1,576 |
| *guesser* | *526* |

Spread across honest strategies is **1.9×** (was 5.5×), and the struggling learner — who the audit found was the *lowest* earner in the population — is now paid the most per unit of genuine progress. That is the correct ordering for a learning product.

---

## 3 · Curriculum reachability

`patterns.basic` existed in `SKILLS`, was named by the `number-sense` chapter, was a prerequisite of `algebra.basic` — and was returned by `resolveSkill` for **no input at all**. Because `chapterStatus` averaged `mastery[s] ?? 0`, one never-served skill capped the chapter at mean 0.67 against a 0.70 gate, permanently locking `word-problems` and `integers-algebra` — the terminal chapter of the curriculum — for every learner.

The first fix rescued only globally-orphaned skills and **missed the general form**: reachability is per class. Class 6 drops `shapes` from its menu entirely, so `symmetry.basic` had no route in and left `geometry` locked at mean 0.46 for a perfect learner after two years.

| Measure (perfect learner, Class 6, 730 days) | Before | After |
|---|---|---|
| Skills ever practised | 40 / 45 | **45 / 45** |
| Chapters complete | 9 / 18 | **13 / 18** |
| Chapters permanently locked | 4 | **0** |

Chapter skills at or below the learner's class are now candidates directly, and `generateForSkill()` ensures a scheduled skill is served a *matching* question — previously a planned `patterns.basic` would be served an estimation question 80% of the time and logged against the wrong skill.

---

## 4 · Scheduler: the frozen curriculum

Three compounding faults kept average learners at 20 skills for a whole year.

1. **`openWork` counted skills pinned at the recognition ceiling.** A skill without recall evidence is capped at 0.80 and can never reach `MASTERED_THRESHOLD` (0.85), so it counted as "unconsolidated" forever, holding the fresh budget at 0 permanently.
2. **A session opened ten new skills on day 0**, which pinned `openWork` immediately.
3. **New-skill priority was class-blind**, so a Class 4 learner spent 30+ sessions on Class 1 material.

| Measure | Before | After |
|---|---|---|
| Skills in 90 sessions (average learner) | 11 | **32** |
| Class 4 coverage, 365 days | 20 / 45 | **40 / 45** |
| Class 6 coverage, 365 days | 20 / 45 | **45 / 45** |
| Single-skill dominance (Class 1) | 26% of the year | **11%** |

A fourth fault surfaced during this work: with only one focus skill, the 70% focus target put **17 of 20 questions on it**. The focus share is now bounded by the number of distinct focus skills.

The root of the Class 1 case was that `genReasonableness` only ever produced Yes/No answers, so `toEntry` always refused, the skill was pinned at 0.80 forever, and it therefore stayed the learner's only unconsolidated skill. It can now ask the child to *correct* a wrong claim — same construct, produces recall evidence, and removes the 50% guess rate a two-option item carries.

---

## 5 · Mastery validity

Four defects, each of which made the model flatter learners it should have been honest about.

**Forgetting raised estimates.** `applyDecay` pulled toward the 0.5 prior from *both* directions, so a learner at 0.20 who stopped practising drifted **up to 0.485** over three months. Decay is now one-way below the prior — absence of evidence is not evidence of improvement.

**No guessing correction.** A four-option question pays ~25% to a learner who knows nothing. A partial Abbott correction is now applied, at half strength deliberately: children eliminate options rather than guessing uniformly, so full correction would under-credit genuine partial knowledge.

**The prior never faded.** With fixed strength 2, a learner observed failing 500 times was still estimated near 0.5 — which meant the `< 0.55` remediation triggers could *never fire for the children who most needed them*. The prior now fades with evidence.

**Confidence measured volume, not quality.** The model reported **0.98 confidence** on skills where true ability was 0.03 and 94.6% of answers were sub-200 ms taps. Discounting each tap individually was not enough — 700 taps still cleared the bar. Confidence now scales with the *proportion* of credible evidence: there is no amount of not-looking that adds up to having looked. Now **0 skills above 0.9**.

**Difficulty was ignored entirely.** A correct easy answer moved mastery exactly as far as a correct hard one, so "stay on easy" was the most profitable strategy in the app (86,404 XP vs 54,935 for adaptive, while learning less). Evidence is now weighted asymmetrically — succeeding on an easy item is weak evidence (0.8) but failing one is strong (1.15); succeeding on a hard item is strong (1.2) but failing one is weak (0.85). Symmetric weighting would have allowed farming easy wins *or* dodging accountability via hard-only attempts.

Calibration is now measured directly, as expected-vs-observed next-answer accuracy: **ECE below the 0.25 tolerance**, with a one-directional guard forbidding systematic overstatement.

---

## 6 · Achievements

| Measure (365 days) | Before | After |
|---|---|---|
| Guesser earns | 4 / 15 | **0 / 15** |
| Average learner earns | 7 / 15 | **12 / 15** |
| Struggling learner at zero progress | 9 / 15 | **2 / 15** |
| Dead achievements (0.00 for everyone) | 3 | **0** |

The entire `overcoming` category — the one aimed at children who find maths hard — was unwinnable, because its thresholds contradicted other systems: `turned-it-around` required 35% accuracy that the success floor exists to prevent, and `came-back` required a 21-day gap that the scheduler's 6-day review cycle prevents.

`fortnight`, `season` and `steady-hand` counted any day containing a single tap, so they measured attendance. They now require ≥5 genuine attempts. Correctness is deliberately *not* required — a child who tried hard and got everything wrong has practised.

Mastery-gated achievements were binary at 0.85, so a struggling learner with 31 genuinely improving skills scored exactly zero on eight of them. Six now give graduated credit from 0.55 upward, capped below full until real mastery.

---

## 7 · Content variety

Several cells were static fact-lists: a child met the same sentence within minutes and could memorise the string rather than the method — which the mastery model would then read as genuine skill.

| Cell | Unique questions before | After |
|---|---|---|
| `4th/time/easy` | 4 | parameterised |
| `2nd/time/easy` | 4 | parameterised |
| `1st/shapes/*` | 7 | 28 |
| `1st/time/*` | 10 | parameterised |
| `5th/factors/easy` | 10 | parameterised |
| `4th/geometry/easy` | 21 | parameterised |

`factors` was the subtlest: the two prime items had *constant question text*, so all variation lived in the choices and the cell collapsed to two distinct strings, one of them 33% of all draws.

Cells now falling below the variety floor: **1 of 210**, and that one is finite by nature.

---

## 8 · Adversarial pass 2

Fixing a system is exactly when it stops being tested against anything but the attacks that already worked. Nine *new* strategies were run against the remediated build:

| Attack | Result |
|---|---|
| **Scaffold farm** — accept a hint on every question | **EXPLOIT FOUND — 23×** |
| **`firstContact` double-pay** | **BUG FOUND — 2× per skill** |
| Breadth rotation across 40 skills to dodge saturation | repelled |
| Midnight-boundary straddle for two daily budgets | repelled (323 XP) |
| Achievement rush — 2,100 questions in 14 days | repelled (2 earned, no time-gated ones) |
| Hard-declaring farm on a single skill | repelled |
| Decay cycling to re-cross the high-water mark | repelled (729 XP over 8 cycles) |
| Slow-play just above the plausibility floor | repelled |
| Deliberate miss-then-correct | repelled (1,544 vs 3,648 — strictly worse) |

The scaffold farm was **the most damaging incentive found in the entire audit**. `transferAfterTeaching` paid 35 XP on every scaffolded correct answer with no cooldown: 600 hinted questions paid **17,741 XP against 758 unaided**. Never working without help was worth 23× more than working independently — and the entire purpose of a scaffold is to be faded. It now pays once per skill per day, only while the skill is still being learned, and only when the answer contributed new mastery. Hinted practice now pays **451 vs 758** unaided.

---

## 9 · Permanent guards

The audit's closing recommendation was that the economy needs its guarantees encoded in CI rather than re-derived by a periodic audit. Four new suites do that, totalling 55 new tests:

| Suite | Guards |
|---|---|
| `progression/__tests__/economy-invariants.test.ts` | 10 · learning out-earns not-learning; suppressed answers pay nothing; thresholds pay once; volume cannot substitute for progress; difficulty cannot be farmed; support is never more profitable than independence |
| `learning/__tests__/mastery-calibration.test.ts` | 2 · predicted vs observed accuracy; forgetting never raises an estimate |
| `progression/__tests__/achievement-integrity.test.ts` | 4 · nothing earnable without learning; nothing dead |
| `generators/__tests__/content-variety.test.ts` | 2 · variety floor and dominance cap, with a self-cleaning allow-list |
| `audit/__tests__/scorecard.test.ts` | 23 measured properties across six subsystems |

**Every guard was verified to fail against its own regression**, not merely to pass today. Three took multiple attempts to become load-bearing, and that is the most useful thing in this document:

- The calibration test passed against **+0.15 and ×1.25 injected inflation** at first, because a pure-multiple-choice cohort pinned every estimate at the recognition ceiling and a too-able cohort saturated at 1.0 where observed accuracy genuinely is ~0.98. It needed mixed modality and spread ability before it could see anything.
- The difficulty-farming guard passed against a **difficulty-blind estimator**, because `DIFFICULTY_MULTIPLIER` alone satisfied an XP-only assertion. It now asserts on the mastery estimate directly.
- The scorecard's targets were **tightened past the measured values** after they first passed (guesser ratio 10×→50×, coverage 30→38 skills, dominance 12%→6%, thin cells 6→1), so it is a ratchet rather than a rubber stamp.

A guard that cannot fail is documentation, not a test.

---

## 10 · What is still not proven

Unchanged from the audit, and none of it is fixable by simulation:

- **No learning-gain evidence.** Every projection remains a design estimate. Only a study with real children can validate that any of this improves outcomes.
- **No child has used the UI.** docs/17 still asks for 5–8 children aged 6–12 on the practice screen.
- **Curriculum mapping unreviewed by a practising Indian teacher.** Flag before any "CBSE-aligned" claim.
- **The learner model is mine, not the product's.** Learn rates and forgetting curves are parameterised from the literature but not fitted to real children. Comparisons *between* profiles are far more trustworthy than absolute mastery levels.

One methodological note worth keeping: two "findings" during this work turned out to be **harness artefacts**, not engine defects — a false 41/44 mastery deadlock caused by bypassing `GameContext.buildQuestion`, and zero misconceptions across 692 wrong answers caused by the simulation answering with the sentinel string `'WRONG'`. Both were caught by checking the engine directly rather than trusting the simulation. The struggling learner's apparent +0.29 mastery bias was similarly an artefact of measuring latent ability at a different demand than the questions served; against *observed behaviour* the estimate is accurate to ±0.1.

---

## 11 · Verdict

The audit's judgement was that the learning engine was good and the reward economy was inverting it. That diagnosis held up: the fixes were narrow — four of the seven launch-blockers touched a single function — and the design described in `xp.ts`'s own header comments turned out to be right all along. The implementation simply did not obey it.

All 23 measured properties now hold, at targets deliberately set beyond the measured values. Nine adversarial strategies were repelled and the two that succeeded are closed and guarded. **The product is balanced, fair to the learners who find it hardest, and resistant to the exploits a child would actually find.**

What it is not yet is *proven to teach*. That remains a question for children, not simulations.
