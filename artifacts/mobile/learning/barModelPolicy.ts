// ─── Choosing a bar model for a word problem ─────────────────────────────────
// docs/27 P3-05.
//
// The bar model only helps if it shows the RIGHT structure. A part-whole
// diagram drawn over a comparison problem is worse than no diagram: it asserts
// a relationship that is not there, and the child either follows it to a wrong
// operation or learns to ignore diagrams.
//
// So this classifies by the SENTENCE, not by the arithmetic. "12 − 5" is the
// answer to both "gives away 5" (part-whole, one part removed) and "how many
// more boys than girls" (comparison), and those are different pictures.
//
// Bilingual by necessity — the same reason `classifyQuestion` is. A
// Hindi-medium child would otherwise get no diagram at all, which is the group
// most likely to need one.

export type BarStructure = 'partWhole' | 'difference' | 'equalGroups' | 'sharing';

export interface BarSpec {
  structure: BarStructure;
  a: number;
  b: number;
}

/**
 * Numbers in the order they appear.
 *
 * Decimals and negatives are excluded deliberately: a tape diagram of 2.5
 * boxes is not a model, and word problems at this level are whole-number.
 */
function numbers(text: string): number[] {
  return (text.match(/\d+/g) ?? []).map(Number).filter(n => n > 0 && n <= 10000);
}

/**
 * Which structure this word problem has, or null when it has none we can draw.
 *
 * Returning null is the common and correct case for multi-step problems
 * (speed × time, work rate). A bar model of those is a lie about their
 * structure, and the honest response is to draw nothing.
 */
export function barModelFor(text: string): BarSpec | null {
  const t = text.toLowerCase();
  const n = numbers(text);
  if (n.length < 2) return null;

  // ── Sharing: a known whole divided into equal parts ───────────────────────
  // Tested first because "shared equally among 6 children" also contains the
  // word "each", which the equal-groups matcher would otherwise claim.
  if (/shared equally|shared among|share.*equally|बराबर बाँट|बाँटी गईं|में बाँट/.test(t)) {
    return { structure: 'sharing', a: n[0], b: n[1] };
  }

  // ── Equal groups: n identical units ───────────────────────────────────────
  //
  // Measured against the real stream, the first pass caught 25% (en) / 38%
  // (hi) and the largest misses were all equal-groups phrased differently:
  // "Each crate holds N apples", "One pencil costs ₹N. What do N cost?". Those
  // ARE tape diagrams — n identical units — and were simply not matched.
  //
  // Note the operand order: "Each crate holds 6 apples, how many in 4 crates?"
  // states the UNIT first and the COUNT second, the reverse of "4 rows of 6".
  // Drawing 6 groups of 4 would be a different problem, so the two phrasings
  // are matched separately rather than folded together.
  if (/rows of|पंक्तियाँ|हर पंक्ति/.test(t)) {
    return { structure: 'equalGroups', a: n[0], b: n[1] };
  }
  if (/each (crate|box|bag|packet|shelf|tray) (holds|has|contains)|one .* costs|each collect|each contains|per week|per day|हर (डिब्बे|पेटी|थैले)|एक .* की कीमत|हर बच्चा|प्रत्येक/.test(t)) {
    // unit first, count second -> swap so `a` is always the number of groups
    return { structure: 'equalGroups', a: n[1], b: n[0] };
  }

  // ── Comparison: two quantities held against each other ────────────────────
  // "How many more" is the giveaway, and it is the structure children most
  // often mis-model as part-whole.
  if (/how many more|how much more|more than|longer than|कितने अधिक|कितना अधिक|से अधिक|से ज़्यादा/.test(t)) {
    return { structure: 'difference', a: n[0], b: n[1] };
  }

  // ── Part-whole: two parts joined, or one part removed ─────────────────────
  if (/altogether|in total|how many are left|gives away|left\?|कुल कितने|कितने बचे|दे देता|कुल मिलाकर/.test(t)) {
    return { structure: 'partWhole', a: n[0], b: n[1] };
  }

  // Savings ("saves ₹15 per week, how much in 4 weeks?") is already caught by
  // the unit-first matcher above via `per week`, with the same swap. A
  // separate rule for it measured as DEAD — coverage fell from 46% to 43%
  // because it shadowed nothing and displaced nothing. Removed rather than
  // kept as a rule that looks load-bearing and is not.
  //
  // Everything else gets NO diagram, and that is the correct answer rather
  // than a shortfall. Measured on the real stream, the remainder is:
  //
  //   speed × time      "a bus travels at 40 km/h, how far in 3 hours?"
  //   percentage        "20% of 150 students scored full marks"
  //   rate              "180 runs in 20 overs, what is the run rate?"
  //   change            "paid with ₹100 and spent ₹65"
  //
  // A tape diagram of speed asserts that distance is made of 40-unit blocks,
  // which is a real misconception (it is continuous, not discrete). A bar
  // model that misrepresents the structure is worse than none: the child
  // either follows it to the wrong operation or learns to ignore diagrams.
  // Change is arguably part-whole, but the numbers are money totals rather
  // than counts and the bar reads as a price comparison.
  return null;
}

/**
 * Should this learner see the diagram at all?
 *
 * Fades with mastery on the same principle as `visualPolicy`: a child who can
 * already parse the sentence does not need the picture, and leaving it up
 * teaches dependence on scaffolding rather than on reading.
 */
export const BAR_MODEL_HIDDEN_ABOVE = 0.75;

export function shouldShowBarModel(mastery: number): boolean {
  return mastery < BAR_MODEL_HIDDEN_ABOVE;
}
