import React from 'react';
import { Pressable, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme/useTheme';

/**
 * Selection chip. 40pt minimum — chips are secondary controls, but "secondary"
 * is not a licence to be untappable. Never icon-only: an unlabelled chip is
 * guesswork for a child and invisible to a screen reader.
 */
export function Chip({
  label, selected = false, onPress, icon, tint,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Feather.glyphMap;
  tint?: string;
}) {
  const { c, type, radius, space } = useTheme();
  const colour = tint ?? c.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: space.xs,
        minHeight: 40, paddingHorizontal: space.md,
        borderRadius: radius.full,
        backgroundColor: selected ? colour + '1F' : c.surfaceSunken,
        borderWidth: 1, borderColor: selected ? colour : 'transparent',
      }}
      accessibilityRole={onPress ? 'radio' : 'text'}
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      {icon && <Feather name={icon} size={13} color={selected ? colour : c.textMuted} />}
      <Text style={[type('label'), { color: selected ? colour : c.textMuted }]}>{label}</Text>
    </Pressable>
  );
}
