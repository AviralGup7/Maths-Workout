// Verifies that an adaptive session actually delivers a mix of interaction
// types — the whole point of the question-engine work. This mirrors the
// generation logic in GameContext.startAdaptiveSession.

import { describe, it, expect } from 'vitest';
import { buildSession } from '../scheduler';
import { estimateAll } from '../mastery';
import type { Attempt } from '../attempts';
import { SKILLS } from '../skills';
import { generateQuestion } from '../../generators';
import { pickInteraction, toEntry, grade, expectedAnswer } from '../../generators/interactions';
import {
  genFactorSelect, genPrimeSelect, genMultipleSelect,
  genOrderNumbers, genOrderDecimals, genOrderFractions,
  genMissingNumber, genTableRecall, genDoubleHalve,
} from '../../generators/topics-interactive';
import type { SchoolClass, Difficulty, Question } from '../../generators/types';

// Mirror of the map in GameContext.
const VARIANTS: Record<string, ((c: SchoolClass, d: Difficulty) => Question)[]> = {
  'factors.basic':     [genFactorSelect, genPrimeSelect],
  'mul.tables.mid':    [genMultipleSelect, genTableRecall],
  'mul.tables.full':   [genMultipleSelect, genTableRecall],
  'numsense.compare':  [genOrderNumbers],
  'placevalue':        [genOrderNumbers],
  'dec.tenths':        [genOrderDecimals],
  'dec.hundredths':    [genOrderDecimals],
  'frac.equivalence':  [genOrderFractions],
  'add.within20':      [genMissingNumber, genDoubleHalve],
  'add.2digit.carry':  [genMissingNumber],
  'sub.within20':      [genMissingNumber],
  'sub.2digit.borrow': [genMissingNumber],
  'div.basic':         [genDoubleHalve],
};

/** Reproduces one adaptive session end-to-end. */
function buildQuestions(cls: SchoolClass, log: Attempt[], count: number, now: number): Question[] {
  const mastery = estimateAll(log, now);
  const plan = buildSession(cls, mastery, count, now);
  return plan.map(step => {
    const cat = SKILLS[step.skill].category;
    const level = mastery[step.skill]?.value ?? 0.5;
    const variants = VARIANTS[step.skill];
    if (variants && Math.random() < 0.34) {
      return variants[Math.floor(Math.random() * variants.length)](cls, step.difficulty);
    }
    const q = generateQuestion(cls, step.difficulty, cat);
    return pickInteraction(level, { entry: true }) === 'entry' ? toEntry(q) : q;
  });
}

const NOW = 1_700_000_000_000;

function seed(skill: string, correct: boolean, n: number, cls: SchoolClass): Attempt[] {
  return Array.from({ length: n }, (_, i) => ({
    skill, correct, answeredAt: NOW - i * 3_600_000, latencyMs: 4000,
    chosen: '1', expected: '1', questionText: 'seed', timedOut: false,
    cls, category: SKILLS[skill].category, difficulty: 'medium' as Difficulty,
  }));
}

describe('adaptive sessions deliver varied interaction types', () => {
  it('surfaces multi-select for a 4th-class learner weak at factors', () => {
    const log = seed('factors.basic', false, 10, '4th');
    const kinds = new Set<string>();
    // Variant selection is probabilistic; sample enough sessions to be stable.
    for (let s = 0; s < 60; s++) {
      for (const q of buildQuestions('4th', log, 10, NOW)) {
        kinds.add(q.interaction?.kind ?? 'choice');
      }
    }
    expect([...kinds]).toContain('multiSelect');
  });

  it('surfaces ordering for a learner practising comparison and decimals', () => {
    const log = [...seed('numsense.compare', false, 8, '4th'), ...seed('dec.tenths', false, 8, '4th')];
    const kinds = new Set<string>();
    for (let s = 0; s < 60; s++) {
      for (const q of buildQuestions('4th', log, 10, NOW)) {
        kinds.add(q.interaction?.kind ?? 'choice');
      }
    }
    expect([...kinds]).toContain('ordering');
  });

  it('promotes a secure learner to typed entry', () => {
    const log = seed('mul.tables.full', true, 30, '5th');
    const kinds = new Set<string>();
    for (let s = 0; s < 40; s++) {
      for (const q of buildQuestions('5th', log, 10, NOW)) {
        kinds.add(q.interaction?.kind ?? 'choice');
      }
    }
    expect([...kinds]).toContain('entry');
  });

  it('keeps a struggling learner on multiple choice', () => {
    // Every skill failing → the ladder must not strip the scaffold.
    const log = [
      ...seed('add.within10', false, 12, '1st'),
      ...seed('sub.within10', false, 12, '1st'),
      ...seed('count.objects', false, 12, '1st'),
    ];
    const mastery = estimateAll(log, NOW);
    for (const [skill, est] of Object.entries(mastery)) {
      // No struggling skill should ever be promoted to entry.
      expect(pickInteraction(est.value, { entry: true }), skill).toBe('choice');
    }
  });

  it('every question in a session is gradeable, whatever its type', () => {
    for (const cls of ['1st', '2nd', '3rd', '4th', '5th', '6th'] as SchoolClass[]) {
      for (let s = 0; s < 12; s++) {
        for (const q of buildQuestions(cls, [], 10, NOW)) {
          expect(grade(q, expectedAnswer(q)), `${cls}: ${q.questionText}`).toBe(true);
          // Multiple choice must still present four tiles — except for genuine
          // binary judgements ("is that sensible?"), where padding to four
          // would make the task easier rather than harder.
          if (!q.interaction || q.interaction.kind === 'choice') {
            const binary = q.choices.length === 2 && q.choices.every(c => typeof c === 'string');
            if (!binary) expect(q.choices.length, q.questionText).toBe(4);
          }
        }
      }
    }
  });

  it('a session is never entirely one interaction type for a mixed learner', () => {
    const log = [
      ...seed('factors.basic', false, 8, '4th'),
      ...seed('mul.tables.full', true, 30, '4th'),
    ];
    let sawMultipleKinds = false;
    for (let s = 0; s < 40 && !sawMultipleKinds; s++) {
      const kinds = new Set(buildQuestions('4th', log, 12, NOW).map(q => q.interaction?.kind ?? 'choice'));
      if (kinds.size > 1) sawMultipleKinds = true;
    }
    expect(sawMultipleKinds).toBe(true);
  });
});
