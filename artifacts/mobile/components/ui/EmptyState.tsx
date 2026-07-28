import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Mascot } from '@/components/Mascot';
import type { MascotMood } from '@/components/Mascot';
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
  mascot,
}: {
  icon?: keyof typeof Feather.glyphMap;
  /**
   * docs/28: an empty state is often a child's first impression of a screen.
   * A face turns "there is nothing here" into "there is nothing here YET",
   * which is the same fact with a different emotional reading. Opt-in, because
   * error states should stay sober.
   */
  mascot?: MascotMood;
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
      {mascot ? <Mascot mood={mascot} size={84} /> : <Feather name={icon} size={32} color={tint} />}
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
