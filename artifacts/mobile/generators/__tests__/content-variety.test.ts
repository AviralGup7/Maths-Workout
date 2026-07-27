// ─── Content variety ─────────────────────────────────────────────────────────
// docs/21 · F8.
//
// A generator cell that produces very few distinct questions has two costs, and
// the second is the serious one:
//
//   · the learner is bored, and
//   · the learner memorises the STRING rather than the method, which the
//     mastery model then reads as genuine skill
//
// The economy already defends against this at pricing time — `repetitionDecay`
// halves payout per recent repeat — but pricing cannot manufacture variety that
// the generator does not have.
//
// The distinction this test encodes: some cells are LEGITIMATELY finite. There
// are only sixteen single-digit addition facts within 10, and inventing more
// would mean leaving the Class 1 curriculum. Those are allow-listed with a
// reason. Everything else must clear a floor.

import { describe, it, expect } from 'vitest';
import { generateQuestion, getAvailableCategories } from '../index';
import type { Category, Difficulty, SchoolClass } from '../types';

const CLASSES: SchoolClass[] = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];
const SAMPLES = 4000;

/**
 * Cells whose question space is genuinely bounded by the mathematics, not by
 * the generator. Each needs a reason: the allow-list must never become a place
 * to hide thin content.
 */
const FINITE_BY_NATURE: Record<string, string> = {
  '1st|multiplication|easy':  'products within 2x5 — the whole Class 1 space is ~4 facts',
  '1st|multiplication|medium': 'small products; the space is inherently tiny',
  '1st|multiplication|hard':  'small products; the space is inherently tiny',
  '1st|addition|easy':        'sums within 10 — 16 facts exist and that is all',
};

describe('generators produce enough distinct questions', () => {
  it('every cell clears the variety floor, or is a declared finite space', () => {
    const thin: string[] = [];
    const unusedAllowances: string[] = [];

    for (const cls of CLASSES) {
      for (const cat of getAvailableCategories(cls)) {
        if (cat === 'tables' || cat === 'mixed') continue;
        for (const d of DIFFS) {
          const key = `${cls}|${cat}|${d}`;
          const seen = new Set<string>();
          let drawn = 0;
          for (let i = 0; i < SAMPLES; i++) {
            let q;
            try { q = generateQuestion(cls, d, cat as Category); } catch { continue; }
            drawn++;
            seen.add(q.questionText);
          }
          if (drawn === 0) continue;

          const allowed = key in FINITE_BY_NATURE;
          // 12 distinct items keeps the chance of a repeat inside a 20-question
          // session below roughly even odds, which is the point at which a
          // child starts noticing they have seen this exact question already.
          if (seen.size < 12 && !allowed) thin.push(`${key}: only ${seen.size} distinct`);
          if (seen.size >= 40 && allowed) unusedAllowances.push(`${key}: now ${seen.size}`);
        }
      }
    }

    expect(thin, `thin generator cells:\n${thin.join('\n')}`).toEqual([]);
    // Keeps the allow-list honest: if a cell has been enriched past the point
    // of needing an exemption, the exemption should be deleted.
    expect(unusedAllowances,
      `these no longer need a FINITE_BY_NATURE exemption:\n${unusedAllowances.join('\n')}`).toEqual([]);
  }, 300_000);

  it('no single question dominates a cell that is not finite by nature', () => {
    const dominated: string[] = [];
    for (const cls of CLASSES) {
      for (const cat of getAvailableCategories(cls)) {
        if (cat === 'tables' || cat === 'mixed') continue;
        for (const d of DIFFS) {
          const key = `${cls}|${cat}|${d}`;
          if (key in FINITE_BY_NATURE) continue;
          const counts = new Map<string, number>();
          let drawn = 0;
          for (let i = 0; i < SAMPLES; i++) {
            let q;
            try { q = generateQuestion(cls, d, cat as Category); } catch { continue; }
            drawn++;
            counts.set(q.questionText, (counts.get(q.questionText) ?? 0) + 1);
          }
          if (drawn === 0) continue;
          const top = Math.max(...counts.values()) / drawn;
          if (top > 0.20) dominated.push(`${key}: top item is ${(top * 100).toFixed(0)}% of draws`);
        }
      }
    }
    expect(dominated, `over-concentrated cells:\n${dominated.join('\n')}`).toEqual([]);
  }, 300_000);
});
