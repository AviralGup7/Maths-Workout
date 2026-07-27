import React from 'react';
import { Pressable, Text, View, ActivityIndicator, StyleSheet, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/useTheme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'md' | 'lg';

/**
 * The one button.
 *
 * The audit found 24 touch targets below 44×44 on the home screen alone,
 * including a `·` separator rendered as a hit target. Centralising the button
 * makes that class of defect unrepresentable: every instance is at least
 * `touch.min` (48) tall, and the primary size is 56.
 *
 * Disabled buttons are also removed from the tab order. A control a keyboard or
 * switch user can focus but not activate is a dead end they have to escape.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  fullWidth = true,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Feather.glyphMap;
  iconRight?: keyof typeof Feather.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
}) {
  const { c, type, radius, touch, space } = useTheme();
  const scale = React.useRef(new Animated.Value(1)).current;
  const off = disabled || loading;

  const palette = {
    primary:     { bg: c.primary,     fg: c.primaryOn, border: 'transparent' },
    secondary:   { bg: c.primarySoft, fg: c.primary,   border: 'transparent' },
    ghost:       { bg: 'transparent', fg: c.primary,   border: 'transparent' },
    destructive: { bg: c.wrong,       fg: c.wrongOn,   border: 'transparent' },
  }[variant];

  const height = size === 'lg' ? touch.primaryButton : touch.min;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, fullWidth && { alignSelf: 'stretch' }]}>
      <Pressable
        onPress={() => { if (!off) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onPress(); } }}
        onPressIn={() => !off && Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start()}
        disabled={off}
        style={[
          styles.base,
          {
            minHeight: height,
            borderRadius: radius.md,
            backgroundColor: palette.bg,
            paddingHorizontal: space.lg,
            gap: space.sm,
            opacity: off ? 0.4 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: off, busy: loading }}
        // A focusable control that cannot be activated is a trap.
        focusable={!off}
        importantForAccessibility={off ? 'no-hide-descendants' : 'yes'}
      >
        {loading
          ? <ActivityIndicator size="small" color={palette.fg} />
          : icon && <Feather name={icon} size={18} color={palette.fg} />}
        {/* The label is retained while loading: replacing it with a spinner
            alone leaves the user unsure what they pressed. */}
        <Text style={[type(size === 'lg' ? 'heading' : 'label'), { color: palette.fg }]}>
          {label}
        </Text>
        {iconRight && !loading && <Feather name={iconRight} size={18} color={palette.fg} />}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
