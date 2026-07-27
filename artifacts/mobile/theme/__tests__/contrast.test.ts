// Accessibility guarantees for the palette, asserted in CI.
//
// docs/17 §0 recorded these as one-off audit findings. Encoding them as tests
// is the difference between "we fixed it once" and "it stays fixed": a future
// colour change that reintroduces an inaccessible pair now fails the build.

import { describe, it, expect } from 'vitest';
import {
  contrastRatio, meetsAA, meetsAAA, simulateCvd, worstCaseSeparation,
  distinguishableUnder, WCAG,
} from '../contrast';
import { LIGHT, DARK, PALETTES, STATE_SIGNALS, TYPE, MIN_FONT_SIZE, TOUCH } from '../tokens';

describe('the audit findings are fixed and stay fixed', () => {
  it('A2 · the old brand colour genuinely did fail — this is not a strawman', () => {
    // Regression evidence: #6C63FF on the old dark background/card.
    expect(contrastRatio('#6C63FF', '#0F0F1A')).toBeLessThan(WCAG.AA_NORMAL);
    expect(contrastRatio('#6C63FF', '#1A1A2E')).toBeLessThan(WCAG.AA_NORMAL);
    // And the old border was effectively invisible.
    expect(contrastRatio('#2A2A45', '#1A1A2E')).toBeLessThan(1.5);
  });

  it('A1 · the old correct/wrong pair collapsed under deuteranopia', () => {
    const before = contrastRatio(
      simulateCvd('#4CAF50', 'deuteranopia'),
      simulateCvd('#F44336', 'deuteranopia'),
    );
    // 1.07 — the two states were the same colour for ~1 in 12 boys.
    expect(before).toBeLessThan(1.2);
  });

  it('A1 · the new correct/wrong pair improves on the old one under CVD', () => {
    // Threshold is 1.5, not 2.0, and that is a measured limit rather than a
    // compromise: a search over green/red space found the MAXIMUM achievable
    // worst-case separation for an AA-passing pair is 2.29 — and only for
    // teal/near-black-maroon, which no longer reads as green and red.
    // Constrained to recognisable hues, nothing exceeds ~1.6.
    //
    // This is precisely why colour is not permitted to be load-bearing.
    for (const [name, p] of Object.entries(PALETTES)) {
      const sep = worstCaseSeparation(p.correct, p.wrong);
      expect(sep.ratio, `${name}: worst case is ${sep.kind}`).toBeGreaterThan(1.5);
    }
  });

  it('A1 · correct and wrong differ strongly in LUMINANCE, which dichromats retain', () => {
    // Hue is unreliable; lightness is not. Every dichromacy preserves it, so a
    // luminance gap is the one chromatic cue that survives.
    for (const [name, p] of Object.entries(PALETTES)) {
      expect(contrastRatio(p.correct, p.wrong), name).toBeGreaterThan(2.0);
    }
  });

  it('A1 · the new pair beats the old pair under every dichromacy', () => {
    for (const kind of ['protanopia', 'deuteranopia', 'tritanopia'] as const) {
      const before = contrastRatio(simulateCvd('#4CAF50', kind), simulateCvd('#F44336', kind));
      const after = contrastRatio(
        simulateCvd(LIGHT.correct, kind), simulateCvd(LIGHT.wrong, kind));
      expect(after, `${kind}: ${before.toFixed(2)} -> ${after.toFixed(2)}`)
        .toBeGreaterThan(before);
    }
  });
});

describe('text contrast', () => {
  const cases: [string, keyof typeof LIGHT, keyof typeof LIGHT][] = [
    ['text on bg', 'text', 'bg'],
    ['text on surface', 'text', 'surface'],
    ['text on surfaceSunken', 'text', 'surfaceSunken'],
    ['textMuted on bg', 'textMuted', 'bg'],
    ['textMuted on surface', 'textMuted', 'surface'],
    ['primary on bg', 'primary', 'bg'],
    ['primary on surface', 'primary', 'surface'],
    ['correct on surface', 'correct', 'surface'],
    ['wrong on surface', 'wrong', 'surface'],
    ['attention on surface', 'attention', 'surface'],
  ];

  for (const [themeName, palette] of Object.entries(PALETTES)) {
    for (const [label, fg, bg] of cases) {
      it(`${themeName}: ${label} meets AA`, () => {
        const ratio = contrastRatio(palette[fg] as string, palette[bg] as string);
        expect(ratio, `got ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(WCAG.AA_NORMAL);
      });
    }

    it(`${themeName}: primary body text reaches AAA`, () => {
      // docs/17 §8 commits to AAA on body text, not merely AA.
      expect(meetsAAA(palette.text, palette.bg)).toBe(true);
      expect(meetsAAA(palette.text, palette.surface)).toBe(true);
    });

    it(`${themeName}: on-colour foregrounds are legible on their fills`, () => {
      expect(meetsAA(palette.primaryOn, palette.primary)).toBe(true);
      expect(meetsAA(palette.correctOn, palette.correct)).toBe(true);
      expect(meetsAA(palette.wrongOn, palette.wrong)).toBe(true);
    });

    it(`${themeName}: soft state fills carry legible text`, () => {
      expect(meetsAA(palette.correct, palette.correctSoft)).toBe(true);
      expect(meetsAA(palette.wrong, palette.wrongSoft)).toBe(true);
      expect(meetsAA(palette.attention, palette.attentionSoft)).toBe(true);
    });

    it(`${themeName}: focus ring meets the non-text threshold`, () => {
      // WCAG 1.4.11 — focus indicators are UI components, 3:1 not 4.5:1.
      expect(contrastRatio(palette.borderStrong, palette.bg))
        .toBeGreaterThanOrEqual(WCAG.AA_NON_TEXT);
      expect(contrastRatio(palette.borderStrong, palette.surface))
        .toBeGreaterThanOrEqual(WCAG.AA_NON_TEXT);
    });
  }
});

describe('no state is signalled by colour alone', () => {
  it('every state carries an icon, a glyph and text', () => {
    for (const [name, sig] of Object.entries(STATE_SIGNALS)) {
      expect(sig.icon, name).toBeTruthy();
      expect(sig.glyph, name).toBeTruthy();
      expect(sig.label.en, name).toBeTruthy();
      expect(sig.label.hi, name).toBeTruthy();
    }
  });

  it('correct and wrong use different icon SHAPES, not just different colours', () => {
    // circle vs square: distinguishable at a glance with no colour perception.
    expect(STATE_SIGNALS.correct.icon).not.toBe(STATE_SIGNALS.wrong.icon);
    expect(STATE_SIGNALS.correct.glyph).not.toBe(STATE_SIGNALS.wrong.glyph);
  });

  it('correct and wrong use different motion signatures', () => {
    expect(STATE_SIGNALS.correct.motion).not.toBe(STATE_SIGNALS.wrong.motion);
  });

  it('the Hindi labels follow the semi-Hindi policy (no Devanagari digits)', () => {
    for (const sig of Object.values(STATE_SIGNALS)) {
      expect(/[\u0966-\u096F]/.test(sig.label.hi)).toBe(false);
    }
  });
});

describe('type and touch scales', () => {
  it('A8 · nothing in the scale renders below the readability floor', () => {
    for (const [role, spec] of Object.entries(TYPE)) {
      expect(spec.size, role).toBeGreaterThanOrEqual(MIN_FONT_SIZE);
    }
  });

  it('body text uses dyslexia-friendly line height', () => {
    expect(TYPE.body.lineHeight).toBeGreaterThanOrEqual(1.5);
  });

  it('A3 · touch targets clear the WCAG minimum with headroom for children', () => {
    expect(TOUCH.min).toBeGreaterThanOrEqual(44);
    expect(TOUCH.answerTile).toBeGreaterThanOrEqual(TOUCH.min);
    expect(TOUCH.primaryButton).toBeGreaterThanOrEqual(TOUCH.min);
    expect(TOUCH.key).toBeGreaterThanOrEqual(TOUCH.min);
    expect(TOUCH.gap).toBeGreaterThanOrEqual(8);
  });
});

describe('contrast maths is correct', () => {
  it('matches known WCAG reference values', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 1);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#4338CA', '#FFFFFF')).toBeCloseTo(contrastRatio('#FFFFFF', '#4338CA'), 6);
  });

  it('greyscale is unchanged by dichromacy simulation', () => {
    // A sanity check on the LMS transform: grey has no chroma to lose.
    const grey = '#808080';
    for (const kind of ['protanopia', 'deuteranopia'] as const) {
      const sim = simulateCvd(grey, kind);
      expect(contrastRatio(grey, sim)).toBeLessThan(1.15);
    }
  });
});
