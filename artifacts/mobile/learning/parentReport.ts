// ─── Parent report ───────────────────────────────────────────────────────────
// docs/14 §10.
//
// The design constraint is unusual and worth stating: **parents do not lack
// data, they lack a next action.** Every instinct in a product like this is to
// build a dashboard — charts, time-on-task, comparison to grade level. The
// audit's judgement was that all of that is noise, and that the one thing a
// parent cannot get anywhere else is a specific, named misconception together
// with something concrete to do about it at the kitchen table.
//
// So this module composes existing data into three sentences and one activity.
// It deliberately produces no charts and no scores.

import type { Attempt } from './attempts';
import { currentStreak, dayKey } from './attempts';
import type { MasteryEstimate } from './mastery';
import { MASTERED_THRESHOLD, DAY_MS } from './mastery';
import type { SkillId } from './skills';
import { SKILLS } from './skills';
import { MISCONCEPTIONS, summariseMisconceptions } from './misconceptions';
import { MISCONCEPTIONS_HI } from '../i18n/misconceptions-hi';
import { biggestGain, growthSentence } from './feedback';
import type { Lang } from '../i18n/strings';

export interface ParentReport {
  /** Days practised in the last 7. Days, never minutes — see below. */
  daysPractised: number;
  daysInWindow: number;
  /** Total questions answered in the window. */
  questions: number;
  /** Approximate minutes spent, stated as information rather than a target. */
  minutes: number;
  currentStreak: number;
  strongest: { skill: SkillId; label: string; value: number } | null;
  needsWork: { skill: SkillId; label: string; value: number } | null;
  /** The one thing that would help most, in plain English. */
  focus: {
    misconceptionId: string;
    what: string;
    tryThis: string;
  } | null;
  /** Growth sentence, when there is real evidence of it. */
  growth: string | null;
  /** True when there is too little practice to say anything honest. */
  insufficientData: boolean;
}

/** Minimum attempts before we are willing to characterise a learner at all. */
export const MIN_ATTEMPTS_FOR_REPORT = 20;

/**
 * Concrete kitchen-table activities, keyed by misconception.
 *
 * The existing `remediation` copy is already written for an adult — the audit
 * noted it advises physical apparatus a child does not have alone. That is
 * exactly right for a parent, so it is reused. These entries add a household
 * framing where the generic advice would be hard to act on.
 */
const ACTIVITY: Record<string, { en: string; hi: string }> = {
  'sub.smaller-from-larger': {
    en: 'Use 4 bundles of ten straws and 3 loose ones, and physically break one bundle open to make the exchange visible.',
    hi: 'दस-दस तिनकों की 4 गड्डियाँ और 3 अलग तिनके लें, और एक गड्डी खोलकर दिखाएँ कि उधार कैसे लिया जाता है।',
  },
  'add.forgot-carry': {
    en: 'Work one sum together on paper and ask them to say the carried digit out loud before writing it.',
    hi: 'कागज़ पर एक जोड़ साथ करें और हासिल का अंक लिखने से पहले बोलकर कहने को कहें।',
  },
  'frac.add-across': {
    en: 'Cut a chapati into halves and another into thirds, and ask whether one of each makes two fifths.',
    hi: 'एक रोटी को आधे में और दूसरी को तिहाई में काटें, और पूछें कि क्या एक-एक लेने से दो-पाँचवाँ बनता है।',
  },
  'dec.longer-is-bigger': {
    en: 'Compare prices on two packets — 0.5 kg and 0.45 kg — and ask which is heavier.',
    hi: 'दो पैकेट देखें — 0.5 किलो और 0.45 किलो — और पूछें कौन भारी है।',
  },
  'mul.added-instead': {
    en: 'Lay out coins in equal rows and count them two ways: by adding the rows, and by counting one row and multiplying.',
    hi: 'सिक्कों को बराबर पंक्तियों में रखें और दो तरह से गिनें: पंक्तियाँ जोड़कर, और एक पंक्ति गिनकर गुणा करके।',
  },
  'money.change-not-subtracted': {
    en: 'Give them a real note at a shop and ask them to work out the change before the shopkeeper does.',
    hi: 'दुकान पर उन्हें असली नोट दें और दुकानदार से पहले बाकी पैसे बताने को कहें।',
  },
  'time.sixty-not-hundred': {
    en: 'Use a clock face and count round in fives together, so sixty rather than a hundred becomes the whole.',
    hi: 'घड़ी पर पाँच-पाँच करके साथ गिनें, ताकि पूरा चक्र साठ का लगे, सौ का नहीं।',
  },
};

export function buildParentReport(args: {
  log: Attempt[];
  estimates: Record<SkillId, MasteryEstimate>;
  lang: Lang;
  now?: number;
  windowDays?: number;
}): ParentReport {
  const { log, estimates, lang, now = Date.now(), windowDays = 7 } = args;
  const since = now - windowDays * DAY_MS;
  const recent = log.filter(a => a.answeredAt >= since && a.misconception !== 'legacy-import');

  const days = new Set(recent.map(a => dayKey(a.answeredAt))).size;
  // Latency is capped per attempt: a child who leaves the app open for an hour
  // did not spend an hour thinking, and reporting that would be a lie.
  const minutes = Math.round(
    recent.reduce((s, a) => s + Math.min(a.latencyMs, 60_000), 0) / 60_000);

  const scored = Object.values(estimates)
    .filter(m => m.attempts >= 5 && SKILLS[m.skill]);
  const sorted = [...scored].sort((a, b) => b.value - a.value);
  const strongest = sorted[0] && sorted[0].value >= MASTERED_THRESHOLD
    ? { skill: sorted[0].skill, label: SKILLS[sorted[0].skill].label, value: sorted[0].value }
    : null;
  const weakest = sorted[sorted.length - 1];
  const needsWork = weakest && weakest.value < 0.70
    ? { skill: weakest.skill, label: SKILLS[weakest.skill].label, value: weakest.value }
    : null;

  // The single highest-value item: the most frequent named misconception.
  const top = summariseMisconceptions(recent.map(a => a.misconception))[0];
  let focus: ParentReport['focus'] = null;
  if (top) {
    const hi = MISCONCEPTIONS_HI[top.id];
    const info = lang === 'hi' && hi ? hi : MISCONCEPTIONS[top.id];
    const activity = ACTIVITY[top.id];
    focus = {
      misconceptionId: top.id,
      what: info.explanation,
      tryThis: activity ? (lang === 'hi' ? activity.hi : activity.en) : info.remediation,
    };
  }

  const gain = biggestGain(log, now, 14);

  return {
    daysPractised: days,
    daysInWindow: windowDays,
    questions: recent.length,
    minutes,
    currentStreak: currentStreak(log, now),
    strongest,
    needsWork,
    focus,
    growth: gain ? growthSentence(gain, lang) : null,
    // Saying anything definite about a child from a handful of questions would
    // be worse than saying nothing — parents act on what they are told.
    insufficientData: recent.length < MIN_ATTEMPTS_FOR_REPORT,
  };
}
