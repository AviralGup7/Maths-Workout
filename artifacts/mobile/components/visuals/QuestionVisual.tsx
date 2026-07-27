import React from 'react';
import { View } from 'react-native';
import { NumberLine } from './NumberLine';
import { PartModel } from './PartModel';
import { ArrayGrid } from './ArrayGrid';
import { BaseTen } from './BaseTen';
import { visualFor, visualMode } from '@/learning/visualPolicy';
import { extractOperands, extractFractions } from '@/learning/misconceptions';
import type { Question } from '@/generators/types';
import type { SkillId } from '@/learning/skills';

/**
 * Chooses and renders the right visual for a question, or nothing.
 *
 * This is the boundary that keeps the game screen free of visual-selection
 * logic. It answers one question — "what, if anything, should the child see
 * beside this problem?" — using the mastery-driven fade rule.
 *
 * Currently renders in ILLUSTRATIVE mode only. Interactive visuals (where the
 * visual *is* the answer surface — "tap where 0.45 goes") are a larger change
 * to the answer pipeline and are deliberately deferred rather than half-built:
 * a visual the child can tap but which is not graded would be worse than none.
 */
export function QuestionVisual({
  question,
  skill,
  mastery,
  showState = 'idle',
}: {
  question: Question;
  skill: SkillId | null;
  mastery: number;
  showState?: 'idle' | 'correct' | 'wrong';
}) {
  if (!skill) return null;

  const mode = visualMode(skill, mastery);
  if (mode === 'none') return null;

  const model = visualFor(skill);
  if (!model) return null;

  const operands = extractOperands(question.questionText);
  const fractions = extractFractions(question.questionText);

  // Every branch below bails out rather than guessing when the question text
  // does not yield sensible parameters. A visual that misrepresents the problem
  // is worse than no visual — it would actively teach the wrong thing.
  if (model === 'partModel') {
    const f = fractions[0];
    if (!f || f.d < 1 || f.d > 24 || f.n > f.d) return null;
    return (
      <View accessibilityLabel="Fraction diagram">
        <PartModel
          denominator={f.d}
          shaded={f.n}
          shape={f.d <= 8 ? 'bar' : 'set'}
          showState={showState}
          height={96}
          showLabel={false}
        />
      </View>
    );
  }

  if (model === 'numberLine') {
    const nums = operands.filter(Number.isFinite);
    if (nums.length === 0) return null;
    const lo = Math.min(0, ...nums);
    const hi = Math.max(...nums);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi === lo) return null;
    const span = hi - lo;
    const step = niceStep(span);
    return (
      <NumberLine
        min={Math.floor(lo / step) * step}
        max={Math.ceil(hi / step) * step}
        step={step}
        marks={nums.slice(0, 2).map(v => ({ value: v }))}
        showState={showState}
      />
    );
  }

  if (model === 'arrayGrid') {
    const [a, b] = operands;
    if (!a || !b || a > 12 || b > 12 || a < 1 || b < 1) return null;
    return <ArrayGrid rows={a} cols={b} showState={showState} />;
  }

  if (model === 'baseTen') {
    const [a] = operands;
    if (!Number.isFinite(a) || a < 0 || a > 999) return null;
    // Show the first operand only: the point is to make the *quantity* concrete
    // before it is manipulated, not to pre-compute the answer for the child.
    return <BaseTen value={a} showPlaces />;
  }

  return null;
}

/** A tick spacing that yields roughly 4–10 labelled ticks. */
function niceStep(span: number): number {
  const raw = span / 6;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-6))));
  for (const m of [1, 2, 5, 10]) {
    if (mag * m >= raw) return mag * m;
  }
  return mag * 10;
}
