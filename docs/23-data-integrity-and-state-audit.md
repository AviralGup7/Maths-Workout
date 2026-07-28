# 23 · Data Integrity & State Management Audit

**Scope:** can a learner's data be lost, corrupted, duplicated, made inconsistent, incorrectly derived, or become unrecoverable?
**Not in scope:** UI, architecture, performance — except where they directly cause a correctness failure.
**Assumption:** daily use for years, by hundreds of thousands of learners, on cheap Android devices that get killed by the OS constantly.

**Method:** every finding below was produced by executing the real engine against a fault-injecting AsyncStorage simulator that models the durability guarantees the platform actually provides — per-key atomicity, *no* cross-key transaction, asynchronous writes that may never land, and `SQLITE_FULL` rejections.

```
Harness   artifacts/mobile/audit/integrity/fakeStorage.ts
Probes    artifacts/mobile/audit/integrity/__tests__/    (36 tests, all passing)
Baseline  commit fff5b18 · typecheck clean · arch-check 7/7 · 594 product tests green
```

No product code was modified during this audit.

---

---

> **STATUS — remediated.** All 20 findings are closed. Overall score **6.1 → 9.4**.
> See **`24-data-integrity-remediation.md`** for before/after measurements, the
> 20 permanent guards (each verified to fail against its own reverted fix), and
> the two cases where a guard had to be rewritten because it passed against a
> broken implementation.
>
> Findings below are preserved as written, including the three hypotheses the
> audit disproved by execution.

---

## 1 · Executive Summary

**The data model's foundation is right, and it is the single most valuable property this codebase has.** The append-only attempt log is genuinely authoritative, and everything expensive — mastery, statistics, achievements, scheduler input, parent reports — is *derived* from it rather than stored. I verified this empirically rather than taking it on trust: replaying the entire log through `recordAnswer` reproduces mastery **exactly**, achievements **exactly**, and even `totalXp` to a drift of **0.0**. That means almost every derived value in the product is self-healing by construction. Very few applications of this kind can say that.

**The persistence layer around that model does not honour it.** Three defects, all confirmed by execution:

| # | Finding | Measured |
|---|---|---|
| **F1** | XP is written immediately; the attempt log is debounced 1500 ms. A kill in between keeps the payment and loses the evidence. | Crash after 20 answers → **307 XP kept, 0 attempts kept** |
| **F2** | The log is stored as one JSON blob. Any torn or truncated write destroys the entire history, not part of it. | 200 attempts written, truncated mid-array → **0 recovered** |
| **F3** | The attempt log is never uploaded. `ProgressData` has no `attempts` field, so `loadAll`'s `remote.attempts` is permanently `undefined`. | Reinstall → **100% of mastery, XP, level and achievements lost** |

F3 is the most serious finding in this audit and it is invisible in normal testing, because it only manifests on a device the tester no longer has. A learner with two years of history who drops their phone has *nothing* to restore, despite the app maintaining a sync endpoint that looks like it would restore it.

Two further real defects: `mergeAttempts` **silently drops genuine attempts** across devices because its identity key collides at millisecond resolution (measured: merging a 1-attempt device with a 2-attempt device yields 1, not 2), and `progressStats` is **dual-written from two sources of truth** — maintained on every answer, then discarded on every launch.

**Overall Data Integrity Score: 6.1 / 10.** The derivation model earns ~9; the durability layer earns ~4. Nothing here is architecturally hard to fix — the hard part, an authoritative event log, is already built and working.

---

## 2 · Overall Data Integrity Score

| Dimension | Score | Basis |
|---|---|---|
| Single source of truth | **8.5** | Log is authoritative; one dual-write (`progressStats`) |
| Derived-data correctness | **9.5** | Mastery/achievements/XP replay bit-exact |
| Write atomicity | **3.5** | No cross-key transaction; XP/log torn by design |
| Crash durability | **4.0** | 1500 ms window loses a whole session's evidence |
| Corruption resistance | **5.0** | Validators exist but accept impossible values; no checksum |
| Migration safety | **8.0** | Re-migration correctly guarded; manifest write is unordered |
| Offline reliability | **5.5** | Silent write failures, no retry, no user signal |
| Multi-device consistency | **3.0** | Merge key collides; log never synced at all |
| Long-term reliability | **6.0** | Deterministic and idempotent, but 200-day retention |
| Recovery / self-healing | **7.0** | Derived state heals; authoritative state cannot |
| **Weighted total** | **6.1** | |

---

## 3 · State Model Review

### Every persistent value, classified

| Key | Authoritative? | Derivable? | On loss |
|---|---|---|---|
| `v3_attempts` | **YES** — the source | it *is* the source | **unrecoverable** |
| `total_xp` | YES (accumulator) | yes, by replay | recoverable, never rebuilt |
| `xp_ledger` | YES | yes, by replay | recoverable, never rebuilt |
| `v2_high_scores` | YES | no | **unrecoverable** |
| `v2_tables_best` | YES | no | **unrecoverable** |
| `v2_saved_mistakes` | YES | partially, from log | degraded |
| `device_id` | YES | no | orphans all server data |
| `v2_progress_stats` | **no — dual-written** | yes, from log | self-heals |
| mastery / achievements / scheduler input | no | yes, from log | self-heals |
| `board`, `lang`, `theme`, `timer_pref`, `text_scale`, `seen_welcome` | YES (preferences) | no | cosmetic |

**3 of 11 stored values are unrecoverable on loss**, and one of them is the entire learning history.

### F4 · `progressStats` has two writers (Medium)

`app/game.tsx` calls **both** per answer:

- `saveProgressStats(correct, cat)` — read-modify-write on the previous React state, persisted to `STATS_KEY`
- `recordAttempt(...)` → `setProgressStats(deriveLegacyStats(log))` — derived, **not** persisted

Then `loadAll` does:

```ts
setProgressStats(localAT.length > 0 ? deriveLegacyStats(localAT) : localPS);
```

So the persisted copy is written ~30× per session and **read only when the log is empty**. It is write-only state.

I initially predicted the two would diverge in their *key space*. That was wrong — `deriveLegacyStats` keys on each attempt's own recorded category, and `recordAnswer` stamps attempts with `resolvedCategory ?? sessionCategory`, so under normal play they agree. The real defect is subtler and worse: **the app holds the true count on disk and throws it away.** Measured after a partial log loss — counter says `attempted=50`, log-derived says `attempted=20`, and the app displays 20 while 50 sits unread in `STATS_KEY`.

Two writers that agree only by coincidence will eventually disagree. Either make the counter authoritative or delete it; maintaining it write-only is the worst of both.

---

## 4 · Persistence Analysis

### F1 · Torn write between XP and its evidence (**Critical**)

```
persistProgression(xp, ledger)   → awaited immediately, per answer
schedulePersist(log)             → setTimeout(..., 1500)
```

These are separate keys. AsyncStorage has **no cross-key transaction**. Measured at four crash points:

| Crash after | XP kept | Attempts kept |
|---|---|---|
| 1 answer | 156 | **0** |
| 5 answers | 296 | **0** |
| 10 answers | 301 | **0** |
| 20 answers | 307 | **0** |

Every crash keeps **100% of the XP and 0% of the attempts that earned it**. With the log flushed per answer instead, the same crash loses nothing (`xp=307 attempts=20`).

**Scenario.** A child finishes 20 questions on a 2 GB Android device. They press home to show a parent. Android reclaims the app before `AppState` delivers `background`. On relaunch the level is intact, the streak is broken, mastery has rolled back a day, and the mistake-review list is empty.

The comment claims *"No data is at risk: the flush window is under two seconds."* Two seconds is enormous on a low-memory device, and it is precisely the window in which children put the phone down.

### F2 · One blob, all-or-nothing (**High**)

The log is a single `JSON.stringify` of up to 4,000 rows (~1.07 MB). Measured: truncate that value and `JSON.parse` throws, the `catch` returns `[]`, and **200 attempts become 0**. A line-delimited or chunked format would have recovered ~100 of them.

There is also **no checksum**. I flipped a `correct` boolean and replaced a skill id with `'nonexistent.skill'`; all 50 rows were accepted by `sanitiseLog`. (`estimateAll` does correctly skip unknown skill ids — a good defensive touch — but the falsified boolean propagates into mastery silently.)

### F5 · Silent write failures (**High**)

Every write is wrapped in `try { ... } catch { }` with an **empty body**. Simulating a full device for a week:

```
in-memory attempts: 70   durable: 30   failed writes swallowed: 4
```

The learner sees a fully working app. Nothing has been saved for days. There is no retry, no degraded-mode banner, no telemetry, and no way for the app to know it is in this state.

### F6 · No write ordering or compare-and-set (**Medium**)

`flushAttempts` is invoked from three places — the 1500 ms timer, `endGame()`, and the `AppState` listener. Two overlapping flushes can complete out of order; there is no sequence number to reject a stale write. Measured: writing a 25-row snapshot then a 10-row snapshot leaves **10 rows durable**. The log is append-only in memory, so a shorter array is always older and should always lose.

---

## 5 · Consistency Analysis

### F7 · Merge key collides, dropping real attempts (**High**)

```ts
const key = x => `${x.answeredAt}|${x.skill}|${x.questionText}|${x.chosen}`;
```

At millisecond resolution, two genuine attempts at the same question with the same answer are indistinguishable. Measured:

```
device B (1 attempt) merged with device A (2 attempts) = 1
```

**A real second attempt is destroyed.** This was flagged as a known risk in earlier work; this audit confirms it causes actual loss, not just theoretical ambiguity.

Note the merge *is* correctly idempotent for repeated sync of the same log — 20 round-trips held at exactly 300 rows — because `seen` is seeded only from side `a`. So the bug is narrow but real: it only bites when the duplicate arrives from the remote side, which is exactly the cross-device case sync exists for.

### F8 · Double submission is possible and pays twice (**Medium**)

`game.tsx` guards with `if (perQLocked) return;`, but `perQLocked` is React state read through the render closure. Two calls in the same tick both observe the stale `false`:

```
submissions accepted in one tick: 2 [ 'tap1', 'tap2' ]
```

Measured consequence: `XP: 155.8 then 56.8 — total 212.6`, two log rows for one question. `recordAnswer` has no idempotency key, so the engine cannot distinguish a genuine second attempt from a replayed first.

### F9 · Ledger survives, evidence does not (**High**)

The most damaging *silent* inconsistency. `xp_ledger` is written immediately; the log is debounced. After a crash:

```
mastery in memory at crash: 0.984
mastery after restart:      0.968
ledger high-water on disk:  { "add.3digit": 0.9998 }
```

The ledger records mastery **already paid for** that the log no longer evidences. `payableDelta` therefore refuses to pay for re-learning it. The learner must redo the work and receives only the floor XP — the anti-exploit mechanism becomes a punishment for a crash the child did not cause.

### F10 · Validators accept impossible values (**Medium**)

| Validator | Accepts |
|---|---|
| `isStatMap` | `{ attempted: -5, correct: -10 }` — the only numeric guard is `correct <= attempted`, and `-10 <= -5` |
| `isNumberMap` | negative high scores and table bests |
| `sanitiseLog` | negative `latencyMs`, `answeredAt` of year 275760, empty-string `skill` |

A future-dated attempt (clock skew, manual date change, NTP correction after a flat battery) yields `daysSince < 0` in the decay path and sits at the head of the log permanently — every subsequent `currentStreak` and `isDue` computation reads from a timestamp that has not happened yet.

Separately, `lib/storage.ts` exports `readJson`, `writeJson`, `readNumber` and `readEnum` — the validated typed façade — and **nothing calls any of them** (0 callers each). `GameContext` and `useTheme` hand-roll their own validation instead. The theme validation happens to be correct; the point is that the safe helpers exist and are bypassed.

---

## 6 · Migration Safety

**This is the strongest area of the persistence layer.** I tried to break it and could not.

- **Interrupted migration is safe.** A crash between "write migrated log" and "write schema version" leaves the version stale, but the guard is `schemaVersion < CURRENT && localAT.length === 0` — the non-empty log prevents re-migration. Verified: `would migrate again? false`.
- **Re-running migration is bounded.** `migrateLegacyStats` caps synthesis at 40 rows per cell, so even a duplicate run cannot flood the log.
- **The manifest is complete.** All 16 keys used anywhere in the codebase are declared in `KEYS`.
- **Unknown fields are ignored**; missing fields fall back to sane defaults.

### F11 · Manifest is written last and unawaited (**Low**)

`loadAll` ends with `void writeManifest(MANIFEST_VERSION)` — not awaited, and after all data writes. A crash leaves data in v4 shape with **no manifest at all**, so `readManifest()` returns version 0 and a future migration would treat a current install as pre-manifest. The `localAT.length === 0` guard currently saves this, but that guard is defending the wrong invariant by luck rather than design.

---

## 7 · Offline Reliability

| Scenario | Result |
|---|---|
| App killed mid-session | **Loses everything since the last flush** (F1) |
| Device reboot | Same as above |
| Force close via task switcher | `AppState` usually fires → safe |
| Low storage | **Silent, permanent write failure** (F5) |
| Interrupted write | **Whole log discarded** (F2) |
| Airplane mode | Correct — local-first, server is optional |
| Reinstall | **Total loss** (F3) |

### F3 · The attempt log is never synced (**Critical**)

```ts
export interface ProgressData {
  highScores; progressStats; tablesBest; wrongAnswers;   // no `attempts`
}
```

`pushProgress` sends only these four. But `loadAll` reads:

```ts
localAT = mergeAttempts(localAT, sanitiseLog((remote as { attempts?: unknown }).attempts));
```

That cast is doing real damage: it makes unreachable code look implemented. `remote.attempts` is **always** `undefined`, so the merge is always a no-op. Measured restore after reinstall: **0 attempts, 0 skills, mastery index 0.** `totalXp` and `xpLedger` are not in `ProgressData` either, so level and XP are equally unrecoverable.

**Scenario.** A Class 4 learner uses the app daily for eighteen months. Their phone is replaced. They reinstall, the app finds their server record, restores four high scores and a mistake list — and reports that they have never practised anything. Every chapter is locked. Level 1.

---

## 8 · Failure Scenarios

Each measured, not hypothesised.

**S1 · "My streak disappeared."** 29 days flushed normally; day 30 practised and the app is killed inside the debounce. Streak in memory 30 → streak after restart **29 days' worth, day 30 gone**. XP for day 30 is kept. This will be the single most common support ticket.

**S2 · "It said I mastered it, then it forgot."** Mastery 0.984 at crash → 0.968 after restart, with the ledger claiming 0.9998. The learner is asked to redo work they already did, for no reward.

**S3 · Reinstall.** 450 attempts, 30 days of history → 0 recoverable. See F3.

**S4 · Week on a full device.** 70 attempts in memory, 30 durable, 4 write failures swallowed. No signal of any kind.

**S5 · Five years of daily use.** 36,500 attempts generated, **4,000 retained (11%)**. Oldest retained attempt is day 1,625 of 1,825 — a **200-day rolling window**. Achievements counting "distinct practice days" see 200, not 1,825. Notably `totalXp` and level keep climbing correctly, so a five-year learner has a level that no surviving evidence supports.

**S6 · Two devices.** Phone with 3,000 attempts merged with tablet's 3,000 → 4,000 retained, **only 1,000 phone rows survive**. The older device's history is evicted with no warning and no backup.

**S7 · Backwards clock.** 30-day streak; clock jumps back a week; 5 more days practised. Streak reads 27 and the log is now **out of chronological order** — `estimateFromRelevant` sorts defensively, but `appendAttempts` does not, and `mergeAttempts` sorts only on merge.

---

## 9 · Recovery Strategy Review

| Capability | Present? |
|---|---|
| Detect corruption | **Partial** — parse failures caught; semantic corruption invisible (no checksum) |
| Isolate corruption | **No** — one bad byte discards the entire log |
| Repair | **No** — the only repair is discard-and-restart-empty |
| Rebuild derived state | **Yes, and it works** — verified bit-exact for mastery, achievements, XP |
| Rebuild authoritative state | **No** — no backup, no journal, no server copy |
| Self-healing | **Partial** — derived layer heals perfectly; authoritative layer cannot |

The asymmetry is the whole story. The team built an event-sourced model whose derived layer is fully reconstructible, then stored the event log itself with **no redundancy, no integrity check, and no off-device copy**. The one thing that cannot be recomputed is the one thing least protected.

A useful positive: because replay is exact, `totalXp` and `xpLedger` do **not** need to be stored authoritatively at all. They could be rebuilt from the log on load, which would eliminate F9 entirely.

---

## 10 · Top 20 Reliability Improvements

Ordered by (harm prevented) ÷ (effort).

### Critical

1. **Sync the attempt log.** Add `attempts` to `ProgressData` and push it. The read path already exists and is dead code without this. *Fixes F3 — the largest single loss vector.*
2. **Write the log before the XP.** Reverse the order in `recordAttempt`, or write both in one `multiSet`. XP without evidence is strictly worse than evidence without XP, because evidence rebuilds XP exactly. *Fixes F1, F9.*
3. **Append incrementally instead of rewriting the blob.** Keep a small `pending_attempts` key holding only the current session's rows; fold into the main log on session end. Reduces the flush from 1.07 MB to a few KB, making per-answer writes affordable. *Fixes F1, F2, and the performance reason the debounce exists.*
4. **Add a per-attempt `id`** (`deviceId + monotonic counter`) and key `mergeAttempts` on it. *Fixes F7 and F8 at once, and makes the log a true CRDT.*

### High

5. **Checksum the log** (length + cheap hash alongside the payload); on mismatch, prefer the last-known-good copy over discarding.
6. **Keep one previous-generation backup** of the log key, rotated on successful write. Turns "total loss" into "lose the last session".
7. **Surface write failures.** Count consecutive failures; after N, show a non-blocking "couldn't save your progress" state. Silent failure is the worst option available. *Fixes F5.*
8. **Retry failed writes** with backoff rather than swallowing the rejection.
9. **Add a monotonic sequence number** to the log payload; reject any write whose sequence is lower than what is already durable. *Fixes F6.*
10. **Rebuild `totalXp` and `xpLedger` from the log on load** rather than trusting stored accumulators. Replay is already proven exact (drift 0.0). *Eliminates F9 as a class.*

### Medium

11. **Delete `saveProgressStats`.** It is write-only state with a second writer. The derived value is already correct and already displayed. *Fixes F4.*
12. **Tighten validators**: reject negative `attempted`/`correct`, negative `latencyMs`, empty `skill`, and timestamps outside a plausible range.
13. **Clamp future-dated attempts** to `now` on read, and record the skew. *Fixes the clock-change class.*
14. **Sort on append**, not only on merge, so the log is always chronological. *Fixes S7's ordering corruption.*
15. **Use `AsyncStorage.multiSet`** for the four session-end writes in `saveScore` so they land together.
16. **Guard double submission with a ref**, not React state — `if (submittingRef.current) return; submittingRef.current = true;`. *Fixes F8 at the UI layer.*
17. **Write the manifest first**, before the data it describes, and await it. *Fixes F11.*
18. **Raise or tier `MAX_ATTEMPTS`.** 200 days of retention is short for a product measured in school years. Consider keeping full fidelity for 90 days and a daily-aggregated summary beyond that, so lifetime statistics survive.

### Low

19. **Use the `lib/storage.ts` façade** (`readJson`/`readNumber`/`readEnum`) in `GameContext` and `useTheme`. It exists, it is correct, and it has zero callers.
20. **Add a storage-key drift guard** to `arch-check.mjs`: fail the build if a `@maths_workout_*` literal appears outside `lib/storage.ts` without being in `KEYS`.

---

## 11 · Risk Matrix

| Severity | Finding | Failure mode |
|---|---|---|
| **Critical** | **F3** log never synced | Reinstall or device loss → 100% of learning history gone |
| **Critical** | **F1** XP/log torn write | Every OS kill loses a session's evidence while keeping its reward |
| **High** | **F2** single-blob log | One torn byte destroys the entire history |
| **High** | **F5** silent write failure | Full device → days of invisible data loss |
| **High** | **F7** merge key collision | Cross-device sync destroys genuine attempts |
| **High** | **F9** ledger outlives evidence | Learner must redo mastered work for no reward |
| **Medium** | **F4** `progressStats` dual-write | Two writers that agree only by coincidence |
| **Medium** | **F6** no write ordering | Stale flush overwrites newer log |
| **Medium** | **F8** double submission | Duplicate attempt, double XP |
| **Medium** | **F10** permissive validators | Negative counts and impossible timestamps persist |
| **Low** | **F11** manifest written last | Future migration misreads install age |
| **Low** | unused storage façade | Safe helpers bypassed; validation duplicated |

---

## 12 · Final Verdict

**The state model is correct and the persistence layer is not.**

I want to be precise about the distinction, because it determines how much work this is. The hard architectural decision — make an append-only event log authoritative and derive everything else — was made correctly and is genuinely well executed. I verified it rather than assuming it: mastery, achievements and XP all replay from the log **bit-exact**, and repeated sync is idempotent across 20 round-trips. That property is what makes almost every derived value in this product self-healing, and it is why none of the fixes below require redesigning anything.

What is missing is durability *engineering* around that model: the log is written as one blob, on a 1500 ms delay, after the XP it justifies, with no checksum, no backup, no ordering guarantee, no failure signal, and — the finding I would act on first — **no off-device copy at all**, behind a type cast that makes the restore path look implemented when it cannot ever return data.

For a product whose entire value proposition is a multi-year record of a child's learning, "a reinstall loses everything" is not a durability gap; it is the product not delivering what it promises. A parent who replaces a phone will not distinguish between *the app lost my child's progress* and *the app was never keeping it*.

None of this is expensive. Items 1–4 — sync the log, order the writes, append incrementally, add an attempt id — address every Critical and High finding, and each is a day's work against code that is already structured to accept them. Item 10 is nearly free and removes an entire inconsistency class by deleting stored state rather than adding any.

**Recommendation: do not ship a multi-device or cloud-restore story until F3 and F1 are closed.** The single-device, no-crash path is sound today. The failure paths are where the years of history live, and they are currently unprotected.

---

### Reproducing

```bash
cd artifacts/mobile
npx vitest run audit/integrity/           # 36 probes, ~70 s
```

Probes are read-only against the engine. `npm run verify` (typecheck + arch-check 7/7 + 594 tests) passes unchanged.

### Method notes — corrections made during this audit

Three initial hypotheses were **disproved by execution** and are recorded here because the corrections are more informative than the guesses:

- I predicted `progressStats`'s two writers would диverge in key space. They do not — `deriveLegacyStats` keys on each attempt's own category. The real defect is that the persisted copy is never read.
- I predicted `mergeAttempts` would collapse same-millisecond duplicates on self-merge. It does not — `seen` is seeded only from side `a`, so self-merge is idempotent. The loss occurs only on cross-device merge.
- I predicted `totalXp` could not be rebuilt from the log. It can, exactly (drift 0.0) — which turns recommendation 10 from "add a repair tool" into "delete the stored value".
