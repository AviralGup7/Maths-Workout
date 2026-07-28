// Chapter graph — docs/16 §7.

import { describe, it, expect } from 'vitest';
import {
  CHAPTERS, CHAPTER_BY_ID, chapterStatus, chapterProgress, availableChapters,
  dueReviewChapters, orphanSkills, CHAPTER_UNLOCK_MASTERY, CHAPTER_COMPLETE_MASTERY,
} from '../chapters';
import { SKILLS, ALL_SKILL_IDS } from '../../learning/skills';
import { isRetiredParent } from '../../learning/skillSplit';
import { hasDevanagariDigits } from '../../i18n/strings';
import type { SkillId } from '../../learning/skills';

const all = (v: number): Record<SkillId, number> =>
  Object.fromEntries(ALL_SKILL_IDS.map(s => [s, v]));

describe('the chapter graph is well formed', () => {
  it('names only real skills', () => {
    for (const ch of CHAPTERS) {
      for (const s of ch.skills) expect(SKILLS[s], `${ch.id} → ${s}`).toBeDefined();
    }
  });

  it('covers every skill in the curriculum', () => {
    // A skill with no chapter is unreachable from the map, which would make it
    // invisible to a learner browsing by topic.
    //
    // The three retired split parents (docs/27 P2-01/02/03) are the sole
    // exemption, and it is deliberate: they exist only so historical mastery
    // stays readable after the migration re-labels attempts. Nothing schedules
    // them and nothing should offer them to browse, so a chapter entry would
    // be a lie. Asserted explicitly rather than filtered loosely, so a FOURTH
    // orphan still fails.
    expect(orphanSkills(), 'skills with no chapter')
      .toEqual(['geometry.basic', 'measurement.basic', 'data.basic']);
    for (const id of orphanSkills()) expect(isRetiredParent(id), id).toBe(true);
  });

  it('never names a skill in two chapters', () => {
    const seen = new Set<string>();
    for (const ch of CHAPTERS) {
      for (const s of ch.skills) {
        expect(seen.has(s), `${s} appears twice`).toBe(false);
        seen.add(s);
      }
    }
  });

  it('references only real prerequisite chapters', () => {
    for (const ch of CHAPTERS) {
      for (const p of ch.prerequisites) expect(CHAPTER_BY_ID[p], `${ch.id} → ${p}`).toBeDefined();
    }
  });

  it('has no prerequisite cycles', () => {
    const visit = (id: string, seen: Set<string>): void => {
      if (seen.has(id)) throw new Error(`cycle at ${id}`);
      seen.add(id);
      for (const p of CHAPTER_BY_ID[id]?.prerequisites ?? []) visit(p, new Set(seen));
    };
    for (const ch of CHAPTERS) expect(() => visit(ch.id, new Set())).not.toThrow();
  });

  it('never requires a chapter introduced later than itself', () => {
    const order = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
    for (const ch of CHAPTERS) {
      for (const p of ch.prerequisites) {
        expect(order.indexOf(CHAPTER_BY_ID[p].introducedIn),
          `${ch.id} requires ${p} from a later class`)
          .toBeLessThanOrEqual(order.indexOf(ch.introducedIn));
      }
    }
  });

  it('is titled in both languages, following the semi-Hindi policy', () => {
    for (const ch of CHAPTERS) {
      expect(ch.title.en.length).toBeGreaterThan(2);
      expect(ch.title.hi.length).toBeGreaterThan(2);
      expect(hasDevanagariDigits(ch.title.hi), ch.id).toBe(false);
    }
  });
});

describe('unlocking is by mastery, never by XP', () => {
  it('locks a chapter whose prerequisites are not secure', () => {
    const weak = all(0.3);
    const carrying = CHAPTER_BY_ID['carrying'];
    expect(chapterStatus(carrying, weak, '4th')).toBe('locked');
  });

  it('unlocks once prerequisites reach the threshold', () => {
    const m = all(0);
    for (const s of [...CHAPTER_BY_ID['first-sums'].skills, ...CHAPTER_BY_ID['place-value'].skills]) {
      m[s] = CHAPTER_UNLOCK_MASTERY + 0.01;
    }
    expect(chapterStatus(CHAPTER_BY_ID['carrying'], m, '4th')).toBe('available');
  });

  it('reports complete only when EVERY skill is secure', () => {
    const m = all(CHAPTER_COMPLETE_MASTERY + 0.01);
    expect(chapterStatus(CHAPTER_BY_ID['counting'], m, '4th')).toBe('complete');

    // One weak skill is enough to keep it open — a chapter is not "done"
    // because most of it is done.
    m[CHAPTER_BY_ID['counting'].skills[0]] = 0.5;
    expect(chapterStatus(CHAPTER_BY_ID['counting'], m, '4th')).toBe('inProgress');
  });

  it('does not lock earlier material to an older learner', () => {
    // A Class 3 child may still be working on Class 1 skills; locking them
    // would strand exactly the learner who most needs them.
    expect(chapterStatus(CHAPTER_BY_ID['counting'], all(0), '6th')).not.toBe('locked');
  });

  it('locks material from a later class', () => {
    expect(chapterStatus(CHAPTER_BY_ID['integers-algebra'], all(0.99), '3rd')).toBe('locked');
  });
});

describe('review chapters are generated from decay', () => {
  it('appears only for skills that were once mastered and have slipped', () => {
    const m = all(0.9);
    const ever: Record<string, boolean> = {};
    const target = CHAPTER_BY_ID['tables'].skills[0];
    m[target] = 0.4;
    ever[target] = true;

    const due = dueReviewChapters(m, ever, '4th');
    expect(due.length).toBe(1);
    expect(due[0].skills).toEqual([target]);
    expect(due[0].kind).toBe('review');
  });

  it('does not surface a skill that was never secure in the first place', () => {
    // That is not revision, it is unfinished learning — and it belongs to the
    // core chapter, not a review one.
    const m = all(0.3);
    expect(dueReviewChapters(m, {}, '4th')).toEqual([]);
  });
});

describe('availability ordering', () => {
  it('puts the most-progressed chapter first, so a learner resumes rather than restarts', () => {
    const m = all(0);
    for (const s of CHAPTER_BY_ID['counting'].skills) m[s] = 0.6;
    const av = availableChapters(m, '2nd');
    expect(av[0].id).toBe('counting');
  });

  it('reports progress as mean mastery across the chapter', () => {
    const m = all(0.5);
    expect(chapterProgress(CHAPTER_BY_ID['counting'], m)).toBeCloseTo(0.5, 5);
  });
});
