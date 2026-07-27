import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Platform, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGame } from '@/context/GameContext';
import type { WrongAnswer } from '@/context/GameContext';
import colors from '@/constants/colors';
import { touchSlop } from '@/hooks/useA11y';

const C = colors.light;

// ─── Choice generation ────────────────────────────────────────────────────────

function generateChoices(correctAnswer: string): string[] {
  const num = parseFloat(correctAnswer);
  if (isNaN(num)) return [correctAnswer]; // non-numeric edge-case

  const isInt     = Number.isInteger(num);
  const magnitude = Math.max(Math.abs(num), 3);
  const range     = magnitude <= 12 ? 5 : magnitude <= 100 ? 20 : Math.floor(magnitude * 0.35);

  const pool = new Set<string>();
  pool.add(correctAnswer);

  let attempts = 0;
  while (pool.size < 4 && attempts < 300) {
    attempts++;
    const sign      = Math.random() < 0.5 ? 1 : -1;
    const delta     = Math.floor(Math.random() * range) + 1;
    const candidate = num + sign * delta;

    // Keep distractors non-negative for simple questions
    if (candidate < 0 && num >= 0 && magnitude < 30) continue;

    const formatted = isInt
      ? String(Math.round(candidate))
      : candidate.toFixed(2).replace(/\.?0+$/, '');
    pool.add(formatted);
  }

  // Fisher-Yates shuffle
  const arr = Array.from(pool).slice(0, 4);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Types ─────────────────────────────────────────────────────────────────

type Mode = 'review' | 'practice';
type AnswerState = 'idle' | 'correct' | 'wrong';

// ─── Main screen ───────────────────────────────────────────────────────────

export default function MistakeReviewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { savedMistakes, wrongAnswers, clearMistake } = useGame();

  const top = Platform.OS === 'web' ? 67 : insets.top;
  const bot = Platform.OS === 'web' ? 34 : insets.bottom;

  // Combine persisted mistakes with any from the current session not yet saved
  const allMistakes: WrongAnswer[] = React.useMemo(() => {
    const seen = new Set(savedMistakes.map(m => `${m.display}|${m.correctAnswer}`));
    const sessionOnly = wrongAnswers.filter(m => !seen.has(`${m.display}|${m.correctAnswer}`));
    return [...savedMistakes, ...sessionOnly];
  }, [savedMistakes, wrongAnswers]);

  const [mode, setMode] = useState<Mode>('review');

  // ── Practice state ──────────────────────────────────────────────────────
  const [queue,          setQueue]          = useState<WrongAnswer[]>([]);
  const [practiceIndex,  setPracticeIndex]  = useState(0);
  const [choices,        setChoices]        = useState<string[]>([]);
  const [answerState,    setAnswerState]    = useState<AnswerState>('idle');
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [clearedCount,   setClearedCount]   = useState(0);

  // Animations
  const cardFadeRef  = useRef<Animated.Value | null>(null);
  const cardScaleRef = useRef<Animated.Value | null>(null);
  const shakeAnimRef = useRef<Animated.Value | null>(null);
  const cardFade  = cardFadeRef.current  ?? (cardFadeRef.current  = new Animated.Value(1));
  const cardScale = cardScaleRef.current ?? (cardScaleRef.current = new Animated.Value(1));
  const shakeAnim = shakeAnimRef.current ?? (shakeAnimRef.current = new Animated.Value(0));

  // ── Enter practice mode ──────────────────────────────────────────────────
  const enterPractice = useCallback(() => {
    if (allMistakes.length === 0) return;
    // Shuffle
    const shuffled = [...allMistakes].sort(() => Math.random() - 0.5);
    setQueue(shuffled);
    setPracticeIndex(0);
    setChoices(generateChoices(shuffled[0].correctAnswer));
    setAnswerState('idle');
    setSelectedChoice(null);
    setClearedCount(0);
    setMode('practice');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [allMistakes]);

  // Regenerate choices when question changes
  useEffect(() => {
    if (mode === 'practice' && queue[practiceIndex]) {
      setChoices(generateChoices(queue[practiceIndex].correctAnswer));
      setAnswerState('idle');
      setSelectedChoice(null);
    }
  }, [practiceIndex, mode]); // eslint-disable-line

  const shake = (cb?: () => void) => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 7,   duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -7,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 55, useNativeDriver: true }),
    ]).start(cb);
  };

  const advanceToNext = useCallback((wasCorrect: boolean) => {
    Animated.parallel([
      Animated.timing(cardFade,  { toValue: 0,    duration: 160, useNativeDriver: true }),
      Animated.timing(cardScale, { toValue: 0.93, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      setPracticeIndex(i => i + 1);
      Animated.parallel([
        Animated.timing(cardFade,  { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(cardScale, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  }, [cardFade, cardScale]);

  const handleChoice = useCallback((choice: string) => {
    if (answerState !== 'idle') return;
    const current = queue[practiceIndex];
    if (!current) return;

    setSelectedChoice(choice);
    const correct = choice === current.correctAnswer;

    if (correct) {
      setAnswerState('correct');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      clearMistake(current.display, current.correctAnswer);
      setClearedCount(c => c + 1);
      setTimeout(() => advanceToNext(true), 550);
    } else {
      setAnswerState('wrong');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      shake(() => setTimeout(() => advanceToNext(false), 650));
    }
  }, [answerState, queue, practiceIndex, clearMistake, advanceToNext]);

  const currentMistake = queue[practiceIndex];
  const practiceTotal  = queue.length;
  const isDone         = mode === 'practice' && practiceIndex >= practiceTotal;

  // ── Done screen ──────────────────────────────────────────────────────────
  if (isDone) {
    const remaining = practiceTotal - clearedCount;
    return (
      <View style={[styles.container, { paddingTop: top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { setMode('review'); }} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={C.foreground} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Practice Complete</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.doneWrap}>
          <View style={[styles.doneIcon, { backgroundColor: clearedCount > 0 ? C.easy + '22' : C.hard + '22' }]}>
            <Feather name={clearedCount > 0 ? 'award' : 'refresh-cw'} size={44} color={clearedCount > 0 ? C.easy : C.hard} />
          </View>
          <Text style={styles.doneTitle}>
            {clearedCount === practiceTotal ? 'All Clear! 🎉' : `${clearedCount} / ${practiceTotal} Cleared`}
          </Text>
          <Text style={styles.doneSub}>
            {remaining > 0
              ? `${remaining} question${remaining !== 1 ? 's' : ''} still need practice.`
              : "You answered every question correctly!"}
          </Text>

          {remaining > 0 && (
            <TouchableOpacity style={styles.practiceAgainBtn} onPress={enterPractice} activeOpacity={0.85}>
              <Feather name="refresh-cw" size={17} color="#fff" />
              <Text style={styles.practiceAgainText}>Practice Again</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.doneSecBtn} onPress={() => setMode('review')} activeOpacity={0.8}>
            <Text style={styles.doneSecBtnText}>Back to Review</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Practice mode ────────────────────────────────────────────────────────
  if (mode === 'practice' && currentMistake) {
    const progressPct = practiceTotal > 0 ? (practiceIndex / practiceTotal) : 0;

    const choiceBg = (c: string) => {
      if (answerState === 'idle') return styles.choiceIdle;
      if (c === currentMistake.correctAnswer) return styles.choiceCorrect;
      if (c === selectedChoice && answerState === 'wrong') return styles.choiceWrong;
      return styles.choiceDim;
    };
    const choiceTextColor = (c: string) => {
      if (answerState === 'idle') return C.foreground;
      if (c === currentMistake.correctAnswer) return C.correct;
      if (c === selectedChoice && answerState === 'wrong') return C.wrong;
      return C.mutedForeground;
    };

    return (
      <View style={[styles.container, { paddingTop: top, paddingBottom: bot + 16, paddingHorizontal: 18 }]}>
        {/* Header */}
        <View style={styles.practiceHeader}>
          <TouchableOpacity onPress={() => setMode('review')} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={C.foreground} />
          </TouchableOpacity>
          <Text style={styles.practiceTitle}>Practice</Text>
          <View style={styles.counterPill}>
            <Text style={styles.counterText}>{practiceIndex + 1} / {practiceTotal}</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct * 100}%` as unknown as number }]} />
        </View>

        {/* Question card */}
        <Animated.View style={[
          styles.qCard,
          { opacity: cardFade, transform: [{ scale: cardScale }, { translateX: shakeAnim }] },
        ]}>
          <View style={styles.qBadge}>
            <Feather name="help-circle" size={14} color={C.primary} />
            <Text style={styles.qBadgeText}>What is the answer?</Text>
          </View>
          <Text style={styles.qText} numberOfLines={4} adjustsFontSizeToFit>
            {currentMistake.display}
          </Text>
        </Animated.View>

        {/* Answer status */}
        {answerState !== 'idle' && (
          <View style={[
            styles.statusBanner,
            { backgroundColor: answerState === 'correct' ? C.correct + '22' : C.wrong + '22' },
          ]}>
            <Feather
              name={answerState === 'correct' ? 'check-circle' : 'x-circle'}
              size={16}
              color={answerState === 'correct' ? C.correct : C.wrong}
            />
            <Text style={[styles.statusText, { color: answerState === 'correct' ? C.correct : C.wrong }]}>
              {answerState === 'correct' ? 'Correct! Mistake cleared ✓' : `Correct answer: ${currentMistake.correctAnswer}`}
            </Text>
          </View>
        )}

        {/* Choice grid */}
        <View style={styles.grid}>
          {choices.map((c, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.choiceBtn, choiceBg(c)]}
              onPress={() => handleChoice(c)}
              disabled={answerState !== 'idle'}
              activeOpacity={0.75}
            >
              <Text style={[styles.choiceText, { color: choiceTextColor(c) }]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  // ── Review mode ───────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}
          hitSlop={touchSlop(40)} accessibilityRole="button" accessibilityLabel="Go back">
          <Feather name="arrow-left" size={22} color={C.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Mistake Review</Text>
          <Text style={styles.headerSub}>
            {allMistakes.length > 0
              ? `${allMistakes.length} question${allMistakes.length !== 1 ? 's' : ''} to review`
              : 'All clear!'}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {allMistakes.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="check-circle" size={40} color={C.easy} />
          </View>
          <Text style={styles.emptyTitle}>No Mistakes!</Text>
          <Text style={styles.emptySub}>
            You haven't made any mistakes yet — or you've cleared them all. Keep it up!
          </Text>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: bot + 96 }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.tipCard}>
              <Feather name="info" size={14} color={C.primary} />
              <Text style={styles.tipText}>
                Study these questions, then tap <Text style={{ fontFamily: 'Inter_600SemiBold' }}>Practice</Text> to answer them and clear them from your list.
              </Text>
            </View>

            {allMistakes.map((wa, i) => (
              <View key={`${wa.display}-${i}`} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardNum}>
                    <Text style={styles.cardNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.questionText} numberOfLines={3} adjustsFontSizeToFit>
                    {wa.display}
                  </Text>
                </View>

                <View style={styles.answersRow}>
                  <View style={styles.answerBox}>
                    <View style={[styles.answerIconWrap, { backgroundColor: C.wrong + '22' }]}>
                      <Feather name="x" size={14} color={C.wrong} />
                    </View>
                    <Text style={styles.answerLabel}>Your answer</Text>
                    <Text style={[styles.answerVal, { color: C.wrong }]}>{wa.userAnswer}</Text>
                  </View>

                  <View style={styles.answerDivider} />

                  <View style={styles.answerBox}>
                    <View style={[styles.answerIconWrap, { backgroundColor: C.easy + '22' }]}>
                      <Feather name="check" size={14} color={C.easy} />
                    </View>
                    <Text style={styles.answerLabel}>Correct answer</Text>
                    <Text style={[styles.answerVal, { color: C.easy }]}>{wa.correctAnswer}</Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Sticky practice button */}
          <View style={[styles.practiceFooter, { paddingBottom: bot + 16 }]}>
            <TouchableOpacity style={styles.practiceBtn} onPress={enterPractice} activeOpacity={0.85}>
              <Feather name="zap" size={18} color="#fff" />
              <Text style={styles.practiceBtnText}>Practice Now ({allMistakes.length})</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.background },

  // Header (review mode)
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.foreground },
  headerSub:    { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.mutedForeground },

  // Review scroll
  scroll: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },

  // Empty state
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyIcon:  { width: 80, height: 80, borderRadius: 40, backgroundColor: C.easy + '22', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: C.foreground },
  emptySub:   { fontSize: 14, fontFamily: 'Inter_400Regular', color: C.mutedForeground, textAlign: 'center' },

  // Tip card
  tipCard: {
    backgroundColor: C.primary + '18', borderRadius: 12, borderWidth: 1, borderColor: C.primary + '44',
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, marginBottom: 4,
  },
  tipText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: C.foreground },

  // Mistake cards (review)
  card:        { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  cardNum:     { width: 28, height: 28, borderRadius: 14, backgroundColor: C.muted, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardNumText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.mutedForeground },
  questionText: { flex: 1, fontSize: 20, fontFamily: 'Inter_700Bold', color: C.foreground },
  answersRow:  { flexDirection: 'row', padding: 16 },
  answerBox:   { flex: 1, alignItems: 'center', gap: 6 },
  answerDivider: { width: 1, backgroundColor: C.border, marginHorizontal: 16 },
  answerIconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  answerLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.mutedForeground },
  answerVal:   { fontSize: 28, fontFamily: 'Inter_700Bold' },

  // Sticky practice button (review mode)
  practiceFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: C.background, borderTopWidth: 1, borderTopColor: C.border },
  practiceBtn:     { backgroundColor: C.primary, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 17 },
  practiceBtnText: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#fff' },

  // Practice mode header
  practiceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  practiceTitle:  { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.foreground },
  counterPill:    { backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 6 },
  counterText:    { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.mutedForeground },

  // Practice progress bar
  progressTrack: { height: 5, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden', marginBottom: 20 },
  progressFill:  { height: 5, backgroundColor: C.primary, borderRadius: 3 },

  // Practice question card
  qCard: {
    backgroundColor: C.card, borderRadius: 22, borderWidth: 1, borderColor: C.border,
    padding: 24, minHeight: 140, justifyContent: 'center', marginBottom: 16,
  },
  qBadge:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  qBadgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.primary },
  qText:      { fontSize: 38, fontFamily: 'Inter_700Bold', color: C.foreground, textAlign: 'center' },

  // Status banner
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, marginBottom: 14 },
  statusText:   { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  // Practice choice grid
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  choiceBtn: { width: '47.5%', borderRadius: 16, paddingVertical: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  choiceIdle:    { backgroundColor: C.card, borderColor: C.border },
  choiceCorrect: { backgroundColor: C.correct + '22', borderColor: C.correct },
  choiceWrong:   { backgroundColor: C.wrong   + '22', borderColor: C.wrong   },
  choiceDim:     { backgroundColor: C.card, borderColor: C.border, opacity: 0.4 },
  choiceText:    { fontSize: 28, fontFamily: 'Inter_700Bold', textAlign: 'center' },

  // Done screen
  doneWrap:          { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  doneIcon:          { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  doneTitle:         { fontSize: 26, fontFamily: 'Inter_700Bold', color: C.foreground, textAlign: 'center' },
  doneSub:           { fontSize: 15, fontFamily: 'Inter_400Regular', color: C.mutedForeground, textAlign: 'center', marginBottom: 8 },
  practiceAgainBtn:  { width: '100%', backgroundColor: C.primary, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 17 },
  practiceAgainText: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#fff' },
  doneSecBtn:        { width: '100%', backgroundColor: C.card, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderWidth: 1, borderColor: C.border },
  doneSecBtnText:    { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.mutedForeground },
});
