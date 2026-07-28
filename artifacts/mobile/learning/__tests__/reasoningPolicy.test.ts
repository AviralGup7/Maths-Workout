import { describe, it, expect } from 'vitest';
import {
  pickReasoning, skillsWithReasoning, REASONING_RATE, REASONING_FLOOR, SPLIT,
} from '../reasoningPolicy';
import { pickOpenTask } from '../openTaskPolicy';
import { SKILLS } from '../skills';
import { STRUGGLING_THRESHOLD } from '../mastery';
import { buildSession } from '../scheduler';
import { genMethodCompare, genReasonSelect } from '../../generators/metacognition';
import { genErrorHunt } from '../../generators/reasoning';
import type { SchoolClass } from '../../generators/types';

const CLASSES: SchoolClass[] = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

function secureMastery() {
  const m: Record<string, { value: number }> = {};
  for (const id of Object.keys(SKILLS)) m[id] = { value: 0.88 };
  return m as any;
}

describe('reasoning policy', () => {
  it('every eligible skill exists in the skill graph', () => {
    for (const id of skillsWithReasoning()) expect(SKILLS[id]).toBeDefined();
    expect(skillsWithReasoning().length).toBeGreaterThan(20);
  });

  it('withholds reasoning items from learners who cannot yet execute', () => {
    expect(REASONING_FLOOR).toBeGreaterThan(STRUGGLING_THRESHOLD);
    expect(pickReasoning({
      skill: 'add.3digit', mastery: 0.4, cls: '4th', roll: 0, kindRoll: 0,
    })).toBeNull();
  });

  it('never serves error hunting below Class 3', () => {
    for (const cls of ['1st', '2nd'] as const) {
      for (let k = 0; k < 30; k++) {
        for (const skill of skillsWithReasoning()) {
          expect(pickReasoning({ skill, mastery: 0.95, cls, roll: 0, kindRoll: k / 30 }))
            .not.toBe('errorHunt');
        }
      }
    }
  });

  it('the split renormalises when a skill allows only some formats', () => {
    // A skill offering one format must receive its WHOLE reasoning budget.
    // Without renormalisation, `sub.large` (errorHunt only, weight 0.66) keeps
    // 66% of its rolls and drops the other 34% on the floor — so it would
    // return null a third of the time it should have returned an item. The
    // first version of this test only checked WHICH kind came back, which is
    // unchanged by the bug: it passed against the broken implementation.
    // Observable only on a skill offering SOME but not all formats.
    // `add.large` allows errorHunt (0.66) and methodCompare (0.19), summing to
    // 0.85. Renormalised, that is 77.6% / 22.4%. Without renormalisation the
    // 15% shortfall falls through to the final fallback, which always returns
    // the LAST allowed kind — inflating methodCompare to ~34%, half again as
    // often as intended.
    //
    // Two earlier versions of this test passed against the broken code: one
    // asserted only WHICH kind came back, the other counted how many rolls
    // were served. Both are invariant under the bug, because the fallback
    // hides it. Only the distribution exposes it.
    let hunts = 0;
    let compares = 0;
    const N = 2000;
    for (let k = 0; k < N; k++) {
      const got = pickReasoning({
        skill: 'add.large', mastery: 0.9, cls: '6th', roll: 0, kindRoll: k / N,
      });
      if (got === 'errorHunt') hunts++;
      else if (got === 'methodCompare') compares++;
    }
    expect(hunts + compares).toBe(N);
    const compareShare = compares / N;
    expect(compareShare).toBeGreaterThan(0.19);
    expect(compareShare).toBeLessThan(0.26);
  });

  it('SPLIT sums to 1', () => {
    const sum = Object.values(SPLIT).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
  });

  /**
   * P1-16's actual acceptance criterion.
   *
   * This measures the SHIPPED routing across real scheduler plans, because the
   * rate constant alone says nothing: it is applied to a 48.3% eligible
   * denominator, so 0.14 yielded 3.64%. Asserting on the constant would be
   * documentation; asserting on the measured share is the guard.
   */
  it('error analysis lands near 8% of planned questions (docs/26 B24)', () => {
    const mastery = secureMastery();
    let total = 0;
    let hunts = 0;
    for (const cls of CLASSES) {
      for (let s = 0; s < 120; s++) {
        for (const step of buildSession(cls, mastery, 10, Date.now())) {
          total++;
          const got = pickReasoning({
            skill: step.skill, mastery: 0.88, cls,
            roll: Math.random(), kindRoll: Math.random(),
          });
          if (got === 'errorHunt') hunts++;
        }
      }
    }
    const share = hunts / total;
    // Was 0.00% before this policy: `generateForSkill` bypassed the
    // `number_sense` dispatcher branch that hosted the only error-hunt path.
    expect(share).toBeGreaterThan(0.06);
    expect(share).toBeLessThan(0.11);
  });

  it('reading-heavy formats stay a minority of the session', () => {
    // The counter-pressure. All six non-standard formats together must not
    // dominate: a session that is a quarter long-stem reading is one children
    // stop opening, and none of these items are worth that.
    const mastery = secureMastery();
    let total = 0;
    let heavy = 0;
    for (const cls of CLASSES) {
      for (let s = 0; s < 120; s++) {
        for (const step of buildSession(cls, mastery, 10, Date.now())) {
          total++;
          const r = pickReasoning({
            skill: step.skill, mastery: 0.88, cls, roll: Math.random(), kindRoll: Math.random(),
          });
          const o = r ? null : pickOpenTask({
            skill: step.skill, mastery: 0.88, cls, roll: Math.random(), kindRoll: Math.random(),
          });
          if (r || o) heavy++;
        }
      }
    }
    expect(heavy / total).toBeLessThan(0.30);
  });

  it('is a pure function of its arguments', () => {
    const args = { skill: 'mul.2digit', mastery: 0.8, cls: '5th' as const, roll: 0.05, kindRoll: 0.5 };
    const a = pickReasoning(args);
    for (let i = 0; i < 50; i++) expect(pickReasoning(args)).toBe(a);
  });
});

describe('metacognitive generators', () => {
  it('method comparison offers two CORRECT methods, never a wrong one', () => {
    // If one method were wrong the item would collapse into error hunting and
    // would teach that non-standard strategies are mistakes.
    for (const cls of CLASSES) {
      for (let i = 0; i < 60; i++) {
        const q = genMethodCompare(cls, 'medium');
        expect(q.questionText).toMatch(/whose way is quicker|कौन-सा तरीका तेज़/);
        expect(q.choices.length).toBe(3);
        expect(q.choices).toContain(q.answer);
      }
    }
  });

  it('method comparison does not always reward the clever-looking method', () => {
    // A generator where compensation always wins teaches "always compensate",
    // which is false and is exactly the flexibility failure the format exists
    // to prevent.
    const answers = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const q = genMethodCompare('5th', 'medium');
      const lines = q.questionText.split('\n');
      const first = lines.find(l => /^[A-Za-z\u0900-\u097F]+: /.test(l)) ?? '';
      answers.add(String(q.answer) === first.split(':')[0] + "'s way" ? 'first' : 'second');
    }
    expect(answers.size).toBeGreaterThanOrEqual(1);
    // The real assertion: both column-first and compensation-first items exist.
    let columnWins = 0;
    let compensationWins = 0;
    for (let i = 0; i < 600; i++) {
      const q = genMethodCompare('5th', 'medium');
      const txt = q.questionText;
      const winner = String(q.answer).replace(/'s way|का तरीका/, '').trim();
      const line = txt.split('\n').find(l => l.startsWith(winner + ':')) ?? '';
      if (/Added the columns|अंकों में जोड़ा/.test(line)) columnWins++;
      else compensationWins++;
    }
    expect(columnWins).toBeGreaterThan(20);
    expect(compensationWins).toBeGreaterThan(20);
  });

  it('reasoning selection gives the answer away and asks only for the why', () => {
    for (const cls of CLASSES) {
      for (let i = 0; i < 60; i++) {
        const q = genReasonSelect(cls, 'medium');
        expect(q.questionText).toMatch(/Why|How do you know|How can|क्यों|कैसे पता|कैसे हो गया/);
        expect(q.choices.length).toBeGreaterThanOrEqual(3);
        expect(q.choices).toContain(q.answer);
        // Distractors must be distinct, or a repeated tile gives a free
        // elimination (the defect docs/27 records for genPattern).
        expect(new Set(q.choices.map(String)).size).toBe(q.choices.length);
      }
    }
  });

  it('all three formats render in Hindi without Devanagari numerals', () => {
    for (const gen of [genMethodCompare, genReasonSelect, genErrorHunt]) {
      for (let i = 0; i < 60; i++) {
        const q = gen('5th', 'medium', 'hi');
        expect(q.questionText).not.toMatch(/[०-९]/);
        for (const c of q.choices) expect(String(c)).not.toMatch(/[०-९]/);
        // Unsubstituted template literals are a real failure mode when a
        // string is built in one language and copied to the other.
        expect(q.questionText).not.toContain('${');
        for (const c of q.choices) expect(String(c)).not.toContain('${');
      }
    }
  });
});
