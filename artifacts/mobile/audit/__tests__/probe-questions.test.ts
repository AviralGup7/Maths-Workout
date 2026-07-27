import { describe, it } from 'vitest';
import { generateQuestion, getAvailableCategories, CATEGORY_META } from '../../generators';
import type { Category, SchoolClass, Difficulty } from '../../generators/types';
import { table, installRng, srand } from '../harness';
import { resolveSkill, SKILLS } from '../../learning/skills';

installRng();

const CLASSES: SchoolClass[] = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];

describe('question distribution at scale', () => {
  it('Q1 · interaction-kind mix per class (the recognition-ceiling driver)', () => {
    srand(4242);
    const rows: any[] = [];
    for (const cls of CLASSES) {
      const cats = getAvailableCategories(cls).filter(c => c !== 'tables');
      const tally: Record<string, number> = {};
      let n = 0;
      for (const cat of cats) for (const d of DIFFS) for (let i = 0; i < 2000; i++) {
        let q; try { q = generateQuestion(cls, d, cat as Category); } catch { continue; }
        const k = q.interaction?.kind ?? 'choice';
        tally[k] = (tally[k] ?? 0) + 1; n++;
      }
      rows.push({ cls, sampled: n,
        ...Object.fromEntries(Object.entries(tally).map(([k, v]) => [k, `${(v / n * 100).toFixed(1)}%`])),
        recallBearing: `${((n - (tally.choice ?? 0)) / n * 100).toFixed(1)}%` });
    }
    const cols = new Set<string>(); rows.forEach(r => Object.keys(r).forEach(k => cols.add(k)));
    console.log('\n===== Q1 · INTERACTION MIX (≈36k–120k questions per class) =====');
    console.log(table(rows.map(r => Object.fromEntries([...cols].map(c => [c, r[c] ?? '0%'])))));
  }, 900_000);

  it('Q2 · per-SKILL recall-bearing availability', () => {
    srand(99);
    // For each skill reachable by the scheduler, can it EVER produce a
    // non-choice question? If not, mastery is permanently capped at 0.80.
    const rows: any[] = [];
    const seen = new Set<string>();
    for (const cls of CLASSES) {
      for (const cat of getAvailableCategories(cls)) {
        if (cat === 'tables' || cat === 'mixed') continue;
        for (const d of DIFFS) {
          const skill = resolveSkill(cls, cat as Category, d);
          const key = `${skill}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const tally: Record<string, number> = {};
          for (let i = 0; i < 4000; i++) {
            let q; try { q = generateQuestion(cls, d, cat as Category); } catch { continue; }
            const k = q.interaction?.kind ?? 'choice';
            tally[k] = (tally[k] ?? 0) + 1;
          }
          const total = Object.values(tally).reduce((a, b) => a + b, 0);
          const recall = total - (tally.choice ?? 0);
          rows.push({ skill, viaClass: cls, cat, diff: d,
            recallPct: `${(recall / total * 100).toFixed(1)}%`,
            capped: recall === 0 ? 'YES — HARD CAP 0.80' : '' });
        }
      }
    }
    rows.sort((a, b) => parseFloat(a.recallPct) - parseFloat(b.recallPct));
    console.log('\n===== Q2 · RECALL-BEARING QUESTION AVAILABILITY PER SKILL =====');
    console.log(table(rows));
    const capped = rows.filter(r => r.capped);
    console.log(`\nSKILLS THAT CAN NEVER EXCEED RECOGNITION_CEILING (0.80): ${capped.length} / ${rows.length}`);
  }, 900_000);

  it('Q3 · repetition & content exhaustion (1M questions)', () => {
    srand(7);
    const rows: any[] = [];
    for (const cls of ['1st', '4th'] as SchoolClass[]) {
      for (const cat of getAvailableCategories(cls)) {
        if (cat === 'tables' || cat === 'mixed') continue;
        for (const d of DIFFS) {
          const seen = new Map<string, number>();
          const N = 20000;
          for (let i = 0; i < N; i++) {
            let q; try { q = generateQuestion(cls, d, cat as Category); } catch { continue; }
            seen.set(q.questionText, (seen.get(q.questionText) ?? 0) + 1);
          }
          const counts = [...seen.values()].sort((a, b) => b - a);
          const top = [...seen.entries()].sort((a, b) => b[1] - a[1])[0];
          rows.push({ cls, cat, diff: d, unique: seen.size,
            uniqPer1k: +(seen.size / N * 1000).toFixed(1),
            topShare: `${(counts[0] / N * 100).toFixed(2)}%`,
            // expected repeats within a 60-question window (the repetitionDecay window)
            dupIn60: +(1 - Math.exp(-(60 * 59 / 2) / Math.max(1, seen.size))).toFixed(3),
            example: String(top[0]).slice(0, 34) });
        }
      }
    }
    rows.sort((a, b) => a.unique - b.unique);
    console.log('\n===== Q3 · UNIQUE QUESTIONS PER 20,000 GENERATED =====');
    console.log(table(rows));
  }, 1_200_000);
});
