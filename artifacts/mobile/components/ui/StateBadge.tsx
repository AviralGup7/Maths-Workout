import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme/useTheme';
import { STATE_SIGNALS } from '@/theme/tokens';
import type { StateKind } from '@/theme/tokens';
import type { Lang } from '@/i18n/strings';

/**
 * The non-colour half of a state signal.
 *
 * This component exists so that "correct" and "wrong" cannot be rendered as
 * colour alone anywhere in the product. A search over the green/red space
 * established that no AA-passing pair of recognisable hues separates reliably
 * under all three dichromacies (best achievable ≈2.5, and tritanopia binds
 * hardest) — so icon shape, glyph and text are not decoration, they carry the
 * message.
 *
 * Note the shapes are deliberately different families: a filled CIRCLE for
 * correct, an outlined SQUARE for wrong. Two icons of the same silhouette in
 * different colours would reintroduce the exact defect this fixes.
 */
export function StateBadge({
  state,
  lang,
  showLabel = true,
  size = 18,
}: {
  state: StateKind;
  lang: Lang;
  /** Hide only where an adjacent element already states the outcome in words. */
  showLabel?: boolean;
  size?: number;
}) {
  const { c, type, space } = useTheme();
  const sig = STATE_SIGNALS[state];
  const tint = state === 'wrong' ? c.wrong : c.correct;

  return (
    <View style={[styles.row, { gap: space.sm }]}>
      <Feather name={sig.icon as never} size={size} color={tint} />
      {showLabel && (
        <Text
          style={[type('label'), { color: tint }]}
          // The label is the accessible source of truth; the icon is decorative
          // to a screen reader, which already gets the announcement.
          accessibilityRole="text"
        >
          {lang === 'hi' ? sig.label.hi : sig.label.en}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
