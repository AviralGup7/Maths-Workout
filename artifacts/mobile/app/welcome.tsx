import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGame } from '@/context/GameContext';
import { BOARD_CONFIGS } from '@/curriculum/boards';
import { LANGUAGES, t } from '@/i18n/strings';
import type { Lang } from '@/i18n/strings';
import type { Board } from '@/curriculum/boards';
import { useMotion } from '@/hooks/useMotion';
import { touchSlop } from '@/hooks/useA11y';
import colors from '@/constants/colors';

const C = colors.light;
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
    router.replace('/');
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
      title: lang === 'hi' ? 'आपका बोर्ड, आपका पाठ्यक्रम' : 'Your board, your syllabus',
      body: lang === 'hi'
        ? 'विषय और कठिनाई आपके बोर्ड के अनुसार बदलते हैं। इसे बाद में कभी भी बदल सकते हैं।'
        : 'Topics and difficulty follow your board. You can change this any time.',
    },
    {
      icon: 'zap' as const,
      title: lang === 'hi' ? 'स्मार्ट अभ्यास' : 'Smart Practice',
      body: lang === 'hi'
        ? 'ऐप देखता है कि आप किसमें कमज़ोर हैं और वही अभ्यास कराता है — आपको चुनना नहीं पड़ता।'
        : 'The app notices what you find hard and practises that — so you do not have to choose.',
    },
    {
      icon: 'refresh-cw' as const,
      title: lang === 'hi' ? 'गलतियाँ सबसे ज़रूरी' : 'Mistakes matter most',
      body: lang === 'hi'
        ? 'हर गलती सहेजी जाती है। ऐप बताता है कि गलती क्यों हुई, और उसे दोबारा अभ्यास कराता है।'
        : 'Every mistake is saved. The app explains why it happened, then brings it back to practise.',
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
          hitSlop={touchSlop(36)}
          accessibilityRole="button"
          accessibilityLabel={lang === 'hi' ? 'छोड़ें · Skip' : 'Skip'}
        >
          <Text style={styles.skip}>{lang === 'hi' ? 'छोड़ें · Skip' : 'Skip'}</Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.body, { opacity: fade }]}>
        <View style={styles.iconRing}>
          <Feather name={card.icon} size={34} color={C.primary} />
        </View>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background, paddingHorizontal: 22 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 40 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.border },
  dotOn: { backgroundColor: C.primary, width: 20 },
  skip: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.mutedForeground },
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
    fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.mutedForeground,
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
