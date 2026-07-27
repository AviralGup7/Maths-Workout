// ─── Practice scaffolding state ──────────────────────────────────────────────
// docs/20 §6.
//
// `game.tsx` reached 844 lines and 34 hook calls, coordinating timers,
// animations, hints, worked examples, confidence, praise, diagnosis and XP —
// and it has no tests, because none of that is reachable without a renderer.
//
// This hook extracts the part that is pure decision-making: when a hint should
// appear, when a confidence prompt is due, and whether an answer counts as
// scaffolded. Timers and animations stay in the screen, because they are
// genuinely view concerns.
//
// The decisions themselves already live in `learning/hints.ts` and
// `learning/confidence.ts` as pure functions; what this adds is the small
// amount of per-question STATE those functions need, in one place that can be
// reasoned about independently of the render tree.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SkillId } from '../learning/skills';
import { hintLevelFor, hintText, hintsFor, type HintLevel } from '../learning/hints';
import { shouldAskConfidence, type Confidence } from '../learning/confidence';
import type { Lang } from '../i18n/strings';

export interface ScaffoldState {
  /** Seconds the current question has been on screen. */
  elapsed: number;
  /** Hint level currently visible, 0 when none. */
  hintLevel: HintLevel;
  /** Hint copy for the active level, or null. */
  hintLine: string | null;
  /** True while the once-per-session confidence prompt is showing. */
  askingConfidence: boolean;
  /**
   * Whether the answer about to be submitted was given with support on screen.
   * Recorded on the attempt so a scaffolded success cannot inflate mastery.
   */
  wasScaffolded: boolean;
}

export interface ScaffoldActions {
  /** Call when the learner answers incorrectly but may retry. */
  noteWrongAttempt: () => void;
  /** Call when moving to the next question. */
  reset: () => void;
  /** Mark the next answer as scaffolded (e.g. after a worked example). */
  markScaffolded: () => void;
  /** Record the learner's confidence and dismiss the prompt. */
  answerConfidence: (level: Confidence) => void;
  /** Should the confidence prompt intercept this submission? */
  shouldInterceptForConfidence: () => boolean;
  /** Confidence given for the current question, if any. */
  takeConfidence: () => Confidence | null;
}

export function usePracticeScaffolds(args: {
  skill: SkillId | null;
  mastery: number;
  lang: Lang;
  questionIndex: number;
  sessionLength: number;
  /** Paused while the answer is locked or a worked example is showing. */
  paused: boolean;
  /** Blitz opts out entirely: it is a timed race the child chose. */
  disabled?: boolean;
}): ScaffoldState & ScaffoldActions {
  const { skill, mastery, lang, questionIndex, sessionLength, paused, disabled } = args;

  const [elapsed, setElapsed] = useState(0);
  const [askingConfidence, setAskingConfidence] = useState(false);
  const wrongAttempts = useRef(0);
  const scaffolded = useRef(false);
  const confidence = useRef<Confidence | null>(null);
  const confidenceAsked = useRef(false);

  // Time on task drives hint escalation. This ticker runs whether or not the
  // countdown timer is enabled, because hints are not a time limit — they are
  // support, and a child with the timer off still deserves them.
  useEffect(() => {
    if (paused || disabled) return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [questionIndex, paused, disabled]);

  const reset = useCallback(() => {
    setElapsed(0);
    wrongAttempts.current = 0;
    scaffolded.current = false;
    confidence.current = null;
    setAskingConfidence(false);
  }, []);

  const hintLevel: HintLevel = (paused || disabled || !skill)
    ? 0
    : hintLevelFor({
        elapsedSeconds: elapsed,
        wrongAttempts: wrongAttempts.current,
        mastery,
        hasCopy: !!hintsFor(skill),
      });

  const hintLine = skill ? hintText(skill, hintLevel, lang) : null;

  // A hint on screen means the next answer is supported, whether or not the
  // child consciously used it. Attributing unaided performance to a supported
  // answer is the failure this prevents.
  if (hintLevel > 0) scaffolded.current = true;

  return {
    elapsed,
    hintLevel,
    hintLine,
    askingConfidence,
    wasScaffolded: scaffolded.current,

    noteWrongAttempt: useCallback(() => { wrongAttempts.current += 1; }, []),
    reset,
    markScaffolded: useCallback(() => { scaffolded.current = true; }, []),

    answerConfidence: useCallback((level: Confidence) => {
      confidence.current = level;
      setAskingConfidence(false);
    }, []),

    shouldInterceptForConfidence: useCallback(() => {
      if (disabled || confidenceAsked.current) return false;
      if (!shouldAskConfidence(questionIndex, sessionLength)) return false;
      confidenceAsked.current = true;
      setAskingConfidence(true);
      return true;
    }, [disabled, questionIndex, sessionLength]),

    takeConfidence: useCallback(() => {
      const c = confidence.current;
      confidence.current = null;
      return c;
    }, []),
  };
}
