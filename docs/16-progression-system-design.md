# 16 · Progression & Reward System Design

> **Status: HISTORICAL.** A design document for work that has shipped. The live backlog is `27-implementation-roadmap.md`.


**Scope:** all progression, XP, reward, achievement and balancing mechanics.
**Not in scope:** UI. Every number here is a system parameter, not a screen.
**Status:** designed, implemented as a reference economy in `progression/`, and
**simulated against adversarial strategies**. Not yet wired into the app.

---

## 1 · Core Design Philosophy

### The one decision everything follows from

> **XP is paid for movement in the mastery model, not for answering questions.**

Almost every educational XP system pays per correct answer, then bolts on rules
to stop the obvious exploit. That is backwards. It creates a profitable
behaviour and then polices it, and children are extremely good at finding the
cheapest path to a number that goes up. Rule-based patches always leave a
residue of "technically optimal, pedagogically worthless" play.

If payout is a function of Δmastery, grinding is not *punished* — it is worth
nothing, because **a skill you have already mastered cannot move**. The exploit
stops being a rule violation and becomes an arithmetic identity.

This is testable, and §11 tests it.

### Five principles

**P1 · Two numbers, because there are two questions.**
"How much work have I done?" and "how good am I?" are different, and merging
them forces a bad trade: a number that can fall feels punishing; a number that
cannot fall lies about ability. So we keep **Player Level** (cumulative, never
falls, records effort) and **Mastery Index** (honest, *can* fall, records
ability). Effort is never erased; ability is never overstated.

**P2 · XP unlocks nothing.**
Content gates on **mastery only**. Gating on XP means a child who grinds enough
easy questions unlocks material they cannot do — the exact failure the design
exists to prevent. XP is a record of work and a motivational surface. This
separation is the most important structural decision in the document.

**P3 · Prefer worthless over forbidden.**
A blocked action feels like punishment and invites circumvention. An
unprofitable action is simply ignored. Almost every countermeasure below sets a
payout to ~0 rather than refusing an input.

**P4 · The productive band should be the profitable band.**
We do not have to *tell* children to work at the edge of their ability. Because
over-reach produces wrong answers, and wrong answers move mastery down, the
mathematics makes the zone of proximal development the highest-earning strategy.
The economy enforces the pedagogy.

**P5 · Never punish difficulty, slowness, or failure.**
Wrong answers pay no XP but cost no XP. Slow answers get no speed bonus but no
penalty. The cost of a mistake is already paid, honestly, in the mastery model.
Charging twice would make XP a worse signal and teach children to avoid hard
things.

### What we explicitly reject

Coins, gems, energy/lives, loot boxes, leaderboards, avatars, purchasable streak
freezes, and any mechanic that monetises anxiety. All undermine intrinsic
motivation for learning tasks (overjustification effect) and several are
ethically inappropriate for a product used by six-year-olds.

---

## 2 · XP Formula

```
              ┌─ earned ──────────────────────────────┐
    XP  =  [ Δmastery_payable × 600 × skillWeight  +  1 ]
             × min(2.0,  difficulty × relativeChallenge
                       × interaction × structure × speed )   ← bonus, capped
             × attemptDecay × scaffoldDiscount × sessionDecay ← suppressors, uncapped
```

Capped at **250 XP** per question.

**Why the bracket comes first.** If Δmastery is zero, no multiplier can inflate
the result beyond the 1 XP floor. No stacking of difficulty, speed or question
type can ever make repeating mastered content profitable. The structure, not a
rule, guarantees it.

**Why bonuses are capped as a group but suppressors are not.** Simulation
caught this (§11, finding D1): stacked bonuses reached 2.8× and let a
"difficulty farmer" out-earn an honest learner while ending with a mastery index
of 16 vs 64. Bonus multipliers are now capped at 2.0 in aggregate. Suppressors
stay uncapped — they must always be able to drive payout to zero.

### Components

| Term | Range | Purpose |
|---|---|---|
| `Δmastery_payable` | 0 – 1 | The only source of real income |
| `XP_PER_MASTERY_POINT` | 600 | Scale, calibrated by simulation |
| `skillWeight` | 1.0 – 1.6 | Graph-derived: bottleneck skills pay more |
| `LEARNING_FLOOR_XP` | 1 | Keeps maintenance review from paying literally nothing |

**`skillWeight` is computed from the prerequisite DAG**, not hand-assigned, so
it stays correct as skills are added. A skill that blocks many others is worth
more because securing it unblocks downstream learning.

**On the floor payment.** Pure Δmastery pays zero for retrieval practice on a
secure skill — but that practice is what defeats the 21-day decay. Paying
nothing would teach children that reviewing is a waste of time. At 1 XP it is a
rounding error: ~330 farmed questions to match one properly learned skill, by
which point session decay has cut it to 0.1.

### Question-type weights

The brief asks that simple addition not equal long division. The honest version
of that requirement is subtler: **what should differ is the cognitive operation,
not the topic.**

Long division pays more than single-digit addition because it is multi-step and
holds more in working memory — not because "division" is a more prestigious
word. Topic difficulty is *already* captured by mastery: a child who finds
addition hard has low addition mastery and therefore large Δ to earn. Paying
extra for the topic on top would double-count, and would pay Class 6 children
more than Class 1 children for identical cognitive effort — indefensible in a
Class 1–6 product.

| Interaction | × | Why |
|---|---|---|
| `choice` | 1.00 | Recognition; answer is on screen |
| `entry` | 1.25 | Recall; no elimination possible |
| `multiSelect` | 1.30 | Every option must be evaluated |
| `ordering` | 1.35 | Relational reasoning across n items |

| Structure | × |
|---|---|
| single-step | 1.00 |
| estimation | 1.20 |
| multi-step | 1.30 |
| metacognitive (error-hunting) | 1.40 |

---

## 3 · Difficulty Multipliers

```
easy 1.00   medium 1.20   hard 1.40   expert 1.50
```

Deliberately narrow. The brief warns against "hard" becoming the only efficient
route, and two mechanisms prevent it:

**Relative challenge.** The same question pays differently to different
children, scaled by the gap between demand and *their* mastery:

| gap (demand − mastery) | × | meaning |
|---|---|---|
| < −0.30 | 0.60 | well within comfort |
| −0.30 … −0.10 | 0.85 | easy for them |
| −0.10 … +0.20 | **1.00** | the productive band |
| +0.20 … +0.40 | 0.90 | a stretch, still useful |
| > +0.40 | 0.75 | over-reach; likely guessed |

**The self-correcting loop.** Attempting work far above your mastery produces
mostly wrong answers; wrong answers move mastery down; negative Δ pays nothing.
Simulation confirms it: the difficulty farmer earned 60% of honest XP for 300%
of the effort.

---

## 4 · Speed Multipliers

**Max +15%. Min +0%. Never negative.**

Three rules, all necessary:

**1 · Only above `MASTERED_THRESHOLD` (0.85).** Speed before accuracy is a
misconception factory. Rewarding a struggling child for speed teaches them to
answer fast and wrong — and the engine already has a `guessing` detector firing
below 1200 ms.

**2 · There is a floor, not just a ceiling.** Answers faster than physically
plausible earn **no** bonus: you cannot have computed it. This is what stops
"tap the first tile instantly" from paying.

| structure | plausibility floor | fluent target |
|---|---|---|
| single-step | 1200 ms | 6 s |
| estimation | 1500 ms | 8 s |
| multi-step | 3000 ms | 20 s |
| metacognitive | 3500 ms | 25 s |

Both scale ×1.4 for Classes 1–2 and ×1.2 for Class 3 — younger children read and
process more slowly, and normal Class 1 pace must never read as suspicious.

**3 · Slow is never penalised.** Minimum multiplier is 1.0. A child who thinks
for 40 seconds and gets it right has done something valuable. Timed pressure is
a documented anxiety driver in early primary, which is why the timer already
defaults off below Class 3.

The bonus is small on purpose. Fluency is worth acknowledging, not chasing.

---

## 5 · Penalty Formula

**There is no XP penalty.** Wrong answers pay 0 and cost 0.

The cost of a mistake is already paid in the mastery model — the honest
currency. Deducting XP as well would double-punish, make the total a worse
progress signal, and teach children to avoid difficulty. Instead, three
*suppressors*:

**Attempt decay** — repeated misses on one skill in a session:

```
decay(n) = max(0.40, 0.75ⁿ)      n = prior misses this skill
```

Decays to a **floor of 0.40, not to zero.** A child who fails five times then
succeeds has done something genuinely hard; paying nothing is the fastest route
to learned helplessness. Low enough that guess-until-correct is unprofitable,
high enough that persistence visibly pays.

**Non-attempt suppression** — an answer below *half* the plausibility floor is a
tap, not an attempt. It pays nothing **and does not count** toward the recovery
curve, or a child could burn the decay with instant taps then answer properly at
full rate.

**Scaffold discount** — succeeding with a hint or worked example on screen pays
×0.5, matching the weight the mastery model already applies. Real, but not
unaided.

---

## 6 · Reward Formula (bonuses)

Every bonus is tied to **change**, never to volume. There is deliberately no
"answer N questions" bonus anywhere — that is the archetypal metric rewarding
attendance over learning.

| Bonus | XP | Trigger |
|---|---|---|
| `firstContact` | 10 | First correct on a never-attempted skill |
| `retention` | 15 | Completed a due spaced review above 0.85 |
| `trueRecall` | 25 | Mastery earned on produced, not recognised, evidence |
| `recovered` | 30 | Correct on a skill that had decayed below 0.5 |
| `transferAfterTeaching` | 35 | Correct on the twin straight after a worked example |
| **`breakthrough`** | **40** | Crossed 0.55 upward — the hardest climb |
| `misconceptionCleared` | 50 | A named misconception absent for 10 attempts |
| **`mastery`** | **60** | Crossed 0.85 upward |
| **`chapterMastery`** | **250** | Every skill in a chapter above 0.85 |

**The distribution is deliberately weighted toward strugglers.** Breakthrough
(0.55) and misconception-clearing are events that only happen to children who
were *failing*. Simulation (§11) shows a struggling learner earns nearly as much
bonus income as a strong one — 710 vs 400 XP over 30 days.

---

## 7 · Progression Curve

### Player Level — cumulative, never falls

```
cost(n) = 110 · (n − 1)^1.15
```

**These parameters were solved, not chosen.** A first pass used `40·n^1.55`,
which looked reasonable in the abstract and put level 10 at 146 days and level
50 at 27 years. The final values come from a least-squares fit against explicit
milestone targets at a measured earn rate (~200 XP/day):

| Level | Cumulative XP | Honest pace |
|---|---|---|
| 2 | 110 | ~1 day |
| 5 | 1,285 | ~11 days |
| 10 | 6,458 | ~2 months |
| 20 | 30,362 | ~9 months |
| 30 | 73,957 | ~1.7 years |
| 50 | 225,073 | ~5 years |

Early game fast (the first week decides whether a child returns), mid-game
steady, late game weighty but never stalling. Each level costs 3–5% more than
the last — perceptible as "getting harder" without becoming a wall.

### Mastery Index — honest, can fall

```
index = (mean(mastery) − 0.25 · variance) × 100
```

The variance penalty means 10 skills at 0.7 beats 5 at 1.0 and 5 at 0.4 — the
shape of a well-rounded mathematician rather than a specialist. Bands:
Starting out / Getting steady / Confident / Strong / Secure / Fluent.

### Chapter structure

```
Course → Chapter → Unit → Skill
```

- **Unlock:** mean prerequisite-chapter mastery ≥ **0.70**. Never XP.
- **Complete:** every skill in the chapter ≥ **0.85**.
- **Review chapters** unlock on **decay**, not progress — generated by the
  spaced-repetition model when previously-mastered skills slip below 0.70. This
  makes review a living part of the map instead of optional revision nobody
  opens.
- **Challenge chapters** require 0.88 to *enter*, are always optional, and never
  gate course completion. They exist so able children have somewhere to go that
  is not "more of the same, faster" — the ceiling problem that disengages strong
  learners.

---

## 8 · Achievement System

No "answer 100 questions". Six categories, all tied to learning states:

**Mastery** — *Bedrock* (all Class-1 foundations secure) · *Full Table* (a times
table at 0.9 with typed evidence) · *Chapter Secure*

**Overcoming** — *Turned It Around* (a skill from below 0.3 to above 0.75) ·
*Misconception Broken* (a named error absent for 20 attempts) · *Came Back*
(returned to a skill avoided 3+ weeks and mastered it)

**Consistency** — *Fortnight* / *Season* (14 / 90 qualifying days) ·
*Steady Hand* (8+ weeks at ≥4 days/week). Health-capped: consistency
achievements **cannot** be earned by volume, only by spread.

**Diversity** — *All-Rounder* (every category in a class above 0.7) ·
*No Weak Link* (no skill below 0.5 while ≥10 are above 0.8)

**Depth** — *Recall Not Recognition* (10 skills mastered on typed evidence) ·
*Long Memory* (a skill above 0.85 after 60 days without practice)

**Habits** — *Right-Sized* (20 sessions ending inside the healthy window) ·
*Reviewer* (30 due reviews completed on time)

---

## 9 · Anti-Exploit Systems

| # | Exploit | Countermeasure | Simulated result |
|---|---|---|---|
| E1 | Marathon binge | Session decay: 1.0 → 0.6 (>40 q) → 0.3 (>80) → 0.1 (>150) | — |
| E2 | Memorising one question | Repetition decay 0.5ⁿ on identical text | — |
| E3 | Artificial streaks | Day counts only with ≥5 genuine questions **and** ≥5 learning XP | — |
| E4 | Difficulty farming | Relative challenge + **2.0 bonus cap** | 60% XP / 300% effort |
| E5 | Avoiding weak skills | Comeback multiplier up to ×2.0 | — |
| E6 | Drilling one skill | Saturation: 1.0 → 0.5 (>12/day) → 0.15 (>20) | — |
| E7 | **Mastery oscillation** | **High-water-mark payment** | 14% XP / 600% effort |
| E8 | Instant tapping | Non-attempt suppression | **0% XP / 2000% effort** |
| E9 | Easy grinding | Δmastery core | 14% XP / 1000% effort |

**E7 deserves emphasis — it is the exploit unique to this design.** If XP pays
for mastery *gained*, a learner could let a skill decay (or deliberately fail),
then re-earn the same band forever. Countermeasure: XP pays on **high-water
mark**. Mastery regained below a level already paid for earns only the floor.
You are paid once for climbing to 0.85; climbing back after decay pays the
retention bonus instead — the honest value of re-consolidation, not new learning.

**Streak forgiveness (E3).** One missed day per week is free. No purchase, no
notification. This is a deliberate rejection of the industry-standard
"streak freeze as currency" pattern, which monetises anxiety in children. Hard
streaks convert intrinsic motivation into loss aversion, and a broken 200-day
streak is a documented churn event.

---

## 10 · Adaptive Reward Logic

**Skill avoidance detection.** A skill is *avoided* when it is weak (<0.70),
has ≥3 attempts, and has gone ≥7 days unpractised **while the learner has been
actively practising other things**. That last condition matters: a child who has
not practised at all is absent, not avoiding.

**Comeback multiplier** — the primary positive incentive:

```
comeback = min(2.0, 1 + weakness + timeAvoided)
```

An avoided weak skill accrues a growing, visible bonus until returning to it is
the most valuable thing on offer. Note this cannot itself be farmed: exploiting
it requires *genuinely learning the skill*, so the exploit is self-defeating.

**Forcing is the fallback, not the default.** The scheduler already performs
prerequisite descent and success-floor dilution. Redirection should be economic
first, algorithmic second, mandatory never.

---

## 11 · Economy Simulation

Run: `npx tsx progression/__sim__/economy.sim.ts`. Seven strategies, 30 days.

```
A honest learner (20/day)      XP=3496  Lv=7  MasteryIdx=64  Qs=  600  XP/Q=5.83
B easy grinder (200/day)       XP= 504  Lv=3  MasteryIdx=99  Qs= 6000  XP/Q=0.08
C speed-tapper (400/day)       XP=   0  Lv=1  MasteryIdx=13  Qs=12000  XP/Q=0.00
D difficulty farmer (60/day)   XP=2094  Lv=6  MasteryIdx=16  Qs= 1800  XP/Q=1.16
E oscillation farmer (120/day) XP= 473  Lv=3  MasteryIdx=43  Qs= 3600  XP/Q=0.13
F struggler (15/day, 45%)      XP=1212  Lv=4  MasteryIdx=26  Qs=  450  XP/Q=2.69
G consistent (8/day)           XP=2261  Lv=6  MasteryIdx=62  Qs=  240  XP/Q=9.42
```

| Strategy | XP vs honest | Effort vs honest | Verdict |
|---|---|---|---|
| B easy grinder | 14% | 1000% | **SAFE** |
| C speed-tapper | 0% | 2000% | **SAFE** |
| D difficulty farmer | 60% | 300% | **SAFE** |
| E oscillation farmer | 14% | 600% | **SAFE** |
| F struggler | 35% | 75% | fair (see below) |
| G consistent | 65% | 40% | **best XP/question** |

**Three findings the simulation produced that review had not:**

**D1 · The difficulty farmer initially beat the honest learner** — 117% of XP
for 300% effort, with a mastery index of 20 vs 65. Stacked multipliers were
outrunning the Δmastery core. Fixed by capping the bonus product at 2.0; now
60%.

**D2 · The level curve was grotesque.** `40·n^1.55` put level 10 at 146 days and
level 50 at 27 years. Re-solved by least-squares against milestone targets.
*Always calibrate a curve against a measured earn rate, never against intuition.*

**D3 · The best XP-per-question belongs to the light-touch consistent learner**
(9.42 vs 5.83). This was not designed in — it emerges from session decay and
saturation. It is the correct outcome: the system's most efficient strategy is
*8 focused questions a day, every day*, which is precisely the habit we want.

**On fairness to strugglers (F).** 35% of honest XP for 75% of the effort looks
harsh, but: they reach level 2 in **2.7 days** and level 3 in 8.8 — progression
is visible. And bonuses, not modelled in the core loop, close the gap: a
struggler earns **710 XP** of bonuses over 30 days versus 400 for a strong
learner, because breakthroughs only happen to children who were failing. Folding
those in moves them from 35% → **45%**.

This is the intended shape. A struggling child should not out-earn a thriving
one — that would be dishonest — but they must see clear, rewarded movement.

---

## 12 · Balancing Recommendations

1. **Tune `XP_PER_MASTERY_POINT` (600) first.** It sets the entire scale; every
   other parameter is relative to it.
2. **Never raise the bonus cap above 2.0** without re-running the simulation.
   It is the only thing standing between the design and multiplier stacking.
3. **Instrument before tuning.** Ship with per-question XP breakdowns logged
   locally, then compare the real distribution against the simulation.
4. **Watch the struggler ratio.** If it drops below ~30% including bonuses,
   raise `breakthrough` rather than lowering the honest learner's rate.
5. **Re-run the simulation in CI.** The exploit table should be a regression
   test, not a one-off.

---

## 13 · Risks & Edge Cases

| Risk | Assessment | Mitigation |
|---|---|---|
| **Mastery model errors become XP errors** | **Highest risk in the design.** XP is now only as trustworthy as `estimateMastery`. A bug there silently corrupts the economy | High-water marks are persisted and auditable; XP is recomputable from the attempt log |
| Ceiling for a fully-mastered learner | Real. Δmastery → 0 when everything is secure | Challenge chapters, decay-driven review, next course |
| Child perceives "cheating" as impossible-to-progress | Moderate | Floor payment ensures no session pays literally zero |
| Δmastery is noisy per question | Real; single answers move mastery by ~0.02–0.06 | Payout smooths over a session; bonuses provide the salient peaks |
| Parents reading Mastery Index as a grade | Moderate, and a real safeguarding concern | Band labels, never a bare percentage; never comparative |
| Simulated learner ≠ real child | **Certain.** Every number here is provisional | §12.3 — instrument, then re-tune against real data |
| Class 1–2 children and delayed gratification | 6-year-olds do not model 2-month goals | Early curve is steep on purpose; daily goals carry the short horizon |

**The honest caveat.** This economy has been simulated, not trialled. The
simulation validates *internal consistency and exploit-resistance* — that is a
real result, and it caught three defects. It says **nothing** about whether
children find it motivating. Only a trial with real learners can establish that,
and no projection here should be quoted as evidence of engagement or learning
gain.

---

## 14 · Implementation Roadmap

**Phase A · Ledger (1 wk).** Persist `paidHighWater` per skill; log XP events
with full breakdown. No user-visible change. Ship this first and let it collect
data while the rest is built.

**Phase B · Core economy (1 wk).** `computeXp` in the answer path; Player Level
and Mastery Index derived. Reference implementation already exists in
`progression/xp.ts`.

**Phase C · Anti-exploit (0.5 wk).** Session decay, saturation, repetition
decay, non-attempt suppression. All pure functions, already written.

**Phase D · Chapter graph (1.5 wk).** Author chapter/unit structure over the
existing 41-skill DAG. Mastery-gated unlocks. Largest content task.

**Phase E · Bonuses & achievements (1 wk).** Event detection against the attempt
log; all nine bonuses and six achievement categories.

**Phase F · Adaptive rewards (0.5 wk).** Avoidance detection, comeback
multiplier, review chapter generation.

**Phase G · Validation (ongoing).** Simulation in CI as a regression test;
instrument real earn rates; re-tune.

**Total ≈ 5.5 weeks.** Phases A–C are the minimum coherent economy and could
ship alone.

### Files

```
progression/xp.ts                    formula, weights, bonuses
progression/antiGrind.ts             E1–E7 countermeasures
progression/levels.ts                curves, chapter gating, mastery index
progression/__sim__/economy.sim.ts   adversarial simulation
```
