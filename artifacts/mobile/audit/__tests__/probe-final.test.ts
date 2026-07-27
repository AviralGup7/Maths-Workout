import { describe, it } from 'vitest';
import { runLearner, srand, installRng, table, type Profile, DAY, mean } from '../harness';
import { evaluateAchievements, ACHIEVEMENTS } from '../../progression/achievements';
import { levelForXp, xpForLevel, cumulativeXpForLevel, masteryIndex } from '../../progression/levels';
import { MASTERED_THRESHOLD } from '../../learning/mastery';

installRng();
const base = { retentionHalfLife: 60, guessRate: 0.02, speed: 1, sessionLength: 20, cls: '4th' as const };

describe('achievement economy', () => {
  it('A1 · earn order and time-to-earn across profiles', () => {
    const profiles: Profile[] = [
      { ...base, name: 'average', learnRate: 0.16, attendance: 0.6 },
      { ...base, name: 'gifted', learnRate: 0.42, attendance: 0.85 },
      { ...base, name: 'struggling', learnRate: 0.06, attendance: 0.55, retentionHalfLife: 25 },
      { ...base, name: 'guesser', learnRate: 0.0001, attendance: 0.7, guessRate: 0.95, speed: 0.2 },
    ];
    const rows: any[] = [];
    for (const [i, p] of profiles.entries()) {
      srand(300 + i);
      const r = runLearner(p, 365);
      const ach = evaluateAchievements({ log: r.state.log, estimates: r.estimates, cls: p.cls, now: r.end });
      for (const a of ach) rows.push({ profile: p.name, id: a.achievement.id,
        category: a.achievement.category, progress: +a.progress.toFixed(2), earned: a.earned ? 'YES' : '' });
    }
    // pivot
    const ids = ACHIEVEMENTS.map(a => a.id);
    const pivot = ids.map(id => {
      const o: any = { achievement: id, category: ACHIEVEMENTS.find(a => a.id === id)!.category };
      for (const p of profiles) {
        const row = rows.find(r => r.profile === p.name && r.id === id);
        o[p.name] = row ? (row.earned ? '1.00*' : row.progress.toFixed(2)) : '-';
      }
      return o;
    });
    console.log('\n===== A1 · ACHIEVEMENT PROGRESS AFTER 365 DAYS (* = earned) =====');
    console.log(table(pivot));
    const perProfile = profiles.map(p => ({ profile: p.name,
      earned: rows.filter(r => r.profile === p.name && r.earned).length,
      of: ids.length,
      zeroProgress: rows.filter(r => r.profile === p.name && r.progress === 0).length }));
    console.log('\n' + table(perProfile));
  }, 900_000);
});

describe('late-game pacing', () => {
  it('P1 · level curve vs sustained earn rate', () => {
    const rows: number[][] = [];
    const out: any[] = [];
    for (const lvl of [2, 5, 10, 20, 30, 40, 50, 60, 80, 100]) {
      out.push({ level: lvl, xpForThisLevel: xpForLevel(lvl), cumulative: cumulativeXpForLevel(lvl) });
    }
    console.log('\n===== P1 · LEVEL CURVE =====');
    console.log(table(out));
    // Days to each level at measured earn rates from the 365-day sims.
    const rates = { gifted: 189502 / 365, average: 83259 / 365, struggling: 29677 / 365, guesser: 40153 / 365 };
    const d = [10, 20, 30, 40, 50, 60, 80, 100].map(l => {
      const o: any = { level: l, cumXp: cumulativeXpForLevel(l) };
      for (const [k, v] of Object.entries(rates)) o[`${k}_days`] = Math.round(cumulativeXpForLevel(l) / v);
      return o;
    });
    console.log('\n===== P1b · DAYS TO LEVEL AT MEASURED EARN RATES =====');
    console.log(table(d));
  });

  it('P2 · does XP per question inflate or starve over time?', () => {
    srand(808);
    const r = runLearner({ ...base, name: 'average', learnRate: 0.16, attendance: 0.75 }, 365);
    // XP rate per 30-day block
    const blocks: any[] = [];
    const start = r.state.log[0].answeredAt;
    for (let b = 0; b < 12; b++) {
      const lo = start + b * 30 * DAY, hi = lo + 30 * DAY;
      const seg = r.state.log.filter(a => a.answeredAt >= lo && a.answeredAt < hi);
      if (!seg.length) continue;
      blocks.push({ month: b + 1, answered: seg.length,
        accuracy: +(seg.filter(a => a.correct).length / seg.length).toFixed(3),
        distinctSkills: new Set(seg.map(a => a.skill)).size,
        repeatRate: +(1 - new Set(seg.map(a => a.questionText)).size / seg.length).toFixed(3) });
    }
    console.log('\n===== P2 · MONTHLY PRACTICE PROFILE (average learner, 365d) =====');
    console.log(table(blocks));
  }, 900_000);
});

describe('mastery predictive validity', () => {
  it('V1 · does the estimate predict true ability?', () => {
    const profiles: Profile[] = [
      { ...base, name: 'average', learnRate: 0.16, attendance: 0.7 },
      { ...base, name: 'guesser', learnRate: 0.0001, attendance: 0.7, guessRate: 0.95, speed: 0.2 },
      { ...base, name: 'never-perfect', learnRate: 0.0001, attendance: 0.7 },
      { ...base, name: 'struggling', learnRate: 0.06, attendance: 0.6, retentionHalfLife: 25 },
    ];
    const rows: any[] = [];
    for (const [i, p] of profiles.entries()) {
      srand(500 + i);
      const r = runLearner(p, 365);
      for (const [s, e] of Object.entries(r.estimates)) {
        rows.push({ profile: p.name, skill: s, est: +e.value.toFixed(2),
          truth: +r.learner.abilityAt(s, r.end).toFixed(2), attempts: e.attempts,
          conf: +e.confidence.toFixed(2) });
      }
    }
    const byProfile = [...new Set(rows.map(r => r.profile))].map(pf => {
      const rs = rows.filter(r => r.profile === pf);
      const over = rs.filter(r => r.est - r.truth > 0.25).length;
      return { profile: pf, skills: rs.length,
        meanEst: +mean(rs.map(r => r.est)).toFixed(3),
        meanTruth: +mean(rs.map(r => r.truth)).toFixed(3),
        meanBias: +(mean(rs.map(r => r.est)) - mean(rs.map(r => r.truth))).toFixed(3),
        overstatedBy25pt: `${over}/${rs.length}`,
        estAbove85: rs.filter(r => r.est >= 0.85).length,
        truthAbove85: rs.filter(r => r.truth >= 0.85).length };
    });
    console.log('\n===== V1 · MASTERY ESTIMATE vs LATENT ABILITY (365d) =====');
    console.log(table(byProfile));
    console.log('\n--- guesser, per skill ---');
    console.log(table(rows.filter(r => r.profile === 'guesser')));
  }, 900_000);
});
