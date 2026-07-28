// ─── docs/27 P3-08 · the multiple-choice share guard ─────────────────────────
//
// docs/25 T3-23 asked for the multiple-choice share to fall below 40%.
//
// The guard measures the share the way a CHILD meets it: it reproduces
// GameContext.buildQuestion — reasoning policy, open-task policy, the
// manipulative branch, the interactive-variant table and the ladder, in that
// order — over the full class × difficulty × skill grid at a spread of mastery
// values. Measuring `generateQuestion` alone would be measuring the wrong
// thing: that is the supply, not the stream.
//
// It is written to FAIL if `applyLadder` is reverted to the old step function.
// Verified by doing exactly that: with `pickInteraction`'s 0.80 step the
// measured share is 84.4%, far above the 40% bar.

import { describe, it, expect } from 'vitest';
import { generateForSkill } from '../../generators';
import type { SchoolClass, Difficulty, Question, Category } from '../../generators/types';
import { SKILLS } from '../skills';
import type { SkillId } from '../skills';
import { applyLadder, entryChance, canType, ENTRY_FLOOR, ENTRY_FULL } from '../interactionLadder';
import { pickOpenTask } from '../openTaskPolicy';
import { pickReasoning } from '../reasoningPolicy';
import { genOpenEnded, genOpenMiddle, genReverse } from '../../generators/openTasks';
import { genMethodCompare, genReasonSelect } from '../../generators/metacognition';
import { genErrorHunt } from '../../generators/reasoning';
import { manipulativeQuestion } from '../../generators/interactions';
import {
  genFactorSelect, genPrimeSelect, genMultipleSelect,
  genOrderNumbers, genOrderDecimals, genOrderFractions,
  genMissingNumber, genTableRecall, genDoubleHalve,
} from '../../generators/topics-interactive';

// Mirror of GameContext.INTERACTIVE_VARIANTS. audit/harness.ts holds the third
// copy; probe-parity keeps them honest.
const VARIANTS: Partial<Record<string, ((c: SchoolClass, d: Difficulty) => Question)[]>> = {
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

const MANIPULATIVE_SKILLS = new Set([
  'count.objects', 'count.skip', 'add.within10', 'add.within20',
  'sub.within10', 'sub.within20', 'bonds.basic',
]);

/** Faithful copy of GameContext.buildQuestion, minus React. */
function buildQuestion(
  cls: SchoolClass, diff: Difficulty, cat: Category, skill: SkillId, level: number,
): Question | null {
  const reasoningKind = pickReasoning({ skill, mastery: level, cls, roll: Math.random(), kindRoll: Math.random() });
  if (reasoningKind) {
    const gen = reasoningKind === 'errorHunt' ? genErrorHunt
              : reasoningKind === 'methodCompare' ? genMethodCompare : genReasonSelect;
    return gen(cls, diff, 'en');
  }
  const openKind = pickOpenTask({ skill, mastery: level, cls, roll: Math.random(), kindRoll: Math.random() });
  if (openKind) {
    const gen = openKind === 'openEnded' ? genOpenEnded : openKind === 'openMiddle' ? genOpenMiddle : genReverse;
    return gen(cls, diff, 'en');
  }
  if (MANIPULATIVE_SKILLS.has(skill) && level < 0.55 && Math.random() < 0.3) {
    const target = 3 + Math.floor(Math.random() * 8);
    return manipulativeQuestion(`Show ${target} counters`, target);
  }
  const variants = VARIANTS[skill];
  if (variants && variants.length > 0 && Math.random() < 0.34) {
    return variants[Math.floor(Math.random() * variants.length)](cls, diff);
  }
  let q: Question;
  try { q = generateForSkill(cls, diff, cat, skill); } catch { return null; }
  return applyLadder(q, level, Math.random(), { estimateRoll: Math.random() });
}

const CLASSES: SchoolClass[] = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];
// A realistic spread. Not uniform: children spend most of a session in the
// middle band the old step function ignored entirely.
const LEVELS = [0.25, 0.35, 0.45, 0.55, 0.65, 0.72, 0.80, 0.88];

function measure(): { share: number; total: number; byKind: Record<string, number> } {
  const byKind: Record<string, number> = {};
  let total = 0;
  for (const skill of Object.keys(SKILLS) as SkillId[]) {
    const meta = SKILLS[skill];
    const cat = meta.category as Category;
    if (cat === 'tables' || cat === 'mixed') continue;
    // A skill is practised from the class it is introduced in, upward.
    const from = CLASSES.indexOf(meta.introducedIn as SchoolClass);
    for (const cls of CLASSES.slice(from < 0 ? 0 : from)) {
      for (const d of DIFFS) for (const level of LEVELS) {
        const q = buildQuestion(cls, d, cat, skill, level);
        if (!q) continue;
        const k = q.interaction?.kind ?? 'choice';
        byKind[k] = (byKind[k] ?? 0) + 1;
        total++;
      }
    }
  }
  return { share: (byKind.choice ?? 0) / total, total, byKind };
}

describe('docs/27 P3-08 · multiple-choice share', () => {
  it('is below 40% of the question stream a child actually meets', () => {
    // Averaged over five passes, not measured once. Every branch of
    // `buildQuestion` is a coin flip, so a single 5,832-question pass carries
    // real sampling noise: measured across 12 passes the share ranged
    // 37.9%–39.6% around a mean of 38.7%. A guard that samples once against a
    // 40% bar would fail roughly one CI run in twenty on noise alone, and a
    // guard that cries wolf trains people to re-run it instead of read it.
    const RUNS = 5;
    const passes = Array.from({ length: RUNS }, () => measure());
    const share = passes.reduce((a, p) => a + p.share, 0) / RUNS;
    const { total, byKind } = passes[passes.length - 1];
    const pct = (share * 100).toFixed(1);
    const mix = Object.entries(byKind)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${(v / total * 100).toFixed(1)}%`)
      .join(' · ');
    console.log(`P3-08 · ${RUNS}×${total} questions · choice ${pct}% (mean) · ${mix}`);
    expect(share, `multiple choice ${pct}% mean of ${RUNS}×${total} — target < 40%`).toBeLessThan(0.40);
  }, 300_000);

  it('still scaffolds a struggling learner', () => {
    // The point of the ramp is that it does NOT strip the tiles from a child
    // who is failing. Below the floor the chance must be exactly zero, or the
    // guard has traded one defect for a worse one.
    expect(entryChance(0.0)).toBe(0);
    expect(entryChance(0.2)).toBe(0);
    expect(entryChance(ENTRY_FLOOR - 0.001)).toBe(0);
    expect(entryChance(ENTRY_FULL)).toBe(1);
    expect(entryChance(0.95)).toBe(1);
  });

  it('ramps monotonically between the floor and the ceiling', () => {
    let prev = -1;
    for (let m = 0; m <= 1.0001; m += 0.01) {
      const c = entryChance(m);
      expect(c).toBeGreaterThanOrEqual(prev);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
      prev = c;
    }
  });

  it('refuses to type an answer a numeric keypad cannot express', () => {
    const word: Question = { questionText: 'A shape with 4 sides is a ___?', answer: 'Rectangle', choices: ['Rectangle', 'Circle', 'Triangle', 'Hexagon'] };
    expect(canType(word)).toBe(false);
    expect(applyLadder(word, 0.99, 0).interaction).toBeUndefined();
    const num: Question = { questionText: '7 + 5 = ?', answer: 12, choices: [12, 11, 13, 10] };
    expect(canType(num)).toBe(true);
    expect(applyLadder(num, 0.99, 0).interaction?.kind).toBe('entry');
  });

  it('never re-ladders a question that already has a richer interaction', () => {
    const ms: Question = {
      questionText: 'Tap ALL the factors of 12', answer: '2,3,4,6', choices: [],
      interaction: { kind: 'multiSelect', options: [2, 3, 4, 5], correct: [2, 3, 4], minRequired: 1 },
    };
    expect(canType(ms)).toBe(false);
    expect(applyLadder(ms, 0.99, 0).interaction?.kind).toBe('multiSelect');
  });
});
