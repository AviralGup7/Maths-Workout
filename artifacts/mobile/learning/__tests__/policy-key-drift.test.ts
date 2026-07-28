// ─── Eligibility-map drift guard ─────────────────────────────────────────────
//
// Three policies decide which skills meet which question format by keying a
// map on skill id: `openTaskPolicy`, `reasoningPolicy`, `representationPolicy`.
// All three expose a `skillsWith*()` helper that FILTERS to known skills, and
// all three had a guard of the form:
//
//     for (const id of skillsWithX()) expect(SKILLS[id]).toBeDefined();
//
// which cannot fail. The filter removes exactly the ids the assertion is
// looking for. A mistyped key is silently dropped and the format quietly stops
// existing for that skill — with no test failure, no type error (`SkillId` is
// a bare `string`), and no runtime error.
//
// Found while regression-testing the new representation policy: typing
// `percent.basics` for `percent.basic` left all seven of its assertions green.
// The same blind spot was already present in the two older policies, which is
// why this guard covers all three rather than only the new one.
//
// It also catches the reverse drift — a skill renamed in skills.ts leaving a
// stale key behind — which is the more likely way this actually happens.

import { describe, it, expect } from 'vitest';
import { SKILLS } from '../skills';
import { skillsWithOpenTasks, declaredOpenTaskKeys } from '../openTaskPolicy';
import { skillsWithReasoning, declaredReasoningKeys } from '../reasoningPolicy';
import { skillsWithRepresentation, declaredRepresentationKeys } from '../representationPolicy';

const POLICIES: { name: string; raw: () => string[]; filtered: () => string[] }[] = [
  { name: 'openTaskPolicy',       raw: declaredOpenTaskKeys,       filtered: skillsWithOpenTasks },
  { name: 'reasoningPolicy',      raw: declaredReasoningKeys,      filtered: skillsWithReasoning },
  { name: 'representationPolicy', raw: declaredRepresentationKeys, filtered: skillsWithRepresentation },
];

describe('policy eligibility maps do not drift from the skill list', () => {
  for (const p of POLICIES) {
    it(`${p.name}: every declared key names a real skill`, () => {
      const unknown = p.raw().filter(id => !(id in SKILLS));
      expect(unknown, `${p.name} references skills that do not exist: ${unknown.join(', ')}`).toEqual([]);
    });

    it(`${p.name}: the filtered helper drops nothing`, () => {
      // If these differ, a key is being silently swallowed — which is the
      // failure mode itself, restated so it cannot be missed.
      expect(p.filtered().length, p.name).toBe(p.raw().length);
    });

    it(`${p.name}: declares at least one skill`, () => {
      expect(p.raw().length, `${p.name} is empty — the format reaches nobody`).toBeGreaterThan(0);
    });
  }
});
