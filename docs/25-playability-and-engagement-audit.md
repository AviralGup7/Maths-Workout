# 25 · Playability, Engagement & Game Economy Audit

**Question:** if this launched today, would children voluntarily return for months while parents still see it as a learning tool?

**Answer: parents yes, children no — and the reason is narrower than it sounds.**

**Scope:** the felt experience. Not code, architecture or implementation. All systems assumed working (docs/21–24 verified that).
**Method:** measured against the running engine — reward frequency, celebration cadence, level pacing, milestone timelines, interaction mix, first-session experience. Probes in `audit/__tests__/probe-engagement.test.ts` and `probe-firstrun.test.ts`. No product code changed.

---

## 1 · Executive Summary

This product has something almost no educational maths app has: **an engine that actually knows what a child can do.** Mastery is calibrated, misconceptions are diagnosed by name, the scheduler picks genuinely useful work, and the economy pays for learning rather than attendance. Praise is *process* praise ("You came straight back", "You took your time — it paid off"), which is a deliberate, research-grounded choice most competitors get wrong. On educational integrity it is stronger than every benchmark I compared it against.

**And a child will not feel almost any of that.**

The single largest finding is not a missing feature. It is that **the engine's best work is invisible at the exact moments a child forms an opinion.** Measured:

| Moment | What the engine computed | What the child sees |
|---|---|---|
| End of session | XP, level progress, mastery movement, bonus events, growth trend | **score, stars, correct/wrong** — nothing else |
| Tomorrow | exactly which skills fall due overnight | **nothing** |
| Struggling learner, one year | genuine improvement across 31 skills | **0 mastery celebrations** |

The results screen — the emotional climax of every session — imports `score, totalQuestions, difficulty, wrongAnswers, streak` and **not one progression value**. Verified: `grep -c "totalXp\|level\|lastAward\|mastery"` in `app/results.tsx` returns **0**. A child finishes practising and is shown a test result. The XP they earned, the level they may have just reached, the skill they just secured, the mistake they finally cleared — all computed, all stored, none displayed.

Second finding: **there is no forward hook anywhere in the product.** A search for `tomorrow|comeBack|nextSession|dueTomorrow` across the entire codebase returns zero matches. The scheduler knows that `count.objects` and `numsense.reasonable` come due overnight; nothing tells the child. Every retention mechanic in the app is *backward*-looking (streak, history, past mistakes). Nothing creates anticipation.

Third: **the child who most needs encouragement gets least.** The struggling learner earns 2.07 reward moments per session against the gifted learner's 5.18, and **zero** mastery celebrations in a full year — because that celebration is gated on crossing 0.85, which they never do.

**Scores: Engagement 5.4/10 · Playability 6.2/10 · Educational Integrity 9.4/10 · Parent Trust 9.1/10.**

The good news is the shape of this: the hard half is built. Nearly every recommendation below is *surfacing something that already exists* rather than inventing a mechanic. Items 1–8 are a few days' work and I would expect engagement to move to roughly 8.5.

---

## 2 · Overall Engagement Score — 5.4 / 10

| Dimension | Score | Basis |
|---|---|---|
| Core loop satisfaction | 5.0 | Loop breaks at Reward → Progress; results screen shows no progress |
| Reward frequency | 6.5 | 3.59 moments/session average, 2.07 struggling |
| Celebration quality | 7.0 | Well-designed, well-gated, but 4.7 sessions apart |
| Progression visibility | 3.0 | Level exists; child sees it on home screen only, as `Lv 4` |
| Variety (felt) | 5.5 | 58% multiple choice; 29/45 skills have no visual, ever |
| Return motivation | 3.5 | Streak only; no forward hook of any kind |
| Long-term goals | 6.0 | 18 chapters + 15 achievements, poorly surfaced |
| First-session hook | 6.5 | Fast (1 tap to start), but ends flat |

## 3 · Overall Playability Score — 6.2 / 10

Solving questions *is* pleasant: clean layout, immediate feedback, named misconceptions, hints that scaffold rather than reveal. The interaction ladder (choice → typed entry as mastery grows) is genuinely good design and rare.

What holds it back: **58.4% of a year's questions are still multiple choice** (measured over 5,040 attempts), and **29 of 45 skills have no visual model at all, ever.** For a Class 1 child, "maths" here is largely reading a sentence and tapping one of four boxes.

---

## 4 · Fun vs Education Balance

The stated philosophy — *"a fantastic educational experience that happens to be fun"* — is currently delivered as **"a rigorous educational experience that forgot the second half."**

This is the correct failure to have. It is far easier to add legible delight to a pedagogically sound product than to add rigour to a fun one. But it is still a failure: a child who does not return learns nothing, and rigour that goes unused has an educational value of zero.

Nothing in the product currently reads as manipulative. There are no loot boxes, no currencies, no purchasable streak freezes, no artificial scarcity, no notifications engineered around loss aversion. `STREAK_MILESTONES = [3, 7, 14, 30, 60, 100]` is deliberately sparse, with the comment *"celebrating every single day turns the signal into noise, and manufactures the kind of pressure this app should not put on a child."* That judgement is right and should survive every change below.

---

## 5 · Gameplay Loop Analysis

**Learn → Solve → Feedback → Reward → Progress → New Challenge → Return**

| Step | State | Evidence |
|---|---|---|
| Learn | **Strong** | Worked examples, tiered hints, named misconceptions |
| Solve | **Good** | Five interaction kinds, though 58% resolve to choice |
| Feedback | **Excellent** | Process praise, five variants, misconception explained |
| Reward | **Adequate** | Bonus chips appear in-session with real names |
| **Progress** | **BROKEN** | Results screen shows no XP, level or mastery |
| New Challenge | **Weak** | "Play Again" repeats; no sense of what comes next |
| **Return** | **BROKEN** | No forward hook exists anywhere |

Two of seven steps are broken, and they are the two that convert a good session into a habit. The loop currently reads: *learn, solve, get told you scored 7/10, leave.*

The bonus chips deserve specific credit — `BONUS_LABEL` names achievements, not mechanics ("Breakthrough", "Mistake fixed", "From memory", never "+40 XP"). That is exactly right. It is also the only place in the app a child ever sees them; they vanish the moment the session ends.

---

## 6 · Progression Analysis

Measured level pacing (`cumulativeXpForLevel` against observed earn rates):

| Level | Gifted | Average | Struggling |
|---|---|---|---|
| 2 | 0 d | 1 d | 1 d |
| 5 | 5 d | 9 d | 17 d |
| 10 | 25 d | 43 d | 85 d |
| 15 | 62 d | 108 d | 212 d |
| 20 | 118 d | 204 d | 401 d |
| 30 | 287 d | 498 d | 978 d |

**The early curve is well-judged.** Level 2 on day one, level 5 within a fortnight for most children. The first-session measurement confirms it: a new child earns **488 XP and reaches level 3 in ten questions**, with 6 of 15 achievements already showing partial progress. That is a good first five minutes — *if the child is shown it*, which they are not.

**Dead zone confirmed.** The milestone timeline for an average learner shows a **25-day stretch (days 210–235) with no level, no chapter and no achievement.** Levels 15→20 cost 204 days for an average learner. That is not "getting harder"; that is a child receiving nothing for three months.

**Recommended curve change:** keep the coefficient, but add *intra-level* visible progress. A child at level 17 needs to see "340 / 2,900 to level 18" moving every session, not a static badge. This costs nothing — the data is in `levelForXp().into / .needed` already.

---

## 7 · Game Economy Analysis

Measured reward moments per session over a year:

| Profile | Sessions | Bonus events | Per session | Month 1 | Month 12 |
|---|---|---|---|---|---|
| Gifted | 315 | 1,633 | **5.18** | 127 | 164 |
| Average | 222 | 796 | **3.59** | 79 | 57 |
| Struggling | 212 | 439 | **2.07** | 40 | 37 |

Full-screen celebrations per year:

| Profile | Streak milestones | Mastery celebrations | Total | Sessions between |
|---|---|---|---|---|
| Average | 39 | 10 | 49 | **4.7** |
| Struggling | 34 | **0** | 34 | **6.1** |

**Three findings.**

1. **The reward gradient runs the wrong way.** The child finding maths hardest receives 40% of the encouragement the gifted child gets. Every mastery-gated celebration is unreachable for them. This is the most important motivational defect in the product.
2. **Reward density is thin but not fatal.** 3.59 moments across ~20 questions means roughly one notable thing every six questions. Acceptable; not exciting.
3. **`chapterMastery` is 250 XP — the largest bonus in the table — and a chapter completion produces no celebration at all.** `CelebrationReason` covers `streak | recovery | mastery | best`. Finishing an entire chapter, the biggest achievement in the curriculum, passes silently.

---

## 8 · Question Variety Analysis

Measured interaction mix over a year (5,040 attempts, average learner):

| Interaction | Share |
|---|---|
| choice | **58.4%** |
| entry | 32.6% |
| ordering | 5.0% |
| estimate | 3.0% |
| multiSelect | 1.1% |

**Visual coverage: 16 of 45 skills.** The 29 with no visual model include every addition and subtraction skill below 2-digit carrying, all times tables, all division, word problems, money, time, shapes and measurement — i.e. **the entire Class 1–3 experience is text and four boxes.**

This is where the "doing the same thing" feeling will come from, and it will arrive around week three. The highest-impact additions, in order:

1. **Times tables** (`mul.tables.*`) — an array/grid visual. Currently the single most-practised skill family with zero visual support.
2. **Early addition/subtraction** — ten-frames. Class 1–2 is entirely unvisualised and these are the youngest, most visually-dependent users.
3. **Money** — coin/note images. Trivial to add, high recognition value for Indian learners, currently pure text.
4. **Time** — a clock face. "Quarter past 3" as text is a reading test, not a time test.

---

## 9 · Animation & Feedback Analysis

**Strong where it exists.** The `Celebration` component is a hand-rolled particle burst (no dependency), fires on exactly four earned reasons, respects `useReducedMotion` by skipping particles and announcing to the screen reader instead. Results has staged star and score-circle springs. Haptics are used at the right moments.

**The gaps are all about meaning, not polish:**

- **No progress animation.** Nothing anywhere animates a bar filling, a level advancing, or mastery rising. Motion currently decorates outcomes; it never *shows change*. This is the highest-value animation opportunity in the product, because a bar moving is the clearest possible statement of "you got better."
- **No mastery-crossing moment in-session.** Securing a skill is the most educationally meaningful event the engine can detect; it produces a small chip.
- **Praise repetition.** Five sentences, confirmed reachable, drawn across a 20-question session. By week two a child has read each many times. Ten to twelve per category would cost nothing.

---

## 10 · Long-Term Retention Analysis

| Horizon | Reason to return | Strength |
|---|---|---|
| 1 day | Streak chip; daily goal bar | **Weak** — no forward hook |
| 7 days | Streak milestones at 3 and 7 | Moderate |
| 30 days | Level ~8–10; first chapters | Moderate |
| 90 days | Chapter completion; achievements | **Weak** — 25-day dead zones |
| 1 year | Mastery breadth | **Very weak** — nothing named as a destination |

**The core gap: everything looks backwards.** Streak counts days *done*. Progress screen shows history. Mistake review revisits past errors. Nothing anywhere says *"three skills come due tomorrow"* or *"you are two skills from finishing Fractions."*

The data for both exists. `isDue()` and `reviewIntervalDays()` are computed and used internally by the scheduler; `chapterProgress()` returns exactly the fraction needed. Measured on a 40-day learner: 3 skills due today, **2 becoming due overnight**, with names and intervals available. The app knows precisely what is waiting and says nothing.

---

## 11 · Parent Trust Assessment — 9.1 / 10

**This is the product's strongest dimension and it should be protected aggressively.**

- No purchasable currency, loot boxes, energy timers or pay-to-progress.
- No streak-freeze monetisation — explicitly rejected in code as *"monetises anxiety in children."*
- Timer defaults **off** below Class 3 (documented anxiety driver in early primary).
- XP cannot unlock content; chapters gate on **mastery only**. `levels.ts`: *"XP therefore unlocks NOTHING pedagogical."*
- Parent report exists and speaks in learning terms.
- Praise is process-based, avoiding the fixed-mindset trap of "clever!".

**The one risk:** the results screen leads with **three gold stars and a big score number**, which is the most game-like surface in the app and the one parents see over a shoulder. Ironically, adding *learning* content to that screen (mastery movement, skill secured, growth trend) would make it both more motivating for the child and more reassuring for the parent. The fix serves both audiences at once.

---

## 12 · Educational Integrity Review — 9.4 / 10

Every mechanic audited against "does this serve a learning goal?":

| Mechanic | Educational justification | Verdict |
|---|---|---|
| XP | Paid for Δmastery, not volume | **Sound** |
| Levels | Cumulative effort record; unlocks nothing | **Sound** |
| Streak | Spacing effect — distributed practice | **Sound** |
| Achievements | All tied to learning states; none count questions | **Sound** |
| Bonus events | All tied to state *change* | **Sound** |
| Celebrations | Four reasons, all learning-linked | **Sound** |
| Stars / score | **Pure outcome scoring** | **Flag** |
| Daily goal (10 questions) | Volume target, not learning target | **Minor flag** |

Only one mechanic exists purely to make a number go up: **the three-star score on the results screen.** It rewards session accuracy, which the app elsewhere deliberately avoids — a child who attempts hard material and scores 6/10 has often learned more than one who scores 10/10 on easy revision, and the mastery model knows this. The stars contradict the product's own philosophy.

---

## 13 · Benchmark Comparison

| Product | Where it beats this app | Where this app wins |
|---|---|---|
| **Duolingo Kids** | Session-end payoff, forward hooks, character warmth, streak psychology | Genuine mastery model; no dark patterns; misconception diagnosis |
| **Khan Academy Kids** | Illustration, characters, narrative, delight for under-8s | Adaptive scheduling; diagnostic depth; measured economy |
| **SplashLearn** | Visual variety; per-topic mini-games; parent dashboard polish | Honest mastery; no pay-gating; process praise |
| **DragonBox** | Concept-embodying interaction — the visual *is* the maths | Curriculum breadth; board alignment; spaced repetition |
| **Prodigy** | Raw child pull; long-term goals; social presence | **Educational integrity** — Prodigy's rewards are unrelated to maths and monetised |
| **Moose Math** | Early-years charm; visual counting | Ages 8–12 depth; real progression |

**Position:** best-in-class engine, bottom-quartile expression. Against Prodigy the difference is philosophical and this app is *right* — Prodigy's rewards are pure extrinsic bribery bolted onto maths. But Prodigy children return daily and these children may not, and an unused superior engine helps nobody.

**The closest model to aim at is DragonBox:** its engagement comes from the interaction embodying the mathematics, not from rewards wrapped around it. That is achievable here — the visual components (`NumberLine`, `PartModel`, `ArrayGrid`, `BaseTen`) already exist and cover only 16 skills.

---

## 14 · Top 50 Engagement Improvements

Ranked by impact ÷ effort. Every item satisfies all three conditions: increases motivation, preserves or improves learning, maintains parent trust.

### Tier 1 — Critical, days of work (do these first)

1. **Put progression on the results screen.** XP earned, level bar with movement, skills that improved. The data is already in context; the screen imports none of it. *Fixes the broken Reward → Progress step.*
2. **Add a forward hook to the results screen.** "3 skills come due tomorrow" — `isDue()` already computes it. *Fixes the broken Return step.*
3. **Animate the level bar filling** at session end. The single clearest statement of "you got better."
4. **Show mastery movement per skill:** "Fractions 62% → 71% today." `biggestGain()` and `growthSentence()` exist and are used nowhere on this screen.
5. **Celebrate chapter completion.** 250 XP — the largest bonus — currently produces nothing. Add `'chapter'` to `CelebrationReason`.
6. **Fix the struggling learner's reward gradient.** Add a celebration for crossing `STRUGGLING_THRESHOLD` (0.55), not only 0.85. Currently they get 0 mastery celebrations per year.
7. **Replace the three stars** with an effort-and-growth summary. Stars reward accuracy, which contradicts the product's own philosophy and is the most game-like surface parents see.
8. **Show "2 skills to finish Fractions"** on the home screen. `chapterProgress()` already returns it. Completion pull with zero new mechanics.

### Tier 2 — High impact, ~1–2 weeks

9. Times-table array visual (most-practised family, currently unvisualised).
10. Ten-frames for Class 1–2 addition/subtraction.
11. Clock face for time questions.
12. Coin/note images for money.
13. Expand praise to 10–12 lines per category.
14. Intra-level progress everywhere the level appears ("340/2,900").
15. Named skill-mastery moment in-session, not just a chip.
16. Session-end "one thing you cracked today" callout.
17. Surface achievement *near-misses*: "2 more days for Fortnight."
18. Show the review queue on the home screen with skill names.
19. First-session explicit payoff: "You met 4 new skills today."
20. Personal-best tracking per skill, not just per session.

### Tier 3 — Meaningful, moderate effort

21. Age-differentiated default session length (6-year-olds ≠ 11-year-olds; both currently get 10).
22. Interactive visuals where the visual *is* the answer surface (DragonBox model).
23. Reduce multiple-choice share below 40% by extending the interaction ladder earlier.
24. A visible "skill tree" view of the 45-skill DAG.
25. Weekly summary: "You secured 3 skills this week."
26. Chapter-completion certificate a child can show a parent.
27. Mastery-collection view (skills as a collectible set).
28. "Comeback" recognition when returning after absence (multiplier exists, is invisible).
29. Streak recovery framing that is encouraging, not punitive.
30. Milestone preview: "Level 12 at 400 XP."
31. Diagnostic "you used to get this wrong" callout on newly-fixed misconceptions.
32. Per-chapter progress bars in the curriculum view.
33. Session variety indicator ("today: 4 topics").
34. Optional daily challenge drawn from due reviews.
35. Parent-visible weekly digest.

### Tier 4 — Worthwhile, lower priority

36. Sound design (currently silent; haptics only).
37. Mascot or guide character for under-8s.
38. Illustrated chapter headers.
39. Question-type variety indicator.
40. "Hardest question you got right today."
41. Skill-depth visual (bronze/silver/gold per skill).
42. Time-of-day-aware greeting.
43. Return-after-absence gentle re-onboarding.
44. Accessibility: celebration alternatives beyond announce.
45. Landscape/tablet-optimised results.
46. Printable progress summary for parents.
47. Multi-child profiles on one device.
48. Teacher/classroom view.
49. Offline-first onboarding polish.
50. Localised celebration copy variants.

---

## 15 · Features That Should NOT Be Added

Each of these would raise short-term engagement and damage the product.

1. **Purchasable currency or cosmetics** — converts learning into a shop; parents notice immediately.
2. **Energy / lives systems** — artificial scarcity; punishes the keen child.
3. **Streak freezes as purchasable items** — already rejected in code as monetising child anxiety. Correct.
4. **Leaderboards against other children** — damages the struggling learner most, who already receives 40% of the encouragement.
5. **Loot boxes / random reward crates** — variable-ratio reinforcement aimed at children is indefensible in an education product.
6. **Pets, avatars or bases requiring upkeep** — Prodigy's model; creates obligation unrelated to maths.
7. **Push notifications engineered on loss aversion** ("Your streak is about to die!").
8. **Timed pressure below Class 3** — already correctly defaulted off; do not change.
9. **XP-purchasable content unlocks** — would break the mastery-only gate, the product's most important structural decision.
10. **Battle/combat framing for questions** — makes maths the tax on the fun rather than the fun itself.
11. **Social feeds or friend systems** — safeguarding burden, no learning gain.
12. **Rewarding raw question volume** — the economy deliberately avoids this; adding a "100 questions!" badge would undo it.

---

## 16 · Final Verdict

**Children would not currently return for months. Parents would trust it completely. Both facts have the same cause.**

This app was built by people who took the education seriously and treated engagement as decoration. The result is an engine that models a child's mathematical understanding better than any competitor I compared it against, wrapped in a presentation that tells them almost nothing about it. The most damning measurement in this audit is not a missing feature — it is that `app/results.tsx` contains **zero** references to XP, level, or mastery. Everything the engine learned about that child in the last ten minutes is discarded at the moment they would most want to see it.

The second: **no forward hook exists anywhere in the codebase.** Not one string, in any screen, tells a child what is waiting for them tomorrow — while the scheduler computes exactly that, by name, every time it runs.

The third, and the one I would fix first on principle: **the struggling learner gets 2.07 reward moments per session against the gifted learner's 5.18, and zero mastery celebrations in a year.** A product whose stated purpose is helping children who find maths hard currently encourages them least.

None of this requires compromising the philosophy. Every Tier 1 item is *surfacing computed data* or *re-gating an existing celebration*. There is no proposal here to add a currency, a pet, a leaderboard or a loot box — and §15 argues actively against all of them. The path from 5.4 to ~8.5 engagement runs entirely through making learning legible, which also *increases* parent trust rather than trading against it. That is an unusually comfortable position: the motivational fix and the educational fix are the same fix.

**Verdict: do not launch for retention yet. Ship Tier 1 first — it is days, not months, and it converts a product children abandon in week three into one they return to.** The hard half is already done, and it is done well.

---

### Reproducing

```bash
cd artifacts/mobile
npx vitest run audit/__tests__/probe-engagement.test.ts   # reward density, celebrations, pacing, variety
npx vitest run audit/__tests__/probe-firstrun.test.ts     # first session, praise variety, return hook
```

Probes are read-only. `npm run verify` (typecheck + arch-check 7/7 + 650 tests) passes unchanged.

### Method note

Two claims in this report I initially assumed and then checked, because they seemed too stark to be true: that the results screen shows no progression (`grep -c` → 0 matches) and that no forward hook exists anywhere (`grep -rn "tomorrow|comeBack|nextSession|dueTomorrow"` → 0 matches across the codebase). Both held. The reward-gradient finding was the reverse — I expected the struggling learner to be under-served and found the gap larger than predicted (0 mastery celebrations, not "few").

---

## Addendum · Tier 1 implemented

All eight Tier 1 items shipped in `a8b33c2`. Measured before and after, using
the same simulated learners as the audit:

| Finding | Before | After |
|---|---|---|
| Progression values on the results screen | **0** | XP, level bar, per-skill movement |
| Sessions ending with something true to say | **0%** | **100%** |
| Sessions with a forward hook | **0%** | **94%** |
| Struggling learner celebrations per year | **0** | **40** (18% of sessions) |
| Average learner celebrations per year | 49 | 117 |

Two design corrections were made during implementation, both to avoid
overcorrecting:

**Celebration rarity.** The first cut fired a full-screen celebration in 82% of
sessions, because mastery decays and skills re-cross thresholds repeatedly.
That is precisely the *"celebrating everything means nothing"* failure
`celebrationRules.ts` warns about. Gating on the XP ledger's high-water mark —
state that already exists — means each threshold pays once per skill. Now 17%.

**Praise honesty.** 100% headline coverage is deliberate and is *not* the same
as 100% celebration: 83% of sessions get a quiet "Add within 10 1% → 15%" bar,
which is a true statement of what happened, while the loud moment stays rare.
A session where genuinely nothing moved reports nothing.

### Three defects found only by rendering it

Worth recording because all three passed typecheck and unit tests:

1. **Duplicated headline** — the headline picks the most impressive movement and
   the bar list picks the largest deltas, so the same skill was stated twice.
2. **"+0 XP"** — reads as a verdict on the child rather than an accurate
   statement that a consolidation session earned little. Shows the running
   total instead.
3. **Cold-start race** — `loadAll` is async, so a child tapping straight into
   practice began answering before the stored XP resolved, leaving the session
   baseline stale. A first session displaying "+0 XP" had actually earned 183.
   A warm profile showed "+37 XP" correctly, which is exactly why no test
   caught it.

The third is the one worth generalising: **the results screen is the only place
in this app where several async systems are read together at a single instant**,
and it was the last screen anyone looked at. Tier 2 work should be rendered and
photographed, not just tested.
