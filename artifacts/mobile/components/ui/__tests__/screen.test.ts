// Screen primitives and theme migration — docs/20 F1.
//
// The defect this guards against was measured in a browser: the app shipped a
// dark palette and a persisted preference, but 16 files resolved colour at
// module scope (`const C = colors.light`), evaluated once at import, so only
// 2 of 12 screens could honour it. A user enabling dark mode got a half-dark
// application.
//
// Source-reading is justified here: the property is "no module in the tree
// resolves colour at import time", which is a whole-file property a render
// test would only cover for the components it happens to mount.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (['node_modules', '.expo', 'dist', '.ui-build', '__tests__'].includes(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

describe('the legacy palette shim is gone', () => {
  it('constants/colors.ts no longer exists', () => {
    // A temporary shim that outlives its migration becomes a second source of
    // truth — which is exactly how dark mode came to ship broken.
    expect(existsSync(join(ROOT, 'constants/colors.ts'))).toBe(false);
  });

  it('the superseded useColors hook is gone', () => {
    expect(existsSync(join(ROOT, 'hooks/useColors.ts'))).toBe(false);
  });

  it('no module resolves colour at import time', () => {
    const offenders: string[] = [];
    for (const f of walk(join(ROOT, 'app')).concat(walk(join(ROOT, 'components')))) {
      const src = readFileSync(f, 'utf8');
      if (/^const\s+C\s*=\s*colors\./m.test(src)) offenders.push(f);
      if (/^import\s+colors\s+from/m.test(src)) offenders.push(f);
    }
    expect(offenders, `module-scope palettes: ${offenders.join(', ')}`).toEqual([]);
  });

  it('every screen can react to the theme', () => {
    // A screen with no theme access at all renders whatever its parent gives
    // it, which is fine; what must not exist is a screen holding its OWN frozen
    // copy of the palette.
    const screens = walk(join(ROOT, 'app')).filter(f => f.endsWith('.tsx'));
    for (const f of screens) {
      const src = readFileSync(f, 'utf8');
      const holdsPalette = /useLegacyPalette\(\)|useTheme\(\)/.test(src);
      const usesColour = /\bC\.[a-z]/.test(src) || /\bc\.[a-z]/.test(src);
      if (usesColour) {
        expect(holdsPalette, `${f} uses colour without reading the theme`).toBe(true);
      }
    }
  });
});

describe('screen primitives exist and are shared', () => {
  it('Screen and ScreenHeader are available', () => {
    const src = readFileSync(join(ROOT, 'components/ui/Screen.tsx'), 'utf8');
    expect(src).toMatch(/export function Screen\b/);
    expect(src).toMatch(/export function ScreenHeader\b/);
  });

  it('Screen reads the theme reactively rather than at import', () => {
    const src = readFileSync(join(ROOT, 'components/ui/Screen.tsx'), 'utf8');
    expect(src).toMatch(/useTheme\(\)/);
    expect(src).not.toMatch(/^const\s+C\s*=/m);
  });

  it('Screen owns the responsive contract', () => {
    // Tablets rendering as stretched phones was a measured defect; the max
    // width belongs in one place so no screen can forget it.
    expect(readFileSync(join(ROOT, 'components/ui/Screen.tsx'), 'utf8'))
      .toMatch(/contentMaxWidth/);
  });
});
