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
import { MASTERED_THRESHOLD, STRUGGLING_THRESHOLD, DAY_MS, isReady } from './mastery';
import type { Category, Difficulty, SchoolClass } from '../generators/types';
import { getAvailableCategories } from '../generators';
import type { Board } from '../curriculum/boards';
import { DEFAULT_BOARD } from '../curriculum/boards';

/**
 * Target success rate.
 *
 * Learning is fastest when a learner succeeds most of the time but not always —
 * high enough to stay motivated, low enough to be doing real work.
 */
export const TARGET_SUCCESS_LOW = 0.7;
export const TARGET_SUCCESS_HIGH = 0.85;

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

  const out: ScheduledSkill[] = [];

  for (const skill of candidates) {
    if (!SKILLS[skill]) continue;
    const est = estimates[skill];
    const difficulty = difficultyFor(est);

    // Never introduced and prerequisites unmet — hold it back.
    if (!est || est.attempts === 0) {
      if (!isReady(skill, estimates)) continue;
      out.push({ skill, priority: 40, reason: 'new', difficulty: 'easy' });
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
  const focusTarget    = focus.length  > 0 ? Math.max(1, Math.round(count * 0.70)) : 0;
  const maintainTarget = secure.length > 0 ? Math.max(1, Math.round(count * 0.15)) : 0;

  let fi = 0, mi = 0, ni = 0;
  const take = (pool: ScheduledSkill[], cursor: number) => pool[cursor % pool.length];

  for (let i = 0; i < count; i++) {
    const takenFocus    = session.filter(s => focus.includes(s)).length;
    const takenMaintain = session.filter(s => secure.includes(s)).length;

    if (takenFocus < focusTarget && focus.length > 0) {
      session.push(take(focus, fi++));
    } else if (takenMaintain < maintainTarget && secure.length > 0) {
      session.push(take(secure, mi++));
    } else if (fresh.length > 0) {
      session.push(take(fresh, ni++));
    } else if (focus.length > 0) {
      session.push(take(focus, fi++));
    } else if (secure.length > 0) {
      session.push(take(secure, mi++));
    } else {
      break;
    }
  }

  return shuffleLight(session);
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
