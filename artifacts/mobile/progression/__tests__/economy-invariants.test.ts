// ─── Economy invariants ──────────────────────────────────────────────────────
// docs/21 · the guarantees the XP economy must never lose.
//
// These are not unit tests of a formula. They are the behavioural claims the
// whole design rests on, asserted against the real pipeline:
//
//   1 · learning must out-earn not-learning
//   2 · an answer the engine refuses to price must pay nothing
//   3 · no threshold may be crossed for profit more than once
//   4 · no amount of volume on one skill may substitute for progress
//
// Every one of these was FALSE before the docs/21 remediation, and each failure
// was worth thousands of XP to an exploiter. If any of them regresses, the
// economy has silently inverted again and children will find it long before we
// do — so these run in CI, not in an audit that happens once.

import { describe, it, expect } from 'vitest';
import { recordAnswer, type AnswerState } from '../recordAnswer';
import { levelForXp } from '../levels';
import { estimateMastery } from '../../learning/mastery';
import { MAX_XP_PER_QUESTION } from '../xp';

const START = Date.UTC(2026, 0, 1, 9);
const SKILL = 'add.3digit';

function q(text: string) {
  return { questionText: text, answer: '7', choices: ['1', '2', '3', '7'] } as never;
}

function answer(state: AnswerState, opts: {
  correct: boolean; now: number; latencyMs?: number; text?: string;
}) {
  return recordAnswer(state, {
    question: q(opts.text ?? `q-${opts.now}`),
    chosen: opts.correct ? '7' : '1',
    correct: opts.correct,
    latencyMs: opts.latencyMs ?? 5000,
    timedOut: false,
    plannedSkill: SKILL,
    cls: '4th',
    sessionCategory: 'addition',
    difficulty: 'medium',
    isTablesMode: false,
    now: opts.now,
  });
}

const blank = (): AnswerState => ({ log: [], ledger: {}, totalXp: 0 });

describe('I1 · honest practice out-earns every gaming strategy', () => {
  it('a perfect learner beats a threshold-cycler over the same question count', () => {
    // The cycler deliberately misses to re-cross STRUGGLING_THRESHOLD and
    // re-collect breakthrough/recovered. Before the fix this earned 1,840 XP
    // against the honest learner's 350 — answering worse was worth 5.3x more.
    let honest = blank();
    let cycler = blank();
    for (let i = 0; i < 200; i++) {
      const now = START + i * 30_000;
      honest = answer(honest, { correct: true, now }).state;
      cycler = answer(cycler, { correct: i % 5 !== 0 && i % 5 !== 1, now }).state;
    }
    expect(honest.totalXp).toBeGreaterThan(cycler.totalXp);
  });

  it('a learner who never improves cannot out-earn one who does', () => {
    // Same volume, same cadence: one answers accurately, the other at ~25%
    // (chance on four tiles) forever.
    let learner = blank();
    let flatliner = blank();
    for (let i = 0; i < 400; i++) {
      const now = START + i * 60_000;
      learner = answer(learner, { correct: i % 10 !== 0, now }).state;
      flatliner = answer(flatliner, { correct: i % 4 === 0, now }).state;
    }
    expect(learner.totalXp).toBeGreaterThan(flatliner.totalXp);
    expect(levelForXp(learner.totalXp).level)
      .toBeGreaterThanOrEqual(levelForXp(flatliner.totalXp).level);
  });
});

describe('I2 · suppressed answers pay nothing, bonuses included', () => {
  it('sub-plausibility taps earn zero however many are made', () => {
    // 400 taps at 120 ms. Every one is a declared non-attempt. Before the fix
    // these paid 3,020 XP and reached level 7 in 100 minutes.
    let st = blank();
    for (let i = 0; i < 400; i++) {
      const r = answer(st, { correct: i % 4 === 0, now: START + i * 15_000, latencyMs: 120 });
      st = r.state;
      expect(r.award.total).toBe(0);
      expect(r.award.bonuses).toHaveLength(0);
    }
    expect(st.totalXp).toBe(0);
    expect(levelForXp(st.totalXp).level).toBe(1);
  });

  it('wrong answers never pay, and never pay a bonus', () => {
    let st = blank();
    for (let i = 0; i < 50; i++) {
      const r = answer(st, { correct: false, now: START + i * 30_000 });
      st = r.state;
      expect(r.award.total).toBe(0);
    }
    expect(st.totalXp).toBe(0);
  });
});

describe('I3 · thresholds pay once, not once per crossing', () => {
  it('sawtooth cycling a skill converges to near-zero income', () => {
    // Drive mastery down with misses, back up with hits, repeatedly. Before the
    // fix this paid 7,983 XP for 846 questions on ONE skill, with mastery
    // unchanged at 0.718 — 98.5% of it from bonuses.
    let st = blank();
    let now = START;
    for (let i = 0; i < 6; i++) st = answer(st, { correct: false, now: now += 30_000 }).state;

    const xpAfterCycle: number[] = [];
    for (let c = 0; c < 12; c++) {
      const before = st.totalXp;
      for (let i = 0; i < 6; i++) st = answer(st, { correct: false, now: now += 30_000 }).state;
      for (let i = 0; i < 8; i++) st = answer(st, { correct: true, now: now += 30_000 }).state;
      xpAfterCycle.push(st.totalXp - before);
    }
    // Later cycles must pay essentially nothing: the ledger has already bought
    // this ground and the suppressors have collapsed.
    const late = xpAfterCycle.slice(-6).reduce((a, b) => a + b, 0);
    expect(late).toBeLessThan(5);
  });
});

describe('I4 · volume cannot substitute for progress', () => {
  it('grinding one identical question all day converges to zero', () => {
    let st = blank();
    let now = START;
    const payouts: number[] = [];
    for (let i = 0; i < 300; i++) {
      const r = answer(st, { correct: true, now: now += 20_000, text: 'IDENTICAL 12 + 34 = ?' });
      st = r.state;
      payouts.push(r.award.total);
    }
    const lastFifty = payouts.slice(-50).reduce((a, b) => a + b, 0);
    expect(lastFifty).toBe(0);
  });

  it('no single answer can exceed the per-question ceiling', () => {
    // The ceiling must bound what the learner is actually paid, not an
    // internal subtotal that bonuses are then added to.
    let st = blank();
    let now = START;
    for (let i = 0; i < 400; i++) {
      const r = answer(st, { correct: i % 3 !== 0, now: now += 45_000 });
      st = r.state;
      expect(r.award.total).toBeLessThanOrEqual(MAX_XP_PER_QUESTION);
    }
  });
});

describe('I5 · difficulty selection cannot be farmed', () => {
  it('easy content does not out-earn adaptive content per question', () => {
    // docs/21. The estimator ignored difficulty, so a correct EASY answer moved
    // mastery exactly as far as a correct hard one — and since XP is paid for
    // delta-mastery, "stay on easy" became the most profitable strategy in the
    // app. Measured: an always-easy learner earned 86,404 XP against 54,935 for
    // the same learner on adaptive difficulty, while learning slightly less.
    //
    // Asserted per QUESTION rather than per year, so the test is about the
    // pricing rule and not about how much either learner practised.
    const answersPerSkill = 60;
    const run = (difficulty: 'easy' | 'medium') => {
      let st = blank();
      let now = START;
      for (let i = 0; i < answersPerSkill; i++) {
        // Same underlying success rate; only the stated difficulty differs.
        const correct = i % 5 !== 0;
        st = recordAnswer(st, {
          question: q(`q-${difficulty}-${i}`),
          chosen: correct ? '7' : '1', correct,
          latencyMs: 5000, timedOut: false, plannedSkill: SKILL,
          cls: '4th', sessionCategory: 'addition', difficulty,
          isTablesMode: false, now: now += 40_000,
        }).state;
      }
      return st.totalXp / answersPerSkill;
    };
    expect(run('easy')).toBeLessThanOrEqual(run('medium'));
  });

  it('mastery itself moves further on harder evidence', () => {
    // The multiplier alone is not enough, and asserting only on XP hides that:
    // the DIFFICULTY_MULTIPLIER would satisfy the check above even with a
    // difficulty-blind estimator, leaving the underlying exploit — inflating
    // the mastery estimate with easy wins — wide open. Since XP is paid for
    // delta-mastery, the estimator is where this has to be true.
    const climb = (difficulty: 'easy' | 'hard') => {
      let st = blank();
      let now = START;
      for (let i = 0; i < 12; i++) {
        st = recordAnswer(st, {
          question: { questionText: `q${i}`, answer: '7', choices: [], interaction: { kind: 'entry', inputMode: 'integer' } } as never,
          chosen: '7', correct: true, latencyMs: 6000, timedOut: false,
          plannedSkill: SKILL, cls: '4th', sessionCategory: 'addition',
          difficulty, isTablesMode: false, now: now += 40_000,
        }).state;
      }
      return estimateMastery(SKILL, st.log, now).value;
    };
    expect(climb('hard')).toBeGreaterThan(climb('easy'));
  });
});

describe('I6 · support is never more profitable than independence', () => {
  it('answering with a hint on screen earns less than answering unaided', () => {
    // docs/21 · X8. BONUS.transferAfterTeaching fired on EVERY scaffolded
    // correct answer at 35 XP with no cooldown, so 600 hinted questions paid
    // 17,741 XP against 758 unaided — never working without help was worth 23x
    // more than working independently. For a learning product that is the most
    // damaging incentive available: the entire purpose of a scaffold is to be
    // faded, and the economy was paying children not to fade it.
    const run = (scaffolded: boolean) => {
      let st = blank();
      let now = START;
      for (let d = 0; d < 20; d++) {
        for (let i = 0; i < 20; i++) {
          st = recordAnswer(st, {
            question: q(`q${d}-${i}`),
            chosen: '7', correct: true, latencyMs: 5200, timedOut: false, scaffolded,
            plannedSkill: SKILL, cls: '4th', sessionCategory: 'addition',
            difficulty: 'medium', isTablesMode: false,
            now: now + d * 86_400_000 + i * 90_000,
          }).state;
        }
      }
      return st.totalXp;
    };
    expect(run(true)).toBeLessThan(run(false));
  });
});
