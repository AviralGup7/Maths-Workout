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

/**
 * Denominators hidden inside Unicode fraction glyphs.
 *
 * `extractOperands` returns digits, and "½ of 12" contains exactly one digit —
 * so the denominator that the whole method depends on was invisible. Measured:
 * 0 of 200 fraction-of-amount questions could be taught before this.
 */
const GLYPH_DENOMINATOR: Record<string, number> = {
  '½': 2, '⅓': 3, '⅔': 3, '¼': 4, '¾': 4,
  '⅕': 5, '⅖': 5, '⅗': 5, '⅘': 5,
  '⅙': 6, '⅚': 6, '⅛': 8, '⅜': 8, '⅝': 8, '⅞': 8,
};

/**
 * Numbers as a *worked example* needs to see them.
 *
 * `extractOperands` (misconceptions.ts) is deliberately integer-only and drops
 * everything after "=", which is right for diagnosing a wrong answer and wrong
 * for demonstrating a method:
 *
 *     "0.2 − 0.1 = ?"   → [0, 2, 0, 1]   (decimals split at the point)
 *     "x + 7 = 12"      → [7]            (the result is discarded)
 *
 * Both produced confidently wrong teaching — "0 − 2 = -2" on a subtraction of
 * tenths. Rather than change a function the diagnosis path depends on, worked
 * examples parse for themselves: decimals kept whole, both sides of the
 * equation retained.
 */
export function teachingOperands(text: string): number[] {
  const cleaned = text.replace(/[?]/g, ' ');
  const matches = cleaned.match(/-?\d+(?:\.\d+)?(?!\s*\/)/g);
  return matches ? matches.map(Number).filter(Number.isFinite) : [];
}

/** Denominator implied by a question's text, from a glyph or an a/b pair. */
export function impliedDenominator(text: string): number | null {
  for (const [glyph, d] of Object.entries(GLYPH_DENOMINATOR)) {
    if (text.includes(glyph)) return d;
  }
  const pair = text.match(/(\d+)\s*\/\s*(\d+)/);
  if (pair) {
    const d = Number(pair[2]);
    if (Number.isFinite(d) && d > 1) return d;
  }
  return null;
}

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


// ─── docs/27 P1-06 … P1-11 · beyond the arithmetic spine ─────────────────────
//
// docs/26 measured worked examples covering 19 of 45 skills, all of them
// arithmetic: nothing for fractions, decimals, percentages, ratio, geometry or
// algebra — precisely the topics where a child most needs to see a method
// demonstrated, because they are the topics where the method is not obvious
// from the notation.
//
// Each solver below teaches the *reasoning*, not a keystroke sequence. The
// fraction solver names what the denominator means before touching it; the
// percentage solver routes through 10% because that is the strategy a child
// can reuse without a calculator. Steps stay capped at 4 (see the note above
// `addWithCarrySteps`) so the example is read rather than tapped through.

/**
 * "½ of 12" — the whole is the only parsed operand.
 *
 * The denominator lives in a Unicode glyph, so it is recovered from the
 * question text by the caller and passed as the second argument when known.
 * Falling back to 2 keeps the steps coherent rather than emitting "÷ NaN".
 */
function fracOfAmountSteps(whole: number, denom: number): Step[] {
  const d = Number.isFinite(denom) && denom > 1 ? denom : 2;
  const part = whole / d;
  return [
    step(1,
      `The bottom number ${d} means split ${whole} into ${d} equal parts.`,
      `नीचे की संख्या ${d} का अर्थ है ${whole} को ${d} बराबर भागों में बाँटना।`),
    step(2,
      `Each part is ${whole} ÷ ${d} = ${part}.`,
      `हर भाग है ${whole} ÷ ${d} = ${part}।`),
    step(3,
      `The top number says how many of those parts to take.`,
      `ऊपर की संख्या बताती है कि उनमें से कितने भाग लेने हैं।`,
      `${whole} ÷ ${d} = ${part}`),
  ];
}

function fracAddSteps(a: number, b: number, text: string): Step[] {
  const t = text.replace(/\s+/g, ' ');

  // "2/3 of 18 = ?" — a fraction OF an amount, not an addition. The same skill
  // ids serve both forms, so the solver must read which one it is rather than
  // assume: assuming produced "Add only the top numbers: 3 + 18 = 21" on a
  // question about finding two thirds of eighteen.
  const ofMatch = t.match(/(\d+)\s*\/\s*(\d+)\s*of\s*(\d+)/i);
  if (ofMatch) {
    const [, nStr, dStr, wholeStr] = ofMatch;
    const n = Number(nStr), d = Number(dStr), whole = Number(wholeStr);
    const one = whole / d;
    return [
      step(1,
        `The bottom number ${d} means split ${whole} into ${d} equal parts.`,
        `नीचे की संख्या ${d} का अर्थ है ${whole} को ${d} बराबर भागों में बाँटना।`),
      step(2,
        `One part is ${whole} ÷ ${d} = ${one}.`,
        `एक भाग है ${whole} ÷ ${d} = ${one}।`),
      step(3,
        `The top number says take ${n} of them: ${one} × ${n} = ${one * n}.`,
        `ऊपर की संख्या कहती है ${n} भाग लें: ${one} × ${n} = ${one * n}।`,
        `${one} × ${n} = ${one * n}`),
    ];
  }

  // "1/3 + 1/3 = ?/3" — same denominator, so only the numerators move.
  const pairs = [...t.matchAll(/(\d+)\s*\/\s*(\d+)/g)];
  if (pairs.length >= 2) {
    const n1 = Number(pairs[0][1]), n2 = Number(pairs[1][1]);
    const d = Number(pairs[0][2]);
    return [
      step(1,
        `The bottom numbers are both ${d}, so the pieces are the same size.`,
        `दोनों नीचे की संख्याएँ ${d} हैं, इसलिए टुकड़ों का आकार समान है।`),
      step(2,
        `Add only the top numbers: ${n1} + ${n2} = ${n1 + n2}.`,
        `केवल ऊपर की संख्याएँ जोड़ें: ${n1} + ${n2} = ${n1 + n2}।`),
      step(3,
        `The bottom number stays ${d} — it names the piece size, and that has not changed.`,
        `नीचे की संख्या ${d} ही रहती है — वह टुकड़े का आकार बताती है, जो बदला नहीं।`,
        `${n1}/${d} + ${n2}/${d} = ${n1 + n2}/${d}`),
    ];
  }
  return [];
}

function decimalSteps(a: number, b: number, text: string): Step[] {
  const t = text.toLowerCase();
  const tidy = (n: number) => Number(n.toFixed(4));

  // "Round 2.6 to the nearest whole number"
  if (/round/.test(t)) {
    const frac = a - Math.floor(a);
    const up = frac >= 0.5;
    return [
      step(1,
        `Look at the digit just after the decimal point.`,
        `दशमलव बिंदु के तुरंत बाद वाला अंक देखें।`),
      step(2,
        `It is ${String(tidy(frac)).replace('0.', '')} — ${up ? '5 or more, so round up' : 'less than 5, so round down'}.`,
        `वह ${String(tidy(frac)).replace('0.', '')} है — ${up ? '5 या अधिक, इसलिए ऊपर' : '5 से कम, इसलिए नीचे'}।`),
      step(3,
        `${a} rounds to ${up ? Math.ceil(a) : Math.floor(a)}.`,
        `${a} का पूर्णांकन ${up ? Math.ceil(a) : Math.floor(a)} है।`,
        `${a} → ${up ? Math.ceil(a) : Math.floor(a)}`),
    ];
  }

  // Read the operator from the question rather than assuming addition: the
  // decimals generator also produces × and ÷, and assuming produced
  // "2.1 + 3 = 5.1" for a question whose answer was 6.3.
  const lhs = text.split('=')[0];
  const op = /×/.test(lhs) ? '×' : /÷/.test(lhs) ? '÷' : /[−-]\s*\d/.test(lhs.replace(/^\s*-/, '')) ? '−' : '+';
  if (op === '÷' && b === 0) return [];
  const result = tidy(
    op === '×' ? a * b : op === '÷' ? a / b : op === '−' ? a - b : a + b,
  );

  // Multiplication and division of decimals are a different method from
  // column addition, so they get their own framing rather than a misleading
  // "line up the point".
  if (op === '×' || op === '÷') {
    return [
      step(1,
        `Ignore the decimal point for a moment and work with whole numbers.`,
        `कुछ देर दशमलव बिंदु छोड़कर पूर्ण संख्याओं से काम करें।`),
      step(2,
        `Count how many digits sit after the point in the question.`,
        `प्रश्न में बिंदु के बाद कितने अंक हैं, गिनें।`),
      step(3,
        `${a} ${op} ${b} = ${result}.`,
        `${a} ${op} ${b} = ${result}।`,
        `${a} ${op} ${b} = ${result}`),
    ];
  }

  return [
    step(1,
      `Line the numbers up at the decimal point, not at the end.`,
      `संख्याओं को दशमलव बिंदु पर सीध में रखें, अंत में नहीं।`),
    step(2,
      `Work the digits as usual, keeping the point in its column.`,
      `अंकों को सामान्य तरीक़े से जोड़ें/घटाएँ, बिंदु अपने स्तंभ में रहे।`),
    step(3,
      `${a} ${op} ${b} = ${result}.`,
      `${a} ${op} ${b} = ${result}।`,
      `${a} ${op} ${b} = ${result}`),
  ];
}

function percentSteps(a: number, b: number): Step[] {
  // a% of b. Routed through 10% because that is the mentally reusable strategy.
  const ten = b / 10;
  const result = (b * a) / 100;
  return [
    step(1,
      `Per cent means "out of a hundred", so ${a}% is ${a} hundredths of ${b}.`,
      `प्रतिशत का अर्थ है "सौ में से", तो ${a}% यानी ${b} का ${a} सौवाँ भाग।`),
    step(2,
      `Find 10% first by dividing by ten: ${b} ÷ 10 = ${ten}.`,
      `पहले दस से भाग देकर 10% निकालें: ${b} ÷ 10 = ${ten}।`),
    step(3,
      `${a}% is ${a / 10} lots of 10%: ${ten} × ${a / 10} = ${result}.`,
      `${a}% यानी 10% के ${a / 10} गुने: ${ten} × ${a / 10} = ${result}।`,
      `${a}% of ${b} = ${result}`),
  ];
}

function ratioSteps(a: number, b: number): Step[] {
  const parts = a + b;
  return [
    step(1,
      `The ratio ${a} : ${b} splits the whole into ${a} + ${b} = ${parts} equal parts.`,
      `अनुपात ${a} : ${b} पूरे को ${a} + ${b} = ${parts} बराबर भागों में बाँटता है।`),
    step(2,
      `Divide the total by ${parts} to find what one part is worth.`,
      `कुल को ${parts} से बाँटकर एक भाग का मान निकालें।`),
    step(3,
      `Then multiply one part by ${a} and by ${b} to get each share.`,
      `फिर एक भाग को ${a} और ${b} से गुणा करके दोनों हिस्से निकालें।`,
      `${a} : ${b}  →  ${parts} parts`),
  ];
}

/**
 * Area and perimeter, taught as a contrast.
 *
 * Confusing the two is among the most-documented errors in primary geometry,
 * and variation theory says the concept is learned through the contrast rather
 * than through either definition alone — so both are always shown together,
 * even when the question asked for only one.
 *
 * A square gives one side; a rectangle gives two.
 */
function geometrySteps(a: number, b: number, text: string): Step[] {
  const t = text.toLowerCase();

  // "Two angles sit on a straight line. One is N°." / "make a right angle"
  if (/straight line|right angle|full turn|triangle add|quadrilateral add/.test(t) && /one is/.test(t)) {
    const whole = /right angle/.test(t) ? 90 : /full turn/.test(t) ? 360 : 180;
    return [
      step(1,
        `Angles that meet like this always add up to ${whole}°.`,
        `इस तरह मिलने वाले कोण हमेशा ${whole}° तक जुड़ते हैं।`),
      step(2,
        `So the missing angle is ${whole} − ${a}.`,
        `इसलिए बचा हुआ कोण है ${whole} − ${a}।`),
      step(3,
        `${whole} − ${a} = ${whole - a}°.`,
        `${whole} − ${a} = ${whole - a}°।`,
        `${whole} − ${a} = ${whole - a}`),
    ];
  }

  // "A square has perimeter N. How long is each side?"
  if (/has perimeter/.test(t)) {
    return [
      step(1,
        `Perimeter is the distance all the way round.`,
        `परिमाप चारों ओर की कुल लंबाई है।`),
      step(2,
        `A square has 4 equal sides, so divide: ${a} ÷ 4.`,
        `वर्ग की 4 बराबर भुजाएँ होती हैं, इसलिए भाग दें: ${a} ÷ 4।`),
      step(3,
        `${a} ÷ 4 = ${a / 4}.`,
        `${a} ÷ 4 = ${a / 4}।`,
        `${a} ÷ 4 = ${a / 4}`),
    ];
  }

  // "Perimeter of a square with side N"
  if (/perimeter of a square/.test(t)) {
    return [
      step(1,
        `Perimeter walks the edge — add every side.`,
        `परिमाप किनारे पर चलता है — हर भुजा जोड़ें।`),
      step(2,
        `A square has 4 sides the same: ${a} + ${a} + ${a} + ${a}.`,
        `वर्ग की चारों भुजाएँ समान हैं: ${a} + ${a} + ${a} + ${a}।`),
      step(3,
        `That is 4 × ${a} = ${4 * a}.`,
        `यानी 4 × ${a} = ${4 * a}।`,
        `4 × ${a} = ${4 * a}`),
    ];
  }

  // "Area of a square with side N"
  if (/area of a square/.test(t)) {
    return [
      step(1,
        `Area covers the inside, so think in rows and columns.`,
        `क्षेत्रफल अंदर की जगह है, इसलिए पंक्ति और स्तंभ में सोचें।`),
      step(2,
        `A square with side ${a} has ${a} rows of ${a}.`,
        `${a} भुजा वाले वर्ग में ${a} की ${a} पंक्तियाँ होती हैं।`),
      step(3,
        `${a} × ${a} = ${a * a}.`,
        `${a} × ${a} = ${a * a}।`,
        `${a} × ${a} = ${a * a}`),
    ];
  }

  // "A rectangle is N long and N wide. How much longer…"
  if (/how much longer/.test(t)) {
    return [
      step(1,
        `This asks for a difference, not an area.`,
        `यह अंतर पूछ रहा है, क्षेत्रफल नहीं।`),
      step(2,
        `Take the width from the length: ${a} − ${b}.`,
        `लंबाई में से चौड़ाई घटाएँ: ${a} − ${b}।`),
      step(3,
        `${a} − ${b} = ${a - b}.`,
        `${a} − ${b} = ${a - b}।`,
        `${a} − ${b} = ${a - b}`),
    ];
  }

  // Bare fact recall ("How many degrees in a right angle?") — no method to
  // demonstrate, so the hint ladder is the right instrument, not this.
  if (!Number.isFinite(a)) return [];

  // Default: area and perimeter taught as a contrast. Confusing the two is
  // among the most-documented errors in primary geometry, and variation theory
  // says the concept is learned through the contrast rather than either
  // definition alone — so both are shown even when one was asked for.
  const w = Number.isFinite(b) && b > 0 ? b : a;
  return [
    step(1,
      `Decide first: are you covering the inside, or walking round the edge?`,
      `पहले तय करें: अंदर भर रहे हैं, या किनारे पर चल रहे हैं?`),
    step(2,
      `Area covers the inside — multiply: ${a} × ${w} = ${a * w}.`,
      `क्षेत्रफल अंदर भरता है — गुणा करें: ${a} × ${w} = ${a * w}।`),
    step(3,
      `Perimeter walks the edge — add all four sides: ${a} + ${w} + ${a} + ${w} = ${2 * (a + w)}.`,
      `परिमाप किनारे पर चलता है — चारों भुजाएँ जोड़ें: ${a} + ${w} + ${a} + ${w} = ${2 * (a + w)}।`,
      `area ${a * w}   ·   perimeter ${2 * (a + w)}`),
  ];
}

function algebraSteps(a: number, b: number, text: string): Step[] {
  const t = text.replace(/\s+/g, ' ');
  const balance = step(1,
    `An equation is a balance — both sides are worth the same.`,
    `समीकरण एक तराज़ू है — दोनों पक्षों का मान बराबर है।`);

  // "x + 7 = 12"  → subtract from both sides
  if (/x\s*\+/.test(t)) {
    return [balance,
      step(2,
        `${a} was added to x, so take ${a} off both sides.`,
        `x में ${a} जोड़ा गया था, इसलिए दोनों ओर से ${a} घटाएँ।`),
      step(3,
        `x = ${b} − ${a} = ${b - a}.`,
        `x = ${b} − ${a} = ${b - a}।`,
        `x = ${b - a}`),
    ];
  }

  // "x − 4 = 9"  → add to both sides. The minus is U+2212, not ASCII.
  if (/x\s*[−\-]/.test(t)) {
    return [balance,
      step(2,
        `${a} was taken from x, so add ${a} to both sides.`,
        `x में से ${a} घटाया गया था, इसलिए दोनों ओर ${a} जोड़ें।`),
      step(3,
        `x = ${b} + ${a} = ${b + a}.`,
        `x = ${b} + ${a} = ${b + a}।`,
        `x = ${b + a}`),
    ];
  }

  // "3x = 12"  → divide both sides
  if (/\dx/.test(t)) {
    const q = a === 0 ? NaN : b / a;
    if (!Number.isFinite(q)) return [];
    return [balance,
      step(2,
        `x was multiplied by ${a}, so divide both sides by ${a}.`,
        `x को ${a} से गुणा किया गया था, इसलिए दोनों ओर ${a} से भाग दें।`),
      step(3,
        `x = ${b} ÷ ${a} = ${q}.`,
        `x = ${b} ÷ ${a} = ${q}।`,
        `x = ${q}`),
    ];
  }
  return [];
}

/**
 * Solvers by skill.
 *
 * Covers the arithmetic spine plus the six families added in docs/27
 * P1-06…P1-11. Still deliberately NOT universal: a worked example for
 * "shapes.basic" would be a fact to memorise, not a method to follow, and
 * dressing recall up as a procedure teaches the wrong lesson. Those skills are
 * served by the hint ladder instead, which is the right instrument for a
 * convention.
 */
/**
 * A solver receives the parsed operands and the question text.
 *
 * Text matters because several families ask structurally different questions
 * under one skill: `geometry.basic` alone produces nine forms (area of a
 * square, perimeter from a side, a missing angle on a straight line…). A
 * solver that assumed one shape produced confident nonsense on the others —
 * measured, 127 of 127 geometry examples contained a wrong statement before
 * this. Branching on the form is the difference between teaching and
 * misinforming.
 */
type Solver = (a: number, b: number, text: string) => Step[];

const SOLVERS: Record<SkillId, Solver> = {
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

  // docs/27 P1-06 … P1-11
  'frac.ofAmount':       fracOfAmountSteps,
  'frac.addSameDenom':   fracAddSteps,
  'frac.equivalence':    fracAddSteps,
  'dec.tenths':          decimalSteps,
  'dec.hundredths':      decimalSteps,
  'percent.basic':       percentSteps,
  'ratio.basic':         ratioSteps,
  'geometry.basic':      geometrySteps,
  'algebra.basic':       algebraSteps,
};

/**
 * How many parsed operands each solver needs.
 *
 * Defaults to 2. Declared only where a family genuinely asks single-operand
 * questions, so the gate stays strict everywhere else.
 */
const SOLVER_ARITY: Partial<Record<SkillId, number>> = {
  'frac.ofAmount':  1,   // "½ of 12" — the fraction is a glyph, not a number
  'geometry.basic': 1,   // "Area of a square with side 7"
  'dec.tenths':     1,   // "Round 2.6 to the nearest whole number"
  'dec.hundredths': 1,
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

  // Arity is per-solver, not global. docs/27 P1-06…P1-11: several of the new
  // families ask genuinely single-operand questions — "½ of 12" parses one
  // number because the fraction is a Unicode glyph, and "Area of a square with
  // side 7" needs only the side. A blanket `operands.length < 2` gate silently
  // refused to teach those: measured 0 of 200 fraction-of-amount questions and
  // 22 of 200 geometry questions produced an example.
  // Prefer the teaching parser; fall back to whatever the caller supplied.
  const parsed = teachingOperands(questionText);
  const nums = parsed.length >= (SOLVER_ARITY[skill] ?? 2) ? parsed : operands;

  const arity = SOLVER_ARITY[skill] ?? 2;
  if (nums.length < arity) return null;

  const [a, b] = nums;
  if (!Number.isFinite(a)) return null;
  if (arity >= 2 && !Number.isFinite(b)) return null;
  // Division by zero and other degenerate inputs would produce nonsense steps.
  if (skill.startsWith('div.') && (b === 0 || !Number.isInteger(a / b))) return null;

  // Fractions carry their denominator in a glyph rather than a digit, so it is
  // recovered from the text and supplied as the second argument.
  const denom = impliedDenominator(questionText);
  const secondArg = skill === 'frac.ofAmount' && denom !== null ? denom : b;

  const steps = solver(a, secondArg, questionText).slice(0, 4);
  // A solver returns [] when it recognises the skill but not this question
  // form — bare fact recall, or an equation shape it has no method for.
  // Teaching nothing is correct there; shipping an empty card is not.
  if (steps.length === 0) return null;

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
