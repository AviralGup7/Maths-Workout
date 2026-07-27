import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useReducedMotion, announce } from '@/hooks/useA11y';
import colors from '@/constants/colors';

const C = colors.light;

/**
 * A lightweight particle burst for genuinely earned moments.
 *
 * Deliberately not a dependency: a handful of Animated views on the native
 * driver costs nothing and avoids adding a confetti library to the bundle.
 *
 * Deliberately not shown on every correct answer. Celebrating routine success
 * devalues the signal and slows the session; these fire only on the four
 * moments defined in `CelebrationReason`.
 *
 * Under reduced motion the particles are skipped entirely and the message is
 * announced to the screen reader instead — the child still learns that
 * something was achieved, without the movement.
 */

export type CelebrationReason =
  | 'streak'      // a streak milestone: persistence
  | 'recovery'    // a past mistake cleared: the most valuable moment in the app
  | 'mastery'     // a skill reached secure mastery: tied to learning, not score
  | 'best';       // a new personal best

const PARTICLE_COUNT = 14;

const PALETTE: Record<CelebrationReason, string[]> = {
  streak:   [C.gold, '#FFB74D', '#FFE082'],
  recovery: [C.easy, '#81C784', '#A5D6A7'],
  mastery:  [C.primary, '#9575CD', '#B39DDB'],
  best:     [C.gold, C.primary, C.easy],
};

export function Celebration({
  visible,
  reason,
  message,
  onDone,
}: {
  visible: boolean;
  reason: CelebrationReason;
  message: string;
  onDone?: () => void;
}) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const bannerY = useRef(new Animated.Value(0)).current;

  // Stable per-particle randomness, generated once.
  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      angle: (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
      distance: 90 + Math.random() * 70,
      size: 6 + Math.random() * 6,
      delay: Math.random() * 80,
      spin: (Math.random() - 0.5) * 3,
    })),
  ).current;

  useEffect(() => {
    if (!visible) return;

    // The message matters more than the animation — announce it either way.
    announce(message);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    if (reduced) {
      // Show the banner without motion, then clear.
      progress.setValue(1);
      bannerY.setValue(1);
      const id = setTimeout(() => onDone?.(), 1400);
      return () => clearTimeout(id);
    }

    progress.setValue(0);
    bannerY.setValue(0);

    Animated.parallel([
      Animated.timing(progress, {
        toValue: 1,
        duration: 1100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(bannerY, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start(() => onDone?.());
  }, [visible, reduced, message, onDone, progress, bannerY]);

  if (!visible) return null;

  const paletteFor = PALETTE[reason];

  return (
    <View style={styles.overlay} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {!reduced && particles.map((p, i) => {
        const travel = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, p.distance],
        });
        return (
          <Animated.View
            key={i}
            style={[
              styles.particle,
              {
                width: p.size,
                height: p.size,
                borderRadius: p.size / 2,
                backgroundColor: paletteFor[i % paletteFor.length],
                opacity: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
                transform: [
                  { translateX: Animated.multiply(travel, Math.cos(p.angle)) },
                  // Slight downward bias so the burst reads as physical.
                  { translateY: Animated.add(
                      Animated.multiply(travel, Math.sin(p.angle)),
                      progress.interpolate({ inputRange: [0, 1], outputRange: [0, 30] }),
                    ) },
                  { rotate: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', `${p.spin * 360}deg`],
                    }) },
                ],
              },
            ]}
          />
        );
      })}

      <Animated.View
        style={[
          styles.banner,
          {
            opacity: bannerY,
            transform: [
              { scale: bannerY.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
            ],
          },
        ]}
      >
        <Text style={styles.bannerText}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  particle: { position: 'absolute' },
  banner: {
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 6, maxWidth: '80%',
  },
  bannerText: {
    fontSize: 15, fontFamily: 'Inter_700Bold', color: C.foreground, textAlign: 'center',
  },
});

// Streak milestone helpers live in ./celebrationRules so they can be imported
// (and tested) without pulling in React Native.
export { STREAK_MILESTONES, isStreakMilestone } from './celebrationRules';
