// Economy simulation. Run: npx tsx progression/__sim__/economy.sim.ts
//
// Purpose: prove or disprove the central claim of the design —
//   "an exploiter cannot out-earn an honest learner"
// by simulating adversarial strategies against the real formula.

import { computeXp, demandOf, type Structure } from '../xp';
import { sessionDecay, repetitionDecay, skillSaturation, payableDelta, comebackMultiplier } from '../antiGrind';
import { levelForXp, cumulativeXpForLevel, masteryIndex } from '../levels';
import type { InteractionKind } from '../../generators/interactions';
import type { Difficulty } from '../../generators/types';

const DAY = 86_400_000;

/** Minimal mastery model mirroring learning/mastery.ts behaviour. */
class Learner {
  mastery: Record<string, number> = {};
  paidHighWater: Record<string, number> = {};
  totalXp = 0;
  answered = 0;
  perDay: Record<string, number> = {};
  perSkillDay: Record<string, number> = {};

  get(skill: string) { return this.mastery[skill] ?? 0.5; }

  /** Update mastery toward the outcome, with diminishing step size. */
  update(skill: string, correct: boolean) {
    const cur = this.get(skill);
    const step = correct ? 0.06 * (1 - cur) : -0.10 * cur;
    this.mastery[skill] = Math.max(0.02, Math.min(0.99, cur + step));
    return this.mastery[skill];
  }

  answer(args: {
    skill: string; correct: boolean; difficulty: Difficulty | 'expert';
    interaction: InteractionKind; structure: Structure; latencyMs: number;
    day: number; priorMisses?: number; questionText?: string;
  }) {
    const { skill, correct, difficulty, interaction, structure, latencyMs, day } = args;
    const before = this.get(skill);
    const after = this.update(skill, correct);

    const dk = String(day);
    this.perDay[dk] = (this.perDay[dk] ?? 0) + 1;
    const sk = `${skill}|${day}`;
    this.perSkillDay[sk] = (this.perSkillDay[sk] ?? 0) + 1;

    // High-water gate (E7): only unpaid mastery earns.
    const hw = this.paidHighWater[skill] ?? 0;
    const payable = payableDelta(before, after, hw);
    if (payable > 0) this.paidHighWater[skill] = Math.max(hw, after);

    const r = computeXp({
      correct,
      masteryBefore: before,
      // Feed the *payable* delta through as the effective after-value.
      masteryAfter: before + payable,
      skill, difficulty, interaction, structure, latencyMs,
      cls: '4th',
      priorMissesThisSkill: args.priorMisses ?? 0,
      sessionDecay: sessionDecay(this.perDay[dk]) * skillSaturation(this.perSkillDay[sk]),
    });

    this.totalXp += r.total;
    this.answered++;
    return r.total;
  }
}

const SKILLS_POOL = [
  'add.within10', 'add.within20', 'add.2digit.carry', 'add.3digit',
  'sub.2digit.borrow', 'sub.3digit', 'mul.tables.mid', 'mul.tables.full',
  'div.basic', 'div.tables', 'frac.equivalence', 'dec.tenths',
];

function report(name: string, l: Learner, days: number) {
  const { level } = levelForXp(l.totalXp);
  const mi = masteryIndex(Object.values(l.mastery));
  const xpPerQ = l.answered ? l.totalXp / l.answered : 0;
  console.log(
    `${name.padEnd(34)} XP=${String(Math.round(l.totalXp)).padStart(6)}  ` +
    `Lv=${String(level).padStart(3)}  MasteryIdx=${String(mi).padStart(3)}  ` +
    `Qs=${String(l.answered).padStart(5)}  XP/Q=${xpPerQ.toFixed(2).padStart(6)}  ` +
    `days=${days}`
  );
}

// ─── Strategy A · Honest learner ─────────────────────────────────────────────
// 20 questions/day, adaptive difficulty, ~75% success in the productive band.
function honest(days: number) {
  const l = new Learner();
  for (let d = 0; d < days; d++) {
    for (let i = 0; i < 20; i++) {
      const skill = SKILLS_POOL[Math.floor(Math.random() * SKILLS_POOL.length)];
      const m = l.get(skill);
      const difficulty: Difficulty = m < 0.5 ? 'easy' : m < 0.75 ? 'medium' : 'hard';
      const correct = Math.random() < 0.75;
      const interaction: InteractionKind = m >= 0.8 ? 'entry' : 'choice';
      l.answer({ skill, correct, difficulty, interaction, structure: 'singleStep',
        latencyMs: 5000 + Math.random() * 4000, day: d });
    }
  }
  return l;
}

// ─── Strategy B · Easy grinder ───────────────────────────────────────────────
// Farms one trivially-mastered skill on easy, 200 questions/day, 98% correct.
function grinder(days: number) {
  const l = new Learner();
  l.mastery['add.within10'] = 0.95;
  l.paidHighWater['add.within10'] = 0.95;
  for (let d = 0; d < days; d++) {
    for (let i = 0; i < 200; i++) {
      l.answer({ skill: 'add.within10', correct: Math.random() < 0.98,
        difficulty: 'easy', interaction: 'choice', structure: 'singleStep',
        latencyMs: 2500, day: d });
    }
  }
  return l;
}

// ─── Strategy C · Speed-tapper ───────────────────────────────────────────────
// Taps instantly, 25% correct by chance, enormous volume.
function tapper(days: number) {
  const l = new Learner();
  for (let d = 0; d < days; d++) {
    for (let i = 0; i < 400; i++) {
      const skill = SKILLS_POOL[i % SKILLS_POOL.length];
      l.answer({ skill, correct: Math.random() < 0.25, difficulty: 'hard',
        interaction: 'choice', structure: 'singleStep', latencyMs: 400, day: d });
    }
  }
  return l;
}

// ─── Strategy D · Difficulty farmer ──────────────────────────────────────────
// Always picks 'expert' to chase the multiplier, succeeds only 30% of the time.
function difficultyFarmer(days: number) {
  const l = new Learner();
  for (let d = 0; d < days; d++) {
    for (let i = 0; i < 60; i++) {
      const skill = SKILLS_POOL[i % SKILLS_POOL.length];
      l.answer({ skill, correct: Math.random() < 0.30, difficulty: 'expert',
        interaction: 'ordering', structure: 'metacognitive',
        latencyMs: 4000, day: d });
    }
  }
  return l;
}

// ─── Strategy E · Oscillation farmer ─────────────────────────────────────────
// Deliberately fails a skill to drop mastery, then re-earns it, forever.
function oscillator(days: number) {
  const l = new Learner();
  for (let d = 0; d < days; d++) {
    for (let cycle = 0; cycle < 20; cycle++) {
      for (let i = 0; i < 3; i++)
        l.answer({ skill: 'mul.tables.mid', correct: false, difficulty: 'medium',
          interaction: 'choice', structure: 'singleStep', latencyMs: 4000, day: d });
      for (let i = 0; i < 3; i++)
        l.answer({ skill: 'mul.tables.mid', correct: true, difficulty: 'medium',
          interaction: 'choice', structure: 'singleStep', latencyMs: 4000, day: d });
    }
  }
  return l;
}

// ─── Strategy F · Struggling but persistent ──────────────────────────────────
// Only 45% success, 15 questions/day. Must still progress visibly.
function struggler(days: number) {
  const l = new Learner();
  for (const s of SKILLS_POOL) l.mastery[s] = 0.25;
  for (let d = 0; d < days; d++) {
    for (let i = 0; i < 15; i++) {
      const skill = SKILLS_POOL[i % 6];
      l.answer({ skill, correct: Math.random() < 0.45, difficulty: 'easy',
        interaction: 'choice', structure: 'singleStep',
        latencyMs: 9000, day: d, priorMisses: Math.floor(Math.random() * 2) });
    }
  }
  return l;
}

// ─── Strategy G · Light-touch consistent ─────────────────────────────────────
// Only 8 questions/day but every single day — the habit we most want.
function consistent(days: number) {
  const l = new Learner();
  for (let d = 0; d < days; d++) {
    for (let i = 0; i < 8; i++) {
      const skill = SKILLS_POOL[(d + i) % SKILLS_POOL.length];
      const m = l.get(skill);
      const difficulty: Difficulty = m < 0.5 ? 'easy' : m < 0.75 ? 'medium' : 'hard';
      l.answer({ skill, correct: Math.random() < 0.78, difficulty,
        interaction: m >= 0.8 ? 'entry' : 'choice', structure: 'singleStep',
        latencyMs: 6000, day: d });
    }
  }
  return l;
}

// ─── Run ─────────────────────────────────────────────────────────────────────

const DAYS = 30;
console.log(`\n════ 30-DAY ECONOMY SIMULATION ════\n`);
const results: [string, Learner][] = [
  ['A honest learner (20/day)', honest(DAYS)],
  ['B easy grinder (200/day)', grinder(DAYS)],
  ['C speed-tapper (400/day)', tapper(DAYS)],
  ['D difficulty farmer (60/day)', difficultyFarmer(DAYS)],
  ['E oscillation farmer (120/day)', oscillator(DAYS)],
  ['F struggler (15/day, 45%)', struggler(DAYS)],
  ['G consistent (8/day)', consistent(DAYS)],
];
for (const [n, l] of results) report(n, l, DAYS);

console.log(`\n════ EXPLOIT RATIOS (vs honest learner) ════\n`);
const honestXp = results[0][1].totalXp;
const honestQ = results[0][1].answered;
for (const [n, l] of results.slice(1)) {
  const effortRatio = l.answered / honestQ;
  const xpRatio = l.totalXp / honestXp;
  const verdict = xpRatio <= 1.0 ? 'SAFE'
    : xpRatio / effortRatio < 0.5 ? 'SAFE (needs disproportionate effort)'
    : 'EXPLOITABLE';
  console.log(`${n.padEnd(34)} ${(xpRatio * 100).toFixed(0).padStart(4)}% XP for ` +
    `${(effortRatio * 100).toFixed(0).padStart(5)}% effort  → ${verdict}`);
}

console.log(`\n════ LEVEL CURVE ════\n`);
for (const lv of [2, 5, 10, 15, 20, 30, 40, 50, 75, 100]) {
  const cum = cumulativeXpForLevel(lv);
  // Honest learner earns ~X XP/day; estimate days to reach.
  const perDay = honestXp / DAYS;
  console.log(`  Level ${String(lv).padStart(3)}  cumulative XP ${String(cum).padStart(7)}  ` +
    `≈ ${(cum / perDay).toFixed(0).padStart(4)} days at honest pace`);
}
