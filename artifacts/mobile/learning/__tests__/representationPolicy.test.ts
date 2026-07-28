// ─── docs/27 P3-07 / P3-09 · does the policy actually deliver? ───────────────
//
// The failure mode this exists for is not "the generator is wrong" — that is
// covered by generators/__tests__/representation.test.ts. It is DEAD CODE: a
// generator wired behind a policy whose eligibility map, class floor or
// mastery gate happen never to coincide, so the format ships, typechecks,
// passes its own unit tests and is met by nobody.
//
// This repo has produced that defect before. `barModelPolicy`'s savings rule
// measured as dead code — coverage fell when it was removed, because the
// branch above it already matched every case. `genErrorHunt` was reachable
// only through a dispatcher branch the scheduler bypassed, so its measured
// share in adaptive sessions was 0.00% of 12,000 questions while a comment
// claimed 1.1%.
//
// So the guard measures the SHARE, per format, through the real policy.

import { describe, it, expect } from 'vitest';
import {
  pickRepresentation, skillsWithRepresentation, declaredRepresentationKeys,
  REPRESENTATION_RATE, REPRESENTATION_FLOOR, CONVERT_CEILING,
} from '../representationPolicy';
import type { RepresentationKind } from '../representationPolicy';
import { SKILLS } from '../skills';
import type { SkillId } from '../skills';
import type { SchoolClass } from '../../generators/types';

const CLASSES: SchoolClass[] = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
const LEVELS = [0.25, 0.35, 0.45, 0.55, 0.65, 0.72, 0.80, 0.88];

function tally() {
  const byKind: Record<string, number> = {};
  let served = 0, total = 0;
  for (const skill of Object.keys(SKILLS) as SkillId[]) {
    for (const cls of CLASSES) for (const level of LEVELS) {
      for (let i = 0; i < 60; i++) {
        total++;
        const k = pickRepresentation({ skill, mastery: level, cls, roll: Math.random(), kindRoll: Math.random() });
        if (k) { served++; byKind[k] = (byKind[k] ?? 0) + 1; }
      }
    }
  }
  return { byKind, served, total };
}

describe('P3-07 / P3-09 · the policy reaches real learners', () => {
  it('serves every one of the four formats', () => {
    const { byKind, served, total } = tally();
    console.log(`representation · ${served}/${total} served (${(served / total * 100).toFixed(1)}%) · ` +
      Object.entries(byKind).map(([k, v]) => `${k} ${v}`).join(' · '));
    for (const k of ['convert', 'match', 'nonExample', 'nonExampleSet'] as RepresentationKind[]) {
      expect(byKind[k] ?? 0, `format "${k}" is never served — dead code`).toBeGreaterThan(0);
    }
  });

  it('every eligible skill is a real skill', () => {
    // Checked against the RAW keys, not the filtered list. `SkillId` is a bare
    // `string`, so a typo is invisible to the type checker, and
    // `skillsWithRepresentation` filters unknown ids out — so a guard written
    // against the filtered list passes against a broken map. Verified: typing
    // `percent.basics` for `percent.basic` left the first draft of this test
    // green while percentages silently lost the format.
    for (const id of declaredRepresentationKeys()) {
      expect(SKILLS[id], `"${id}" is in the eligibility map but is not a skill`).toBeDefined();
    }
    expect(declaredRepresentationKeys().length).toBe(skillsWithRepresentation().length);
    expect(skillsWithRepresentation().length).toBeGreaterThanOrEqual(10);
  });

  it('withholds from a struggling learner', () => {
    for (const skill of skillsWithRepresentation()) {
      for (const cls of CLASSES) {
        for (const m of [0, 0.1, 0.2, REPRESENTATION_FLOOR - 0.001]) {
          expect(pickRepresentation({ skill, mastery: m, cls, roll: 0, kindRoll: 0 }), `${skill} @ ${m}`).toBeNull();
        }
      }
    }
  });

  it('never exceeds the declared rate', () => {
    for (const skill of skillsWithRepresentation()) {
      expect(pickRepresentation({ skill, mastery: 0.7, cls: '6th', roll: REPRESENTATION_RATE, kindRoll: 0 })).toBeNull();
      expect(pickRepresentation({ skill, mastery: 0.7, cls: '6th', roll: 0.99, kindRoll: 0 })).toBeNull();
    }
  });

  it('fades conversion out for a secure learner but keeps non-examples', () => {
    // The asymmetry is the point: converting 3/4 to 75% for the two hundredth
    // time is a drilled rule, but a definition is worth re-testing.
    let convertHigh = 0, nonExampleHigh = 0;
    for (let i = 0; i < 4000; i++) {
      const k = pickRepresentation({
        skill: 'frac.equivalence', mastery: CONVERT_CEILING + 0.05, cls: '6th',
        roll: 0, kindRoll: Math.random(),
      });
      if (k === 'convert' || k === 'match') convertHigh++;
      if (k === 'nonExample' || k === 'nonExampleSet') nonExampleHigh++;
    }
    expect(convertHigh, 'conversion still served above the ceiling').toBe(0);
    expect(nonExampleHigh, 'non-examples wrongly faded out too').toBeGreaterThan(0);
  });

  it('respects the class floor — no conversion before Class 4', () => {
    for (const skill of skillsWithRepresentation()) {
      for (const cls of ['1st', '2nd', '3rd'] as SchoolClass[]) {
        for (let i = 0; i < 200; i++) {
          const k = pickRepresentation({ skill, mastery: 0.7, cls, roll: 0, kindRoll: Math.random() });
          expect(k === 'convert' || k === 'match', `${skill} ${cls} got ${k}`).toBe(false);
        }
      }
    }
  });

  it('prefers the set-valued forms, which resist elimination', () => {
    let set = 0, single = 0;
    for (let i = 0; i < 6000; i++) {
      const k = pickRepresentation({
        skill: 'frac.equivalence', mastery: 0.6, cls: '6th', roll: 0, kindRoll: Math.random(),
      });
      if (k === 'match' || k === 'nonExampleSet') set++;
      else if (k) single++;
    }
    expect(set).toBeGreaterThan(single);
  });
});
