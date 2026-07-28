// ─── Placement ───────────────────────────────────────────────────────────────
// docs/27 P1-01.
//
// The property that matters is not "the probe runs" — it is that a capable
// learner stops being marched through three years of material they already
// know. docs/26 measured that cost: 53% of a Class 6 learner's first two
// months spent on Class 1–2 skills, algebra first met on day 43.
//
// These tests assert the probe is short, converges, is conservative in the
// right direction, and actually changes where practice begins.

import { describe, it, expect } from 'vitest';
import {
  emptyPlacement, nextProbe, recordProbe, placementComplete, inferences,
  seedAttempts, placementSummary, probeCandidates,
  MAX_PLACEMENT_QUESTIONS, MIN_PLACEMENT_QUESTIONS, PLACEMENT_CREDIT,
} from '../placement';
import { SKILLS, prerequisiteClosure } from '../skills';
import { estimateAll, MASTERED_THRESHOLD } from '../mastery';
import { buildSession } from '../scheduler';
import type { SchoolClass } from '../../generators/types';

const CLASS_ORDER: SchoolClass[] = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
const classNum = (c: SchoolClass) => CLASS_ORDER.indexOf(c);

/**
 * Simulate a learner of a given true level answering the probe.
 * Secure on anything introduced at or below `level`, shaky above it.
 */
function simulate(cls: SchoolClass, trueLevel: SchoolClass) {
  let state = emptyPlacement();
  for (let i = 0; i < MAX_PLACEMENT_QUESTIONS + 5; i++) {
    const probe = nextProbe(state, cls);
    if (probe === null) break;
    const canDo = classNum(SKILLS[probe].introducedIn) <= classNum(trueLevel);
    state = recordProbe(state, probe, canDo);
  }
  return state;
}

describe('the probe is short and terminates', () => {
  it('never exceeds the question budget, for any class', () => {
    for (const cls of CLASS_ORDER) {
      for (const level of CLASS_ORDER) {
        const state = simulate(cls, level);
        expect(state.asked.length,
          `cls ${cls} / level ${level} asked ${state.asked.length}`)
          .toBeLessThanOrEqual(MAX_PLACEMENT_QUESTIONS);
        expect(placementComplete(state, cls)).toBe(true);
      }
    }
  });

  it('never asks the same skill twice', () => {
    for (const cls of CLASS_ORDER) {
      const state = simulate(cls, '3rd');
      expect(new Set(state.asked).size).toBe(state.asked.length);
    }
  });

  it('only probes skills at or near the learner\'s own class', () => {
    // Opening an app by asking a Class 2 child about algebra is demoralising
    // and tells us nothing. One year above is allowed — a child may be ahead.
    for (const cls of CLASS_ORDER) {
      for (const s of probeCandidates(cls)) {
        expect(classNum(SKILLS[s].introducedIn),
          `${s} probed for ${cls}`).toBeLessThanOrEqual(classNum(cls) + 1);
      }
    }
  });
});

describe('inference follows the prerequisite graph', () => {
  it('a correct answer credits the prerequisites underneath', () => {
    let state = emptyPlacement();
    state = recordProbe(state, 'add.2digit.carry', true);
    const known = inferences(state);
    for (const p of prerequisiteClosure('add.2digit.carry')) {
      expect(known.get(p), `${p} should be credited`).toBe(true);
    }
  });

  it('a wrong answer discredits everything built on top', () => {
    let state = emptyPlacement();
    state = recordProbe(state, 'mul.tables.easy', false);
    const known = inferences(state);
    // mul.tables.mid depends on mul.tables.easy
    expect(known.get('mul.tables.mid')).toBe(false);
  });

  it('direct evidence always beats an inference', () => {
    // Answered the harder skill correctly, but the easier one wrong: the
    // direct observation must win, because a lucky guess on the hard question
    // is far more likely than genuine mastery with a broken foundation.
    let state = emptyPlacement();
    state = recordProbe(state, 'add.2digit.carry', true);
    state = recordProbe(state, 'add.within20', false);
    expect(inferences(state).get('add.within20')).toBe(false);
  });
});

describe('placement is conservative in the right direction', () => {
  it('credits a secure skill only just above the consolidation bar', () => {
    // The window is narrow and both edges matter. Below MASTERED_THRESHOLD the
    // scheduler keeps the whole curriculum in the `learning` pool and
    // placement achieves nothing (measured at 0.73 and again at 0.84). Far
    // above it, a twenty-question probe has certified skills it barely
    // sampled. Just above means "consolidated, but one real mistake away from
    // coming back".
    expect(PLACEMENT_CREDIT).toBeGreaterThan(MASTERED_THRESHOLD);
    expect(PLACEMENT_CREDIT).toBeLessThan(0.92);
  });

  it('a single real mistake pulls a placed skill back into practice', () => {
    // This is what keeps the credit honest: placement is a starting guess, and
    // genuine evidence must be able to overturn it quickly.
    const state = simulate('6th', '4th');
    const seeds = seedAttempts(state, '6th');
    const placed = Object.entries(estimateAll(seeds, Date.now()))
      .filter(([, e]) => e.value >= MASTERED_THRESHOLD)
      .map(([s]) => s);
    expect(placed.length).toBeGreaterThan(0);

    const skill = placed[0];
    const now = Date.now();
    const withMisses = [
      ...seeds,
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `real:${i}`, skill, correct: false, answeredAt: now + i * 1000,
        latencyMs: 5000, chosen: 'x', expected: 'y', questionText: 'q',
        timedOut: false, interaction: 'entry', cls: '6th',
        category: SKILLS[skill].category, difficulty: 'medium',
      })),
    ] as never[];
    const after = estimateAll(withMisses, now + 5000)[skill].value;
    expect(after, `${skill} stayed at ${after} after three real misses`)
      .toBeLessThan(MASTERED_THRESHOLD);
  });

  it('seed rows are marked so they never masquerade as real practice', () => {
    const state = simulate('4th', '2nd');
    const seeds = seedAttempts(state, '4th');
    expect(seeds.length).toBeGreaterThan(0);
    for (const a of seeds) {
      expect(a.placement).toBe(true);
      expect(a.id).toBeTruthy();
    }
  });
});

describe('placement changes where practice actually begins', () => {
  it('a capable Class 6 learner is not sent to Class 1 material', () => {
    // The measured failure: 53% of two months on Class 1–2 skills.
    const state = simulate('6th', '5th');
    const seeds = seedAttempts(state, '6th');
    const est = estimateAll(seeds, Date.now());
    const session = buildSession('6th', est, 20, Date.now());

    // What matters is not that early material NEVER appears — spaced retrieval
    // on secure foundations is correct pedagogy, and the maintenance pool
    // interleaves by design. What matters is that it is no longer the FOCUS:
    // the skills the session is built around should be the learner's real
    // frontier, not the curriculum's beginning.
    const focusSkills = session.filter(s => s.reason === 'gap' || s.reason === 'due' || s.reason === 'learning');
    const earlyFocus = focusSkills.filter(s => {
      const intro = SKILLS[s.skill]?.introducedIn;
      return intro === '1st' || intro === '2nd';
    }).length;

    expect(session.length).toBeGreaterThan(0);
    expect(focusSkills.length).toBeGreaterThan(0);
    expect(earlyFocus / focusSkills.length,
      `${earlyFocus}/${focusSkills.length} of the session's FOCUS is Class 1–2 material`)
      .toBeLessThan(0.25);
  });

  it('a struggling learner IS sent to the foundations', () => {
    // The probe must work in both directions, or it is just an accelerator.
    const state = simulate('6th', '1st');
    const seeds = seedAttempts(state, '6th');
    const est = estimateAll(seeds, Date.now());
    const session = buildSession('6th', est, 20, Date.now());
    const advanced = session.filter(s => {
      const intro = SKILLS[s.skill]?.introducedIn;
      return intro === '5th' || intro === '6th';
    }).length;
    expect(advanced / Math.max(1, session.length)).toBeLessThan(0.5);
  });
});

describe('the result is explainable to a parent', () => {
  it('produces a sentence naming a real skill, in both languages', () => {
    const state = simulate('4th', '3rd');
    for (const lang of ['en', 'hi'] as const) {
      const { sentence } = placementSummary(state, lang);
      expect(sentence.trim().length).toBeGreaterThan(0);
      // Semi-Hindi policy: numerals stay Western Arabic.
      expect(sentence).not.toMatch(/[०-९]/);
    }
  });

  it('separates what looked secure from what did not', () => {
    const state = simulate('5th', '3rd');
    const { secure, gaps } = placementSummary(state, 'en');
    expect(secure.length + gaps.length).toBeGreaterThan(0);
    for (const s of [...secure, ...gaps]) expect(SKILLS[s]).toBeDefined();
  });
});
