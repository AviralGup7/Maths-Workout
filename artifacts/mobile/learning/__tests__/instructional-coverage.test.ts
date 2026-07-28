// ─── Instructional coverage ──────────────────────────────────────────────────
// docs/27 P1-12.
//
// docs/26 measured twelve skills with no worked example, no hint and no visual
// — including all four Class 1 topics. A six-year-old who could not tell the
// time simply received more time questions, which is testing rather than
// teaching, and nothing in the build objected.
//
// This is the guard that objects. It is deliberately a *floor*, not a target:
// it says every skill must offer the learner SOMETHING when they are stuck, and
// says nothing about how good that something is.

import { describe, it, expect } from 'vitest';
import { SKILLS } from '../skills';
import { hintsFor } from '../hints';
import { canTeach } from '../workedExamples';
import { visualFor } from '../visualPolicy';

/** What a stuck learner can be offered for a given skill. */
function supportFor(skill: string) {
  return {
    hint: hintsFor(skill) !== null,
    worked: canTeach(skill),
    visual: visualFor(skill) !== null,
  };
}

describe('every skill can teach, not only test', () => {
  it('no skill is left with zero instructional support', () => {
    const orphans = Object.values(SKILLS)
      .filter(s => {
        const sup = supportFor(s.id);
        return !sup.hint && !sup.worked && !sup.visual;
      })
      .map(s => `${s.id} (introduced ${s.introducedIn})`);

    expect(orphans, `skills a stuck learner gets no help on:\n${orphans.join('\n')}`)
      .toEqual([]);
  });

  it('every skill has a hint ladder, directly or by family fallback', () => {
    // Hints are the universal fallback: a worked example suits a *method* and a
    // visual suits a *magnitude*, but a hint can orient a learner on anything,
    // including the facts and conventions (telling the time, naming shapes)
    // that correctly have no procedure to demonstrate.
    const missing = Object.values(SKILLS)
      .filter(s => hintsFor(s.id) === null)
      .map(s => s.id);
    expect(missing, `skills with no hint at any level:\n${missing.join('\n')}`).toEqual([]);
  });

  it('hint ladders escalate — orient, then strategy, then directed', () => {
    // A ladder whose rungs are identical is one hint shown three times, which
    // wastes the two chances the design gives a struggling learner.
    for (const s of Object.values(SKILLS)) {
      const h = hintsFor(s.id);
      if (!h) continue;
      for (const lang of ['en', 'hi'] as const) {
        const rungs = [h.orient[lang], h.strategy[lang], h.directed[lang]];
        expect(new Set(rungs).size, `${s.id} (${lang}) repeats a hint rung`).toBe(3);
        for (const r of rungs) {
          expect(r.trim().length, `${s.id} (${lang}) has an empty hint rung`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('Class 1 and 2 skills are supported first', () => {
    // The youngest learners are the most support-dependent and were the least
    // supported. This asserts the priority explicitly so a future refactor
    // cannot quietly reverse it.
    const early = Object.values(SKILLS).filter(s => s.introducedIn === '1st' || s.introducedIn === '2nd');
    expect(early.length).toBeGreaterThan(0);
    for (const s of early) {
      expect(hintsFor(s.id), `${s.id} is a Class ${s.introducedIn} skill with no hint`).not.toBeNull();
    }
  });
});
