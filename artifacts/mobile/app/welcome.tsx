import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGame } from '@/context/GameContext';
import { Mascot } from '@/components/Mascot';
import { BOARD_CONFIGS } from '@/curriculum/boards';
import { LANGUAGES, t } from '@/i18n/strings';
import type { Lang } from '@/i18n/strings';
import type { Board } from '@/curriculum/boards';
import { useMotion } from '@/hooks/useMotion';
import { touchSlop } from '@/hooks/useA11y';
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
export const SEEN_WELCOME_KEY = '@maths_workout_seen_welcome';

/**
 * First-run onboarding.
 *
 * Three cards, skippable at every step. Deliberately short: a child opening a
 * maths app wants to do maths, and a long tutorial is a wall in front of that.
 *
 * The first card is the only one that asks for anything, because board and
 * language genuinely change what the child sees. The other two explain the two
 * features that are otherwise invisible — why questions are chosen for them,
 * and what the mistake review is for.
 */
export default function WelcomeScreen() {
  const C = useLegacyPalette();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const motion = useMotion();
  const { board, setBoard, lang, setLang } = useGame();

  const [step, setStep] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  const top = Platform.OS === 'web' ? 67 : insets.top;
  const bot = Platform.OS === 'web' ? 34 : insets.bottom;

  const finish = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try { await AsyncStorage.setItem(SEEN_WELCOME_KEY, '1'); } catch { /* not fatal */ }
    // docs/27 P1-01: straight into placement, so the very first practice
    // session is already pitched at the right level.
    router.replace('/placement');
  };

  const go = (next: number) => {
    Haptics.selectionAsync().catch(() => {});
    // Cross-fade rather than slide: cheaper, and calmer under reduced motion.
    motion.timing(fade, { toValue: 0, duration: 130 }).start(() => {
      setStep(next);
      motion.timing(fade, { toValue: 1, duration: 180 }).start();
    });
  };

  const CARDS = [
    {
      icon: 'book-open' as const,
      // docs/28: the very first screen a child saw asked them to choose an
      // examination board — a parent question rendered in a child flow. The
      // card is unchanged in function (board genuinely changes the curriculum)
      // but is now addressed to the adult who is present at first launch, and
      // is skippable in one tap like every other step.
      title: lang === 'hi' ? 'बड़ों के लिए एक सवाल' : 'One question for a grown-up',
      body: lang === 'hi'
        ? 'बच्चे का बोर्ड चुनें — विषय उसी के अनुसार आएँगे। बाद में कभी भी बदल सकते हैं।'
        : "Pick your child's board so the topics match their school. You can change this any time.",
    },
    {
      icon: 'zap' as const,
      title: lang === 'hi' ? 'हम आपके लिए चुनेंगे' : "We'll pick for you",
      body: lang === 'hi'
        ? 'आपको यह नहीं सोचना पड़ेगा कि क्या अभ्यास करें। हम देखेंगे कि क्या कठिन लग रहा है।'
        : "You don't have to choose what to practise. We watch what feels hard and bring it back.",
    },
    {
      icon: 'refresh-cw' as const,
      title: lang === 'hi' ? 'गलती होना अच्छा है' : "Getting it wrong is fine",
      body: lang === 'hi'
        ? 'हर गलती से हमें पता चलता है कि आगे क्या सिखाना है। कुछ भी खोता नहीं।'
        : 'Every mistake tells us what to help with next. Nothing is lost.',
    },
  ];

  const card = CARDS[step];
  const isLast = step === CARDS.length - 1;

  return (
    <View style={[styles.container, { paddingTop: top + 8, paddingBottom: bot + 16 }]}>
      {/* Skip is always reachable — never trap a child in a tutorial. */}
      <View style={styles.topRow}>
        <View style={styles.dots}>
          {CARDS.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotOn]} />
          ))}
        </View>
        <TouchableOpacity
          onPress={finish}
          style={styles.skipBtn}
          hitSlop={touchSlop(36)}
          accessibilityRole="button"
          accessibilityLabel={lang === 'hi' ? 'छोड़ें · Skip' : 'Skip'}
        >
          <Text style={styles.skip}>{lang === 'hi' ? 'छोड़ें · Skip' : 'Skip'}</Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.body, { opacity: fade }]}>
        {/* docs/28: the character greets the child before any question does.
            On the later cards it takes over from the abstract Feather glyph,
            which meant nothing to a six-year-old. */}
        {step === 0 ? (
          <View style={styles.iconRing}>
            <Feather name={card.icon} size={34} color={C.primary} />
          </View>
        ) : (
          <Mascot mood={step === 1 ? 'encouraging' : 'thinking'} size={110} />
        )}
        <Text style={styles.title} accessibilityRole="header">{card.title}</Text>
        <Text style={styles.bodyText}>{card.body}</Text>

        {/* Only the first card asks for input. */}
        {step === 0 && (
          <View style={styles.pickers}>
            <Text style={styles.pickerLabel}>{t('selectLanguage', lang)}</Text>
            <View style={styles.row}>
              {LANGUAGES.map(l => (
                <TouchableOpacity
                  key={l.key}
                  style={[styles.pill, lang === l.key && styles.pillOn]}
                  onPress={() => { Haptics.selectionAsync().catch(() => {}); setLang(l.key as Lang); }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: lang === l.key }}
                  accessibilityLabel={l.nativeLabel}
                >
                  <Text style={[styles.pillText, lang === l.key && { color: C.primary }]}>
                    {l.nativeLabel}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.pickerLabel, { marginTop: 16 }]}>{t('selectBoard', lang)}</Text>
            <View style={styles.row}>
              {BOARD_CONFIGS.map(b => (
                <TouchableOpacity
                  key={b.key}
                  style={[
                    styles.pill,
                    board === b.key && { borderColor: b.colour, backgroundColor: b.colour + '1E' },
                  ]}
                  onPress={() => { Haptics.selectionAsync().catch(() => {}); setBoard(b.key as Board); }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: board === b.key }}
                  accessibilityLabel={b.fullName}
                >
                  <Text style={[styles.pillText, board === b.key && { color: b.colour }]}>
                    {b.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </Animated.View>

      <TouchableOpacity
        style={styles.cta}
        onPress={() => (isLast ? finish() : go(step + 1))}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={isLast
          ? (lang === 'hi' ? 'शुरू करें · Start' : 'Start')
          : (lang === 'hi' ? 'आगे · Next' : 'Next')}
      >
        <Text style={styles.ctaText}>
          {isLast ? (lang === 'hi' ? 'शुरू करें · Start' : 'Start') : (lang === 'hi' ? 'आगे · Next' : 'Next')}
        </Text>
        <Feather name="arrow-right" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

/**
 * Styles are a factory rather than a module constant: they reference palette
 * values, and a module-scope StyleSheet freezes those at import time — the
 * exact defect that left dark mode non-functional (docs/20 F1).
 */
const makeStyles = (C: ReturnType<typeof useLegacyPalette>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background, paddingHorizontal: 22 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 40 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.border },
  dotOn: { backgroundColor: C.primary, width: 20 },
  // docs/28: the tap area measured 26x16 — under a third of the WCAG 2.5.5
  // minimum, in the corner most likely to be mis-tapped by a small hand.
  skipBtn: { minWidth: 64, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  skip: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.mutedForeground },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  iconRing: {
    width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.primary + '1E', borderWidth: 2, borderColor: C.primary + '44', marginBottom: 6,
  },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold', color: C.foreground, textAlign: 'center' },
  bodyText: {
    fontSize: 14.5, fontFamily: 'Inter_400Regular', color: C.mutedForeground,
    textAlign: 'center', lineHeight: 21, paddingHorizontal: 8,
  },
  pickers: { width: '100%', marginTop: 18 },
  pickerLabel: {
    fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.mutedForeground,
    letterSpacing: 1.2, marginBottom: 8,
  },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: {
    flex: 1, minWidth: 90, minHeight: 44, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.card,
    borderWidth: 2, borderColor: C.border,
  },
  pillOn: { borderColor: C.primary, backgroundColor: C.primary + '1E' },
  pillText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.foreground },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 54, borderRadius: 15, backgroundColor: C.primary,
  },
  ctaText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
});
