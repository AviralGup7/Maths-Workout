import { describe, it, expect } from 'vitest';
import {
  pickOpenTask, skillsWithOpenTasks, OPEN_TASK_FLOOR, OPEN_TASK_RATE,
} from '../openTaskPolicy';
import { SKILLS } from '../skills';
import { STRUGGLING_THRESHOLD } from '../mastery';

describe('open task policy', () => {
  it('every eligible skill exists in the skill graph', () => {
    // A typo here would silently disable open tasks for that skill forever.
    for (const id of skillsWithOpenTasks()) expect(SKILLS[id]).toBeDefined();
    expect(skillsWithOpenTasks().length).toBeGreaterThan(15);
  });

  it('withholds open tasks from struggling learners', () => {
    // The format removes the answer AND the procedure. Handing it to a child
    // the scheduler already considers to be struggling is the failure mode.
    expect(OPEN_TASK_FLOOR).toBeGreaterThan(STRUGGLING_THRESHOLD);
    expect(pickOpenTask({
      skill: 'add.2digit.carry', mastery: 0.4, cls: '3rd', roll: 0, kindRoll: 0,
    })).toBeNull();
  });

  it('serves open tasks to secure learners', () => {
    expect(pickOpenTask({
      skill: 'add.2digit.carry', mastery: 0.9, cls: '3rd', roll: 0, kindRoll: 0,
    })).not.toBeNull();
  });

  it('honours the rate: a roll above it never yields a task', () => {
    expect(pickOpenTask({
      skill: 'add.2digit.carry', mastery: 0.9, cls: '3rd', roll: OPEN_TASK_RATE, kindRoll: 0,
    })).toBeNull();
    expect(OPEN_TASK_RATE).toBeLessThanOrEqual(0.25);
  });

  it('returns null for skills with no sensible open form', () => {
    // "Write a symmetry that makes 24" is not a question.
    for (const id of ['symmetry.basic', 'shapes.basic', 'time.basic', 'money.basic']) {
      expect(pickOpenTask({ skill: id, mastery: 0.95, cls: '5th', roll: 0, kindRoll: 0 })).toBeNull();
    }
  });

  it('never serves Open Middle below Class 3', () => {
    for (const cls of ['1st', '2nd'] as const) {
      for (let k = 0; k < 20; k++) {
        for (const skill of skillsWithOpenTasks()) {
          const got = pickOpenTask({ skill, mastery: 0.95, cls, roll: 0, kindRoll: k / 20 });
          expect(got).not.toBe('openMiddle');
        }
      }
    }
  });

  it('does serve Open Middle from Class 3', () => {
    const kinds = new Set<string>();
    for (let k = 0; k < 20; k++) {
      const got = pickOpenTask({
        skill: 'add.2digit.carry', mastery: 0.9, cls: '3rd', roll: 0, kindRoll: k / 20,
      });
      if (got) kinds.add(got);
    }
    expect(kinds.has('openMiddle')).toBe(true);
  });

  it('is a pure function of its arguments', () => {
    const args = { skill: 'mul.tables.full', mastery: 0.8, cls: '5th' as const, roll: 0.05, kindRoll: 0.5 };
    const a = pickOpenTask(args);
    for (let i = 0; i < 50; i++) expect(pickOpenTask(args)).toBe(a);
  });
});
