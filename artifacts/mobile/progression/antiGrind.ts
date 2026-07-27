// ─── Anti-exploit systems ────────────────────────────────────────────────────
//
// The Δmastery core already removes the *primary* exploit class: you cannot
// farm a mastered skill, because a mastered skill has no room to move. What
// remains are second-order exploits, and each needs a specific countermeasure.
//
// Design rule followed throughout: prefer making an exploit WORTHLESS over
// making it FORBIDDEN. A blocked action feels like a punishment and invites
// circumvention; an unprofitable action is simply ignored.

import type { Attempt } from '../learning/attempts';
import type { SkillId } from '../learning/skills';
import { dayKey } from '../learning/attempts';

// ─── E1 · Session volume decay ───────────────────────────────────────────────

/**
 * Diminishing returns within a single day.
 *
 * Not primarily an anti-exploit measure — it is a *health* measure. Learning
 * returns genuinely fall after ~40 minutes of arithmetic drill, and a system
 * that pays linearly for a 300-question binge is rewarding something that does
 * not help the child and may put them off entirely.
 *
 * Deliberately gentle for the first ~40 questions (roughly two sessions) so a
 * keen child is never made to feel penalised for enthusiasm, then falls away.
 */
export function sessionDecay(questionsAnsweredToday: number): number {
  if (questionsAnsweredToday <= 40) return 1.0;
  if (questionsAnsweredToday <= 80) return 0.6;
  if (questionsAnsweredToday <= 150) return 0.3;
  return 0.1;
}

// ─── E2 · Question repetition ────────────────────────────────────────────────

/**
 * Detect a repeated *exact* question and decay its value.
 *
 * Guards against a weak generator emitting "2 + 3 = ?" repeatedly, and against
 * a child memorising the answer to a specific string rather than the method.
 * Keyed on question text, which is what the child actually sees.
 */
export function repetitionDecay(log: Attempt[], questionText: string): number {
  const recent = log.slice(-60);
  const seen = recent.filter(a => a.questionText === questionText).length;
  if (seen === 0) return 1.0;
  return Math.max(0.1, Math.pow(0.5, seen));
}

// ─── E3 · Artificial streaks ─────────────────────────────────────────────────

/**
 * A day only counts toward a streak if it contained genuine practice.
 *
 * Without this, "streak" means "opened the app", which is attendance theatre.
 * The bar is deliberately low — this must not punish a child who is ill or
 * busy — but it must be non-trivial.
 */
export const STREAK_MIN_QUESTIONS = 5;
export const STREAK_MIN_LEARNING_XP = 5;

export function dayCountsForStreak(dayAttempts: Attempt[], learningXpThatDay: number): boolean {
  const genuine = dayAttempts.filter(a => !a.timedOut).length;
  return genuine >= STREAK_MIN_QUESTIONS && learningXpThatDay >= STREAK_MIN_LEARNING_XP;
}

/**
 * Streak forgiveness.
 *
 * Hard streaks are the single most-criticised mechanic in educational apps:
 * they convert intrinsic motivation into loss aversion, and a broken 200-day
 * streak is a documented churn event. We keep the habit signal but remove the
 * cliff — one missed day per week is free, no purchase, no notification.
 *
 * This is a deliberate rejection of the industry-standard "streak freeze as
 * currency" pattern, which monetises anxiety in children.
 */
export const STREAK_GRACE_DAYS_PER_WEEK = 1;

// ─── E4 · Difficulty gaming ──────────────────────────────────────────────────

/**
 * Detect deliberate over-reach: selecting content far above ability to farm the
 * difficulty multiplier.
 *
 * The economy mostly handles this itself — over-reach produces wrong answers,
 * wrong answers move mastery down, and negative Δmastery pays nothing. This
 * catches the residual case where a child alternates over-reach with easy wins.
 */
export function overReachRatio(log: Attempt[], masteryAt: (s: SkillId) => number): number {
  const recent = log.slice(-30);
  if (recent.length === 0) return 0;
  const over = recent.filter(a => masteryAt(a.skill) < 0.25 && !a.correct).length;
  return over / recent.length;
}

// ─── E5 · Skill avoidance ────────────────────────────────────────────────────

/**
 * Skills the learner is dodging.
 *
 * A skill counts as avoided when it is *due* and *weak* but has not been
 * practised, while the learner has been actively practising other things. The
 * second condition matters: a child who has not practised at all is not
 * avoiding anything, they are simply absent.
 */
export interface AvoidedSkill {
  skill: SkillId;
  daysSincePractice: number;
  mastery: number;
}

export function detectAvoidance(args: {
  log: Attempt[];
  estimates: Record<SkillId, { value: number; lastPracticed: number | null; attempts: number }>;
  now: number;
  minDays?: number;
}): AvoidedSkill[] {
  const { log, estimates, now, minDays = 7 } = args;
  if (log.length < 20) return [];                 // not enough history to judge
  const activeRecently = log.slice(-40).some(a => now - a.answeredAt < 7 * 86_400_000);
  if (!activeRecently) return [];                 // absent, not avoiding

  const out: AvoidedSkill[] = [];
  for (const [skill, e] of Object.entries(estimates)) {
    if (e.attempts < 3) continue;
    if (e.value >= 0.70) continue;                // not weak
    if (!e.lastPracticed) continue;
    const days = (now - e.lastPracticed) / 86_400_000;
    if (days >= minDays) out.push({ skill, daysSincePractice: days, mastery: e.value });
  }
  return out.sort((a, b) => a.mastery - b.mastery);
}

/**
 * Comeback multiplier — the positive incentive for returning to a dodged skill.
 *
 * The brief asks for positive incentives over forcing, and this is the main
 * one. An avoided weak skill accrues a growing bonus, visible to the learner,
 * so returning to it becomes the single most valuable thing on offer. Capped so
 * it cannot become an exploit in itself (deliberately neglect a skill to farm
 * the bonus later — which would anyway require genuinely learning it, so the
 * "exploit" is self-defeating).
 */
export const COMEBACK_CAP = 2.0;

export function comebackMultiplier(daysAvoided: number, mastery: number): number {
  if (daysAvoided < 7) return 1.0;
  const weakness = Math.max(0, 0.70 - mastery);              // 0 … 0.70
  const time = Math.min(1, (daysAvoided - 7) / 21);          // ramps over 3 wks
  return Math.min(COMEBACK_CAP, 1 + weakness * 1.0 + time * 0.5);
}

// ─── E6 · Same-skill saturation ──────────────────────────────────────────────

/**
 * Cap on how much XP one skill may contribute in a single day.
 *
 * Even a legitimately-learning child hits diminishing returns after ~15
 * questions on one skill; beyond that it is drilling, not learning, and the
 * spaced-repetition scheduler wants that practice distributed across days.
 * Expressed as a soft decay rather than a wall.
 */
export function skillSaturation(questionsOnSkillToday: number): number {
  if (questionsOnSkillToday <= 12) return 1.0;
  if (questionsOnSkillToday <= 20) return 0.5;
  return 0.15;
}

// ─── E7 · Mastery oscillation farming ────────────────────────────────────────

/**
 * The subtlest exploit in a Δmastery economy, and the one worth naming loudly.
 *
 * If XP is paid for mastery *gained*, a learner could in principle let a skill
 * decay (or deliberately answer wrong) and then re-earn the same mastery band
 * repeatedly, farming the same Δ over and over.
 *
 * Countermeasure: XP is paid on **high-water mark**, not on raw delta. Mastery
 * regained below a level you have already been paid for earns only the floor.
 * You are paid once for climbing to 0.85; climbing back to 0.85 after decay
 * pays the (small) retention bonus instead, which is the honest value of that
 * work — re-consolidation, not new learning.
 *
 * This is why `paidHighWater` is persisted per skill.
 */
export function payableDelta(
  masteryBefore: number,
  masteryAfter: number,
  paidHighWater: number,
): number {
  const target = Math.max(masteryAfter, 0);
  if (target <= paidHighWater) return 0;
  return target - Math.max(masteryBefore, paidHighWater);
}
