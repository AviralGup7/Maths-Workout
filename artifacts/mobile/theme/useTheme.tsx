// ─── Theme provider ──────────────────────────────────────────────────────────
//
// Replaces hooks/useColors.ts, which was called by exactly 2 files while 17
// hardcoded `colors.light` at module scope — so the app had no working theming
// at all, and the palette it hardcoded was the inverted one (docs/04 C5).
//
// Module-scope `const C = colors.light` is the specific pattern that made
// theming impossible: styles were frozen at import time, before any preference
// could be read. Everything here is hook-based for that reason.

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useColorScheme, useWindowDimensions, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readEnum, readNumber } from '../lib/storage';
import {
  PALETTES, TYPE, SPACE, RADIUS, TOUCH, ELEVATION,
  sizeClassFor, CONTENT_MAX_WIDTH,
} from './tokens';
import type { Palette, ThemeName, TypeRole, SizeClass } from './tokens';

const THEME_KEY = '@maths_workout_theme';
const TEXT_SCALE_KEY = '@maths_workout_text_scale';

/** 'system' follows the OS; the other two are explicit overrides. */
export type ThemePreference = ThemeName | 'system';

export interface Theme {
  name: ThemeName;
  c: Palette;
  space: typeof SPACE;
  radius: typeof RADIUS;
  touch: typeof TOUCH;
  elevation: typeof ELEVATION;
  /** Resolved type style, with the user's text-scale applied. */
  type: (role: TypeRole) => {
    fontSize: number;
    fontWeight: '400' | '500' | '600' | '700';
    lineHeight: number;
    letterSpacing: number;
  };
  sizeClass: SizeClass;
  contentMaxWidth: number | null;
  /** User text-scale multiplier, 1.0–2.0. */
  textScale: number;
}

interface ThemeCtx extends Theme {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  setTextScale: (n: number) => void;
  /** True until stored preferences have been read. */
  loaded: boolean;
}

const Ctx = createContext<ThemeCtx | undefined>(undefined);

/** Text scale bounds. 2.0 is the WCAG 1.4.4 target for resizable text. */
export const TEXT_SCALE_MIN = 1.0;
export const TEXT_SCALE_MAX = 2.0;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const { width } = useWindowDimensions();
  const [preference, setPref] = useState<ThemePreference>('light');
  const [textScale, setScale] = useState(1);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    // docs/23 #19. Read through the shared typed façade rather than hand-rolling
    // validation. The inline version here happened to be correct, but every
    // duplicate of a validation rule is a place for one to drift.
    Promise.all([
      readEnum(THEME_KEY, ['light', 'dark', 'system'] as const, 'system'),
      readNumber(TEXT_SCALE_KEY, 1),
    ]).then(([t, n]) => {
      if (!alive) return;
      setPref(t);
      if (n >= TEXT_SCALE_MIN && n <= TEXT_SCALE_MAX) setScale(n);
    }).catch(() => {}).finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    AsyncStorage.setItem(THEME_KEY, p).catch(() => {});
  }, []);

  const setTextScale = useCallback((n: number) => {
    const clamped = Math.max(TEXT_SCALE_MIN, Math.min(TEXT_SCALE_MAX, n));
    setScale(clamped);
    AsyncStorage.setItem(TEXT_SCALE_KEY, String(clamped)).catch(() => {});
  }, []);

  // Light is the default rather than 'system': the product is used by children
  // whose device theme is usually chosen by a parent, and light is the better
  // default for sustained numeral reading. 'system' remains available.
  const name: ThemeName =
    preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<ThemeCtx>(() => {
    const c = PALETTES[name];
    const sizeClass = sizeClassFor(width);
    return {
      name, c,
      space: SPACE, radius: RADIUS, touch: TOUCH, elevation: ELEVATION,
      sizeClass,
      contentMaxWidth: CONTENT_MAX_WIDTH[sizeClass],
      textScale,
      type: (role: TypeRole) => {
        const t = TYPE[role];
        const fontSize = Math.round(t.size * textScale);
        return {
          fontSize,
          fontWeight: t.weight as '400' | '500' | '600' | '700',
          // Line height is computed from the SCALED size, so large-text users
          // get proportional leading rather than cramped lines.
          lineHeight: Math.round(fontSize * t.lineHeight),
          letterSpacing: t.tracking,
        };
      },
      preference, setPreference, setTextScale, loaded,
    };
  }, [name, width, textScale, preference, setPreference, setTextScale, loaded]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

/** Current OS colour scheme, for the settings screen preview. */
export function systemScheme(): ThemeName {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}
