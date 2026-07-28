// ─── Engagement surface measurement ──────────────────────────────────────────
// docs/25. What a child actually EXPERIENCES, session by session, over months.
//
// The balance audit (docs/21) proved the economy is fair. Fairness is not the
// same as motivating. This measures the felt experience: how often something
// notable happens, how much of a session is novel, and where the reward
// moments thin out.

import { describe, it } from 'vitest';
import { runLearner, srand, installRng, table, DAY, type Profile } from '../harness';
import { estimateAll, MASTERED_THRESHOLD } from '../../learning/mastery';
import { evaluateAchievements } from '../../progression/achievements';
import { levelForXp, xpForLevel, cumulativeXpForLevel } from '../../progression/levels';
import { CHAPTERS, chapterStatus } from '../../curriculum/chapters';
import { isStreakMilestone, STREAK_MILESTONES } from '../../components/celebrationRules';
import { visualFor } from '../../learning/visualPolicy';
import { SKILLS } from '../../learning/skills';
import { recordAnswer, type AnswerState } from '../../progression/recordAnswer';

installRng();
const base = { retentionHalfLife: 60, guessRate: 0.02, speed: 1, sessionLength: 20, cls: '4th' as const };

describe('E1 · how often does something notable happen?', () => {
  it('counts celebration-worthy moments per session over a year', () => {
    const profiles: Profile[] = [
      { ...base, name: 'average', learnRate: 0.16, attendance: 0.6 },
      { ...base, name: 'struggling', learnRate: 0.06, attendance: 0.6, retentionHalfLife: 25 },
      { ...base, name: 'gifted', learnRate: 0.42, attendance: 0.85 },
    ];
    const rows: Record<string, unknown>[] = [];

    for (const [i, p] of profiles.entries()) {
      srand(7700 + i);
      const r = runLearner(p, 365);

      // Replay to count bonus events — these are the in-session "moments".
      let st: AnswerState = { log: [], ledger: {}, totalXp: 0 };
      const bonusesByMonth = new Map<number, number>();
      const start = r.state.log[0].answeredAt;
      let totalBonuses = 0;
      for (const a of r.state.log) {
        const res = recordAnswer(st, {
          question: { questionText: a.questionText, answer: a.expected, choices: [],
            interaction: a.interaction ? { kind: a.interaction } as never : undefined } as never,
          chosen: a.chosen, correct: a.correct, latencyMs: a.latencyMs, timedOut: a.timedOut,
          scaffolded: a.scaffolded, plannedSkill: a.skill, cls: a.cls,
          sessionCategory: a.category, difficulty: a.difficulty, isTablesMode: false,
          now: a.answeredAt, attemptId: a.id,
        });
        st = res.state;
        const n = res.award.bonuses.length;
        totalBonuses += n;
        const month = Math.floor((a.answeredAt - start) / (30 * DAY));
        bonusesByMonth.set(month, (bonusesByMonth.get(month) ?? 0) + n);
      }

      const sessions = Math.round(r.totalAnswered / p.sessionLength);
      rows.push({
        profile: p.name,
        sessions,
        bonusEvents: totalBonuses,
        perSession: +(totalBonuses / sessions).toFixed(2),
        m1: bonusesByMonth.get(0) ?? 0,
        m3: bonusesByMonth.get(2) ?? 0,
        m6: bonusesByMonth.get(5) ?? 0,
        m12: bonusesByMonth.get(11) ?? 0,
      });
    }
    console.log('\n===== E1 · IN-SESSION REWARD MOMENTS =====');
    console.log(table(rows));
    console.log('A session with 0 notable moments is a session that felt like homework.');
  }, 900_000);
});

describe('E2 · celebration frequency', () => {
  it('measures how often the full-screen celebration actually fires', () => {
    // Celebration.tsx fires on exactly four reasons: streak milestone,
    // recovery, mastery, personal best.
    const rows: Record<string, unknown>[] = [];
    for (const [i, p] of ([
      { ...base, name: 'average', learnRate: 0.16, attendance: 0.6 },
      { ...base, name: 'struggling', learnRate: 0.06, attendance: 0.6, retentionHalfLife: 25 },
    ] as Profile[]).entries()) {
      srand(8800 + i);
      const r = runLearner(p, 365);
      const est = estimateAll(r.state.log, r.end);

      // streak milestones reached
      const days = new Set(r.state.log.map(a => new Date(a.answeredAt).toISOString().slice(0, 10)));
      let streak = 0, best = 0, milestones = 0;
      const sorted = [...days].sort();
      let prev: number | null = null;
      for (const d of sorted) {
        const t = Date.parse(d);
        streak = prev !== null && t - prev <= DAY * 1.5 ? streak + 1 : 1;
        if (isStreakMilestone(streak)) milestones++;
        best = Math.max(best, streak);
        prev = t;
      }
      const masteryMoments = Object.values(est).filter(e => e.value >= MASTERED_THRESHOLD).length;
      const sessions = Math.round(r.totalAnswered / p.sessionLength);
      rows.push({
        profile: p.name, sessions,
        streakMilestones: milestones, bestStreak: best,
        masteryCelebrations: masteryMoments,
        totalCelebrations: milestones + masteryMoments,
        sessionsPerCelebration: +(sessions / Math.max(1, milestones + masteryMoments)).toFixed(1),
      });
    }
    console.log('\n===== E2 · FULL-SCREEN CELEBRATIONS PER YEAR =====');
    console.log(table(rows));
    console.log(`streak milestones defined: ${STREAK_MILESTONES.join(', ')}`);
  }, 900_000);
});

describe('E3 · level pacing as felt', () => {
  it('shows the gap between levels in sessions, not XP', () => {
    // A level that takes 40 sessions to reach is invisible to a child.
    const rates: Record<string, number> = { gifted: 93949 / 365, average: 54214 / 365, struggling: 27608 / 365 };
    const rows: Record<string, unknown>[] = [];
    for (const lvl of [2, 3, 5, 8, 10, 15, 20, 25, 30, 40]) {
      const row: Record<string, unknown> = { level: lvl, xpToReach: cumulativeXpForLevel(lvl), costOfThisLevel: xpForLevel(lvl) };
      for (const [who, perDay] of Object.entries(rates)) {
        // ~0.6 sessions/day at 20q for average attendance
        row[`${who}_days`] = Math.round(cumulativeXpForLevel(lvl) / perDay);
      }
      rows.push(row);
    }
    console.log('\n===== E3 · LEVEL PACING =====');
    console.log(table(rows));
  });

  it('finds dead zones — stretches with no level, no chapter, no achievement', () => {
    srand(4321);
    const r = runLearner({ ...base, name: 'average', learnRate: 0.16, attendance: 0.6 }, 365);
    const start = r.state.log[0].answeredAt;

    // Walk day by day, marking days where SOMETHING happened.
    const events: { day: number; kind: string }[] = [];
    let prevLevel = 1;
    let prevAch = 0;
    let prevChapters = 0;
    for (let d = 0; d < 365; d += 5) {
      const t = start + d * DAY;
      const upto = r.state.log.filter(a => a.answeredAt <= t);
      if (upto.length === 0) continue;
      let xp = 0;
      let st: AnswerState = { log: [], ledger: {}, totalXp: 0 };
      // cheap approximation: use the run's XP curve proportionally
      xp = r.state.totalXp * (upto.length / r.state.log.length);
      const lvl = levelForXp(xp).level;
      const est = estimateAll(upto, t);
      const m: Record<string, number> = {};
      for (const [k, v] of Object.entries(est)) m[k] = v.value;
      const ach = evaluateAchievements({ log: upto, estimates: est, cls: '4th', now: t })
        .filter(a => a.earned).length;
      const chapters = CHAPTERS.filter(c => chapterStatus(c, m, '4th') === 'complete').length;

      if (lvl > prevLevel) events.push({ day: d, kind: `level ${lvl}` });
      if (ach > prevAch) events.push({ day: d, kind: `achievement (${ach})` });
      if (chapters > prevChapters) events.push({ day: d, kind: `chapter (${chapters})` });
      prevLevel = lvl; prevAch = ach; prevChapters = chapters;
    }
    console.log('\n===== E3b · MILESTONE TIMELINE (average learner) =====');
    console.log(events.map(e => `d${e.day}: ${e.kind}`).join('\n'));
    // biggest gap
    let maxGap = 0, gapAt = 0;
    for (let i = 1; i < events.length; i++) {
      const g = events[i].day - events[i - 1].day;
      if (g > maxGap) { maxGap = g; gapAt = events[i - 1].day; }
    }
    console.log(`\nlongest stretch with NO milestone: ${maxGap} days (from day ${gapAt})`);
  }, 900_000);
});

describe('E4 · variety as experienced', () => {
  it('measures how much of a session is visually or structurally novel', () => {
    const withVisual = Object.keys(SKILLS).filter(s => visualFor(s) !== null);
    console.log('\n===== E4 · VARIETY SURFACE =====');
    console.log(`skills with a visual model: ${withVisual.length}/${Object.keys(SKILLS).length}`);
    console.log(`  ${withVisual.join(', ')}`);
    console.log(`skills with NO visual ever: ${Object.keys(SKILLS).length - withVisual.length}`);
  });

  it('counts distinct interaction kinds a learner actually meets in a year', () => {
    srand(999);
    const r = runLearner({ ...base, name: 'average', learnRate: 0.16, attendance: 0.7 }, 365);
    const kinds = new Map<string, number>();
    for (const a of r.state.log) {
      const k = a.interaction ?? 'choice';
      kinds.set(k, (kinds.get(k) ?? 0) + 1);
    }
    const total = r.state.log.length;
    console.log('\n===== E4b · INTERACTION MIX OVER A YEAR =====');
    console.log(table([...kinds.entries()].map(([k, n]) => ({
      interaction: k, count: n, share: `${(n / total * 100).toFixed(1)}%`,
    }))));
  }, 900_000);
});
