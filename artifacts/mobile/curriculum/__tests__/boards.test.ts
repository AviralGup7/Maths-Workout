// Verifies the board curriculum model against the researched syllabi.
// Sources and reasoning: docs/11-curriculum-research.md

import { describe, it, expect } from 'vitest';
import {
  BOARD_CONFIGS, TOPIC_AVAILABILITY, isTopicAvailable, categoriesFor,
  classNumber, scaleBound, DIFFICULTY_PROFILE, CLASS_LABELS, CLASS_THEME,
} from '../boards';
import type { Board } from '../boards';
import type { Category, SchoolClass } from '../../generators/types';
import { generateQuestion, getAvailableCategories } from '../../generators';
import { grade, expectedAnswer } from '../../generators/interactions';

const BOARDS: Board[] = ['cbse', 'icse', 'state'];
const CLASSES: SchoolClass[] = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

describe('board configuration', () => {
  it('every board has complete English and Hindi metadata', () => {
    for (const b of BOARD_CONFIGS) {
      expect(b.label.length).toBeGreaterThan(0);
      expect(b.labelHi.length).toBeGreaterThan(0);
      expect(b.fullName.length).toBeGreaterThan(0);
      expect(b.fullNameHi.length).toBeGreaterThan(0);
      expect(b.note.length).toBeGreaterThan(0);
      expect(b.noteHi.length).toBeGreaterThan(0);
    }
  });

  it('every category has an availability entry for every board', () => {
    for (const [cat, byBoard] of Object.entries(TOPIC_AVAILABILITY)) {
      for (const b of BOARDS) {
        expect(byBoard[b], `${cat} missing ${b}`).not.toBeUndefined();
      }
    }
  });

  it('availability values are valid class numbers or null', () => {
    for (const byBoard of Object.values(TOPIC_AVAILABILITY)) {
      for (const v of Object.values(byBoard)) {
        if (v !== null) {
          expect(v).toBeGreaterThanOrEqual(1);
          expect(v).toBeLessThanOrEqual(6);
        }
      }
    }
  });
});

describe('researched curriculum facts', () => {
  // docs/11 §3 — the clearest CBSE/ICSE divergence.
  it('ICSE teaches percentage a year before CBSE', () => {
    expect(TOPIC_AVAILABILITY.percentages.icse).toBe(5);
    expect(TOPIC_AVAILABILITY.percentages.cbse).toBe(6);
    expect(isTopicAvailable('icse', '5th', 'percentages')).toBe(true);
    expect(isTopicAvailable('cbse', '5th', 'percentages')).toBe(false);
  });

  it('ICSE teaches ratio a year before CBSE', () => {
    expect(isTopicAvailable('icse', '5th', 'ratio')).toBe(true);
    expect(isTopicAvailable('cbse', '5th', 'ratio')).toBe(false);
  });

  it('ICSE covers decimals a year before CBSE', () => {
    expect(TOPIC_AVAILABILITY.decimals.icse).toBe(4);
    expect(TOPIC_AVAILABILITY.decimals.cbse).toBe(5);
  });

  // docs/11 §2 — new NCERT Joyful Mathematics introduces multiplication in Class 1.
  it('CBSE Class 1 includes multiplication (new NCERT sequence)', () => {
    expect(isTopicAvailable('cbse', '1st', 'multiplication')).toBe(true);
  });

  it('state boards hold multiplication back to Class 2', () => {
    expect(isTopicAvailable('state', '1st', 'multiplication')).toBe(false);
    expect(isTopicAvailable('state', '2nd', 'multiplication')).toBe(true);
  });

  // Division is formally introduced in Class 3 across all boards.
  it('no board teaches division before Class 3', () => {
    for (const b of BOARDS) {
      expect(isTopicAvailable(b, '1st', 'division'), b).toBe(false);
      expect(isTopicAvailable(b, '2nd', 'division'), b).toBe(false);
      expect(isTopicAvailable(b, '3rd', 'division'), b).toBe(true);
    }
  });

  it('algebra and integers are not offered on state boards at this level', () => {
    expect(TOPIC_AVAILABILITY.algebra.state).toBeNull();
    expect(TOPIC_AVAILABILITY.integers.state).toBeNull();
    expect(isTopicAvailable('state', '6th', 'algebra')).toBe(false);
  });

  it('CBSE and ICSE both reach algebra and integers by Class 6', () => {
    for (const b of ['cbse', 'icse'] as Board[]) {
      expect(isTopicAvailable(b, '6th', 'algebra'), b).toBe(true);
      expect(isTopicAvailable(b, '6th', 'integers'), b).toBe(true);
    }
  });
});

describe('topic availability behaves monotonically', () => {
  it('a topic is available over one contiguous run of classes', () => {
    // Topics start at their syllabus year and, if they retire, never return.
    for (const b of BOARDS) {
      for (const cat of Object.keys(TOPIC_AVAILABILITY) as Category[]) {
        const run = CLASSES.map(cls => isTopicAvailable(b, cls, cat));
        const firstOn = run.indexOf(true);
        if (firstOn === -1) continue;
        const lastOn = run.lastIndexOf(true);
        for (let i = firstOn; i <= lastOn; i++) {
          expect(run[i], `${b}/${cat}/${CLASSES[i]} has a gap`).toBe(true);
        }
      }
    }
  });

  it('retires early topics once a learner has moved past them', () => {
    // A Class 6 learner should not be offered "counting" on the topic menu.
    expect(categoriesFor('cbse', '1st')).toContain('counting');
    expect(categoriesFor('cbse', '6th')).not.toContain('counting');
    expect(categoriesFor('cbse', '6th')).not.toContain('shapes');
  });

  it('keeps foundational arithmetic available at every class', () => {
    // Fluency practice stays valuable, and the scheduler needs these skills
    // reachable to repair prerequisite gaps.
    for (const b of BOARDS) {
      for (const cls of CLASSES) {
        const cats = categoriesFor(b, cls);
        expect(cats, `${b}/${cls}`).toContain('addition');
        expect(cats, `${b}/${cls}`).toContain('subtraction');
      }
    }
  });

  it('every class on every board has something to practise', () => {
    for (const b of BOARDS) {
      for (const cls of CLASSES) {
        expect(categoriesFor(b, cls).length, `${b}/${cls}`).toBeGreaterThan(0);
      }
    }
  });

  it('ICSE offers at least as many Class 5 topics as CBSE', () => {
    expect(categoriesFor('icse', '5th').length)
      .toBeGreaterThanOrEqual(categoriesFor('cbse', '5th').length);
  });
});

describe('difficulty scaling', () => {
  it('orders the boards ICSE > CBSE > state', () => {
    expect(DIFFICULTY_PROFILE.icse.operandScale)
      .toBeGreaterThan(DIFFICULTY_PROFILE.cbse.operandScale);
    expect(DIFFICULTY_PROFILE.cbse.operandScale)
      .toBeGreaterThan(DIFFICULTY_PROFILE.state.operandScale);
  });

  it('never collapses a bound below its floor', () => {
    for (const b of BOARDS) {
      for (const v of [1, 2, 5, 10, 100, 1000]) {
        expect(scaleBound(b, v)).toBeGreaterThanOrEqual(1);
        expect(scaleBound(b, v, 5)).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('scales in the expected direction', () => {
    expect(scaleBound('icse', 100)).toBeGreaterThan(scaleBound('cbse', 100));
    expect(scaleBound('state', 100)).toBeLessThan(scaleBound('cbse', 100));
  });
});

describe('generated questions respect the board', () => {
  it('produces valid questions for every board / class / category', () => {
    for (const b of BOARDS) {
      for (const cls of CLASSES) {
        for (const cat of categoriesFor(b, cls)) {
          if (cat === 'tables') continue;
          for (const diff of ['easy', 'medium', 'hard'] as const) {
            for (let i = 0; i < 25; i++) {
              const q = generateQuestion(cls, diff, cat, b);
              expect(grade(q, expectedAnswer(q)), `${b}/${cls}/${cat}/${diff}`).toBe(true);
              expect(q.questionText).not.toMatch(/NaN|undefined|Infinity/);
            }
          }
        }
      }
    }
  });

  it('mixed practice never draws a topic outside the board syllabus', () => {
    for (const b of BOARDS) {
      for (const cls of CLASSES) {
        if (!categoriesFor(b, cls).includes('mixed')) continue;
        const allowed = new Set(categoriesFor(b, cls));
        for (let i = 0; i < 300; i++) {
          const q = generateQuestion(cls, 'medium', 'mixed', b);
          if (q.resolvedCategory) {
            expect(allowed.has(q.resolvedCategory), `${b}/${cls} drew ${q.resolvedCategory}`).toBe(true);
          }
        }
      }
    }
  });

  it('getAvailableCategories matches the board model', () => {
    for (const b of BOARDS) {
      for (const cls of CLASSES) {
        expect(getAvailableCategories(cls, b)).toEqual(categoriesFor(b, cls));
      }
    }
  });

  it('defaults to CBSE when no board is supplied', () => {
    for (const cls of CLASSES) {
      expect(getAvailableCategories(cls)).toEqual(categoriesFor('cbse', cls));
    }
  });
});

describe('class labels and themes', () => {
  it('uses Indian class naming, not the Irish convention', () => {
    expect(CLASS_LABELS['1st'].en).toBe('Class 1');
    for (const cls of CLASSES) {
      expect(CLASS_LABELS[cls].en).not.toMatch(/\d(st|nd|rd|th) Class/);
      expect(CLASS_LABELS[cls].hi).toContain('कक्षा');
      expect(CLASS_LABELS[cls].age).toMatch(/^\d+–\d+$/);
    }
  });

  it('numbers classes 1 through 6', () => {
    CLASSES.forEach((cls, i) => expect(classNumber(cls)).toBe(i + 1));
  });

  it('every board and class has a bilingual theme', () => {
    for (const b of BOARDS) {
      for (const cls of CLASSES) {
        const th = CLASS_THEME[b][cls];
        expect(th.en.length).toBeGreaterThan(0);
        expect(th.hi.length).toBeGreaterThan(0);
      }
    }
  });
});
