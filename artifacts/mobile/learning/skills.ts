// ─── Skill model ─────────────────────────────────────────────────────────────
// Direction C foundation.
//
// The legacy model keyed progress on the opaque string `${class}_${category}_${difficulty}`
// e.g. "3rd_multiplication_medium". That is a *session descriptor*, not a skill:
//   · it conflates WHAT is being learned with HOW HARD the session was
//   · it has no notion of prerequisites, so a failure cannot be traced to its cause
//   · it cannot decay, so a skill practised once in March reads as mastered in June
//
// This module replaces it with named, atomic skills arranged in a prerequisite
// DAG. Mastery is estimated per skill (see mastery.ts) and scheduling is driven
// by that estimate (see scheduler.ts).

import type { Category, SchoolClass, Difficulty } from '../generators/types';

/** Stable identifier for an atomic skill. Never renamed once shipped — it is a storage key. */
export type SkillId = string;

export interface Skill {
  id: SkillId;
  label: string;
  /** Skills that should be secure before this one is introduced. */
  prerequisites: SkillId[];
  /** Earliest class in which this skill is normally taught. */
  introducedIn: SchoolClass;
  /** Category this skill is practised through. */
  category: Category;
}

/**
 * The skill graph.
 *
 * Deliberately kept modest in size: it covers the arithmetic spine where
 * prerequisite relationships genuinely matter and where misconceptions are
 * well documented. Topic categories without meaningful internal ordering
 * (shapes, time, money…) map to a single skill each via `skillsForCategory`.
 */
export const SKILLS: Record<SkillId, Skill> = {
  // ── Addition ───────────────────────────────────────────────────────────────
  'add.within10':        { id: 'add.within10',        label: 'Add within 10',                 prerequisites: [],                     introducedIn: '1st', category: 'addition' },
  'add.within20':        { id: 'add.within20',        label: 'Add within 20',                 prerequisites: ['add.within10'],       introducedIn: '1st', category: 'addition' },
  'add.2digit.nocarry':  { id: 'add.2digit.nocarry',  label: 'Add 2-digit (no carrying)',     prerequisites: ['add.within20'],       introducedIn: '2nd', category: 'addition' },
  'add.2digit.carry':    { id: 'add.2digit.carry',    label: 'Add 2-digit with carrying',     prerequisites: ['add.2digit.nocarry'], introducedIn: '2nd', category: 'addition' },
  'add.3digit':          { id: 'add.3digit',          label: 'Add 3-digit numbers',           prerequisites: ['add.2digit.carry', 'numsense.estimate'], introducedIn: '3rd', category: 'addition' },
  'add.large':           { id: 'add.large',           label: 'Add large numbers',             prerequisites: ['add.3digit'],         introducedIn: '5th', category: 'addition' },

  // ── Subtraction ────────────────────────────────────────────────────────────
  'sub.within10':        { id: 'sub.within10',        label: 'Subtract within 10',            prerequisites: ['add.within10'],       introducedIn: '1st', category: 'subtraction' },
  'sub.within20':        { id: 'sub.within20',        label: 'Subtract within 20',            prerequisites: ['sub.within10'],       introducedIn: '1st', category: 'subtraction' },
  'sub.2digit.noborrow': { id: 'sub.2digit.noborrow', label: 'Subtract 2-digit (no borrowing)', prerequisites: ['sub.within20'],     introducedIn: '2nd', category: 'subtraction' },
  'sub.2digit.borrow':   { id: 'sub.2digit.borrow',   label: 'Subtract with borrowing',       prerequisites: ['sub.2digit.noborrow'], introducedIn: '2nd', category: 'subtraction' },
  'sub.3digit':          { id: 'sub.3digit',          label: 'Subtract 3-digit numbers',      prerequisites: ['sub.2digit.borrow'],  introducedIn: '3rd', category: 'subtraction' },
  'sub.large':           { id: 'sub.large',           label: 'Subtract large numbers',        prerequisites: ['sub.3digit'],         introducedIn: '5th', category: 'subtraction' },

  // ── Multiplication ─────────────────────────────────────────────────────────
  'mul.tables.easy':     { id: 'mul.tables.easy',     label: 'Times tables 2, 5, 10',         prerequisites: ['add.within20'],       introducedIn: '2nd', category: 'multiplication' },
  'mul.tables.mid':      { id: 'mul.tables.mid',      label: 'Times tables up to 10',         prerequisites: ['mul.tables.easy'],    introducedIn: '3rd', category: 'multiplication' },
  'mul.tables.full':     { id: 'mul.tables.full',     label: 'Times tables up to 12',         prerequisites: ['mul.tables.mid'],     introducedIn: '4th', category: 'multiplication' },
  'mul.2digit':          { id: 'mul.2digit',          label: 'Multiply 2-digit numbers',      prerequisites: ['mul.tables.full', 'numsense.estimate'], introducedIn: '4th', category: 'multiplication' },
  'mul.large':           { id: 'mul.large',           label: 'Multiply large numbers',        prerequisites: ['mul.2digit'],         introducedIn: '6th', category: 'multiplication' },

  // ── Division ───────────────────────────────────────────────────────────────
  'div.basic':           { id: 'div.basic',           label: 'Divide by 2–5',                 prerequisites: ['mul.tables.easy'],    introducedIn: '3rd', category: 'division' },
  'div.tables':          { id: 'div.tables',          label: 'Divide using tables',           prerequisites: ['div.basic', 'mul.tables.mid'], introducedIn: '4th', category: 'division' },
  'div.large':           { id: 'div.large',           label: 'Divide larger numbers',         prerequisites: ['div.tables'],         introducedIn: '5th', category: 'division' },

  // ── Number sense / counting ────────────────────────────────────────────────
  'count.objects':       { id: 'count.objects',       label: 'Count objects',                 prerequisites: [],                     introducedIn: '1st', category: 'counting' },
  'count.skip':          { id: 'count.skip',          label: 'Skip counting',                 prerequisites: ['count.objects'],      introducedIn: '1st', category: 'counting' },
  'numsense.compare':    { id: 'numsense.compare',    label: 'Compare and order numbers',     prerequisites: ['count.objects'],      introducedIn: '1st', category: 'number_sense' },

  // ── Number sense (docs/14 §6) ──────────────────────────────────────────────
  // Positioned as PREREQUISITES rather than extras. That is what makes them
  // real: the scheduler already routes to a weak prerequisite when a downstream
  // skill fails, so a child who cannot estimate will be sent to estimation
  // automatically when their 3-digit addition falls apart — using machinery
  // that already exists, with no new routing code.
  'numsense.estimate':   { id: 'numsense.estimate',   label: 'Estimate before calculating',   prerequisites: ['numsense.compare'],   introducedIn: '2nd', category: 'number_sense' },
  'numsense.reasonable': { id: 'numsense.reasonable', label: 'Is the answer sensible?',       prerequisites: ['numsense.estimate'],  introducedIn: '3rd', category: 'number_sense' },

  // ── Patterns (NCERT Ch. 1) and symmetry (Ch. 9) — docs/14 §8 ──────────────
  // Patterns is a prerequisite of algebra: generalising a sequence is the entry
  // point to algebraic reasoning, and NCERT places it as Chapter 1 for exactly
  // that reason.
  'patterns.basic':      { id: 'patterns.basic',      label: 'Number patterns',               prerequisites: ['numsense.compare'],   introducedIn: '1st', category: 'number_sense' },
  'symmetry.basic':      { id: 'symmetry.basic',      label: 'Lines of symmetry',             prerequisites: ['shapes.basic'],       introducedIn: '3rd', category: 'shapes' },
  'placevalue':          { id: 'placevalue',          label: 'Place value',                   prerequisites: ['numsense.compare'],   introducedIn: '2nd', category: 'place_value' },

  // ── Fractions / decimals ───────────────────────────────────────────────────
  'frac.ofAmount':       { id: 'frac.ofAmount',       label: 'Fractions of an amount',        prerequisites: ['div.basic'],          introducedIn: '3rd', category: 'fractions' },
  'frac.equivalence':    { id: 'frac.equivalence',    label: 'Equivalent fractions',          prerequisites: ['frac.ofAmount'],      introducedIn: '4th', category: 'fractions' },
  'frac.addSameDenom':   { id: 'frac.addSameDenom',   label: 'Add fractions (same denominator)', prerequisites: ['frac.equivalence'], introducedIn: '4th', category: 'fractions' },
  'dec.tenths':          { id: 'dec.tenths',          label: 'Decimals — tenths',             prerequisites: ['placevalue'],         introducedIn: '4th', category: 'decimals' },
  'dec.hundredths':      { id: 'dec.hundredths',      label: 'Decimals — hundredths',         prerequisites: ['dec.tenths'],         introducedIn: '5th', category: 'decimals' },

  // ── Later topics ───────────────────────────────────────────────────────────
  'percent.basic':       { id: 'percent.basic',       label: 'Percentages',                   prerequisites: ['frac.equivalence', 'dec.tenths'], introducedIn: '5th', category: 'percentages' },
  'ratio.basic':         { id: 'ratio.basic',         label: 'Ratio',                         prerequisites: ['frac.equivalence'],   introducedIn: '5th', category: 'ratio' },
  'factors.basic':       { id: 'factors.basic',       label: 'Factors, primes, HCF and LCM',  prerequisites: ['mul.tables.full'],    introducedIn: '4th', category: 'factors' },
  'geometry.basic':      { id: 'geometry.basic',      label: 'Area, perimeter and angles',    prerequisites: ['mul.tables.mid'],     introducedIn: '3rd', category: 'geometry' },
  'measurement.basic':   { id: 'measurement.basic',   label: 'Measurement and units',         prerequisites: ['placevalue'],         introducedIn: '2nd', category: 'measurement' },
  'data.basic':          { id: 'data.basic',          label: 'Mean, median, mode and range',  prerequisites: ['div.tables'],         introducedIn: '5th', category: 'data' },
  'integers.basic':      { id: 'integers.basic',      label: 'Positive and negative numbers', prerequisites: ['sub.3digit'],         introducedIn: '6th', category: 'integers' },
  'algebra.basic':       { id: 'algebra.basic',       label: 'Find the unknown value',        prerequisites: ['mul.tables.full', 'patterns.basic'], introducedIn: '6th', category: 'algebra' },
  'wordproblems':        { id: 'wordproblems',        label: 'Word problems',                 prerequisites: ['add.2digit.carry', 'mul.tables.mid', 'numsense.reasonable'], introducedIn: '3rd', category: 'word_problems' },
  'shapes.basic':        { id: 'shapes.basic',        label: 'Shapes',                        prerequisites: [],                     introducedIn: '1st', category: 'shapes' },
  'time.basic':          { id: 'time.basic',          label: 'Telling the time',              prerequisites: ['count.objects'],      introducedIn: '1st', category: 'time' },
  'money.basic':         { id: 'money.basic',         label: 'Money and change',              prerequisites: ['add.within20'],       introducedIn: '1st', category: 'money' },
};

export const ALL_SKILL_IDS: SkillId[] = Object.keys(SKILLS);

/**
 * Resolve the specific skill a question exercises.
 *
 * The arithmetic categories branch on class + difficulty because those are the
 * dimensions along which the generators actually vary the demand. Everything
 * else maps one-to-one.
 */
export function resolveSkill(cls: SchoolClass, cat: Category, diff: Difficulty): SkillId {
  switch (cat) {
    case 'addition':
      if (cls === '1st') return diff === 'easy' ? 'add.within10' : 'add.within20';
      if (cls === '2nd') return diff === 'easy' ? 'add.2digit.nocarry' : 'add.2digit.carry';
      if (cls === '3rd') return diff === 'hard' ? 'add.3digit' : 'add.2digit.carry';
      if (cls === '4th') return 'add.3digit';
      return 'add.large';

    case 'subtraction':
      if (cls === '1st') return diff === 'easy' ? 'sub.within10' : 'sub.within20';
      if (cls === '2nd') return diff === 'easy' ? 'sub.2digit.noborrow' : 'sub.2digit.borrow';
      if (cls === '3rd') return diff === 'hard' ? 'sub.3digit' : 'sub.2digit.borrow';
      if (cls === '4th') return 'sub.3digit';
      return 'sub.large';

    case 'multiplication':
      if (cls === '1st' || cls === '2nd') return 'mul.tables.easy';
      if (cls === '3rd') return diff === 'hard' ? 'mul.tables.full' : 'mul.tables.mid';
      if (cls === '4th') return diff === 'easy' ? 'mul.tables.full' : 'mul.2digit';
      if (cls === '5th') return diff === 'easy' ? 'mul.tables.full' : 'mul.2digit';
      return 'mul.large';

    case 'division':
      if (cls === '3rd') return 'div.basic';
      if (cls === '4th') return 'div.tables';
      return 'div.large';

    case 'tables':        return 'mul.tables.mid';
    case 'counting':      return diff === 'hard' ? 'count.skip' : 'count.objects';
    case 'number_sense':
      // Difficulty selects the strand: comparing is the entry point, estimation
      // the core skill, reasonableness the metacognitive step above it.
      if (diff === 'easy') return 'numsense.compare';
      return diff === 'hard' ? 'numsense.reasonable' : 'numsense.estimate';
    case 'place_value':   return 'placevalue';
    case 'fractions':
      if (cls === '3rd') return 'frac.ofAmount';
      return diff === 'easy' ? 'frac.equivalence' : 'frac.addSameDenom';
    case 'decimals':      return diff === 'hard' ? 'dec.hundredths' : 'dec.tenths';
    case 'percentages':   return 'percent.basic';
    case 'ratio':         return 'ratio.basic';
    case 'factors':       return 'factors.basic';
    case 'geometry':      return 'geometry.basic';
    case 'measurement':   return 'measurement.basic';
    case 'data':          return 'data.basic';
    case 'integers':      return 'integers.basic';
    case 'algebra':       return 'algebra.basic';
    case 'word_problems': return 'wordproblems';
    case 'shapes':        return diff === 'hard' ? 'symmetry.basic' : 'shapes.basic';
    case 'time':          return 'time.basic';
    case 'money':         return 'money.basic';
    // `mixed` is always resolved to a concrete category before reaching here.
    case 'mixed':         return 'wordproblems';
  }
}

/** Every skill belonging to a category, ordered by introduction. */
export function skillsForCategory(cat: Category): SkillId[] {
  return ALL_SKILL_IDS.filter(id => SKILLS[id].category === cat);
}

/** Transitive prerequisite closure, nearest first. Cycle-safe. */
export function prerequisiteClosure(id: SkillId): SkillId[] {
  const out: SkillId[] = [];
  const seen = new Set<SkillId>([id]);
  const queue = [...(SKILLS[id]?.prerequisites ?? [])];
  while (queue.length) {
    const next = queue.shift()!;
    if (seen.has(next) || !SKILLS[next]) continue;
    seen.add(next);
    out.push(next);
    queue.push(...SKILLS[next].prerequisites);
  }
  return out;
}
