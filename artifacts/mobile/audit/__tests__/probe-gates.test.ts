import { describe, it } from 'vitest';
import { resolveSkill, SKILLS } from '../../learning/skills';
import { getAvailableCategories } from '../../generators';
import { CHAPTERS, CHAPTER_BY_ID, chapterStatus } from '../../curriculum/chapters';
import type { SchoolClass, Category, Difficulty } from '../../generators/types';
import { table, runLearner, srand, installRng } from '../harness';

installRng();
const CLASSES: SchoolClass[] = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];

describe('reachability and gating', () => {
  it('G1 · which skills can the menu/scheduler ever resolve to, per class?', () => {
    const reach: Record<string, Set<string>> = {};
    for (const cls of CLASSES) {
      const set = new Set<string>();
      for (const cat of getAvailableCategories(cls)) {
        if (cat === 'mixed') continue;
        for (const d of DIFFS) set.add(resolveSkill(cls, cat as Category, d));
      }
      reach[cls] = set;
    }
    const all = Object.keys(SKILLS);
    const anywhere = new Set<string>(); Object.values(reach).forEach(s => s.forEach(x => anywhere.add(x)));
    console.log('\n===== G1 · SKILL REACHABILITY VIA resolveSkill =====');
    console.log(table(all.map(s => ({
      skill: s, introducedIn: SKILLS[s].introducedIn,
      reachableIn: CLASSES.filter(c => reach[c].has(s)).join(',') || '— NEVER —',
    }))));
    const never = all.filter(s => !anywhere.has(s));
    console.log(`\nSKILLS UNREACHABLE FROM ANY CLASS MENU: ${never.length}`);
    console.log(never.join(', '));
  });

  it('G2 · chapter gates blocked by unreachable / unscheduled skills', () => {
    // A chapter prerequisite averages `mastery[s] ?? 0`, so a single skill the
    // learner can never be served pins the mean below CHAPTER_UNLOCK_MASTERY
    // and locks every descendant permanently.
    const anywhere = new Set<string>();
    for (const cls of CLASSES) for (const cat of getAvailableCategories(cls)) {
      if (cat === 'mixed') continue;
      for (const d of DIFFS) anywhere.add(resolveSkill(cls, cat as Category, d));
    }
    const rows = CHAPTERS.map(c => {
      const unreachable = c.skills.filter(s => !anywhere.has(s));
      // Max attainable mean for the chapter if every reachable skill hits 1.0
      const maxMean = (c.skills.length - unreachable.length) / c.skills.length;
      return { chapter: c.id, skills: c.skills.length,
        unreachable: unreachable.join(',') || '',
        maxAttainableMean: +maxMean.toFixed(2),
        canEverUnlockDescendants: maxMean >= 0.70 ? 'yes' : 'NO — PERMANENT LOCK',
        canEverComplete: unreachable.length === 0 ? 'yes' : 'NO' };
    });
    console.log('\n===== G2 · CHAPTER ATTAINABILITY =====');
    console.log(table(rows));
    // Now cascade: which chapters are downstream of a permanently-locked gate?
    const bad = new Set(rows.filter(r => r.canEverUnlockDescendants !== 'yes').map(r => r.chapter));
    const blocked: string[] = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of CHAPTERS) {
        if (bad.has(c.id)) continue;
        if (c.prerequisites.some(p => bad.has(p))) { bad.add(c.id); blocked.push(c.id); changed = true; }
      }
    }
    console.log(`\nCHAPTERS PERMANENTLY UNREACHABLE BY CASCADE: ${blocked.join(', ') || 'none'}`);
  });

  it('G3 · perfect learner, 2 years — does the map ever open?', () => {
    srand(2024);
    const r = runLearner({ name: 'perfect-2y', learnRate: 0.9, attendance: 1, retentionHalfLife: 120,
      guessRate: 0, speed: 1, sessionLength: 20, cls: '6th' }, 730);
    const m: Record<string, number> = {};
    for (const [k, v] of Object.entries(r.estimates)) m[k] = v.value;
    const rows = CHAPTERS.map(c => ({ chapter: c.id, status: chapterStatus(c, m, '6th'),
      mean: +(c.skills.reduce((s, k) => s + (m[k] ?? 0), 0) / c.skills.length).toFixed(2),
      unseen: c.skills.filter(k => !(k in m)).join(',') }));
    console.log('\n===== G3 · PERFECT LEARNER, CLASS 6, 730 DAYS, 100% ATTENDANCE =====');
    console.log(`answered ${r.totalAnswered}, skills touched ${Object.keys(r.estimates).length}/45`);
    console.log(table(rows));
    console.log(`\ncomplete: ${rows.filter(x => x.status === 'complete').length} / ${CHAPTERS.length}`);
    console.log(`locked:   ${rows.filter(x => x.status === 'locked').length}`);
  }, 900_000);
});
