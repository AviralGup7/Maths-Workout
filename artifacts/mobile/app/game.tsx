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

const PER_Q_SECS = 15;
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
    saveProgressStats, saveScore, wrongAnswers,
  } = useGame();

  const isBlitz = sessionType === 'timed60' && !isTablesMode;

  const [answerState,    setAnswerState]    = useState<AnswerState>('idle');
  const [selectedChoice, setSelectedChoice] = useState<ChoiceValue | null>(null);
  const [perQLocked,     setPerQLocked]     = useState(false);
  const [perQTime,       setPerQTime]       = useState(PER_Q_SECS);
  const [blitzTime,      setBlitzTime]      = useState(BLITZ_SECS);

  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const shakeAnimRef  = useRef<Animated.Value | null>(null);
  const fadeAnimRef   = useRef<Animated.Value | null>(null);
  const scaleAnimRef  = useRef<Animated.Value | null>(null);
  const shakeAnim = shakeAnimRef.current ?? (shakeAnimRef.current = new Animated.Value(0));
  const fadeAnim  = fadeAnimRef.current  ?? (fadeAnimRef.current  = new Animated.Value(1));
  const scaleAnim = scaleAnimRef.current ?? (scaleAnimRef.current = new Animated.Value(1));

  const currentQuestion = questions[currentIndex];
  const classConfig     = CLASS_CONFIGS.find(c => c.key === selectedClass);
  const classColor      = classConfig?.color ?? C.primary;
  const catMeta         = isTablesMode ? CATEGORY_META['tables'] : CATEGORY_META[selectedCategory];

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
    setPerQLocked(true);
    setAnswerState('wrong');
    saveProgressStats(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    shake(() => setTimeout(advanceQuestion, 600));
  }, [perQLocked]); // eslint-disable-line

  useEffect(() => {
    if (isBlitz || perQLocked) return;
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
  }, [currentIndex, perQLocked, isBlitz]); // eslint-disable-line

  useEffect(() => {
    if (isGameOver) router.replace('/results');
  }, [isGameOver]); // eslint-disable-line

  // ─── Animations ───────────────────────────────────────────────────────────

  const shake = (cb?: () => void) => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 7,   duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -7,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 55, useNativeDriver: true }),
    ]).start(cb);
  };

  const advanceQuestion = () => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0,    duration: 120, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      nextQuestion();
      setAnswerState('idle');
      setSelectedChoice(null);
      setPerQLocked(false);
      setPerQTime(PER_Q_SECS);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    });
  };

  // ─── Answer handler ───────────────────────────────────────────────────────

  const handleChoice = (choice: ChoiceValue) => {
    if (perQLocked || !currentQuestion) return;
    if (!isBlitz && timerRef.current) clearInterval(timerRef.current);
    setPerQLocked(true);
    setSelectedChoice(choice);
    const correct = submitAnswer(choice);
    saveProgressStats(correct, currentQuestion.resolvedCategory);
    setAnswerState(correct ? 'correct' : 'wrong');

    if (correct) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.03, duration: 90, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1,    duration: 90, useNativeDriver: true }),
      ]).start(() => setTimeout(advanceQuestion, isBlitz ? 300 : 450));
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      shake(() => setTimeout(advanceQuestion, isBlitz ? 400 : 600));
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!currentQuestion) return null;

  const top = Platform.OS === 'web' ? 67 : insets.top;
  const bot = Platform.OS === 'web' ? 34 : insets.bottom;

  const timerPct   = isBlitz ? blitzTime / BLITZ_SECS : perQTime / PER_Q_SECS;
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
              'Leave Game?',
              'Any wrong answers so far will still be saved for review.',
              [
                { text: 'Keep Playing', style: 'cancel' },
                {
                  text: 'Quit',
                  style: 'destructive',
                  onPress: () => { if (score > 0 || wrongAnswers.length > 0) saveScore(); router.back(); },
                },
              ],
            );
          }}
          style={styles.xBtn}
        >
          <Feather name="x" size={20} color={C.mutedForeground} />
        </TouchableOpacity>
        <View style={styles.topMid}>
          <View style={[styles.pill, { backgroundColor: classColor + '22' }]}>
            <Text style={[styles.pillText, { color: classColor }]}>{classConfig?.label}</Text>
          </View>
          <View style={[styles.pill, { backgroundColor: catMeta.color + '22' }]}>
            <Text style={[styles.pillText, { color: catMeta.color }]}>{catMeta.label}</Text>
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

      {/* Timer bar */}
      <View style={styles.timerRow}>
        <View style={styles.timerTrack}>
          <View style={[styles.timerFill, {
            width: `${timerPct * 100}%` as unknown as number,
            backgroundColor: timerColor,
          }]} />
        </View>
        <Text style={[styles.timerText, { color: timerColor }]}>{timerVal}s</Text>
      </View>

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
      <View style={[styles.grid, hasStringChoices && styles.gridText]}>
        {currentQuestion.choices.map((choice, i) => (
          <TouchableOpacity
            key={i}
            style={choiceStyle(choice) as any}
            onPress={() => handleChoice(choice)}
            activeOpacity={0.75}
            disabled={perQLocked}
          >
            <Text style={[
              styles.choiceText,
              { fontSize: choiceFontSize, color: choiceTextColor(choice) },
            ]}>
              {formatChoice(choice)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background, paddingHorizontal: 18 },
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
