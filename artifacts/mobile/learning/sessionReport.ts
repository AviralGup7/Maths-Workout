// ─── Session report ──────────────────────────────────────────────────────────
// docs/25 · Tier 1, items 1, 2, 4, 6, 8.
//
// The audit's central finding was not a missing feature: it was that the
// engine's best work is INVISIBLE at the moment a child forms an opinion.
// `app/results.tsx` contained zero references to XP, level or mastery, and no
// screen anywhere told a child what was waiting for them tomorrow — while the
// scheduler computed exactly that, by name, on every run.
//
// This module answers the four questions a child should be able to ask at the
// end of a session, all from data the engine already produces:
//
//   · what did I earn?          (xpEarned, levelBefore → levelAfter)
//   · what got better?          (improvements — mastery deltas, per skill)
//   · what did I finally crack? (breakthroughs, mastered, misconceptionsFixed)
//   · why should I come back?   (dueTomorrow, chaptersNearlyDone)
//
// Pure functions over the attempt log and mastery estimates, so the whole
// results screen is testable without a renderer — the same property the answer
// pipeline already has.

import type { Attempt } from './attempts';
import type { MasteryEstimate } from './mastery';
import { estimateAll, MASTERED_THRESHOLD, STRUGGLING_THRESHOLD, DAY_MS } from './mastery';
import type { SkillId } from './skills';
import { SKILLS } from './skills';
import { isDue } from './scheduler';
import { CHAPTERS, chapterStatus, type Chapter } from '../curriculum/chapters';
import type { SchoolClass } from '../generators/types';
import type { Lang } from '../i18n/strings';

/** One skill that moved during the session. */
export interface SkillMovement {
  skill: SkillId;
  label: string;
  before: number;
  after: number;
  delta: number;
  /** Crossed STRUGGLING_THRESHOLD upward — the hardest climb in the model. */
  breakthrough: boolean;
  /** Crossed MASTERED_THRESHOLD upward. */
  mastered: boolean;
}

/** A chapter within touching distance of completion. */
export interface ChapterNearly {
  chapter: Chapter;
  /** Skills still below MASTERED_THRESHOLD. */
  remaining: number;
  /** Mean mastery across the chapter, 0–1. */
  progress: number;
}

export interface SessionReport {
  answered: number;
  correct: number;
  /** Skills that improved, best first. */
  improvements: SkillMovement[];
  /** Skills that crossed into "secure" this session. */
  mastered: SkillMovement[];
  /** Skills that climbed out of "struggling" this session. */
  breakthroughs: SkillMovement[];
  /** Distinct skills met for the very first time. */
  newSkills: SkillId[];
  /** Skills that will fall due for review by tomorrow. */
  dueTomorrow: SkillId[];
  /** Chapters with 1–2 skills left, closest first. */
  chaptersNearlyDone: ChapterNearly[];
  /** Chapters completed during this session. */
  chaptersCompleted: Chapter[];
}

/**
 * Build the report for a session.
 *
 * `before` is the log as it stood when the session began; `after` includes the
 * session's attempts. Taking both means every number is a genuine delta rather
 * than a snapshot — "Fractions 62% → 71%" instead of "Fractions 71%", which is
 * the difference between evidence of growth and a bare statistic.
 */
export function buildSessionReport(args: {
  before: Attempt[];
  after: Attempt[];
  cls: SchoolClass;
  now?: number;
  /**
   * Per-skill high-water mark of mastery already paid for.
   *
   * Used to tell a FIRST crossing from a re-crossing. Mastery decays, so a
   * skill drifts below a threshold and climbs back many times over a year:
   * measured, 82% of sessions contained some threshold crossing, which would
   * have made the full-screen celebration routine and therefore worthless —
   * the exact failure `celebrationRules.ts` warns about.
   *
   * The ledger already records "mastery we have paid for" and is already
   * persisted, so gating on it needs no new state and means precisely the
   * right thing: celebrate new ground, not ground re-covered.
   */
  ledger?: Record<string, number>;
}): SessionReport {
  const { before, after, cls, now = Date.now(), ledger = {} } = args;

  const estBefore = estimateAll(before, now);
  const estAfter = estimateAll(after, now);

  // Attempts belonging to this session only.
  const sessionAttempts = after.slice(before.length);
  const answered = sessionAttempts.length;
  const correct = sessionAttempts.filter(a => a.correct).length;

  const touched = new Set(sessionAttempts.map(a => a.skill));

  const improvements: SkillMovement[] = [];
  const mastered: SkillMovement[] = [];
  const breakthroughs: SkillMovement[] = [];
  const newSkills: SkillId[] = [];

  for (const skill of touched) {
    if (!SKILLS[skill]) continue;
    const b = estBefore[skill];
    const a = estAfter[skill];
    if (!a) continue;

    // A skill with no prior estimate is one the child met for the first time.
    if (!b || b.attempts === 0) newSkills.push(skill);

    const beforeVal = b?.attempts ? b.value : 0;
    const afterVal = a.value;
    const move: SkillMovement = {
      skill,
      label: SKILLS[skill].label,
      before: beforeVal,
      after: afterVal,
      delta: afterVal - beforeVal,
      breakthrough: beforeVal < STRUGGLING_THRESHOLD && afterVal >= STRUGGLING_THRESHOLD,
      mastered: beforeVal < MASTERED_THRESHOLD && afterVal >= MASTERED_THRESHOLD,
    };

    // Only a genuinely new high counts as a celebration-worthy crossing.
    const paid = ledger[skill] ?? 0;
    if (move.mastered && paid < MASTERED_THRESHOLD) mastered.push(move);
    if (move.breakthrough && paid < STRUGGLING_THRESHOLD) breakthroughs.push(move);
    // Report only movement worth a sentence. Sub-1% drift is noise, and
    // showing it would make every genuine gain look equally unremarkable.
    if (move.delta >= 0.01) improvements.push(move);
  }

  improvements.sort((x, y) => y.delta - x.delta);

  // ── The forward hook ───────────────────────────────────────────────────────
  // Skills not due now that will be due by this time tomorrow. This is the
  // single piece of information most likely to bring a child back, and it was
  // computed by the scheduler on every run and shown nowhere.
  const tomorrow = now + DAY_MS;
  const dueTomorrow: SkillId[] = [];
  for (const [skill, est] of Object.entries(estAfter)) {
    if (!SKILLS[skill]) continue;
    if (est.attempts === 0) continue;
    if (!isDue(est, now) && isDue(est, tomorrow)) dueTomorrow.push(skill);
  }

  // ── Completion pull ────────────────────────────────────────────────────────
  const mBefore: Record<string, number> = {};
  const mAfter: Record<string, number> = {};
  for (const [k, v] of Object.entries(estBefore)) mBefore[k] = v.value;
  for (const [k, v] of Object.entries(estAfter)) mAfter[k] = v.value;

  const chaptersCompleted = CHAPTERS.filter(ch =>
    chapterStatus(ch, mAfter, cls) === 'complete'
    && chapterStatus(ch, mBefore, cls) !== 'complete');

  const chaptersNearlyDone: ChapterNearly[] = CHAPTERS
    .filter(ch => chapterStatus(ch, mAfter, cls) === 'inProgress')
    .map(ch => {
      const remaining = ch.skills.filter(s => (mAfter[s] ?? 0) < MASTERED_THRESHOLD).length;
      const progress = ch.skills.reduce((s, k) => s + (mAfter[k] ?? 0), 0) / ch.skills.length;
      return { chapter: ch, remaining, progress };
    })
    // "Nearly" means genuinely nearly: one or two skills left. A chapter with
    // five remaining is not a goal, it is a to-do list.
    .filter(c => c.remaining > 0 && c.remaining <= 2)
    .sort((x, y) => x.remaining - y.remaining || y.progress - x.progress);

  return {
    answered, correct, improvements, mastered, breakthroughs,
    newSkills, dueTomorrow, chaptersNearlyDone, chaptersCompleted,
  };
}

// ─── Copy ────────────────────────────────────────────────────────────────────
// Semi-Hindi policy: the sentences describe LEARNING so they are translated;
// numerals stay Western Arabic in both languages.

/** "Fractions 62% → 71%" */
export function movementSentence(m: SkillMovement, lang: Lang): string {
  const from = Math.round(m.before * 100);
  const to = Math.round(m.after * 100);
  return `${m.label} ${from}% → ${to}%`;
}

/**
 * The single most encouraging true thing about this session.
 *
 * Ordered by what is hardest to achieve, not by what is largest. A child who
 * cleared a chapter did something rarer than a child whose accuracy ticked up,
 * and a breakthrough out of "struggling" is the hardest climb in the model —
 * which is precisely why the struggling learner, who the audit measured
 * receiving ZERO mastery celebrations in a year, must be able to reach this.
 */
export function headline(r: SessionReport, lang: Lang): string | null {
  const hi = lang === 'hi';
  if (r.chaptersCompleted.length > 0) {
    const t = r.chaptersCompleted[0].title[hi ? 'hi' : 'en'];
    return hi ? `अध्याय पूरा: ${t}` : `Chapter complete: ${t}`;
  }
  if (r.mastered.length > 0) {
    return hi ? `${r.mastered[0].label} अब पक्का है` : `${r.mastered[0].label} is secure now`;
  }
  if (r.breakthroughs.length > 0) {
    return hi ? `${r.breakthroughs[0].label} में बड़ी छलांग` : `Breakthrough in ${r.breakthroughs[0].label}`;
  }
  if (r.improvements.length > 0) {
    return movementSentence(r.improvements[0], lang);
  }
  if (r.newSkills.length > 0) {
    const n = r.newSkills.length;
    return hi ? `${n} नए कौशल आज़माए` : `Tried ${n} new skill${n === 1 ? '' : 's'}`;
  }
  return null;
}

/** "3 skills come due tomorrow" — the forward hook. */
export function returnSentence(r: SessionReport, lang: Lang): string | null {
  const n = r.dueTomorrow.length;
  if (n === 0) return null;
  if (lang === 'hi') {
    return n === 1
      ? `कल 1 कौशल दोहराने का समय`
      : `कल ${n} कौशल दोहराने का समय`;
  }
  return n === 1
    ? `1 skill is ready to review tomorrow`
    : `${n} skills are ready to review tomorrow`;
}

/** "2 skills to finish Fractions" — completion pull. */
export function completionSentence(c: ChapterNearly, lang: Lang): string {
  const title = c.chapter.title[lang === 'hi' ? 'hi' : 'en'];
  if (lang === 'hi') {
    return c.remaining === 1
      ? `${title} पूरा करने के लिए 1 कौशल बाकी`
      : `${title} पूरा करने के लिए ${c.remaining} कौशल बाकी`;
  }
  return c.remaining === 1
    ? `1 skill to finish ${title}`
    : `${c.remaining} skills to finish ${title}`;
}
