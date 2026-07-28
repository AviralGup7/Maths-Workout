import React, { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import type { TextStyle, StyleProp } from 'react-native';
import { useReducedMotion } from '@/hooks/useA11y';

/**
 * A number that counts up to its value.
 *
 * docs/28: XP and score appeared instantly as final figures. A number that
 * *arrives* is information; a number that *climbs* is a small reward, and it
 * costs nothing but a timer. This is the cheapest available upgrade to the
 * "important moments feel rewarding" score, which the audit put at 3.5/10.
 *
 * Two properties that matter more than the animation itself:
 *
 *   · Under reduced motion it renders the final value immediately. A count-up
 *     is pure decoration — there is no information in the intermediate frames —
 *     so unlike a praise line it can be removed entirely rather than merely
 *     shortened.
 *   · It always LANDS on the exact value. An eased animation that stops at 111
 *     of 112 XP is worse than no animation, because the child reads the wrong
 *     number.
 */
export function CountUp({
  value,
  duration = 800,
  style,
  prefix = '',
  suffix = '',
}: {
  value: number;
  duration?: number;
  style?: StyleProp<TextStyle>;
  prefix?: string;
  suffix?: string;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const raf = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (reduced || value <= 0) { setShown(value); return; }

    const start = Date.now();
    setShown(0);
    raf.current = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / duration);
      // Ease-out: fast at first, settling at the end. A linear climb reads as
      // a loading bar rather than an arrival.
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(value * eased));
      if (t >= 1) {
        // Land exactly, never on a rounding artefact.
        setShown(value);
        if (raf.current) clearInterval(raf.current);
      }
    }, 32);

    return () => { if (raf.current) clearInterval(raf.current); };
  }, [value, duration, reduced]);

  return <Text style={style}>{prefix}{shown}{suffix}</Text>;
}
