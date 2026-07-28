// ─── Set-valued grading ──────────────────────────────────────────────────────
// docs/27 P1-17. Blocks P1-18 (open-ended generators), P1-19 (Open Middle),
// P1-20 (reverse problems) and P3-06 (interactive manipulatives).
//
// Every interaction the app had until now graded against ONE right answer:
// a tile, a typed value, a fixed set, a fixed sequence, a band. That is the
// whole reason the question bank is closed-ended — a generator cannot ask
// "find two numbers that add to 50" if the grader can only hold one of the
// 49 valid pairs.
//
// This module grades against a *specification* rather than a value: a list of
// declarative constraints the submission must satisfy. Three consequences that
// matter more than the feature itself:
//
//   · Constraints are DATA, not predicates. A closure could not be inspected,
//     serialised, explained to a child, or asserted on in a test. Each
//     constraint carries its own child-facing message in both languages, so a
//     near-miss says "18 and 30 make 48, not 50" instead of "wrong".
//   · Grading is total and offline (docs/14 D5). No free-text understanding is
//     attempted; the child types numbers or an arithmetic expression, and both
//     are parsed deterministically.
//   · One valid answer (`exemplar`) is always carried, because a reveal has to
//     show something, and "one possible answer is 18 + 32" teaches that the
//     task had many answers — which is the pedagogical point of the format.

import type { ChoiceValue, Question } from './types';
import type { Lang } from '../i18n/strings';

// ─── Submission analysis ─────────────────────────────────────────────────────

/**
 * What a constraint is allowed to look at.
 *
 * Both input modes reduce to this shape, so a constraint never needs to know
 * whether the child filled numeric slots or typed an expression. That is what
 * lets Open Middle (`usesDigits`) and open-ended addition (`sum`) share one
 * grader.
 */
export interface OpenSubmission {
  /** Exactly what the child entered, untouched. */
  raw: string;
  /** Numeric literals, in the order they appear. */
  parts: number[];
  /** Value of the whole expression, or null when it does not parse. */
  value: number | null;
  /** Operators used, in order: '+', '-', '*', '/'. */
  ops: string[];
  /** Individual decimal digits used, in order. */
  digits: number[];
}

export type OpenOp = '+' | '-' | '*' | '/';

// ─── Constraints ─────────────────────────────────────────────────────────────

export type OpenConstraint =
  /** The numbers entered must add to `total`. */
  | { type: 'sum'; total: number }
  /** The numbers entered must multiply to `total`. */
  | { type: 'product'; total: number }
  /** first − second (in the order entered) must equal `total`. */
  | { type: 'difference'; total: number }
  /** The value of the whole expression must equal `target`. */
  | { type: 'equals'; target: number }
  /** The value must lie in (low, high) — strictly, when `exclusive`. */
  | { type: 'valueBetween'; low: number; high: number; exclusive?: boolean }
  /** Every number entered must lie in [low, high]. */
  | { type: 'partsBetween'; low: number; high: number }
  /** Every number entered must be a whole number. */
  | { type: 'integerParts' }
  /** The numbers entered must all differ from each other. */
  | { type: 'distinctParts' }
  /** How many numbers must be entered. */
  | { type: 'partCount'; count: number }
  /** Every number entered must be a multiple of k. */
  | { type: 'multipleOf'; k: number }
  /** These values are excluded — usually the trivial answer. */
  | { type: 'excludes'; values: number[] }
  /** Open Middle: the digits available, each usable at most once. */
  | { type: 'usesDigits'; digits: number[]; eachOnce: boolean }
  /** At least `min` operators, drawn only from `ops`. */
  | { type: 'usesOperations'; ops: OpenOp[]; min: number };

/** Floating point closeness — 0.1 + 0.2 must count as 0.3 for a child. */
const EPS = 1e-9;
const near = (a: number, b: number) => Math.abs(a - b) < EPS;

const OP_LABEL: Record<OpenOp, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

/**
 * Describe a constraint to the child, before they answer.
 *
 * Semi-Hindi (user policy): numerals stay Western Arabic in both languages,
 * and operator glyphs are untranslated, because they are what is being
 * navigated rather than what is being learned.
 */
export function describeConstraint(c: OpenConstraint, lang: Lang): string {
  const hi = lang === 'hi';
  switch (c.type) {
    case 'sum':          return hi ? `जोड़ ${c.total} हो` : `add to ${c.total}`;
    case 'product':      return hi ? `गुणनफल ${c.total} हो` : `multiply to ${c.total}`;
    case 'difference':   return hi ? `अंतर ${c.total} हो` : `differ by ${c.total}`;
    case 'equals':       return hi ? `उत्तर ${c.target} आए` : `make ${c.target}`;
    case 'valueBetween': return hi
      ? `${c.low} और ${c.high} के बीच हो` : `lie between ${c.low} and ${c.high}`;
    case 'partsBetween': return hi
      ? `हर संख्या ${c.low}–${c.high} के बीच हो` : `use numbers from ${c.low} to ${c.high}`;
    case 'integerParts': return hi ? 'पूर्ण संख्याएँ हों' : 'use whole numbers';
    case 'distinctParts':return hi ? 'संख्याएँ अलग-अलग हों' : 'use different numbers';
    case 'partCount':    return hi ? `${c.count} संख्याएँ दें` : `give ${c.count} numbers`;
    case 'multipleOf':   return hi ? `${c.k} का गुणज हो` : `be a multiple of ${c.k}`;
    case 'excludes':     return hi
      ? `${c.values.join(', ')} को छोड़कर` : `not ${c.values.join(' or ')}`;
    case 'usesDigits':   return hi
      ? `अंक ${c.digits.join(', ')}${c.eachOnce ? ' (हर एक एक बार)' : ''}`
      : `use the digits ${c.digits.join(', ')}${c.eachOnce ? ', each once' : ''}`;
    case 'usesOperations': return hi
      ? `${c.ops.map(o => OP_LABEL[o]).join(' या ')} का प्रयोग करें`
      : `use ${c.ops.map(o => OP_LABEL[o]).join(' or ')}`;
  }
}

/**
 * Why this submission failed the constraint, in the child's terms.
 *
 * Returns null when the constraint is satisfied. Returning the *reason* rather
 * than a boolean is the whole value of set-valued grading: an open task with a
 * bare red cross is worse feedback than a closed one, because the child cannot
 * tell whether they misread the task or miscalculated.
 */
export function checkConstraint(
  c: OpenConstraint,
  s: OpenSubmission,
  lang: Lang,
): string | null {
  const hi = lang === 'hi';
  const list = s.parts.join(hi ? ', ' : ', ');

  switch (c.type) {
    case 'sum': {
      if (s.parts.length === 0) return hi ? 'कोई संख्या नहीं दी।' : 'No numbers entered.';
      const got = s.parts.reduce((a, b) => a + b, 0);
      if (near(got, c.total)) return null;
      return hi
        ? `${list} का जोड़ ${round(got)} है, ${c.total} नहीं।`
        : `${list} adds to ${round(got)}, not ${c.total}.`;
    }
    case 'product': {
      if (s.parts.length === 0) return hi ? 'कोई संख्या नहीं दी।' : 'No numbers entered.';
      const got = s.parts.reduce((a, b) => a * b, 1);
      if (near(got, c.total)) return null;
      return hi
        ? `${list} का गुणनफल ${round(got)} है, ${c.total} नहीं।`
        : `${list} multiplies to ${round(got)}, not ${c.total}.`;
    }
    case 'difference': {
      if (s.parts.length < 2) return hi ? 'दो संख्याएँ चाहिए।' : 'Two numbers are needed.';
      const got = s.parts[0] - s.parts[1];
      if (near(got, c.total)) return null;
      return hi
        ? `${s.parts[0]} − ${s.parts[1]} = ${round(got)}, ${c.total} नहीं।`
        : `${s.parts[0]} − ${s.parts[1]} = ${round(got)}, not ${c.total}.`;
    }
    case 'equals': {
      if (s.value === null) return hi ? 'यह गणित का वाक्य नहीं बना।' : "That isn't a number sentence yet.";
      if (near(s.value, c.target)) return null;
      return hi
        ? `यह ${round(s.value)} बनता है, ${c.target} नहीं।`
        : `That makes ${round(s.value)}, not ${c.target}.`;
    }
    case 'valueBetween': {
      const v = s.value ?? (s.parts.length === 1 ? s.parts[0] : null);
      if (v === null) return hi ? 'कोई मान नहीं मिला।' : 'No value to check.';
      const okLow  = c.exclusive ? v > c.low + EPS  : v >= c.low - EPS;
      const okHigh = c.exclusive ? v < c.high - EPS : v <= c.high + EPS;
      if (okLow && okHigh) return null;
      return hi
        ? `${round(v)} ${c.low} और ${c.high} के बीच नहीं है।`
        : `${round(v)} is not between ${c.low} and ${c.high}.`;
    }
    case 'partsBetween': {
      const bad = s.parts.find(p => p < c.low - EPS || p > c.high + EPS);
      if (bad === undefined) return null;
      return hi
        ? `${bad} ${c.low} और ${c.high} के बीच नहीं है।`
        : `${bad} is outside ${c.low} to ${c.high}.`;
    }
    case 'integerParts': {
      const bad = s.parts.find(p => !Number.isInteger(p));
      if (bad === undefined) return null;
      return hi ? `${bad} पूर्ण संख्या नहीं है।` : `${bad} is not a whole number.`;
    }
    case 'distinctParts': {
      const seen = new Set<number>();
      for (const p of s.parts) {
        if (seen.has(p)) {
          return hi ? `${p} दो बार आया — अलग संख्याएँ चुनें।`
                    : `${p} is used twice — the numbers must differ.`;
        }
        seen.add(p);
      }
      return null;
    }
    case 'partCount': {
      if (s.parts.length === c.count) return null;
      return hi
        ? `${c.count} संख्याएँ चाहिए, ${s.parts.length} मिलीं।`
        : `${c.count} numbers are needed, ${s.parts.length} given.`;
    }
    case 'multipleOf': {
      const bad = s.parts.find(p => !Number.isInteger(p / c.k));
      if (bad === undefined) return null;
      return hi ? `${bad} ${c.k} का गुणज नहीं है।` : `${bad} is not a multiple of ${c.k}.`;
    }
    case 'excludes': {
      const bad = s.parts.find(p => c.values.some(v => near(v, p)))
        ?? (s.value !== null && c.values.some(v => near(v, s.value!)) ? s.value : undefined);
      if (bad === undefined) return null;
      return hi ? `${bad} इस बार नहीं चलेगा — कुछ और खोजें।`
                : `${bad} is ruled out this time — find another way.`;
    }
    case 'usesDigits': {
      const pool = [...c.digits];
      for (const d of s.digits) {
        const at = pool.indexOf(d);
        if (at === -1) {
          return c.eachOnce
            ? (hi ? `अंक ${d} बचा नहीं था।` : `Digit ${d} was already used up.`)
            : (hi ? `अंक ${d} उपलब्ध नहीं है।` : `Digit ${d} is not one of the given digits.`);
        }
        if (c.eachOnce) pool.splice(at, 1);
      }
      return null;
    }
    case 'usesOperations': {
      const allowed = new Set<string>(c.ops);
      const bad = s.ops.find(o => !allowed.has(o));
      if (bad) {
        return hi ? `${OP_LABEL[bad as OpenOp]} की अनुमति नहीं है।`
                  : `${OP_LABEL[bad as OpenOp]} is not allowed here.`;
      }
      if (s.ops.length >= c.min) return null;
      return hi
        ? `कम से कम ${c.min} चिह्न प्रयोग करें।`
        : `Use at least ${c.min} operation${c.min === 1 ? '' : 's'}.`;
    }
  }
}

function round(n: number): number {
  return Math.abs(n - Math.round(n)) < 1e-6 ? Math.round(n) : Number(n.toFixed(4));
}

// ─── Expression parsing ──────────────────────────────────────────────────────

const TOKEN = /\s*(\d+\.?\d*|[-+*/×÷−()])/y;

/**
 * Tokenise and evaluate an arithmetic expression.
 *
 * A hand-written recursive-descent parser rather than `eval` or `Function`:
 * the input is typed by a child on a device we do not control, and shipping a
 * code-execution path to grade "6 × 4" would be indefensible. It also has to
 * be total — a half-typed "6 ×" returns null instead of throwing, because the
 * child will see that state while typing.
 *
 * Unicode × ÷ − are accepted alongside ASCII: the app renders U+2212 in
 * question text (measured in docs/27's question-form survey), so children copy
 * it back.
 */
export function parseExpression(input: string): OpenSubmission {
  const raw = input;
  const norm = input.replace(/×/g, '*').replace(/÷/g, '/').replace(/[−–—]/g, '-');

  const tokens: string[] = [];
  TOKEN.lastIndex = 0;
  let pos = 0;
  while (pos < norm.length) {
    TOKEN.lastIndex = pos;
    const m = TOKEN.exec(norm);
    if (!m) break;
    tokens.push(m[1]);
    pos = TOKEN.lastIndex;
  }
  const consumedAll = norm.slice(pos).trim() === '';

  const parts: number[] = [];
  const ops: string[] = [];
  const digits: number[] = [];
  for (const tk of tokens) {
    if (/^\d/.test(tk)) {
      parts.push(Number(tk));
      for (const ch of tk) if (ch >= '0' && ch <= '9') digits.push(Number(ch));
    } else if (tk === '+' || tk === '-' || tk === '*' || tk === '/') {
      ops.push(tk);
    }
  }

  let i = 0;
  let failed = !consumedAll || tokens.length === 0;

  const expr = (): number => {
    let v = term();
    while (i < tokens.length && (tokens[i] === '+' || tokens[i] === '-')) {
      const op = tokens[i++];
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };
  const term = (): number => {
    let v = unary();
    while (i < tokens.length && (tokens[i] === '*' || tokens[i] === '/')) {
      const op = tokens[i++];
      const r = unary();
      if (op === '/' && r === 0) { failed = true; return 0; }
      v = op === '*' ? v * r : v / r;
    }
    return v;
  };
  const unary = (): number => {
    if (tokens[i] === '-') { i++; return -unary(); }
    if (tokens[i] === '(') {
      i++;
      const v = expr();
      if (tokens[i] === ')') i++; else failed = true;
      return v;
    }
    const tk = tokens[i];
    if (tk !== undefined && /^\d/.test(tk)) { i++; return Number(tk); }
    failed = true;
    return 0;
  };

  let value: number | null = null;
  if (!failed) {
    const v = expr();
    if (!failed && i === tokens.length && Number.isFinite(v)) value = v;
  }

  // A leading unary minus is a sign, not an operation the child "used".
  const usedOps = ops.filter((_, k) => !(k === 0 && /^\s*-/.test(norm)));

  return { raw, parts, value, ops: usedOps, digits };
}

/** Analyse numeric slots (the other input mode) into the same shape. */
export function analyseSlots(values: (number | null)[]): OpenSubmission {
  const parts = values.filter((v): v is number => v !== null && Number.isFinite(v));
  const digits: number[] = [];
  for (const p of parts) {
    for (const ch of String(Math.abs(p))) if (ch >= '0' && ch <= '9') digits.push(Number(ch));
  }
  return {
    raw: parts.join(', '),
    parts,
    value: parts.length === 1 ? parts[0] : null,
    ops: [],
    digits,
  };
}

/** Rebuild a submission from its normalised transport string. */
export function analyseOpen(normalised: string, mode: OpenInputMode): OpenSubmission {
  if (mode === 'expression') return parseExpression(normalised);
  const values = normalised.split(',').map(s => {
    const n = Number(s.trim());
    return Number.isFinite(n) && s.trim() !== '' ? n : null;
  });
  return analyseSlots(values);
}

// ─── The interaction ─────────────────────────────────────────────────────────

export type OpenInputMode = 'slots' | 'expression';

export interface OpenSpec {
  mode: OpenInputMode;
  /** Number of numeric slots, when mode is 'slots'. */
  slots?: number;
  constraints: OpenConstraint[];
  /** One valid answer, used for the reveal. Verified by the guard tests. */
  exemplar: string;
  /** Digits offered on the pad, when the task restricts them (Open Middle). */
  digitPool?: number[];
  /** Operators offered on the pad, when mode is 'expression'. */
  opPool?: OpenOp[];
}

export interface OpenVerdict {
  correct: boolean;
  /** Constraints satisfied, out of all of them — drives partial feedback. */
  met: number;
  total: number;
  /** First failure, phrased for the child. Null when correct. */
  message: string | null;
}

/**
 * Grade an open submission against every constraint.
 *
 * All constraints are evaluated, not short-circuited, so `met/total` is
 * honest: "you got the digits right but it makes 23, not 24" is a materially
 * different message from "nothing about this works", and a child who has
 * satisfied three of four constraints should be told so.
 */
export function gradeOpen(spec: OpenSpec, submitted: string, lang: Lang = 'en'): OpenVerdict {
  const s = analyseOpen(submitted, spec.mode);
  let met = 0;
  let message: string | null = null;
  for (const c of spec.constraints) {
    const fail = checkConstraint(c, s, lang);
    if (fail === null) met++;
    else if (message === null) message = fail;
  }
  return { correct: met === spec.constraints.length, met, total: spec.constraints.length, message };
}

/** Human-readable statement of everything the answer must satisfy. */
export function describeSpec(spec: OpenSpec, lang: Lang): string {
  const parts = spec.constraints
    .filter(c => c.type !== 'integerParts' && c.type !== 'partCount')
    .map(c => describeConstraint(c, lang));
  if (parts.length === 0) return '';
  return parts.join(lang === 'hi' ? ' · ' : ' · ');
}

/**
 * Build an open-response question.
 *
 * `answer` carries the exemplar so that every existing consumer — the wrong-
 * answer review list, the attempt log, accessibility announcements — keeps
 * working without knowing this interaction exists. They will show "one
 * possible answer", which is true and is what a child should read.
 */
export function openQuestion(
  questionText: string,
  spec: OpenSpec,
  opts: { resolvedCategory?: Question['resolvedCategory'] } = {},
): Question {
  return {
    questionText,
    answer: spec.exemplar,
    choices: [],
    resolvedCategory: opts.resolvedCategory,
    interaction: { kind: 'open', ...spec },
  };
}

/** Normalised transport form for an open answer. */
export function normaliseOpen(raw: string | ChoiceValue[]): string {
  if (Array.isArray(raw)) return raw.map(String).join(',');
  return String(raw).trim().replace(/\s+/g, ' ');
}
