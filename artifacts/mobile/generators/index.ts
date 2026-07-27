// ─── Generators index: metadata, class topics, and main dispatcher ────────────

export * from './types';
export * from './helpers';
export * from './interactions';
export * from './topics-interactive';
export * from './number-sense';

import { SchoolClass, Difficulty, Category, Question, ClassConfig } from './types';
import { pick } from './helpers';
import { genAddition, genSubtraction, genMultiplication, genDivision, generateTablesQuestions } from './arithmetic';
import { genCounting, genNumberSense } from './early-years';
import { genNumberSenseStrand } from './number-sense';
import { genShapes, genTime, genMoney, genPlaceValue, genMeasurement } from './topics-core';
import { genFractions, genDecimals } from './fractions-decimals';
import { genWordProblems, genFactors, genGeometry, genPercentages, genData, genRatio, genIntegers, genAlgebra } from './advanced';
import { categoriesFor, DEFAULT_BOARD } from '../curriculum/boards';
import type { Board } from '../curriculum/boards';

export { generateTablesQuestions };

// ─── Class metadata ──────────────────────────────────────────────────────────

export const CLASS_CONFIGS: ClassConfig[] = [
  { key: '1st', label: 'Class 1', ageRange: 'Age 6–7',  color: '#FF6B6B' },
  { key: '2nd', label: 'Class 2', ageRange: 'Age 7–8',  color: '#FF9F43' },
  { key: '3rd', label: 'Class 3', ageRange: 'Age 8–9',  color: '#FDD835' },
  { key: '4th', label: 'Class 4', ageRange: 'Age 9–10', color: '#26C6DA' },
  { key: '5th', label: 'Class 5', ageRange: 'Age 10–11',color: '#42A5F5' },
  { key: '6th', label: 'Class 6', ageRange: 'Age 11–12',color: '#AB47BC' },
];

// ─── Category metadata ───────────────────────────────────────────────────────

export const CATEGORY_META: Record<Category, { label: string; icon: string; color: string; symbol: string; desc: string }> = {
  addition:       { label: 'Addition',        icon: 'plus',             color: '#4CAF50', symbol: '+',   desc: 'Adding numbers together' },
  subtraction:    { label: 'Subtraction',      icon: 'minus',            color: '#FF7043', symbol: '−',   desc: 'Taking numbers away' },
  multiplication: { label: 'Multiplication',   icon: 'x',                color: '#7E57C2', symbol: '×',   desc: 'Times tables & multiplying' },
  division:       { label: 'Division',         icon: 'divide-circle',    color: '#26A69A', symbol: '÷',   desc: 'Sharing & dividing numbers' },
  mixed:          { label: 'Mixed Practice',   icon: 'shuffle',          color: '#FF9800', symbol: '±',   desc: 'All operations mixed together' },
  tables:         { label: 'Times Tables',     icon: 'grid',             color: '#42A5F5', symbol: '×n',  desc: 'Drill a specific times table' },
  counting:       { label: 'Counting',         icon: 'hash',             color: '#EC407A', symbol: '123', desc: 'Count objects and skip count' },
  number_sense:   { label: 'Number Sense',     icon: 'eye',              color: '#AB47BC', symbol: '≈',   desc: 'Compare, order, and understand numbers' },
  shapes:         { label: 'Shapes',           icon: 'triangle',         color: '#5C6BC0', symbol: '△',   desc: 'Identify and measure 2D shapes' },
  time:           { label: 'Time',             icon: 'clock',            color: '#00ACC1', symbol: '⏱',   desc: 'Read the clock and calculate time' },
  money:          { label: 'Money',            icon: 'dollar-sign',      color: '#66BB6A', symbol: '₹',   desc: 'Coins, notes and giving change' },
  place_value:    { label: 'Place Value',      icon: 'align-right',      color: '#FFA726', symbol: '000', desc: 'Hundreds, tens and ones' },
  measurement:    { label: 'Measurement',      icon: 'activity',         color: '#8D6E63', symbol: 'cm',  desc: 'Length, mass and capacity units' },
  fractions:      { label: 'Fractions',        icon: 'pocket',           color: '#EF5350', symbol: '½',   desc: 'Parts of a whole number' },
  word_problems:  { label: 'Word Problems',    icon: 'book-open',        color: '#29B6F6', symbol: '?',   desc: 'Maths in real-life situations' },
  decimals:       { label: 'Decimals',         icon: 'more-horizontal',  color: '#9CCC65', symbol: '0.5', desc: 'Numbers with decimal points' },
  factors:        { label: 'Factors & Primes', icon: 'git-branch',       color: '#FF7043', symbol: 'HCF', desc: 'Factors, primes, HCF and LCM' },
  geometry:       { label: 'Geometry',         icon: 'maximize-2',       color: '#26C6DA', symbol: '□',   desc: 'Area, perimeter and angles' },
  percentages:    { label: 'Percentages',      icon: 'percent',          color: '#EC407A', symbol: '%',   desc: 'Fractions of 100' },
  data:           { label: 'Data & Averages',  icon: 'bar-chart',        color: '#42A5F5', symbol: 'avg', desc: 'Mean, median, mode and range' },
  ratio:          { label: 'Ratio',            icon: 'sliders',          color: '#AB47BC', symbol: 'a:b', desc: 'Comparing quantities' },
  integers:       { label: 'Integers',         icon: 'minus-square',     color: '#EF5350', symbol: '−n',  desc: 'Positive and negative numbers' },
  algebra:        { label: 'Algebra',          icon: 'code',             color: '#7E57C2', symbol: 'x=',  desc: 'Find the unknown value' },
};

// ─── Curriculum-aligned topic lists per class ─────────────────────────────────
// NOTE: this table is the legacy CBSE-default fallback. The authoritative,
// board-aware mapping now lives in curriculum/boards.ts — see
// docs/11-curriculum-research.md. Kept so callers without a board still work.
//
// Indian primary sequencing (CBSE / NCERT):
//   1st: Counting, number sense, addition, subtraction + basic shapes/time/money
//   2nd: Carry/borrow arithmetic, tables 2/5/10, place value, measurement
//   3rd: All 4 operations, tables 1–10, fractions intro, word problems, geometry basics
//   4th: Multi-digit ×/÷, fractions, decimals, factors, geometry, money
//   5th: Fractions, decimals, percentages, data/averages, ratio, geometry, measurement
//   6th: Integers, algebra, percentages, ratio, fractions, geometry, data

export const CLASS_TOPICS: Record<SchoolClass, { cats: Category[]; theme: string }> = {
  '1st': {
    // New NCERT "Joyful Mathematics" introduces multiplication in Class 1
    // ("How Many Times?") as equal groups / repeated addition.
    theme: 'Numbers & Shapes',
    cats: ['counting', 'number_sense', 'addition', 'subtraction', 'multiplication', 'shapes', 'time', 'money'],
  },
  '2nd': {
    theme: 'Tables & Place Value',
    cats: ['addition', 'subtraction', 'multiplication', 'mixed', 'tables', 'place_value', 'measurement', 'money', 'time', 'shapes'],
  },
  '3rd': {
    theme: 'All Operations',
    cats: ['addition', 'subtraction', 'multiplication', 'division', 'mixed', 'tables', 'fractions', 'word_problems', 'time', 'measurement', 'geometry', 'shapes'],
  },
  '4th': {
    theme: 'Decimals & Geometry',
    cats: ['multiplication', 'division', 'mixed', 'fractions', 'decimals', 'factors', 'geometry', 'money', 'measurement', 'word_problems', 'place_value'],
  },
  '5th': {
    theme: 'Percentages & Data',
    cats: ['multiplication', 'division', 'fractions', 'decimals', 'percentages', 'data', 'ratio', 'geometry', 'measurement', 'word_problems'],
  },
  '6th': {
    theme: 'Algebra & Integers',
    cats: ['integers', 'algebra', 'percentages', 'ratio', 'fractions', 'geometry', 'data', 'word_problems', 'multiplication', 'division'],
  },
};

/**
 * Categories a learner may practise.
 *
 * Board-aware: CBSE, ICSE and state boards teach several topics in different
 * years (ICSE introduces percentage and ratio in Class 5, CBSE in Class 6).
 * See curriculum/boards.ts and docs/11-curriculum-research.md.
 *
 * `board` is optional so existing callers keep working; it defaults to CBSE.
 */
export function getAvailableCategories(cls: SchoolClass, board: Board = DEFAULT_BOARD): Category[] {
  return categoriesFor(board, cls);
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

export function generateQuestion(cls: SchoolClass, diff: Difficulty, cat: Category, board: Board = DEFAULT_BOARD): Question {
  switch (cat) {
    case 'addition':       return genAddition(cls, diff);
    case 'subtraction':    return genSubtraction(cls, diff);
    case 'multiplication': return genMultiplication(cls, diff);
    case 'division':       return genDivision(cls, diff);
    case 'counting':       return genCounting(cls, diff);
    case 'number_sense':
      // Mix the legacy compare/order questions with the number-sense strand
      // (estimation, reasonableness, mental strategy, cross-representation).
      // The audit measured 0 estimation questions in 27,000 sampled; this is
      // the fix. Weighted toward the new strand because comparison was already
      // well covered and estimation was entirely absent.
      return Math.random() < 0.7
        ? genNumberSenseStrand(cls, diff)
        : genNumberSense(cls, diff);
    case 'shapes':         return genShapes(cls, diff);
    case 'time':           return genTime(cls, diff);
    case 'money':          return genMoney(cls, diff);
    case 'place_value':    return genPlaceValue(cls, diff);
    case 'measurement':    return genMeasurement(cls, diff);
    case 'fractions':      return genFractions(cls, diff);
    case 'word_problems':  return genWordProblems(cls, diff);
    case 'decimals':       return genDecimals(cls, diff);
    case 'factors':        return genFactors(cls, diff);
    case 'geometry':       return genGeometry(cls, diff);
    case 'percentages':    return genPercentages(cls, diff);
    case 'data':           return genData(cls, diff);
    case 'ratio':          return genRatio(cls, diff);
    case 'integers':       return genIntegers(cls, diff);
    case 'algebra':        return genAlgebra(cls, diff);
    case 'tables':         throw new Error('tables category should use startTablesGame, not generateQuestion');
    case 'mixed': {
      const available = getAvailableCategories(cls, board).filter(
        c => c !== 'mixed' && c !== 'tables' && c !== 'counting' && c !== 'number_sense',
      );
      const resolved = pick(available);
      const q = generateQuestion(cls, diff, resolved, board);
      return { ...q, resolvedCategory: resolved };
    }
  }
}
