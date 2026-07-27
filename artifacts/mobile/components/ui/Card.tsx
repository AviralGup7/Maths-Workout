import React from 'react';
import { View, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/theme/useTheme';

/**
 * Surface container.
 *
 * Elevation is capped at 1 for non-interactive cards on purpose: a card that
 * looks raised but cannot be pressed is a false affordance, and children test
 * affordances by tapping them.
 *
 * In dark mode depth comes from surface lightness and a border rather than a
 * shadow — shadows are nearly invisible against near-black, a common and
 * avoidable dark-theme failure.
 */
export function Card({
  children,
  onPress,
  elevation = 1,
  padded = true,
  style,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  elevation?: 0 | 1 | 2 | 3;
  padded?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  const { c, radius, space, elevation: E, name } = useTheme();
  const e = E[onPress ? Math.max(1, elevation) as 1 | 2 | 3 : elevation];

  const surface: ViewStyle = {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: padded ? space.base : 0,
    borderWidth: e.useBorder ? 1 : 0,
    borderColor: c.border,
    ...(name === 'light' && e.shadowOpacity > 0 ? {
      shadowColor: e.shadowColor,
      shadowOpacity: e.shadowOpacity,
      shadowRadius: e.shadowRadius,
      shadowOffset: { width: 0, height: e.shadowOffsetY },
      elevation: e.elevation,
    } : {}),
  };

  if (!onPress) {
    return <View style={[surface, style]} accessibilityLabel={accessibilityLabel}>{children}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [surface, pressed && { opacity: 0.9 }, style]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </Pressable>
  );
}
