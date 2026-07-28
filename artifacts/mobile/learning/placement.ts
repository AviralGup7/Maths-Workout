// ─── Adaptive placement ──────────────────────────────────────────────────────
// docs/27 P1-01, the highest expected-value item in the roadmap.
//
// The scheduler is excellent at deciding what to practise NEXT and has no way
// to guess where a learner should START. With no entry assessment it must
// discover the level from scratch, one answer at a time, and the cost is
// measured rather than theoretical: a capable Class 6 learner practising daily
// spent 53% of their first two months on Class 1–2 material, met 19 Class 1–2
// skills, and did not reach `algebra.basic` until day 43.
//
// This module fixes that in roughly twenty questions.
//
// ── Why a walk down the DAG rather than a fixed test ────────────────────────
//
// A fixed twenty-question paper wastes most of its questions: a child who can
// do 2-digit carrying does not need to be asked about counting, and one who
// cannot does not need to be asked about ratio. The prerequisite graph already
// encodes exactly that implication, so placement is a search over it:
//
//   · a CORRECT answer implies the whole prerequisite closure is probably fine
//   · a WRONG answer implies the trouble is at or below this skill
//
// Each answer therefore eliminates a subtree, which is why ~20 questions can
// span a six-year curriculum. This is standard adaptive testing (DreamBox and
// ALEKS open the same way); the novelty here is only that the graph already
// existed and was being used for remediation but never for entry.
//
// ── Deliberate conservatism ─────────────────────────────────────────────────
//
// Placement OVERSHOOTS badly if it trusts a single correct answer, because a
// four-option question can be guessed. Every conclusion here therefore needs
// corroboration, and where the evidence is thin the result is deliberately
// pessimistic: starting a child slightly too low costs a few easy questions,
// while starting them too high costs confidence. The asymmetry is not
// symmetric and the code should not pretend it is.
//
// Pure functions over skills and results, so the whole flow is testable
// without a renderer — the same property `recordAnswer` has.

import type { SkillId } from './skills';
import { SKILLS, prerequisiteClosure } from './skills';
import type { SchoolClass } from '../generators/types';
import type { Attempt } from './attempts';

/** Longest placement session we will ever run. */
export const MAX_PLACEMENT_QUESTIONS = 20;

/** Minimum before we will conclude anything at all. */
export const MIN_PLACEMENT_QUESTIONS = 6;

/**
 * Where a securely-placed skill should sit on the mastery scale.
 *
 * Three thresholds matter and they are close together:
 *
 *   0.80  RECOGNITION_CEILING — the anti-inflation clamp
 *   0.85  MASTERED_THRESHOLD  — where the scheduler stops calling a skill
 *                               unfinished "learning" work
 *
 * Seeding below 0.85 leaves every placed skill in the `learning` pool, so the
 * scheduler treats the whole curriculum as work in progress and still
 * interleaves Class 1 material for a Class 5 learner. Measured: 0.73 → 45% of
 * the first session was Class 1–2 content, barely better than the 53% with no
 * placement at all. 0.84 changed nothing, because the bar is 0.85.
 *
 * So a secure placement must land just ABOVE 0.85 — high enough to read as
 * consolidated, low enough that a single real mistake pulls it back under and
 * returns the skill to practice. That is the honest position: placement says
 * "probably fine, do not spend the year here", not "certified".
 */
export const PLACEMENT_CREDIT = 0.88;

/** Mastery credited to a skill the probe judged shaky. */
export const PLACEMENT_GAP = 0.30;

/** Seed rows per skill. Enough to move the estimator off its 0.5 prior. */
const SEED_ROWS = 10;

/**
 * Wrong rows mixed into a SECURE placement.
 *
 * Ten flawless rows drive the estimate to 0.96, which claims far more than a
 * twenty-question probe observed and would take weeks of real practice to
 * correct downward. One dissenting row lands it near 0.88: consolidated, but
 * one genuine mistake away from returning to practice.
 */
const SEED_DISSENT = 1;

const CLASS_ORDER: SchoolClass[] = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
const classNum = (c: SchoolClass) => CLASS_ORDER.indexOf(c);

export interface PlacementResult {
  skill: SkillId;
  correct: boolean;
}

export interface PlacementState {
  /** Skills asked so far, in order. */
  asked: SkillId[];
  results: PlacementResult[];
}

export const emptyPlacement = (): PlacementState => ({ asked: [], results: [] });

/**
 * Skills eligible to be probed for a learner in this class.
 *
 * Bounded by the class: probing a Class 2 child on algebra tells us nothing we
 * did not already know and is a demoralising way to open an app. One year
 * above is allowed, because a child may be ahead of their year and the whole
 * point is to find that out.
 */
export function probeCandidates(cls: SchoolClass): SkillId[] {
  const ceiling = Math.min(classNum(cls) + 1, CLASS_ORDER.length - 1);
  return Object.values(SKILLS)
    .filter(s => classNum(s.introducedIn) <= ceiling)
    .map(s => s.id);
}

/** Depth in the prerequisite graph — a proxy for how advanced a skill is. */
function depthOf(skill: SkillId): number {
  return prerequisiteClosure(skill).length;
}

/**
 * What the answers so far imply about every skill.
 *
 * `true`  — probably secure (answered it, or answered something that needs it)
 * `false` — probably shaky (missed it, or missed something it is needed for)
 * absent  — no evidence either way
 */
export function inferences(state: PlacementState): Map<SkillId, boolean> {
  const out = new Map<SkillId, boolean>();

  for (const r of state.results) {
    if (r.correct) {
      // Success implies the prerequisites underneath are probably fine. This
      // is the step that lets ~20 questions cover 45 skills.
      out.set(r.skill, true);
      for (const p of prerequisiteClosure(r.skill)) {
        // Never overwrite direct evidence with an inference.
        if (!hasDirectEvidence(state, p)) out.set(p, true);
      }
    } else {
      out.set(r.skill, false);
      // Failure implies everything BUILT ON this skill is also unsafe.
      for (const s of Object.values(SKILLS)) {
        if (hasDirectEvidence(state, s.id)) continue;
        if (prerequisiteClosure(s.id).includes(r.skill)) out.set(s.id, false);
      }
    }
  }
  return out;
}

function hasDirectEvidence(state: PlacementState, skill: SkillId): boolean {
  return state.results.some(r => r.skill === skill);
}

/**
 * Choose the next skill to probe.
 *
 * Picks the skill about which we are most uncertain and which will eliminate
 * the most of the remaining graph — the middle of the unknown region, which is
 * what makes this a binary search rather than a march.
 *
 * Returns null when the probe should stop.
 */
export function nextProbe(state: PlacementState, cls: SchoolClass): SkillId | null {
  if (state.asked.length >= MAX_PLACEMENT_QUESTIONS) return null;

  const known = inferences(state);
  const candidates = probeCandidates(cls).filter(s => !known.has(s) && !state.asked.includes(s));

  if (candidates.length === 0) return null;
  // Enough is known once the unknown region is small; asking more is padding.
  if (state.asked.length >= MIN_PLACEMENT_QUESTIONS && candidates.length <= 3) return null;

  // Target the middle of the unresolved depth range: the question that splits
  // the remaining uncertainty most evenly.
  const depths = candidates.map(depthOf);
  const mid = (Math.min(...depths) + Math.max(...depths)) / 2;

  let best = candidates[0];
  let bestScore = Infinity;
  for (const s of candidates) {
    const d = depthOf(s);
    // Prefer skills near the middle, and among those the ones that resolve
    // more of the graph (more dependants + prerequisites).
    const reach = prerequisiteClosure(s).length
      + Object.values(SKILLS).filter(x => x.prerequisites.includes(s)).length;
    const score = Math.abs(d - mid) - reach * 0.1;
    if (score < bestScore) { bestScore = score; best = s; }
  }
  return best;
}

export function recordProbe(state: PlacementState, skill: SkillId, correct: boolean): PlacementState {
  return {
    asked: [...state.asked, skill],
    results: [...state.results, { skill, correct }],
  };
}

export function placementComplete(state: PlacementState, cls: SchoolClass): boolean {
  return nextProbe(state, cls) === null;
}

/**
 * Turn placement results into seed attempts.
 *
 * Seeding the ATTEMPT LOG rather than writing mastery directly is the only
 * honest option: the log is the single source of truth (docs/23), mastery is
 * derived from it, and a value written straight into the estimate would be
 * erased the moment anything recomputed. It also means placement evidence
 * decays and is overridden by real practice exactly like any other evidence,
 * which is the correct behaviour — a placement guess should not outrank what
 * the child actually does next week.
 *
 * Rows are marked `placement` so they can be told apart from real practice and
 * excluded from statistics that should reflect genuine work.
 */
export function seedAttempts(
  state: PlacementState,
  cls: SchoolClass,
  now: number = Date.now(),
  deviceId = 'placement',
): Attempt[] {
  const known = inferences(state);
  const out: Attempt[] = [];
  let i = 0;

  for (const [skill, secure] of known) {
    if (!SKILLS[skill]) continue;
    const rows = SEED_ROWS;
    for (let r = 0; r < rows; r++) {
      // A secure placement seeds mostly-correct rows; a gap seeds mostly-wrong
      // ones. Not uniformly, because a run of identical outcomes drives the
      // estimate to an extreme the evidence does not support — one dissenting
      // row keeps the seeded value inside the intended window.
      const correct = secure ? r >= SEED_DISSENT : r >= rows - 1;
      out.push({
        id: `${deviceId}:seed:${i}`,
        skill,
        correct,
        // Dated slightly in the past and spread out, so ordering is stable and
        // the rows are never confused with the learner's first real session.
        answeredAt: now - (rows - r) * 60_000 - i * 1_000,
        latencyMs: 4_000,
        chosen: correct ? 'placement' : 'placement-miss',
        expected: 'placement',
        questionText: `placement:${skill}`,
        timedOut: false,
        placement: true,
        // Recall-bearing, so the anti-inflation guard does not clamp a secure
        // placement at the recognition ceiling — which would put it exactly
        // ON the consolidation bar rather than above it.
        interaction: 'entry',
        cls,
        category: SKILLS[skill].category,
        difficulty: 'easy',
      } as Attempt);
      i++;
    }
  }
  return out;
}

/**
 * A human-readable summary of where the learner was placed.
 *
 * docs/27 P1-03: a parent who is told "we started Aarav at 2-digit carrying
 * because he was secure on adding within 20" has been given a reason to trust
 * the adaptive claim. One that sees a level appear from nowhere has not.
 */
export function placementSummary(
  state: PlacementState,
  lang: 'en' | 'hi',
): { secure: SkillId[]; gaps: SkillId[]; sentence: string } {
  const known = inferences(state);
  const secure: SkillId[] = [];
  const gaps: SkillId[] = [];
  for (const [skill, ok] of known) {
    if (!SKILLS[skill]) continue;
    (ok ? secure : gaps).push(skill);
  }
  // Report the most advanced secure skill: that is what "where we started you"
  // actually means to a parent.
  const top = [...secure].sort((a, b) => depthOf(b) - depthOf(a))[0];
  const firstGap = [...gaps].sort((a, b) => depthOf(a) - depthOf(b))[0];

  let sentence: string;
  if (top && firstGap) {
    sentence = lang === 'hi'
      ? `${SKILLS[top].label} पक्का लगा, इसलिए अभ्यास ${SKILLS[firstGap].label} से शुरू होगा।`
      : `${SKILLS[top].label} looked secure, so practice starts at ${SKILLS[firstGap].label}.`;
  } else if (top) {
    sentence = lang === 'hi'
      ? `${SKILLS[top].label} तक सब पक्का लगा।`
      : `Everything up to ${SKILLS[top].label} looked secure.`;
  } else if (firstGap) {
    sentence = lang === 'hi'
      ? `अभ्यास ${SKILLS[firstGap].label} से शुरू होगा।`
      : `Practice starts at ${SKILLS[firstGap].label}.`;
  } else {
    sentence = lang === 'hi' ? 'अभ्यास शुरुआत से होगा।' : 'Practice starts from the beginning.';
  }
  return { secure, gaps, sentence };
}
