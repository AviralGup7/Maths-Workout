// ─── Adaptive scheduler ──────────────────────────────────────────────────────
// Direction C — the component that decides what to practise next.
//
// The legacy flow asked the learner to choose class, category and difficulty,
// then served random questions from that cell. That has three problems:
//   · the learner is a poor judge of what they need
//   · mastered material is repeated as often as weak material
//   · nothing resurfaces before it is forgotten
//
// This scheduler selects skills using spaced repetition plus a target success
// band, and keeps the learner inside their zone of proximal development.

import type { SkillId } from './skills';
import { SKILLS, resolveSkill, prerequisiteClosure } from './skills';
import type { MasteryEstimate } from './mastery';
import { MASTERED_THRESHOLD, STRUGGLING_THRESHOLD, RECOGNITION_CEILING, DAY_MS, isReady } from './mastery';
import type { Category, Difficulty, SchoolClass } from '../generators/types';
import { getAvailableCategories } from '../generators';
import type { Board } from '../curriculum/boards';
import { DEFAULT_BOARD } from '../curriculum/boards';
import { CHAPTERS } from '../curriculum/chapters';

/** Class ordering, for comparing a chapter's introduction year to the learner's. */
const CLASS_ORDER: SchoolClass[] = ['1st', '2nd', '3rd', '4th', '5th', '6th'];


/**
 * Target success rate.
 *
 * Learning is fastest when a learner succeeds most of the time but not always —
 * high enough to stay motivated, low enough to be doing real work.
 */
export const TARGET_SUCCESS_LOW = 0.7;
export const TARGET_SUCCESS_HIGH = 0.85;

/**
 * Target minimum projected success rate for a session (M1 · success floor).
 *
 * The audit simulated a struggling learner and measured a session where the
 * weak skill was 14 of 20 questions at ~5% expected success. The learner is
 * inside their zone of proximal development at 70–85%; at 5% they are simply
 * failing, and the motivational damage outlasts any content gain.
 *
 * 0.60 rather than 0.70: the floor is a *safety net*, not the target. Pulling
 * every session up to 0.70 would dilute genuine remediation. Sessions should
 * usually land in the target band naturally; this stops the pathological case.
 *
 * IMPORTANT — this is a target, not a guarantee, and the distinction is
 * deliberate. The floor competes with `MAX_DILUTION_RATIO` below, and the
 * dilution cap deliberately wins. A learner who is weak at everything in their
 * session cannot be lifted to 0.60 without replacing so much of the session
 * that no remediation is left, at which point the app would be flattering the
 * child rather than teaching them. In that case the floor raises success as far
 * as it honestly can and stops. Callers must not assume attainment.
 */
export const SESSION_SUCCESS_FLOOR = 0.60;

/**
 * Hard ceiling on how much of a session the success floor may replace.
 *
 * Without this the floor becomes an avoidance mechanism: the easiest way to
 * make a session "successful" is to stop asking anything difficult.
 */
export const MAX_DILUTION_RATIO = 0.5;

/**
 * Ceiling on how much of a session may go to already-secure skills.
 *
 * Retrieval practice keeps mastered skills mastered, but a session spent
 * confirming what a learner can already do is a session that taught nothing.
 * Bounded on both sides: at least the maintenance reserve, at most this.
 */
export const OVER_PRACTICE_CAP = 0.25;

export interface ScheduledSkill {
  skill: SkillId;
  /** Higher is more urgent. */
  priority: number;
  reason: 'gap' | 'due' | 'learning' | 'new' | 'maintain';
  /** Suggested difficulty for this skill given current mastery. */
  difficulty: Difficulty;
}

/**
 * Spaced-repetition interval, in days, for a given mastery level.
 * Weak skills return almost immediately; secure skills stretch out.
 */
export function reviewIntervalDays(mastery: number, attempts: number): number {
  if (attempts === 0) return 0;
  if (mastery < STRUGGLING_THRESHOLD) return 0.5;
  if (mastery < TARGET_SUCCESS_LOW) return 1;
  if (mastery < MASTERED_THRESHOLD) return 3;
  // Secure skills stretch with repeated success, capped at 30 days.
  return Math.min(30, 7 * Math.pow(1.6, Math.max(0, attempts - 8) / 6));
}

/** Is this skill due for review? */
export function isDue(est: MasteryEstimate, now: number = Date.now()): boolean {
  if (!est.lastPracticed) return true;
  const daysSince = (now - est.lastPracticed) / DAY_MS;
  return daysSince >= reviewIntervalDays(est.value, est.attempts);
}

/** Map a mastery estimate onto a sensible difficulty. */
export function difficultyFor(est: MasteryEstimate | undefined): Difficulty {
  if (!est || est.attempts === 0) return 'easy';
  if (est.value < TARGET_SUCCESS_LOW) return 'easy';
  if (est.value < MASTERED_THRESHOLD) return 'medium';
  return 'hard';
}

/**
 * Rank every candidate skill for a class by how much the learner would benefit
 * from practising it now.
 *
 * Priority ordering:
 *   1. gap      — a weak prerequisite blocking later work (fix the cause)
 *   2. due      — spaced repetition has come round
 *   3. learning — in progress, below mastery
 *   4. new      — unlocked and not yet started
 *   5. maintain — secure, low value but keeps things varied
 */
export function scheduleSkills(
  cls: SchoolClass,
  estimates: Record<SkillId, MasteryEstimate>,
  now: number = Date.now(),
  board: Board = DEFAULT_BOARD,
): ScheduledSkill[] {
  const categories = getAvailableCategories(cls, board);
  const candidates = new Set<SkillId>();

  // Skills reachable from this class's categories, at each difficulty.
  for (const cat of categories) {
    if (cat === 'mixed' || cat === 'tables') continue;
    for (const d of ['easy', 'medium', 'hard'] as Difficulty[]) {
      candidates.add(resolveSkill(cls, cat, d));
    }
  }

  // Prerequisites are candidates too — that is how gaps get fixed.
  for (const id of [...candidates]) {
    for (const p of prerequisiteClosure(id)) candidates.add(p);
  }

  // Every skill named by a chapter at or below this class is a candidate.
  //
  // docs/21 · F3. `resolveSkill` maps each (class, category, difficulty) cell to
  // ONE skill, so a category with four skills and three difficulty slots has an
  // orphan by construction. `patterns.basic` was exactly that: present in
  // SKILLS, named by the `number-sense` chapter, a prerequisite of
  // `algebra.basic` — and returned by `resolveSkill` for no input at all.
  //
  // The consequence was not a missing topic but a permanently frozen map:
  // `chapterStatus` averages `mastery[s] ?? 0` over a chapter's skills, so one
  // never-served skill capped `number-sense` at mean 0.67 against a 0.70 unlock
  // gate, which locked `word-problems` and `integers-algebra` — the terminal
  // chapter of the whole curriculum — for every learner, permanently. Measured
  // against a perfect learner at 100% attendance for 730 days: still locked.
  //
  // Sourcing candidates from the chapter map as well as the category menu makes
  // orphaning structurally impossible: if a skill is worth putting in a
  // chapter, it is worth scheduling. Guarded by a test that asserts every skill
  // in every chapter is reachable.
  // Only ORPHANS are added, not every chapter skill. Adding all of them
  // inflated the `new` pool from 27 to 40 and, because the fresh budget is
  // deliberately ~1 skill per session, pushed depth-3 material (mul.tables.mid)
  // past a week of practice — a real regression caught by scheduler-scale.
  // Rescuing exactly the unreachable skills fixes the frozen curriculum without
  // disturbing the introduction pace that the depth ordering establishes.
  // Reachability is PER CLASS, not global.
  //
  // The first version of this fix rescued only globally-unreachable skills
  // (`patterns.basic`), which missed the general form of the bug: each class
  // menu resolves its own small set, so a Class 6 learner could not be
  // scheduled 26 of the skills their own chapters name — including
  // `symmetry.basic`, which left the `geometry` chapter locked at mean 0.46 for
  // a perfect learner after two years. `resolveSkill` maps (class, category,
  // difficulty) to one skill, and Class 6 drops `shapes` from its menu
  // entirely, so the skill simply has no route in.
  //
  // Any skill named by a chapter at or below the learner's class is legitimate
  // material for that learner — that is what putting it in the chapter meant.
  // Prerequisite readiness (`isReady`) still gates whether it is actually
  // introduced, and the depth/class priority still decides the order.
  for (const ch of CHAPTERS) {
    if (CLASS_ORDER.indexOf(ch.introducedIn) > CLASS_ORDER.indexOf(cls)) continue;
    for (const s of ch.skills) if (SKILLS[s]) candidates.add(s);
  }

  // Any skill the learner has ACTUALLY PRACTISED is a candidate, whatever the
  // class menu currently offers.
  //
  // Without this, a skill could be practised ten times, sit at 0.06 mastery,
  // and be absent from the ranking entirely — because the candidate set was
  // derived only from `resolveSkill` over this class's categories, and
  // `resolveSkill` maps each (class, category, difficulty) cell to ONE skill.
  // A learner who met `factors.basic` through Mixed practice, a board change or
  // a different class could therefore never be scheduled to repair it. Silently
  // dropping evidence the learner generated is the worst failure mode available
  // to a scheduler.
  for (const [skill, est] of Object.entries(estimates)) {
    if (est.attempts > 0 && SKILLS[skill]) candidates.add(skill);
  }

  const out: ScheduledSkill[] = [];

  for (const skill of candidates) {
    if (!SKILLS[skill]) continue;
    const est = estimates[skill];
    const difficulty = difficultyFor(est);

    // Never introduced and prerequisites unmet — hold it back.
    if (!est || est.attempts === 0) {
      if (!isReady(skill, estimates)) continue;
      // Every `new` skill previously shared priority 40, so the pool was
      // round-robined in arbitrary object order. At 27 candidate skills that
      // was survivable; at 45 a skill sitting at index 26 was never reached —
      // measured over 10 simulated days, a learner's designated weak skill was
      // introduced ZERO times. Ordering by depth in the prerequisite graph
      // means foundations are introduced before the material built on them,
      // which is the order a curriculum should follow anyway.
      const depth = prerequisiteClosure(skill).length;
      // Depth orders foundations before the material built on them. But depth
      // ALONE is class-blind, and that has a measurable cost: a Class 4 learner
      // spent 30+ sessions on Class 1 material and had still not met
      // `mul.tables.mid`, because every depth-1 and depth-2 foundation
      // outranked it forever. Times tables are core Class 3–4 content; a Class
      // 4 child meeting them after two months is a curriculum failure, not
      // careful sequencing.
      //
      // Class proximity breaks the tie: among skills the learner is ready for,
      // prefer those introduced at or near their own year. Foundations still
      // come first (depth dominates at 1.0/level against 0.6/year), but the
      // scheduler now walks *towards* the learner instead of exhausting the
      // curriculum from the bottom.
      // Depth must strictly dominate: a prerequisite is always shallower than
      // the skill built on it, so as long as one level of depth outweighs the
      // largest possible class adjustment, the DAG order can never be violated.
      // Capping the class term below 1.0 guarantees that. (An earlier version
      // used 0.6/year uncapped, which let `symmetry.basic` — Class 3, depth 3 —
      // overtake its own prerequisite `shapes.basic` — Class 1, depth 2.)
      const gap = Math.max(0, CLASS_ORDER.indexOf(cls) - CLASS_ORDER.indexOf(SKILLS[skill].introducedIn));
      const classPenalty = Math.min(0.9, gap * 0.18);
      const priority = 40 - Math.min(15, depth) - classPenalty;
      out.push({ skill, priority, reason: 'new', difficulty: 'easy' });
      continue;
    }

    const due = isDue(est, now);

    // A weak skill that other skills depend on is the highest-value target.
    const isBlocking = [...candidates].some(other =>
      other !== skill && SKILLS[other]?.prerequisites.includes(skill),
    );

    if (est.value < STRUGGLING_THRESHOLD && isBlocking) {
      out.push({ skill, priority: 100 + (1 - est.value) * 50, reason: 'gap', difficulty: 'easy' });
    } else if (due && est.value < MASTERED_THRESHOLD) {
      out.push({ skill, priority: 80 + (1 - est.value) * 30, reason: 'due', difficulty });
    } else if (est.value < MASTERED_THRESHOLD) {
      out.push({ skill, priority: 60 + (1 - est.value) * 20, reason: 'learning', difficulty });
    } else if (due) {
      out.push({ skill, priority: 20, reason: 'maintain', difficulty: 'hard' });
    } else {
      out.push({ skill, priority: 5, reason: 'maintain', difficulty: 'hard' });
    }
  }

  return out.sort((a, b) => b.priority - a.priority);
}

/**
 * Build a practice session.
 *
 * Deliberately not purely greedy: taking only the single highest-priority skill
 * produces a demoralising session of nothing but the learner's weakest area.
 * We interleave — mostly priority work, with some confident material mixed in.
 * Interleaved practice also outperforms blocked practice for retention.
 */
export function buildSession(
  cls: SchoolClass,
  estimates: Record<SkillId, MasteryEstimate>,
  count: number,
  now: number = Date.now(),
  board: Board = DEFAULT_BOARD,
): ScheduledSkill[] {
  const ranked = scheduleSkills(cls, estimates, now, board);
  if (ranked.length === 0) return [];

  const focus = ranked.filter(s => s.reason === 'gap' || s.reason === 'due' || s.reason === 'learning');
  const fresh = ranked.filter(s => s.reason === 'new');
  const secure = ranked.filter(s => s.reason === 'maintain');

  const session: ScheduledSkill[] = [];

  // Composition, in priority order:
  //   ~70% focus      — gaps, due reviews, work in progress
  //   ~15% maintain   — retrieval practice on secure skills
  //   remainder new   — introduce unlocked material
  //
  // The maintenance reserve matters for two reasons. Pedagogically, retrieval
  // practice is what keeps a mastered skill mastered — and the mastery model
  // decays unpractised skills, so never scheduling them guarantees silent
  // erosion. Practically, it is also the only path by which a secure skill
  // reaches the harder interaction types (typed recall rather than
  // recognition), since those are gated on high mastery.
  //
  // The focus share is bounded by how many DISTINCT focus skills exist.
  //
  // docs/21. With a single focus skill the 70% target put 17 of 20 questions on
  // it — measured on a Class 1 learner whose only unconsolidated skill sat at
  // the recognition ceiling, so a quarter of their entire year went to one
  // topic. That is drilling, not interleaving, and interleaving is the whole
  // reason this function is not simply greedy.
  //
  // Allowing ~5 questions per distinct focus skill keeps genuine remediation
  // concentrated (a real gap still dominates a session) while preventing one
  // skill from consuming a session because it happens to be the only candidate.
  const focusCeiling = Math.min(count, focus.length * 5);
  const focusTarget    = focus.length  > 0 ? Math.max(1, Math.min(focusCeiling, Math.round(count * 0.70))) : 0;
  /**
   * Cap on how many BRAND NEW skills one session may introduce.
   *
   * Without this, a large curriculum starves depth: measured over 12 simulated
   * days a strong learner touched all 31 available skills and mastered NONE,
   * because every session kept opening new material instead of consolidating
   * what was already open. Two introductions per session leaves room for the
   * spaced-repetition machinery to actually do its work.
   */
  /**
   * How much brand-new material a session may open.
   *
   * The governing principle, arrived at after three failed attempts at a fixed
   * cap: **do not introduce new material while existing material is
   * unconsolidated.** A constant budget cannot express that. At 2 new skills
   * per session a strong learner opened 24 skills over 12 days and mastered
   * ONE — the session became a tour of the curriculum. At 0 they stalled.
   *
   * So the budget is a function of how much work is already in flight. Skills
   * below mastery that the learner has actually started are "open"; while
   * several are open, the scheduler consolidates instead of expanding.
   */
  // "Open" means genuinely UNCONSOLIDATED, not merely short of 0.85.
  //
  // docs/21 · F5, the deepest cause. A skill with no recall-bearing evidence is
  // capped at RECOGNITION_CEILING (0.80) by the anti-inflation guard, so it can
  // never reach MASTERED_THRESHOLD (0.85) and counted as "open" forever. Six
  // such skills permanently disabled new material: measured, 11 skills in 90
  // sessions, with a Class 4 learner never meeting times tables, division,
  // fractions or decimals in three months.
  //
  // A skill sitting at or above the ceiling is consolidated as far as the
  // current evidence *allows*; it is waiting for the interaction ladder, not
  // for more practice. Counting it as open confuses "not yet certified" with
  // "not yet learned", and starves the learner of curriculum to pay for it.
  const CONSOLIDATED = Math.min(MASTERED_THRESHOLD, RECOGNITION_CEILING);
  const openWork = focus.filter(f => {
    const e = estimates[f.skill];
    return e && e.attempts > 0 && e.value < CONSOLIDATED;
  }).length;
  //
  // docs/21 · F5. The `openWork >= 6 -> 0` rule is right in principle and was
  // deadlocking in practice. A skill counts as "open" while it is below
  // MASTERED_THRESHOLD (0.85), but a skill with no recall-bearing evidence is
  // capped at RECOGNITION_CEILING (0.80) — so for an average learner openWork
  // never fell back below 6, the fresh budget stayed at 0, and the curriculum
  // froze. Measured: 20 skills reached by day 60 and still 20 at day 365, with
  // a Class 4 learner never once meeting add.3digit, div.tables, frac.*, dec.*
  // or wordproblems in a full year of daily practice.
  //
  // The escape hatch keeps the consolidation rule but stops it becoming a
  // permanent stop: if nothing new has been introduced for a fortnight, open
  // exactly one skill regardless. Consolidation still dominates — one skill per
  // two weeks cannot flood a session — but the learner always keeps moving
  // through the curriculum.
  // The escape triggers on the FIRST SIGHTING of the most recently opened
  // skill, not on when it was last practised — a skill introduced months ago
  // and reviewed yesterday is not "recently introduced", and treating it as
  // such would keep the escape permanently disarmed, which is the deadlock it
  // exists to break.
  const STALL_DAYS = 14;
  let newestIntroduction = -Infinity;
  for (const e of Object.values(estimates)) {
    if (e.attempts > 0 && e.firstPracticed != null && e.firstPracticed > newestIntroduction) {
      newestIntroduction = e.firstPracticed;
    }
  }
  const stalled = (now - newestIntroduction) >= STALL_DAYS * DAY_MS;
  const freshBudget =
    openWork >= 6 ? (stalled ? 1 : 0)
    : openWork >= 3 ? 1
    : Math.max(1, Math.round(count * 0.20));
  const freshTarget = Math.min(fresh.length, freshBudget);

  // Introduce shallow skills first WITHIN the fresh pool, so the cap spends its
  // budget on foundations rather than on whatever happened to sort first. This
  // pairs with the depth-based priority in scheduleSkills: that decides the
  // order across the whole ranking, this decides it inside the new-material
  // budget once the ranking has been split into pools.
  //
  // Cap the number of DISTINCT new skills one session may open.
  //
  // docs/21 · F5, the actual root cause. On a blank slate there is nothing to
  // consolidate, so the fallback branch below filled all 10 slots from the
  // fresh pool — opening TEN new skills in a child's very first session. That
  // is poor teaching on its own, but it also pinned `openWork` at 10
  // permanently, which drove the fresh budget to 0 and froze the curriculum:
  // measured, a Class 4 learner still had not met times tables after 30
  // sessions, and reached only 16 skills in a year.
  //
  // Bounding the distinct count means the fallback REPEATS the few skills just
  // opened rather than opening more — which is what "consolidate" is supposed
  // to mean. A first session becomes 3 topics practised properly instead of 10
  // met once.
  // The cap must RELAX when there is little else to practise. With one focus
  // skill and eight maintenance skills, a hard cap of 3 forced seven of ten
  // slots onto a single skill — turning "consolidate" into "drill". The pool
  // needs enough distinct material to fill the session sensibly: whatever the
  // focus and maintenance pools cannot cover, the fresh pool may.
  const otherSupply = focus.length + secure.length;
  const maxDistinctNew = Math.max(
    Math.max(1, Math.ceil(count * 0.3)),
    Math.ceil((count - otherSupply) / 3),
  );
  const freshOrdered = [...fresh]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxDistinctNew);

  // Bounded above by OVER_PRACTICE_CAP: ceiling effects waste session time that
  // belongs to the frontier. A skill above 0.90 is not learning, it is
  // confirming.
  const maintainTarget = secure.length > 0
    ? Math.min(Math.floor(count * OVER_PRACTICE_CAP), Math.max(1, Math.round(count * 0.15)))
    : 0;

  let fi = 0, mi = 0, ni = 0;
  const take = (pool: ScheduledSkill[], cursor: number) => pool[cursor % pool.length];

  /**
   * Weighted rotation over the focus pool.
   *
   * Plain round-robin gives every focus skill an equal share, so `priority`
   * ordered the pool but never changed how often anything appeared. That was
   * tolerable with ~27 candidate skills and became a real weakness at 45: a
   * learner's single weakest skill was practised no more than a skill they were
   * merely due to review, which is the opposite of the intent.
   *
   * The front of the pool is revisited more often, in proportion to priority,
   * while every focus skill still appears — concentration without exclusion.
   */
  const weightedFocus: ScheduledSkill[] = [];
  for (const s of focus) {
    // Weight by how far BELOW mastery the skill actually is, not by its
    // priority rank. Ranking is dominated by `reason` (a gap always outranks a
    // due review), so weighting by rank amplified whichever category sorted
    // first rather than whichever skill the learner was worst at — measured at
    // 34% concentration, worse than the 63% of plain round-robin.
    const e = estimates[s.skill];
    const value = e && e.attempts > 0 ? e.value : 0.5;
    const weakness = Math.max(0, MASTERED_THRESHOLD - value) / MASTERED_THRESHOLD;
    // 1–5 slots. Tuned by simulation: at 1–3 the weakest skill reached the
    // session's top five only 41% of the time once the curriculum grew to 45
    // skills, which is not "concentrates practice on the weak skill" in any
    // meaningful sense. The success floor still dilutes this when the projected
    // success rate would collapse, so concentration cannot become punishment.
    const reps = 1 + Math.round(weakness * 4);
    for (let r = 0; r < reps; r++) weightedFocus.push(s);
  }

  for (let i = 0; i < count; i++) {
    const takenFocus    = session.filter(s => focus.includes(s)).length;
    const takenMaintain = session.filter(s => secure.includes(s)).length;

    if (takenFocus < focusTarget && focus.length > 0) {
      session.push(take(weightedFocus, fi++));
    } else if (takenMaintain < maintainTarget && secure.length > 0) {
      session.push(take(secure, mi++));
    } else if (fresh.length > 0 && session.filter(x => fresh.includes(x)).length < freshTarget) {
      session.push(take(freshOrdered, ni++));
    } else if (focus.length > 0) {
      // Consolidate before expanding. Repeating work already in progress is
      // what turns exposure into mastery.
      session.push(take(weightedFocus, fi++));
    } else if (fresh.length > 0) {
      // Nothing left to consolidate: unseen material outranks drilling
      // something already secure, or a learner who has mastered everything
      // they have met would spend the session confirming it (measured: 16 of
      // 20 slots on two mastered skills, 80% over-practice against a 25% cap).
      session.push(take(freshOrdered, ni++));
    } else if (secure.length > 0) {
      session.push(take(secure, mi++));
    } else {
      break;
    }
  }

  return shuffleLight(applySuccessFloor(session, ranked, estimates, count));
}

/** Expected proportion of a planned session the learner will answer correctly. */
export function projectedSuccess(
  session: ScheduledSkill[],
  estimates: Record<SkillId, MasteryEstimate>,
): number {
  if (session.length === 0) return 1;
  const total = session.reduce((sum, s) => {
    const e = estimates[s.skill];
    // An unattempted skill sits at the 0.5 prior, which is the honest guess.
    return sum + (e && e.attempts > 0 ? e.value : 0.5);
  }, 0);
  return total / session.length;
}

/**
 * M1 · Success floor.
 *
 * Repeatedly swap the single hardest item for the most secure alternative until
 * the projected success rate clears the floor. Swapping the *weakest* item each
 * time is deliberate: it removes the most damaging question in the session,
 * while leaving the rest of the remediation intact.
 *
 * The weak skill is diluted, never removed — the learner still meets it, and
 * mastery still reports honestly. What changes is that they also answer enough
 * questions correctly to stay in the session at all.
 */
export function applySuccessFloor(
  session: ScheduledSkill[],
  ranked: ScheduledSkill[],
  estimates: Record<SkillId, MasteryEstimate>,
  count: number,
): ScheduledSkill[] {
  if (session.length === 0) return session;

  const valueOf = (s: ScheduledSkill) => {
    const e = estimates[s.skill];
    return e && e.attempts > 0 ? e.value : 0.5;
  };

  // Candidates to swap in, most secure first. Prerequisites of the failing
  // skill are the pedagogically correct filler, and they rank high here
  // naturally because a prerequisite is by definition more secure than the
  // skill built on it — if it were not, it would be the gap.
  const relief = [...ranked].sort((a, b) => valueOf(b) - valueOf(a));
  if (relief.length === 0) return session;

  const out = [...session];
  // Bounded: at most half the session may be replaced, so remediation survives.
  const maxSwaps = Math.floor(count * MAX_DILUTION_RATIO);
  let swaps = 0;
  let reliefCursor = 0;

  /** Occurrences of each skill currently in the plan. */
  const occurrences = new Map<SkillId, number>();
  for (const s of out) occurrences.set(s.skill, (occurrences.get(s.skill) ?? 0) + 1);

  while (projectedSuccess(out, estimates) < SESSION_SUCCESS_FLOOR && swaps < maxSwaps) {
    // Hardest remaining item that is *not* the last copy of its skill.
    //
    // This guard is what makes the floor a dilution rather than an avoidance
    // mechanism. Without it the scheduler quietly stops showing a child the one
    // thing they most need to practise, which is a far worse failure than the
    // low success rate it was introduced to fix — the app would look like it
    // was working while silently abandoning the learner's actual gap.
    let worstIdx = -1;
    for (let i = 0; i < out.length; i++) {
      if ((occurrences.get(out[i].skill) ?? 0) <= 1) continue;
      // A `gap` item is a weak skill that *blocks other skills*. It is the
      // highest-value question in the session and the reason the session was
      // scheduled this way at all. Diluting around it is correct; removing it
      // to flatter the success projection defeats the purpose.
      if (out[i].reason === 'gap') continue;
      if (worstIdx === -1 || valueOf(out[i]) < valueOf(out[worstIdx])) worstIdx = i;
    }
    if (worstIdx === -1) break;   // nothing left that may legitimately be swapped

    // Spread relief across distinct skills rather than repeating the single
    // most secure one, which would trade a demoralising session for a boring.
    const replacement = relief[reliefCursor % relief.length];
    reliefCursor++;
    // No relief available that is actually easier — the learner is weak across
    // the board, and swapping would achieve nothing but churn.
    if (valueOf(replacement) <= valueOf(out[worstIdx])) {
      if (reliefCursor >= relief.length) break;
      continue;
    }

    occurrences.set(out[worstIdx].skill, (occurrences.get(out[worstIdx].skill) ?? 1) - 1);
    occurrences.set(replacement.skill, (occurrences.get(replacement.skill) ?? 0) + 1);
    out[worstIdx] = { ...replacement, difficulty: 'easy' };
    swaps++;
  }

  return out;
}

/**
 * Shuffle while avoiding three identical skills in a row, so a session feels
 * varied without losing the intended composition.
 */
function shuffleLight(items: ScheduledSkill[]): ScheduledSkill[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  for (let i = 2; i < a.length; i++) {
    if (a[i].skill === a[i - 1].skill && a[i].skill === a[i - 2].skill) {
      const swap = a.findIndex(x => x.skill !== a[i].skill);
      if (swap >= 0) [a[i], a[swap]] = [a[swap], a[i]];
    }
  }
  return a;
}

/** Category to practise a skill through — used to drive the generators. */
export function categoryForSkill(skill: SkillId): Category {
  return SKILLS[skill]?.category ?? 'addition';
}
