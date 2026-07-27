// ─── Motion that respects the user ───────────────────────────────────────────
// Wraps React Native's Animated so that "reduce motion" is honoured
// automatically, everywhere, without every call site having to remember.
//
// The key principle: reduced motion means *less movement*, not *less
// information*. State changes still happen and still complete their callbacks;
// only the travel is removed. A child who cannot tolerate a shake still needs
// to know their answer was wrong.

import { useMemo } from 'react';
import { Animated, Easing } from 'react-native';
import { useReducedMotion } from './useA11y';

type TimingCfg = Omit<Animated.TimingAnimationConfig, 'useNativeDriver'> & { useNativeDriver?: boolean };
type SpringCfg = Omit<Animated.SpringAnimationConfig, 'useNativeDriver'> & { useNativeDriver?: boolean };

export interface Motion {
  /** True when the OS has requested reduced motion. */
  reduced: boolean;
  /** Duration helper: collapses to 0 when motion is reduced. */
  ms: (duration: number) => number;
  timing: (value: Animated.Value, cfg: TimingCfg) => Animated.CompositeAnimation;
  spring: (value: Animated.Value, cfg: SpringCfg) => Animated.CompositeAnimation;
  sequence: (anims: Animated.CompositeAnimation[]) => Animated.CompositeAnimation;
  parallel: (anims: Animated.CompositeAnimation[]) => Animated.CompositeAnimation;
  /**
   * A shake, or an instant no-op under reduced motion.
   * Returns an animation so callers can chain `.start(cb)` either way.
   */
  shake: (value: Animated.Value, intensity?: number) => Animated.CompositeAnimation;
  /** A brief scale pulse, used to acknowledge a correct answer. */
  pulse: (value: Animated.Value, to?: number) => Animated.CompositeAnimation;
}

/** Standard easing — matches the platform feel rather than linear motion. */
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

export function useMotion(): Motion {
  const reduced = useReducedMotion();

  return useMemo<Motion>(() => {
    const ms = (duration: number) => (reduced ? 0 : duration);

    const timing = (value: Animated.Value, cfg: TimingCfg) =>
      Animated.timing(value, {
        easing: EASE_OUT,
        ...cfg,
        duration: ms(cfg.duration ?? 300),
        useNativeDriver: cfg.useNativeDriver ?? true,
      });

    const spring = (value: Animated.Value, cfg: SpringCfg) => {
      // A spring has no duration to zero out, so under reduced motion we jump
      // straight to the destination instead.
      if (reduced) {
        return Animated.timing(value, {
          toValue: cfg.toValue as number,
          duration: 0,
          useNativeDriver: cfg.useNativeDriver ?? true,
        });
      }
      return Animated.spring(value, { ...cfg, useNativeDriver: cfg.useNativeDriver ?? true });
    };

    const shake = (value: Animated.Value, intensity = 10) => {
      if (reduced) {
        // Complete immediately: the caller's callback still fires, so the flow
        // continues and the wrong answer is still reported.
        return Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true });
      }
      const step = (toValue: number) =>
        Animated.timing(value, { toValue, duration: 55, useNativeDriver: true });
      return Animated.sequence([
        step(intensity), step(-intensity),
        step(intensity * 0.7), step(-intensity * 0.7),
        step(0),
      ]);
    };

    const pulse = (value: Animated.Value, to = 1.04) => {
      if (reduced) {
        return Animated.timing(value, { toValue: 1, duration: 0, useNativeDriver: true });
      }
      return Animated.sequence([
        Animated.timing(value, { toValue: to, duration: 90, useNativeDriver: true }),
        Animated.timing(value, { toValue: 1, duration: 90, useNativeDriver: true }),
      ]);
    };

    return {
      reduced,
      ms,
      timing,
      spring,
      sequence: Animated.sequence,
      parallel: Animated.parallel,
      shake,
      pulse,
    };
  }, [reduced]);
}

// Timing constants live in ./motionRules so they can be imported without
// pulling in React Native.
export { FEEDBACK_MS, feedbackDelay, readingDelay, MIN_READING_MS } from './motionRules';
