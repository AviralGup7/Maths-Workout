import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Platform, ScrollView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGame, CLASS_CONFIGS, CATEGORY_META, ChoiceValue } from '@/context/GameContext';
import colors from '@/constants/colors';
import { MISCONCEPTIONS } from '@/learning/misconceptions';
import { MISCONCEPTIONS_HI } from '@/i18n/misconceptions-hi';
import { t, categoryLabel } from '@/i18n/strings';
import { CLASS_LABELS } from '@/curriculum/boards';
import { useMotion, FEEDBACK_MS, feedbackDelay, readingDelay } from '@/hooks/useMotion';
import { useAnnounce, touchSlop } from '@/hooks/useA11y';
import { AnswerSurface } from '@/components/answer/AnswerSurface';
import { grade, expectedAnswer } from '@/generators/interactions';
import { praiseFor, praiseText } from '@/learning/feedback';
import { decideAdaptation } from '@/learning/adaptation';
import { shouldTeach, buildWorkedExample, canTeach } from '@/learning/workedExamples';
import type { WorkedExample as WEType } from '@/learning/workedExamples';
import { WorkedExample } from '@/components/WorkedExample';
import { extractOperands } from '@/learning/misconceptions';
import type { Attempt } from '@/learning/attempts';

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
const C = colors.light;

type AnswerState = 'idle' | 'correct' | 'wrong';

function formatChoice(v: ChoiceValue): string {
  if (typeof v === 'string') return v;
  // Format decimals nicely
  if (!Number.isInteger(v)) return v.toFixed(2).replace(/\.?0+$/, '');
  // Format negative numbers
  return String(v);
}

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const router  = useRouter();
  const {
    questions, currentIndex, totalQuestions, sessionType,
    submitAnswer, nextQuestion, endGame, isGameOver,
    score, selectedClass, selectedCategory, isTablesMode,
    saveProgressStats, saveScore, wrongAnswers, recordAttempt, lang, timerOn,
    mastery, sessionSkillFor, retargetNext, attempts, selectedClass: cls,
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
  const shakeAnimRef  = useRef<Animated.Value | null>(null);
  const fadeAnimRef   = useRef<Animated.Value | null>(null);
  const scaleAnimRef  = useRef<Animated.Value | null>(null);
  const shakeAnim = shakeAnimRef.current ?? (shakeAnimRef.current = new Animated.Value(0));
  const fadeAnim  = fadeAnimRef.current  ?? (fadeAnimRef.current  = new Animated.Value(1));
  const scaleAnim = scaleAnimRef.current ?? (scaleAnimRef.current = new Animated.Value(1));

  const currentQuestion = questions[currentIndex];
  const classConfig     = CLASS_CONFIGS.find(c => c.key === selectedClass);
  const classColor      = classConfig?.color ?? C.primary;
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
    if (perQLocked) return;
    const q = questions[currentIndex];
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
      setPerQLocked(false);
      setPerQTime(secondsFor(questions[currentIndex + 1]));
      setPerQBudget(secondsFor(questions[currentIndex + 1]));
      setDiagnosis(null);
      setPraise(null);
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
    if (perQLocked || !currentQuestion) return;
    if (!isBlitz && timerRef.current) clearInterval(timerRef.current);
    setPerQLocked(true);
    setSelectedChoice(normalised);

    const latencyMs = Date.now() - shownAtRef.current;
    const correct = grade(currentQuestion, normalised);

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

    // Mirror the attempt into a session-local log. The context log is
    // debounced and async; in-session adaptation must react to the answer that
    // was just given, not the one that has finished persisting.
    const skillNow = sessionSkillFor(currentIndex);
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

  const choiceStyle = (choice: ChoiceValue) => {
    const base = [styles.choiceBtn, hasStringChoices && styles.choiceBtnText];
    if (!perQLocked) return base;
    if (String(choice) === String(currentQuestion.answer)) return [...base, styles.choiceCorrect];
    if (String(choice) === String(selectedChoice) && answerState === 'wrong') return [...base, styles.choiceWrong];
    return [...base, styles.choiceDim];
  };
  const choiceTextColor = (choice: ChoiceValue) => {
    if (!perQLocked) return C.foreground;
    if (String(choice) === String(currentQuestion.answer)) return C.correct;
    if (String(choice) === String(selectedChoice)) return C.wrong;
    return C.mutedForeground;
  };

  return (
    <View style={[styles.container, { paddingTop: top, paddingBottom: bot + 16 }]}>
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
            <Text style={[styles.pillText, { color: classColor }]}>{classConfig ? CLASS_LABELS[classConfig.key][lang === 'hi' ? 'hi' : 'en'] : ''}</Text>
          </View>
          <View style={[styles.pill, { backgroundColor: catMeta.color + '22' }]}>
            <Text style={[styles.pillText, { color: catMeta.color }]}>{isTablesMode ? t('timesTables', lang).replace('\n', ' ') : categoryLabel(activeCategory, lang)}</Text>
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
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, {
              width: `${(currentIndex / totalQuestions) * 100}%` as unknown as number,
              backgroundColor: classColor,
            }]} />
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
          <Text style={[styles.qText, { fontSize: qFontSize }]}>{currentQuestion.questionText}</Text>
        </ScrollView>
      </Animated.View>

      {/* Answer grid */}
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
          locked={perQLocked}
          wasCorrect={answerState === 'idle' ? null : answerState === 'correct'}
          selectedChoice={selectedChoice}
          onSubmit={handleSubmit}
        />
      )}

      {/* §9 M3 — process praise. Names the action, not the outcome. */}
      {praise && answerState === 'correct' && (
        <View style={styles.praiseBox} accessibilityLiveRegion="polite">
          <Feather name="check-circle" size={14} color={C.correct} />
          <Text style={styles.praiseText}>{praise}</Text>
        </View>
      )}

      {/* Direction D — explain *why* the answer was wrong, not merely that it was.
          Shown only when a specific misconception was identified. */}
      {diagnosis && !worked && MISCONCEPTIONS[diagnosis] && (() => {
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background, paddingHorizontal: 18 },
  praiseBox: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    marginTop: 12, paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: C.correct + '14', borderRadius: 12,
  },
  praiseText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.correct },
  diagnosisBox: {
    flexDirection: 'row', gap: 9, alignItems: 'flex-start',
    marginTop: 12, padding: 12,
    backgroundColor: C.medium + '18', borderRadius: 12,
    borderWidth: 1, borderColor: C.medium + '44',
  },
  diagnosisTitle: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: C.medium, marginBottom: 2 },
  diagnosisText:  { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.mutedForeground, lineHeight: 17 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, gap: 8 },
  xBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  topMid: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  pill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  scorePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.gold + '22', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18 },
  scoreText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.gold },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  progressTrack: { flex: 1, height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  progressLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.mutedForeground, minWidth: 30, textAlign: 'right' },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  timerTrack: { flex: 1, height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  timerFill: { height: 6, borderRadius: 3 },
  timerText: { fontSize: 12, fontFamily: 'Inter_700Bold', minWidth: 26, textAlign: 'right' },
  qCard: {
    backgroundColor: C.card, borderRadius: 22, borderWidth: 1,
    paddingHorizontal: 20, paddingVertical: 20,
    minHeight: 120, maxHeight: 220,
    justifyContent: 'center', marginBottom: 16,
  },
  qCardTall: { maxHeight: 260, minHeight: 160 },
  blitzCount: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.mutedForeground, marginBottom: 4 },
  qScrollInner: { paddingBottom: 4 },
  qScrollCenter: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  qText: { fontFamily: 'Inter_700Bold', color: C.foreground, textAlign: 'center', lineHeight: 32 },
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
