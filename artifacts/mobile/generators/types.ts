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
  /**
   * Maps a wrong choice to the misconception that produces it.
   * Populated by generators that use diagnostic distractors, so a wrong answer
   * identifies the faulty rule the learner applied rather than merely being
   * marked incorrect. Key is String(choice).
   */
  distractorMap?: Record<string, string>;
  /**
   * How this question is answered. Absent means multiple choice, so every
   * pre-existing generator keeps working unchanged.
   * See generators/interactions.ts and docs/10-question-engine-evolution.md.
   */
  interaction?: import('./interactions').Interaction;
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
  /** Fill colour — chips, washes, accents. Not safe as text. */
  color: string;
  /** Same hue, darkened until it clears WCAG AA as text on a light surface. */
  textColor: string;
  /** Same hue, lightened for a dark surface. One tone cannot serve both. */
  textColorDark: string;
}
