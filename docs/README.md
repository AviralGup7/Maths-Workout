# Maths Workout — Engineering Documentation

> Generated audit & architecture documentation for [`AviralGup7/Maths-Workout`](https://github.com/AviralGup7/Maths-Workout)
> at commit `24c6330` ("Clean project history").
>
> Every claim in these documents was **verified by executing the code**, not by
> reading it alone. Where a bug is asserted, the reproduction command and its
> real output are included.

---

## ⚠️ Read this first

**The repository does not install.** A clean `pnpm install` fails immediately:

```
ERR_PNPM_WORKSPACE_PKG_NOT_FOUND  In artifacts/mobile:
"@workspace/api-client-react@workspace:*" is in the dependencies but
no package named "@workspace/api-client-react" is present in the workspace
```

This is not a subtle issue — it blocks 100% of contributors at step one. The
cause and the verified three-line fix are in
**[04-critical-issues.md](./04-critical-issues.md#c1)**.

---

## Document index

| # | Document | What it covers |
|---|----------|----------------|
| 01 | [Overview & Quick Start](./01-overview.md) | What the app is, how to actually run it today |
| 02 | [Architecture](./02-architecture.md) | Layers, data flow, module graph, state model, rendering |
| 03 | [Missing Files](./03-missing-files.md) | Forensic reconstruction of the 6 deleted packages |
| 04 | [Critical Issues](./04-critical-issues.md) | Reproducible blockers, ranked, with fixes |
| 05 | [Correctness Audit](./05-correctness-audit.md) | Fuzz results: wrong answers, bad choices, difficulty curve |
| 06 | [Improvement Roadmap](./06-improvements.md) | Prioritised backlog, phased, with effort estimates |
| 07 | [Testing Strategy](./07-testing-strategy.md) | Zero tests today → concrete test plan with example code |
| 08 | [Reference](./08-reference.md) | API surface, storage keys, types, env vars, glossary |
| 09 | [Improvement Directions](./09-improvement-directions.md) | Where the product could go: 7 directions with effort/impact |
| 10 | [Question Engine Evolution](./10-question-engine-evolution.md) | Interaction taxonomy, UI plan, and what was built |

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
[05-correctness-audit.md](./05-correctness-audit.md#harness) so findings can be
independently re-run.
