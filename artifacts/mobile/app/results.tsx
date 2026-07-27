import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGame, CLASS_CONFIGS, CATEGORY_META } from '@/context/GameContext';
import { Celebration, isStreakMilestone } from '@/components/Celebration';
import type { CelebrationReason } from '@/components/Celebration';
import { useMotion } from '@/hooks/useMotion';
import { useAnnounce, touchSlop } from '@/hooks/useA11y';
import { t } from '@/i18n/strings';
import { useTheme } from '@/theme/useTheme';


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

function getStars(s: number, t: number) {
  const p = s / t;
  return p === 1 ? 3 : p >= 0.7 ? 2 : p >= 0.4 ? 1 : 0;
}

function getMessage(s: number, t: number) {
  const p = s / t;
  if (p === 1)   return { title: 'Perfect Score!',  sub: 'You nailed every question!' };
  if (p >= 0.8)  return { title: 'Excellent!',       sub: "Almost perfect — you're on fire!" };
  if (p >= 0.6)  return { title: 'Great Work!',      sub: 'Solid effort. Keep it up!' };
  if (p >= 0.4)  return { title: 'Not Bad!',         sub: "A bit more practice and you'll smash it." };
  return             { title: 'Keep Training!',   sub: "Practice makes perfect. You've got this!" };
}

export default function ResultsScreen() {
  const C = useLegacyPalette();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const router  = useRouter();
  const {
    score, totalQuestions, difficulty, selectedClass, selectedCategory,
    sessionType, isTablesMode, selectedTable,
    getHighScore, saveScore, startGame, startTablesGame,
    wrongAnswers, savedMistakes, streak, lang,
  } = useGame();

  const scoreAnimRef = useRef<Animated.Value | null>(null);
  const fadeAnimRef  = useRef<Animated.Value | null>(null);
  const starsAnimRef = useRef<Animated.Value[] | null>(null);
  const scoreAnim = scoreAnimRef.current ?? (scoreAnimRef.current = new Animated.Value(0));
  const fadeAnim  = fadeAnimRef.current  ?? (fadeAnimRef.current  = new Animated.Value(0));
  const starsAnim = starsAnimRef.current ?? (starsAnimRef.current = [new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]);

  const stars    = getStars(score, totalQuestions);
  const { title, sub } = getMessage(score, totalQuestions);
  const prevBest = isTablesMode ? 0 : getHighScore(selectedClass, difficulty, selectedCategory);
  const isNewBest = score > prevBest;

  const classConfig = CLASS_CONFIGS.find(c => c.key === selectedClass);
  const classColor  = classConfig?.color ?? C.primary;
  const catMeta     = isTablesMode ? CATEGORY_META['tables'] : CATEGORY_META[selectedCategory];
  const diffColor   = difficulty === 'easy' ? C.easy : difficulty === 'medium' ? C.medium : C.hard;

  const top = Platform.OS === 'web' ? 67 : insets.top;
  const bot = Platform.OS === 'web' ? 34 : insets.bottom;

  // The single most valuable moment to mark is not a high score — it is
  // persistence. Streak milestones and personal bests get a celebration;
  // routine completion does not, because celebrating everything means nothing.
  const [celebration, setCelebration] = useState<{ reason: CelebrationReason; message: string } | null>(null);
  const motion = useMotion();
  const a11yAnnounce = useAnnounce();

  useEffect(() => {
    // Screen-reader users get no feedback from stars appearing.
    a11yAnnounce(
      lang === 'hi'
        ? `परिणाम: ${totalQuestions} में से ${score} सही`
        : `Result: ${score} correct out of ${totalQuestions}`,
    );

    if (isStreakMilestone(streak)) {
      setCelebration({
        reason: 'streak',
        message: lang === 'hi' ? `${streak} दिन का अभ्यास!` : `${streak} day streak!`,
      });
    } else if (isNewBest && !isTablesMode) {
      setCelebration({
        reason: 'best',
        message: lang === 'hi' ? 'नया रिकॉर्ड!' : 'New personal best!',
      });
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    saveScore();
    Haptics.notificationAsync(stars >= 2 ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(scoreAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
    [300, 500, 700].slice(0, stars).forEach((delay, i) =>
      setTimeout(() => Animated.spring(starsAnim[i], { toValue: 1, friction: 4, useNativeDriver: true }).start(), delay)
    );
  }, []);

  const handlePlayAgain = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (isTablesMode) { startTablesGame(selectedTable); }
    else              { startGame(selectedClass, difficulty, selectedCategory, sessionType); }
    router.replace('/game');
  };

  return (
    <>
    {celebration && (
      <Celebration
        visible
        reason={celebration.reason}
        message={celebration.message}
        onDone={() => setCelebration(null)}
      />
    )}
    <Animated.View style={[styles.container, { paddingTop: top + 10, paddingBottom: bot + 20, opacity: fadeAnim }]}>
      {/* Nav */}
      <View style={styles.topNav}>
        <TouchableOpacity onPress={() => router.replace('/')} style={styles.homeBtn}
          hitSlop={touchSlop(40)} accessibilityRole="button" accessibilityLabel="Home">
          <Feather name="home" size={20} color={C.mutedForeground} />
        </TouchableOpacity>
        <View style={styles.navBadges}>
          {!isTablesMode && (
            <View style={[styles.navBadge, { backgroundColor: classColor + '22' }]}>
              <Text style={[styles.navBadgeText, { color: classColor }]}>{classConfig?.label}</Text>
            </View>
          )}
          <View style={[styles.navBadge, { backgroundColor: catMeta.color + '22' }]}>
            <Text style={[styles.navBadgeText, { color: catMeta.color }]}>
              {isTablesMode ? `${selectedTable}× Table` : catMeta.label}
            </Text>
          </View>
          {!isTablesMode && (
            <View style={[styles.navBadge, { backgroundColor: diffColor + '22' }]}>
              <Text style={[styles.navBadgeText, { color: diffColor }]}>{difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Stars */}
      <View style={styles.starsRow}>
        {[0,1,2].map(i => (
          <Animated.View key={i} style={{ transform: [{ scale: starsAnim[i].interpolate({ inputRange:[0,1], outputRange:[0.3,1] }) }], opacity: i < stars ? starsAnim[i] : 0.2 }}>
            <Feather name="star" size={40} color={i < stars ? C.gold : C.border} style={{ marginHorizontal: 5 }} />
          </Animated.View>
        ))}
      </View>

      {/* Score circle */}
      <Animated.View style={[styles.scoreCircle, { borderColor: classColor }, { transform: [{ scale: scoreAnim.interpolate({ inputRange:[0,1], outputRange:[0.5,1] }) }] }]}>
        <Text style={[styles.scoreBig, { color: classColor }]}>{score}</Text>
        <Text style={styles.scoreTotal}>/ {totalQuestions}</Text>
      </Animated.View>

      <Text style={styles.msgTitle}>{title}</Text>
      <Text style={styles.msgSub}>{sub}</Text>

      {isNewBest && !isTablesMode && (
        <View style={styles.bestRow}>
          <Feather name="award" size={14} color={C.gold} />
          <Text style={styles.bestText}>New Personal Best!</Text>
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={[styles.statVal, { color: C.easy }]}>{score}</Text>
          <Text style={styles.statLbl}>Correct</Text>
        </View>
        <View style={styles.statDiv} />
        <View style={styles.statBox}>
          <Text style={[styles.statVal, { color: C.hard }]}>{totalQuestions - score}</Text>
          <Text style={styles.statLbl}>Wrong</Text>
        </View>
        <View style={styles.statDiv} />
        <View style={styles.statBox}>
          <Text style={[styles.statVal, { color: C.gold }]}>
            {isTablesMode ? score : Math.max(prevBest, score)}
          </Text>
          <Text style={styles.statLbl}>Best</Text>
        </View>
      </View>

      {/* Actions */}
      <TouchableOpacity style={styles.playAgainBtn} onPress={handlePlayAgain} activeOpacity={0.85}>
        <Feather name="refresh-cw" size={18} color="#fff" />
        <Text style={styles.playAgainText}>Play Again</Text>
      </TouchableOpacity>

      <View style={styles.actionRow}>
        {(wrongAnswers.length > 0 || savedMistakes.length > 0) && (
          <TouchableOpacity style={styles.secBtn} onPress={() => router.push('/mistake-review')} activeOpacity={0.8}>
            <Feather name="alert-circle" size={16} color={C.hard} />
            <Text style={[styles.secBtnText, { color: C.hard }]}>
              Review {savedMistakes.length > 0 ? savedMistakes.length : wrongAnswers.length} Mistake{(savedMistakes.length || wrongAnswers.length) !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.secBtn} onPress={() => router.replace('/class-select')} activeOpacity={0.8}
          accessibilityRole="button" accessibilityLabel="Change class">
          <Feather name="layers" size={16} color={C.primary} />
          <Text style={[styles.secBtnText, { color: C.primary }]}>Change</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
    </>
  );
}

/**
 * Styles are a factory rather than a module constant: they reference palette
 * values, and a module-scope StyleSheet freezes those at import time — the
 * exact defect that left dark mode non-functional (docs/20 F1).
 */
const makeStyles = (C: ReturnType<typeof useLegacyPalette>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  topNav: { position: 'absolute', top: 0, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  homeBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  navBadges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  navBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  navBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  starsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  scoreCircle: { width: 130, height: 130, borderRadius: 65, backgroundColor: C.card, borderWidth: 3, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  scoreBig: { fontSize: 50, fontFamily: 'Inter_700Bold', lineHeight: 54 },
  scoreTotal: { fontSize: 16, fontFamily: 'Inter_500Medium', color: C.mutedForeground },
  msgTitle: { fontSize: 26, fontFamily: 'Inter_700Bold', color: C.foreground, textAlign: 'center', marginBottom: 6 },
  msgSub: { fontSize: 14, fontFamily: 'Inter_400Regular', color: C.mutedForeground, textAlign: 'center', marginBottom: 14 },
  bestRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.gold + '22', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7, marginBottom: 16 },
  bestText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.gold },
  statsRow: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 14, paddingVertical: 14, width: '100%', marginBottom: 20, borderWidth: 1, borderColor: C.border },
  statBox: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  statLbl: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.mutedForeground, marginTop: 2 },
  statDiv: { width: 1, backgroundColor: C.border },
  playAgainBtn: { width: '100%', backgroundColor: C.primary, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 17, marginBottom: 10 },
  playAgainText: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#fff' },
  actionRow: { flexDirection: 'row', gap: 10, width: '100%' },
  secBtn: { flex: 1, backgroundColor: C.card, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderWidth: 1, borderColor: C.border },
  secBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
