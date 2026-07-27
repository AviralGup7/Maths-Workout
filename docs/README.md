# Maths Workout — Engineering Documentation

> Engineering documentation for [`AviralGup7/Maths-Workout`](https://github.com/AviralGup7/Maths-Workout).
>
> Every claim in these documents was **verified by executing the code**, not by
> reading it alone. Where a bug is asserted, the reproduction command and its
> real output are included.
>
> Docs 01–08 were written against the original commit `24c6330` and describe
> problems that have since been **fixed**; they are kept as the record of what
> was wrong and why. Docs 10+ describe the app as it stands today.

---

## Current state

The repository installs, typechecks and tests cleanly:

```bash
pnpm install --no-frozen-lockfile
cd artifacts/mobile
npx vitest run                       # 307 passed
npx tsc -p tsconfig.json --noEmit    # clean
```

The install failure documented in
[04-critical-issues.md](./04-critical-issues.md#c1) was fixed in `5f13ee9`.
The most recent work is **[15 · Phase 1 Implementation](./15-phase-1-implementation.md)**.

---

## Document index

| # | Document | What it covers |
|---|----------|----------------|
| 01 | [Overview & Quick Start](./01-overview.md) | What the app is, how to actually run it today |
| 02 | [Architecture](./02-architecture.md) | Layers, data flow, module graph, state model, rendering |
| 04 | [Critical Issues](./04-critical-issues.md) | Reproducible blockers, ranked, with fixes |
| 08 | [Reference](./08-reference.md) | API surface, storage keys, types, env vars, glossary |
| 10 | [Question Engine Evolution](./10-question-engine-evolution.md) | Interaction taxonomy, UI plan, and what was built |
| 11 | [Curriculum Research](./11-curriculum-research.md) | CBSE / ICSE / state syllabus sources behind the board model |
| 12 | [Performance & Delight](./12-performance-and-delight.md) | Accessibility, reduced motion, perceived speed, celebration, onboarding |
| 13 | [**Learning Effectiveness Audit**](./13-learning-effectiveness-audit.md) | **Educational review: learning science, pedagogy, diagnostics, curriculum. Score 6.4/10** |
| 14 | [Educational Improvement Roadmap](./14-educational-improvement-roadmap.md) | Solution design for every audit finding, phased by learning-per-hour |
| 15 | [**Phase 1 Implementation**](./15-phase-1-implementation.md) | **What was built, measured results, bugs found, deliberate divergences** |
| 16 | [**Progression System Design**](./16-progression-system-design.md) | **XP economy, levels, achievements, anti-exploit — simulated against adversarial strategies** |
| 17 | [**UI/UX Redesign**](./17-ui-ux-redesign.md) | **Full interface redesign, driven by a measured accessibility and layout audit** |

---

## Executive summary

**What it is.** A React Native / Expo mobile app for drilling primary-school
mental arithmetic, aligned to the Irish primary curriculum (Classes 1–6, ages
6–12). 23 question categories, 3 difficulty levels, 3 session formats, times
tables drills, mistake review, and progress tracking.

**Code quality.** The application code is genuinely good. It is well organised,
consistently formatted, thoughtfully commented, and **type-clean** — once
installable, `tsc --noEmit` reports **0 errors** across all 5,524 lines. The
generator layer is a clean, well-factored dispatcher. The curriculum mapping
shows real domain knowledge.

**What's wrong.** The repository was published after a destructive history
cleanup that deleted six workspace packages while leaving every reference to
them intact — in `pnpm-lock.yaml`, `tsconfig.json`, `pnpm-workspace.yaml` and
`artifacts/mobile/package.json`. The result is a repo that cannot install,
cannot typecheck, and ships a sync layer pointing at a backend that is no
longer present.

Beneath that, the audit found a genuine gameplay bug (60-second Blitz mode is
capped at 10 questions), an inverted colour palette (`light` holds dark values
and vice-versa), a float-precision defect producing `29.999999999999996` as a
displayed answer, and true/false questions rendering only 2 choices where the
UI expects 4.

### Severity breakdown

| Severity | Count | Examples |
|----------|-------|----------|
| 🔴 Blocker | 3 | Install fails, typecheck fails, backend absent |
| 🟠 High | 5 | Blitz capped at 10Q, inverted palette, 2-choice questions |
| 🟡 Medium | 9 | Float artifacts, non-monotonic difficulty, unbounded storage |
| 🟢 Low | 12 | 1.1 MB icon, no README, no tests, no CI |

### The 15-minute fix

Three edits make the repo installable and type-clean. Verified working:

```bash
# 1. artifacts/mobile/package.json — remove the dangling workspace dep
#    and the duplicated dependencies block
# 2. tsconfig.json — empty the "references" array
# 3. pnpm install --no-frozen-lockfile
```

Full detail, including the exact reproduction transcript, in
[04-critical-issues.md](./04-critical-issues.md).

---

## How this audit was performed

| Method | Detail |
|--------|--------|
| Static reading | All 45 files, 5,524 LOC |
| Install reproduction | `pnpm@10.34.5`, Node v20.20.2, clean cache |
| Type checking | `tsc 5.9.3`, both `--build` (root) and `-p` (app) |
| Generator fuzzing | 4,000 iterations × 21 categories × 6 classes × 3 difficulties ≈ **1.4 million generated questions** |
| Semantic verification | Re-derived the arithmetic from rendered question text and compared to the stated answer |
| Difficulty analysis | Measured mean largest operand across 2,000 samples per (class, category, difficulty) cell |

The fuzz harness used to produce these results is reproduced in
the generator fuzzing audit (since retired) so findings can be
independently re-run.
