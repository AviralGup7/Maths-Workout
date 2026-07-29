# Maths Workout — Engineering Documentation

> Documentation for [`AviralGup7/Maths-Workout`](https://github.com/AviralGup7/Maths-Workout),
> an Expo/React Native mathematics practice app for Indian primary school
> children, Classes 1–6, in English and Hindi.
>
> **Every claim in these documents was verified by executing the code**, not by
> reading it. Where a bug is asserted, the reproduction command and its real
> output are included. Where a UI claim is made, the screen was rendered in a
> browser and photographed.

---

## Start here

**[29 · Consolidated Re-Audit](./29-consolidated-re-audit.md) is the current
picture of the product**, re-measured at `d9054dc`. It supersedes the scoring in
docs/13, 21, 25, 26 and 28, and explains why the docs/21 scorecard now reports
20/24 while the product measurably improved.

**[27 · Implementation Roadmap](./27-implementation-roadmap.md) is the single
live backlog.** 124 items, 78 done. Everything outstanding across every audit
lives there, deduplicated and sequenced. Do not maintain a second list.

---

## Current state

```bash
pnpm install --no-frozen-lockfile
cd artifacts/mobile

npm run test:fast     # 811 tests, ~42s — the inner loop
npm run test:audit    # the long simulations, ~13 min
npm run arch          # 126 modules, 7 architecture checks
npm run ui:smoke      # 23 browser assertions
npm run ui:hindi      # 7 Hindi render assertions
```

CI runs all of it on every push — see `.github/workflows/ci.yml`. Three
parallel jobs: a fast gate, the audit simulations, and browser renders with
screenshots uploaded as an artifact.

**Measured, not asserted:**

| | |
|---|---|
| Skills · chapters · achievements | 63 · 19 · 15 |
| Misconceptions named | 47, covering every skill |
| Interaction kinds | 7 (choice, entry, multiSelect, ordering, estimate, open, manipulative) |
| Themes | light, dark, high contrast (AAA) |
| Accessibility | 0 undersized tap targets, 0 sub-13px strings, 0 WCAG AA text failures |
| Hindi | 0 English words in the question stream, 0 Devanagari numerals |
| Question mix | 38.5% multiple choice (was 99.1%), 42.1% typed entry |
| Instructional support | 28/63 skills carry a worked example, 23/63 a visual |
| Word problems | NMI(noun; structure) = 0.0028 — the surface no longer predicts the operation |

---

## How to read these documents

They are a working record, written in sequence. Later documents supersede
earlier ones where they disagree, and each audit states its own scope and
method at the top.

Two conventions worth knowing:

- **Audits do not change code.** An audit measures and reports; a separate
  remediation document records what was then fixed. That separation is why the
  scores are trustworthy — 21 and 23 were both closed by 22 and 24.
- **Rejections are recorded, not deleted.** Where something was deliberately
  not built, the reason sits next to it so it is not silently reopened later.
- **A guard that flags correct behaviour is worse than no guard.** docs/29 §1
  is the worked example: a scorecard reporting decay while total learning rose
  27%. When a number disagrees with a number, prefer the one whose measurement
  you can re-run.

---

## Document index

### The live backlog

| # | Document | What it covers |
|---|---|---|
| **27** | [**Implementation Roadmap**](./27-implementation-roadmap.md) | **The single working backlog — 120 items, 70 done, sequenced by impact ÷ effort** |

### Audits (measured, scored, closed or open)

| # | Document | Score | Status |
|---|---|---|---|
| 13 | [Learning Effectiveness](./13-learning-effectiveness-audit.md) | 6.4 → **8.1**/10 | 📘 historical — re-measured in 29 |
| 19 | [Architecture v2](./19-architecture-audit-v2.md) | — | Remediated |
| 20 | [Architecture v2, second pass](./20-architecture-audit-v2-second-pass.md) | — | Remediated |
| 21 | [System Balancing & Simulation](./21-system-balancing-and-simulation-audit.md) | 10/10 → **8.3**/10 reported | ⚠️ live in CI — 2 of 4 failures are measurement artefacts, see 29 §1 |
| 23 | [Data Integrity & State](./23-data-integrity-and-state-audit.md) | 9.4/10 (unchanged) | ✅ closed, held by CI, re-confirmed in 29 |
| 25 | [Playability & Engagement](./25-playability-and-engagement-audit.md) | 5.4 → **7.6**/10 | 📘 historical — re-measured in 29 |
| 26 | [Learning Content & Educational Knowledge](./26-learning-content-and-educational-knowledge-audit.md) | 6.4 → **8.0**/10 | 📘 historical — Phases 1 and 3 complete |
| 28 | [UI/UX & Child Experience](./28-ui-ux-child-experience-audit.md) | Child appeal 3.2 → **6.1** | 🟡 live — Tier 4 open |
| **29** | **[Consolidated Re-Audit](./29-consolidated-re-audit.md)** | **the current picture** | ⭐ **read this first** |

### Remediation records

| # | Document | Closes |
|---|---|---|
| 22 | [Balancing Remediation](./22-balancing-remediation.md) | docs/21 |
| 24 | [Data Integrity Remediation](./24-data-integrity-remediation.md) | docs/23 |

### Design & research

| # | Document | What it covers |
|---|---|---|
| 10 | [Question Engine Evolution](./10-question-engine-evolution.md) | Interaction taxonomy — why answering is not always tapping a tile |
| 11 | [Curriculum Research](./11-curriculum-research.md) | CBSE / ICSE / state syllabus sources behind the board model |
| 12 | [Performance & Delight](./12-performance-and-delight.md) | Accessibility, reduced motion, perceived speed |
| 14 | [Educational Improvement Roadmap](./14-educational-improvement-roadmap.md) | Solution design for the docs/13 findings |
| 15 | [Phase 1 Implementation](./15-phase-1-implementation.md) | What was built from docs/14, with measured results |
| 16 | [Progression System Design](./16-progression-system-design.md) | XP economy, levels, achievements, anti-exploit |
| 17 | [UI/UX Redesign](./17-ui-ux-redesign.md) | The design token system and the accessibility audit behind it |

### Historical

| # | Document | Note |
|---|---|---|
| 01 | [Overview](./01-overview.md) | Written against `24c6330`. Kept as the record of the starting point. |
| 02 | [Architecture](./02-architecture.md) | Superseded by docs/19–20; kept for the original module graph. |
| 04 | [Critical Issues](./04-critical-issues.md) | **All fixed.** Kept because several code comments cite its findings by number (C5, C11). |

---

## Standing rules

These are enforced by CI and by review, and they exist because each one was
learned the hard way:

1. **Every change ships a guard verified to fail against its own regression.**
   Break it deliberately, watch it fail, restore it. Several guards initially
   passed against broken implementations.
2. **Render and photograph UI work.** Typecheck and 811 unit tests could not see
   a ten-frame that never rendered, a frame drawn twice, or a parent prompt that
   interpolated a paragraph where a name belonged.
3. **A guard that flags correct behaviour is worse than no guard.** It trains
   people to re-run CI instead of reading it.
4. **Do not regress the closed audits** — docs/21 and docs/23.
5. **Do not add curriculum breadth before instructional depth** (docs/26).
6. **Semi-Hindi policy.** Translate what is being learned; keep what is being
   navigated recognisable in both scripts. Numerals stay Western Arabic, units
   and acronyms stay Latin, navigation is bilingual.
