// ─── Self-explanation ────────────────────────────────────────────────────────
// docs/27 P1-13.
//
// Two failure modes to guard against, in opposite directions:
//
//   · never firing   — the feature exists on paper and no child meets it
//   · always firing  — a struggling learner's session becomes an interrogation
//
// The prompt must also be a genuine discrimination: three plausible reasonings
// about the same mathematics, not one real option padded with nonsense.

import { describe, it, expect } from 'vitest';
import {
  shouldAskWhy, buildWhyPrompt, whyFeedback,
  SE_MAX_PER_SESSION, SE_OPTION_COUNT,
} from '../selfExplanation';
import { MISCONCEPTIONS } from '../misconceptions';
import { MISCONCEPTIONS_HI } from '../../i18n/misconceptions-hi';
import { SKILLS } from '../skills';
import type { Attempt } from '../attempts';

const mk = (skill: string, i: number): Attempt => ({
  id: `t:${i}`, skill, correct: false, answeredAt: 1_700_000_000_000 + i * 1000,
  latencyMs: 5000, chosen: 'x', expected: 'y', questionText: 'q',
  timedOut: false, cls: '4th', category: 'addition', difficulty: 'medium',
} as Attempt);

/** A misconception that genuinely applies to the given skill. */
function realFor(skill: string): string {
  const m = Object.values(MISCONCEPTIONS).find(x => x.skills.includes(skill));
  return m!.id;
}

describe('the prompt fires on real errors', () => {
  it('asks when a misconception was diagnosed', () => {
    const skill = 'add.2digit.carry';
    expect(shouldAskWhy({
      misconception: realFor(skill), skill, sessionLog: [], shownThisSession: 0,
    })).toBe(true);
  });

  it('stays silent on a slip with no diagnosis', () => {
    // A careless mistake has no reasoning worth retrieving.
    expect(shouldAskWhy({
      misconception: null, skill: 'add.2digit.carry', sessionLog: [], shownThisSession: 0,
    })).toBe(false);
  });

  it('stays silent on guessing and on migrated rows', () => {
    for (const m of ['guessing', 'legacy-import']) {
      expect(shouldAskWhy({
        misconception: m, skill: 'add.2digit.carry', sessionLog: [], shownThisSession: 0,
      }), m).toBe(false);
    }
  });
});

describe('the prompt stays rare', () => {
  it('is capped per session', () => {
    const skill = 'add.2digit.carry';
    expect(shouldAskWhy({
      misconception: realFor(skill), skill, sessionLog: [],
      shownThisSession: SE_MAX_PER_SESSION,
    })).toBe(false);
  });

  it('respects the per-skill cooldown', () => {
    // The same question twice in five minutes is nagging, and the second
    // answer is a guess rather than a reflection.
    const skill = 'add.2digit.carry';
    const log = Array.from({ length: 20 }, (_, i) => mk(skill, i));
    expect(shouldAskWhy({
      misconception: realFor(skill), skill, sessionLog: log, shownThisSession: 0,
    })).toBe(false);
  });

  it('a long session on OTHER skills does not block the prompt', () => {
    const log = Array.from({ length: 20 }, (_, i) => mk('sub.3digit', i));
    expect(shouldAskWhy({
      misconception: realFor('add.2digit.carry'), skill: 'add.2digit.carry',
      sessionLog: log, shownThisSession: 0,
    })).toBe(true);
  });
});

describe('the options are a genuine discrimination', () => {
  const noShuffle = <T,>(xs: T[]) => xs;

  it('offers the true diagnosis plus plausible alternatives', () => {
    for (const skill of Object.keys(SKILLS)) {
      const truth = Object.values(MISCONCEPTIONS).find(m => m.skills.includes(skill));
      if (!truth) continue;
      const p = buildWhyPrompt({ skill, misconception: truth.id, shuffle: noShuffle });
      expect(p, skill).not.toBeNull();
      expect(p!.options.length, `${skill} option count`).toBe(SE_OPTION_COUNT);
      // Exactly one option is the real diagnosis.
      expect(p!.options.filter(o => o.correct).length, `${skill}`).toBe(1);
      // Every option is distinct and non-empty.
      expect(new Set(p!.options.map(o => o.id)).size).toBe(p!.options.length);
      for (const o of p!.options) {
        expect(o.text.en.trim().length, `${skill} empty en`).toBeGreaterThan(0);
        expect(o.text.hi.trim().length, `${skill} empty hi`).toBeGreaterThan(0);
      }
    }
  });

  it('always offers "I just slipped"', () => {
    // Without it the prompt forces a child to claim a conceptual error they
    // may not have made — annoying, and it pollutes the signal.
    const skill = 'add.2digit.carry';
    const p = buildWhyPrompt({ skill, misconception: realFor(skill), shuffle: noShuffle })!;
    expect(p.options.some(o => o.id === 'slip')).toBe(true);
  });

  it('prefers distractors from the same skill', () => {
    // Choosing between reasonings about the same mathematics is a genuine
    // discrimination; choosing between one real option and two irrelevant
    // ones is a reading exercise.
    const skill = 'sub.2digit.borrow';
    const sameSkill = Object.values(MISCONCEPTIONS).filter(m => m.skills.includes(skill));
    if (sameSkill.length < 2) return;
    const p = buildWhyPrompt({ skill, misconception: sameSkill[0].id, shuffle: noShuffle })!;
    const distractor = p.options.find(o => !o.correct && o.id !== 'slip');
    expect(distractor).toBeDefined();
    expect(MISCONCEPTIONS[distractor!.id].skills).toContain(skill);
  });

  it('returns null for an unknown misconception rather than a broken prompt', () => {
    expect(buildWhyPrompt({ skill: 'add.within10', misconception: 'not-a-real-id' })).toBeNull();
  });
});

describe('feedback never tells a child they were wrong about being wrong', () => {
  const noShuffle = <T,>(xs: T[]) => xs;
  const skill = 'add.2digit.carry';
  const prompt = () => buildWhyPrompt({ skill, misconception: realFor(skill), shuffle: noShuffle })!;

  it('confirms a correct self-diagnosis', () => {
    const p = prompt();
    const right = p.options.find(o => o.correct)!;
    for (const lang of ['en', 'hi'] as const) {
      expect(whyFeedback(right, p, lang).length).toBeGreaterThan(0);
    }
    expect(whyFeedback(right, p, 'en').toLowerCase()).toContain('exactly');
  });

  it('accepts "I slipped" without contradiction', () => {
    const p = prompt();
    const slip = p.options.find(o => o.id === 'slip')!;
    const out = whyFeedback(slip, p, 'en').toLowerCase();
    expect(out).not.toContain('wrong');
    expect(out).not.toContain('no,');
  });

  it('names the real cause without saying "wrong"', () => {
    const p = prompt();
    const other = p.options.find(o => !o.correct && o.id !== 'slip');
    if (!other) return;
    const out = whyFeedback(other, p, 'en').toLowerCase();
    expect(out).not.toContain('wrong');
    expect(out).not.toContain('incorrect');
    // Identifying your own error imperfectly is still reflection.
    expect(out).toContain('good thinking');
  });
});

describe('self-explanation is bilingual', () => {
  it('renders option labels in Hindi, not English', () => {
    // The regression: `hi: truth.label` copied the ENGLISH label into the Hindi
    // slot, so a Hindi-medium child met a Hindi prompt with English options —
    // "Miscounting by one" sitting next to "मुझे आता था — बस चूक हो गई".
    // The translations existed for all 47 misconceptions; nothing used them.
    const ids = Object.keys(MISCONCEPTIONS).filter(
      id => id !== 'guessing' && id !== 'legacy-import',
    );
    let checked = 0;
    for (const id of ids) {
      const skill = MISCONCEPTIONS[id].skills[0];
      if (!skill) continue;
      const prompt = buildWhyPrompt({ skill, misconception: id });
      if (!prompt) continue;
      for (const o of prompt.options) {
        const hiTranslation = MISCONCEPTIONS_HI[o.id];
        if (!hiTranslation) continue;         // the slip option is hand-written
        expect(o.text.hi, `${o.id} hi label`).toBe(hiTranslation.label);
        expect(o.text.hi, `${o.id} untranslated`).not.toBe(MISCONCEPTIONS[o.id].label);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('every Hindi option is actually Devanagari', () => {
    const id = 'count.miscount-by-one';
    const prompt = buildWhyPrompt({ skill: MISCONCEPTIONS[id].skills[0], misconception: id });
    expect(prompt).not.toBeNull();
    for (const o of prompt!.options) {
      expect(o.text.hi, `${o.id}`).toMatch(/[\u0900-\u097F]/);
    }
  });
});
