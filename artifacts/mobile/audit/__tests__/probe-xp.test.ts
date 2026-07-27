import { describe, it, expect } from 'vitest';
import { runLearner, srand, installRng, table, type Profile } from '../harness';
import { BONUS } from '../../progression/xp';

installRng();
const base = { retentionHalfLife: 60, guessRate: 0.02, speed: 1, sessionLength: 20, cls: '4th' as const };

/** Re-derive where XP actually came from, by replaying award bonuses. */
import { recordAnswer } from '../../progression/recordAnswer';

describe('XP source decomposition', () => {
  it('attributes XP by source for guesser vs honest learner', () => {
    const profiles: Profile[] = [
      { ...base, name: 'honest-average', learnRate: 0.16, attendance: 1 },
      { ...base, name: 'pure-guesser',   learnRate: 0.0001, attendance: 1, guessRate: 1, speed: 0.25 },
      { ...base, name: 'never-improves', learnRate: 0.0001, attendance: 1 },
    ];
    const rows = profiles.map((p, i) => {
      srand(77 + i);
      const r = runLearner(p, 180);
      // Replay the log through the pipeline to attribute bonuses.
      let st = { log: [] as any[], ledger: {}, totalXp: 0 };
      const tally: Record<string, number> = {};
      let learningXp = 0, floorXp = 0;
      for (const a of r.state.log) {
        const q = { questionText: a.questionText, answer: a.expected, choices: [], interaction: a.interaction ? { kind: a.interaction } as any : undefined };
        const res = recordAnswer(st as any, {
          question: q as any, chosen: a.chosen, correct: a.correct, latencyMs: a.latencyMs,
          timedOut: a.timedOut, scaffolded: a.scaffolded, plannedSkill: a.skill,
          cls: a.cls, sessionCategory: a.category, difficulty: a.difficulty,
          isTablesMode: false, now: a.answeredAt,
        });
        st = res.state as any;
        learningXp += res.award.breakdown.learningXp;
        floorXp += res.award.breakdown.floorXp;
        for (const b of res.award.bonuses) tally[b.id] = (tally[b.id] ?? 0) + b.xp;
      }
      return {
        profile: p.name, answered: r.totalAnswered,
        totalXp: Math.round(st.totalXp),
        learningXp: Math.round(learningXp), floorXp: Math.round(floorXp),
        ...Object.fromEntries(Object.entries(tally).map(([k, v]) => [k, Math.round(v)])),
      };
    });
    const cols = new Set<string>(); rows.forEach(r => Object.keys(r).forEach(k => cols.add(k)));
    const norm = rows.map(r => Object.fromEntries([...cols].map(c => [c, (r as any)[c] ?? 0])));
    console.log('\n===== XP SOURCE DECOMPOSITION (180d, daily practice) =====\n' + table(norm as any));
    expect(rows.length).toBe(3);
  }, 600_000);
});
