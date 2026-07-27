// ─── Growth reporting and process praise ─────────────────────────────────────
// Implements §9 M2 and M3 of docs/14-educational-improvement-roadmap.md.
//
// Two changes, both nearly free because the data already exists.
//
// M2 · The mastery model computes `trend` on every estimate and the app showed
//      it nowhere. Growth-mindset framing is not a slogan; it requires actual
//      evidence of growth put in front of the learner. "41% → 68% this
//      fortnight" is that evidence.
//
// M3 · Feedback said "Correct!". Outcome praise reliably produces fixed-mindset
//      attribution in children (Mueller & Dweck): praised for being right, a
//      child learns that being right is what is valued, and subsequently avoids
//      harder problems where they might not be. Process praise — naming the
//      effort or the method — produces the opposite.
//
// Pure functions over the attempt log, so both are testable without a renderer.

import type { Attempt } from './attempts';
import type { SkillId } from './skills';
import { SKILLS } from './skills';
import { DAY_MS } from './mastery';
import type { Lang } from '../i18n/strings';

// ─── M2 · Growth trend ───────────────────────────────────────────────────────

export interface GrowthReport {
  skill: SkillId;
  /** Accuracy over the earlier window, 0–1. */
  before: number;
  /** Accuracy over the recent window, 0–1. */
  after: number;
  /** after − before. */
  delta: number;
  /** Attempts backing the report. */
  attempts: number;
}

/** Minimum attempts in *each* half before a change is worth reporting. */
export const MIN_GROWTH_EVIDENCE = 5;

/** Minimum improvement worth showing. Below this it is noise, not growth. */
export const MIN_GROWTH_DELTA = 0.10;

/**
 * Find the skill that has improved most over the given window.
 *
 * Deliberately reports only *improvement*. This is not dishonesty by omission:
 * decline is already surfaced — the progress screen lists weakest skills first
 * and the misconception panel names what is going wrong. What the app lacked
 * was any acknowledgement of progress, which is the half that sustains effort.
 *
 * Returns null when there is not enough evidence. Manufacturing an encouraging
 * number from three attempts would make every subsequent one worthless.
 */
export function biggestGain(
  log: Attempt[],
  now: number = Date.now(),
  windowDays = 14,
): GrowthReport | null {
  const since = now - windowDays * DAY_MS;
  const midpoint = now - (windowDays / 2) * DAY_MS;

  const bySkill = new Map<SkillId, { early: Attempt[]; late: Attempt[] }>();
  for (const a of log) {
    if (a.answeredAt < since) continue;
    if (a.misconception === 'legacy-import') continue;   // synthesised, not real
    if (!SKILLS[a.skill]) continue;
    const bucket = bySkill.get(a.skill) ?? { early: [], late: [] };
    (a.answeredAt < midpoint ? bucket.early : bucket.late).push(a);
    bySkill.set(a.skill, bucket);
  }

  let best: GrowthReport | null = null;
  for (const [skill, { early, late }] of bySkill) {
    if (early.length < MIN_GROWTH_EVIDENCE || late.length < MIN_GROWTH_EVIDENCE) continue;
    const acc = (xs: Attempt[]) => xs.filter(x => x.correct).length / xs.length;
    const before = acc(early);
    const after = acc(late);
    const delta = after - before;
    if (delta < MIN_GROWTH_DELTA) continue;
    if (!best || delta > best.delta) {
      best = { skill, before, after, delta, attempts: early.length + late.length };
    }
  }
  return best;
}

/** Render a growth report as a sentence. Numerals stay Western Arabic in both languages. */
export function growthSentence(report: GrowthReport, lang: Lang): string {
  const label = SKILLS[report.skill]?.label ?? report.skill;
  const from = Math.round(report.before * 100);
  const to = Math.round(report.after * 100);
  return lang === 'hi'
    ? `${label}: ${from}% → ${to}% इस पखवाड़े`
    : `${label}: ${from}% → ${to}% this fortnight`;
}

// ─── M3 · Process praise ─────────────────────────────────────────────────────

/**
 * Praise categories, chosen by *what the learner did*, not merely that they
 * were right. Each names an action the child controls and can repeat.
 */
export type PraiseKind =
  /** Answered a skill they are still building. */
  | 'effort'
  /** Took their time and got it right — the behaviour we most want to reinforce. */
  | 'persistence'
  /** Recovered immediately after a wrong answer. */
  | 'recovery'
  /** Fast and correct on a secure skill — genuine fluency. */
  | 'fluency'
  /** Neutral acknowledgement. */
  | 'plain';

/** Latency above which an answer counts as considered rather than recalled. */
const DELIBERATE_MS = 6000;
/** Latency below which a correct answer on a secure skill is fluent recall. */
const FLUENT_MS = 3000;

/**
 * Choose the praise for a correct answer.
 *
 * Note the ordering: recovery outranks everything. A child who has just been
 * wrong and comes straight back is doing the single hardest thing in learning,
 * and that is the moment worth naming.
 */
export function praiseFor(args: {
  mastery: number;
  latencyMs: number;
  /** Was the immediately preceding attempt in this session wrong? */
  afterMistake: boolean;
  /** Was a hint or worked example on screen? */
  scaffolded?: boolean;
}): PraiseKind {
  const { mastery, latencyMs, afterMistake, scaffolded } = args;
  if (afterMistake) return 'recovery';
  // A scaffolded success is real, but praising it as fluency would be false.
  if (scaffolded) return 'effort';
  if (latencyMs >= DELIBERATE_MS) return 'persistence';
  if (mastery < 0.55) return 'effort';
  if (mastery >= 0.85 && latencyMs <= FLUENT_MS) return 'fluency';
  return 'plain';
}

/**
 * Praise copy.
 *
 * Every line names a process ("you worked that out", "you kept going") rather
 * than a trait ("clever", "brilliant") or a bare outcome ("correct"). Hindi
 * follows the semi-Hindi policy: the words are translated because they are part
 * of what is being communicated, not navigation.
 */
export const PRAISE: Record<PraiseKind, { en: string; hi: string }> = {
  effort:      { en: 'You worked that out',      hi: 'आपने इसे हल किया' },
  persistence: { en: 'You took your time — it paid off', hi: 'आपने समय लिया — और सही निकला' },
  recovery:    { en: 'You came straight back',   hi: 'आपने तुरंत वापसी की' },
  fluency:     { en: 'That one is secure now',   hi: 'यह अब पक्का हो गया' },
  plain:       { en: 'Correct',                  hi: 'सही' },
};

export function praiseText(kind: PraiseKind, lang: Lang): string {
  return lang === 'hi' ? PRAISE[kind].hi : PRAISE[kind].en;
}
