// Structural guard against the A1 defect returning.
//
// Contrast tests prove the palette is sound. They cannot prove the palette is
// USED soundly — a future change could still render a correct/wrong state as a
// bare colour swap. These tests read the source of the state-bearing components
// and assert that every one of them also emits a non-colour signal.
//
// Source-reading tests are usually a smell. Here it is justified: the property
// under test ("no state is conveyed by colour alone") is a whole-file property
// that a render test would only cover for the specific states it happens to
// exercise, and this is an equity defect that affects ~1 in 12 boys.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('state-bearing components never signal with colour alone', () => {
  const components = [
    'components/ui/AnswerTile.tsx',
    'components/ui/StateBadge.tsx',
  ];

  for (const file of components) {
    it(`${file} exists`, () => {
      expect(existsSync(join(root, file)), `${file} is missing`).toBe(true);
    });

    it(`${file} renders an icon alongside colour`, () => {
      const src = read(file);
      expect(src, 'no Feather icon found').toMatch(/Feather/);
    });

    it(`${file} exposes the outcome to screen readers in words`, () => {
      const src = read(file);
      expect(src).toMatch(/accessibilityLabel|accessibilityRole/);
    });
  }

  it('AnswerTile distinguishes "revealed" from "correct"', () => {
    // After a miss, the child must be able to tell the right answer apart from
    // the answer they chose. Colouring both green destroys that distinction.
    const src = read('components/ui/AnswerTile.tsx');
    expect(src).toMatch(/revealed/);
    // Revealed is outlined (surface background), correct is filled (soft tint).
    expect(src).toMatch(/revealed:\s*\{\s*bg:\s*c\.surface/);
    expect(src).toMatch(/correct:\s*\{\s*bg:\s*c\.correctSoft/);
  });

  it('AnswerTile meets the child touch-target minimum', () => {
    const src = read('components/ui/AnswerTile.tsx');
    expect(src).toMatch(/minHeight:\s*touch\.answerTile/);
  });
});

describe('the legacy inverted palette is no longer the source of truth', () => {
  it('the theme layer does not import constants/colors', () => {
    // Mentioning the old module in a comment is fine — depending on it is not.
    for (const f of ['theme/tokens.ts', 'theme/useTheme.tsx']) {
      const imports = read(f).match(/^\s*import[^;]+;/gm) ?? [];
      expect(imports.join('\n'), f).not.toMatch(/constants\/colors/);
    }
  });

  it('new UI components use the theme hook, not a module-scope palette', () => {
    // `const C = colors.light` at module scope is the specific pattern that
    // made theming impossible: styles froze at import time, before any
    // preference could be read.
    for (const f of ['components/ui/AnswerTile.tsx', 'components/ui/StateBadge.tsx']) {
      const src = read(f);
      expect(src, `${f} hardcodes a palette`).not.toMatch(/const\s+C\s*=\s*colors\./);
      expect(src, `${f} does not use useTheme`).toMatch(/useTheme\(\)/);
    }
  });
});
