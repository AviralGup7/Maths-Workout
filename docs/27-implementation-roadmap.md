# 27 · Implementation Roadmap

**The single working backlog.** Everything outstanding across docs/01–26, deduplicated, sequenced, and ordered so each item is workable the moment the one above it lands.

Supersedes `18-outstanding-work.md` (all 22 items complete). Tick items here as they land; do not maintain a second list anywhere else.

```
Progress    25 of 93 complete · Phase 1 complete · Phase 2 §2.1 done
Baseline    a81e9e5
Verify      cd artifacts/mobile && npm run verify     # typecheck + arch-check 7/7 + 675 tests
UI check    npm run ui:smoke                          # 23 browser assertions
Current     55 skills · 28 worked-example solvers · 45 hinted · 40 misconceptions
            18 chapters · 15 achievements · 6 interaction kinds
            error analysis 8.43% of planned questions (was 0.00% adaptive)
```

**Sequencing principle:** ordered by *learning impact ÷ effort*, then by dependency. Where an audit item is blocked by another, the blocker sits above it. Sections are in execution order — work top to bottom.

**Scoring already achieved (do not regress):**

| Audit | Score | Status |
|---|---|---|
| docs/21 System balance | 10/10 (24 properties) | ✅ closed |
| docs/23 Data integrity | 9.4/10 | ✅ closed |
| docs/25 Engagement | 5.4 → Tier 1 shipped | 🟡 Tiers 2–4 open |
| docs/26 Educational content | 6.4/10 | 🔴 largely open |

---

## Phase 1 · Educational Foundations
*The four numbers from docs/26 that decide whether this is a teaching product. Highest impact in the entire backlog.*

### 1.1 Placement & entry

- [x] **P1-01 · Adaptive placement probe** — ~20 questions, binary search over the prerequisite DAG, run once on first launch. *Fixes: able Class 6 learner spends 53% of two months on Class 1–2 material and reaches algebra on day 43.* (docs/26 A1)
- [x] **P1-02 · Re-placement after long absence** — re-probe rather than assume decay is accurate after 60+ days away. (docs/26 A1, docs/21 long-breaks profile)
- [x] **P1-03 · Placement result explained to the parent** — "we started Aarav at 2-digit carrying because…". Builds trust in the adaptive claim. (docs/26 §8)

### 1.2 Teaching the 12 unsupported skills
*`shapes.basic`, `time.basic`, `money.basic`, `count.objects`, `count.skip`, `numsense.reasonable`, `symmetry.basic`, `measurement.basic`, `ratio.basic`, `data.basic`, `algebra.basic`, `mul.large` — all four Class 1 topics among them.*

- [x] **P1-04 · Hints for the 4 Class 1 skills** (shapes, time, money, counting) — youngest learners, currently zero support
- [x] **P1-05 · Hints for the remaining 8 unsupported skills**
- [x] **P1-06 · Worked-example solver: fractions** (`frac.ofAmount`, `frac.equivalence`, `frac.addSameDenom`)
- [x] **P1-07 · Worked-example solver: decimals** (`dec.tenths`, `dec.hundredths`)
- [x] **P1-08 · Worked-example solver: percentages** (`percent.basic`)
- [x] **P1-09 · Worked-example solver: ratio** (`ratio.basic`)
- [x] **P1-10 · Worked-example solver: geometry** (area / perimeter / angles)
- [x] **P1-11 · Worked-example solver: algebra** (`algebra.basic`)
- [x] **P1-12 · Coverage guard in CI** — fail the build when a skill has no worked example, hint *or* visual. Prevents silent regression to 12 orphans.

### 1.3 Self-explanation & reasoning
*0 of 126,000 sampled questions ask a child to explain anything.*

- [x] **P1-13 · Self-explanation prompt after errors** — "what do you think went wrong?" with selectable reasons, *before* revealing the diagnosis. Set-valued, so gradeable offline. (docs/26 A2 — Chi et al.)
- [x] **P1-14 · Method-comparison items** — "Priya did it this way, Rohan this way — which is quicker?" (docs/26 A12 — Rittle-Johnson & Star)
- [x] **P1-15 · Reasoning-selection items** — pick the justification, not the answer
- [x] **P1-16 · Raise error-analysis share from 1.1% → ~8%** (docs/26 B24)

### 1.4 Open-ended tasks
*0 of 126,000 questions have more than one valid answer.*

- [x] **P1-17 · Set-valued grading path** — accept any member of a valid answer set. `multiSelect` already models half of this. **Blocks P1-18/19/20.**
- [x] **P1-18 · Open-ended generators** — "find two numbers that add to 50", "a fraction between 1/2 and 3/4" (docs/26 A3)
- [x] **P1-19 · Open Middle problems** — fixed start and end, multiple routes (docs/26 A4)
- [x] **P1-20 · Reverse problems** — "the answer is 24, what was the question?" (docs/26 D97)

---

## Phase 2 · Curriculum Structure
*Concepts sharing a skill node cannot be diagnosed separately — this quietly disables the app's best feature.*

### 2.1 Split over-broad skills

- [x] **P2-01 · Split `geometry.basic`** → area / perimeter / angles, taught by contrast (docs/26 A10 — variation theory)
- [x] **P2-02 · Split `measurement.basic`** → length / mass / capacity *(conversion dropped: measured, all 12 generator forms ARE conversions, so the node would have shipped empty)*
- [x] **P2-03 · Split `data.basic`** → mean / median / mode / range
- [x] **P2-04 · Migration: map existing attempts** onto split skills without losing history. **Depends on P2-01/02/03.**

### 2.2 Missing high-value concepts

- [ ] **P2-05 · Number bonds / part-whole** as a first-class family (docs/26 A7 — Singapore spine)
- [ ] **P2-06 · Equality as balance** — `8 + 4 = □ + 5` (docs/26 A8 — McNeil)
- [ ] **P2-07 · Fractions on a number line** (docs/26 A11 — NAEP's strongest predictor)
- [ ] **P2-08 · Comparing fractions** — whole-number bias
- [ ] **P2-09 · Fraction subtraction, unlike denominators, mixed numbers**
- [ ] **P2-10 · Multiplicative comparison** — "3 times as many"
- [ ] **P2-11 · Inverse relationships** taught as structure
- [ ] **P2-12 · Elapsed time**
- [ ] **P2-13 · Negative-number arithmetic** (currently recognition only)
- [ ] **P2-14 · Rounding as a decision**
- [ ] **P2-15 · Probability and chance**
- [ ] **P2-16 · 3D shapes, nets, volume** (spatial reasoning predicts STEM attainment)
- [x] **P2-17 · Misconceptions for every new skill** — 55/55 held after the splits. *(Re-open if §2.2 adds skills.)*
- [ ] **P2-18 · Curriculum review by a practising Indian teacher** — required before any "CBSE-aligned" marketing claim

---

## Phase 3 · Representation & Interaction
*16/45 skills have a visual; the concrete stage of CRA is absent entirely.*

- [ ] **P3-01 · Ten-frames** for Class 1–2 addition/subtraction (docs/25 T2-10, docs/26 B30)
- [ ] **P3-02 · Array/grid visual for all times tables** — most-practised family, currently unvisualised (docs/25 T2-9)
- [ ] **P3-03 · Clock face** for time (docs/25 T2-11)
- [ ] **P3-04 · Coin/note images** for money (docs/25 T2-12)
- [ ] **P3-05 · Bar-model / tape diagram** for word problems (Singapore)
- [ ] **P3-06 · Interactive manipulatives** — regroupable base-ten, draggable fraction bars, where the manipulation *is* the answer (docs/26 A9 — DreamBox's differentiator). **Depends on P1-17.**
- [ ] **P3-07 · Multi-representation items** — same quantity as fraction, decimal, percentage, number-line point
- [ ] **P3-08 · Reduce multiple-choice share below 40%** by extending the interaction ladder earlier (docs/25 T3-23)
- [ ] **P3-09 · Non-examples** — "which is NOT a rectangle, and why?"
- [ ] **P3-10 · Systematic surface-feature variation** while holding structure constant (variation theory)

---

## Phase 4 · Engagement (docs/25 Tiers 2–4)
*Tier 1 shipped in `a8b33c2`. These are the remainder.*

### 4.1 High impact

- [ ] **P4-01 · Expand praise to 10–12 lines per category** (currently 5 total)
- [ ] **P4-02 · Intra-level progress everywhere the level appears** — "340 / 2,900"
- [ ] **P4-03 · Named skill-mastery moment in-session**, not just a chip
- [ ] **P4-04 · Achievement near-misses** — "2 more days for Fortnight"
- [ ] **P4-05 · Review queue on the home screen** with skill names
- [ ] **P4-06 · First-session explicit payoff** — "you met 4 new skills today"
- [ ] **P4-07 · Per-skill personal bests**
- [ ] **P4-08 · Age-differentiated default session length** — a 6-year-old and an 11-year-old both get 10 questions today

### 4.2 Long-term motivation

- [ ] **P4-09 · Visible skill-tree view** of the DAG
- [ ] **P4-10 · Weekly summary** — "you secured 3 skills this week"
- [ ] **P4-11 · Chapter-completion certificate** a child can show a parent
- [ ] **P4-12 · Mastery-collection view**
- [ ] **P4-13 · Comeback recognition** — the multiplier exists and is invisible
- [ ] **P4-14 · Encouraging streak-recovery framing**
- [ ] **P4-15 · Milestone preview** — "Level 12 at 400 XP"
- [ ] **P4-16 · "You used to get this wrong" callout** on cleared misconceptions
- [ ] **P4-17 · Per-chapter progress bars**
- [ ] **P4-18 · Session variety indicator** — "today: 4 topics"
- [ ] **P4-19 · Optional daily challenge** drawn from due reviews
- [ ] **P4-20 · Hardest question you got right today**
- [ ] **P4-21 · Skill-depth visual** (bronze/silver/gold)

### 4.3 Polish

- [ ] **P4-22 · Time-of-day greeting**
- [ ] **P4-23 · Return-after-absence re-onboarding**
- [ ] **P4-24 · Celebration alternatives beyond screen-reader announce**
- [ ] **P4-25 · Landscape / tablet-optimised results**
- [ ] **P4-26 · Localised celebration copy variants**
- [ ] **P4-27 · Offline-first onboarding polish**

---

## Phase 5 · Parent & Teacher Surfaces

- [ ] **P5-01 · Parent-visible weekly digest**
- [ ] **P5-02 · Printable progress summary**
- [ ] **P5-03 · Parent conversation starters** tied to current skills
- [ ] **P5-04 · Teacher-facing misconception report**
- [ ] **P5-05 · Multi-child profiles on one device**
- [ ] **P5-06 · Teacher / classroom view**

---

## Phase 6 · Platform & Durability

- [ ] **P6-01 · Verify sync end-to-end against the real `/api/progress`** — docs/24 F3 is fixed client-side, but `server/serve.js` is static-only and there is no endpoint in this repo. **Restore is unproven until this is done.** (docs/24 §7)
- [ ] **P6-02 · Decide the content architecture** — `QuestionTemplate` schema + interpreter vs. keeping ~3,045 LOC of generator code. Blocks non-programmer authoring and AI-assisted content. Strategic; should be a product decision. (docs/21)
- [ ] **P6-03 · Extract a `statistics/` domain** — aggregations currently spread across `attempts.ts`, `feedback.ts`, `parentReport.ts` and inline in screens
- [ ] **P6-04 · Decompose `game.tsx`** — 859 lines, no tests
- [ ] **P6-05 · Decompose `GameContext.tsx`** — 1,179 lines
- [ ] **P6-06 · Sound design** — needs authored assets, mute control, silent-switch handling. Previously deferred as "system beeps are worse than silence"; revisit only with real assets.
- [ ] **P6-07 · Illustration / mascot set** — needs a designer, not a generator (docs/25 T4-37/38)

---

## Phase 7 · Validation
*Nothing above is proven to work until this happens. These are the only items that can move the "no learning-gain evidence" verdict.*

- [ ] **P7-01 · Usability test with 5–8 children aged 6–12** on the practice screen (docs/17, open since)
- [ ] **P7-02 · Render-and-photograph every screen** before shipping — docs/25 found three defects that passed typecheck and 675 unit tests and were only visible in a browser
- [ ] **P7-03 · Small learning-gain study** — pre/post with a control condition. Every projection in docs/13–16 remains a design estimate.
- [ ] **P7-04 · Validate mastery against an external measure** — does the estimate predict school assessment?
- [ ] **P7-05 · Parent trust interviews** — is it perceived as educational rather than a game?

---

## Explicitly NOT to be built

Recorded so they are not reconsidered. Sources: docs/18, docs/25 §15.

**Rejected on child-welfare / integrity grounds:**
- [x] ~~Purchasable currency, cosmetics, gems, coins~~
- [x] ~~Energy / lives / artificial scarcity~~
- [x] ~~Purchasable streak freezes~~ — monetises child anxiety
- [x] ~~Loot boxes / random reward crates~~ — variable-ratio reinforcement aimed at children
- [x] ~~Leaderboards against other children~~ — harms the struggling learner most
- [x] ~~Push notifications built on loss aversion~~
- [x] ~~Pets / avatars / bases requiring upkeep~~
- [x] ~~Social feeds or friend systems~~ — safeguarding burden, no learning gain
- [x] ~~Battle / combat framing~~ — makes maths the tax on the fun

**Rejected on pedagogical grounds:**
- [x] ~~XP-purchasable content unlocks~~ — would break the mastery-only gate
- [x] ~~Rewarding raw question volume~~ — the economy deliberately avoids this
- [x] ~~Timed pressure below Class 3~~ — documented anxiety driver; correctly defaulted off
- [x] ~~Ruler-and-compass constructions~~ — teaches phone skills, not geometry
- [x] ~~Free-text explanation~~ — cannot be graded offline, deterministically, or equally across languages. **Note:** P1-13 delivers the self-explanation benefit via *selectable* reasons, which is gradeable.

---

## Sequencing summary

| Phase | Items | Why here |
|---|---|---|
| 1 · Educational foundations | 20 | The four measurements that decide whether this teaches |
| 2 · Curriculum structure | 18 | Splits must precede content authored against them |
| 3 · Representation | 10 | Needs P1-17's set-valued grading for interactive work |
| 4 · Engagement | 27 | Valuable, but pointless if the teaching is thin |
| 5 · Parent & teacher | 6 | Depends on richer data from Phases 1–2 |
| 6 · Platform | 7 | P6-01 is urgent; the rest are strategic |
| 7 · Validation | 5 | Cannot be faked or deferred indefinitely |
| **Total open** | **93** | |

### Do these first

If only five things happen, these five:

1. **P1-01** placement probe — recovers two months of a capable learner's time
2. **P1-17** set-valued grading — unblocks open-ended tasks *and* interactive manipulatives
3. **P1-13** self-explanation prompts — largest documented effect size currently absent
4. **P1-04/05** hints for the 12 orphaned skills — Class 1 first
5. **P6-01** verify sync end-to-end — restore is currently unproven

### Standing rules

- **Every change ships with a guard that fails against its own regression.** Three guards in docs/24 and two in docs/22 initially passed against broken implementations and had to be rewritten. A guard that cannot fail is documentation.
- **Render and photograph UI work.** docs/25 found three defects invisible to typecheck and 675 tests.
- **Do not regress the closed audits.** docs/21 at 24/24 and docs/23 at 9.4/10 are held by CI; check `npm run verify` and `npm run ui:smoke` before every commit.
- **Do not add curriculum breadth before instructional depth** (docs/26's central recommendation). Phase 2 exists to *separate* concepts that already exist, not to add topics.
