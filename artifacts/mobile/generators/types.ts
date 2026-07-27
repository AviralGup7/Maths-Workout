// ─── Shared types for Maths Workout question generators ──────────────────────

export type SchoolClass = '1st' | '2nd' | '3rd' | '4th' | '5th' | '6th';
export type Difficulty   = 'easy' | 'medium' | 'hard';
export type Operation    = '+' | '-' | '×' | '÷';
export type ChoiceValue  = number | string;

export type Category =
  | 'addition' | 'subtraction' | 'multiplication' | 'division' | 'mixed' | 'tables'
  | 'counting' | 'number_sense' | 'shapes' | 'time' | 'money'
  | 'place_value' | 'measurement' | 'fractions' | 'word_problems'
  | 'decimals' | 'factors' | 'geometry' | 'percentages'
  | 'data' | 'ratio' | 'integers' | 'algebra';

export type SessionType = '10q' | '20q' | 'timed60';

export interface Question {
  questionText: string;
  answer: ChoiceValue;
  choices: ChoiceValue[];
  /** Actual category used when 'mixed' was selected */
  resolvedCategory?: Category;
}

export interface WrongAnswer {
  display: string;
  userAnswer: string;
  correctAnswer: string;
}

export interface StatEntry { attempted: number; correct: number; }
export type ProgressStats = Record<string, StatEntry>;

export interface ClassConfig {
  key: SchoolClass;
  label: string;
  ageRange: string;
  color: string;
}
