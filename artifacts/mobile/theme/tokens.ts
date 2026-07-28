// ─── Design tokens ───────────────────────────────────────────────────────────
// M0 of the migration plan in docs/17-ui-ux-redesign.md.
//
// Single source of truth for colour, type, spacing, radius and elevation.
// Deliberately free of React Native imports so every value can be unit tested —
// in particular so contrast ratios are asserted in CI rather than eyeballed.
//
// This replaces constants/colors.ts, which had three defects the audit measured:
//   · the palettes were INVERTED — `colors.light` held dark values (docs/04 C5)
//   · brand primary failed WCAG AA on both surfaces (4.41 and 3.95)
//   · `border` sat at 1.23 against card, i.e. invisible
//
// Every colour below is checked by theme/__tests__/contrast.test.ts. If a token
// is changed to something inaccessible, the build fails. That is the point.

// ─── Colour ──────────────────────────────────────────────────────────────────

export interface Palette {
  // Surfaces
  bg: string;
  surface: string;
  surfaceSunken: string;
  surfaceRaised: string;

  // Lines
  border: string;
  borderStrong: string;

  // Text
  text: string;
  textMuted: string;
  textInverse: string;

  // Brand
  primary: string;
  primaryOn: string;
  primarySoft: string;

  // Semantic state
  correct: string;
  correctOn: string;
  correctSoft: string;
  wrong: string;
  wrongOn: string;
  wrongSoft: string;
  attention: string;
  attentionSoft: string;

  // Progression
  locked: string;
  mastered: string;
}

/**
 * Light theme — the default.
 *
 * The app was previously dark-only. Light is the better default for sustained
 * numeral reading: dark-on-light is easier for most readers, and children with
 * astigmatism experience halation on white-on-black text that makes digits
 * genuinely harder to resolve. Dark remains available and fully supported.
 */
export const LIGHT: Palette = {
  bg:            '#FCFCFD',
  surface:       '#FFFFFF',
  surfaceSunken: '#F4F5F7',
  surfaceRaised: '#FFFFFF',

  // Borders are DECORATIVE ONLY and must never be the sole signal for a state —
  // a 1.6 ratio is invisible to many users. `borderStrong` clears 3:1 and is
  // what focus rings use.
  border:        '#D7DAE0',
  borderStrong:  '#767E8C',

  text:          '#12141A',
  textMuted:     '#5A6172',
  textInverse:   '#FFFFFF',

  primary:       '#4338CA',   // replaces #6C63FF, which failed AA
  primaryOn:     '#FFFFFF',
  primarySoft:   '#EEF0FF',

  // Correct is a TEAL-leaning green and wrong is a DARK maroon-red. Both the
  // hue separation and the ~2.5:1 luminance gap are deliberate — see the note
  // on STATE_SIGNALS below for why colour alone is still not sufficient.
  correct:       '#087D6F',
  correctOn:     '#FFFFFF',
  correctSoft:   '#EBF9F8',
  wrong:         '#460B0F',
  wrongOn:       '#FFFFFF',
  wrongSoft:     '#FAEBEC',
  attention:     '#8F5300',
  attentionSoft: '#FEF5E7',

  locked:        '#767E8C',
  mastered:      '#087D6F',
};

export const DARK: Palette = {
  bg:            '#0E1116',
  surface:       '#171B22',
  surfaceSunken: '#12161C',
  surfaceRaised: '#1E232C',

  border:        '#252B36',
  borderStrong:  '#8C95A5',

  text:          '#F2F4F8',
  textMuted:     '#A2AAB8',
  textInverse:   '#0E1116',

  // Not the same hue as light: a mid-tone brand colour that passes on white
  // will fail on near-black. Dark themes need a genuinely lighter tint.
  primary:       '#A5B4FC',
  primaryOn:     '#0E1116',
  primarySoft:   '#1E2440',

  correct:       '#B6F7D6',
  correctOn:     '#06281B',
  correctSoft:   '#122B1F',
  wrong:         '#DE5D35',
  wrongOn:       '#2B0A08',
  wrongSoft:     '#2B1812',
  attention:     '#FAB338',
  attentionSoft: '#2B2212',

  locked:        '#8C95A5',
  mastered:      '#B6F7D6',
};

/**
 * High contrast — docs/28 item 54.
 *
 * Not "dark mode with more contrast". Low vision, and the residual vision that
 * remains with cataract or corneal scarring, is served by MAXIMUM luminance
 * separation and hard edges, not by a tasteful palette. Every text pair here
 * clears 7:1 (WCAG AAA) rather than 4.5:1, borders are full-strength rather
 * than decorative, and the semantic colours are pushed to the extremes of
 * their hue so they remain distinguishable at low acuity.
 *
 * Offered free and prominently. An accessibility theme behind an unlock would
 * be indefensible.
 */
export const HIGH_CONTRAST: Palette = {
  bg:            '#FFFFFF',
  surface:       '#FFFFFF',
  surfaceSunken: '#F2F2F2',
  surfaceRaised: '#FFFFFF',

  // Borders carry structure here rather than decoration: at low acuity a 1.6
  // ratio edge simply does not exist, so cards would merge into the page.
  border:        '#000000',
  borderStrong:  '#000000',

  text:          '#000000',
  textMuted:     '#3A3A3A',   // 10.8:1 — still AAA, so nothing is "quiet"
  textInverse:   '#FFFFFF',

  primary:       '#0000C8',
  primaryOn:     '#FFFFFF',
  primarySoft:   '#E4E4FF',

  // Correct and wrong must differ in LUMINANCE, not only hue — a deep green
  // and a deep red at the same lightness are the same colour to a
  // deuteranopic reader, which is precisely the 1.07 defect the standard
  // palettes were rebuilt to fix. The first draft of this theme scored 1.05
  // between the two; the guard caught it. This pair measures 2.99 apart while
  // both still clear AA on white.
  correct:       '#007A42',
  correctOn:     '#FFFFFF',
  correctSoft:   '#DFF5E8',
  wrong:         '#4A0000',
  wrongOn:       '#FFFFFF',
  wrongSoft:     '#FFE4E4',
  attention:     '#6B4400',
  attentionSoft: '#FFF0D6',

  locked:        '#3A3A3A',
  mastered:      '#005C2E',
};

export type ThemeName = 'light' | 'dark' | 'highContrast';
export const PALETTES: Record<ThemeName, Palette> = {
  light: LIGHT,
  dark: DARK,
  highContrast: HIGH_CONTRAST,
};

// ─── State semantics (A1 — the equity fix) ───────────────────────────────────

/**
 * How each state is signalled, on FOUR axes.
 *
 * The audit's most serious finding: correct and wrong were distinguished by hue
 * alone, and under simulated deuteranopia rendered as #9A9A54 vs #969624 — a
 * luminance ratio of 1.07, i.e. the same colour. Roughly 1 in 12 boys could not
 * tell whether they had answered correctly.
 *
 * ── An important negative result ──────────────────────────────────────────
 *
 * The obvious fix is "pick better colours". A search over the green/red space
 * showed that this is NOT SUFFICIENT, and the number is worth recording:
 *
 *   maximum achievable worst-case CVD separation for a green/red pair
 *   where both colours pass WCAG AA on white  =  2.29
 *   ...and that pair is teal #0B8484 / near-black maroon #5A0C17, which most
 *   sighted users would no longer read as "green" and "red" at all.
 *
 * Tritanopia is the binding constraint, and no palette escapes it. Constraining
 * the search to hues that remain recognisably green and red yields NO solution
 * above ~1.6. The shipped pair reaches 1.64 worst-case (2.49 luminance ratio in
 * normal vision), which is the honest optimum — a real improvement on 1.01, and
 * still nowhere near enough on its own.
 *
 * The conclusion is therefore structural rather than chromatic: **colour is the
 * LAST of four signals and must never be load-bearing.** Icon shape, glyph and
 * text label are mandatory, which is why they are required fields on this type
 * and asserted in theme/__tests__/contrast.test.ts. A state rendered with
 * colour alone is a bug, not a style choice.
 */
export interface StateSignal {
  /** Feather icon name. */
  icon: string;
  /** Text glyph, for contexts without an icon font. */
  glyph: string;
  /** Always rendered — never rely on visuals alone. */
  label: { en: string; hi: string };
  /** Motion signature; see docs/17 §7. */
  motion: 'rise' | 'shake' | 'none';
}

export const STATE_SIGNALS = {
  correct: {
    icon: 'check-circle',
    glyph: '✓',
    label: { en: 'Correct', hi: 'सही' },
    motion: 'rise',
  },
  wrong: {
    icon: 'x-square',          // deliberately a DIFFERENT SHAPE, not just a different colour
    glyph: '✕',
    label: { en: 'Not quite', hi: 'लगभग' },
    motion: 'shake',
  },
  revealed: {
    icon: 'check-circle',
    glyph: '✓',
    label: { en: 'The answer', hi: 'सही उत्तर' },
    motion: 'none',
  },
} as const satisfies Record<string, StateSignal>;

export type StateKind = keyof typeof STATE_SIGNALS;

// ─── Typography ──────────────────────────────────────────────────────────────

/**
 * Type scale.
 *
 * Minimum size is 13. The audit found 32 instances at or below 11pt, which is
 * under the readability floor for adults and far under what a six-year-old
 * needs. Body line-height is 1.6 rather than the more usual 1.4 — a dyslexia
 * accommodation that costs typical readers nothing.
 */
export const TYPE = {
  questionXl: { size: 48, weight: '700', lineHeight: 1.15, tracking: -0.5 },
  questionLg: { size: 36, weight: '700', lineHeight: 1.20, tracking: -0.25 },
  questionMd: { size: 28, weight: '700', lineHeight: 1.25, tracking: 0 },
  questionSm: { size: 20, weight: '600', lineHeight: 1.35, tracking: 0 },
  answer:     { size: 32, weight: '700', lineHeight: 1.20, tracking: 0 },
  title:      { size: 24, weight: '700', lineHeight: 1.25, tracking: -0.25 },
  heading:    { size: 18, weight: '600', lineHeight: 1.35, tracking: 0 },
  body:       { size: 16, weight: '400', lineHeight: 1.60, tracking: 0 },
  label:      { size: 14, weight: '600', lineHeight: 1.40, tracking: 0.3 },
  caption:    { size: 13, weight: '500', lineHeight: 1.45, tracking: 0.4 },
} as const;

export type TypeRole = keyof typeof TYPE;

/**
 * Dyslexia-friendly typeface flag — docs/28 item 53.
 *
 * Lives here, in the lowest layer, because BOTH the theme provider (which owns
 * the preference) and the global <Text> patch (which applies it) need it, and
 * a component may not be imported by the theme — the architecture guard
 * enforces that direction and was right to reject the first attempt.
 *
 * A module-level flag rather than context: the patch replaces `Text.render`
 * once at startup and cannot subscribe to React.
 */
let dyslexicTypeface = false;
export function setDyslexicTypeface(on: boolean): void { dyslexicTypeface = on; }
export function isDyslexicTypeface(): boolean { return dyslexicTypeface; }

/** Nothing in the product may render text below this size. */
export const MIN_FONT_SIZE = 13;

// ─── Spacing, radius, elevation ──────────────────────────────────────────────

/** 8pt base grid. */
export const SPACE = {
  xxs: 2, xs: 4, sm: 8, md: 12, base: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64,
} as const;

/**
 * Corner radius. Capped at 24 on content containers: very round cards read as
 * toys and undermine the credibility the parent-facing side of the product
 * needs.
 */
export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 } as const;

/**
 * Touch targets.
 *
 * 48 rather than the WCAG minimum of 44. Children have less precise motor
 * control than the adults those guidelines were written for, so 44 is a floor
 * to clear, not a target to hit. The audit found 24 targets below 44 on the
 * home screen alone.
 */
export const TOUCH = {
  min: 48,
  /** Answer tiles — the most-tapped element in the product. */
  answerTile: 72,
  /** Primary call to action. */
  primaryButton: 56,
  /** Keypad key. */
  key: 64,
  /** Minimum gap between adjacent targets, to prevent mis-taps. */
  gap: 8,
} as const;

/**
 * Elevation.
 *
 * In dark mode, depth is expressed through surface lightness and border rather
 * than shadow — shadows are nearly invisible against a near-black background,
 * which is a common and avoidable dark-theme failure.
 */
export interface Elevation {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffsetY: number;
  elevation: number;
  useBorder: boolean;
}

export const ELEVATION: Record<0 | 1 | 2 | 3, Elevation> = {
  0: { shadowColor: '#101828', shadowOpacity: 0,    shadowRadius: 0,  shadowOffsetY: 0, elevation: 0, useBorder: false },
  1: { shadowColor: '#101828', shadowOpacity: 0.06, shadowRadius: 2,  shadowOffsetY: 1, elevation: 1, useBorder: true },
  2: { shadowColor: '#101828', shadowOpacity: 0.10, shadowRadius: 12, shadowOffsetY: 4, elevation: 3, useBorder: true },
  3: { shadowColor: '#101828', shadowOpacity: 0.16, shadowRadius: 32, shadowOffsetY: 12, elevation: 8, useBorder: true },
};

// ─── Breakpoints ─────────────────────────────────────────────────────────────

export const BREAKPOINT = { compact: 0, medium: 600, expanded: 840 } as const;
export type SizeClass = 'compact' | 'medium' | 'expanded';

export function sizeClassFor(width: number): SizeClass {
  if (width >= BREAKPOINT.expanded) return 'expanded';
  if (width >= BREAKPOINT.medium) return 'medium';
  return 'compact';
}

/** Max content width per size class, so tablets stop being stretched phones. */
export const CONTENT_MAX_WIDTH: Record<SizeClass, number | null> = {
  compact: null, medium: 560, expanded: 720,
};
