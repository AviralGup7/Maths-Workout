// XP award orchestration — docs/16 Phases A and B.
//
// The economy was simulated in isolation before it was wired up. These tests
// check the WIRING: that the pieces are assembled correctly at the one call
// site, and in particular that the exploit resistance survives contact with
// real attempt logs rather than only holding in the simulator.

import { describe, it, expect } from 'vitest';
import { awardXp, structureOf, detectBonuses, type XpLedger } from '../award';
import { BONUS } from '../xp';
import { BONUS_LABEL } from '../labels';
import type { Attempt } from '../../learning/attempts';
import type { Question } from '../../generators/types';
import { hasDevanagariDigits } from '../../i18n/strings';

const NOW = 1_700_000_000_000;

const q = (over: Partial<Question> = {}): Question => ({
  questionText: '7 × 8 = ?', answer: 56, choices: [56, 54, 58, 63], ...over,
});

const mk = (skill: string, correct: boolean, i = 0, over: Partial<Attempt> = {}): Attempt => ({
  skill, correct, answeredAt: NOW - (100 - i) * 60_000, latencyMs: 5000,
  chosen: '1', expected: '1', questionText: 'q', timedOut: false,
  cls: '4th', category: 'multiplication', difficulty: 'medium', ...over,
});

const baseInput = {
  question: q(), skill: 'mul.tables.mid', correct: true,
  masteryBefore: 0.4, masteryAfter: 0.46, latencyMs: 5000,
  difficulty: 'medium' as const, cls: '4th' as const,
  priorMissesThisSkill: 0, log: [] as Attempt[], ledger: {} as XpLedger, now: NOW,
};

describe('awarding XP', () => {
  it('pays for mastery gained', () => {
    const a = awardXp(baseInput);
    expect(a.xp).toBeGreaterThan(0);
  });

  it('pays nothing for a wrong answer, and takes nothing away', () => {
    // The cost of a mistake is already paid in the mastery model. Charging XP
    // as well would double-punish and teach children to avoid difficulty.
    const a = awardXp({ ...baseInput, correct: false, masteryAfter: 0.34 });
    expect(a.xp).toBe(0);
    expect(a.total).toBe(0);
  });

  it('pays only the floor when mastery did not move', () => {
    const a = awardXp({ ...baseInput, masteryBefore: 0.95, masteryAfter: 0.95 });
    expect(a.xp).toBeLessThan(3);
  });

  it('pays nothing at all for an implausibly fast answer', () => {
    const a = awardXp({ ...baseInput, latencyMs: 200 });
    expect(a.xp).toBe(0);
    expect(a.breakdown.suppressed).toBe('non-attempt');
  });
});

describe('the high-water ledger stops oscillation farming', () => {
  it('records the high-water mark when mastery advances', () => {
    const a = awardXp(baseInput);
    expect(a.ledger['mul.tables.mid']).toBeCloseTo(0.46, 5);
  });

  it('pays nothing for re-earning mastery already paid for', () => {
    // The exploit unique to a Δmastery economy: let a skill decay, then re-earn
    // the same band forever. Paying on high-water mark makes it worthless.
    const ledger: XpLedger = { 'mul.tables.mid': 0.80 };
    const a = awardXp({ ...baseInput, masteryBefore: 0.60, masteryAfter: 0.66, ledger });
    expect(a.xp).toBeLessThan(3);
    expect(a.ledger['mul.tables.mid']).toBe(0.80);   // unchanged
  });

  it('resumes paying once the learner passes their previous best', () => {
    const ledger: XpLedger = { 'mul.tables.mid': 0.70 };
    const a = awardXp({ ...baseInput, masteryBefore: 0.68, masteryAfter: 0.78, ledger });
    expect(a.xp).toBeGreaterThan(3);
    expect(a.ledger['mul.tables.mid']).toBeCloseTo(0.78, 5);
  });
});

describe('anti-grind suppressors are actually applied', () => {
  it('decays a long single-day binge', () => {
    const heavy = Array.from({ length: 200 }, (_, i) =>
      mk('mul.tables.mid', true, i, { answeredAt: NOW - i * 1000 }));
    const fresh = awardXp(baseInput).xp;
    const ground = awardXp({ ...baseInput, log: heavy }).xp;
    expect(ground).toBeLessThan(fresh);
  });

  it('decays repeated drilling of one skill in a day', () => {
    const drilled = Array.from({ length: 25 }, (_, i) =>
      mk('mul.tables.mid', true, i, { answeredAt: NOW - i * 1000 }));
    expect(awardXp({ ...baseInput, log: drilled }).xp)
      .toBeLessThan(awardXp(baseInput).xp);
  });

  it('decays an identical repeated question', () => {
    const same = Array.from({ length: 8 }, (_, i) =>
      mk('mul.tables.mid', true, i, { questionText: '7 × 8 = ?', answeredAt: NOW - i * 1000 }));
    expect(awardXp({ ...baseInput, log: same }).xp)
      .toBeLessThan(awardXp(baseInput).xp);
  });

  it('an easy grinder cannot out-earn a learner who is improving', () => {
    // End-to-end check of the central claim, against real logs.
    const grindLog = Array.from({ length: 150 }, (_, i) =>
      mk('add.within10', true, i, { answeredAt: NOW - i * 1000, questionText: '2 + 3 = ?' }));
    const grinder = awardXp({
      ...baseInput, skill: 'add.within10',
      masteryBefore: 0.95, masteryAfter: 0.95,
      ledger: { 'add.within10': 0.95 }, log: grindLog,
      question: q({ questionText: '2 + 3 = ?' }),
    });
    const learner = awardXp(baseInput);
    expect(grinder.total).toBeLessThan(learner.total);
  });
});

describe('bonuses fire on change of state, never on volume', () => {
  it('awards a breakthrough for crossing the struggling threshold', () => {
    const b = detectBonuses({
      correct: true, masteryBefore: 0.50, masteryAfter: 0.58,
      skill: 'mul.tables.mid', log: Array.from({ length: 6 }, (_, i) => mk('mul.tables.mid', false, i)),
    });
    expect(b.map(x => x.id)).toContain('breakthrough');
  });

  it('awards mastery, plus trueRecall only on produced evidence', () => {
    const log = Array.from({ length: 6 }, (_, i) => mk('mul.tables.mid', true, i));
    const choice = detectBonuses({
      correct: true, masteryBefore: 0.80, masteryAfter: 0.88,
      skill: 'mul.tables.mid', log, interaction: 'choice',
    });
    expect(choice.map(x => x.id)).toContain('mastery');
    expect(choice.map(x => x.id)).not.toContain('trueRecall');

    const typed = detectBonuses({
      correct: true, masteryBefore: 0.80, masteryAfter: 0.88,
      skill: 'mul.tables.mid', log, interaction: 'entry',
    });
    expect(typed.map(x => x.id)).toContain('trueRecall');
  });

  it('awards transfer when a scaffold was on screen', () => {
    const b = detectBonuses({
      correct: true, masteryBefore: 0.3, masteryAfter: 0.34,
      skill: 'mul.tables.mid', log: [mk('mul.tables.mid', false, 0)], scaffolded: true,
    });
    expect(b.map(x => x.id)).toContain('transferAfterTeaching');
  });

  it('awards nothing for a wrong answer', () => {
    expect(detectBonuses({
      correct: false, masteryBefore: 0.3, masteryAfter: 0.28,
      skill: 'mul.tables.mid', log: [],
    })).toEqual([]);
  });

  it('has no volume-based bonus anywhere in the table', () => {
    // The archetypal metric that rewards attendance over learning.
    for (const id of Object.keys(BONUS)) {
      expect(id).not.toMatch(/count|questions|total|streak/i);
    }
  });
});

describe('question structure is read from shape, not topic', () => {
  it('recognises estimation', () => {
    expect(structureOf(
      q({ interaction: { kind: 'estimate', low: 10, high: 20, bands: [] } }),
      'numsense.estimate',
    )).toBe('estimation');
  });

  it('recognises a metacognitive judgement', () => {
    expect(structureOf(q({ questionText: 'Priya says 6 × 4 = 10. Does that seem sensible?' }),
      'numsense.reasonable')).toBe('metacognitive');
  });

  it('recognises multi-step work', () => {
    expect(structureOf(q(), 'mul.2digit')).toBe('multiStep');
    expect(structureOf(q(), 'wordproblems')).toBe('multiStep');
  });

  it('treats ordinary arithmetic as single-step regardless of topic', () => {
    // Paying more for "division" than "addition" would double-count difficulty
    // (mastery already captures it) and penalise young learners for their age.
    expect(structureOf(q(), 'div.basic')).toBe('singleStep');
    expect(structureOf(q(), 'add.within10')).toBe('singleStep');
  });
});

describe('bonus copy', () => {
  it('names every bonus in both languages', () => {
    for (const id of Object.keys(BONUS) as (keyof typeof BONUS)[]) {
      expect(BONUS_LABEL[id], id).toBeDefined();
      expect(BONUS_LABEL[id].en.length).toBeGreaterThan(0);
      expect(BONUS_LABEL[id].hi.length).toBeGreaterThan(0);
    }
  });

  it('names the achievement rather than the mechanic', () => {
    for (const label of Object.values(BONUS_LABEL)) {
      expect(label.en).not.toMatch(/XP|bonus|multiplier|\d/i);
    }
  });

  it('follows the semi-Hindi policy', () => {
    for (const label of Object.values(BONUS_LABEL)) {
      expect(hasDevanagariDigits(label.hi)).toBe(false);
    }
  });
});
