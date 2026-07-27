// ─── Language-aware typography ───────────────────────────────────────────────
// Inter has no Devanagari coverage, so Hindi text renders as tofu boxes (□□□).
// Noto Sans Devanagari is loaded alongside it and selected per language.
//
// Styles across the app hard-code family names like 'Inter_700Bold'. Rather
// than rewrite every StyleSheet, `fontFor` maps an Inter weight to the correct
// family for the active language, and components apply it where text is shown.

import type { Lang } from '@/i18n/strings';

export type InterWeight =
  | 'Inter_400Regular'
  | 'Inter_500Medium'
  | 'Inter_600SemiBold'
  | 'Inter_700Bold';

const DEVANAGARI: Record<InterWeight, string> = {
  Inter_400Regular:  'NotoSansDevanagari_400Regular',
  Inter_500Medium:   'NotoSansDevanagari_500Medium',
  Inter_600SemiBold: 'NotoSansDevanagari_600SemiBold',
  Inter_700Bold:     'NotoSansDevanagari_700Bold',
};

/** The font family to use for a given Inter weight in the active language. */
export function fontFor(weight: InterWeight, lang: Lang): string {
  return lang === 'hi' ? DEVANAGARI[weight] : weight;
}

/** True when the string contains Devanagari, so mixed content can be detected. */
export function hasDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

/**
 * Pick a family from the *content* rather than the app language.
 *
 * Useful where a single screen mixes scripts — an English board name beside a
 * Hindi description, or a Hindi question containing Western Arabic numerals.
 */
export function fontForText(text: string, weight: InterWeight): string {
  return hasDevanagari(text) ? DEVANAGARI[weight] : weight;
}
