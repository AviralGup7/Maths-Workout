// Visual fade policy — docs/14 §2.
//
// The audit found 0 visual representations in the entire product: the app went
// straight to the Abstract stage of CPA with no Concrete or Pictorial step.
// These tests cover the policy that decides when a visual appears — and,
// crucially, when it stops.

import { describe, it, expect } from 'vitest';
import {
  visualFor, visualMode, VISUAL_SKILLS, NO_VISUAL_BY_DESIGN,
  VISUAL_INTERACTIVE_BELOW, VISUAL_HIDDEN_ABOVE,
} from '../visualPolicy';
import { SKILLS } from '../skills';
import { MASTERED_THRESHOLD, STRUGGLING_THRESHOLD } from '../mastery';

describe('which skills get a visual', () => {
  it('covers the concepts where symbols alone mislead', () => {
    // Each of these has a documented misconception the visual directly targets.
    expect(visualFor('frac.addSameDenom')).toBe('partModel');
    expect(visualFor('dec.hundredths')).toBe('numberLine');
    expect(visualFor('integers.basic')).toBe('numberLine');
    expect(visualFor('sub.2digit.borrow')).toBe('baseTen');
    expect(visualFor('factors.basic')).toBe('arrayGrid');
  });

  it('gives times tables NO visual, on purpose', () => {
    // The goal is automaticity. A visual slows retrieval, which is actively
    // counterproductive once the fact should be recalled rather than derived.
    for (const s of ['mul.tables.easy', 'mul.tables.mid', 'mul.tables.full']) {
      expect(visualFor(s), s).toBeNull();
      expect(NO_VISUAL_BY_DESIGN[s], `${s} should record why`).toBeTruthy();
    }
  });

  it('gives word problems no visual, because the modelling IS the skill', () => {
    expect(visualFor('wordproblems')).toBeNull();
    expect(NO_VISUAL_BY_DESIGN['wordproblems']).toBeTruthy();
  });

  it('only names real skills', () => {
    for (const s of VISUAL_SKILLS) expect(SKILLS[s], s).toBeDefined();
    for (const s of Object.keys(NO_VISUAL_BY_DESIGN)) expect(SKILLS[s], s).toBeDefined();
  });
});

describe('the fade rule', () => {
  const skill = 'frac.addSameDenom';

  it('is interactive for a struggling learner', () => {
    expect(visualMode(skill, 0.20)).toBe('interactive');
    expect(visualMode(skill, 0.54)).toBe('interactive');
  });

  it('becomes illustrative once the learner is finding their feet', () => {
    expect(visualMode(skill, 0.55)).toBe('illustrative');
    expect(visualMode(skill, 0.79)).toBe('illustrative');
  });

  it('disappears entirely once the skill is secure', () => {
    // Expertise reversal: support that persists past competence reduces
    // performance. The withdrawal is required, not optional.
    expect(visualMode(skill, 0.80)).toBe('none');
    expect(visualMode(skill, 0.95)).toBe('none');
  });

  it('is monotone — support never increases as mastery rises', () => {
    const rank = { interactive: 2, illustrative: 1, none: 0 };
    let previous = 3;
    for (let m = 0; m <= 1.0001; m += 0.05) {
      const current = rank[visualMode(skill, m)];
      expect(current, `mastery ${m.toFixed(2)}`).toBeLessThanOrEqual(previous);
      previous = current;
    }
  });

  it('returns none for skills with no visual, at every mastery level', () => {
    for (let m = 0; m <= 1.0001; m += 0.1) {
      expect(visualMode('mul.tables.mid', m)).toBe('none');
    }
  });

  it('aligns its thresholds with the mastery model', () => {
    // The fade must key off the same constants the rest of the engine uses,
    // or a child could be "struggling" for the scheduler and "secure" for the
    // visual layer at the same time.
    expect(VISUAL_INTERACTIVE_BELOW).toBe(STRUGGLING_THRESHOLD);
    expect(VISUAL_HIDDEN_ABOVE).toBeLessThanOrEqual(MASTERED_THRESHOLD);
  });
});
