import React from 'react';
import { Pressable, Text, View, StyleSheet, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme/useTheme';
import { STATE_SIGNALS } from '@/theme/tokens';
import type { Lang } from '@/i18n/strings';

export type TileState = 'idle' | 'correct' | 'wrong' | 'revealed' | 'dimmed';

/**
 * The most-tapped element in the product.
 *
 * Three audit findings converge here:
 *   A1 · correct/wrong were distinguished by colour alone — 1.07 separation
 *        under deuteranopia, i.e. identical for ~1 in 12 boys
 *   A3 · touch targets below 44pt
 *   A8 · answer text competing with 11pt chrome
 *
 * Every state below therefore carries an ICON, a BORDER TREATMENT and a
 * COLOUR — three independent channels — and the tile is 72pt minimum.
 *
 * `revealed` is a distinct state from `correct` on purpose. After a miss the
 * child must be able to tell "the right answer" apart from "the answer I
 * chose", and colouring both green would destroy that distinction. Revealed is
 * outlined; correct is filled.
 */
export function AnswerTile({
  label,
  state = 'idle',
  onPress,
  lang,
  index,
  total,
}: {
  label: string;
  state?: TileState;
  onPress?: () => void;
  lang: Lang;
  /** 1-based, for the screen-reader position announcement. */
  index: number;
  total: number;
}) {
  const { c, type, radius, touch, space } = useTheme();
  const scale = React.useRef(new Animated.Value(1)).current;

  const visual = {
    idle:     { bg: c.surface,     border: c.border,       text: c.text,       icon: null,  width: 1 },
    correct:  { bg: c.correctSoft, border: c.correct,      text: c.correct,    icon: STATE_SIGNALS.correct.icon, width: 3 },
    wrong:    { bg: c.wrongSoft,   border: c.wrong,        text: c.wrong,      icon: STATE_SIGNALS.wrong.icon,   width: 3 },
    // Outlined, not filled — visibly different from the child's own correct tap.
    revealed: { bg: c.surface,     border: c.correct,      text: c.correct,    icon: STATE_SIGNALS.revealed.icon, width: 3 },
    dimmed:   { bg: c.surface,     border: c.border,       text: c.textMuted,  icon: null,  width: 1 },
  }[state];

  const disabled = state !== 'idle';

  // Accessible name states the outcome in WORDS. A VoiceOver user gets the
  // same information a sighted user gets from the icon, not a colour name.
  const outcome =
    state === 'correct'  ? (lang === 'hi' ? 'सही' : 'correct')
    : state === 'wrong'    ? (lang === 'hi' ? 'गलत' : 'incorrect')
    : state === 'revealed' ? (lang === 'hi' ? 'सही उत्तर' : 'the correct answer')
    : '';

  return (
    <Animated.View style={{ transform: [{ scale }], flex: 1 }}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start()}
        style={[
          styles.tile,
          {
            minHeight: touch.answerTile,
            borderRadius: radius.lg,
            backgroundColor: visual.bg,
            borderColor: visual.border,
            borderWidth: visual.width,
            paddingHorizontal: space.md,
            opacity: state === 'dimmed' ? 0.45 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityLabel={
          outcome ? `${label}, ${outcome}` : `${label}, option ${index} of ${total}`
        }
      >
        {visual.icon && (
          <View style={[styles.icon, { top: space.sm, right: space.sm }]}>
            <Feather name={visual.icon as never} size={18} color={visual.text} />
          </View>
        )}
        <Text
          style={[type('answer'), { color: visual.text, textAlign: 'center' }]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  icon: { position: 'absolute' },
});
