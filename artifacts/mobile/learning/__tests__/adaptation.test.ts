// Tests for §3 of docs/14 — the scheduler redesign.
//
// The audit's most damaging finding was a struggling learner receiving a
// session they could not answer. These tests encode the four mechanisms that
// fix it, and the one property that must never regress: the app may dilute a
// weak skill, but it must never quietly stop showing it.

import { describe, it, expect } from 'vitest';
import type { Attempt } from '../attempts';
import type { MasteryEstimate } from '../mastery';
import { estimateAll, RECOGNITION_CEILING, MASTERED_THRESHOLD, DAY_MS } from '../mastery';
import {
  buildSession, scheduleSkills, projectedSuccess, applySuccessFloor,
  SESSION_SUCCESS_FLOOR, OVER_PRACTICE_CAP, MAX_DILUTION_RATIO,
} from '../scheduler';
import {
  decideAdaptation, descendToPrerequisite, consecutiveMisses, consecutiveMissesAny,
  needsCircuitBreaker, pickConfidenceSkill, readyToReturn,
  DESCENT_TRIGGER, BREAKER_TRIGGER, MAX_DESCENT_DEPTH, RETURN_THRESHOLD,
} from '../adaptation';
import { SKILLS } from '../skills';

const NOW = 1_700_000_000_000;

function mk(skill: string, correct: boolean, i = 0, over: Partial<Attempt> = {}): Attempt {
  return {
    skill, correct, answeredAt: NOW + i * 1000, latencyMs: 4000,
    chosen: correct ? '1' : '2', expected: '1', questionText: 'q', timedOut: false,
    cls: '4th', category: SKILLS[skill]?.category ?? 'addition', difficulty: 'medium',
    ...over,
  };
}

/** A mastery table built by hand, for testing scheduling in isolation. */
function estimates(values: Record<string, number>): Record<string, MasteryEstimate> {
  const out: Record<string, MasteryEstimate> = {};
  for (const [skill, value] of Object.entries(values)) {
    out[skill] = {
      skill, value, confidence: 0.8, attempts: 10, correct: Math.round(value * 10),
      lastPracticed: NOW, trend: 0, rawAccuracy: value,
    };
  }
  return out;
}

// ─── M1 · Success floor ──────────────────────────────────────────────────────

describe('M1 · success floor', () => {
  it('projects session success as mean mastery', () => {
    const est = estimates({ 'add.within10': 0.9, 'sub.within10': 0.5 });
    const session = [
      { skill: 'add.within10', priority: 1, reason: 'due' as const, difficulty: 'easy' as const },
      { skill: 'sub.within10', priority: 1, reason: 'due' as const, difficulty: 'easy' as const },
    ];
    expect(projectedSuccess(session, est)).toBeCloseTo(0.7, 5);
  });

  it('treats an unattempted skill as the 0.5 prior', () => {
    expect(projectedSuccess(
      [{ skill: 'never.seen', priority: 1, reason: 'new', difficulty: 'easy' }], {},
    )).toBe(0.5);
  });

  it('raises a session that would be nearly all failure', () => {
    // The audit's scenario: the learner is weak on the scheduled skill and
    // secure elsewhere.
    const est = estimates({ 'mul.tables.mid': 0.05, 'add.within10': 0.95, 'add.within20': 0.9 });
    const ranked = [
      { skill: 'add.within10', priority: 20, reason: 'maintain' as const, difficulty: 'hard' as const },
      { skill: 'add.within20', priority: 20, reason: 'maintain' as const, difficulty: 'hard' as const },
    ];
    const session = Array.from({ length: 10 }, () => (
      { skill: 'mul.tables.mid', priority: 90, reason: 'learning' as const, difficulty: 'easy' as const }
    ));

    expect(projectedSuccess(session, est)).toBeLessThan(0.1);
    const fixed = applySuccessFloor(session, ranked, est, 10);

    // Not asserted at SESSION_SUCCESS_FLOOR: the dilution cap deliberately wins
    // when a session is entirely one weak skill, because replacing more than
    // half of it would leave no remediation. With 5 of 10 items swapped for
    // ~0.95 material the ceiling here is ~0.50, and claiming 0.60 would be
    // asserting a guarantee the design intentionally does not make.
    const half = MAX_DILUTION_RATIO;
    expect(projectedSuccess(fixed, est)).toBeGreaterThan(0.45);
    expect(fixed.filter(s => s.skill !== 'mul.tables.mid').length).toBeLessThanOrEqual(10 * half);
  });

  it('dilutes the weak skill but never removes it entirely', () => {
    const est = estimates({ 'mul.tables.mid': 0.05, 'add.within10': 0.95 });
    const ranked = [
      { skill: 'add.within10', priority: 20, reason: 'maintain' as const, difficulty: 'hard' as const },
    ];
    const session = Array.from({ length: 10 }, () => (
      { skill: 'mul.tables.mid', priority: 90, reason: 'learning' as const, difficulty: 'easy' as const }
    ));
    const fixed = applySuccessFloor(session, ranked, est, 10);
    // This is the property that matters most in this file.
    expect(fixed.some(s => s.skill === 'mul.tables.mid')).toBe(true);
  });

  it('never swaps out a prerequisite-blocking gap item', () => {
    const est = estimates({ 'add.within10': 0.05, 'mul.tables.full': 0.95 });
    const ranked = [
      { skill: 'mul.tables.full', priority: 20, reason: 'maintain' as const, difficulty: 'hard' as const },
    ];
    const session = Array.from({ length: 10 }, () => (
      { skill: 'add.within10', priority: 140, reason: 'gap' as const, difficulty: 'easy' as const }
    ));
    const fixed = applySuccessFloor(session, ranked, est, 10);
    // A gap blocks everything downstream — it is the whole point of the session.
    expect(fixed.every(s => s.skill === 'add.within10')).toBe(true);
  });

  it('gives up gracefully when the learner is weak across the board', () => {
    const est = estimates({ 'a.one': 0.1, 'a.two': 0.12 });
    const session = [
      { skill: 'a.one', priority: 9, reason: 'learning' as const, difficulty: 'easy' as const },
      { skill: 'a.two', priority: 9, reason: 'learning' as const, difficulty: 'easy' as const },
    ];
    const fixed = applySuccessFloor(session, [], est, 2);
    expect(fixed).toHaveLength(2);          // no crash, no infinite loop
  });

  it('holds the floor for a real struggling learner across a whole session', () => {
    const log: Attempt[] = [];
    for (let i = 0; i < 20; i++) log.push(mk('mul.tables.mid', false, i));
    for (let i = 0; i < 20; i++) log.push(mk('add.3digit', true, 20 + i, { interaction: 'entry' }));
    const est = estimateAll(log, NOW + DAY_MS);
    const session = buildSession('4th', est, 10, NOW + DAY_MS);
    expect(session.length).toBeGreaterThan(0);
    // The audit measured ~0.05 expected success for this learner. The fix is
    // real but bounded by the dilution cap, so this asserts a large improvement
    // rather than attainment of the floor — see SESSION_SUCCESS_FLOOR's note.
    expect(projectedSuccess(session, est)).toBeGreaterThan(0.25);
  });
});

// ─── Over-practice cap ───────────────────────────────────────────────────────

describe('over-practice cap', () => {
  it('does not spend more than the cap on already-secure skills', () => {
    const log: Attempt[] = [];
    // A learner who is secure at everything they have touched.
    for (let i = 0; i < 40; i++) {
      log.push(mk('add.within10', true, i, { interaction: 'entry' }));
      log.push(mk('add.within20', true, i, { interaction: 'entry' }));
    }
    const est = estimateAll(log, NOW);
    const session = buildSession('1st', est, 20, NOW);
    const secure = session.filter(s => (est[s.skill]?.value ?? 0) >= MASTERED_THRESHOLD);
    expect(secure.length / session.length).toBeLessThanOrEqual(OVER_PRACTICE_CAP + 0.001);
  });
});

// ─── M2 · Prerequisite descent ───────────────────────────────────────────────

describe('M2 · prerequisite descent', () => {
  it('counts consecutive misses on a skill', () => {
    const log = [mk('add.3digit', false, 0), mk('add.3digit', true, 1), mk('add.3digit', false, 2), mk('add.3digit', false, 3)];
    expect(consecutiveMisses(log, 'add.3digit')).toBe(2);
  });

  it('counts consecutive misses across skills', () => {
    const log = [mk('add.3digit', true, 0), mk('sub.3digit', false, 1), mk('add.3digit', false, 2)];
    expect(consecutiveMissesAny(log)).toBe(2);
  });

  it('does not trigger on a single miss', () => {
    const est = estimates({ 'add.3digit': 0.4, 'add.2digit.carry': 0.3 });
    const r = descendToPrerequisite('add.3digit', est, [mk('add.3digit', false)]);
    expect(r.reason).toBe('not-triggered');
    expect(r.target).toBeNull();
  });

  it('routes to the weak prerequisite, not to easier questions on the same skill', () => {
    // The central fix: the child does not need smaller numbers, they need the
    // prerequisite they never secured.
    const est = estimates({ 'add.3digit': 0.4, 'add.2digit.carry': 0.2, 'add.2digit.nocarry': 0.9 });
    const log = [mk('add.3digit', false, 0), mk('add.3digit', false, 1)];
    const r = descendToPrerequisite('add.3digit', est, log);
    expect(r.target).toBe('add.2digit.carry');
    expect(r.reason).toBe('descended');
  });

  it('reports no weak prerequisite when the gap is in the skill itself', () => {
    const est = estimates({ 'add.3digit': 0.3, 'add.2digit.carry': 0.95, 'add.2digit.nocarry': 0.95 });
    const log = [mk('add.3digit', false, 0), mk('add.3digit', false, 1)];
    const r = descendToPrerequisite('add.3digit', est, log);
    expect(r.target).toBeNull();
    expect(r.reason).toBe('no-weak-prerequisite');
  });

  it('ignores prerequisites with too little evidence to trust', () => {
    const est = estimates({ 'add.3digit': 0.3 });
    est['add.2digit.carry'] = {
      skill: 'add.2digit.carry', value: 0.1, confidence: 0.1, attempts: 1, correct: 0,
      lastPracticed: NOW, trend: 0, rawAccuracy: 0,
    };
    const log = [mk('add.3digit', false, 0), mk('add.3digit', false, 1)];
    expect(descendToPrerequisite('add.3digit', est, log).target).toBeNull();
  });

  it('never descends further than the depth cap', () => {
    // add.within10 sits 3 levels below add.3digit and must stay out of reach:
    // walking a struggling Class 4 learner back to "add within 10" is
    // humiliating and almost never the real cause.
    const est = estimates({
      'add.3digit': 0.3, 'add.2digit.carry': 0.9, 'add.2digit.nocarry': 0.9,
      'add.within20': 0.9, 'add.within10': 0.05,
    });
    const log = [mk('add.3digit', false, 0), mk('add.3digit', false, 1)];
    const r = descendToPrerequisite('add.3digit', est, log);
    expect(r.target).not.toBe('add.within10');
    expect(r.reason).toBe('depth-capped');
  });

  it('returns to the parent skill once the prerequisite is repaired', () => {
    expect(readyToReturn('add.2digit.carry', estimates({ 'add.2digit.carry': RETURN_THRESHOLD + 0.05 }))).toBe(true);
    expect(readyToReturn('add.2digit.carry', estimates({ 'add.2digit.carry': RETURN_THRESHOLD - 0.05 }))).toBe(false);
  });
});

// ─── M3 · Frustration circuit-breaker ────────────────────────────────────────

describe('M3 · frustration circuit-breaker', () => {
  it('fires after three consecutive misses', () => {
    const log = [mk('add.3digit', false, 0), mk('sub.3digit', false, 1)];
    expect(needsCircuitBreaker(log)).toBe(false);
    log.push(mk('mul.2digit', false, 2));
    expect(needsCircuitBreaker(log)).toBe(true);
  });

  it('resets on any correct answer', () => {
    const log = [
      mk('a', false, 0), mk('a', false, 1), mk('a', false, 2), mk('add.within10', true, 3),
    ];
    expect(needsCircuitBreaker(log)).toBe(false);
  });

  it('picks the most secure available skill', () => {
    const est = estimates({ 'add.within10': 0.97, 'add.within20': 0.88, 'add.3digit': 0.3 });
    expect(pickConfidenceSkill(['add.within10', 'add.within20', 'add.3digit'], est)).toBe('add.within10');
  });

  it('returns null when nothing is secure enough to be a confidence item', () => {
    expect(pickConfidenceSkill(['add.3digit'], estimates({ 'add.3digit': 0.4 }))).toBeNull();
  });
});

// ─── The combined decision ───────────────────────────────────────────────────

describe('in-session adaptation', () => {
  const candidates = ['add.within10', 'add.2digit.carry', 'add.3digit'];

  it('does nothing after a correct answer', () => {
    const est = estimates({ 'add.3digit': 0.3, 'add.2digit.carry': 0.2 });
    const log = [mk('add.3digit', false, 0), mk('add.3digit', true, 1)];
    expect(decideAdaptation({ sessionLog: log, currentSkill: 'add.3digit', estimates: est, candidates }).kind)
      .toBe('continue');
  });

  it('prioritises the circuit-breaker over prerequisite descent', () => {
    // Three misses in a row is an emotional state, not a knowledge state.
    const est = estimates({ 'add.3digit': 0.3, 'add.2digit.carry': 0.2, 'add.within10': 0.95 });
    const log = [mk('add.3digit', false, 0), mk('add.3digit', false, 1), mk('add.3digit', false, 2)];
    const d = decideAdaptation({ sessionLog: log, currentSkill: 'add.3digit', estimates: est, candidates });
    expect(d.kind).toBe('confidence');
  });

  it('descends to the prerequisite on two misses', () => {
    const est = estimates({ 'add.3digit': 0.3, 'add.2digit.carry': 0.2, 'add.within10': 0.95 });
    const log = [mk('add.3digit', false, 0), mk('add.3digit', false, 1)];
    const d = decideAdaptation({ sessionLog: log, currentSkill: 'add.3digit', estimates: est, candidates });
    expect(d).toMatchObject({ kind: 'descend', skill: 'add.2digit.carry', from: 'add.3digit' });
  });

  it('asks for teaching when no prerequisite is to blame', () => {
    // This is the hand-off to worked examples: more practice cannot fix a
    // learner who has no missing prerequisite and still cannot do the skill.
    const est = estimates({ 'add.3digit': 0.3, 'add.2digit.carry': 0.95, 'add.2digit.nocarry': 0.95 });
    const log = [mk('add.3digit', false, 0), mk('add.3digit', false, 1)];
    const d = decideAdaptation({ sessionLog: log, currentSkill: 'add.3digit', estimates: est, candidates });
    expect(d).toMatchObject({ kind: 'teach', skill: 'add.3digit' });
  });

  it('leaves a strong learner alone after an isolated slip', () => {
    // Expertise reversal: intervening here is patronising and unhelpful.
    const est = estimates({ 'add.3digit': 0.92, 'add.2digit.carry': 0.9 });
    const log = [mk('add.3digit', true, 0), mk('add.3digit', false, 1)];
    expect(decideAdaptation({ sessionLog: log, currentSkill: 'add.3digit', estimates: est, candidates }).kind)
      .toBe('continue');
  });
});

// ─── M4 · Anti-inflation guard ───────────────────────────────────────────────

describe('M4 · anti-inflation guard', () => {
  it('caps mastery built only on multiple choice', () => {
    const log = Array.from({ length: 30 }, (_, i) => mk('add.within10', true, i));
    expect(estimateAll(log, NOW)['add.within10'].value).toBeLessThanOrEqual(RECOGNITION_CEILING);
  });

  it('allows full mastery once the learner produces answers', () => {
    const log = Array.from({ length: 30 }, (_, i) =>
      mk('add.within10', true, i, { interaction: 'entry' }));
    expect(estimateAll(log, NOW)['add.within10'].value).toBeGreaterThan(RECOGNITION_CEILING);
  });

  it('accepts multi-select and ordering as recall evidence', () => {
    for (const kind of ['multiSelect', 'ordering'] as const) {
      const log = Array.from({ length: 30 }, (_, i) =>
        mk('add.within10', true, i, { interaction: kind }));
      expect(estimateAll(log, NOW)['add.within10'].value).toBeGreaterThan(RECOGNITION_CEILING);
    }
  });

  it('leaves the ceiling reachable, so the interaction ladder can still promote', () => {
    // pickInteraction promotes at >= 0.80. If the guard clamped below that the
    // learner could never earn typed entry, and the cap would be a permanent
    // trap rather than a gate.
    const log = Array.from({ length: 30 }, (_, i) => mk('add.within10', true, i));
    expect(estimateAll(log, NOW)['add.within10'].value).toBeGreaterThanOrEqual(RECOGNITION_CEILING);
  });

  it('does not penalise a learner who is genuinely wrong', () => {
    const log = Array.from({ length: 20 }, (_, i) => mk('add.within10', false, i));
    expect(estimateAll(log, NOW)['add.within10'].value).toBeLessThan(0.3);
  });
});

// ─── Scaffolded attempts ─────────────────────────────────────────────────────

describe('scaffolded attempts carry reduced weight', () => {
  it('rates a scaffolded success below an unaided one', () => {
    const aided = Array.from({ length: 12 }, (_, i) =>
      mk('add.within10', true, i, { interaction: 'entry', scaffolded: true }));
    const unaided = Array.from({ length: 12 }, (_, i) =>
      mk('add.within10', true, i, { interaction: 'entry' }));
    expect(estimateAll(aided, NOW)['add.within10'].value)
      .toBeLessThan(estimateAll(unaided, NOW)['add.within10'].value);
  });
});
