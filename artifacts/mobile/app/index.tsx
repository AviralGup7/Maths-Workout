import React, { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGame, CLASS_CONFIGS, CATEGORY_META } from '@/context/GameContext';
import colors from '@/constants/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SEEN_WELCOME_KEY } from './welcome';
import { DAILY_GOAL } from '@/context/GameContext';
import { BOARD_CONFIGS, CLASS_LABELS } from '@/curriculum/boards';
import { t, categoryLabel } from '@/i18n/strings';

const C = colors.light;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { loadAll, progressStats, highScores, savedMistakes,
          streak, answeredToday, startAdaptiveSession, selectedClass,
          board, lang, prefsLoaded } = useGame();
  const boardCfg = BOARD_CONFIGS.find(b => b.key === board)!;

  useEffect(() => { loadAll(); }, []);

  // First run: send the child through onboarding once. Waits for prefsLoaded so
  // a returning user never sees a flash of the welcome screen.
  useEffect(() => {
    if (!prefsLoaded) return;
    let alive = true;
    AsyncStorage.getItem(SEEN_WELCOME_KEY)
      .then(seen => { if (alive && !seen) router.replace('/welcome'); })
      .catch(() => {});
    return () => { alive = false; };
  }, [prefsLoaded]); // eslint-disable-line

  const top = Platform.OS === 'web' ? 67 : insets.top;
  const bot = Platform.OS === 'web' ? 34 : insets.bottom;

  // Compute overall accuracy from all stats
  const allEntries = Object.values(progressStats);
  const totalAttempted = allEntries.reduce((s, e) => s + e.attempted, 0);
  const totalCorrect   = allEntries.reduce((s, e) => s + e.correct, 0);
  const overallPct     = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;

  // Per-category accuracy (across all classes)
  const cats = ['addition', 'subtraction', 'multiplication', 'division'] as const;
  const catStats = cats.map(cat => {
    const entries = Object.entries(progressStats)
      .filter(([k]) => k.includes(`_${cat}_`))
      .map(([, v]) => v);
    const att = entries.reduce((s, e) => s + e.attempted, 0);
    const cor = entries.reduce((s, e) => s + e.correct, 0);
    return { cat, pct: att > 0 ? Math.round((cor / att) * 100) : -1, att };
  });

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push('/class-select');
  };

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bot + 24 }]} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.hero}>
          <View style={styles.iconRing}>
            <Text style={styles.iconText}>∑</Text>
          </View>
          <Text style={styles.appName}>{t('appName', lang)}</Text>
          <Text style={styles.tagline}>{t('tagline', lang)}</Text>
          <TouchableOpacity
            style={[styles.boardPill, { borderColor: boardCfg.colour + '66', backgroundColor: boardCfg.colour + '18' }]}
            onPress={() => { Haptics.selectionAsync(); router.push('/board-select'); }}
            activeOpacity={0.8}
            accessibilityLabel={t('changeBoard', lang)}
          >
            <Text style={[styles.boardPillText, { color: boardCfg.colour }]}>
              {lang === 'hi' ? boardCfg.labelHi : boardCfg.label}
            </Text>
            <Text style={styles.boardPillDot}>·</Text>
            <Text style={[styles.boardPillText, { color: boardCfg.colour }]}>
              {lang === 'hi' ? 'हिन्दी' : 'EN'}
            </Text>
            <Feather name="chevron-down" size={13} color={boardCfg.colour} />
          </TouchableOpacity>
        </View>

        {/* Streak and daily goal — the habit loop */}
        <View style={styles.streakRow}>
          <View style={styles.streakBox}>
            <Feather name="zap" size={15} color={C.gold} />
            <Text style={styles.streakNum}>{streak}</Text>
            <Text style={styles.streakLbl}>{t(streak === 1 ? 'day' : 'days', lang)}</Text>
          </View>
          <View style={styles.goalBox}>
            <View style={styles.goalTop}>
              <Text style={styles.goalLbl}>{t('todaysGoal', lang)}</Text>
              <Text style={styles.goalNum}>
                {Math.min(answeredToday, DAILY_GOAL)}/{DAILY_GOAL}
              </Text>
            </View>
            <View style={styles.goalTrack}>
              <View style={[styles.goalFill, {
                width: `${Math.min(100, (answeredToday / DAILY_GOAL) * 100)}%` as unknown as number,
                backgroundColor: answeredToday >= DAILY_GOAL ? C.easy : C.primary,
              }]} />
            </View>
          </View>
        </View>

        {/* Mistake review shortcut — shown when there are saved mistakes */}
        {savedMistakes.length > 0 && (
          <TouchableOpacity
            style={styles.mistakeCard}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/mistake-review'); }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`${savedMistakes.length} ${t(savedMistakes.length === 1 ? 'mistakeToReview' : 'mistakesToReview', lang)}`}
          >
            <View style={styles.mistakeIconBox}>
              <Feather name="alert-circle" size={20} color={C.hard} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.mistakeCardTitle}>
                {savedMistakes.length} {t(savedMistakes.length === 1 ? 'mistakeToReview' : 'mistakesToReview', lang)}
              </Text>
              <Text style={styles.mistakeCardSub}>{t('practiceToClear', lang)}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={C.hard} />
          </TouchableOpacity>
        )}

        {/* Quick action cards */}
        <View style={styles.quickRow}>
          <TouchableOpacity
            style={[styles.quickCard, styles.quickCardPrimary]}
            onPress={() => {
              // Direction C: the scheduler picks what to practise, so the
              // learner is not asked to judge their own weak areas.
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              startAdaptiveSession(selectedClass, '10q');
              router.push('/game');
            }}
            onLongPress={handleStart}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('smartPractice', lang)}
            accessibilityHint={t('smartPracticeSub', lang)}
          >
            <View style={styles.quickIconBox}>
              <Feather name="zap" size={22} color="#fff" />
            </View>
            <Text style={styles.quickCardTitle}>{t('smartPractice', lang)}</Text>
            <Text style={styles.quickCardSub}>{t('smartPracticeSub', lang)}</Text>
          </TouchableOpacity>

          <View style={styles.quickCol}>
            <TouchableOpacity style={styles.quickCardSmall} onPress={() => { Haptics.selectionAsync(); router.push('/tables-mode'); }} activeOpacity={0.8}
              accessibilityRole="button" accessibilityLabel={t('timesTables', lang).replace('\n', ' ')}>
              <Feather name="grid" size={18} color={C.catTables} />
              <Text style={styles.quickCardSmallText}>{t('timesTables', lang)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickCardSmall} onPress={() => { Haptics.selectionAsync(); router.push('/progress'); }} activeOpacity={0.8}
              accessibilityRole="button" accessibilityLabel={t('myProgress', lang).replace('\n', ' ')}>
              <Feather name="bar-chart-2" size={18} color={C.catAddition} />
              <Text style={styles.quickCardSmallText}>{t('myProgress', lang)}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Accuracy snapshot */}
        {totalAttempted > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>{t('accuracyByTopic', lang)}</Text>
              <Text style={styles.sectionSub}>{totalAttempted} {t('questionsAnswered', lang)}</Text>
            </View>
            <View style={styles.statsCard}>
              {catStats.map(({ cat, pct, att }) => {
                const meta = CATEGORY_META[cat];
                return (
                  <View key={cat} style={styles.statRow}>
                    <View style={[styles.statDot, { backgroundColor: meta.color }]} />
                    <Text style={styles.statLabel}>{categoryLabel(cat, lang)}</Text>
                    <View style={styles.statBarTrack}>
                      <View style={[styles.statBarFill, {
                        width: pct >= 0 ? `${pct}%` as unknown as number : 0,
                        backgroundColor: meta.color,
                      }]} />
                    </View>
                    <Text style={[styles.statPct, { color: pct < 0 ? C.mutedForeground : pct >= 80 ? C.easy : pct >= 50 ? C.medium : C.hard }]}>
                      {pct < 0 ? '—' : `${pct}%`}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Classes strip */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>{t('classes', lang)}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classStrip} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
          {CLASS_CONFIGS.map(cls => {
            const hsEntries = Object.entries(highScores).filter(([k]) => k.startsWith(cls.key + '_'));
            const best = hsEntries.reduce((s, [, v]) => s + v, 0);
            return (
              <TouchableOpacity
                key={cls.key}
                style={[styles.classChip, { backgroundColor: cls.color + '22', borderColor: cls.color + '55' }]}
                onPress={() => { Haptics.selectionAsync(); router.push('/class-select'); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.classChipLabel, { color: cls.color }]}>{CLASS_LABELS[cls.key][lang === 'hi' ? 'hi' : 'en']}</Text>
                {best > 0 && (
                  <View style={styles.chipBadge}>
                    <Feather name="star" size={9} color={C.gold} />
                    <Text style={styles.chipBadgeText}>{best}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.hint}>
          {lang === 'hi' ? boardCfg.fullNameHi : boardCfg.fullName}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  scroll: { paddingHorizontal: 20 },
  hero: { alignItems: 'center', paddingTop: 32, paddingBottom: 24 },
  iconRing: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: C.primary + '22', borderWidth: 2, borderColor: C.primary + '44',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  iconText: { fontSize: 38, color: C.primary, fontFamily: 'Inter_700Bold' },
  appName: { fontSize: 44, fontFamily: 'Inter_700Bold', color: C.foreground, textAlign: 'center', lineHeight: 50, marginBottom: 8 },
  tagline: { fontSize: 14, fontFamily: 'Inter_400Regular', color: C.mutedForeground, textAlign: 'center' },
  boardPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
  },
  boardPillText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  boardPillDot: { fontSize: 12, color: C.mutedForeground },

  quickRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  streakRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  streakBox: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.gold + '18', borderWidth: 1, borderColor: C.gold + '44',
    borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10,
  },
  streakNum: { fontSize: 17, fontFamily: 'Inter_700Bold', color: C.gold },
  streakLbl: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.mutedForeground },
  goalBox: {
    flex: 1, justifyContent: 'center', backgroundColor: C.card,
    borderWidth: 1, borderColor: C.border, borderRadius: 12,
    paddingHorizontal: 13, paddingVertical: 10, gap: 7,
  },
  goalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  goalLbl: { fontSize: 11.5, fontFamily: 'Inter_500Medium', color: C.mutedForeground },
  goalNum: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: C.foreground },
  goalTrack: { height: 5, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  goalFill: { height: 5, borderRadius: 3 },
  quickCardPrimary: {
    flex: 1.4, backgroundColor: C.primary, borderRadius: 20, padding: 18,
    justifyContent: 'flex-end', minHeight: 150,
  },
  quickCard: { flex: 1 },
  quickIconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  quickCardTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#fff', marginBottom: 2 },
  quickCardSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.7)' },
  quickCol: { flex: 1, gap: 12 },
  quickCardSmall: {
    flex: 1, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border,
    padding: 14, justifyContent: 'space-between',
  },
  quickCardSmallText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.foreground, marginTop: 8 },

  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  sectionLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.mutedForeground, letterSpacing: 1.5, marginBottom: 10 },
  sectionSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.mutedForeground },

  statsCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, gap: 14, marginBottom: 4 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.foreground, width: 100 },
  statBarTrack: { flex: 1, height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  statBarFill: { height: 6, borderRadius: 3 },
  statPct: { fontSize: 13, fontFamily: 'Inter_700Bold', width: 36, textAlign: 'right' },

  classStrip: { marginBottom: 20 },
  classChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  classChipLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  chipBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  chipBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.gold },

  hint: { textAlign: 'center', fontSize: 12, fontFamily: 'Inter_400Regular', color: C.mutedForeground, paddingTop: 4, paddingBottom: 8 },

  mistakeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.hard + '14', borderRadius: 14,
    borderWidth: 1, borderColor: C.hard + '44',
    padding: 14, marginBottom: 20,
  },
  mistakeIconBox: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.hard + '22', alignItems: 'center', justifyContent: 'center',
  },
  mistakeCardTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.foreground },
  mistakeCardSub:   { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.mutedForeground, marginTop: 1 },
});
