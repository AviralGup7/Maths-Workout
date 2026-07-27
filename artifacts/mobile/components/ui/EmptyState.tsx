import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme/useTheme';
import { Button } from './Button';

/**
 * Empty and error states.
 *
 * Never a dead end: every empty state carries an action. And the copy is plain
 * language — "Couldn't save your progress" rather than "Error 500". A child
 * cannot act on a status code, and neither can most parents.
 */
export function EmptyState({
  icon = 'inbox',
  title,
  body,
  actionLabel,
  onAction,
  tone = 'neutral',
}: {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'neutral' | 'error';
}) {
  const { c, type, space } = useTheme();
  const tint = tone === 'error' ? c.wrong : c.textMuted;

  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xl, gap: space.md }}>
      <Feather name={icon} size={32} color={tint} />
      <Text style={[type('heading'), { color: c.text, textAlign: 'center' }]}>{title}</Text>
      {!!body && (
        <Text style={[type('body'), { color: c.textMuted, textAlign: 'center', maxWidth: 320 }]}>
          {body}
        </Text>
      )}
      {actionLabel && onAction && (
        <View style={{ marginTop: space.sm, minWidth: 200 }}>
          <Button label={actionLabel} onPress={onAction} variant="secondary" />
        </View>
      )}
    </View>
  );
}
