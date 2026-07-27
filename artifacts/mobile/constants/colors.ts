// ─── Legacy colour shim ──────────────────────────────────────────────────────
//
// The real source of truth is now theme/tokens.ts. This module remains only so
// that the 17 screens still written as `const C = colors.light` keep compiling
// while they are migrated one at a time (docs/17 §12, M0–M7).
//
// It fixes two audit defects at the root, which is why it is a shim rather than
// a deletion:
//
//   docs/04 C5 · the palettes were INVERTED. `colors.light` held dark values
//                and `colors.dark` held light ones, so the only theme anyone
//                could select was mislabelled. `light` now genuinely is light.
//
//   docs/17 A1/A2 · `correct` and `wrong` were #4CAF50/#F44336, which measured
//                1.07 separation under simulated deuteranopia — indistinguishable
//                for roughly 1 in 12 boys. `primary` failed WCAG AA at 4.41.
//                Both now map to the audited tokens.
//
// NOTE the behavioural consequence: because the palettes were inverted, mapping
// `light` to the real light palette flips every unmigrated screen from dark to
// light in one step. That is the correct end state (docs/17 chooses light as
// the default) and it is why this change ships with M1 rather than later.
//
// New code must import from '@/theme/useTheme' instead. Do not add keys here.

import { LIGHT, DARK, RADIUS } from '../theme/tokens';

/** Category accent hues. Kept separate from semantic colour: these are labels, not states. */
const CATEGORY_LIGHT = {
  catAddition:       '#1B7F3B',
  catSubtraction:    '#B4530F',
  catMultiplication: '#5B3FBF',
  catDivision:       '#0F6F66',
  catMixed:          '#8F5300',
  catTables:         '#1D5FBF',
};

const CATEGORY_DARK = {
  catAddition:       '#6EE7A0',
  catSubtraction:    '#FFA76B',
  catMultiplication: '#C0AEFF',
  catDivision:       '#5FD8C4',
  catMixed:          '#FAB338',
  catTables:         '#8FBEFF',
};

/** Map a Palette onto the legacy key names the old screens expect. */
function legacy(p: typeof LIGHT, cats: typeof CATEGORY_LIGHT | typeof CATEGORY_DARK) {
  return {
    text: p.text,
    tint: p.primary,
    background: p.bg,
    foreground: p.text,
    card: p.surface,
    cardForeground: p.text,
    primary: p.primary,
    primaryForeground: p.primaryOn,
    secondary: p.surfaceSunken,
    secondaryForeground: p.text,
    muted: p.surfaceSunken,
    mutedForeground: p.textMuted,
    accent: p.primary,
    accentForeground: p.primaryOn,
    destructive: p.wrong,
    destructiveForeground: p.wrongOn,
    border: p.border,
    input: p.border,

    // Difficulty bands. `easy`/`hard` were previously the same values as
    // correct/wrong, which is why difficulty chips inherited the colour-blind
    // defect too. They are now tied to the audited tokens.
    easy: p.correct,
    medium: p.attention,
    hard: p.wrong,
    correct: p.correct,
    wrong: p.wrong,
    timerWarning: p.attention,
    gold: p.attention,
    silver: p.textMuted,
    bronze: p.attention,

    ...cats,
  };
}

const colors = {
  light: legacy(LIGHT, CATEGORY_LIGHT),
  dark: legacy(DARK, CATEGORY_DARK),
  radius: RADIUS.lg,
};

export default colors;
