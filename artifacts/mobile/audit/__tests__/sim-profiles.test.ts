import { describe, it, expect } from 'vitest';
import { runLearner, summarise, table, srand, installRng, type Profile } from '../harness';

installRng();

const base = { retentionHalfLife: 60, guessRate: 0.02, speed: 1, sessionLength: 20, cls: '4th' as const };

export const PROFILES: Profile[] = [
  { ...base, name: 'gifted',        learnRate: 0.42, attendance: 0.85 },
  { ...base, name: 'average',       learnRate: 0.16, attendance: 0.60 },
  { ...base, name: 'struggling',    learnRate: 0.06, attendance: 0.55, retentionHalfLife: 25 },
  { ...base, name: 'inconsistent',  learnRate: 0.16, attendance: 0.25, retentionHalfLife: 30 },
  { ...base, name: 'speed-focused', learnRate: 0.16, attendance: 0.7, speed: 0.28, guessRate: 0.35 },
  { ...base, name: 'accuracy-focus',learnRate: 0.16, attendance: 0.7, speed: 2.2, guessRate: 0.0 },
  { ...base, name: 'avoider',       learnRate: 0.16, attendance: 0.65,
    avoids: s => s.startsWith('div.') || s.startsWith('frac.') },
  { ...base, name: 'always-hard',   learnRate: 0.16, attendance: 0.65, difficultyBias: 'hard' },
  { ...base, name: 'always-easy',   learnRate: 0.16, attendance: 0.65, difficultyBias: 'easy' },
  { ...base, name: 'guesser',       learnRate: 0.16, attendance: 0.7, guessRate: 0.9, speed: 0.2 },
  { ...base, name: 'long-breaks',   learnRate: 0.16, attendance: 1,
    attend: d => (Math.floor(d / 30) % 2 === 0 ? (d % 2 === 0 ? 1 : 0) : 0) },
  { ...base, name: 'exam-crammer',  learnRate: 0.16, attendance: 1, sessionLength: 20,
    attend: d => (d % 90 >= 80 ? 4 : 0) },
  { ...base, name: 'perfect',       learnRate: 0.9, attendance: 0.9, guessRate: 0 },
  { ...base, name: 'never-perfect', learnRate: 0.0001, attendance: 0.7 },
];

const HORIZONS = [30, 90, 180, 365];

describe('long-horizon profile simulation', () => {
  for (const h of HORIZONS) {
    it(`runs ${h} days`, () => {
      const rows = PROFILES.map((p, i) => { srand(1000 + i); return summarise(runLearner(p, h)); });
      console.log(`\n===== HORIZON ${h} DAYS =====\n` + table(rows as any));
      expect(rows.length).toBe(PROFILES.length);
    }, 600_000);
  }
});
