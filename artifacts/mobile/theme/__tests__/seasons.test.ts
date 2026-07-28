import { describe, it, expect } from 'vitest';
import { seasonFor, seasonGreeting } from '../seasons';
import { grade, expectedAnswer, manipulativeQuestion } from '../../generators/interactions';

describe('seasonal accents', () => {
  it('recognises the festivals it claims to', () => {
    expect(seasonFor(new Date('2026-10-25'))?.id).toBe('diwali');
    expect(seasonFor(new Date('2026-11-08'))?.id).toBe('diwali');
    expect(seasonFor(new Date('2026-03-10'))?.id).toBe('holi');
    expect(seasonFor(new Date('2026-07-15'))?.id).toBe('monsoon');
    expect(seasonFor(new Date('2026-05-02'))?.id).toBe('summer');
    expect(seasonFor(new Date('2026-01-02'))?.id).toBe('newYear');
  });

  it('leaves ordinary weeks alone', () => {
    // A season that is always on is not a season — it is just a colour.
    expect(seasonFor(new Date('2026-02-10'))).toBeNull();
    expect(seasonFor(new Date('2026-12-10'))).toBeNull();
  });

  it('greets in both languages, with Western Arabic numerals', () => {
    for (const d of ['2026-10-25', '2026-03-10', '2026-07-15', '2026-05-02', '2026-01-02']) {
      const hi = seasonGreeting(new Date(d), 'hi');
      const en = seasonGreeting(new Date(d), 'en');
      expect(hi, d).toBeTruthy();
      expect(en, d).toBeTruthy();
      expect(hi, `${d} must be Devanagari`).toMatch(/[\u0900-\u097F]/);
      expect(hi, `${d} semi-Hindi numeral rule`).not.toMatch(/[०-९]/);
      expect(hi).not.toBe(en);
    }
  });

  it('never touches the semantic or surface palette', () => {
    // A season may change an ACCENT and a GREETING. If it could change
    // correct/wrong or a text colour it would break contrast guarantees twice
    // a year and force a child to relearn what green means.
    for (const d of ['2026-10-25', '2026-03-10', '2026-07-15']) {
      const s = seasonFor(new Date(d))!;
      expect(Object.keys(s).sort()).toEqual(['accent', 'greeting', 'id']);
    }
  });

  it('is a pure function of the date', () => {
    const d = new Date('2026-10-25');
    const first = seasonFor(d)?.id;
    for (let i = 0; i < 20; i++) expect(seasonFor(d)?.id).toBe(first);
  });
});

describe('manipulative interaction', () => {
  it('grades the built quantity, not a separate answer', () => {
    // The property that makes this a manipulative rather than an illustration:
    // placing seven counters IS answering, so the submitted count is graded
    // directly through the shared pipeline.
    const q = manipulativeQuestion('Show 7 counters', 7);
    expect(q.interaction?.kind).toBe('manipulative');
    expect(expectedAnswer(q)).toBe('7');
    expect(grade(q, '7')).toBe(true);
    expect(grade(q, '6')).toBe(false);
    expect(grade(q, '8')).toBe(false);
  });

  it('sizes the frame to the target', () => {
    // Ten-frame for single digits, double frame past ten. A 7 rendered on a
    // 20-cell frame loses the "three short of ten" reading that is the whole
    // point of the model.
    const small = manipulativeQuestion('Show 7', 7).interaction as { max: number };
    const large = manipulativeQuestion('Show 14', 14).interaction as { max: number };
    expect(small.max).toBe(10);
    expect(large.max).toBe(20);
  });

  it('is reachable from the interaction union and the attempt log', () => {
    const q = manipulativeQuestion('Show 5', 5);
    // Round-trips through the same normalisation every other kind uses.
    expect(grade(q, expectedAnswer(q))).toBe(true);
  });
});
