import { describe, it, expect } from 'vitest';
import { buildQuestion, installRng, srand, table, INTERACTIVE_VARIANTS } from '../harness';
import { categoryForSkill } from '../../learning/scheduler';
import { resolveSkill, SKILLS } from '../../learning/skills';
import { getAvailableCategories } from '../../generators';
import type { SchoolClass, Difficulty, Category } from '../../generators/types';
import { toEntry, pickInteraction } from '../../generators/interactions';
import { generateQuestion } from '../../generators';

installRng();
const CLASSES: SchoolClass[] = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];

describe('recognition ceiling ↔ interaction ladder handshake', () => {
  it('C1 · at mastery 0.80 exactly, can each skill produce recall evidence?', () => {
    srand(31337);
    // The deadlock: mastery.ts caps value at 0.80 without recall evidence.
    // pickInteraction only returns "entry" when mastery >= 0.80.
    // toEntry only converts when the answer is a finite NUMBER.
    const rows: any[] = [];
    const seen = new Set<string>();
    for (const cls of CLASSES) {
      for (const cat of getAvailableCategories(cls)) {
        if (cat === 'tables' || cat === 'mixed') continue;
        for (const d of DIFFS) {
          const skill = resolveSkill(cls, cat as Category, d);
          if (seen.has(skill)) continue;
          seen.add(skill);
          let recall = 0, total = 0, numericAnswers = 0;
          for (let i = 0; i < 3000; i++) {
            // Mastery pinned at exactly the ceiling — the state a learner is
            // trapped in.
            const q = buildQuestion(cls, d, cat as Category, skill, 0.80);
            if (!q) continue;
            total++;
            const k = q.interaction?.kind ?? 'choice';
            if (k !== 'choice') recall++;
            if (typeof q.answer === 'number' && Number.isFinite(q.answer)) numericAnswers++;
          }
          rows.push({
            skill, cls, cat, diff: d,
            hasVariant: INTERACTIVE_VARIANTS[skill] ? 'yes' : '',
            numericPct: `${(numericAnswers / total * 100).toFixed(0)}%`,
            recallPct: `${(recall / total * 100).toFixed(1)}%`,
            trapped: recall === 0 ? 'DEADLOCK' : '',
          });
        }
      }
    }
    rows.sort((a, b) => parseFloat(a.recallPct) - parseFloat(b.recallPct));
    console.log('\n===== C1 · RECALL EVIDENCE AT MASTERY = 0.80 (real app pipeline) =====');
    console.log(table(rows));
    const trapped = rows.filter(r => r.trapped);
    console.log(`\nDEADLOCKED SKILLS: ${trapped.length} / ${rows.length}`);
    console.log(trapped.map(r => r.skill).join(', '));
    expect(rows.length).toBeGreaterThan(0);
  }, 900_000);

  it('C2 · which skills have non-numeric answers (toEntry refuses)?', () => {
    srand(5);
    const rows: any[] = [];
    const seen = new Set<string>();
    for (const cls of CLASSES) {
      for (const cat of getAvailableCategories(cls)) {
        if (cat === 'tables' || cat === 'mixed') continue;
        for (const d of DIFFS) {
          const skill = resolveSkill(cls, cat as Category, d);
          if (seen.has(skill)) continue;
          seen.add(skill);
          let numeric = 0, n = 0;
          const examples: string[] = [];
          for (let i = 0; i < 1500; i++) {
            let q; try { q = generateQuestion(cls, d, cat as Category); } catch { continue; }
            n++;
            if (typeof q.answer === 'number' && Number.isFinite(q.answer)) numeric++;
            else if (examples.length < 2) examples.push(String(q.answer));
          }
          if (numeric < n) rows.push({ skill, cat, diff: d,
            numericPct: `${(numeric / n * 100).toFixed(0)}%`,
            nonNumericExamples: examples.join(' | ').slice(0, 40) });
        }
      }
    }
    console.log('\n===== C2 · SKILLS WHERE toEntry() SILENTLY REFUSES (non-numeric answers) =====');
    console.log(table(rows));
  }, 900_000);
});
