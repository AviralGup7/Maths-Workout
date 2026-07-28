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

**[27 · Implementation Roadmap](./27-implementation-roadmap.md) is the single
live backlog.** 120 items, 70 done. Everything outstanding across every audit
lives there, deduplicated and sequenced. Do not maintain a second list.

---

## Current state

```bash
pnpm install --no-frozen-lockfile
cd artifacts/mobile

npm run test:fast     # 751 tests, ~40s — the inner loop
npm run test:audit    # the long simulations, ~13 min
npm run arch          # 118 modules, 7 architecture checks
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

---

## Document index

### The live backlog

| # | Document | What it covers |
|---|---|---|
| **27** | [**Implementation Roadmap**](./27-implementation-roadmap.md) | **The single working backlog — 120 items, 70 done, sequenced by impact ÷ effort** |

### Audits (measured, scored, closed or open)

| # | Document | Score | Status |
|---|---|---|---|
| 13 | [Learning Effectiveness](./13-learning-effectiveness-audit.md) | 6.4/10 | Superseded by 26 |
| 19 | [Architecture v2](./19-architecture-audit-v2.md) | — | Remediated |
| 20 | [Architecture v2, second pass](./20-architecture-audit-v2-second-pass.md) | — | Remediated |
| 21 | [System Balancing & Simulation](./21-system-balancing-and-simulation-audit.md) | 10/10, 24 properties | ✅ closed, held by CI |
| 23 | [Data Integrity & State](./23-data-integrity-and-state-audit.md) | 9.4/10 | ✅ closed, held by CI |
| 25 | [Playability & Engagement](./25-playability-and-engagement-audit.md) | 5.4 → Tiers 1–2 shipped | 🟡 long tail open |
| 26 | [Learning Content & Educational Knowledge](./26-learning-content-and-educational-knowledge-audit.md) | 6.4/10 | 🟡 Phases 1–3 largely shipped |
| 28 | [UI/UX & Child Experience](./28-ui-ux-child-experience-audit.md) | Child appeal 3.2, parent trust 8.6 | 🟡 Tiers 1–3 shipped |

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
2. **Render and photograph UI work.** Typecheck and 751 unit tests could not see
   a ten-frame that never rendered, a frame drawn twice, or a parent prompt that
   interpolated a paragraph where a name belonged.
3. **A guard that flags correct behaviour is worse than no guard.** It trains
   people to re-run CI instead of reading it.
4. **Do not regress the closed audits** — docs/21 and docs/23.
5. **Do not add curriculum breadth before instructional depth** (docs/26).
6. **Semi-Hindi policy.** Translate what is being learned; keep what is being
   navigated recognisable in both scripts. Numerals stay Western Arabic, units
   and acronyms stay Latin, navigation is bilingual.
