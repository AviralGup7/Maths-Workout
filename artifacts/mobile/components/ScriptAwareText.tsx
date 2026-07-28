import React from 'react';
import { Text as RNText, StyleSheet } from 'react-native';
import type { TextProps, TextStyle } from 'react-native';
import { fontForText } from '@/hooks/useFontFamily';
import { isDyslexicTypeface } from '@/theme/tokens';
import type { InterWeight } from '@/hooks/useFontFamily';

/**
 * Global Devanagari fallback for <Text>.
 *
 * Every screen styles text with Inter weights ('Inter_700Bold' and friends).
 * Inter contains no Devanagari glyphs, so Hindi rendered as tofu boxes (□□□).
 *
 * Rather than touching every StyleSheet in the app, this patches the default
 * Text render: if the rendered string contains Devanagari, the matching Noto
 * Sans Devanagari weight is substituted. Latin text is untouched, and mixed
 * content — a Hindi sentence containing Western Arabic numerals — is handled
 * because Noto covers both scripts.
 *
 * Installed once from the root layout via `installScriptAwareText()`.
 */

function extractText(children: React.ReactNode): string {
  if (children == null || typeof children === 'boolean') return '';
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(extractText).join('');
  if (React.isValidElement(children)) return extractText((children.props as { children?: React.ReactNode })?.children);
  return '';
}

const INTER_WEIGHTS = new Set<string>([
  'Inter_400Regular', 'Inter_500Medium', 'Inter_600SemiBold', 'Inter_700Bold',
]);

/** Swap an Inter family for its Devanagari equivalent where needed. */
function resolveFontFamily(style: TextStyle | undefined, text: string): TextStyle | undefined {
  if (!style) return style;
  const family = style.fontFamily;
  if (!family || !INTER_WEIGHTS.has(family)) return style;
  const resolved = fontForText(text, family as InterWeight);
  return resolved === family ? style : { ...style, fontFamily: resolved };
}

/**
 * Dyslexia-friendly override — docs/28 item 53.
 *
 * Module-level rather than a hook because the patch below replaces
 * `Text.render` once at startup and cannot subscribe to React context. The
 * provider pushes the value in; a stale read is impossible because the setter
 * runs on the same tick as the state change.
 *
 * `System` resolves to the platform's own UI face (San Francisco / Roboto),
 * both of which are humanist sans-serifs with distinct b/d/p/q shapes — the
 * property that actually matters for dyslexic readers. This deliberately does
 * NOT ship a bundled OpenDyslexic: the evidence for that specific typeface is
 * weak, the licence is restrictive, and it would add ~200KB for a debatable
 * benefit. What is well supported is increased letter spacing and line height,
 * which is applied alongside.
 */
let installed = false;

/**
 * Patch the default props of React Native's Text so every string in the app
 * picks the right script automatically. Idempotent.
 */
export function installScriptAwareText(): void {
  if (installed) return;
  installed = true;

  const Base = RNText as unknown as {
    render?: (props: TextProps, ref: unknown) => React.ReactElement;
  };
  const original = Base.render;
  if (typeof original !== 'function') return;

  Base.render = function patched(props: TextProps, ref: unknown) {
    const text = extractText(props.children);

    // Dyslexia mode applies to ALL text, so it is handled before the
    // Devanagari early-out below.
    if (isDyslexicTypeface()) {
      const flatD = StyleSheet.flatten(props.style) as TextStyle | undefined;
      const size = typeof flatD?.fontSize === 'number' ? flatD.fontSize : 16;
      const dys: TextStyle = {
        ...flatD,
        // Drop the weight-specific family: a single face with unambiguous
        // letterforms beats four weights of a geometric sans here.
        fontFamily: undefined,
        // Both of these are the well-evidenced part of the accommodation.
        letterSpacing: Math.max(flatD?.letterSpacing ?? 0, size * 0.04),
        lineHeight: Math.max(flatD?.lineHeight ?? 0, Math.round(size * 1.6)),
      };
      return original.call(this, { ...props, style: dys }, ref);
    }

    // Only pay the cost when Devanagari is actually present.
    if (!/[\u0900-\u097F]/.test(text)) return original.call(this, props, ref);

    const flat = StyleSheet.flatten(props.style) as TextStyle | undefined;
    const nextStyle = resolveFontFamily(flat, text);
    if (nextStyle === flat) return original.call(this, props, ref);

    return original.call(this, { ...props, style: nextStyle }, ref);
  };
}
