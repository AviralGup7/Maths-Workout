import { describe, it, expect } from 'vitest';
import { SKILL_LABELS_HI, skillLabel } from '../skills-hi';
import { SKILLS } from '../../learning/skills';
import { HIGH_CONTRAST, LIGHT, DARK, PALETTES } from '../../theme/tokens';

describe('Hindi skill labels', () => {
  it('covers every skill in the graph', () => {
    // docs/28 item 39 put skill names on the question screen, where a
    // Hindi-medium child now sees one every few seconds. A missing entry is
    // an English word in the middle of a Hindi interface.
    const missing = Object.keys(SKILLS).filter(id => !SKILL_LABELS_HI[id]);
    expect(missing, `untranslated skills: ${missing.join(', ')}`).toEqual([]);
  });

  it('has no orphan translations', () => {
    // A label for a skill that no longer exists is dead weight that looks
    // like coverage.
    const orphans = Object.keys(SKILL_LABELS_HI).filter(id => !SKILLS[id]);
    expect(orphans, `orphan labels: ${orphans.join(', ')}`).toEqual([]);
  });

  it('keeps numerals Western Arabic — the semi-Hindi rule', () => {
    for (const [id, label] of Object.entries(SKILL_LABELS_HI)) {
      expect(label, `${id} uses Devanagari numerals`).not.toMatch(/[०-९]/);
    }
  });

  it('actually translates rather than copying the English', () => {
    // A map filled by copy-paste would pass the coverage test and change
    // nothing on screen.
    let translated = 0;
    for (const [id, hi] of Object.entries(SKILL_LABELS_HI)) {
      if (hi !== SKILLS[id]?.label) translated++;
    }
    expect(translated).toBeGreaterThan(Object.keys(SKILL_LABELS_HI).length - 5);
  });

  it('falls back to English rather than an id', () => {
    // A skill added without a translation must degrade to a readable English
    // word, never to `add.2digit.carry` on the question screen.
    expect(skillLabel('does.not.exist', 'Fallback Label', 'hi')).toBe('Fallback Label');
    expect(skillLabel('add.within10', 'Add within 10', 'en')).toBe('Add within 10');
    expect(skillLabel('add.within10', 'Add within 10', 'hi')).toBe('10 तक जोड़');
  });
});

describe('high contrast theme', () => {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  it('is registered as a selectable palette', () => {
    expect(PALETTES.highContrast).toBe(HIGH_CONTRAST);
  });

  it('clears WCAG AAA (7:1) for body text, not merely AA', () => {
    // The whole point of the theme. AA would just be "the light theme again".
    expect(ratio(HIGH_CONTRAST.text, HIGH_CONTRAST.bg)).toBeGreaterThanOrEqual(7);
    expect(ratio(HIGH_CONTRAST.text, HIGH_CONTRAST.surface)).toBeGreaterThanOrEqual(7);
    expect(ratio(HIGH_CONTRAST.textMuted, HIGH_CONTRAST.surface)).toBeGreaterThanOrEqual(7);
  });

  it('beats both standard themes on muted text', () => {
    const hc = ratio(HIGH_CONTRAST.textMuted, HIGH_CONTRAST.surface);
    expect(hc).toBeGreaterThan(ratio(LIGHT.textMuted, LIGHT.surface));
    expect(hc).toBeGreaterThan(ratio(DARK.textMuted, DARK.surface));
  });

  it('keeps semantic colours distinguishable and legible', () => {
    // Correct and wrong must survive both low acuity and colour blindness, so
    // they need luminance separation from each other AND contrast on their
    // own surfaces.
    expect(ratio(HIGH_CONTRAST.correct, HIGH_CONTRAST.surface)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(HIGH_CONTRAST.wrong, HIGH_CONTRAST.surface)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(HIGH_CONTRAST.correct, HIGH_CONTRAST.wrong)).toBeGreaterThan(1.8);
  });

  it('uses full-strength borders, because structure carries meaning here', () => {
    // At low acuity a 1.6-ratio edge does not exist and cards merge together.
    expect(ratio(HIGH_CONTRAST.border, HIGH_CONTRAST.surface)).toBeGreaterThanOrEqual(7);
  });
});
