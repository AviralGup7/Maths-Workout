import { describe, it, expect } from 'vitest';
import { GOAL_CHOICES, DAILY_GOAL, normaliseGoal } from '../goals';
import { CHAPTERS, CHAPTER_COMPLETE_MASTERY, chapterStatus } from '../../curriculum/chapters';
import { SKILLS } from '../skills';

describe('child-selectable practice goal (docs/28 item 52)', () => {
  it('offers only achievable targets', () => {
    // A goal that can be missed by being busy teaches that practice is a debt.
    // Every option must be reachable in a single ordinary sitting.
    for (const g of GOAL_CHOICES) {
      expect(g).toBeGreaterThanOrEqual(5);
      expect(g).toBeLessThanOrEqual(20);
    }
  });

  it('keeps the default among the choices', () => {
    // A default that is not selectable would leave a child unable to return to
    // it after experimenting.
    expect(GOAL_CHOICES).toContain(DAILY_GOAL as never);
  });

  it('rejects a corrupt stored value rather than trusting it', () => {
    expect(normaliseGoal('999')).toBe(DAILY_GOAL);
    expect(normaliseGoal(null)).toBe(DAILY_GOAL);
    expect(normaliseGoal('abc')).toBe(DAILY_GOAL);
    expect(normaliseGoal('20')).toBe(20);
  });

  it('is ordered and free of duplicates', () => {
    const sorted = [...GOAL_CHOICES].sort((a, b) => a - b);
    expect([...GOAL_CHOICES]).toEqual(sorted);
    expect(new Set(GOAL_CHOICES).size).toBe(GOAL_CHOICES.length);
  });
});

describe('chapter certificate (docs/28 item 51)', () => {
  it('certifies understanding, not attendance', () => {
    // The certificate says a child "knows" the chapter. The product is only
    // entitled to that claim because completion requires EVERY skill in the
    // chapter to be secure — not a lucky session, not a participation count.
    expect(CHAPTER_COMPLETE_MASTERY).toBeGreaterThanOrEqual(0.85);
  });

  it('is not awarded while any skill in the chapter is weak', () => {
    const ch = CHAPTERS[0];
    // Every skill secure except one, which sits just under the bar.
    const nearly: Record<string, number> = {};
    for (const s of ch.skills) nearly[s] = 0.95;
    nearly[ch.skills[0]] = CHAPTER_COMPLETE_MASTERY - 0.05;
    expect(chapterStatus(ch, nearly, ch.introducedIn)).not.toBe('complete');

    const all: Record<string, number> = {};
    for (const s of ch.skills) all[s] = 0.95;
    expect(chapterStatus(ch, all, ch.introducedIn)).toBe('complete');
  });

  it('every chapter can name the skills it certifies', () => {
    // The certificate lists them; an unresolvable id would print blank and
    // make the artefact meaningless.
    for (const ch of CHAPTERS) {
      expect(ch.skills.length, `${ch.id} has no skills`).toBeGreaterThan(0);
      for (const id of ch.skills) {
        expect(SKILLS[id], `${ch.id} references unknown skill ${id}`).toBeDefined();
      }
    }
  });
});
