// ─── Worked-example correctness ──────────────────────────────────────────────
// docs/27 P1-06 … P1-11.
//
// A worked example that states a wrong answer is worse than no worked example:
// it is the app teaching a mistake, with authority, to a child who has already
// failed twice and is therefore inclined to believe it.
//
// Every defect this guard now catches was real and was found by generating
// against the actual question stream rather than by reading the code:
//
//   · "0.2 − 0.1"      taught as "0 − 2 = -2"   (decimals split at the point)
//   · "2.1 × 3"        taught as "2.1 + 3"      (operator assumed)
//   · "2/3 of 18"      taught as "3 + 18 = 21"  (form assumed)
//   · "A square has perimeter 36" taught as "36 × 36 = 1296"
//   · algebra          produced nothing at all  (result discarded by the parser)
//
// All five typechecked. None would have been caught by a unit test written
// against an invented question string.

import { describe, it, expect } from 'vitest';
import { buildWorkedExample, canTeach, teachingOperands } from '../workedExamples';
import { extractOperands } from '../misconceptions';
import { generateQuestion } from '../../generators';
import { SKILLS } from '../skills';
import type { Category, Difficulty, SchoolClass } from '../../generators/types';

/** Representative (skill, class, difficulty, category) cells for each solver. */
const CELLS: { skill: string; cls: SchoolClass; diff: Difficulty; cat: Category }[] = [
  { skill: 'add.2digit.carry',    cls: '2nd', diff: 'medium', cat: 'addition' },
  { skill: 'sub.2digit.borrow',   cls: '2nd', diff: 'medium', cat: 'subtraction' },
  { skill: 'mul.tables.mid',      cls: '3rd', diff: 'easy',   cat: 'multiplication' },
  { skill: 'div.basic',           cls: '3rd', diff: 'easy',   cat: 'division' },
  { skill: 'frac.ofAmount',       cls: '3rd', diff: 'easy',   cat: 'fractions' },
  { skill: 'frac.addSameDenom',   cls: '4th', diff: 'medium', cat: 'fractions' },
  { skill: 'frac.equivalence',    cls: '4th', diff: 'easy',   cat: 'fractions' },
  { skill: 'dec.tenths',          cls: '5th', diff: 'easy',   cat: 'decimals' },
  { skill: 'dec.hundredths',      cls: '5th', diff: 'hard',   cat: 'decimals' },
  { skill: 'percent.basic',       cls: '6th', diff: 'easy',   cat: 'percentages' },
  { skill: 'ratio.basic',         cls: '6th', diff: 'easy',   cat: 'ratio' },
  { skill: 'geometry.basic',      cls: '4th', diff: 'easy',   cat: 'geometry' },
  { skill: 'algebra.basic',       cls: '6th', diff: 'easy',   cat: 'algebra' },
];

const SAMPLES = 300;

describe('worked examples never teach a wrong answer', () => {
  it('a stated result always matches the real answer', () => {
    const failures: string[] = [];

    for (const { skill, cls, diff, cat } of CELLS) {
      for (let i = 0; i < SAMPLES; i++) {
        let q;
        try { q = generateQuestion(cls, diff, cat); } catch { continue; }

        const we = buildWorkedExample({
          skill, questionText: q.questionText,
          operands: extractOperands(q.questionText),
          answer: Number(q.answer),
        });
        if (!we) continue;   // declining to teach this form is legitimate

        const last = we.steps[we.steps.length - 1].text.en;
        // Only check steps that actually assert a numeric result.
        const m = last.match(/=\s*(-?\d+(?:\.\d+)?)[.°]?\s*$/);
        if (!m) continue;

        const stated = Number(m[1]);
        const truth = Number(q.answer);
        if (Number.isFinite(truth) && Math.abs(stated - truth) > 1e-6) {
          failures.push(`${skill}: "${q.questionText.replace(/\n/g, ' / ')}" answer=${truth} taught=${stated}`);
        }
      }
    }

    expect([...new Set(failures)].slice(0, 10),
      `worked examples contradicting the real answer:\n${[...new Set(failures)].slice(0, 10).join('\n')}`)
      .toEqual([]);
  }, 120_000);

  it('no example contains NaN, Infinity or undefined', () => {
    const bad: string[] = [];
    for (const { skill, cls, diff, cat } of CELLS) {
      for (let i = 0; i < SAMPLES; i++) {
        let q;
        try { q = generateQuestion(cls, diff, cat); } catch { continue; }
        const we = buildWorkedExample({
          skill, questionText: q.questionText,
          operands: extractOperands(q.questionText),
          answer: Number(q.answer),
        });
        if (!we) continue;
        for (const s of we.steps) {
          const text = `${s.text.en} ${s.text.hi} ${s.work ?? ''}`;
          if (/NaN|Infinity|undefined/.test(text)) {
            bad.push(`${skill}: ${text.slice(0, 90)}`);
          }
        }
      }
    }
    expect([...new Set(bad)].slice(0, 10)).toEqual([]);
  }, 120_000);

  it('every example is bilingual and ordered', () => {
    for (const { skill, cls, diff, cat } of CELLS) {
      for (let i = 0; i < 40; i++) {
        let q;
        try { q = generateQuestion(cls, diff, cat); } catch { continue; }
        const we = buildWorkedExample({
          skill, questionText: q.questionText,
          operands: extractOperands(q.questionText),
          answer: Number(q.answer),
        });
        if (!we) continue;
        expect(we.steps.length).toBeGreaterThan(0);
        expect(we.steps.length).toBeLessThanOrEqual(4);
        we.steps.forEach((s, idx) => {
          expect(s.n, `${skill} step numbering`).toBe(idx + 1);
          expect(s.text.en.trim().length, `${skill} empty en`).toBeGreaterThan(0);
          expect(s.text.hi.trim().length, `${skill} empty hi`).toBeGreaterThan(0);
        });
      }
    }
  }, 120_000);
});

describe('the teaching parser reads what the diagnosis parser cannot', () => {
  it('keeps decimals whole and retains both sides of an equation', () => {
    // The two failures that produced wrong teaching.
    expect(teachingOperands('0.2 − 0.1 = ?')).toEqual([0.2, 0.1]);
    expect(teachingOperands('x + 7 = 12')).toEqual([7, 12]);
    expect(teachingOperands('3.48 + 0.01 = ?')).toEqual([3.48, 0.01]);
    // extractOperands stays as it was — diagnosis depends on its behaviour.
    expect(extractOperands('0.2 − 0.1 = ?')).toEqual([0, 2, 0, 1]);
  });
});

describe('solver coverage', () => {
  it('covers the arithmetic spine plus the six docs/27 families', () => {
    const expected = [
      'add.within10', 'add.2digit.carry', 'sub.2digit.borrow', 'mul.tables.mid', 'div.basic',
      'frac.ofAmount', 'frac.addSameDenom', 'frac.equivalence',
      'dec.tenths', 'dec.hundredths', 'percent.basic', 'ratio.basic',
      'geometry.basic', 'algebra.basic',
    ];
    for (const s of expected) {
      expect(canTeach(s), `${s} has no worked-example solver`).toBe(true);
      expect(SKILLS[s], `${s} is not a real skill`).toBeDefined();
    }
  });
});
