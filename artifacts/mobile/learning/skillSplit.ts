// ─── Splitting over-broad skills ─────────────────────────────────────────────
// docs/27 P2-01, P2-02, P2-03 and the migration P2-04.
//
// Three skill nodes each carried several unrelated concepts:
//
//   geometry.basic     area · perimeter · angles
//   measurement.basic  length · mass · capacity · unit conversion
//   data.basic         mean · median · mode · range
//
// That quietly disabled the app's best feature. A child who computes perimeter
// perfectly and confuses area with it every time reads as ~50% on
// `geometry.basic`, which the scheduler treats as "partly learned, keep
// mixing" — the single worst response, because the half they cannot do never
// gets targeted. The misconception library already names
// `geometry.area-perimeter-swap`; the skill graph could not act on it.
//
// The classifier below is the load-bearing piece and is shared by BOTH uses:
//
//   · routing    — generate until the question matches the planned sub-skill
//   · migration  — re-label historical attempts from their stored question text
//
// Sharing it is deliberate. Two classifiers would drift, and a migration that
// disagrees with the router would silently move a child's history onto skills
// they are never served again.

import type { SkillId } from './skills';
import type { Attempt } from './attempts';

/** Parent skills that were split, and what they split into. */
export const SPLIT_PARENTS: Record<SkillId, SkillId[]> = {
  'geometry.basic': ['geometry.area', 'geometry.perimeter', 'geometry.angles'],
  // Split by the quantity being converted, not into "length" vs "conversion".
  // Measuring the generator first showed every one of its 12 question forms
  // across all three difficulties is a unit conversion — there is no
  // "how long is this pencil" content to put in a `measurement.length` node,
  // so three of the four originally planned sub-skills would have shipped
  // permanently empty. The conversions themselves genuinely differ: a child
  // can know km→m and still fail mL→L, because the second crosses the
  // decimal point downward.
  'measurement.basic': [
    'measurement.length', 'measurement.mass', 'measurement.capacity',
  ],
  'data.basic': ['data.mean', 'data.median', 'data.mode', 'data.range'],
};

/** True when this id is a retired parent that should no longer be scheduled. */
export function isRetiredParent(id: SkillId): boolean {
  return id in SPLIT_PARENTS;
}

/**
 * Classify a question by its text.
 *
 * Order matters and is not arbitrary. "A square has perimeter 36. How long is
 * each side?" contains both concepts, and it is a PERIMETER question — the
 * child works backwards from the perimeter formula and never computes an area.
 * Testing for area first would misfile every one of them, which is precisely
 * the confusion the split exists to resolve.
 *
 * Returns null when nothing matches, so the caller keeps the parent skill
 * rather than guessing. A wrong sub-skill is worse than an unsplit one: it
 * puts evidence behind a claim about the child that is not true.
 */
export function classifyQuestion(parent: SkillId, text: string): SkillId | null {
  const t = text.toLowerCase();

  if (parent === 'geometry.basic') {
    // Perimeter and area are tested BEFORE angles, and `angle` carries word
    // boundaries. Both matter, and the second was found by measurement rather
    // than review: `/angle/` also matches "rect-ANGLE" and "tri-ANGLE", so
    // "Perimeter of a rectangle 8 × 5" and "Area of a triangle" were both
    // filed under `geometry.angles` — 4 of 6 medium forms and 3 of 6 hard
    // forms misclassified, in the exact pair of concepts this split exists to
    // separate.
    if (/perimeter/.test(t)) return 'geometry.perimeter';
    if (/\barea\b/.test(t)) return 'geometry.area';
    if (/degree|\bangles?\b|°/.test(t)) return 'geometry.angles';
    // "A rectangle is 9 long and 4 wide. How much longer…" is neither; it is a
    // subtraction dressed in a rectangle. Left unclassified on purpose.
    return null;
  }

  if (parent === 'measurement.basic') {
    // Capacity and mass are tested before length because `l`/`ml` and `g`/`kg`
    // are unambiguous, whereas a bare `m` appears inside neither — but `g` is
    // a suffix of nothing here and `l` of nothing either, so order is a
    // safety margin rather than a requirement.
    if (/\b(l|ml|litre|liter|millilitre)\b|capacity/.test(t)) return 'measurement.capacity';
    if (/\b(kg|g|gram|kilogram)\b|mass|weigh/.test(t)) return 'measurement.mass';
    if (/\b(km|m|cm|mm|metre|meter|centimetre)\b|length|long|tall|height|distance/.test(t)) {
      return 'measurement.length';
    }
    return null;
  }

  if (parent === 'data.basic') {
    if (/\bmean\b|average/.test(t)) return 'data.mean';
    if (/\bmedian\b/.test(t)) return 'data.median';
    if (/\bmode\b/.test(t)) return 'data.mode';
    if (/\brange\b/.test(t)) return 'data.range';
    return null;
  }

  return null;
}

/**
 * Re-label one stored attempt onto its sub-skill. P2-04.
 *
 * Returns the attempt unchanged when it is not on a split parent, or when the
 * text cannot be classified. History is never DISCARDED — an unclassifiable
 * row keeps its parent skill, and the parent still exists in the graph as a
 * retired node so mastery for it remains readable.
 */
export function migrateAttempt(a: Attempt): Attempt {
  if (!isRetiredParent(a.skill)) return a;
  const sub = classifyQuestion(a.skill, a.questionText);
  return sub ? { ...a, skill: sub } : a;
}

export interface MigrationReport {
  total: number;
  migrated: number;
  unclassified: number;
  bySkill: Record<SkillId, number>;
}

/**
 * Migrate a whole attempt log, with a report.
 *
 * The report is not decoration: a migration that silently classifies 5% of
 * rows is indistinguishable from one that classifies 95%, and the difference
 * decides whether the split helps or just fragments the evidence. The guard
 * test asserts on the measured rate.
 */
export function migrateLog(log: Attempt[]): { log: Attempt[]; report: MigrationReport } {
  const report: MigrationReport = { total: 0, migrated: 0, unclassified: 0, bySkill: {} };
  const out = log.map(a => {
    if (!isRetiredParent(a.skill)) return a;
    report.total++;
    const next = migrateAttempt(a);
    if (next.skill === a.skill) {
      report.unclassified++;
    } else {
      report.migrated++;
      report.bySkill[next.skill] = (report.bySkill[next.skill] ?? 0) + 1;
    }
    return next;
  });
  return { log: out, report };
}
