// ─── Board-aware curriculum model ────────────────────────────────────────────
// Research and sources: docs/11-curriculum-research.md
//
// The app previously hardcoded one curriculum — and it was the Irish primary
// syllabus, in euros, with Tom and Jane. This module replaces that with an
// explicit (board × class → topics) and (board × class × difficulty → ranges)
// model so the same engine can serve CBSE, ICSE and state boards correctly.

import type { Category, SchoolClass, Difficulty } from '../generators/types';

export type Board = 'cbse' | 'icse' | 'state';

export interface BoardConfig {
  key: Board;
  /** Short label, e.g. "CBSE". */
  label: string;
  /** Hindi label. */
  labelHi: string;
  /** Full name, e.g. "Central Board of Secondary Education". */
  fullName: string;
  fullNameHi: string;
  /** One-line description of what makes this board's syllabus distinct. */
  note: string;
  noteHi: string;
  colour: string;
  /** Same hue, lightened so the acronym clears AA on a dark wash. */
  colourDark: string;
}

export const BOARD_CONFIGS: BoardConfig[] = [
  {
    key: 'cbse',
    label: 'CBSE',
    labelHi: 'सीबीएसई',
    fullName: 'Central Board of Secondary Education',
    fullNameHi: 'केंद्रीय माध्यमिक शिक्षा बोर्ड',
    note: 'Follows NCERT. Balanced pace, concept-first.',
    noteHi: 'एनसीईआरटी पर आधारित। संतुलित गति, अवधारणा पर ज़ोर।',
    colour: '#0B5FA5',
    colourDark: '#7CC0F5',
  },
  {
    key: 'icse',
    label: 'ICSE',
    labelHi: 'आईसीएसई',
    fullName: 'Indian Certificate of Secondary Education',
    fullNameHi: 'भारतीय माध्यमिक शिक्षा प्रमाणपत्र',
    note: 'Broader syllabus. Several topics start a year earlier.',
    noteHi: 'व्यापक पाठ्यक्रम। कई विषय एक वर्ष पहले शुरू होते हैं।',
    colour: '#7B2A8A',
    colourDark: '#E29BF0',
  },
  {
    key: 'state',
    label: 'State Board',
    labelHi: 'राज्य बोर्ड',
    fullName: 'State Board (SCERT)',
    fullNameHi: 'राज्य बोर्ड (एससीईआरटी)',
    note: 'NCERT-aligned with a gentler pace on abstract topics.',
    noteHi: 'एनसीईआरटी के अनुरूप, कठिन विषयों में धीमी गति।',
    colour: '#2E6B32',
    colourDark: '#8FD69A',
  },
];

export const DEFAULT_BOARD: Board = 'cbse';

const CLASS_ORDER: SchoolClass[] = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

/** Numeric index of a class, 1–6. */
export function classNumber(cls: SchoolClass): number {
  return CLASS_ORDER.indexOf(cls) + 1;
}

/**
 * Earliest class in which each topic is taught, per board.
 *
 * `null` means the topic is not covered within Classes 1–6 for that board.
 * Derived from NCERT / CBSE syllabus listings and Selina Concise Mathematics
 * (ICSE) chapter lists — see docs/11-curriculum-research.md §5.
 */
export const TOPIC_AVAILABILITY: Record<Category, Record<Board, number | null>> = {
  // ── Foundational: identical across boards ────────────────────────────────
  counting:       { cbse: 1, icse: 1, state: 1 },
  number_sense:   { cbse: 1, icse: 1, state: 1 },
  addition:       { cbse: 1, icse: 1, state: 1 },
  subtraction:    { cbse: 1, icse: 1, state: 1 },
  shapes:         { cbse: 1, icse: 1, state: 1 },
  time:           { cbse: 1, icse: 1, state: 1 },
  money:          { cbse: 1, icse: 1, state: 1 },

  // Multiplication: the new NCERT Joyful Mathematics introduces it in Class 1
  // ("How Many Times?") as equal groups. State boards keep it to Class 2.
  multiplication: { cbse: 1, icse: 1, state: 2 },
  tables:         { cbse: 2, icse: 2, state: 2 },

  place_value:    { cbse: 2, icse: 2, state: 2 },
  measurement:    { cbse: 2, icse: 2, state: 2 },

  // Division is formally introduced in Class 3 ("Fair Share").
  division:       { cbse: 3, icse: 3, state: 3 },
  word_problems:  { cbse: 3, icse: 3, state: 3 },
  fractions:      { cbse: 3, icse: 3, state: 4 },
  mixed:          { cbse: 2, icse: 2, state: 2 },

  geometry:       { cbse: 4, icse: 4, state: 5 },

  // ICSE covers decimal fractions a year ahead of CBSE.
  decimals:       { cbse: 5, icse: 4, state: 5 },
  factors:        { cbse: 5, icse: 5, state: 6 },
  data:           { cbse: 5, icse: 5, state: 6 },

  // The clearest divergence: ICSE teaches percentage and ratio from Class 5,
  // CBSE from Class 6 (Comparing Quantities).
  percentages:    { cbse: 6, icse: 5, state: 6 },
  ratio:          { cbse: 6, icse: 5, state: 6 },

  integers:       { cbse: 6, icse: 6, state: null },
  algebra:        { cbse: 6, icse: 6, state: null },
};

/**
 * Topics that stop being offered as a standalone choice once a learner has
 * moved well past them.
 *
 * A Class 6 learner should not be presented with "count the stars" as a topic
 * on the menu — it is not on their syllabus and it signals the wrong thing.
 * Foundational arithmetic (addition, subtraction, tables) is deliberately NOT
 * in this list: it stays available at every class, because fluency practice
 * remains valuable and the adaptive scheduler needs those skills reachable in
 * order to repair prerequisite gaps.
 *
 * Value is the number of classes a topic stays on the menu after introduction.
 */
const TOPIC_WINDOW: Partial<Record<Category, number>> = {
  counting: 2,      // Classes 1–2
  number_sense: 3,  // Classes 1–3
  shapes: 4,        // Classes 1–4, then subsumed by geometry
  time: 4,
  money: 4,
};

/** Is this topic taught at or before the given class, for this board? */
export function isTopicAvailable(board: Board, cls: SchoolClass, cat: Category): boolean {
  const from = TOPIC_AVAILABILITY[cat]?.[board];
  if (from === null || from === undefined) return false;
  const n = classNumber(cls);
  if (n < from) return false;
  const window = TOPIC_WINDOW[cat];
  // Outside its window the topic is considered mastered and drops off the menu.
  if (window !== undefined && n > from + window - 1) return false;
  return true;
}

/** Every category available to a learner, ordered as they are taught. */
export function categoriesFor(board: Board, cls: SchoolClass): Category[] {
  return (Object.keys(TOPIC_AVAILABILITY) as Category[])
    .filter(cat => isTopicAvailable(board, cls, cat))
    .sort((a, b) => {
      const fa = TOPIC_AVAILABILITY[a][board] ?? 99;
      const fb = TOPIC_AVAILABILITY[b][board] ?? 99;
      return fa - fb;
    });
}

/**
 * Difficulty scaling per board.
 *
 * ICSE covers more ground at the same age, state boards slightly less. Rather
 * than duplicating every generator we scale the operand magnitude, so a
 * "Class 5 hard" addition is genuinely larger for an ICSE learner.
 */
export interface DifficultyProfile {
  /** Multiplier applied to generated operand ranges. */
  operandScale: number;
  /** Extra description shown on the difficulty screen. */
  note: string;
  noteHi: string;
}

export const DIFFICULTY_PROFILE: Record<Board, DifficultyProfile> = {
  cbse:  { operandScale: 1.00, note: 'NCERT-aligned number ranges.',        noteHi: 'एनसीईआरटी के अनुसार संख्याएँ।' },
  icse:  { operandScale: 1.20, note: 'Slightly larger numbers than CBSE.',  noteHi: 'सीबीएसई से थोड़ी बड़ी संख्याएँ।' },
  state: { operandScale: 0.85, note: 'Gentler number ranges.',              noteHi: 'अपेक्षाकृत छोटी संख्याएँ।' },
};

/**
 * Scale an operand bound for a board.
 * Always returns at least `min`, so scaling can never invert a range.
 */
export function scaleBound(board: Board, value: number, min = 1): number {
  const scaled = Math.round(value * DIFFICULTY_PROFILE[board].operandScale);
  return Math.max(min, scaled);
}

/**
 * Class labels.
 *
 * The app previously used the Irish convention ("1st Class"). Indian boards
 * say "Class 1".
 */
export const CLASS_LABELS: Record<SchoolClass, { en: string; hi: string; age: string }> = {
  '1st': { en: 'Class 1', hi: 'कक्षा 1', age: '6–7' },
  '2nd': { en: 'Class 2', hi: 'कक्षा 2', age: '7–8' },
  '3rd': { en: 'Class 3', hi: 'कक्षा 3', age: '8–9' },
  '4th': { en: 'Class 4', hi: 'कक्षा 4', age: '9–10' },
  '5th': { en: 'Class 5', hi: 'कक्षा 5', age: '10–11' },
  '6th': { en: 'Class 6', hi: 'कक्षा 6', age: '11–12' },
};

/** Theme shown on the topic screen, per board and class. */
export const CLASS_THEME: Record<Board, Record<SchoolClass, { en: string; hi: string }>> = {
  cbse: {
    '1st': { en: 'Numbers & Shapes',       hi: 'संख्याएँ और आकार' },
    '2nd': { en: 'Place Value & Tables',   hi: 'स्थानीय मान और पहाड़े' },
    '3rd': { en: 'All Four Operations',    hi: 'चारों संक्रियाएँ' },
    '4th': { en: 'Fractions & Measurement',hi: 'भिन्न और मापन' },
    '5th': { en: 'Decimals & Factors',     hi: 'दशमलव और गुणनखंड' },
    '6th': { en: 'Integers & Algebra',     hi: 'पूर्णांक और बीजगणित' },
  },
  icse: {
    '1st': { en: 'Numbers & Shapes',       hi: 'संख्याएँ और आकार' },
    '2nd': { en: 'Place Value & Tables',   hi: 'स्थानीय मान और पहाड़े' },
    '3rd': { en: 'All Four Operations',    hi: 'चारों संक्रियाएँ' },
    '4th': { en: 'Fractions & Decimals',   hi: 'भिन्न और दशमलव' },
    '5th': { en: 'Percentage & Ratio',     hi: 'प्रतिशत और अनुपात' },
    '6th': { en: 'Algebra & Integers',     hi: 'बीजगणित और पूर्णांक' },
  },
  state: {
    '1st': { en: 'Numbers & Shapes',       hi: 'संख्याएँ और आकार' },
    '2nd': { en: 'Counting & Tables',      hi: 'गिनती और पहाड़े' },
    '3rd': { en: 'Four Operations',        hi: 'चार संक्रियाएँ' },
    '4th': { en: 'Fractions & Shapes',     hi: 'भिन्न और आकार' },
    '5th': { en: 'Decimals & Geometry',    hi: 'दशमलव और ज्यामिति' },
    '6th': { en: 'Percentage & Data',      hi: 'प्रतिशत और आँकड़े' },
  },
};
