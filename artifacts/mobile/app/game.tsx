import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Platform, ScrollView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGame, CLASS_CONFIGS, CATEGORY_META, ChoiceValue } from '@/context/GameContext';
import { MISCONCEPTIONS } from '@/learning/misconceptions';
import { MISCONCEPTIONS_HI } from '@/i18n/misconceptions-hi';
import { t, categoryLabel } from '@/i18n/strings';
import { CLASS_LABELS } from '@/curriculum/boards';
import { useMotion, FEEDBACK_MS, feedbackDelay, readingDelay } from '@/hooks/useMotion';
import { useAnnounce, touchSlop } from '@/hooks/useA11y';
import { AnswerSurface } from '@/components/answer/AnswerSurface';
import { grade, expectedAnswer } from '@/generators/interactions';
import { praiseFor, praiseText } from '@/learning/feedback';
import { BONUS_LABEL } from '@/progression/labels';
import { QuestionVisual } from '@/components/visuals/QuestionVisual';
import { Celebration } from '@/components/Celebration';
import { MASTERED_THRESHOLD } from '@/learning/mastery';
import { SKILLS } from '@/learning/skills';
import { useSpeech, readAloudDefault } from '@/hooks/useSpeech';
import { playSound } from '@/hooks/useFeedbackSound';
import { Mascot } from '@/components/Mascot';
import { classTextTone } from '@/generators';
import { skillLabel } from '@/i18n/skills-hi';
import { hintLevelFor, hintText, hintsFor, needsDescentNotHints } from '@/learning/hints';
import {
  shouldAskConfidence, quadrant, CONFIDENCE_COPY,
  type Confidence, type ConfidenceQuadrant,
} from '@/learning/confidence';
import type { HintLevel } from '@/learning/hints';
import { decideAdaptation } from '@/learning/adaptation';
import { shouldTeach, hasFaded, buildWorkedExample, canTeach } from '@/learning/workedExamples';
import {
  shouldAskWhy, buildWhyPrompt, whyFeedback,
  type SelfExplanationPrompt, type SelfExplanationOption,
} from '@/learning/selfExplanation';
import type { WorkedExample as WEType } from '@/learning/workedExamples';
import { WorkedExample } from '@/components/WorkedExample';
import { extractOperands } from '@/learning/misconceptions';
import type { Attempt } from '@/learning/attempts';
import { useTheme } from '@/theme/useTheme';

const PER_Q_SECS = 15;
/**
 * Constructed-response questions (typing, selecting a set, building a sequence)
 * take substantially longer than tapping one of four tiles. Applying the same
 * budget would penalise the harder — and more valuable — modality.
 */
const CONSTRUCTED_SECS = 45;
/** Seconds allowed for a question, by interaction type. */
function secondsFor(q?: { interaction?: { kind: string } }): number {
  const kind = q?.interaction?.kind;
  return !kind || kind === 'choice' ? PER_Q_SECS : CONSTRUCTED_SECS;
}
const BLITZ_SECS = 60;

/**
 * Legacy palette keys, resolved reactively from the theme.
 *
 * docs/20 F1: `const C = colors.light` was evaluated once at import, so this
 * screen could never honour the dark preference the app already exposed. This
 * keeps the same key names — so the StyleSheet below is unchanged — while
 * making them re-render with the theme.
 */
function useLegacyPalette() {
  const { c } = useTheme();
  return React.useMemo(() => ({
    text: c.text, tint: c.primary, background: c.bg, foreground: c.text,
    card: c.surface, cardForeground: c.text,
    primary: c.primary, primaryForeground: c.primaryOn,
    secondary: c.surfaceSunken, secondaryForeground: c.text,
    muted: c.surfaceSunken, mutedForeground: c.textMuted,
    accent: c.primary, accentForeground: c.primaryOn,
    destructive: c.wrong, destructiveForeground: c.wrongOn,
    border: c.border, input: c.border,
    easy: c.correct, medium: c.attention, hard: c.wrong,
    correct: c.correct, wrong: c.wrong, timerWarning: c.attention,
    gold: c.attention, silver: c.textMuted, bronze: c.attention,
    catAddition: c.correct, catSubtraction: c.attention,
    catMultiplication: c.primary, catDivision: c.correct,
    catMixed: c.attention, catTables: c.primary,
  }), [c]);
}

type AnswerState = 'idle' | 'correct' | 'wrong';

function formatChoice(v: ChoiceValue): string {
  if (typeof v === 'string') return v;
  // Format decimals nicely
  if (!Number.isInteger(v)) return v.toFixed(2).replace(/\.?0+$/, '');
  // Format negative numbers
  return String(v);
}

export default function GameScreen() {
  const C = useLegacyPalette();
  const { name: themeName } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const router  = useRouter();
  const {
    questions, currentIndex, totalQuestions, sessionType,
    submitAnswer, nextQuestion, endGame, isGameOver,
    score, selectedClass, selectedCategory, isTablesMode,
    saveProgressStats, saveScore, wrongAnswers, recordAttempt, lang, timerOn,
    mastery, sessionSkillFor, retargetNext, attempts, selectedClass: cls,
    lastAward,
  } = useGame();

  // Motion is routed through useMotion so "reduce motion" is honoured without
  // every call site remembering; a11yAnnounce speaks results to screen readers,
  // which otherwise get no feedback from a colour change.
  const motion = useMotion();
  const a11yAnnounce = useAnnounce();

  const isBlitz = sessionType === 'timed60' && !isTablesMode;

  const [answerState,    setAnswerState]    = useState<AnswerState>('idle');
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [perQLocked,     setPerQLocked]     = useState(false);
  /**
   * Synchronous mirror of `perQLocked`, for the submit guard.
   *
   * docs/23 F8. `perQLocked` is React state read through the render closure,
   * so two handlers firing in the SAME tick both observe the stale `false` and
   * both submit — verified: two calls, two log rows, XP paid twice for one
   * question. A ref changes at the moment of assignment, which is the only
   * thing that can close a same-tick window.
   */
  const submitLockRef = useRef(false);
  /**
   * Self-explanation (docs/27 P1-13).
   *
   * Shown after a DIAGNOSED error and before the explanation is revealed:
   * retrieving the reason yourself produces more learning than being told it,
   * and the app previously only ever told.
   */
  // docs/28: crossing a skill into "secure" is the single thing this app
  // exists to do, and it was communicated only by a progress bar changing
  // width on a screen the child sees after the session has ended. Firing it
  // at the moment it happens makes it the signature celebration.
  // docs/28: read-aloud. On by default for Class 1-2, where decoding the
  // question is a barrier rather than the task; available to everyone via the
  // speaker button beside the question.
  const readAloud = readAloudDefault(cls);
  const { speak, stop: stopSpeech } = useSpeech(readAloud, lang);
  const [masteryWin, setMasteryWin] = useState<string | null>(null);
  const masteryShownRef = useRef<Set<string>>(new Set());
  const [whyPrompt, setWhyPrompt] = useState<SelfExplanationPrompt | null>(null);
  const [whyAnswer, setWhyAnswer] = useState<string | null>(null);
  const whyShownRef = useRef(0);
  const [perQTime,       setPerQTime]       = useState(PER_Q_SECS);
  const [perQBudget,     setPerQBudget]     = useState(PER_Q_SECS);
  const [blitzTime,      setBlitzTime]      = useState(BLITZ_SECS);

  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  /** When the current question was first shown — used to measure response latency. */
  const shownAtRef    = useRef<number>(Date.now());
  /** Misconception detected for the current question, surfaced as a hint. */
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  /** Process praise for the current correct answer (§9 M3). */
  const [praise, setPraise] = useState<string | null>(null);
  /** Was the previous answer in this session wrong? Drives 'recovery' praise. */
  const lastWrongRef = useRef(false);
  /** Worked example currently on screen, if any (§1). */
  const [worked, setWorked] = useState<WEType | null>(null);
  /** Attempts made in *this* session only — adaptation is per-session. */
  const sessionLogRef = useRef<Attempt[]>([]);
  /** Attempt-count at which each skill last taught, for the cooldown. */
  const taughtAtRef = useRef<Record<string, number[]>>({});
  /**
   * True while the *next* answer will have been given with support on screen.
   * Set when a worked example is dismissed, cleared once its twin is answered,
   * so a scaffolded success is recorded honestly rather than inflating mastery.
   */
  const scaffoldedRef = useRef(false);
  /** Seconds the current question has been on screen, for time-triggered hints. */
  const [elapsed, setElapsed] = useState(0);
  /** Wrong attempts on the current question (constructed answers allow retries). */
  const wrongHereRef = useRef(0);
  /**
   * Hint level currently on screen.
   *
   * Held in a ref as well as computed at render because `handleSubmit` needs it
   * and is defined before the render-time calculation. Closing over the const
   * directly would be a temporal-dead-zone hazard that happens to work only
   * because the handler runs after render — fragile, and invisible to the
   * typechecker.
   */
  const hintLevelRef = useRef<HintLevel>(0);
  /**
   * Confidence prompt (docs/14 §5C).
   *
   * Asked ONCE per session on one mid-session item, never per question — that
   * would double the interaction cost of the whole product for a signal only
   * interesting in aggregate. The valuable cell is confident-and-wrong: a child
   * who is unsure and wrong will accept correction, one who is certain and
   * wrong has no reason to revise.
   */
  const [askConfidence, setAskConfidence] = useState(false);
  /** Answer held while the confidence prompt is on screen. */
  const pendingAnswerRef = useRef<string | null>(null);
  const confidenceRef = useRef<Confidence | null>(null);
  /** Quadrants observed this session, surfaced on the results screen. */
  const confidenceLogRef = useRef<{ skill: string; quadrant: ConfidenceQuadrant }[]>([]);
  const shakeAnimRef  = useRef<Animated.Value | null>(null);
  const fadeAnimRef   = useRef<Animated.Value | null>(null);
  const scaleAnimRef  = useRef<Animated.Value | null>(null);
  const shakeAnim = shakeAnimRef.current ?? (shakeAnimRef.current = new Animated.Value(0));
  const fadeAnim  = fadeAnimRef.current  ?? (fadeAnimRef.current  = new Animated.Value(1));
  const scaleAnim = scaleAnimRef.current ?? (scaleAnimRef.current = new Animated.Value(1));

  const currentQuestion = questions[currentIndex];

  // Speak each new question once it is on screen. Keyed on the index rather
  // than the text so two identical questions in a row are both read.
  useEffect(() => {
    const q = questions[currentIndex];
    if (q && readAloud) speak(q.questionText);
    return () => stopSpeech();
  }, [currentIndex, questions, readAloud, speak, stopSpeech]);
  const classConfig     = CLASS_CONFIGS.find(c => c.key === selectedClass);
  const classColor      = classConfig?.color ?? C.primary;
  // Fill vs text: the pastel is only safe as a wash (docs/28).
  const classTextColor  = classConfig ? classTextTone(classConfig, themeName) : C.primary;
  // The skill this question is actually practising, in the child's language.
  const activeSkillId = sessionSkillFor(currentIndex);
  const activeSkillLabel = activeSkillId && SKILLS[activeSkillId]
    ? skillLabel(activeSkillId, SKILLS[activeSkillId].label, lang)
    : undefined;
  // In adaptive and Mixed sessions the topic changes per question, so label the
  // question actually on screen rather than the session's nominal category.
  const activeCategory  = currentQuestion?.resolvedCategory ?? selectedCategory;
  const catMeta         = isTablesMode ? CATEGORY_META['tables'] : CATEGORY_META[activeCategory];

  // ─── Timers ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isBlitz) return;
    timerRef.current = setInterval(() => {
      setBlitzTime(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []); // eslint-disable-line

  const handleTimeUp = useCallback(() => {
    if (submitLockRef.current || perQLocked) return;
    const q = questions[currentIndex];
    submitLockRef.current = true;
    setPerQLocked(true);
    setAnswerState('wrong');
    lastWrongRef.current = true;
    // C12: pass the resolved category so Mixed sessions attribute the miss to
    // the real topic rather than to the literal category "mixed".
    saveProgressStats(false, q?.resolvedCategory);
    if (q) {
      recordAttempt({
        question: q, chosen: '', correct: false,
        latencyMs: Date.now() - shownAtRef.current, timedOut: true,
      });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    shake(() => setTimeout(advanceQuestion, 600));
  }, [perQLocked, questions, currentIndex]); // eslint-disable-line

  useEffect(() => {
    // §9 M1: below Class 3 (or whenever the learner has turned it off) no
    // countdown runs at all. The child simply thinks until they answer.
    if (isBlitz || perQLocked || !timerOn) return;
    timerRef.current = setInterval(() => {
      setPerQTime(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentIndex, perQLocked, isBlitz, timerOn]); // eslint-disable-line

  // §4 — hints are earned by TIME, not requested on demand. A visible hint
  // button produces help-avoidance in anxious children and help-abuse in
  // others; a clock removes the asymmetry. This ticker runs regardless of
  // whether the countdown timer is on, because hints are not a time limit.
  useEffect(() => {
    if (perQLocked || worked) return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [currentIndex, perQLocked, worked]);

  // Restart the latency clock and the time budget whenever a question is shown.
  useEffect(() => {
    shownAtRef.current = Date.now();
    const budget = secondsFor(questions[currentIndex]);
    setPerQBudget(budget);
    setPerQTime(budget);
  }, [currentIndex, questions]);

  useEffect(() => {
    if (isGameOver) router.replace('/results');
  }, [isGameOver]); // eslint-disable-line

  // ─── Animations ───────────────────────────────────────────────────────────

  // Under reduced motion this completes instantly, but still fires `cb`, so the
  // flow continues and the wrong answer is still reported.
  const shake = (cb?: () => void) => motion.shake(shakeAnim).start(cb);

  const advanceQuestion = () => {
    Animated.parallel([
      motion.timing(fadeAnim,  { toValue: 0,    duration: 120 }),
      motion.timing(scaleAnim, { toValue: 0.95, duration: 120 }),
    ]).start(() => {
      nextQuestion();
      setAnswerState('idle');
      setSelectedChoice(null);
      submitLockRef.current = false;
      setWhyPrompt(null);
      setWhyAnswer(null);
      setPerQLocked(false);
      setPerQTime(secondsFor(questions[currentIndex + 1]));
      setPerQBudget(secondsFor(questions[currentIndex + 1]));
      setDiagnosis(null);
      setPraise(null);
      setElapsed(0);
      wrongHereRef.current = 0;
      hintLevelRef.current = 0;
      scaffoldedRef.current = false;
      shownAtRef.current = Date.now();
      Animated.parallel([
        motion.timing(fadeAnim,  { toValue: 1, duration: 180 }),
        motion.timing(scaleAnim, { toValue: 1, duration: 180 }),
      ]).start();
    });
  };

  // ─── Answer handler ───────────────────────────────────────────────────────

  /**
   * Handle a submitted answer from any interaction surface.
   *
   * The surface has already normalised its answer to a comparable string, so
   * this path is identical for tapping a tile, typing on a keypad, selecting a
   * set or building a sequence.
   */
  const handleSubmit = (normalised: string) => {
    if (submitLockRef.current || perQLocked || !currentQuestion) return;
    // Ask before revealing the outcome: a confidence rating collected after the
    // child already knows whether they were right measures memory of the
    // result, not their belief at the moment of answering.
    if (!isBlitz && confidenceRef.current === null
        && shouldAskConfidence(currentIndex, totalQuestions)) {
      pendingAnswerRef.current = normalised;
      setAskConfidence(true);
      return;
    }
    if (!isBlitz && timerRef.current) clearInterval(timerRef.current);
    // Lock synchronously BEFORE any await-able work, so a second tap in this
    // same tick is rejected rather than racing the state update.
    submitLockRef.current = true;
    setPerQLocked(true);
    setSelectedChoice(normalised);

    const latencyMs = Date.now() - shownAtRef.current;
    const correct = grade(currentQuestion, normalised);

    // A correct answer given with a hint on screen is real, but it is not
    // unaided performance. Recording it as scaffolded halves its weight in the
    // mastery estimate, so support can never inflate the picture of what the
    // child can do alone.
    if (hintLevelRef.current > 0) scaffoldedRef.current = true;
    if (!correct) wrongHereRef.current += 1;

    // Pass the grade explicitly: composite answers ("2,3,6") cannot be
    // compared against q.answer by the store's simple string equality.
    submitAnswer(normalised, correct);
    saveProgressStats(correct, currentQuestion.resolvedCategory);

    // Direction D: capture what was chosen and diagnose the underlying error.
    const found = recordAttempt({
      question: currentQuestion, chosen: normalised, correct, latencyMs, timedOut: false,
      scaffolded: scaffoldedRef.current,
    });
    setDiagnosis(correct ? null : found);
    setAnswerState(correct ? 'correct' : 'wrong');

    // docs/27 P1-13. Ask the child to name the cause before showing it.
    const skillForWhy = sessionSkillFor(currentIndex);
    if (!correct && skillForWhy && shouldAskWhy({
      misconception: found, skill: skillForWhy,
      sessionLog: sessionLogRef.current, shownThisSession: whyShownRef.current,
    })) {
      const prompt = buildWhyPrompt({ skill: skillForWhy, misconception: found! });
      if (prompt) {
        whyShownRef.current += 1;
        setWhyAnswer(null);
        setWhyPrompt(prompt);
      }
    }

    // Mirror the attempt into a session-local log. The context log is
    // debounced and async; in-session adaptation must react to the answer that
    // was just given, not the one that has finished persisting.
    const skillNow = sessionSkillFor(currentIndex);
    if (skillNow && confidenceRef.current) {
      confidenceLogRef.current.push({
        skill: skillNow,
        quadrant: quadrant(confidenceRef.current, correct),
      });
      confidenceRef.current = null;
    }
    if (skillNow) {
      sessionLogRef.current = [...sessionLogRef.current, {
        skill: skillNow, correct, answeredAt: Date.now(), latencyMs,
        chosen: normalised, expected: String(currentQuestion.answer),
        questionText: currentQuestion.questionText, timedOut: false,
        misconception: found ?? undefined,
        interaction: currentQuestion.interaction?.kind ?? 'choice',
        scaffolded: scaffoldedRef.current || undefined,
        cls, category: currentQuestion.resolvedCategory ?? selectedCategory,
        difficulty: 'medium',
      }];
    }

    // Mastery crossing: fire once per skill per session, only on a correct
    // unaided answer, and never in Blitz (a 60s race is the wrong place to
    // stop and celebrate).
    if (correct && skillNow && !isBlitz && !scaffoldedRef.current
        && !masteryShownRef.current.has(skillNow)) {
      const before = mastery[skillNow]?.value ?? 0;
      const rows = sessionLogRef.current.filter(r => r.skill === skillNow);
      const hits = rows.filter(r => r.correct).length;
      // Approximate the post-answer estimate: the context updates async, so
      // reading `mastery` here would be one answer stale.
      const after = before + (1 - before) * 0.12;
      if (before < MASTERED_THRESHOLD && after >= MASTERED_THRESHOLD && hits >= 3) {
        masteryShownRef.current.add(skillNow);
        const label = SKILLS[skillNow]
          ? skillLabel(skillNow, SKILLS[skillNow].label, lang)
          : skillNow;
        playSound('celebrate');
        setMasteryWin(lang === 'hi' ? `${label} पक्का हुआ!` : `${label} is secure!`);
      }
    }

    if (correct) {
      // §9 M3 — name what the learner *did*, not that they were right.
      // Outcome praise reliably produces fixed-mindset attribution; process
      // praise names something the child controls and can repeat.
      const kind = praiseFor({
        mastery: (skillNow ? mastery[skillNow]?.value : undefined) ?? 0.5,
        latencyMs,
        afterMistake: lastWrongRef.current,
        scaffolded: scaffoldedRef.current,
      });
      const line = praiseText(kind, lang);
      // 'plain' is a bare acknowledgement — showing it would be outcome praise
      // in a box, which is the thing §9 M3 exists to remove. Only a line that
      // actually names a process earns screen space and reading time.
      const worthShowing = kind !== 'plain' && !isBlitz;
      setPraise(worthShowing ? line : null);
      lastWrongRef.current = false;
      playSound('correct');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      a11yAnnounce(line);
      // 280 ms is right for a bare tick, but too short to read a sentence —
      // measured in-browser, the praise line was painted and gone. Extended
      // only when there is something to read, so the fast path is preserved.
      const pause = worthShowing
        ? readingDelay(FEEDBACK_MS.correctPraised, motion.reduced)
        : feedbackDelay(
            isBlitz ? FEEDBACK_MS.correctBlitz : FEEDBACK_MS.correct, motion.reduced);
      motion.pulse(scaleAnim, 1.03).start(() => setTimeout(advanceQuestion, pause));
    } else {
      lastWrongRef.current = true;
      playSound('wrong');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      a11yAnnounce(
        (lang === 'hi' ? 'गलत। सही उत्तर ' : 'Incorrect. The answer is ')
        + expectedAnswer(currentQuestion));
      // Wrong answers keep a longer pause on purpose: the child needs time to
      // read the diagnosis. Rushing past a mistake defeats the point of
      // detecting it. Constructed responses reveal the solution, so longer again.
      const isConstructed = !!currentQuestion.interaction && currentQuestion.interaction.kind !== 'choice';
      const pause = feedbackDelay(
        isConstructed ? FEEDBACK_MS.wrongConstructed
        : isBlitz ? FEEDBACK_MS.wrongBlitz : FEEDBACK_MS.wrong,
        motion.reduced);

      // Blitz is exempt from all of this. It is a 60-second race the child
      // chose; stopping to teach mid-race would be both unwelcome and unread.
      const intervention = isBlitz ? null : planIntervention(skillNow, found);
      if (intervention?.kind === 'teach' && intervention.example) {
        // Hold the question on screen and teach. `advanceQuestion` is deferred
        // until the child dismisses the worked example.
        shake(() => setTimeout(() => setWorked(intervention.example!), pause));
      } else {
        shake(() => setTimeout(advanceQuestion, pause));
      }
    }
  };

  /**
   * Decide what should happen after a wrong answer (§1 and §3).
   *
   * Returns a worked example to show, or null when the session should simply
   * continue — possibly after quietly retargeting the next question to a
   * prerequisite or a confidence item, neither of which the child perceives.
   */
  const planIntervention = (
    skill: string | null,
    misconception: string | null,
  ): { kind: 'teach'; example: WEType | null } | { kind: 'continue' } | null => {
    if (!skill) return null;

    const decision = decideAdaptation({
      sessionLog: sessionLogRef.current,
      currentSkill: skill,
      estimates: mastery,
      candidates: Object.keys(mastery),
    });

    // M2/M3 — invisible: the plan changes, the interface does not.
    if (decision.kind === 'descend' || decision.kind === 'confidence') {
      retargetNext(decision.skill, decision.kind === 'descend' ? 'easy' : undefined);
      return { kind: 'continue' };
    }

    // §1 — teach only when practice cannot fix it and the gates all pass.
    const teachable = decision.kind === 'teach' && canTeach(skill);
    if (!teachable) return { kind: 'continue' };

    // D2 · every intervention must terminate. Two consecutive correct answers
    // on this skill since teaching means the scaffold has done its job, and
    // support that does not withdraw produces dependence. This is the precise
    // fade condition; the 20-attempt cooldown inside shouldTeach is the blunt
    // backstop for skills that were never taught in this session at all.
    if (taughtAtRef.current[skill]?.length && hasFaded(sessionLogRef.current, skill)) {
      return { kind: 'continue' };
    }

    const allow = shouldTeach({
      skill,
      sessionLog: sessionLogRef.current,
      log: attempts,
      estimates: mastery,
      taughtAt: taughtAtRef.current[skill] ?? [],
    });
    if (!allow) return { kind: 'continue' };

    const q = questions[currentIndex];
    const example = buildWorkedExample({
      skill,
      questionText: q.questionText,
      operands: extractOperands(q.questionText),
      answer: Number(q.answer),
      chosen: selectedChoice ?? undefined,
      misconception: misconception ?? undefined,
      explain: (id, l) => {
        const hi = MISCONCEPTIONS_HI[id];
        const info = l === 'hi' && hi ? hi : MISCONCEPTIONS[id];
        return info?.explanation;
      },
    });
    if (!example) return { kind: 'continue' };

    // Record the teaching event for the cooldown, then serve a twin: same
    // skill and difficulty, new operands. Applying the method immediately is
    // the completion-problem step, and it is what earns the fade.
    const seen = attempts.filter(a => a.skill === skill).length;
    taughtAtRef.current[skill] = [...(taughtAtRef.current[skill] ?? []), seen];
    retargetNext(skill);

    return { kind: 'teach', example };
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!currentQuestion) return null;

  // §4 · contingent scaffolding. The level rises with time on task and with
  // wrong attempts, and the delays lengthen as mastery grows until hints stop
  // appearing at all above 0.80.
  const hintSkill = sessionSkillFor(currentIndex);
  const hintMastery = (hintSkill ? mastery[hintSkill]?.value : undefined) ?? 0.5;
  const hintLevel: HintLevel = (perQLocked || worked || !hintSkill) ? 0 : hintLevelFor({
    elapsedSeconds: elapsed,
    wrongAttempts: wrongHereRef.current,
    mastery: hintMastery,
    hasCopy: !!hintsFor(hintSkill),
  });
  const hintLine = hintSkill ? hintText(hintSkill, hintLevel, lang) : null;
  hintLevelRef.current = hintLevel;

  const top = Platform.OS === 'web' ? 67 : insets.top;
  const bot = Platform.OS === 'web' ? 34 : insets.bottom;

  const timerPct   = isBlitz ? blitzTime / BLITZ_SECS : perQTime / perQBudget;
  const timerVal   = isBlitz ? blitzTime : perQTime;
  const timerColor = timerPct > 0.5 ? C.easy : timerPct > 0.25 ? C.medium : C.hard;

  // Adapt question text font size to length
  const qtLen = currentQuestion.questionText.length;
  const qFontSize = qtLen > 80 ? 16 : qtLen > 50 ? 19 : qtLen > 30 ? 24 : qtLen > 18 ? 32 : 44;
  const isLongQuestion = qtLen > 40;

  // Detect if choices are strings (not numbers)
  const hasStringChoices = currentQuestion.choices.some(c => typeof c === 'string');
  const choiceFontSize = hasStringChoices ? 16 : currentQuestion.choices.some(c => Math.abs(c as number) > 999) ? 22 : 28;

  /**
   * Is the outcome revealed yet?
   *
   * docs/27 P1-13. While a self-explanation prompt is open, nothing may show
   * which answer was right — highlighting the correct tile turns retrieval
   * into reading, and the child has nothing left to work out. Caught by
   * looking at a render: the prompt was correct and the screen defeated it.
   */
  const revealing = !whyPrompt || whyAnswer !== null;

  const choiceStyle = (choice: ChoiceValue) => {
    const base = [styles.choiceBtn, hasStringChoices && styles.choiceBtnText];
    if (!perQLocked) return base;
    if (!revealing) return base;
    if (String(choice) === String(currentQuestion.answer)) return [...base, styles.choiceCorrect];
    if (String(choice) === String(selectedChoice) && answerState === 'wrong') {
      return [...base, styles.choiceWrong];
    }
    return [...base, styles.choiceDim];
  };
  const choiceTextColor = (choice: ChoiceValue) => {
    if (!perQLocked || !revealing) return C.foreground;
    if (String(choice) === String(currentQuestion.answer)) return C.correct;
    if (String(choice) === String(selectedChoice)) return C.wrong;
    return C.mutedForeground;
  };

  return (
    <View style={[styles.container, { paddingTop: top, paddingBottom: bot + 16 }]}>
      {/* docs/28: mastery is the app's signature moment and had no moment. */}
      {masteryWin && (
        <Celebration
          visible
          reason="mastery"
          message={masteryWin}
          onDone={() => setMasteryWin(null)}
        />
      )}
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => {
            // Pause the running timer
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            Alert.alert(
              t('leaveGame', lang),
              t('leaveGameBody', lang),
              [
                { text: t('keepPlaying', lang), style: 'cancel' },
                {
                  text: t('quit', lang),
                  style: 'destructive',
                  onPress: () => { if (score > 0 || wrongAnswers.length > 0) saveScore(); router.back(); },
                },
              ],
            );
          }}
          style={styles.xBtn}
          hitSlop={touchSlop(40)}
          accessibilityRole="button"
          accessibilityLabel="Leave practice"
        >
          <Feather name="x" size={20} color={C.mutedForeground} />
        </TouchableOpacity>
        <View style={styles.topMid}>
          <View style={[styles.pill, { backgroundColor: classColor + '22' }]}>
            <Text style={[styles.pillText, { color: classTextColor }]}>{classConfig ? CLASS_LABELS[classConfig.key][lang === 'hi' ? 'hi' : 'en'] : ''}</Text>
          </View>
          {/* docs/28 item 39: the chip named the CATEGORY ("Addition"), which
              is true of half the app. Naming the SKILL tells the child what
              this particular stretch of questions is for, which is the whole
              claim the adaptive engine is making and was invisible to them. */}
          <View style={[styles.pill, { backgroundColor: catMeta.color + '22' }]}>
            <Text style={[styles.pillText, { color: catMeta.color }]} numberOfLines={1}>
              {isTablesMode
                ? t('timesTables', lang).replace('\n', ' ')
                : (activeSkillLabel ?? categoryLabel(activeCategory, lang))}
            </Text>
          </View>
        </View>
        <View style={styles.scorePill}>
          <Feather name="star" size={13} color={C.gold} />
          <Text style={styles.scoreText}>{score}</Text>
        </View>
      </View>

      {/* Progress bar (non-blitz) */}
      {!isBlitz && (
        <View style={styles.progressRow}>
          {/* docs/28: a 4px continuous bar gave no sense of "how many left".
              Segments are countable — a child can SEE three done and seven to
              go without reading "3/10", which is the same reason Duolingo and
              Khan use discrete steps. Caps at 20 so a 60q Blitz-length session
              never renders slivers. */}
          <View style={styles.progressTrack}>
            {Array.from({ length: Math.min(totalQuestions, 20) }).map((_, i) => {
              const scale = totalQuestions / Math.min(totalQuestions, 20);
              const done = i < Math.floor(currentIndex / scale);
              const active = i === Math.floor(currentIndex / scale);
              return (
                <View
                  key={i}
                  style={[
                    styles.progressSeg,
                    { backgroundColor: done ? classColor : active ? classColor + '66' : C.border },
                  ]}
                />
              );
            })}
          </View>
          <Text style={styles.progressLabel}>{currentIndex + 1}/{totalQuestions}</Text>
        </View>
      )}

      {/* Timer bar — absent entirely when timing is off, rather than shown
          frozen. A stationary countdown still reads as being watched. */}
      {(timerOn || isBlitz) && (
        <View style={styles.timerRow}>
          <View style={styles.timerTrack}>
            <View style={[styles.timerFill, {
              width: `${timerPct * 100}%` as unknown as number,
              backgroundColor: timerColor,
            }]} />
          </View>
          <Text style={[styles.timerText, { color: timerColor }]}>{timerVal}s</Text>
        </View>
      )}

      {/* Question card */}
      <Animated.View style={[
        styles.qCard,
        { borderColor: classColor + '44', opacity: fadeAnim,
          transform: [{ scale: scaleAnim }, { translateX: shakeAnim }] },
        isLongQuestion && styles.qCardTall,
      ]}>
        {isBlitz && <Text style={styles.blitzCount}>#{currentIndex + 1}</Text>}
        <ScrollView
          scrollEnabled={isLongQuestion}
          contentContainerStyle={[styles.qScrollInner, !isLongQuestion && styles.qScrollCenter]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.qText, { fontSize: qFontSize, lineHeight: Math.round(qFontSize * 1.45) }]}>
            {currentQuestion.questionText}
          </Text>
        </ScrollView>
        {/* Always available, not only when auto-read is on: a child who missed
            it, or whose parent turned auto-read off, still needs a way to hear
            the question. Labelled for screen readers as a distinct action. */}
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync().catch(() => {}); speak(currentQuestion.questionText); }}
          style={styles.speakBtn}
          hitSlop={touchSlop(40)}
          accessibilityRole="button"
          accessibilityLabel={lang === 'hi' ? 'सवाल सुनें · Read aloud' : 'Read the question aloud'}
        >
          <Feather name="volume-2" size={18} color={C.mutedForeground} />
        </TouchableOpacity>
      </Animated.View>

      {/* Answer grid */}
      {/* §5C — one prompt, one session, two taps. Shown BEFORE the outcome is
          revealed, so it captures belief rather than recall of the result. */}
      {askConfidence && (
        <View style={styles.confidenceBox} accessibilityLiveRegion="polite">
          <Text style={styles.confidencePrompt}>
            {lang === 'hi' ? CONFIDENCE_COPY.prompt.hi : CONFIDENCE_COPY.prompt.en}
          </Text>
          <View style={styles.confidenceRow}>
            {(['sure', 'unsure'] as const).map(level => (
              <TouchableOpacity
                key={level}
                style={styles.confidenceBtn}
                onPress={() => {
                  Haptics.selectionAsync();
                  confidenceRef.current = level;
                  setAskConfidence(false);
                  const held = pendingAnswerRef.current;
                  pendingAnswerRef.current = null;
                  if (held !== null) handleSubmit(held);
                }}
                accessibilityRole="button"
                accessibilityLabel={lang === 'hi' ? CONFIDENCE_COPY[level].hi : CONFIDENCE_COPY[level].en}
              >
                <Text style={styles.confidenceBtnText}>
                  {lang === 'hi' ? CONFIDENCE_COPY[level].hi : CONFIDENCE_COPY[level].en}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* §4 — a single calm line. No modal, no button, no interruption; the
          child may ignore it entirely. It never contains the answer: level 3
          stops exactly one step short, because a hint that finishes the problem
          removes the productive struggle where the learning happens. */}
      {!!hintLine && (
        <View style={styles.hintBox} accessibilityLiveRegion="polite">
          {/* docs/28 item 44: a hint delivered by a question-mark glyph is the
              system talking. The same words from the character are a helper
              talking, which is a materially different thing to accept help
              from when you are seven and stuck. */}
          <Mascot mood="encouraging" size={40} />
          <Text style={styles.hintText}>{hintLine}</Text>
        </View>
      )}

      {/* docs/14 §2 — the Concrete→Pictorial stage the audit found entirely
          absent. Fades automatically with mastery: interactive below 0.55,
          illustrative to 0.80, gone above. Hidden while a worked example is on
          screen, which carries its own diagram. */}
      {/* A manipulative IS a ten-frame the child builds, so drawing the
          illustrative frame above it renders the same model twice on one
          screen — measured in a browser: two frames, one filled and one
          empty, with the question between them. The interaction owns the
          representation whenever it is a manipulative. */}
      {!worked && currentQuestion.interaction?.kind !== 'manipulative' && (
        <QuestionVisual
          question={currentQuestion}
          skill={sessionSkillFor(currentIndex)}
          mastery={(() => {
            const sk = sessionSkillFor(currentIndex);
            return (sk ? mastery[sk]?.value : undefined) ?? 0.5;
          })()}
          showState={answerState === 'idle' ? 'idle' : answerState}
        />
      )}

      {/* §1 — while a worked example is up it takes the place of the answer
          surface entirely. Leaving the options visible would invite the child
          to guess again instead of reading the method. */}
      {worked ? (
        <WorkedExample
          example={worked}
          lang={lang}
          onDone={() => {
            setWorked(null);
            // The next question is the twin: same structure, new numbers. It
            // counts as scaffolded, so succeeding on it does not overstate
            // what the learner can do unaided.
            scaffoldedRef.current = true;
            advanceQuestion();
          }}
        />
      ) : (
        <AnswerSurface
          question={currentQuestion}
          // `locked` is what drives AnswerSurface's tile states — correct,
          // revealed, wrong — so holding it back is what actually withholds
          // the reveal during self-explanation (docs/27 P1-13). Interaction is
          // still blocked by `submitLockRef`, so this cannot double-submit.
          locked={perQLocked && revealing}
          // docs/27 P1-13. Hold the reveal while the child is naming the cause.
          // Marking the right answer first turns self-explanation into reading
          // — the child can see what they should have put, so there is nothing
          // left to retrieve. Caught by looking at a render: the prompt was
          // correct and the screen around it defeated it.
          wasCorrect={answerState === 'idle' || !revealing ? null : answerState === 'correct'}
          selectedChoice={selectedChoice}
          onSubmit={handleSubmit}
        />
      )}

      {/* §9 M3 — process praise. Names the action, not the outcome.
          XP sits alongside it rather than on its own: the sentence explains
          what the child did, the number records it. A bare number would be
          outcome feedback, which is the thing process praise exists to replace. */}
      {praise && answerState === 'correct' && (
        <View style={styles.praiseBox} accessibilityLiveRegion="polite">
          <Feather name="check-circle" size={14} color={C.correct} />
          <Text style={styles.praiseText}>{praise}</Text>
          {!!lastAward && lastAward.total > 0 && (
            <Text style={styles.xpText}>+{lastAward.total} XP</Text>
          )}
        </View>
      )}

      {/* Bonus events are the emotional peaks of the economy, and every one is
          tied to a CHANGE of state — never to volume. */}
      {answerState === 'correct' && !!lastAward && lastAward.bonuses.length > 0 && (
        <View style={styles.bonusRow} accessibilityLiveRegion="polite">
          {lastAward.bonuses.map(b => (
            <View key={b.id} style={styles.bonusChip}>
              <Feather name="award" size={11} color={C.primary} />
              <Text style={styles.bonusText}>{BONUS_LABEL[b.id][lang === 'hi' ? 'hi' : 'en']}</Text>
            </View>
          ))}
        </View>
      )}

      {/* docs/27 P1-13 · self-explanation.
          Retrieving the reason for your own error produces more learning than
          being handed it, and the diagnosis below is exactly what the app used
          to hand over unasked. Options are real misconceptions for this skill,
          so choosing between them is a genuine discrimination rather than a
          reading exercise. */}
      {whyPrompt && !worked && (
        <View style={styles.whyBox} accessibilityLiveRegion="polite">
          {/* docs/28: a wrong answer is exactly where the character must appear,
              and exactly where it must NOT look disappointed. `thinking` is
              curiosity — the owl is puzzling it out alongside the child. */}
          <View style={{ alignItems: 'center', marginBottom: 6 }}>
            <Mascot mood="thinking" size={64} />
          </View>
          <Text style={styles.whyPrompt}>
            {lang === 'hi' ? whyPrompt.question.hi : whyPrompt.question.en}
          </Text>
          {whyPrompt.options.map((o: SelfExplanationOption) => {
            const picked = whyAnswer === o.id;
            return (
              <TouchableOpacity
                key={o.id}
                style={[styles.whyOption, picked && styles.whyOptionPicked]}
                disabled={whyAnswer !== null}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setWhyAnswer(o.id);
                }}
                accessibilityRole="button"
                accessibilityLabel={lang === 'hi' ? o.text.hi : o.text.en}
              >
                <Text style={styles.whyOptionText}>
                  {lang === 'hi' ? o.text.hi : o.text.en}
                </Text>
              </TouchableOpacity>
            );
          })}
          {whyAnswer !== null && (
            <Text style={styles.whyFeedback}>
              {whyFeedback(
                whyPrompt.options.find(o => o.id === whyAnswer) ?? null,
                whyPrompt, lang,
              )}
            </Text>
          )}
        </View>
      )}

      {/* Direction D — explain *why* the answer was wrong, not merely that it was.
          Shown only when a specific misconception was identified. Held back
          while the child is still working out the cause themselves. */}
      {diagnosis && !worked && (!whyPrompt || whyAnswer !== null) && MISCONCEPTIONS[diagnosis] && (() => {
        // Feedback must be in the learner's language, not just the questions.
        const hi = MISCONCEPTIONS_HI[diagnosis];
        const info = lang === 'hi' && hi ? hi : MISCONCEPTIONS[diagnosis];
        return (
          <View style={styles.diagnosisBox} accessibilityLiveRegion="polite">
            <Feather name="info" size={14} color={C.medium} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.diagnosisTitle}>{info.label}</Text>
              <Text style={styles.diagnosisText}>{info.explanation}</Text>
            </View>
          </View>
        );
      })()}
    </View>
  );
}

/**
 * Styles are a factory rather than a module constant: they reference palette
 * values, and a module-scope StyleSheet freezes those at import time — the
 * exact defect that left dark mode non-functional (docs/20 F1).
 */
const makeStyles = (C: ReturnType<typeof useLegacyPalette>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background, paddingHorizontal: 18 },
  whyBox: {
    marginTop: 12, padding: 14, borderRadius: 14,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, gap: 8,
  },
  whyPrompt: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.foreground, marginBottom: 2 },
  whyOption: {
    minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.background,
  },
  whyOptionPicked: { borderColor: C.primary, backgroundColor: C.primary + '14' },
  whyOptionText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.foreground },
  whyFeedback: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.easy, marginTop: 4 },
  confidenceBox: {
    marginTop: 12, padding: 14, borderRadius: 14,
    backgroundColor: C.primary + '12', gap: 10,
  },
  confidencePrompt: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.foreground, textAlign: 'center' },
  confidenceRow: { flexDirection: 'row', gap: 10 },
  confidenceBtn: {
    flex: 1, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  confidenceBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.primary },
  hintBox: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    marginBottom: 12, paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: C.medium + '12', borderRadius: 12,
  },
  hintText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: C.mutedForeground, lineHeight: 18 },
  praiseBox: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    marginTop: 12, paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: C.correct + '14', borderRadius: 12,
  },
  praiseText: { flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.correct },
  xpText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.correct },
  bonusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  bonusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.primary + '14', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  bonusText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.primary },
  diagnosisBox: {
    flexDirection: 'row', gap: 9, alignItems: 'flex-start',
    marginTop: 12, padding: 12,
    backgroundColor: C.medium + '18', borderRadius: 12,
    borderWidth: 1, borderColor: C.medium + '44',
  },
  diagnosisTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.medium, marginBottom: 2 },
  diagnosisText:  { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.mutedForeground, lineHeight: 17 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, gap: 8 },
  xBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  topMid: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  pill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  scorePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.gold + '22', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18 },
  scoreText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.gold },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  progressTrack: { flex: 1, flexDirection: 'row', gap: 3, alignItems: 'center' },
  progressSeg: { flex: 1, height: 6, borderRadius: 3 },
  progressLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.mutedForeground, minWidth: 30, textAlign: 'right' },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  timerTrack: { flex: 1, height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  timerFill: { height: 6, borderRadius: 3 },
  timerText: { fontSize: 13, fontFamily: 'Inter_700Bold', minWidth: 26, textAlign: 'right' },
  speakBtn: {
    position: 'absolute', top: 8, right: 8,
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  qCard: {
    backgroundColor: C.card, borderRadius: 22, borderWidth: 1,
    paddingHorizontal: 20, paddingVertical: 20,
    minHeight: 120, maxHeight: 220,
    justifyContent: 'center', marginBottom: 16,
  },
  qCardTall: { maxHeight: 260, minHeight: 160 },
  blitzCount: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.mutedForeground, marginBottom: 4 },
  qScrollInner: { paddingBottom: 4 },
  qScrollCenter: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  // lineHeight is set per-render from fontSize, NOT fixed here. It used to be a
  // constant 32 while `qFontSize` scales to 44 for short questions, so the line
  // box was smaller than the glyphs. Latin tolerates that; Devanagari does not
  // — the i-matra (ि) and the shirorekha sit ABOVE the base glyph, so "कितने"
  // rendered with the matra clipped and visually detached. Found by
  // photographing the Hindi render, not by reading the stylesheet.
  qText: { fontFamily: 'Inter_700Bold', color: C.foreground, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridText: { gap: 10 },
  choiceBtn: {
    width: '47.5%', backgroundColor: C.card, borderRadius: 16,
    paddingVertical: 26, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: C.border,
  },
  choiceBtnText: {
    width: '47.5%', paddingVertical: 18, paddingHorizontal: 10,
    minHeight: 70,
  },
  choiceCorrect: { backgroundColor: C.correct + '22', borderColor: C.correct },
  choiceWrong:   { backgroundColor: C.wrong   + '22', borderColor: C.wrong   },
  choiceDim:     { opacity: 0.4 },
  choiceText:    { fontFamily: 'Inter_700Bold', textAlign: 'center' },
});
