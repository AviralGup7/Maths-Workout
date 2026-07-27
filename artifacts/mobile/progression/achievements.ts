// ─── Achievements ────────────────────────────────────────────────────────────
// docs/16 §8.
//
// The brief was explicit that "answer 100 questions" is the archetype to avoid.
// It rewards attendance, it is trivially farmable, and it tells a child nothing
// about themselves. Every achievement here is tied to a **state of learning**:
// something that is true about what the child can now do, or about a habit that
// helps them.
//
// Six categories. None can be earned by volume alone — where an achievement
// counts something, it counts *distinct days* or *distinct skills*, never
// questions answered.

import type { Attempt } from '../learning/attempts';
import { currentStreak, practiceDays, dayKey } from '../learning/attempts';
import type { MasteryEstimate } from '../learning/mastery';
import { MASTERED_THRESHOLD, DAY_MS } from '../learning/mastery';
import type { SkillId } from '../learning/skills';
import { SKILLS } from '../learning/skills';
import { CHAPTERS, chapterStatus } from '../curriculum/chapters';
import type { SchoolClass } from '../generators/types';

export type AchievementCategory =
  | 'mastery' | 'overcoming' | 'consistency' | 'diversity' | 'depth' | 'habits';

export interface Achievement {
  id: string;
  category: AchievementCategory;
  title: { en: string; hi: string };
  description: { en: string; hi: string };
  /** Progress toward the achievement, 0–1. */
  progress: (ctx: AchievementContext) => number;
}

export interface AchievementContext {
  log: Attempt[];
  estimates: Record<SkillId, MasteryEstimate>;
  cls: SchoolClass;
  now: number;
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const mastered = (ctx: AchievementContext) =>
  Object.values(ctx.estimates).filter(m => m.value >= MASTERED_THRESHOLD);

export const ACHIEVEMENTS: Achievement[] = [
  // ── Mastery ────────────────────────────────────────────────────────────────
  {
    id: 'bedrock',
    category: 'mastery',
    title: { en: 'Bedrock', hi: 'मज़बूत नींव' },
    description: {
      en: 'Every Class 1 foundation secure',
      hi: 'कक्षा 1 की सभी बुनियादी बातें पक्की',
    },
    progress: ctx => {
      const foundations = Object.values(SKILLS)
        .filter(s => s.introducedIn === '1st').map(s => s.id);
      const done = foundations.filter(
        s => (ctx.estimates[s]?.value ?? 0) >= MASTERED_THRESHOLD).length;
      return clamp(done / Math.max(1, foundations.length));
    },
  },
  {
    id: 'full-table',
    category: 'mastery',
    title: { en: 'Tables Locked In', hi: 'पहाड़े पक्के' },
    description: { en: 'Times tables secure, from memory', hi: 'पहाड़े याद से पक्के' },
    progress: ctx => {
      const tables = ['mul.tables.easy', 'mul.tables.mid', 'mul.tables.full'];
      const done = tables.filter(s => {
        const e = ctx.estimates[s];
        if (!e || e.value < MASTERED_THRESHOLD) return false;
        // Must be earned on produced evidence, not recognition.
        return ctx.log.some(a => a.skill === s && a.correct && a.interaction && a.interaction !== 'choice');
      }).length;
      return clamp(done / tables.length);
    },
  },
  {
    id: 'chapter-secure',
    category: 'mastery',
    title: { en: 'Chapter Secure', hi: 'अध्याय पक्का' },
    description: { en: 'Finish a chapter with every skill secure', hi: 'हर कौशल पक्का करके अध्याय पूरा करें' },
    progress: ctx => {
      const m: Record<string, number> = {};
      for (const [k, v] of Object.entries(ctx.estimates)) m[k] = v.value;
      const complete = CHAPTERS.filter(c => chapterStatus(c, m, ctx.cls) === 'complete').length;
      return clamp(complete / 1);
    },
  },

  // ── Overcoming ─────────────────────────────────────────────────────────────
  {
    id: 'turned-it-around',
    category: 'overcoming',
    title: { en: 'Turned It Around', hi: 'पलट दिया' },
    description: {
      en: 'Take a skill from struggling to secure',
      hi: 'कमज़ोर कौशल को पक्का बनाएँ',
    },
    progress: ctx => {
      // Was genuinely poor early, is genuinely good now.
      for (const [skill, est] of Object.entries(ctx.estimates)) {
        if (est.value < 0.75) continue;
        const early = ctx.log.filter(a => a.skill === skill).slice(0, 8);
        if (early.length < 5) continue;
        const earlyAcc = early.filter(a => a.correct).length / early.length;
        if (earlyAcc <= 0.35) return 1;
      }
      return 0;
    },
  },
  {
    id: 'misconception-broken',
    category: 'overcoming',
    title: { en: 'Mistake Broken', hi: 'गलती तोड़ी' },
    description: {
      en: 'Clear a named mistake for 20 attempts',
      hi: 'एक पहचानी गलती 20 प्रयासों तक न दोहराएँ',
    },
    progress: ctx => {
      const bySkill = new Map<string, Attempt[]>();
      for (const a of ctx.log) {
        if (!bySkill.has(a.skill)) bySkill.set(a.skill, []);
        bySkill.get(a.skill)!.push(a);
      }
      let best = 0;
      for (const attempts of bySkill.values()) {
        const lastBad = [...attempts].reverse()
          .findIndex(a => a.misconception && a.misconception !== 'legacy-import');
        if (lastBad === -1) continue;                 // never had one here
        const hadOne = attempts.some(a => a.misconception && a.misconception !== 'legacy-import');
        if (hadOne) best = Math.max(best, clamp(lastBad / 20));
      }
      return best;
    },
  },
  {
    id: 'came-back',
    category: 'overcoming',
    title: { en: 'Came Back', hi: 'वापस आए' },
    description: {
      en: 'Return to a skill you had left alone, and master it',
      hi: 'छोड़े हुए कौशल पर लौटकर उसे पक्का करें',
    },
    progress: ctx => {
      for (const [skill, est] of Object.entries(ctx.estimates)) {
        if (est.value < MASTERED_THRESHOLD) continue;
        const times = ctx.log.filter(a => a.skill === skill).map(a => a.answeredAt).sort();
        for (let i = 1; i < times.length; i++) {
          if (times[i] - times[i - 1] >= 21 * DAY_MS) return 1;
        }
      }
      return 0;
    },
  },

  // ── Consistency ────────────────────────────────────────────────────────────
  {
    id: 'fortnight',
    category: 'consistency',
    title: { en: 'Fortnight', hi: 'पखवाड़ा' },
    description: { en: 'Practise on 14 different days', hi: '14 अलग-अलग दिन अभ्यास करें' },
    // Distinct DAYS, never questions: a single marathon cannot buy this.
    progress: ctx => clamp(practiceDays(ctx.log).length / 14),
  },
  {
    id: 'season',
    category: 'consistency',
    title: { en: 'Season', hi: 'पूरा मौसम' },
    description: { en: 'Practise on 90 different days', hi: '90 अलग-अलग दिन अभ्यास करें' },
    progress: ctx => clamp(practiceDays(ctx.log).length / 90),
  },
  {
    id: 'steady-hand',
    category: 'consistency',
    title: { en: 'Steady Hand', hi: 'नियमित अभ्यास' },
    description: {
      en: 'Four or more days a week, for eight weeks',
      hi: 'आठ हफ़्ते तक, हफ़्ते में चार या अधिक दिन',
    },
    progress: ctx => {
      const days = new Set(practiceDays(ctx.log));
      let good = 0;
      for (let w = 0; w < 8; w++) {
        let count = 0;
        for (let d = 0; d < 7; d++) {
          const ts = ctx.now - (w * 7 + d) * DAY_MS;
          if (days.has(dayKey(ts))) count++;
        }
        if (count >= 4) good++;
      }
      return clamp(good / 8);
    },
  },

  // ── Diversity ──────────────────────────────────────────────────────────────
  {
    id: 'all-rounder',
    category: 'diversity',
    title: { en: 'All-Rounder', hi: 'हरफ़नमौला' },
    description: {
      en: 'Reach a good level in every kind of maths you have met',
      hi: 'हर तरह के गणित में अच्छा स्तर पाएँ',
    },
    progress: ctx => {
      const byCategory = new Map<string, number[]>();
      for (const [skill, est] of Object.entries(ctx.estimates)) {
        if (!SKILLS[skill] || est.attempts < 3) continue;
        const cat = SKILLS[skill].category;
        if (!byCategory.has(cat)) byCategory.set(cat, []);
        byCategory.get(cat)!.push(est.value);
      }
      if (byCategory.size < 4) return 0;
      const strong = [...byCategory.values()]
        .filter(vs => vs.reduce((a, b) => a + b, 0) / vs.length >= 0.70).length;
      return clamp(strong / byCategory.size);
    },
  },
  {
    id: 'no-weak-link',
    category: 'diversity',
    title: { en: 'No Weak Link', hi: 'कोई कमज़ोर कड़ी नहीं' },
    description: {
      en: 'Ten skills secure and nothing left below half',
      hi: 'दस कौशल पक्के और कोई आधे से नीचे नहीं',
    },
    progress: ctx => {
      const tried = Object.values(ctx.estimates).filter(m => m.attempts >= 3);
      if (tried.length < 10) return clamp(tried.length / 10) * 0.5;
      const secure = tried.filter(m => m.value >= 0.80).length;
      const weak = tried.filter(m => m.value < 0.50).length;
      return weak > 0 ? clamp(secure / 10) * 0.5 : clamp(secure / 10);
    },
  },

  // ── Depth ──────────────────────────────────────────────────────────────────
  {
    id: 'recall-not-recognition',
    category: 'depth',
    title: { en: 'From Memory', hi: 'याद से' },
    description: {
      en: 'Master ten skills by typing, not choosing',
      hi: 'दस कौशल लिखकर पक्के करें, चुनकर नहीं',
    },
    progress: ctx => {
      const typed = new Set(
        ctx.log.filter(a => a.correct && a.interaction && a.interaction !== 'choice')
          .map(a => a.skill));
      const count = [...typed].filter(
        s => (ctx.estimates[s]?.value ?? 0) >= MASTERED_THRESHOLD).length;
      return clamp(count / 10);
    },
  },
  {
    id: 'long-memory',
    category: 'depth',
    title: { en: 'Long Memory', hi: 'लंबी याद' },
    description: {
      en: 'Still secure on something 60 days after learning it',
      hi: 'सीखने के 60 दिन बाद भी पक्का',
    },
    progress: ctx => {
      for (const [skill, est] of Object.entries(ctx.estimates)) {
        if (est.value < MASTERED_THRESHOLD) continue;
        const first = ctx.log.find(a => a.skill === skill)?.answeredAt;
        if (first && ctx.now - first >= 60 * DAY_MS) return 1;
      }
      return 0;
    },
  },

  // ── Habits ─────────────────────────────────────────────────────────────────
  {
    id: 'right-sized',
    category: 'habits',
    title: { en: 'Right Sized', hi: 'सही मात्रा' },
    description: {
      en: 'Twenty days of steady, sensible practice',
      hi: 'बीस दिन संतुलित अभ्यास',
    },
    // Rewards NOT bingeing. A day of 200 questions does not count.
    progress: ctx => {
      const byDay = new Map<string, number>();
      for (const a of ctx.log) {
        const k = dayKey(a.answeredAt);
        byDay.set(k, (byDay.get(k) ?? 0) + 1);
      }
      const healthy = [...byDay.values()].filter(n => n >= 5 && n <= 60).length;
      return clamp(healthy / 20);
    },
  },
  {
    id: 'reviewer',
    category: 'habits',
    title: { en: 'Reviewer', hi: 'दोहराने वाले' },
    description: {
      en: 'Come back to old work thirty times',
      hi: 'पुराने काम पर तीस बार लौटें',
    },
    progress: ctx => {
      // A "review" is a correct answer on a skill untouched for a week or more.
      const lastSeen = new Map<string, number>();
      let reviews = 0;
      for (const a of [...ctx.log].sort((x, y) => x.answeredAt - y.answeredAt)) {
        const prev = lastSeen.get(a.skill);
        if (prev && a.answeredAt - prev >= 7 * DAY_MS && a.correct) reviews++;
        lastSeen.set(a.skill, a.answeredAt);
      }
      return clamp(reviews / 30);
    },
  },
];

export interface AchievementState {
  achievement: Achievement;
  progress: number;
  earned: boolean;
}

export function evaluateAchievements(ctx: AchievementContext): AchievementState[] {
  return ACHIEVEMENTS.map(a => {
    const progress = clamp(a.progress(ctx));
    return { achievement: a, progress, earned: progress >= 1 };
  });
}

/** Newly earned since a previous snapshot — for the results screen. */
export function newlyEarned(
  before: Record<string, boolean>,
  after: AchievementState[],
): AchievementState[] {
  return after.filter(s => s.earned && !before[s.achievement.id]);
}
