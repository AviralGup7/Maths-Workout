// Scheduler behaviour at curriculum scale.
//
// Three bugs surfaced when the skill graph grew from 41 to 45 skills. All three
// were latent before — the extra skills only made them visible — and all three
// silently harmed the learner rather than crashing, which is why they need
// permanent guards rather than a one-off fix.

import { describe, it, expect } from 'vitest';
import { estimateAll, MASTERED_THRESHOLD, DAY_MS } from '../mastery';
import { buildSession, scheduleSkills, OVER_PRACTICE_CAP } from '../scheduler';
import type { Attempt } from '../attempts';
import { SKILLS, ALL_SKILL_IDS } from '../skills';

const NOW = 1_700_000_000_000;

const mk = (skill: string, correct: boolean, i: number, cls = '4th'): Attempt => ({
  skill, correct, answeredAt: NOW - (100 - i) * 60_000, latencyMs: 4000,
  chosen: '1', expected: '1', questionText: 'q', timedOut: false,
  interaction: 'entry', cls: cls as never,
  category: SKILLS[skill].category, difficulty: 'medium',
});

/** A learner with secure foundations, as a Class 4 child would have. */
function seasoned(weakSkill?: string): Attempt[] {
  const log: Attempt[] = [];
  const base = [
    'add.within10', 'add.within20', 'add.2digit.nocarry', 'add.2digit.carry',
    'sub.within10', 'sub.within20', 'sub.2digit.noborrow', 'sub.2digit.borrow',
    'mul.tables.easy', 'mul.tables.mid', 'numsense.compare', 'placevalue', 'count.objects',
  ];
  for (const s of base) for (let i = 0; i < 8; i++) log.push(mk(s, s !== weakSkill, i));
  if (weakSkill && !base.includes(weakSkill)) {
    for (let i = 0; i < 10; i++) log.push(mk(weakSkill, false, i));
  }
  return log;
}

describe('B1 · a practised skill is never dropped from the ranking', () => {
  it('schedules a weak skill even when its category is off the class menu', () => {
    // The candidate set was built only from resolveSkill over the current
    // class's categories, and resolveSkill maps each (class, category,
    // difficulty) cell to ONE skill. A learner who met factors.basic through
    // Mixed practice, a board change, or a different class could sit at 0.06
    // mastery with 10 attempts and never be scheduled to repair it.
    const log = seasoned('factors.basic');
    const est = estimateAll(log, NOW);

    expect(est['factors.basic'].attempts).toBeGreaterThan(0);
    expect(est['factors.basic'].value).toBeLessThan(0.4);

    const ranked = scheduleSkills('4th', est, NOW);
    expect(ranked.some(s => s.skill === 'factors.basic'),
      'a skill with real practice history must be schedulable').toBe(true);
  });

  it('never silently discards evidence the learner generated', () => {
    // Property form of the same claim, over every skill in the graph.
    for (const skill of ALL_SKILL_IDS) {
      const log = Array.from({ length: 6 }, (_, i) => mk(skill, false, i));
      const est = estimateAll(log, NOW);
      const ranked = scheduleSkills('4th', est, NOW);
      expect(ranked.some(s => s.skill === skill), `${skill} was dropped`).toBe(true);
    }
  });
});

describe('B2 · new material is introduced in curriculum order', () => {
  it('introduces foundations before the material built on them', () => {
    const ranked = scheduleSkills('4th', {}, NOW).filter(s => s.reason === 'new');
    const rank = (s: string) => ranked.findIndex(r => r.skill === s);

    // Every prerequisite must be offered no later than the skill needing it.
    for (const step of ranked) {
      for (const p of SKILLS[step.skill].prerequisites) {
        const pr = rank(p);
        if (pr === -1) continue;   // held back as not ready — fine
        expect(pr, `${p} should be introduced before ${step.skill}`)
          .toBeLessThan(rank(step.skill));
      }
    }
  });

  it('reaches a mid-depth skill within a week, even from a blank slate', () => {
    // Before the fix, every `new` skill shared priority 40 and the pool was
    // round-robined in arbitrary object order. Measured over 10 simulated days
    // a Class 4 learner's designated weak skill was introduced ZERO times.
    //
    // Now measured at day 4 from nothing: the first sessions correctly go to
    // foundations, which is the order a curriculum should follow. Asserted at 8
    // to leave headroom without permitting the old unbounded behaviour.
    let log: Attempt[] = [];
    let firstSeen = -1;
    for (let d = 0; d < 8 && firstSeen < 0; d++) {
      const t = NOW + d * DAY_MS;
      const est = estimateAll(log, t);
      const plan = buildSession('4th', est, 10, t);
      if (plan.some(s => s.skill === 'mul.tables.mid')) firstSeen = d;
      log = log.concat(plan.map((s, i) => ({ ...mk(s.skill, true, i), answeredAt: t + i * 20_000 })));
    }
    expect(firstSeen, 'mul.tables.mid was not introduced within 8 sessions')
      .toBeGreaterThanOrEqual(0);
  });
});

describe('B3 · consolidation outranks expansion', () => {
  it('lets a strong learner actually master skills rather than tour the syllabus', () => {
    // With a fixed 2-new-skills-per-session budget a strong learner opened 24
    // skills over 12 days and mastered ONE. New material is now gated on how
    // much work is already unconsolidated.
    let log: Attempt[] = seasoned();
    for (let d = 0; d < 12; d++) {
      const t = NOW + d * DAY_MS;
      const est = estimateAll(log, t);
      const plan = buildSession('4th', est, 10, t);
      log = log.concat(plan.map((s, i) => ({ ...mk(s.skill, true, i), answeredAt: t + i * 20_000 })));
    }
    const est = estimateAll(log, NOW + 12 * DAY_MS);
    const mastered = Object.values(est).filter(m => m.value >= MASTERED_THRESHOLD);
    expect(mastered.length, 'a strong learner should consolidate, not just sample')
      .toBeGreaterThan(3);
  });

  it('holds the over-practice cap when the learner has mastered what they have met', () => {
    // The failure this guards: 16 of 20 slots went to two mastered skills — an
    // 80% over-practice rate against a 25% cap — because the fresh budget ran
    // out and the loop fell through to maintenance.
    const log: Attempt[] = [];
    for (let i = 0; i < 40; i++) {
      log.push(mk('add.within10', true, i, '1st'));
      log.push(mk('add.within20', true, i, '1st'));
    }
    const est = estimateAll(log, NOW);
    const session = buildSession('1st', est, 20, NOW);
    const secure = session.filter(s => (est[s.skill]?.value ?? 0) >= MASTERED_THRESHOLD);
    expect(secure.length / session.length).toBeLessThanOrEqual(OVER_PRACTICE_CAP + 0.001);
  });

  it('always fills the session, whatever the composition rules say', () => {
    // Caps limit composition, never length. A short session is a worse failure
    // than an unbalanced one.
    for (const cls of ['1st', '3rd', '6th'] as const) {
      for (const log of [[], seasoned(), seasoned('div.basic')]) {
        const est = estimateAll(log, NOW);
        expect(buildSession(cls, est, 10, NOW).length, cls).toBe(10);
      }
    }
  });
});
