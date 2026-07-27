import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/useTheme';

/**
 * A progress bar, always paired with a readable value.
 *
 * A bare bar is inaccessible to screen readers and ambiguous to young children,
 * who cannot reliably read proportion from length alone. `label` may be hidden
 * visually but the accessible value is never omitted.
 */
export function ProgressBar({
  value,
  max = 1,
  label,
  showValue = true,
  tint,
  height = 8,
}: {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  tint?: string;
  height?: number;
}) {
  const { c, type, space, radius } = useTheme();
  const pct = Math.max(0, Math.min(1, max === 0 ? 0 : value / max));
  const colour = tint ?? c.primary;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      accessibilityLabel={label}
    >
      {(label || showValue) && (
        <View style={[styles.row, { marginBottom: space.xs }]}>
          {!!label && <Text style={[type('caption'), { color: c.textMuted, flex: 1 }]}>{label}</Text>}
          {showValue && (
            <Text style={[type('caption'), { color: c.textMuted, fontVariant: ['tabular-nums'] }]}>
              {Math.round(pct * 100)}%
            </Text>
          )}
        </View>
      )}
      <View style={{ height, backgroundColor: c.surfaceSunken, borderRadius: radius.full, overflow: 'hidden' }}>
        <View style={{ width: `${pct * 100}%`, height, backgroundColor: colour, borderRadius: radius.full }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center' } });
