// ─── Chapter graph ───────────────────────────────────────────────────────────
// docs/16 §7 and Phase D.
//
// The structural decision, restated because everything here depends on it:
//
//   **Chapters unlock on MASTERY, never on XP.**
//
// XP is an effort currency. Gating content on effort means a child who grinds
// enough easy questions unlocks material they cannot do — precisely the failure
// the whole progression design exists to prevent. Mastery gating asks the only
// question that matters: *are you ready?*
//
// Chapters are a view over the existing skill DAG rather than a parallel
// structure. Adding a skill to `learning/skills.ts` and naming it here is the
// whole cost of extending the curriculum.

import type { SkillId } from '../learning/skills';
import { SKILLS } from '../learning/skills';
import type { SchoolClass } from '../generators/types';

export type ChapterKind = 'core' | 'review' | 'challenge';

export interface Chapter {
  id: string;
  title: { en: string; hi: string };
  kind: ChapterKind;
  skills: SkillId[];
  /** Chapters whose skills must be secure before this opens. */
  prerequisites: string[];
  /** Earliest class this chapter is offered. */
  introducedIn: SchoolClass;
}

/** Mean mastery over prerequisite chapters required to unlock. */
export const CHAPTER_UNLOCK_MASTERY = 0.70;
/** Every skill must reach this for the chapter to count as complete. */
export const CHAPTER_COMPLETE_MASTERY = 0.85;
/** Challenge chapters require this to ENTER (not to complete). */
export const CHALLENGE_ENTRY_MASTERY = 0.88;
/** A review chapter surfaces when a previously-secure skill slips below this. */
export const REVIEW_TRIGGER_MASTERY = 0.70;

export const CHAPTERS: Chapter[] = [
  {
    id: 'counting',
    title: { en: 'Counting and Comparing', hi: 'गिनती और तुलना' },
    kind: 'core', introducedIn: '1st', prerequisites: [],
    skills: ['count.objects', 'count.skip', 'numsense.compare'],
  },
  {
    id: 'first-sums',
    title: { en: 'First Sums', hi: 'पहले जोड़-घटाव' },
    kind: 'core', introducedIn: '1st', prerequisites: ['counting'],
    skills: ['add.within10', 'add.within20', 'sub.within10', 'sub.within20'],
  },
  {
    id: 'shapes-time-money',
    title: { en: 'Shapes, Time and Money', hi: 'आकार, समय और पैसे' },
    kind: 'core', introducedIn: '1st', prerequisites: [],
    skills: ['shapes.basic', 'time.basic', 'money.basic'],
  },
  {
    id: 'place-value',
    title: { en: 'Tens and Ones', hi: 'दहाई और इकाई' },
    kind: 'core', introducedIn: '2nd', prerequisites: ['counting'],
    skills: ['placevalue', 'measurement.length', 'measurement.mass', 'measurement.capacity'],
  },
  {
    id: 'carrying',
    title: { en: 'Carrying and Borrowing', hi: 'हासिल और उधार' },
    kind: 'core', introducedIn: '2nd', prerequisites: ['first-sums', 'place-value'],
    skills: ['add.2digit.nocarry', 'add.2digit.carry', 'sub.2digit.noborrow', 'sub.2digit.borrow'],
  },
  {
    id: 'tables',
    title: { en: 'Times Tables', hi: 'पहाड़े' },
    kind: 'core', introducedIn: '2nd', prerequisites: ['first-sums'],
    skills: ['mul.tables.easy', 'mul.tables.mid', 'mul.tables.full'],
  },
  {
    // docs/27 P2-05/P2-06. The Singapore part-whole spine, and the meaning of
    // `=`. Its own chapter rather than folded into addition because these are
    // relationships to see, not sums to perform — and because a child who
    // reads `=` as "write the answer" needs that named as a topic, not buried.
    id: 'part-whole',
    title: { en: 'Parts and Wholes', hi: 'भाग और पूर्ण' },
    kind: 'core', introducedIn: '1st', prerequisites: ['counting'],
    skills: ['bonds.basic', 'equality.balance'],
  },
  {
    id: 'number-sense',
    title: { en: 'Number Sense', hi: 'संख्या ज्ञान' },
    kind: 'core', introducedIn: '2nd', prerequisites: ['counting'],
    skills: ['numsense.estimate', 'numsense.reasonable', 'patterns.basic', 'rounding.decide'],
  },
  {
    id: 'sharing',
    title: { en: 'Sharing and Dividing', hi: 'बाँटना और भाग' },
    kind: 'core', introducedIn: '3rd', prerequisites: ['tables'],
    skills: ['div.basic', 'div.tables', 'inverse.basic'],
  },
  {
    id: 'bigger-numbers',
    title: { en: 'Bigger Numbers', hi: 'बड़ी संख्याएँ' },
    kind: 'core', introducedIn: '3rd', prerequisites: ['carrying'],
    skills: ['add.3digit', 'sub.3digit'],
  },
  {
    id: 'fractions',
    title: { en: 'Fractions', hi: 'भिन्न' },
    kind: 'core', introducedIn: '3rd', prerequisites: ['sharing'],
    skills: ['frac.ofAmount', 'frac.numberline', 'frac.compare', 'frac.equivalence', 'frac.addSameDenom'],
  },
  {
    id: 'geometry',
    title: { en: 'Shape and Space', hi: 'आकृति और स्थान' },
    kind: 'core', introducedIn: '3rd', prerequisites: ['shapes-time-money', 'tables'],
    skills: ['geometry.area', 'geometry.perimeter', 'geometry.angles', 'geometry.volume', 'symmetry.basic'],
  },
  {
    id: 'decimals',
    title: { en: 'Decimals', hi: 'दशमलव' },
    kind: 'core', introducedIn: '4th', prerequisites: ['place-value', 'fractions'],
    skills: ['dec.tenths', 'dec.hundredths'],
  },
  {
    id: 'long-methods',
    title: { en: 'Long Multiplication and Division', hi: 'बड़ी गुणा और भाग' },
    kind: 'core', introducedIn: '4th', prerequisites: ['tables', 'sharing'],
    skills: ['mul.2digit', 'mul.large', 'div.large', 'add.large', 'sub.large'],
  },
  {
    id: 'factors',
    title: { en: 'Factors and Primes', hi: 'गुणनखंड और अभाज्य' },
    kind: 'core', introducedIn: '4th', prerequisites: ['tables'],
    skills: ['factors.basic'],
  },
  {
    id: 'word-problems',
    title: { en: 'Word Problems', hi: 'शब्द समस्याएँ' },
    kind: 'core', introducedIn: '3rd', prerequisites: ['carrying', 'tables', 'number-sense'],
    skills: ['wordproblems', 'compare.multiplicative'],
  },
  {
    id: 'proportion',
    title: { en: 'Percentages and Ratio', hi: 'प्रतिशत और अनुपात' },
    kind: 'core', introducedIn: '5th', prerequisites: ['fractions', 'decimals'],
    skills: ['percent.basic', 'ratio.basic'],
  },
  {
    id: 'data',
    title: { en: 'Data and Averages', hi: 'आँकड़े और औसत' },
    kind: 'core', introducedIn: '5th', prerequisites: ['sharing'],
    skills: ['data.mean', 'data.median', 'data.mode', 'data.range'],
  },
  {
    id: 'integers-algebra',
    title: { en: 'Integers and Algebra', hi: 'पूर्णांक और बीजगणित' },
    kind: 'core', introducedIn: '6th', prerequisites: ['bigger-numbers', 'number-sense'],
    skills: ['integers.basic', 'algebra.basic'],
  },
];

export const CHAPTER_BY_ID: Record<string, Chapter> =
  Object.fromEntries(CHAPTERS.map(c => [c.id, c]));

const CLASS_ORDER: SchoolClass[] = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
const classNum = (c: SchoolClass) => CLASS_ORDER.indexOf(c) + 1;

export type ChapterStatus = 'locked' | 'available' | 'inProgress' | 'complete';

/**
 * Mean mastery over a chapter's skills, for UNLOCK decisions.
 *
 * docs/21 · F3, defence-in-depth. Treating an unpractised skill as 0 conflates
 * "the learner is bad at this" with "the learner has never been offered this",
 * and only the first should hold a gate shut. When one skill in a three-skill
 * chapter could never be scheduled, the chapter was capped at mean 0.67 against
 * a 0.70 gate and every descendant locked permanently — for every learner.
 *
 * The scheduler fix makes that specific orphan impossible, but the gate should
 * not be one lookup-table omission away from freezing the curriculum again. So
 * unlock readiness is judged on the evidence that EXISTS: skills the learner
 * has actually met. A chapter whose skills are all unmet returns 0 and stays
 * shut, which is correct — that is a learner who has not started, not one being
 * silently blocked.
 *
 * Completion deliberately still requires every skill (see `chapterStatus`):
 * you cannot finish a chapter by never meeting half of it.
 */
function unlockMastery(skills: SkillId[], mastery: Record<SkillId, number>): number {
  if (skills.length === 0) return 1;
  const met = skills.filter(k => mastery[k] !== undefined);
  if (met.length === 0) return 0;
  return met.reduce((s, k) => s + (mastery[k] ?? 0), 0) / met.length;
}

function meanMastery(skills: SkillId[], mastery: Record<SkillId, number>): number {
  if (skills.length === 0) return 1;
  return skills.reduce((s, k) => s + (mastery[k] ?? 0), 0) / skills.length;
}

export function chapterProgress(ch: Chapter, mastery: Record<SkillId, number>): number {
  return meanMastery(ch.skills, mastery);
}

export function chapterStatus(
  ch: Chapter,
  mastery: Record<SkillId, number>,
  cls: SchoolClass,
): ChapterStatus {
  // Class is a floor, not a ceiling: a Class 3 child may still be working on
  // Class 1 material, and locking it would strand them.
  if (classNum(ch.introducedIn) > classNum(cls)) return 'locked';

  const ready = ch.prerequisites.every(
    pid => !CHAPTER_BY_ID[pid] || unlockMastery(CHAPTER_BY_ID[pid].skills, mastery) >= CHAPTER_UNLOCK_MASTERY,
  );
  if (!ready) return 'locked';

  if (ch.skills.every(s => (mastery[s] ?? 0) >= CHAPTER_COMPLETE_MASTERY)) return 'complete';
  if (ch.skills.some(s => (mastery[s] ?? 0) > 0)) return 'inProgress';
  return 'available';
}

/**
 * Review chapters are GENERATED from decay, not authored.
 *
 * A review chapter appears when skills the learner had secured have slipped.
 * That makes revision a living part of the map rather than an optional section
 * nobody opens.
 */
export function dueReviewChapters(
  mastery: Record<SkillId, number>,
  everMastered: Record<SkillId, boolean>,
  cls: SchoolClass,
): Chapter[] {
  return CHAPTERS
    .filter(ch => classNum(ch.introducedIn) <= classNum(cls))
    .map(ch => ({
      ...ch,
      kind: 'review' as const,
      id: `review-${ch.id}`,
      skills: ch.skills.filter(s => everMastered[s] && (mastery[s] ?? 1) < REVIEW_TRIGGER_MASTERY),
    }))
    .filter(ch => ch.skills.length > 0);
}

/** Chapters a learner can enter right now, most relevant first. */
export function availableChapters(
  mastery: Record<SkillId, number>,
  cls: SchoolClass,
): Chapter[] {
  return CHAPTERS
    .filter(ch => {
      const st = chapterStatus(ch, mastery, cls);
      return st === 'available' || st === 'inProgress';
    })
    .sort((a, b) => chapterProgress(b, mastery) - chapterProgress(a, mastery));
}

/** Every skill named by a chapter must exist — guarded by tests. */
export function orphanSkills(): SkillId[] {
  const named = new Set(CHAPTERS.flatMap(c => c.skills));
  return Object.keys(SKILLS).filter(s => !named.has(s));
}
