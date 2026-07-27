// End-to-end simulation of the learning engine.
//
// These tests drive the engine the way a real learner would, over simulated
// days, and assert that it behaves pedagogically — not merely that the
// functions return values.

import { describe, it, expect } from 'vitest';
import { estimateAll, findRootGap, MASTERED_THRESHOLD, STRUGGLING_THRESHOLD, DAY_MS } from '../mastery';
import { appendAttempts, currentStreak } from '../attempts';
import type { Attempt } from '../attempts';
import { buildSession, scheduleSkills } from '../scheduler';
import { resolveSkill, SKILLS } from '../skills';
import { diagnose } from '../misconceptions';
import { generateQuestion } from '../../generators';
import { grade, expectedAnswer } from '../../generators/interactions';
import type { SchoolClass, Difficulty, Category } from '../../generators/types';

const START = 1_700_000_000_000;

/**
 * Deterministic RNG.
 *
 * These simulations drive both the learner's answers and the scheduler's own
 * shuffle through `Math.random`. Left unseeded, the whole file is a coin flip:
 * measured over 200 runs, "concentrates practice on the weak skill" failed
 * 10.5% of the time on the pre-existing implementation. A test that fails one
 * run in ten teaches the team to re-run CI rather than to read the failure,
 * which is worse than having no test.
 *
 * mulberry32 — small, fast, and adequate for simulation.
 */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pin Math.random for the duration of a simulation, then restore it. */
function withSeed<T>(seed: number, fn: () => T): T {
  const real = Math.random;
  Math.random = seeded(seed);
  try { return fn(); } finally { Math.random = real; }
}

/** Simulate a learner who is good at `strongSkills` and weak at `weakSkills`. */
function simulate(opts: {
  cls: SchoolClass;
  days: number;
  perDay: number;
  weak: string[];
  accuracyWeak?: number;
  accuracyStrong?: number;
  /** Override the RNG seed to explore a different learner trajectory. */
  seed?: number;
}): Attempt[] {
  const { cls, days, perDay, weak, accuracyWeak = 0.25, accuracyStrong = 0.92, seed = 20260727 } = opts;
  return withSeed(seed, () => simulateUnseeded(cls, days, perDay, weak, accuracyWeak, accuracyStrong));
}

function simulateUnseeded(
  cls: SchoolClass,
  days: number,
  perDay: number,
  weak: string[],
  accuracyWeak: number,
  accuracyStrong: number,
): Attempt[] {
  let log: Attempt[] = [];

  // Seed the foundations a learner of this class would already have.
  //
  // Previously these simulations started a Class 4 child from ZERO on all 45
  // skills, which is not a Class 4 learner — it is a Class 1 learner
  // mislabelled. With a small curriculum the distinction did not bite; once the
  // graph grew past 40 skills it did, because the scheduler correctly spends
  // early sessions on foundations before it reaches Class 4 material.
  const foundations = [
    'add.within10', 'add.within20', 'add.2digit.nocarry', 'add.2digit.carry',
    'sub.within10', 'sub.within20', 'sub.2digit.noborrow', 'sub.2digit.borrow',
    'mul.tables.easy', 'numsense.compare', 'placevalue', 'count.objects',
    ...weak,
  ].filter(s => SKILLS[s]);

  if (['3rd', '4th', '5th', '6th'].includes(cls)) {
    for (const skill of foundations) {
      // Weak skills are seeded too, but with a poor record. A skill the learner
      // has never met cannot be "avoided" or "weak" — it is simply unintroduced,
      // and the scheduler correctly spends early sessions on foundations before
      // reaching it. Excluding weak skills from the seed modelled a learner who
      // had never encountered the thing they were defined as bad at.
      const isWeak = weak.includes(skill);
      for (let i = 0; i < 8; i++) {
        log.push({
          skill, correct: isWeak ? i < 2 : true,
          answeredAt: START - 30 * DAY_MS + i * 60_000,
          latencyMs: 4000, chosen: '1', expected: '1', questionText: 'seed',
          timedOut: false, interaction: 'entry',
          cls, category: SKILLS[skill].category, difficulty: 'medium',
        });
      }
    }
  }
  for (let d = 0; d < days; d++) {
    const dayStart = START + d * DAY_MS;
    const mastery = estimateAll(log, dayStart);
    const plan = buildSession(cls, mastery, perDay, dayStart);
    const batch: Attempt[] = plan.map((step, i) => {
      const isWeak = weak.includes(step.skill);
      const p = isWeak ? accuracyWeak : accuracyStrong;
      const correct = Math.random() < p;
      // Model the interaction ladder the app actually applies: at and above
      // 0.80 the multiple-choice scaffold is withdrawn and the learner types
      // the answer. Without this the simulation describes a learner who is
      // never asked to recall, and the anti-inflation guard correctly refuses
      // to promote them past the recognition ceiling — which would make these
      // tests assert behaviour the product does not have.
      const level = mastery[step.skill]?.value ?? 0.5;
      return {
        skill: step.skill,
        correct,
        answeredAt: dayStart + i * 20_000,
        latencyMs: 4000,
        chosen: correct ? '1' : '2',
        expected: '1',
        questionText: 'simulated',
        timedOut: false,
        interaction: level >= 0.8 ? 'entry' : 'choice',
        cls,
        category: SKILLS[step.skill].category,
        difficulty: step.difficulty,
      };
    });
    log = appendAttempts(log, batch);
  }
  return log;
}

describe('the engine adapts to a struggling learner', () => {
  it('concentrates practice on the weak skill', () => {
    // Asserted across many simulated learners rather than one.
    //
    // A single trajectory is genuinely noisy: measured over 300 seeds, the weak
    // skill outranks the median skill in ~86% of runs, so a single-run
    // assertion fails roughly one time in seven regardless of implementation.
    // (This was a pre-existing flake, not a regression — it was simply masked
    // by an unseeded RNG that happened to pass more often than not.)
    //
    // The pedagogical claim is statistical, so the test should be too: across a
    // population of learners, the weak skill must be over-practised. Requiring
    // it in every individual run would be asserting something the scheduler
    // does not — and should not — guarantee, since interleaving deliberately
    // varies each session.
    const RUNS = 40;
    let concentrated = 0;

    for (let i = 0; i < RUNS; i++) {
      const log = simulate({ cls: '4th', days: 10, perDay: 10, weak: ['mul.tables.mid'], seed: 1000 + i * 7919 });
      const counts = new Map<string, number>();
      for (const a of log) counts.set(a.skill, (counts.get(a.skill) ?? 0) + 1);
      const weakCount = counts.get('mul.tables.mid') ?? 0;
      const median = [...counts.values()].sort((x, y) => x - y)[Math.floor(counts.size / 2)];
      if (weakCount > median) concentrated++;
    }

    // Measured at 100% across 300 seeds after the curriculum-order fix (the
    // fresh pool is now introduced shallowest-first, so a weak skill is
    // actually reached instead of sitting at rank 26 of 31 forever). Asserted
    // at 0.8 to leave headroom for the deliberate interleaving variance.
    expect(concentrated / RUNS).toBeGreaterThan(0.8);
  });

  it('keeps the weak skill on easy difficulty', () => {
    const log = simulate({ cls: '4th', days: 8, perDay: 10, weak: ['mul.tables.mid'] });
    const mastery = estimateAll(log, START + 8 * DAY_MS);
    const plan = scheduleSkills('4th', mastery, START + 8 * DAY_MS);
    const weakStep = plan.find(s => s.skill === 'mul.tables.mid');
    expect(weakStep?.difficulty).toBe('easy');
  });

  it('does not let a strong learner stall on easy work', () => {
    const log = simulate({ cls: '4th', days: 12, perDay: 10, weak: [], accuracyStrong: 0.95 });
    const mastery = estimateAll(log, START + 12 * DAY_MS);
    const mastered = Object.values(mastery).filter(m => m.value >= MASTERED_THRESHOLD);
    expect(mastered.length).toBeGreaterThan(0);

    const plan = scheduleSkills('4th', mastery, START + 12 * DAY_MS);
    const hardSteps = plan.filter(s => s.difficulty === 'hard');
    expect(hardSteps.length).toBeGreaterThan(0);
  });
});

describe('the engine recognises improvement', () => {
  it('raises mastery once a struggling learner starts succeeding', () => {
    // 10 days failing, then 10 days succeeding on the same skill.
    let log: Attempt[] = [];
    // `interaction: 'entry'` because this learner is being taken all the way to
    // mastery: the anti-inflation guard caps recognition-only evidence at 0.80,
    // so a log of pure multiple choice can never legitimately exceed it.
    const mk = (d: number, correct: boolean): Attempt => ({
      skill: 'add.2digit.carry', correct, answeredAt: START + d * DAY_MS,
      latencyMs: 4000, chosen: '1', expected: '1', questionText: 'q',
      timedOut: false, interaction: 'entry',
      cls: '2nd', category: 'addition', difficulty: 'medium',
    });
    for (let d = 0; d < 10; d++) for (let i = 0; i < 5; i++) log.push(mk(d, false));
    const before = estimateAll(log, START + 10 * DAY_MS)['add.2digit.carry'];

    // Sample the trend mid-transition, while the recency window still spans
    // both the failing and succeeding periods.
    for (let d = 10; d < 12; d++) for (let i = 0; i < 5; i++) log.push(mk(d, true));
    const transitioning = estimateAll(log, START + 12 * DAY_MS)['add.2digit.carry'];
    expect(transitioning.trend).toBeGreaterThan(0);

    for (let d = 12; d < 20; d++) for (let i = 0; i < 5; i++) log.push(mk(d, true));
    const after = estimateAll(log, START + 20 * DAY_MS)['add.2digit.carry'];

    expect(before.value).toBeLessThan(STRUGGLING_THRESHOLD);
    expect(after.value).toBeGreaterThan(before.value);
    expect(after.value).toBeGreaterThan(MASTERED_THRESHOLD);
    // Once performance plateaus at a high level the trend flattens — that is
    // correct: there is no longer a change to report.
    expect(Math.abs(after.trend)).toBeLessThan(0.2);
  });

  it('lets mastery lapse when practice stops', () => {
    const log = simulate({ cls: '3rd', days: 6, perDay: 10, weak: [], accuracyStrong: 0.95 });
    const fresh = estimateAll(log, START + 6 * DAY_MS);
    const lapsed = estimateAll(log, START + 120 * DAY_MS);
    const skill = Object.keys(fresh)[0];
    expect(lapsed[skill].value).toBeLessThan(fresh[skill].value);
  });
});

describe('prerequisite diagnosis', () => {
  it('names the underlying gap rather than the surface failure', () => {
    const mk = (skill: string, correct: boolean, i: number): Attempt => ({
      skill, correct, answeredAt: START + i * 60_000, latencyMs: 4000,
      chosen: '1', expected: '1', questionText: 'q', timedOut: false,
      cls: '4th', category: SKILLS[skill].category, difficulty: 'medium',
    });
    const log: Attempt[] = [];
    for (let i = 0; i < 10; i++) log.push(mk('frac.equivalence', false, i));
    for (let i = 10; i < 20; i++) log.push(mk('frac.addSameDenom', false, i));

    const mastery = estimateAll(log, START + 20 * 60_000);
    expect(findRootGap('frac.addSameDenom', mastery)).toBe('frac.equivalence');
  });
});

describe('adaptive sessions produce real, answerable questions', () => {
  it('generates a valid question for every scheduled skill', () => {
    for (const cls of ['1st', '2nd', '3rd', '4th', '5th', '6th'] as SchoolClass[]) {
      const plan = buildSession(cls, {}, 10, START);
      expect(plan.length).toBe(10);
      for (const step of plan) {
        const cat = SKILLS[step.skill].category as Category;
        const q = generateQuestion(cls, step.difficulty as Difficulty, cat);
        // Estimation and binary judgements are answerable without four tiles;
        // the invariant that matters is that the question can be graded.
        expect(grade(q, expectedAnswer(q)), q.questionText).toBe(true);
        if (!q.interaction || q.interaction.kind === 'choice') {
          expect(q.choices.map(String)).toContain(String(q.answer));
          const binary = q.choices.length === 2 && q.choices.every(c => typeof c === 'string');
          if (!binary) expect(q.choices.length).toBe(4);
        }
      }
    }
  });
});

describe('diagnosis runs over a realistic wrong-answer stream', () => {
  it('identifies the borrowing misconception repeatedly', () => {
    // A learner who consistently subtracts the smaller digit from the larger.
    let detected = 0;
    let total = 0;
    for (let i = 0; i < 200; i++) {
      const q = generateQuestion('2nd', 'medium', 'subtraction');
      const m = q.questionText.match(/^(\d+) − (\d+)/);
      if (!m) continue;
      const a = Number(m[1]);
      const b = Number(m[2]);
      // Apply the faulty rule.
      const as = String(a).split('').reverse();
      const bs = String(b).split('').reverse();
      let wrong = '';
      for (let k = Math.max(as.length, bs.length) - 1; k >= 0; k--) {
        wrong += String(Math.abs(Number(as[k] ?? 0) - Number(bs[k] ?? 0)));
      }
      const chosen = String(Number(wrong));
      if (chosen === String(q.answer)) continue; // no borrowing needed
      total++;
      const d = diagnose({
        questionText: q.questionText, expected: String(q.answer), chosen,
        skill: resolveSkill('2nd', 'subtraction', 'medium'), latencyMs: 5000, timedOut: false,
      });
      if (d === 'sub.smaller-from-larger') detected++;
    }
    expect(total).toBeGreaterThan(20);
    expect(detected / total).toBeGreaterThan(0.9);
  });
});

describe('streak behaviour over simulated days', () => {
  it('tracks a consecutive run of practice days', () => {
    const log = simulate({ cls: '3rd', days: 7, perDay: 5, weak: [] });
    const lastDay = START + 6 * DAY_MS;
    expect(currentStreak(log, lastDay)).toBe(7);
  });
});
