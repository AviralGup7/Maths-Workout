import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { useReducedMotion } from '@/hooks/useA11y';

/**
 * A progress bar that ANIMATES FROM ITS PREVIOUS VALUE.
 *
 * docs/25 · Tier 1 item 3, and the highest-value animation in the product.
 *
 * The existing `ProgressBar` renders a static proportion, which answers "where
 * am I?" but never "what did I just do?". The audit's finding was that nothing
 * anywhere in the app animates change: motion decorated outcomes (stars
 * popping, score springing) but never showed movement. For a child, a bar
 * visibly filling is the clearest possible statement of *you got better* — and
 * unlike a number, it needs no reading age.
 *
 * The distinction from a decorative animation matters: this is not motion added
 * to make the screen livelier, it is motion carrying information that is
 * otherwise invisible. The `from` value only exists because the session report
 * tracks a genuine delta.
 *
 * Under reduced motion the bar jumps straight to `to`. The information is in
 * the final state and the labels either way; the animation is an enhancement,
 * never the only channel.
 */
export function GrowthBar({
  from,
  to,
  max = 1,
  label,
  caption,
  tint,
  height = 10,
  delay = 0,
}: {
  /** Value at the start of the session, 0–max. */
  from: number;
  /** Value now, 0–max. */
  to: number;
  max?: number;
  label?: string;
  /** Small text shown to the right, e.g. "62% → 71%". */
  caption?: string;
  tint?: string;
  height?: number;
  delay?: number;
}) {
  const { c, type, space, radius } = useTheme();
  const reduced = useReducedMotion();
  const colour = tint ?? c.primary;

  const clamp = (v: number) => Math.max(0, Math.min(1, max === 0 ? 0 : v / max));
  const fromPct = clamp(from);
  const toPct = clamp(to);

  const anim = useRef<Animated.Value | null>(null);
  if (anim.current === null) anim.current = new Animated.Value(reduced ? toPct : fromPct);

  useEffect(() => {
    if (reduced) {
      anim.current!.setValue(toPct);
      return;
    }
    const a = Animated.timing(anim.current!, {
      toValue: toPct,
      duration: 900,
      delay,
      // Width cannot use the native driver; the bar is a single small view so
      // the JS-driven interpolation is affordable, and it runs once per screen.
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [toPct, reduced, delay]);

  const width = anim.current.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(toPct * 100) }}
      accessibilityLabel={label}
    >
      {(label || caption) && (
        <View style={[styles.row, { marginBottom: space.xs }]}>
          {!!label && (
            <Text style={[type('caption'), { color: c.textMuted, flex: 1 }]} numberOfLines={1}>
              {label}
            </Text>
          )}
          {!!caption && (
            <Text style={[type('caption'), { color: c.textMuted, fontVariant: ['tabular-nums'] }]}>
              {caption}
            </Text>
          )}
        </View>
      )}
      <View
        style={{
          height,
          borderRadius: radius.full,
          backgroundColor: c.surfaceSunken,
          overflow: 'hidden',
        }}
      >
        {/* The portion already earned before this session, shown flat so the
            newly-earned segment reads as an addition rather than the whole. */}
        <View
          style={{
            position: 'absolute',
            left: 0, top: 0, bottom: 0,
            width: `${fromPct * 100}%`,
            backgroundColor: colour,
            opacity: 0.35,
          }}
        />
        <Animated.View
          style={{ height: '100%', width, backgroundColor: colour, borderRadius: radius.full }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
