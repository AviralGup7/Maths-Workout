// ─── Multi-representation and non-example items ──────────────────────────────
// docs/27 P3-07 and P3-09.
//
// Both address the same defect from opposite sides: the app taught every
// concept in exactly ONE representation and only ever through positive
// instances. A child could answer every fraction question in the bank and
// still not know that 3/4, 0.75, 75% and a point three quarters along a number
// line are four names for one quantity — because nothing in the app had ever
// put two of those names in the same sentence.
//
//   P3-07 · multi-representation — the SAME quantity, four ways.
//           Siegler's finding on fraction magnitude is not about fractions as
//           notation; it is about knowing WHERE a quantity sits. Translation
//           between representations is how that knowledge is both built and
//           observed. A child who can convert has a magnitude; a child who has
//           memorised a procedure cannot convert in the unfamiliar direction,
//           which is why these items rotate the direction rather than always
//           asking fraction → decimal.
//
//   P3-09 · non-examples — "which is NOT a rectangle, and why?"
//           A concept is defined as much by its boundary as by its centre.
//           Shown only rectangles, children build the prototype "a wide box"
//           and reject a square, or accept a parallelogram. The literature
//           (Tennyson & Park; the variation-theory tradition) is unusually
//           consistent: a definition is learned from contrasting cases, and
//           near-misses teach more than far-misses. So the distractors here
//           are deliberately CLOSE — a shape that fails on exactly one
//           attribute — rather than obviously unrelated.
//
// Both are set up so a wrong answer is diagnostic: the non-example items name
// the attribute that was missed, and the conversion items tag the classic
// "0.3 means three tenths but 0.30 means thirty" style errors.

import type { SchoolClass, Difficulty, Question } from './types';
import { pick, shuffleArr, makeStrChoices } from './helpers';
import { multiSelectQuestion } from './interactions';
import type { Lang } from '../i18n/strings';

function classNumber(cls: SchoolClass): number {
  return ['1st', '2nd', '3rd', '4th', '5th', '6th'].indexOf(cls) + 1;
}

// ─── P3-07 · Multi-representation ────────────────────────────────────────────

/**
 * The quantities that have a clean name in all four representations.
 *
 * Restricted to terminating decimals with an exact percentage, because the
 * whole point is that the four labels denote ONE number. 1/3 = 0.333… would
 * make the item about rounding, which is a different lesson and one that
 * actively undermines this one.
 */
interface Quantity {
  num: number;
  den: number;
  /** Exact decimal. */
  dec: number;
  /** Exact percentage. */
  pct: number;
}

const QUANTITIES: Quantity[] = [
  { num: 1, den: 2,  dec: 0.5,  pct: 50 },
  { num: 1, den: 4,  dec: 0.25, pct: 25 },
  { num: 3, den: 4,  dec: 0.75, pct: 75 },
  { num: 1, den: 5,  dec: 0.2,  pct: 20 },
  { num: 2, den: 5,  dec: 0.4,  pct: 40 },
  { num: 3, den: 5,  dec: 0.6,  pct: 60 },
  { num: 4, den: 5,  dec: 0.8,  pct: 80 },
  { num: 1, den: 10, dec: 0.1,  pct: 10 },
  { num: 3, den: 10, dec: 0.3,  pct: 30 },
  { num: 7, den: 10, dec: 0.7,  pct: 70 },
  { num: 9, den: 10, dec: 0.9,  pct: 90 },
  { num: 1, den: 20, dec: 0.05, pct: 5 },
  { num: 1, den: 100, dec: 0.01, pct: 1 },
  { num: 1, den: 1,  dec: 1,    pct: 100 },
];

/** The quantities a class has actually met. */
function quantitiesFor(cls: SchoolClass, diff: Difficulty): Quantity[] {
  const n = classNumber(cls);
  // Halves and quarters are Class 3; tenths and fifths Class 4; the rest 5+.
  const simple = QUANTITIES.filter(q => q.den === 2 || q.den === 4);
  if (n <= 3) return simple;
  if (n === 4) return QUANTITIES.filter(q => q.den <= 10);
  return diff === 'easy' ? QUANTITIES.filter(q => q.den <= 10) : QUANTITIES;
}

type Repr = 'fraction' | 'decimal' | 'percent';

/**
 * Parse any of "3/4", "0.75", "75%" to a number.
 *
 * Needed inside the generator, not only the guard: equivalence between
 * representations is precisely what this module is about, so "is this tile the
 * same number as the answer" cannot be answered by comparing strings.
 */
function valueOf(s: string): number {
  const t = s.trim();
  if (t.endsWith('%')) return Number(t.slice(0, -1)) / 100;
  if (t.includes('/')) {
    const [a, b] = t.split('/').map(Number);
    return a / b;
  }
  return Number(t);
}

function render(q: Quantity, r: Repr): string {
  // Units and numerals stay Latin under the semi-Hindi policy — a percentage
  // sign and a decimal point read identically in both scripts, and a child who
  // switched language by accident must still recognise the number.
  if (r === 'fraction') return `${q.num}/${q.den}`;
  if (r === 'decimal') return String(q.dec);
  return `${q.pct}%`;
}

const REPR_NAME: Record<Repr, { en: string; hi: string }> = {
  fraction: { en: 'a fraction', hi: 'भिन्न' },
  decimal:  { en: 'a decimal',  hi: 'दशमलव' },
  percent:  { en: 'a percentage', hi: 'प्रतिशत' },
};

/**
 * "3/4 written as a decimal is ___?" — with the direction rotated.
 *
 * Rotation is the mechanism, not a garnish. Fraction → percentage is a
 * procedure most children can execute without understanding; percentage →
 * fraction requires knowing what the quantity IS. Serving only the easy
 * direction would measure recall of a rule and report it as magnitude
 * knowledge.
 */
export function genRepresentationConvert(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  const hi = lang === 'hi';
  const q = pick(quantitiesFor(cls, diff));
  const reprs: Repr[] = ['fraction', 'decimal', 'percent'];
  const from = pick(reprs);
  const to = pick(reprs.filter(r => r !== from));

  const shown = render(q, from);
  const answer = render(q, to);

  const text = hi
    ? `${shown} को ${REPR_NAME[to].hi} में लिखें`
    : `Write ${shown} as ${REPR_NAME[to].en}`;

  // Distractors are the classic translation errors, not random strings.
  //   · reading the numerator as the whole quantity      (3/4 → 3, or 3%)
  //   · dropping or misplacing the decimal point          (0.75 → 0.075, 7.5)
  //   · treating the percentage as the decimal digits     (75% → 0.75 vs 75)
  const pool = new Set<string>();
  pool.add(answer);
  if (to === 'decimal') {
    pool.add(String(q.pct));                       // read the percentage as a decimal
    pool.add(String(Math.round(q.dec * 100) / 1000)); // point one place too far left
    pool.add(String(q.num));                       // numerator as the whole
    pool.add(String(Math.round(q.dec * 1000) / 100));
  } else if (to === 'percent') {
    pool.add(`${q.num}%`);                         // numerator as the percentage
    pool.add(`${q.den}%`);                         // denominator as the percentage
    pool.add(`${q.dec}%`);                         // decimal digits kept verbatim
    pool.add(`${q.pct / 10}%`);
  } else {
    pool.add(`${q.num}/${q.den * 10}`);
    pool.add(`${q.den}/${q.num}`);                 // inverted
    pool.add(`${q.pct}/100`);                      // correct but unsimplified — see below
    pool.add(`${q.num}/${q.den + 1}`);
  }
  // Filter by VALUE, not by string. `75/100` is a different string from `3/4`
  // and the same number, so a string-equality filter leaves a second correct
  // tile on the grid and marks a right answer wrong. Caught by the guard —
  // "Write 0.75 as a fraction" was offering both `75/100` and `3/4`.
  const target = valueOf(answer);
  for (const cand of [...pool]) {
    const v = valueOf(cand);
    if (Number.isFinite(v) && Number.isFinite(target) && Math.abs(v - target) < 1e-9) pool.delete(cand);
  }

  // Top up so the grid is always four tiles. The narrow quantities collapse
  // otherwise: for 1/1 the errors `num`, `den` and `pct/10` are `1%`, `1%` and
  // `10%`, which is two distinct distractors for three slots — measured, and
  // `makeStrChoices` renders a three-tile grid rather than failing.
  const filler = QUANTITIES.filter(o => Math.abs(o.dec - q.dec) > 1e-9);
  for (const o of shuffleArr(filler)) {
    if (pool.size >= 6) break;
    const cand = render(o, to);
    const v = valueOf(cand);
    if (Number.isFinite(v) && Math.abs(v - target) < 1e-9) continue;
    pool.add(cand);
  }

  const choices = makeStrChoices(answer, [answer, ...shuffleArr([...pool]).slice(0, 5)]);
  return {
    questionText: text,
    answer,
    choices,
    resolvedCategory: to === 'percent' || from === 'percent' ? 'percentages'
                    : to === 'decimal' || from === 'decimal' ? 'decimals' : 'fractions',
  };
}

/**
 * "Tap every card that shows the same amount as 1/2."
 *
 * The strongest form of the item, and the reason it is multi-select rather
 * than choice: equivalence is a property of a SET. Asked to pick one match a
 * child can succeed by elimination; asked to pick all of them they have to
 * evaluate every card, and a partial selection tells us exactly which
 * representation they cannot yet read.
 */
export function genRepresentationMatch(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  const hi = lang === 'hi';
  const pool = quantitiesFor(cls, diff);
  const q = pick(pool);
  const others = pool.filter(o => o.dec !== q.dec);

  const correct = shuffleArr(['fraction', 'decimal', 'percent'] as Repr[])
    .slice(0, 2)
    .map(r => render(q, r));

  // Near-miss distractors: the SAME representation types drawn from a
  // DIFFERENT quantity, so the child must compare magnitudes rather than spot
  // the odd notation out.
  const distractors: string[] = [];
  const seen = new Set(correct);
  for (const o of shuffleArr(others)) {
    for (const r of ['fraction', 'decimal', 'percent'] as Repr[]) {
      const s = render(o, r);
      if (!seen.has(s) && distractors.length < 4) { distractors.push(s); seen.add(s); }
    }
    if (distractors.length >= 4) break;
  }

  const anchor = render(q, 'fraction');
  const text = hi
    ? `हर वह कार्ड चुनें जो ${anchor} के बराबर है`
    : `Tap EVERY card equal to ${anchor}`;

  // The anchor itself is shown in the stem, so it must not also be a tile.
  const finalCorrect = correct.filter(c => c !== anchor);
  if (finalCorrect.length === 0) finalCorrect.push(render(q, 'decimal'));

  return multiSelectQuestion(text, finalCorrect, distractors, {
    resolvedCategory: 'fractions',
  });
}

// ─── P3-09 · Non-examples ────────────────────────────────────────────────────

/**
 * A concept, its definition, and the near-misses that fail it.
 *
 * `fails` names the ONE attribute each non-example lacks. That name is what
 * makes the item teach rather than merely test: the feedback can say "a
 * parallelogram has four sides, but its corners are not right angles",
 * which is the definition being rehearsed from its boundary.
 */
interface ConceptCase {
  concept: { en: string; hi: string };
  /** Members of the category. */
  examples: { en: string; hi: string }[];
  /** Near-misses, each with the attribute it fails on. */
  nonExamples: { en: string; hi: string; because: { en: string; hi: string } }[];
  minClass: number;
}

const CONCEPT_CASES: ConceptCase[] = [
  {
    concept: { en: 'a rectangle', hi: 'आयत' },
    examples: [
      { en: 'a square', hi: 'वर्ग' },
      { en: 'a long thin oblong', hi: 'लंबा पतला आयत' },
    ],
    nonExamples: [
      { en: 'a parallelogram', hi: 'समांतर चतुर्भुज', because: { en: 'its corners are not right angles', hi: 'इसके कोने समकोण नहीं हैं' } },
      { en: 'a trapezium', hi: 'समलंब', because: { en: 'only one pair of sides is parallel', hi: 'केवल एक जोड़ी भुजाएँ समांतर हैं' } },
      { en: 'a rhombus', hi: 'समचतुर्भुज', because: { en: 'its corners are not right angles', hi: 'इसके कोने समकोण नहीं हैं' } },
      { en: 'a triangle', hi: 'त्रिभुज', because: { en: 'it has three sides, not four', hi: 'इसमें तीन भुजाएँ हैं, चार नहीं' } },
    ],
    minClass: 3,
  },
  {
    concept: { en: 'a square', hi: 'वर्ग' },
    examples: [
      { en: 'a tile with four equal sides and square corners', hi: 'चार बराबर भुजाओं और समकोण वाली टाइल' },
    ],
    nonExamples: [
      { en: 'a rhombus', hi: 'समचतुर्भुज', because: { en: 'the sides are equal but the corners are not right angles', hi: 'भुजाएँ बराबर हैं पर कोने समकोण नहीं हैं' } },
      { en: 'an oblong', hi: 'आयत', because: { en: 'the corners are right angles but the sides are not all equal', hi: 'कोने समकोण हैं पर सभी भुजाएँ बराबर नहीं हैं' } },
      { en: 'a kite', hi: 'पतंग', because: { en: 'only two pairs of touching sides are equal', hi: 'केवल दो जोड़ी लगी हुई भुजाएँ बराबर हैं' } },
    ],
    minClass: 3,
  },
  {
    concept: { en: 'a prime number', hi: 'अभाज्य संख्या' },
    examples: [
      { en: '7', hi: '7' }, { en: '13', hi: '13' }, { en: '2', hi: '2' }, { en: '29', hi: '29' },
    ],
    nonExamples: [
      { en: '1', hi: '1', because: { en: 'it has only one factor, and a prime needs exactly two', hi: 'इसका केवल एक गुणनखंड है, अभाज्य को ठीक दो चाहिए' } },
      { en: '9', hi: '9', because: { en: '3 divides into it', hi: 'इसमें 3 का भाग जाता है' } },
      { en: '15', hi: '15', because: { en: '3 and 5 divide into it', hi: 'इसमें 3 और 5 का भाग जाता है' } },
      { en: '21', hi: '21', because: { en: '3 and 7 divide into it', hi: 'इसमें 3 और 7 का भाग जाता है' } },
    ],
    minClass: 5,
  },
  {
    concept: { en: 'a multiple of 3', hi: '3 का गुणज' },
    examples: [
      { en: '12', hi: '12' }, { en: '18', hi: '18' }, { en: '27', hi: '27' }, { en: '30', hi: '30' },
    ],
    nonExamples: [
      { en: '13', hi: '13', because: { en: 'its digits add to 4, not a multiple of 3', hi: 'इसके अंकों का योग 4 है, जो 3 का गुणज नहीं' } },
      { en: '20', hi: '20', because: { en: 'its digits add to 2, not a multiple of 3', hi: 'इसके अंकों का योग 2 है, जो 3 का गुणज नहीं' } },
      { en: '31', hi: '31', because: { en: 'its digits add to 4, not a multiple of 3', hi: 'इसके अंकों का योग 4 है, जो 3 का गुणज नहीं' } },
    ],
    minClass: 4,
  },
  {
    concept: { en: 'an equivalent fraction to 1/2', hi: '1/2 के बराबर भिन्न' },
    examples: [
      { en: '2/4', hi: '2/4' }, { en: '5/10', hi: '5/10' }, { en: '50/100', hi: '50/100' },
    ],
    nonExamples: [
      { en: '2/3', hi: '2/3', because: { en: 'the top is not half the bottom', hi: 'ऊपर की संख्या नीचे की आधी नहीं है' } },
      { en: '1/3', hi: '1/3', because: { en: 'three parts, not two, make the whole', hi: 'पूरा बनाने में तीन भाग लगते हैं, दो नहीं' } },
      { en: '3/5', hi: '3/5', because: { en: 'the top is more than half the bottom', hi: 'ऊपर की संख्या नीचे की आधी से अधिक है' } },
    ],
    minClass: 4,
  },
  {
    concept: { en: 'a right angle', hi: 'समकोण' },
    examples: [
      { en: 'the corner of a book', hi: 'किताब का कोना' },
      { en: '90°', hi: '90°' },
    ],
    nonExamples: [
      { en: '89°', hi: '89°', because: { en: 'it is close, but a right angle is exactly 90°', hi: 'यह पास है, पर समकोण ठीक 90° होता है' } },
      { en: '180°', hi: '180°', because: { en: 'that is a straight line, two right angles', hi: 'वह सीधी रेखा है, दो समकोण' } },
      { en: '45°', hi: '45°', because: { en: 'that is half a right angle', hi: 'वह समकोण का आधा है' } },
    ],
    minClass: 4,
  },
];

/**
 * "Which of these is NOT a rectangle?"
 *
 * The negation is capitalised in both scripts. A child who skims the stem and
 * answers the positive question is making a reading error, not a maths one,
 * and the item should not be quietly measuring that.
 */
export function genNonExample(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  const hi = lang === 'hi';
  const n = classNumber(cls);
  const eligible = CONCEPT_CASES.filter(c => n >= c.minClass);
  const c = eligible.length > 0 ? pick(eligible) : CONCEPT_CASES[0];

  const odd = pick(c.nonExamples);
  const rest = shuffleArr(c.examples).slice(0, 3).map(e => (hi ? e.hi : e.en));
  // Pad from the example list if the concept has fewer than three members by
  // reusing them is wrong — instead fall back to other concepts' examples
  // would break the category. Every case above carries at least one example,
  // and where it carries only one the grid is smaller by design rather than
  // padded with something that is also a non-example.
  const answer = hi ? odd.hi : odd.en;
  const choices = shuffleArr([answer, ...rest]);

  const conceptName = hi ? c.concept.hi : c.concept.en;
  const text = hi
    ? `इनमें से कौन ${conceptName} नहीं है?`
    : `Which of these is NOT ${conceptName}?`;

  return {
    questionText: text,
    answer,
    choices,
    resolvedCategory: 'shapes',
    // The reason is carried on the question so feedback can name the attribute
    // that was missed rather than only marking the tile.
    distractorMap: Object.fromEntries(rest.map(r => [r, 'nonexample.is-an-example'])),
  };
}

/**
 * "Tap EVERY shape that is not a rectangle."
 *
 * The set-valued form. A child who holds the prototype "a wide box" will tap
 * the square, and that single wrong selection identifies the prototype
 * directly — which the single-answer form cannot do.
 */
export function genNonExampleSet(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  const hi = lang === 'hi';
  const n = classNumber(cls);
  const eligible = CONCEPT_CASES.filter(c => n >= c.minClass && c.nonExamples.length >= 2);
  const c = eligible.length > 0 ? pick(eligible) : CONCEPT_CASES[0];

  const correct = shuffleArr(c.nonExamples).slice(0, 2).map(e => (hi ? e.hi : e.en));
  const distractors = shuffleArr(c.examples).slice(0, 3).map(e => (hi ? e.hi : e.en));
  const conceptName = hi ? c.concept.hi : c.concept.en;

  return multiSelectQuestion(
    hi ? `हर वह चुनें जो ${conceptName} नहीं है` : `Tap EVERY one that is NOT ${conceptName}`,
    correct,
    distractors,
    { resolvedCategory: 'shapes' },
  );
}

/** Every concept case, for the coverage guard. */
export function conceptCases(): ConceptCase[] {
  return CONCEPT_CASES;
}
