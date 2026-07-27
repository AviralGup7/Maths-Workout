// ─── Worked examples ─────────────────────────────────────────────────────────
// Implements §1 of docs/14-educational-improvement-roadmap.md.
//
// The audit's verdict was "an outstanding diagnostician that has not yet
// learned to teach": the app names a child's misconception precisely, then
// moves on and lets them make it again. This module closes that loop.
//
// Three design commitments, each of which the roadmap treats as non-negotiable:
//
//  D1 · Instruction is EARNED. A worked example appears only after repeated,
//       evidence-backed failure — never as a lesson, never on a "Learn" tab.
//  D2 · It TERMINATES. Support that never withdraws produces dependence. The
//       trigger has a cooldown and a fade condition, both encoded here.
//  D5 · It is DATA, not prose. Steps are generated from operands by a solver,
//       so 12 solvers cover the arithmetic spine in both languages without
//       authoring a single worked example by hand.
//
// The expertise-reversal effect is why the mastery gate is strict: worked
// examples help novices substantially and actively *harm* competent learners.
// Showing one to a child having a bad moment is patronising and counter-
// productive, so a strong learner never sees one.

import type { SkillId } from './skills';
import type { MasteryEstimate } from './mastery';
import { STRUGGLING_THRESHOLD } from './mastery';
import type { Attempt } from './attempts';
import { consecutiveMisses } from './adaptation';
import type { Lang } from '../i18n/strings';

// ─── Trigger ─────────────────────────────────────────────────────────────────

/** Consecutive misses on a skill, in one session, before teaching. */
export const WE_MISS_TRIGGER = 2;

/** Same misconception this many times in the recent window also triggers. */
export const WE_MISCONCEPTION_TRIGGER = 2;
export const WE_MISCONCEPTION_WINDOW = 5;

/** Attempts on a skill that must pass before it may teach again. */
export const WE_COOLDOWN_ATTEMPTS = 20;

/** Consecutive correct twins that retire worked examples for a skill. */
export const WE_FADE_STREAK = 2;

/**
 * Should a worked example be shown for this skill right now?
 *
 * Triple-gated, and every gate earns its place:
 *   · repeated failure   — one mistake is a slip, not a misconception
 *   · mastery < 0.55     — expertise reversal; do not re-teach the competent
 *   · cooldown           — otherwise a hard skill becomes a wall of teaching
 */
export function shouldTeach(args: {
  skill: SkillId;
  sessionLog: Attempt[];
  /** Full attempt log, for cooldown accounting. */
  log: Attempt[];
  estimates: Record<SkillId, MasteryEstimate>;
  /** Attempt indices at which this skill last taught, most recent last. */
  taughtAt?: number[];
}): boolean {
  const { skill, sessionLog, log, estimates, taughtAt = [] } = args;

  const mastery = estimates[skill]?.value ?? 0.5;
  if (mastery >= STRUGGLING_THRESHOLD) return false;

  // Cooldown: count attempts on this skill since the last worked example.
  const attemptsOnSkill = log.filter(a => a.skill === skill).length;
  const lastTaught = taughtAt.length > 0 ? taughtAt[taughtAt.length - 1] : -Infinity;
  if (attemptsOnSkill - lastTaught < WE_COOLDOWN_ATTEMPTS) return false;

  if (consecutiveMisses(sessionLog, skill) >= WE_MISS_TRIGGER) return true;

  // Or: the same named misconception twice in the recent window. This catches
  // a learner who is wrong in a consistent way without being wrong twice in a
  // row — arguably the clearest case of a faulty rule.
  const recent = log.filter(a => a.skill === skill).slice(-WE_MISCONCEPTION_WINDOW);
  const counts = new Map<string, number>();
  for (const a of recent) {
    if (!a.misconception || a.misconception === 'legacy-import') continue;
    counts.set(a.misconception, (counts.get(a.misconception) ?? 0) + 1);
  }
  return [...counts.values()].some(n => n >= WE_MISCONCEPTION_TRIGGER);
}

/**
 * Has the learner earned the withdrawal of worked examples for this skill?
 * Two consecutive correct answers after teaching is the fade condition (D2).
 */
export function hasFaded(sessionLog: Attempt[], skill: SkillId): boolean {
  const mine = sessionLog.filter(a => a.skill === skill);
  if (mine.length < WE_FADE_STREAK) return false;
  return mine.slice(-WE_FADE_STREAK).every(a => a.correct);
}

// ─── Step model ──────────────────────────────────────────────────────────────

export interface Step {
  /** 1-based step number, for the ① ② ③ markers. */
  n: number;
  /** What to do, in the learner's language. */
  text: { en: string; hi: string };
  /** Optional arithmetic to render in a monospaced block. */
  work?: string;
}

export interface WorkedExample {
  skill: SkillId;
  /** The problem being worked, verbatim. */
  problem: string;
  /** The correct result. */
  answer: number;
  steps: Step[];
  /** Explanation of the learner's specific error, when one was diagnosed. */
  errorNote?: { en: string; hi: string };
}

const step = (n: number, en: string, hi: string, work?: string): Step =>
  ({ n, text: { en, hi }, work });

// ─── Solvers ─────────────────────────────────────────────────────────────────
//
// One solver per family. Each takes the operands and returns ordered steps.
// Capped at 4 steps: beyond that a worked example becomes a wall of text and
// the child taps through it without reading.

function addWithCarrySteps(a: number, b: number): Step[] {
  const onesA = a % 10, onesB = b % 10;
  const onesSum = onesA + onesB;
  const carried = onesSum >= 10;
  const steps: Step[] = [
    step(1,
      `Add the ones: ${onesA} + ${onesB} = ${onesSum}.`,
      `इकाई जोड़ें: ${onesA} + ${onesB} = ${onesSum}।`),
  ];
  if (carried) {
    steps.push(step(2,
      `${onesSum} is ten or more, so write ${onesSum % 10} and carry 1 ten.`,
      `${onesSum} दस या अधिक है, इसलिए ${onesSum % 10} लिखें और 1 दहाई हासिल रखें।`));
  }
  const tensA = Math.floor(a / 10), tensB = Math.floor(b / 10);
  const carry = carried ? 1 : 0;
  steps.push(step(steps.length + 1,
    `Add the tens: ${tensA} + ${tensB}${carry ? ' + 1 carried' : ''} = ${tensA + tensB + carry}.`,
    `दहाई जोड़ें: ${tensA} + ${tensB}${carry ? ' + 1 हासिल' : ''} = ${tensA + tensB + carry}।`));
  steps.push(step(steps.length + 1,
    `So ${a} + ${b} = ${a + b}.`,
    `इसलिए ${a} + ${b} = ${a + b}।`,
    `${a} + ${b} = ${a + b}`));
  return steps;
}

function subWithBorrowSteps(a: number, b: number): Step[] {
  const onesA = a % 10, onesB = b % 10;
  const needsBorrow = onesA < onesB;
  const steps: Step[] = [];
  if (needsBorrow) {
    steps.push(step(1,
      `${onesA} is smaller than ${onesB}, so borrow 1 ten from the ${Math.floor(a / 10)}.`,
      `${onesA}, ${onesB} से छोटा है, इसलिए ${Math.floor(a / 10)} में से 1 दहाई उधार लें।`,
      `${Math.floor(a / 10) - 1} ¹${onesA}`));
    steps.push(step(2,
      `Now the ones are ${onesA + 10}: ${onesA + 10} − ${onesB} = ${onesA + 10 - onesB}.`,
      `अब इकाई ${onesA + 10} है: ${onesA + 10} − ${onesB} = ${onesA + 10 - onesB}।`));
    const tensA = Math.floor(a / 10) - 1, tensB = Math.floor(b / 10);
    steps.push(step(3,
      `Tens: ${tensA} − ${tensB} = ${tensA - tensB}.`,
      `दहाई: ${tensA} − ${tensB} = ${tensA - tensB}।`));
  } else {
    steps.push(step(1,
      `Ones: ${onesA} − ${onesB} = ${onesA - onesB}.`,
      `इकाई: ${onesA} − ${onesB} = ${onesA - onesB}।`));
    steps.push(step(2,
      `Tens: ${Math.floor(a / 10)} − ${Math.floor(b / 10)} = ${Math.floor(a / 10) - Math.floor(b / 10)}.`,
      `दहाई: ${Math.floor(a / 10)} − ${Math.floor(b / 10)} = ${Math.floor(a / 10) - Math.floor(b / 10)}।`));
  }
  steps.push(step(steps.length + 1,
    `So ${a} − ${b} = ${a - b}.`,
    `इसलिए ${a} − ${b} = ${a - b}।`,
    `${a} − ${b} = ${a - b}`));
  return steps;
}

function mulSteps(a: number, b: number): Step[] {
  return [
    step(1,
      `${a} × ${b} means ${b} groups of ${a}.`,
      `${a} × ${b} का अर्थ है ${a} के ${b} समूह।`),
    step(2,
      `Count up in ${a}s, ${b} times.`,
      `${a} की छलांग में ${b} बार गिनें।`,
      Array.from({ length: Math.min(b, 6) }, (_, i) => a * (i + 1)).join(', ') + (b > 6 ? ' …' : '')),
    step(3,
      `So ${a} × ${b} = ${a * b}.`,
      `इसलिए ${a} × ${b} = ${a * b}।`,
      `${a} × ${b} = ${a * b}`),
  ];
}

function divSteps(a: number, b: number): Step[] {
  return [
    step(1,
      `${a} ÷ ${b} asks: how many groups of ${b} fit into ${a}?`,
      `${a} ÷ ${b} का अर्थ: ${a} में ${b} के कितने समूह आएँगे?`),
    step(2,
      `Use the ${b} times table: ${b} × ${a / b} = ${a}.`,
      `${b} का पहाड़ा देखें: ${b} × ${a / b} = ${a}।`),
    step(3,
      `So ${a} ÷ ${b} = ${a / b}.`,
      `इसलिए ${a} ÷ ${b} = ${a / b}।`,
      `${a} ÷ ${b} = ${a / b}`),
  ];
}

function addSimpleSteps(a: number, b: number): Step[] {
  return [
    step(1,
      `Start at ${a}.`,
      `${a} से शुरू करें।`),
    step(2,
      `Count on ${b} more.`,
      `${b} और आगे गिनें।`,
      Array.from({ length: Math.min(b, 8) }, (_, i) => a + i + 1).join(', ')),
    step(3,
      `So ${a} + ${b} = ${a + b}.`,
      `इसलिए ${a} + ${b} = ${a + b}।`,
      `${a} + ${b} = ${a + b}`),
  ];
}

function subSimpleSteps(a: number, b: number): Step[] {
  return [
    step(1,
      `Start at ${a}.`,
      `${a} से शुरू करें।`),
    step(2,
      `Count back ${b}.`,
      `${b} पीछे गिनें।`,
      Array.from({ length: Math.min(b, 8) }, (_, i) => a - i - 1).join(', ')),
    step(3,
      `So ${a} − ${b} = ${a - b}.`,
      `इसलिए ${a} − ${b} = ${a - b}।`,
      `${a} − ${b} = ${a - b}`),
  ];
}

/**
 * Solvers by skill.
 *
 * Deliberately covers the arithmetic spine only. A worked example for
 * "shapes.basic" would be a fact to memorise, not a method to follow, and
 * dressing recall up as a procedure teaches the wrong lesson.
 */
const SOLVERS: Record<SkillId, (a: number, b: number) => Step[]> = {
  'add.within10':        addSimpleSteps,
  'add.within20':        addSimpleSteps,
  'add.2digit.nocarry':  addWithCarrySteps,
  'add.2digit.carry':    addWithCarrySteps,
  'add.3digit':          addWithCarrySteps,
  'add.large':           addWithCarrySteps,
  'sub.within10':        subSimpleSteps,
  'sub.within20':        subSimpleSteps,
  'sub.2digit.noborrow': subWithBorrowSteps,
  'sub.2digit.borrow':   subWithBorrowSteps,
  'sub.3digit':          subWithBorrowSteps,
  'sub.large':           subWithBorrowSteps,
  'mul.tables.easy':     mulSteps,
  'mul.tables.mid':      mulSteps,
  'mul.tables.full':     mulSteps,
  'mul.2digit':          mulSteps,
  'div.basic':           divSteps,
  'div.tables':          divSteps,
  'div.large':           divSteps,
};

/** Is a worked example available for this skill at all? */
export function canTeach(skill: SkillId): boolean {
  return skill in SOLVERS;
}

/** Every skill with a solver — used by tests and coverage reporting. */
export const TAUGHT_SKILLS = Object.keys(SOLVERS);

/**
 * Build a worked example for the question the learner just failed.
 *
 * Same operands, not a generic illustration: the child is shown *their* problem
 * solved, which is what makes the transfer to the twin question immediate.
 * Returns null when the skill has no solver or the operands cannot be read.
 */
export function buildWorkedExample(args: {
  skill: SkillId;
  questionText: string;
  operands: number[];
  answer: number;
  /** The learner's wrong answer, for the error note. */
  chosen?: string;
  /** Diagnosed misconception id, if any. */
  misconception?: string;
  /** Misconception explanations, injected to avoid a circular import. */
  explain?: (id: string, lang: Lang) => string | undefined;
}): WorkedExample | null {
  const { skill, questionText, operands, answer, chosen, misconception, explain } = args;
  const solver = SOLVERS[skill];
  if (!solver) return null;
  if (operands.length < 2) return null;

  const [a, b] = operands;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  // Division by zero and other degenerate inputs would produce nonsense steps.
  if (skill.startsWith('div.') && (b === 0 || !Number.isInteger(a / b))) return null;

  const steps = solver(a, b).slice(0, 4);

  let errorNote: WorkedExample['errorNote'];
  if (chosen && misconception && explain) {
    const en = explain(misconception, 'en');
    const hi = explain(misconception, 'hi');
    if (en) {
      errorNote = {
        en: `You answered ${chosen} — ${lowerFirst(en)}`,
        hi: `आपने ${chosen} लिखा — ${hi ?? en}`,
      };
    }
  }

  return { skill, problem: questionText, answer, steps, errorNote };
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
