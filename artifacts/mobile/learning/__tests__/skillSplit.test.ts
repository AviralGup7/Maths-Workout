import { describe, it, expect } from 'vitest';
import {
  classifyQuestion, migrateAttempt, migrateLog, isRetiredParent, SPLIT_PARENTS,
} from '../skillSplit';
import { SKILLS, resolveSkill } from '../skills';
import { generateForSkill } from '../../generators';
import { genGeometry, genData } from '../../generators/advanced';
import { genMeasurement } from '../../generators/topics-core';
import { diagnose } from '../misconceptions';
import type { Attempt } from '../attempts';
import type { SchoolClass, Difficulty, Category } from '../../generators/types';

const CLASSES: SchoolClass[] = ['3rd', '4th', '5th', '6th'];
const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];

const row = (over: Partial<Attempt>): Attempt => ({
  skill: 'geometry.basic', correct: false, answeredAt: Date.now(), latencyMs: 5000,
  chosen: '1', expected: '2', questionText: '', timedOut: false,
  cls: '5th', category: 'geometry', difficulty: 'medium', ...over,
});

describe('split skills exist and are wired', () => {
  it('every sub-skill is a real skill in the graph', () => {
    for (const subs of Object.values(SPLIT_PARENTS)) {
      for (const s of subs) expect(SKILLS[s], `${s} missing from SKILLS`).toBeDefined();
    }
  });

  it('parents are retained but retired', () => {
    // Retained so historical mastery stays readable; retired so nothing new is
    // logged against them.
    for (const parent of Object.keys(SPLIT_PARENTS)) {
      expect(SKILLS[parent]).toBeDefined();
      expect(isRetiredParent(parent)).toBe(true);
    }
  });

  it('resolveSkill never returns a retired parent', () => {
    // The regression that would silently undo the whole split: menu play would
    // keep writing to the broad node while adaptive play used the new ones.
    const cats: Category[] = ['geometry', 'measurement', 'data'];
    for (const cls of CLASSES) {
      for (const d of DIFFS) {
        for (const cat of cats) {
          const got = resolveSkill(cls, cat, d);
          expect(isRetiredParent(got), `${cls}/${cat}/${d} → ${got}`).toBe(false);
        }
      }
    }
  });

  it('every sub-skill is reachable from some (class, difficulty) cell', () => {
    // A sub-skill nothing routes to is a node that can never be practised —
    // worse than not splitting, because the graph now claims coverage it does
    // not have.
    const reached = new Set<string>();
    const cats: Category[] = ['geometry', 'measurement', 'data'];
    for (const cls of ['1st', '2nd', ...CLASSES] as SchoolClass[]) {
      for (const d of DIFFS) for (const cat of cats) reached.add(resolveSkill(cls, cat, d));
    }
    for (const subs of Object.values(SPLIT_PARENTS)) {
      for (const s of subs) expect(reached.has(s), `${s} is unreachable`).toBe(true);
    }
  });
});

describe('generator routing', () => {
  it('asking for a sub-skill yields a question of that sub-skill', () => {
    // Measured, not assumed. The first implementation scored 0% on four of the
    // ten sub-skills: /angle/ matched "rect-ANGLE" and "tri-ANGLE", and range
    // and mode exist at only one difficulty band each.
    for (const [parent, subs] of Object.entries(SPLIT_PARENTS)) {
      for (const sub of subs) {
        let hit = 0;
        let total = 0;
        for (const cls of CLASSES) {
          for (const d of DIFFS) {
            for (let i = 0; i < 12; i++) {
              const q = generateForSkill(cls, d, SKILLS[sub].category, sub);
              total++;
              if (classifyQuestion(parent, q.questionText) === sub) hit++;
            }
          }
        }
        expect(hit / total, `${sub} routed ${hit}/${total}`).toBeGreaterThan(0.95);
      }
    }
  });

  it('routed questions match an INDEPENDENT keyword check', () => {
    // The routing test above shares its predicate with the router, so it is
    // self-consistent by construction and cannot catch a classifier bug —
    // verified: reintroducing the /angle/ substring defect leaves it green.
    // This check uses keywords the classifier does not, so the two can fail
    // independently.
    const EXPECT: Record<string, RegExp> = {
      'geometry.area': /area/i,
      'geometry.perimeter': /perimeter/i,
      'geometry.angles': /degree|°/i,
      'measurement.mass': /\b(kg|g)\b/,
      'measurement.capacity': /\b(L|mL)\b/,
      'measurement.length': /\b(km|m|cm)\b/,
      'data.mean': /mean/i,
      'data.median': /median/i,
      'data.mode': /mode/i,
      'data.range': /range/i,
    };
    for (const [sub, re] of Object.entries(EXPECT)) {
      for (const cls of CLASSES) {
        for (const d of DIFFS) {
          const q = generateForSkill(cls, d, SKILLS[sub].category, sub);
          expect(q.questionText, `${sub} @ ${cls}/${d}: ${q.questionText}`).toMatch(re);
        }
      }
    }
  });

  it('the classifier files perimeter-of-a-rectangle under perimeter', () => {
    // The specific bug: "Perimeter of a rectangle 8 × 5 = ?" went to
    // geometry.angles, in the exact concept pair the split exists to separate.
    expect(classifyQuestion('geometry.basic', 'Perimeter of a rectangle 8 × 5 = ?'))
      .toBe('geometry.perimeter');
    expect(classifyQuestion('geometry.basic', 'Area of a triangle, base 6, height 4'))
      .toBe('geometry.area');
    expect(classifyQuestion('geometry.basic', 'Angles in a triangle add up to ___°?'))
      .toBe('geometry.angles');
  });

  it('a back-to-front perimeter question is perimeter, not area', () => {
    // "A square has perimeter 36. How long is each side?" contains no area
    // reasoning at all. Testing area first would misfile every one of them.
    expect(classifyQuestion('geometry.basic', 'A square has perimeter 36.\nHow long is each side?'))
      .toBe('geometry.perimeter');
    expect(classifyQuestion('geometry.basic', 'A square has area 49.\nHow long is each side?'))
      .toBe('geometry.area');
  });

  it('files volume questions under volume, not the retired parent', () => {
    // The regression that motivated `geometry.volume`: 177 of 720 generated
    // geometry questions were "Volume of a cube with side N cm", which matched
    // none of area / perimeter / angles. Every attempt at the only 3D content
    // in the app was therefore logged against a node the scheduler no longer
    // serves, so the child could never be given it again.
    expect(classifyQuestion('geometry.basic', 'Volume of a cube with side 5 cm = ?'))
      .toBe('geometry.volume');
    // And it must not steal the 2D questions on its way past.
    expect(classifyQuestion('geometry.basic', 'Area of a square with side 7 = ?'))
      .toBe('geometry.area');
  });

  it('diagnoses volume answered as the area of one face', () => {
    // side³ expected, side² given — the child mapped "volume" onto the area
    // procedure they already had.
    expect(diagnose({
      skill: 'geometry.volume', chosen: '25', expected: '125',
      questionText: 'Volume of a cube with side 5 cm = ?',
    } as any)).toBe('geometry.volume-as-area');
  });

  it('classifies the overwhelming majority of real generated questions', () => {
    // An unclassifiable question is not a bug on its own — some genuinely
    // belong to neither strand — but a high rate would mean the split leaves
    // most evidence stranded on the retired parent.
    for (const [parent, gen] of [
      ['geometry.basic', genGeometry], ['measurement.basic', genMeasurement], ['data.basic', genData],
    ] as const) {
      let classified = 0;
      let total = 0;
      for (const cls of CLASSES) {
        for (const d of DIFFS) {
          for (let i = 0; i < 60; i++) {
            const q = (gen as any)(cls, d);
            total++;
            if (classifyQuestion(parent, q.questionText)) classified++;
          }
        }
      }
      expect(classified / total, `${parent} classified ${classified}/${total}`).toBeGreaterThan(0.9);
    }
  });
});

describe('migration (P2-04)', () => {
  it('re-labels a stored attempt onto its sub-skill', () => {
    const a = row({ skill: 'geometry.basic', questionText: 'Area of a square with side 7 = ?' });
    expect(migrateAttempt(a).skill).toBe('geometry.area');
  });

  it('keeps history rather than discarding what it cannot classify', () => {
    const a = row({ skill: 'geometry.basic', questionText: 'Something unrecognisable' });
    const out = migrateAttempt(a);
    expect(out.skill).toBe('geometry.basic');
    expect(out).toEqual(a);
  });

  it('leaves untouched every attempt on a skill that was not split', () => {
    const a = row({ skill: 'add.2digit.carry', questionText: '47 + 35 = ?' });
    expect(migrateAttempt(a)).toBe(a);
  });

  it('is idempotent — running it twice changes nothing', () => {
    // It runs on every app load, not behind a version gate, so this is a
    // correctness requirement rather than a nicety.
    const log = Array.from({ length: 50 }, (_, i) =>
      row({ skill: 'data.basic', questionText: i % 2 ? 'Find the mean of:\n3, 4, 5, 8' : 'Find the range of:\n3, 4, 5, 8' }));
    const once = migrateLog(log).log;
    const twice = migrateLog(once);
    expect(twice.log).toEqual(once);
    expect(twice.report.migrated).toBe(0);
  });

  it('migrates the large majority of a realistic historical log', () => {
    // The number that decides whether the split helps or merely fragments the
    // evidence. A migration that moves 5% of rows is not a migration.
    const log: Attempt[] = [];
    for (const [parent, gen] of [
      ['geometry.basic', genGeometry], ['measurement.basic', genMeasurement], ['data.basic', genData],
    ] as const) {
      for (let i = 0; i < 200; i++) {
        const q = (gen as any)('5th', DIFFS[i % 3]);
        log.push(row({ skill: parent, questionText: q.questionText }));
      }
    }
    const { report } = migrateLog(log);
    expect(report.total).toBe(600);
    expect(report.migrated / report.total).toBeGreaterThan(0.9);
    // And it must spread across sub-skills, not dump everything on one.
    expect(Object.keys(report.bySkill).length).toBeGreaterThanOrEqual(9);
  });

  it('preserves every field except the skill', () => {
    const a = row({
      skill: 'data.basic', questionText: 'Find the median of:\n3, 9, 4',
      correct: true, latencyMs: 1234, misconception: 'guessing', id: 'x1',
    });
    const out = migrateAttempt(a);
    expect(out.skill).toBe('data.median');
    expect({ ...out, skill: a.skill }).toEqual(a);
  });
});

describe('diagnosis on split skills (P2-17)', () => {
  it('area/perimeter swap is still detected after the split', () => {
    expect(diagnose({
      skill: 'geometry.area', questionText: 'Area of a rectangle 8 × 5 = ?',
      chosen: '26', expected: '40', latencyMs: 6000, timedOut: false,
    })).toBe('geometry.area-perimeter-swap');
  });

  it('detects errors the broad node could not express', () => {
    // These are the point of P2-01/03: each is only expressible because the
    // concept now has its own skill.
    expect(diagnose({
      skill: 'geometry.area', questionText: 'Area of a rectangle 8 × 5 = ?',
      chosen: '64', expected: '40', latencyMs: 6000, timedOut: false,
    })).toBe('geometry.wrong-dimension');

    expect(diagnose({
      skill: 'data.median', questionText: 'Find the median of:\n9, 2, 7',
      chosen: '2', expected: '7', latencyMs: 6000, timedOut: false,
    })).toBe('data.median-unsorted');

    expect(diagnose({
      skill: 'data.range', questionText: 'Find the range of:\n3, 9, 4, 5',
      chosen: '9', expected: '6', latencyMs: 6000, timedOut: false,
    })).toBe('data.range-gave-extreme');
  });

  it('unit conversion is still detected on each measurement strand', () => {
    for (const skill of ['measurement.length', 'measurement.mass', 'measurement.capacity']) {
      expect(diagnose({
        skill, questionText: '4 kg = ___ g?',
        chosen: '400', expected: '4000', latencyMs: 6000, timedOut: false,
      }), skill).toBe('measurement.unit-conversion');
    }
  });
});
