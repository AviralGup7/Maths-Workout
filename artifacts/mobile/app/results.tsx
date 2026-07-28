import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGame, CLASS_CONFIGS, CATEGORY_META } from '@/context/GameContext';
import { GrowthBar } from '@/components/ui/GrowthBar';
import {
  headline, returnSentence, completionSentence, movementSentence,
} from '@/learning/sessionReport';
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

/**
 * Session framing.
 *
 * docs/25 · Tier 1 item 7. This screen used to lead with three gold stars
 * awarded on session accuracy, which the audit flagged as the only mechanic in
 * the product that exists purely to make a number go up — and as the most
 * game-like surface a parent sees over a shoulder.
 *
 * It also contradicted the app's own pedagogy: a child who attempts hard
 * material and scores 6/10 has often learned more than one who scores 10/10 on
 * easy revision, and the mastery model knows this. Rewarding raw accuracy tells
 * them the opposite.
 *
 * The stars are gone. What replaces them is what actually happened to the
 * learner's understanding, which is both more motivating for the child and more
 * reassuring for the parent — the two audiences want the same thing here.
 */
function getMessage(s: number, t: number, lang: 'en' | 'hi') {
  const p = t === 0 ? 0 : s / t;
  const hi = lang === 'hi';
  // Deliberately about the WORK, not the score. Even the weakest session is
  // framed as practice done rather than a grade received.
  if (p >= 0.9) return hi
    ? { title: 'शानदार अभ्यास', sub: 'लगभग हर सवाल सही निकला' }
    : { title: 'Strong session', sub: 'Nearly everything came out right' };
  if (p >= 0.6) return hi
    ? { title: 'अच्छा अभ्यास', sub: 'आपने कठिन सवालों पर काम किया' }
    : { title: 'Good practice', sub: 'You worked through some hard ones' };
  if (p >= 0.3) return hi
    ? { title: 'कठिन अभ्यास', sub: 'यही वह अभ्यास है जिससे सीख होती है' }
    : { title: 'Tough session', sub: 'This is the practice that teaches you most' };
  return hi
    ? { title: 'मुश्किल दौर', sub: 'कठिन चीज़ों पर टिके रहना ही असली काम है' }
    : { title: 'Hard going', sub: 'Sticking with hard things is the real work' };
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
    // docs/25 Tier 1. Everything below was computed by the engine and shown
    // nowhere: this screen previously imported no progression value at all.
    sessionReport, xpEarnedThisSession, level, totalXp,
  } = useGame();

  const scoreAnimRef = useRef<Animated.Value | null>(null);
  const fadeAnimRef  = useRef<Animated.Value | null>(null);
  const scoreAnim = scoreAnimRef.current ?? (scoreAnimRef.current = new Animated.Value(0));
  const fadeAnim  = fadeAnimRef.current  ?? (fadeAnimRef.current  = new Animated.Value(0));

  const { title, sub } = getMessage(score, totalQuestions, lang === 'hi' ? 'hi' : 'en');

  /**
   * Skill bars, minus the one the headline is already reporting.
   *
   * The headline picks the most impressive movement and the bar list picks the
   * largest deltas, so without this the same skill is stated twice in a row.
   */
  const headlineSkill =
    sessionReport?.chaptersCompleted.length ? null
    : sessionReport?.mastered[0]?.skill
    ?? sessionReport?.breakthroughs[0]?.skill
    ?? sessionReport?.improvements[0]?.skill
    ?? null;
  const shownMovements = (sessionReport?.improvements ?? [])
    .filter(m => m.skill !== headlineSkill)
    .slice(0, 3);
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

    // Ordered by how HARD the achievement is, not how large the number is.
    //
    // docs/25 Tier 1, items 5 and 6. Two reasons were previously unreachable:
    // finishing a chapter (the largest bonus in the economy) produced nothing,
    // and every celebration was gated at MASTERED_THRESHOLD, so a struggling
    // learner earned ZERO in a year of real improvement. A breakthrough out of
    // "struggling" now outranks a streak — it is rarer and harder, and it
    // reaches the child who most needs to see it.
    const hi = lang === 'hi';
    const r = sessionReport;
    if (r && r.chaptersCompleted.length > 0) {
      const title = r.chaptersCompleted[0].title[hi ? 'hi' : 'en'];
      setCelebration({
        reason: 'chapter',
        message: hi ? `अध्याय पूरा: ${title}` : `Chapter complete: ${title}`,
      });
    } else if (r && r.mastered.length > 0) {
      setCelebration({
        reason: 'mastery',
        message: hi ? `${r.mastered[0].label} पक्का हुआ!` : `${r.mastered[0].label} is secure!`,
      });
    } else if (r && r.breakthroughs.length > 0) {
      setCelebration({
        reason: 'breakthrough',
        message: hi ? `${r.breakthroughs[0].label} में बड़ी छलांग!` : `Breakthrough in ${r.breakthroughs[0].label}!`,
      });
    } else if (isStreakMilestone(streak)) {
      setCelebration({
        reason: 'streak',
        message: hi ? `${streak} दिन का अभ्यास!` : `${streak} day streak!`,
      });
    } else if (isNewBest && !isTablesMode) {
      setCelebration({
        reason: 'best',
        message: hi ? 'नया रिकॉर्ड!' : 'New personal best!',
      });
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    saveScore();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(scoreAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
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

      {/* Score circle */}
      {/* docs/25 item 7, completed.
          Removing the stars was not enough: a 50pt score in the class accent
          colour, ringed and centred, is the same outcome-grade in a larger
          typeface — and on a hard session it renders as a big red "2 / 10",
          which is exactly the verdict this screen is supposed to stop
          delivering. Caught by looking at a real render; the code was correct
          and the experience was not.

          Questions ANSWERED is the honest headline number: it is what the
          child actually did, it never punishes attempting hard material, and
          the accuracy split remains available below for anyone who wants it. */}
      <Animated.View style={[styles.scoreCircle, { borderColor: C.primary }, { transform: [{ scale: scoreAnim.interpolate({ inputRange:[0,1], outputRange:[0.5,1] }) }] }]}>
        <Text style={[styles.scoreBig, { color: C.primary }]}>{totalQuestions}</Text>
        <Text style={styles.scoreTotal}>
          {lang === 'hi' ? 'सवाल' : totalQuestions === 1 ? 'question' : 'questions'}
        </Text>
      </Animated.View>

      <Text style={styles.msgTitle}>{title}</Text>
      <Text style={styles.msgSub}>{sub}</Text>

      {isNewBest && !isTablesMode && (
        <View style={styles.bestRow}>
          <Feather name="award" size={14} color={C.gold} />
          <Text style={styles.bestText}>{lang === 'hi' ? 'नया रिकॉर्ड!' : 'New personal best'}</Text>
        </View>
      )}

      {/* ── What actually changed ──────────────────────────────────────────
          docs/25 Tier 1, items 1/3/4. The engine computed all of this and the
          screen showed none of it: XP earned, level progress, and which skills
          moved. A child finished practising and was handed a test result. */}
      {!isTablesMode && (
        <View style={styles.learningCard}>
          <View style={styles.xpRow}>
            <Feather name="zap" size={14} color={C.primary} />
            {/* "+0 XP" is a worse message than no message: it reads as a
                verdict on the child rather than an accurate statement that
                nothing NEW was learned this session (XP is paid for movement
                in the mastery model, so a consolidation session earns little
                by design). Show the total instead — it never goes down. */}
            <Text style={styles.xpText}>
              {xpEarnedThisSession > 0
                ? `+${xpEarnedThisSession} XP`
                : `${Math.round(totalXp)} XP`}
            </Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.levelText}>
              {lang === 'hi' ? 'स्तर' : 'Level'} {level.level}
            </Text>
          </View>

          {/* The level bar animates from where the session started, so the
              child SEES the movement rather than reading a static number. */}
          <GrowthBar
            from={Math.max(0, level.into - xpEarnedThisSession)}
            to={level.into}
            max={level.needed}
            caption={`${Math.round(level.into)} / ${Math.round(level.needed)}`}
            tint={C.primary}
            delay={250}
          />

          {/* The single most encouraging TRUE thing about this session. */}
          {!!sessionReport && !!headline(sessionReport, lang === 'hi' ? 'hi' : 'en') && (
            <View style={styles.headlineRow}>
              <Feather name="trending-up" size={14} color={C.easy} />
              <Text style={styles.headlineText}>
                {headline(sessionReport, lang === 'hi' ? 'hi' : 'en')}
              </Text>
            </View>
          )}

          {/* Per-skill movement: "Fractions 62% → 71%". At most three, because
              a list of everything is a report, not a reward. */}
          {/* The bars exclude whatever the headline already said, or the same
              sentence appears twice — caught in a browser render, not in a
              unit test, because both parts were individually correct. */}
          {!!sessionReport && shownMovements.length > 0 && (
            <View style={{ gap: 10, marginTop: 12 }}>
              {shownMovements.map((m, i) => (
                <GrowthBar
                  key={m.skill}
                  from={m.before}
                  to={m.after}
                  label={m.label}
                  caption={`${Math.round(m.before * 100)}% → ${Math.round(m.after * 100)}%`}
                  tint={m.mastered ? C.easy : C.primary}
                  height={7}
                  delay={450 + i * 120}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── Why come back ──────────────────────────────────────────────────
          docs/25 Tier 1, items 2/8. Nothing in the product told a child what
          was waiting for them tomorrow, while the scheduler computed exactly
          that on every run. Both lines below are forward-looking; every other
          retention surface in the app points backwards. */}
      {!isTablesMode && !!sessionReport && (
        <View style={styles.nextRow}>
          {!!returnSentence(sessionReport, lang === 'hi' ? 'hi' : 'en') && (
            <View style={styles.nextChip}>
              <Feather name="clock" size={13} color={C.primary} />
              <Text style={styles.nextText}>
                {returnSentence(sessionReport, lang === 'hi' ? 'hi' : 'en')}
              </Text>
            </View>
          )}
          {sessionReport.chaptersNearlyDone.slice(0, 1).map(ch => (
            <View key={ch.chapter.id} style={styles.nextChip}>
              <Feather name="flag" size={13} color={C.gold} />
              <Text style={styles.nextText}>
                {completionSentence(ch, lang === 'hi' ? 'hi' : 'en')}
              </Text>
            </View>
          ))}
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
  learningCard: {
    width: '100%', backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, padding: 16, marginTop: 18, gap: 4,
  },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  xpText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.primary, fontVariant: ['tabular-nums'] },
  levelText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.mutedForeground },
  headlineRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14 },
  headlineText: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.foreground },
  nextRow: { width: '100%', gap: 8, marginTop: 14 },
  nextChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.secondary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12,
  },
  nextText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: C.foreground },
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
