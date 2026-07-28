// ─── docs/27 P3-10 · systematic surface-feature variation ────────────────────
//
// Variation theory's claim: hold the STRUCTURE constant and vary the SURFACE,
// and what is learned is the relationship rather than the wording. Do the
// opposite — let a surface feature track the structure — and a child can
// succeed without reading, then fail the moment the noun changes.
//
// MEASURED BEFORE THE FIX, over 9,600 word problems:
//
//     mangoes    -> subtraction     100%
//     laddoos    -> multiplication  100%
//     chocolates -> division        100%
//     flowers    -> addition        100%
//
// Perfect confounding. Every template hardcoded its own noun, so the noun WAS
// the operation. A child optimising for marks — which is what children do —
// would learn the mapping, and the app would score them as understanding word
// problems.
//
// This guard measures the association directly, using normalised mutual
// information between the noun and the operation. It is deliberately not a
// per-noun threshold: the defect is a statistical dependence, and measuring it
// as one means the guard cannot be satisfied by shuffling a single template.

import { describe, it, expect } from 'vitest';
import { genWordProblemsI18n } from '../word-problems-i18n';
import type { SchoolClass, Difficulty } from '../types';
import { ITEMS, ITEM_KEYS, item, itemOne } from '../../i18n/strings';
import type { Lang } from '../../i18n/strings';

const CLASSES: SchoolClass[] = ['3rd', '4th', '5th', '6th'];
const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];

// The structure is read from the question, not inferred from its wording. The
// first version of this guard used a keyword regex and measured every noun as
// ~75% "multiplication" — the classifier collapsing equalGroups, rate,
// unitPrice and percentOf onto one keyword. It would have sent someone to fix
// content that was already correct.

/**
 * Normalised mutual information between noun and operation, in [0, 1].
 *
 * 0 means the noun tells you nothing about the operation — the goal.
 * 1 means the noun determines it exactly — the defect as measured.
 */
function nmi(pairs: [string, string][]): number {
  const n = pairs.length;
  const cx: Record<string, number> = {}, cy: Record<string, number> = {}, cxy: Record<string, number> = {};
  for (const [x, y] of pairs) {
    cx[x] = (cx[x] ?? 0) + 1;
    cy[y] = (cy[y] ?? 0) + 1;
    cxy[`${x}|${y}`] = (cxy[`${x}|${y}`] ?? 0) + 1;
  }
  const H = (c: Record<string, number>) =>
    -Object.values(c).reduce((a, v) => a + (v / n) * Math.log2(v / n), 0);
  let mi = 0;
  for (const [k, v] of Object.entries(cxy)) {
    const [x, y] = k.split('|');
    mi += (v / n) * Math.log2((v / n) / ((cx[x] / n) * (cy[y] / n)));
  }
  const hx = H(cx), hy = H(cy);
  const denom = Math.min(hx, hy);
  return denom <= 0 ? 0 : mi / denom;
}

describe('P3-10 · surface features vary independently of structure', () => {
  it('no noun predicts the operation', () => {
    // Sampled in English so the operation can be read off the wording; the
    // noun-drawing code is shared, so the property holds in both languages
    // and the Hindi case is asserted separately below.
    const pairs: [string, string][] = [];
    for (const cls of CLASSES) for (const d of DIFFS) {
      for (let i = 0; i < 600; i++) {
        const q = genWordProblemsI18n(cls, d, 'en');
        const noun = ITEM_KEYS.find(k => q.questionText.includes(item(k, 'en'))
          || new RegExp(`\\b${itemOne(k, 'en')}\\b`).test(q.questionText));
        if (noun && q.structure) pairs.push([noun, q.structure]);
      }
    }
    expect(pairs.length).toBeGreaterThan(2000);

    const score = nmi(pairs);
    // Per-noun report, so a failure says WHICH noun leaked rather than only
    // that something did.
    const byNoun: Record<string, Record<string, number>> = {};
    for (const [x, y] of pairs) {
      byNoun[x] = byNoun[x] ?? {};
      byNoun[x][y] = (byNoun[x][y] ?? 0) + 1;
    }
    // Compared against the MARGINAL distribution of structures, not against
    // uniform. Structures are not equally common — `equalGroups` appears in
    // three templates and `percentOf` in one — so a noun sitting at 64% on
    // `equalGroups` is matching the base rate, not leaking. An earlier draft
    // asserted raw dominance and failed on exactly that, which would have sent
    // someone to "fix" correctly varied content.
    const marginal: Record<string, number> = {};
    for (const [, y] of pairs) marginal[y] = (marginal[y] ?? 0) + 1;
    for (const k of Object.keys(marginal)) marginal[k] /= pairs.length;

    const worst = Object.entries(byNoun).map(([k, v]) => {
      const tot = Object.values(v).reduce((a, b) => a + b, 0);
      const top = Math.max(...Object.values(v));
      // Total variation distance from the marginal: 0 means this noun's
      // structures are distributed exactly like every other noun's.
      const tvd = 0.5 * Object.keys(marginal).reduce(
        (a, y) => a + Math.abs((v[y] ?? 0) / tot - marginal[y]), 0);
      return { noun: k, dominance: top / tot, tvd };
    }).sort((a, b) => b.tvd - a.tvd);
    console.log(`P3-10 · NMI(noun; structure) = ${score.toFixed(4)} over ${pairs.length} problems · ` +
      `worst noun ${worst[0].noun} TVD ${worst[0].tvd.toFixed(3)} ` +
      `(${(worst[0].dominance * 100).toFixed(0)}% on its commonest structure, marginal ` +
      `${(Math.max(...Object.values(marginal)) * 100).toFixed(0)}%)`);

    // Measured before the fix: 1.0000 (perfect). After: ~0.00.
    expect(score, `noun predicts structure, NMI ${score.toFixed(4)}`).toBeLessThan(0.15);
    // No noun's structure mix may differ much from the overall mix.
    expect(worst[0].tvd, `"${worst[0].noun}" has a skewed structure mix, TVD ${worst[0].tvd.toFixed(3)}`)
      .toBeLessThan(0.12);
    // Every noun must actually be seen with several structures.
    for (const [n, v] of Object.entries(byNoun)) {
      expect(Object.keys(v).length, `"${n}" only ever appears with ${Object.keys(v).join(', ')}`)
        .toBeGreaterThanOrEqual(4);
    }
  }, 120_000);

  it('every noun reaches every class', () => {
    // A noun locked to one class is the same defect in a different dimension:
    // the child learns "crates means Class 5 multiplication".
    for (const cls of CLASSES) {
      const seen = new Set<string>();
      for (const d of DIFFS) for (let i = 0; i < 800; i++) {
        const q = genWordProblemsI18n(cls, d, 'en');
        for (const k of ITEM_KEYS) {
          if (q.questionText.includes(item(k, 'en'))
            || new RegExp(`\\b${itemOne(k, 'en')}\\b`).test(q.questionText)) seen.add(k);
        }
      }
      expect(seen.size, `class ${cls} only ever uses ${[...seen].join(', ')}`).toBe(ITEM_KEYS.length);
    }
  }, 120_000);

  it('every item has a real singular in both languages', () => {
    // The old code built the singular by chopping two characters off the Hindi
    // plural (`item('pencils','hi').slice(0, -2)`), which happened to work for
    // the one hardcoded noun it was written against. Now that the noun varies,
    // a wrong singular would ship as broken Hindi in a live question.
    for (const k of ITEM_KEYS) {
      const e = ITEMS[k];
      expect(e.oneEn.length, k).toBeGreaterThan(0);
      expect(e.oneHi.length, k).toBeGreaterThan(0);
      // English plural and singular must genuinely differ, which is the case
      // that the old chop-two-characters trick got wrong in a live sentence.
      expect(e.oneEn, `${k}: English singular equals the plural`).not.toBe(e.en);
      // Deliberately NOT asserting that the Hindi singular differs from a
      // truncated plural: पेंसिलें → पेंसिल is BOTH the correct singular and
      // what chopping two characters happens to produce. An earlier draft
      // asserted that and failed on a correct entry. Hindi plural formation is
      // not mechanical, so the table is the source of truth and the type
      // system requires every entry to declare it.
    }
  });

  it('produces no malformed sentence in either language', () => {
    for (const lang of ['en', 'hi'] as Lang[]) {
      for (const cls of CLASSES) for (const d of DIFFS) {
        for (let i = 0; i < 300; i++) {
          const q = genWordProblemsI18n(cls, d, lang);
          expect(q.questionText).not.toContain('undefined');
          expect(q.questionText).not.toContain('NaN');
          expect(q.questionText.trim().length).toBeGreaterThan(10);
          expect(Number.isFinite(Number(q.answer)), q.questionText).toBe(true);
          // Semi-Hindi policy: numerals stay Western Arabic.
          expect(/[\u0966-\u096F]/.test(q.questionText), q.questionText).toBe(false);
        }
      }
    }
  }, 120_000);
});
