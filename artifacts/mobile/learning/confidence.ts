// ─── Confidence rating ───────────────────────────────────────────────────────
// docs/14 §5C.
//
// Asked ONCE per session, on ONE item. Confidence-accuracy quadrants are well
// established in metacognition research, but asking on every question doubles
// the interaction cost of the whole product for a signal that is only
// interesting in aggregate.
//
// The valuable cell is **confident-and-wrong**. A child who is unsure and wrong
// already knows something is missing and will accept correction. A child who is
// *certain* and wrong has no reason to revise, which makes it the hardest
// misconception to shift and the one most worth flagging.
//
// Deliberately NOT fed into the mastery estimate. Mastery must stay a claim
// about performance; mixing in self-report would make it uninterpretable and
// would let a confident child inflate their own score.

import type { Attempt } from './attempts';
import type { SkillId } from './skills';

export type Confidence = 'sure' | 'unsure';

export type ConfidenceQuadrant =
  /** Knows it, and knows they know. Nothing to do. */
  | 'confident-correct'
  /** The highest-value diagnostic state: no reason to revise. */
  | 'confident-wrong'
  /** Knows it but does not trust themselves — a fluency/anxiety signal. */
  | 'unsure-correct'
  /** Aware of the gap. Normal, healthy, and self-correcting. */
  | 'unsure-wrong';

export function quadrant(confidence: Confidence, correct: boolean): ConfidenceQuadrant {
  if (confidence === 'sure') return correct ? 'confident-correct' : 'confident-wrong';
  return correct ? 'unsure-correct' : 'unsure-wrong';
}

/**
 * Which question in the session should carry the prompt.
 *
 * Not the first — the child is still settling. Not the last — it collides with
 * the results screen. A deterministic middle position keeps sessions
 * comparable, and one prompt is a two-tap cost per session rather than per
 * question.
 */
export function confidenceIndexFor(sessionLength: number): number {
  if (sessionLength < 4) return -1;          // too short to be worth interrupting
  return Math.floor(sessionLength / 2);
}

export function shouldAskConfidence(index: number, sessionLength: number): boolean {
  return index === confidenceIndexFor(sessionLength);
}

/**
 * Skills where the learner has been confidently wrong.
 *
 * This is what the whole mechanism exists to produce: a shortlist for priority
 * remediation, because these are the beliefs a child will not revise on their
 * own.
 */
export interface ConfidenceFlag {
  skill: SkillId;
  occurrences: number;
  lastSeen: number;
}

export function confidentlyWrongSkills(
  records: { skill: SkillId; confidence: Confidence; correct: boolean; at: number }[],
): ConfidenceFlag[] {
  const bySkill = new Map<SkillId, ConfidenceFlag>();
  for (const r of records) {
    if (quadrant(r.confidence, r.correct) !== 'confident-wrong') continue;
    const existing = bySkill.get(r.skill);
    if (existing) {
      existing.occurrences += 1;
      existing.lastSeen = Math.max(existing.lastSeen, r.at);
    } else {
      bySkill.set(r.skill, { skill: r.skill, occurrences: 1, lastSeen: r.at });
    }
  }
  return [...bySkill.values()].sort((a, b) => b.occurrences - a.occurrences);
}

/**
 * Calibration: how well does the learner's self-assessment match reality?
 *
 * Returns −1 (systematically overconfident) to +1 (systematically
 * underconfident), with 0 being well calibrated. Reported to nobody by default
 * — it is a research signal, and telling a child they are overconfident would
 * be both unkind and counterproductive.
 */
export function calibration(
  records: { confidence: Confidence; correct: boolean }[],
): number | null {
  if (records.length < 5) return null;
  const sure = records.filter(r => r.confidence === 'sure');
  const unsure = records.filter(r => r.confidence === 'unsure');
  if (sure.length === 0 || unsure.length === 0) return null;
  const sureAcc = sure.filter(r => r.correct).length / sure.length;
  const unsureAcc = unsure.filter(r => r.correct).length / unsure.length;
  // Well calibrated means "sure" is much more accurate than "unsure".
  // Overconfident means the gap is small or inverted.
  return Math.max(-1, Math.min(1, (unsureAcc - sureAcc)));
}

export const CONFIDENCE_COPY = {
  prompt:  { en: 'How sure are you?', hi: 'आप कितने आश्वस्त हैं?' },
  sure:    { en: 'Sure',              hi: 'पक्का' },
  unsure:  { en: 'Not sure',          hi: 'पक्का नहीं' },
} as const;
