// ─── Achievement integrity ───────────────────────────────────────────────────
// docs/21 · §8.
//
// Two failure modes, in opposite directions, and the module is worth nothing if
// either is present:
//
//   · an achievement earnable WITHOUT LEARNING is a lie told to a child, and
//     teaches them the app rewards presence
//   · an achievement earnable BY NOBODY is dead weight on the wall, and the
//     `overcoming` category — the one aimed at children who find maths hard —
//     was entirely dead: three achievements at 0.00 for every profile at every
//     horizon, including a perfect learner
//
// These tests assert both bounds against synthetic learners built to be
// unambiguous: one who taps at random for a year, one who genuinely learns.

import { describe, it, expect } from 'vitest';
import { evaluateAchievements, ACHIEVEMENTS } from '../achievements';
import { estimateAll } from '../../learning/mastery';
import { SKILLS } from '../../learning/skills';
import type { Attempt } from '../../learning/attempts';

const DAY = 86_400_000;
const START = Date.UTC(2025, 0, 1, 9);
const NOW = START + 365 * DAY;

const POOL = ['add.within20', 'sub.within20', 'mul.tables.mid', 'div.basic', 'placevalue']
  .filter(s => SKILLS[s]);

/** Broad, cross-category pool: diversity and chapter achievements need spread. */
const WIDE_POOL = [
  'add.within10', 'add.within20', 'add.2digit.nocarry', 'add.2digit.carry',
  'sub.within10', 'sub.within20', 'sub.2digit.noborrow', 'sub.2digit.borrow',
  'mul.tables.easy', 'mul.tables.mid', 'mul.tables.full',
  'div.basic', 'div.tables', 'placevalue', 'count.objects', 'count.skip',
  'numsense.compare', 'numsense.estimate', 'shapes.basic', 'time.basic',
  'money.basic', 'measurement.basic',
].filter(s => SKILLS[s]);

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A learner who opens the app daily for a year and taps at random. */
function tapper(): Attempt[] {
  const rand = rng(4242);
  const log: Attempt[] = [];
  for (let d = 0; d < 365; d++) {
    for (let i = 0; i < 20; i++) {
      const skill = POOL[Math.floor(rand() * POOL.length)];
      log.push({
        skill, correct: rand() < 0.25,
        answeredAt: START + d * DAY + i * 60_000,
        latencyMs: 250,                      // sub-second: a tap, not an answer
        chosen: 'x', expected: 'y', questionText: `q${d}-${i}`,
        timedOut: false, interaction: 'choice',
        cls: '4th', category: SKILLS[skill].category, difficulty: 'medium',
      } as Attempt);
    }
  }
  return log;
}

/**
 * A learner who practises properly and improves.
 *
 * Deliberately realistic in three ways the achievements depend on: a WIDE skill
 * pool (diversity and chapter achievements span categories), occasional long
 * absences (spaced-review and comeback achievements need a real gap), and
 * genuine early errors that later stop recurring (the misconception
 * achievements need something to clear).
 */
function genuine(): Attempt[] {
  const rand = rng(99);
  const ability: Record<string, number> = {};
  const log: Attempt[] = [];
  for (let d = 0; d < 365; d++) {
    if (rand() < 0.25) continue;                       // rest days
    // Two extended breaks, as a real child's year contains (holidays, illness).
    if ((d > 90 && d < 115) || (d > 240 && d < 262)) continue;
    for (let i = 0; i < 16; i++) {
      const skill = WIDE_POOL[Math.floor(rand() * WIDE_POOL.length)];
      const a = ability[skill] ?? 0.1;
      const correct = rand() < a;
      ability[skill] = Math.min(0.97, a + 0.05 * (1 - a) * (correct ? 1 : 0.5));
      log.push({
        skill, correct,
        answeredAt: START + d * DAY + i * 60_000,
        latencyMs: 4000 + Math.floor(rand() * 4000),
        chosen: correct ? 'y' : 'x', expected: 'y', questionText: `q${d}-${i}`,
        timedOut: false, interaction: rand() < 0.5 ? 'entry' : 'choice',
        // Early wrong answers carry a diagnosed misconception; later ones do
        // not. That is what "cleared a misconception" means, and without it the
        // overcoming achievements have nothing to detect.
        misconception: !correct && d < 60 ? 'place-value-slip' : undefined,
        cls: '4th', category: SKILLS[skill].category, difficulty: 'medium',
      } as Attempt);
    }
  }
  return log;
}

function earned(log: Attempt[]) {
  const states = evaluateAchievements({
    log, estimates: estimateAll(log, NOW), cls: '4th', now: NOW,
  });
  return states.filter(s => s.earned).map(s => s.achievement.id);
}

describe('achievements cannot be earned without learning', () => {
  it('a year of random tapping earns nothing at all', () => {
    const got = earned(tapper());
    expect(got, `random tapping earned: ${got.join(', ')}`).toEqual([]);
  });

  it('a genuine learner earns a substantial share', () => {
    const got = earned(genuine());
    expect(got.length,
      `a genuine learner earned only ${got.length}/${ACHIEVEMENTS.length}`)
      .toBeGreaterThanOrEqual(6);
  });
});

describe('no achievement is dead', () => {
  it('every achievement shows progress for a genuine learner', () => {
    // Guards the failure this test was written for: three `overcoming`
    // achievements sat at exactly 0.00 for EVERY profile, because their
    // thresholds contradicted other systems (the success floor prevents the
    // 35% accuracy `turned-it-around` required; the scheduler's 6-day review
    // gap prevents the 21-day absence `came-back` required).
    const log = genuine();
    const states = evaluateAchievements({
      log, estimates: estimateAll(log, NOW), cls: '4th', now: NOW,
    });
    const dead = states.filter(s => s.progress === 0).map(s => s.achievement.id);
    expect(dead, `no progress at all after a year of genuine practice: ${dead.join(', ')}`)
      .toEqual([]);
  });

  it('every category is represented among what a genuine learner earns', () => {
    const log = genuine();
    const states = evaluateAchievements({
      log, estimates: estimateAll(log, NOW), cls: '4th', now: NOW,
    });
    const categories = new Set(ACHIEVEMENTS.map(a => a.category));
    const reachable = new Set(
      states.filter(s => s.progress > 0).map(s => s.achievement.category),
    );
    for (const c of categories) {
      expect(reachable.has(c), `category "${c}" is entirely unreachable`).toBe(true);
    }
  });
});
