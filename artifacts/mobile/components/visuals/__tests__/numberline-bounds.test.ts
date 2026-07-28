// docs/27 P1-01. A number line that does not reach the answer contradicts the
// question it sits under: "About how much is 38 + 23?" was drawn on a 0–40
// line, putting every offered band off the end of it. The bug was invisible to
// typecheck and to 700 unit tests, and obvious in a screenshot.
import { describe, it, expect } from 'vitest';
import { extractOperands } from '../../../learning/misconceptions';
import { generateQuestion } from '../../../generators';
import { visualFor } from '../../../learning/visualPolicy';
import { resolveSkill } from '../../../learning/skills';
import type { Category, Difficulty, SchoolClass } from '../../../generators/types';

/** Mirrors the bound computation in QuestionVisual. */
function bounds(q: { questionText: string; answer: unknown; interaction?: unknown }) {
  const nums = extractOperands(q.questionText).filter(Number.isFinite);
  if (nums.length === 0) return null;
  const reach = [...nums];
  const a = Number(q.answer);
  if (Number.isFinite(a)) reach.push(a);
  const it = q.interaction as { kind?: string; bands?: [number, number][] } | undefined;
  if (it?.kind === 'estimate' && it.bands) for (const [lo, hi] of it.bands) reach.push(lo, hi);
  else if (typeof q.answer === 'string') {
    for (const m of q.answer.matchAll(/-?\d+(?:\.\d+)?/g)) reach.push(Number(m[0]));
  }
  return { lo: Math.min(0, ...reach), hi: Math.max(...reach) };
}

/** Every value the learner might be asked to locate on the line. */
function targets(q: { answer: unknown; interaction?: unknown }): number[] {
  const it = q.interaction as { kind?: string; bands?: [number, number][] } | undefined;
  if (it?.kind === 'estimate' && it.bands) return it.bands.flat();
  const a = Number(q.answer);
  return Number.isFinite(a) ? [a] : [];
}

describe('number-line visuals span the answer', () => {
  it('the answer always falls inside the drawn range', () => {
    const cells: [SchoolClass, Difficulty, Category][] = [
      ['2nd', 'medium', 'number_sense'], ['3rd', 'hard', 'number_sense'],
      ['5th', 'easy', 'decimals'], ['6th', 'easy', 'integers'],
    ];
    const failures: string[] = [];
    for (const [cls, diff, cat] of cells) {
      const skill = resolveSkill(cls, cat, diff);
      if (visualFor(skill) !== 'numberLine') continue;
      for (let i = 0; i < 400; i++) {
        let q;
        try { q = generateQuestion(cls, diff, cat); } catch { continue; }
        const b = bounds(q);
        if (!b) continue;
        for (const t of targets(q)) {
          if (t < b.lo || t > b.hi) {
            failures.push(`${skill}: "${q.questionText.replace(/\n/g, ' ')}" target ${t} outside ${b.lo}-${b.hi}`);
          }
        }
      }
    }
    expect([...new Set(failures)].slice(0, 5)).toEqual([]);
  }, 60_000);
});
