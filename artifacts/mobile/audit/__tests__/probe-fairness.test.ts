import { describe, it } from 'vitest';
import { runLearner, srand, installRng, table, type Profile } from '../harness';
import { MASTERED_THRESHOLD } from '../../learning/mastery';

installRng();
const base = { retentionHalfLife: 60, guessRate: 0.02, speed: 1, sessionLength: 20, cls: '4th' as const };

/**
 * XP EFFICIENCY FAIRNESS.
 *
 * The economy's central claim is that XP tracks LEARNING. Test it directly:
 * XP per unit of true mastery gained. If the ratios differ wildly between
 * strategies, the economy is paying for something other than learning.
 */
describe('XP tracks learning, not strategy', () => {
  it('N1 · XP per unit of true learning, across strategies', () => {
    const profiles: Profile[] = [
      { ...base, name: 'gifted',      learnRate: 0.42, attendance: 0.85 },
      { ...base, name: 'average',     learnRate: 0.16, attendance: 0.6 },
      { ...base, name: 'always-hard', learnRate: 0.16, attendance: 0.65, difficultyBias: 'hard' },
      { ...base, name: 'always-easy', learnRate: 0.16, attendance: 0.65, difficultyBias: 'easy' },
      { ...base, name: 'struggling',  learnRate: 0.06, attendance: 0.55, retentionHalfLife: 25 },
      { ...base, name: 'guesser',     learnRate: 0.0001, attendance: 0.7, guessRate: 0.95, speed: 0.2 },
    ];
    const rows = profiles.map((p, i) => {
      srand(4000 + i);
      const r = runLearner(p, 365);
      // True learning = sum of latent ability actually acquired.
      let trueLearning = 0;
      for (const s of Object.keys(r.estimates)) trueLearning += r.learner.abilityAt(s, r.end);
      const trueMastered = Object.keys(r.estimates)
        .filter(s => r.learner.abilityAt(s, r.end) >= 0.85).length;
      return {
        profile: p.name,
        answered: r.totalAnswered,
        xp: Math.round(r.state.totalXp),
        trueLearning: +trueLearning.toFixed(1),
        trueMastered,
        xpPerTrueSkill: +(r.state.totalXp / Math.max(0.5, trueLearning)).toFixed(0),
        xpPerQuestion: +(r.state.totalXp / r.totalAnswered).toFixed(2),
      };
    });
    rows.sort((a, b) => b.xpPerTrueSkill - a.xpPerTrueSkill);
    console.log('\n===== N1 · XP PER UNIT OF TRUE LEARNING (365 d) =====');
    console.log(table(rows));
    const ratios = rows.map(r => r.xpPerTrueSkill).filter(v => Number.isFinite(v) && v > 0);
    console.log(`\nspread (max/min): ${(Math.max(...ratios) / Math.min(...ratios)).toFixed(1)}x`);
    console.log('A fair economy keeps this small: everyone is paid for what they learn.');
  }, 900_000);

  it('N2 · does effort-adjusted reward favour the struggling learner fairly?', () => {
    const profiles: Profile[] = [
      { ...base, name: 'average',    learnRate: 0.16, attendance: 0.6 },
      { ...base, name: 'struggling', learnRate: 0.06, attendance: 0.6, retentionHalfLife: 25 },
      { ...base, name: 'guesser',    learnRate: 0.0001, attendance: 0.6, guessRate: 0.95, speed: 0.2 },
    ];
    const rows = profiles.map((p, i) => {
      srand(5000 + i);
      const r = runLearner(p, 365);
      let trueLearning = 0;
      for (const s of Object.keys(r.estimates)) trueLearning += r.learner.abilityAt(s, r.end);
      return { profile: p.name, answered: r.totalAnswered, xp: Math.round(r.state.totalXp),
        trueLearning: +trueLearning.toFixed(1),
        masteryIdx: 0, xpPerQuestion: +(r.state.totalXp / r.totalAnswered).toFixed(2) };
    });
    console.log('\n===== N2 · EFFORT vs REWARD =====');
    console.log(table(rows));
    console.log('Struggling must clearly beat guessing at equal volume.');
  }, 900_000);
});
