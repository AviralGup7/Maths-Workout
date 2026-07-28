import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Rect, Circle } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/useTheme';
import { useGame } from '@/context/GameContext';

/**
 * A ten-frame the child BUILDS. docs/28 items 46 and 47.
 *
 * The audit's point, borrowed from DreamBox: in the best manipulative software
 * the manipulation *is* the answer. Everything in this product so far asks the
 * child to compute and then report — tap a tile, type a number, order a list.
 * Even the ten-frame added earlier is illustrative: it shows the quantity and
 * the child still answers somewhere else.
 *
 * Here, placing counters IS answering. "Show 7" is complete when seven
 * counters are on the frame. There is no separate answer surface, so a child
 * who cannot yet write a numeral can still demonstrate that they know what
 * seven is — and a child who counts one-by-one visibly does something
 * different from one who fills a row of five and adds two.
 *
 * ── Why tap rather than drag ────────────────────────────────────────────────
 *
 * `OrderingTray` already established this in the codebase and the reasoning
 * holds: drag is unreliable on small screens, fails motor accessibility, and
 * is unusable with a screen reader. Tapping a cell fills it; tapping a filled
 * cell empties it. Every action is reversible, which matters because a
 * manipulative that punishes exploration is not a manipulative.
 *
 * ── Why the frame is not pre-marked ─────────────────────────────────────────
 *
 * The first five cells tint differently ONLY once filled. Colouring the empty
 * cells would hand the child the five-and-some-more structure rather than
 * letting them discover it, which is the one thing this representation exists
 * to teach.
 */
export function ManipulativeFrame({
  target,
  max = 10,
  locked,
  wasCorrect,
  onSubmit,
}: {
  /** How many counters the child is being asked to show. */
  target: number;
  max?: number;
  locked: boolean;
  wasCorrect: boolean | null;
  onSubmit: (normalised: string) => void;
}) {
  const { c, type, space } = useTheme();
  const { lang } = useGame();
  const hi = lang === 'hi';
  const styles = useMemo(() => makeStyles(c), [c]);

  const [filled, setFilled] = useState<boolean[]>(() => Array(max).fill(false));
  useEffect(() => { if (!locked) setFilled(Array(max).fill(false)); }, [locked, max]);

  const count = filled.filter(Boolean).length;

  const toggle = (i: number) => {
    if (locked) return;
    Haptics.selectionAsync().catch(() => {});
    setFilled(f => f.map((v, k) => (k === i ? !v : v)));
  };

  const cols = 5;
  const rows = Math.ceil(max / cols);
  const size = 280;
  const cell = size / cols;
  const height = cell * rows;

  return (
    <View style={styles.wrap}>
      <Text style={styles.prompt}>
        {hi ? `${target} दिखाएँ` : `Show ${target}`}
      </Text>

      {/* The frame. Cells are real tap targets, each comfortably over 44pt. */}
      <View style={{ alignSelf: 'center' }}>
        <Svg width={size} height={height} viewBox={`0 0 ${size} ${height}`}>
          {Array.from({ length: max }).map((_, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            return (
              <Rect
                key={`r${i}`}
                x={col * cell} y={row * cell} width={cell} height={cell}
                fill="none" stroke={c.border} strokeWidth={1.5}
              />
            );
          })}
          {filled.map((on, i) => {
            if (!on) return null;
            const col = i % cols;
            const row = Math.floor(i / cols);
            return (
              <Circle
                key={`c${i}`}
                cx={col * cell + cell / 2}
                cy={row * cell + cell / 2}
                r={cell * 0.31}
                // Tinted only once placed: colouring empty cells would hand
                // the child the structure instead of letting them build it.
                fill={i < 5 ? c.primary : c.correct}
              />
            );
          })}
        </Svg>

        {/* Transparent hit layer, so the SVG stays declarative and the touch
            targets stay honest at the cell size rather than the circle size. */}
        <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', flexWrap: 'wrap' }]}>
          {Array.from({ length: max }).map((_, i) => (
            <Pressable
              key={i}
              onPress={() => toggle(i)}
              disabled={locked}
              style={{ width: cell, height: cell }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: filled[i], disabled: locked }}
              accessibilityLabel={
                hi ? `खाना ${i + 1}` : `Cell ${i + 1}`
              }
            />
          ))}
        </View>
      </View>

      {/* The running count is shown because a child building 7 needs to know
          how many they have placed without recounting every time — that is
          working memory spent on bookkeeping, not on mathematics. */}
      <Text
        style={[styles.count, locked && { color: wasCorrect ? c.correct : c.wrong }]}
        accessibilityLiveRegion="polite"
      >
        {count}
      </Text>

      <TouchableOpacity
        style={[styles.submit, locked && styles.submitOff]}
        onPress={() => {
          if (locked) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onSubmit(String(count));
        }}
        disabled={locked}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={hi ? 'जाँचें · Check' : 'Check answer'}
      >
        <Feather name="check" size={18} color={c.primaryOn} />
        <Text style={styles.submitText}>{hi ? 'जाँचें · Check' : 'Check'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['c']) => StyleSheet.create({
  wrap: { gap: 12 },
  prompt: {
    fontSize: 20, fontFamily: 'Inter_700Bold', color: c.text, textAlign: 'center',
  },
  count: {
    fontSize: 34, fontFamily: 'Inter_700Bold', color: c.text, textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  submit: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 50, borderRadius: 13, backgroundColor: c.primary,
  },
  submitOff: { opacity: 0.4 },
  submitText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: c.primaryOn },
});
