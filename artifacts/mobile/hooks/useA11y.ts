// ─── Accessibility state ─────────────────────────────────────────────────────
// The audit found 5 accessibility labels across 12 screens, zero hints, and no
// awareness of system accessibility settings at all. This module is the single
// source of truth for what the OS is telling us about the user's needs.

import { useEffect, useState, useCallback } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * True when the user has asked the OS to reduce motion.
 *
 * Children with vestibular sensitivity, motion sickness or sensory processing
 * differences turn this on. Honouring it is not optional — a shake animation
 * can genuinely make someone unwell.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let alive = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then(v => { if (alive) setReduced(v); })
      .catch(() => { /* unsupported platform: assume motion is fine */ });

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', v => {
      if (alive) setReduced(v);
    });

    return () => { alive = false; sub?.remove?.(); };
  }, []);

  return reduced;
}

/**
 * True when a screen reader is active.
 *
 * Used to decide whether feedback needs *announcing* rather than merely
 * showing — a colour change communicates nothing to a VoiceOver user.
 */
export function useScreenReader(): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let alive = true;

    AccessibilityInfo.isScreenReaderEnabled()
      .then(v => { if (alive) setActive(v); })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', v => {
      if (alive) setActive(v);
    });

    return () => { alive = false; sub?.remove?.(); };
  }, []);

  return active;
}

/**
 * Speak a message through the screen reader.
 *
 * No-op when nothing is listening, so callers can announce unconditionally.
 */
export function announce(message: string): void {
  if (!message) return;
  try {
    AccessibilityInfo.announceForAccessibility(message);
  } catch { /* not fatal */ }
}

/**
 * Returns an announce function that is a no-op unless a screen reader is on.
 *
 * Avoids queuing announcements nobody will hear.
 */
export function useAnnounce(): (message: string) => void {
  const screenReader = useScreenReader();
  return useCallback((message: string) => {
    if (screenReader) announce(message);
  }, [screenReader]);
}

// Touch-target constants live in ./a11yRules so they can be imported without
// pulling in React Native.
export { MIN_TOUCH, touchSlop } from './a11yRules';

/** Platform-appropriate wording for an activation hint. */
export const ACTIVATE = Platform.select({ ios: 'Double tap to activate', default: 'Tap to activate' })!;
