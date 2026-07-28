// ─── Read-aloud ──────────────────────────────────────────────────────────────
// docs/28.
//
// The audit found ZERO audio in a product whose youngest users are six. Every
// benchmark for this age group reads questions aloud — Khan Academy Kids and
// Duolingo ABC both do — and for a child who cannot yet decode
// "How many corners does a Rectangle have?" this is not decoration. It is the
// difference between a maths question and a reading test.
//
// Deliberately speech synthesis rather than recorded audio:
//   · questions are GENERATED, so there is no fixed script to record
//   · it works in both languages from the same call site
//   · it adds no audio assets to the bundle
//   · the OS voice already matches the child's accessibility settings
//
// Deliberately OFF by default for older learners: a Class 6 child being read
// "5x = 45" aloud is patronising, and reading the question is part of the task
// by then. On by default only where decoding is still a barrier (Class 1–2).

import { useCallback, useEffect, useRef } from 'react';
import * as Speech from 'expo-speech';
import type { Lang } from '@/i18n/strings';
import type { SchoolClass } from '@/generators/types';

/** Classes where reading the question is still a barrier, not the task. */
const READ_ALOUD_DEFAULT_CLASSES: SchoolClass[] = ['1st', '2nd'];

export function readAloudDefault(cls: SchoolClass): boolean {
  return READ_ALOUD_DEFAULT_CLASSES.includes(cls);
}

/**
 * Strip a question down to something worth hearing.
 *
 * Emoji runs are the countable objects in Class 1 questions ("How many 🍎?
 * 🍎🍎🍎🍎"). Reading forty identical glyph names aloud would be absurd, so the
 * run is replaced with silence and the child counts what they SEE — which is
 * the actual skill being practised.
 */
export function speakableText(text: string): string {
  return text
    // drop emoji / symbol runs used as countable objects
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u25A0-\u25FF\u2B00-\u2BFF]+/gu, ' ')
    // operators read badly as glyphs
    .replace(/×/g, ' times ')
    .replace(/÷/g, ' divided by ')
    .replace(/[−–—]/g, ' minus ')
    .replace(/\+/g, ' plus ')
    .replace(/=/g, ' equals ')
    .replace(/\s+/g, ' ')
    .trim();
}

const LOCALE: Record<Lang, string> = { en: 'en-IN', hi: 'hi-IN' };

/**
 * Speak question text, cancelling anything already in flight.
 *
 * Cancellation matters: a child who taps through quickly would otherwise queue
 * five questions and hear them read over the top of each other.
 */
export function useSpeech(enabled: boolean, lang: Lang) {
  const lastRef = useRef<string>('');

  const stop = useCallback(() => {
    try { Speech.stop(); } catch { /* web/unsupported */ }
  }, []);

  const speak = useCallback((text: string) => {
    if (!enabled) return;
    const body = speakableText(text);
    if (!body || body === lastRef.current) return;
    lastRef.current = body;
    try {
      Speech.stop();
      Speech.speak(body, {
        language: LOCALE[lang] ?? 'en-IN',
        // Slower than default: six-year-olds process speech more slowly, and
        // a maths question is dense with numbers that must be held.
        rate: 0.85,
        pitch: 1.05,
      });
    } catch { /* speech unavailable — silently no-op, never block the question */ }
  }, [enabled, lang]);

  // Never leave audio playing behind a screen the child has left.
  useEffect(() => stop, [stop]);

  return { speak, stop };
}
