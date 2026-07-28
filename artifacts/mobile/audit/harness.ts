// ─── Long-horizon learner simulation harness ─────────────────────────────────
// Drives the REAL engine (scheduler, mastery, recordAnswer, xp, achievements,
// chapters, generators). Nothing here re-implements product logic; the only
// model is the *learner*, which the product does not contain.

import { buildSession, categoryForSkill, projectedSuccess } from '../learning/scheduler';
import { estimateAll, MASTERED_THRESHOLD } from '../learning/mastery';
import type { MasteryEstimate } from '../learning/mastery';
import { SKILLS, prerequisiteClosure } from '../learning/skills';
import type { SkillId } from '../learning/skills';
import type { Attempt } from '../learning/attempts';
import { recordAnswer, type AnswerState } from '../progression/recordAnswer';
import { generateQuestion, generateForSkill } from '../generators';
import { pickInteraction, toEntry } from '../generators/interactions';
import {
  genFactorSelect, genPrimeSelect, genMultipleSelect, genOrderNumbers,
  genOrderDecimals, genOrderFractions, genMissingNumber, genTableRecall, genDoubleHalve,
} from '../generators/topics-interactive';
import type { Question, SchoolClass, Difficulty, Category } from '../generators/types';
import { levelForXp, masteryIndex } from '../progression/levels';
import { evaluateAchievements } from '../progression/achievements';
import { CHAPTERS, chapterStatus } from '../curriculum/chapters';

export const DAY = 86_400_000;

// ─── Deterministic RNG ───────────────────────────────────────────────────────
let seed = 12345;
export function srand(s: number) { seed = s >>> 0; }
export function rnd(): number {
  // mulberry32
  seed = (seed + 0x6D2B79F5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
// Route the engine's own Math.random through the same stream so runs reproduce.
export function installRng() { (Math as any).random = rnd; }

// ─── Learner model ───────────────────────────────────────────────────────────
// Latent ability per skill, invisible to the product. This is the ground truth
// the mastery estimate is graded against.

export interface Profile {
  name: string;
  /** Base fraction of the remaining gap closed per practised item. */
  learnRate: number;
  /** Long-term retention half-life of latent ability, days. */
  retentionHalfLife: number;
  /** Probability of attending on a given day (before pattern overrides). */
  attendance: number;
  /** Questions per session. */
  sessionLength: number;
  /** Probability of answering carelessly fast (guess) regardless of ability. */
  guessRate: number;
  /** Multiplier on answer latency. <1 = rushes. */
  speed: number;
  /** Learner-chosen difficulty bias: overrides scheduler suggestion. */
  difficultyBias?: 'none' | 'easy' | 'hard';
  /** Skills the learner refuses to engage with (avoidance). */
  avoids?: (s: SkillId) => boolean;
  /** Custom attendance predicate: (dayIndex) => sessions today. */
  attend?: (day: number) => number;
  /** Restrict practice to a single category (one-chapter learner). */
  onlyCategory?: Category;
  /** Pre-existing log (e.g. placement seeds) present before day 0. */
  seedLog?: Attempt[];
  cls: SchoolClass;
}

export class Learner {
  ability: Record<SkillId, number> = {};
  lastPractised: Record<SkillId, number> = {};
  constructor(public p: Profile) {}

  readiness(s: SkillId): number {
    const pre = SKILLS[s]?.prerequisites ?? [];
    if (pre.length === 0) return 1;
    const vals = pre.map(x => this.abilityAt(x, Infinity));
    return 0.35 + 0.65 * (vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  /** Latent ability with forgetting applied to `now`. */
  abilityAt(s: SkillId, now: number): number {
    const a = this.ability[s] ?? 0.03;
    const last = this.lastPractised[s];
    if (!last || !Number.isFinite(now)) return a;
    const days = Math.max(0, (now - last) / DAY);
    const retained = Math.pow(0.5, days / this.p.retentionHalfLife);
    return 0.03 + (a - 0.03) * retained;
  }

  /** Probability of a correct answer, given question demand and guessability. */
  pCorrect(s: SkillId, now: number, demand: number, guessProb: number): number {
    const a = this.abilityAt(s, now);
    // Demand shifts the operating point: 0.6 is the neutral demand.
    const shifted = Math.max(0, Math.min(1, a - (demand - 0.6) * 0.8));
    return shifted + (1 - shifted) * guessProb;
  }

  /** Apply learning from one attempt. */
  practise(s: SkillId, now: number, correct: boolean, scaffolded: boolean) {
    const cur = this.abilityAt(s, now);
    const gain = this.p.learnRate * (1 - cur) * this.readiness(s)
      * (correct ? 1 : 0.65) * (scaffolded ? 1.25 : 1);
    this.ability[s] = Math.max(0.03, Math.min(0.995, cur + gain));
    this.lastPractised[s] = now;
  }
}

// ─── Question supply ─────────────────────────────────────────────────────────

const BAD_CATS = new Set<Category>(['tables']);

// Mirror of GameContext.INTERACTIVE_VARIANTS + buildQuestion, so the harness
// exercises the SAME question supply the app does. Kept in sync deliberately;
// audit/__tests__/probe-parity.test.ts asserts the variant table matches.
export const INTERACTIVE_VARIANTS: Partial<Record<string, ((c: SchoolClass, d: Difficulty) => Question)[]>> = {
  'factors.basic':     [genFactorSelect, genPrimeSelect],
  'mul.tables.mid':    [genMultipleSelect, genTableRecall],
  'mul.tables.full':   [genMultipleSelect, genTableRecall],
  'numsense.compare':  [genOrderNumbers],
  'placevalue':        [genOrderNumbers],
  'dec.tenths':        [genOrderDecimals],
  'dec.hundredths':    [genOrderDecimals],
  'frac.equivalence':  [genOrderFractions],
  'add.within20':      [genMissingNumber, genDoubleHalve],
  'add.2digit.carry':  [genMissingNumber],
  'sub.within20':      [genMissingNumber],
  'sub.2digit.borrow': [genMissingNumber],
  'div.basic':         [genDoubleHalve],
};

/** Faithful copy of GameContext.buildQuestion. */
export function buildQuestion(cls: SchoolClass, diff: Difficulty, cat: Category, skill: SkillId, level: number): Question | null {
  const variants = INTERACTIVE_VARIANTS[skill];
  if (variants && variants.length > 0 && rnd() < 0.34) {
    const q = variants[Math.floor(rnd() * variants.length)](cls, diff);
    return { ...q, resolvedCategory: q.resolvedCategory ?? cat };
  }
  let q: Question;
  try { q = generateForSkill(cls, diff, cat, skill); } catch { return null; }
  const withLadder = pickInteraction(level, { entry: true }) === 'entry' ? toEntry(q) : q;
  return { ...withLadder, resolvedCategory: withLadder.resolvedCategory ?? cat };
}

export function questionFor(cls: SchoolClass, skill: SkillId, diff: Difficulty, level = 0.5): Question | null {
  const cat = categoryForSkill(skill);
  if (BAD_CATS.has(cat)) return null;
  return buildQuestion(cls, diff, cat, skill, level);
}

export function guessProbFor(q: Question): number {
  const k = q.interaction?.kind ?? 'choice';
  if (k === 'choice') return 1 / Math.max(2, q.choices.length || 4);
  if (k === 'estimate') return 1 / Math.max(2, (q.interaction as any).bands?.length ?? 4);
  if (k === 'multiSelect') return 0.08;
  if (k === 'ordering') return 0.10;
  return 0.02; // entry
}

export const DEMAND: Record<Difficulty, number> = { easy: 0.35, medium: 0.6, hard: 0.8 };

// ─── Run ─────────────────────────────────────────────────────────────────────

export interface DayRecord {
  day: number;
  answered: number;
  xp: number;
  totalXp: number;
  level: number;
  masteryIdx: number;
  mastered: number;
  accuracy: number;
  projected: number;
  uniqueSkills: number;
}

export interface RunResult {
  profile: string;
  days: DayRecord[];
  state: AnswerState;
  learner: Learner;
  estimates: Record<SkillId, MasteryEstimate>;
  totalAnswered: number;
  /** skill -> times scheduled */
  skillCounts: Record<SkillId, number>;
  questionTexts: string[];
  end: number;
}

export function runLearner(profile: Profile, days: number, startAt = Date.UTC(2026, 0, 1, 9, 0, 0)): RunResult {
  const learner = new Learner(profile);
  let state: AnswerState = { log: profile.seedLog ?? [], ledger: {}, totalXp: 0 };
  const dayRecs: DayRecord[] = [];
  const skillCounts: Record<SkillId, number> = {};
  const questionTexts: string[] = [];
  let total = 0;

  for (let d = 0; d < days; d++) {
    const dayStart = startAt + d * DAY;
    const sessions = profile.attend
      ? profile.attend(d)
      : (rnd() < profile.attendance ? 1 : 0);

    let answeredToday = 0, correctToday = 0, xpToday = 0, projSum = 0, projN = 0;

    for (let s = 0; s < sessions; s++) {
      const now0 = dayStart + s * 3 * 3600_000;
      const estimates = estimateAll(state.log, now0);
      let session = buildSession(profile.cls, estimates, profile.sessionLength, now0);
      if (profile.onlyCategory) {
        session = session.map(x => ({ ...x, skill: x.skill }));
      }
      if (session.length === 0) continue;
      projSum += projectedSuccess(session, estimates); projN++;

      for (let i = 0; i < session.length; i++) {
        const planned = session[i];
        let skill = planned.skill;
        // Avoidance: the child quits / reroutes away from a disliked skill by
        // answering it instantly and wrong (which is what avoidance looks like
        // to the app when the skill cannot be skipped outright).
        const avoiding = profile.avoids?.(skill) ?? false;

        let difficulty: Difficulty = planned.difficulty;
        if (profile.difficultyBias === 'hard') difficulty = 'hard';
        if (profile.difficultyBias === 'easy') difficulty = 'easy';

        const lvl = estimates[skill]?.value ?? 0.5;
        const q = questionFor(profile.cls, skill, difficulty, lvl);
        if (!q) continue;
        questionTexts.push(q.questionText);
        skillCounts[skill] = (skillCounts[skill] ?? 0) + 1;

        const now = now0 + i * 25_000;
        const gp = guessProbFor(q);
        const guessing = avoiding || rnd() < profile.guessRate;
        const p = guessing ? gp : learner.pCorrect(skill, now, DEMAND[difficulty], gp);
        const correct = rnd() < p;

        const baseLatency = guessing ? 700 : 4000 + 9000 * (1 - learner.abilityAt(skill, now));
        const latencyMs = Math.round(baseLatency * profile.speed * (0.6 + 0.8 * rnd()));

        // Choose a PLAUSIBLE wrong answer, not a sentinel string. Answering
        // 'WRONG' meant no distractor ever matched and `diagnose` never fired:
        // 692 wrong answers produced ZERO misconceptions, which silently made
        // every misconception-dependent behaviour untestable.
        let chosen = String(q.answer);
        if (!correct) {
          const wrongs = (q.choices ?? []).filter(c => String(c) !== String(q.answer));
          chosen = wrongs.length
            ? String(wrongs[Math.floor(rnd() * wrongs.length)])
            : String(Number(q.answer) + (rnd() < 0.5 ? 1 : -1));
        }

        const res = recordAnswer(state, {
          question: q, chosen,
          correct, latencyMs, timedOut: false, scaffolded: false,
          plannedSkill: skill, cls: profile.cls, sessionCategory: categoryForSkill(skill),
          difficulty, isTablesMode: false, now,
        });
        state = res.state;
        if (!guessing) learner.practise(skill, now, correct, false);
        xpToday += res.award.total;
        answeredToday++; total++;
        if (correct) correctToday++;
      }
    }

    const endOfDay = dayStart + 20 * 3600_000;
    if (d % 5 === 0 || d === days - 1) {
      const est = estimateAll(state.log, endOfDay);
      const vals = Object.values(est).map(e => e.value);
      dayRecs.push({
        day: d, answered: answeredToday, xp: Math.round(xpToday),
        totalXp: Math.round(state.totalXp), level: levelForXp(state.totalXp).level,
        masteryIdx: masteryIndex(vals),
        mastered: vals.filter(v => v >= MASTERED_THRESHOLD).length,
        accuracy: answeredToday ? correctToday / answeredToday : 0,
        projected: projN ? projSum / projN : 0,
        uniqueSkills: Object.keys(est).length,
      });
    }
  }

  const end = startAt + days * DAY;
  return {
    profile: profile.name, days: dayRecs, state, learner,
    estimates: estimateAll(state.log, end),
    totalAnswered: total, skillCounts, questionTexts, end,
  };
}

// ─── Reporting helpers ───────────────────────────────────────────────────────

export function summarise(r: RunResult) {
  const est = r.estimates;
  const vals = Object.values(est);
  const lvl = levelForXp(r.state.totalXp);
  const truth: number[] = [];
  const pred: number[] = [];
  for (const e of vals) {
    truth.push(r.learner.abilityAt(e.skill, r.end));
    pred.push(e.value);
  }
  const ach = evaluateAchievements({ log: r.state.log, estimates: est, cls: r.learner.p.cls, now: r.end });
  const m: Record<string, number> = {};
  for (const [k, v] of Object.entries(est)) m[k] = v.value;
  return {
    profile: r.profile,
    answered: r.totalAnswered,
    xp: Math.round(r.state.totalXp),
    xpPerQ: r.totalAnswered ? +(r.state.totalXp / r.totalAnswered).toFixed(2) : 0,
    level: lvl.level,
    masteryIdx: masteryIndex(vals.map(v => v.value)),
    mastered: vals.filter(v => v.value >= MASTERED_THRESHOLD).length,
    skillsTouched: vals.length,
    trueMastered: truth.filter(t => t >= 0.85).length,
    corr: +pearson(pred, truth).toFixed(3),
    bias: +(mean(pred) - mean(truth)).toFixed(3),
    achievements: ach.filter(a => a.earned).length,
    chaptersComplete: CHAPTERS.filter(c => chapterStatus(c, m, r.learner.p.cls) === 'complete').length,
    chaptersAvailable: CHAPTERS.filter(c => chapterStatus(c, m, r.learner.p.cls) !== 'locked').length,
    accuracy: +(r.state.log.filter(a => a.correct).length / Math.max(1, r.state.log.length)).toFixed(3),
  };
}

export function mean(xs: number[]) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
export function pearson(a: number[], b: number[]) {
  if (a.length < 2) return 0;
  const ma = mean(a), mb = mean(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? num / Math.sqrt(da * db) : 0;
}
export function table(rows: Record<string, unknown>[]) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const w = cols.map(c => Math.max(c.length, ...rows.map(r => String(r[c]).length)));
  const line = (cs: string[]) => cs.map((c, i) => c.padEnd(w[i])).join('  ');
  return [line(cols), line(w.map(n => '-'.repeat(n))), ...rows.map(r => line(cols.map(c => String(r[c]))))].join('\n');
}
