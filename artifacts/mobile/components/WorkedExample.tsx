import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { WorkedExample as WE } from '@/learning/workedExamples';
import { t } from '@/i18n/strings';
import type { Lang } from '@/i18n/strings';
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

/**
 * A solved instance of the problem the learner just failed.
 *
 * Progressive disclosure is the whole design: steps reveal one tap at a time.
 * That is the difference between a worked example and a wall of text — the
 * child has to act to advance, which keeps attention engaged and lets them stop
 * as soon as they see it. A fully-revealed panel is read by nobody.
 *
 * The child cannot dismiss this into nothing: on close, the caller serves a
 * structurally identical twin question. Seeing a method and applying it while
 * it is still in working memory is the completion-problem effect, and it is
 * what turns "I watched" into "I can".
 */
export function WorkedExample({
  example,
  lang,
  onDone,
}: {
  example: WE;
  lang: Lang;
  onDone: () => void;
}) {
  const C = useLegacyPalette();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const [revealed, setRevealed] = useState(1);
  const total = example.steps.length;
  const allShown = revealed >= total;

  const advance = () => {
    Haptics.selectionAsync();
    if (allShown) onDone();
    else setRevealed(n => n + 1);
  };

  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <View style={styles.header}>
        <Feather name="edit-3" size={15} color={C.primary} />
        <Text style={styles.title}>
          {lang === 'hi' ? 'आइए इसे मिलकर हल करें' : "Let's work this one through"}
        </Text>
      </View>

      <Text style={styles.problem}>{example.problem}</Text>

      <ScrollView style={styles.steps} contentContainerStyle={{ paddingBottom: 4 }}>
        {example.steps.slice(0, revealed).map(s => (
          <View key={s.n} style={styles.step}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNum}>{s.n}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepText}>{lang === 'hi' ? s.text.hi : s.text.en}</Text>
              {!!s.work && <Text style={styles.work}>{s.work}</Text>}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Named only once every step has been seen. Leading with the child's
          error would invite them to read the mistake and skip the method. */}
      {allShown && example.errorNote && (
        <View style={styles.errorNote}>
          <Feather name="alert-circle" size={13} color={C.medium} style={{ marginTop: 1 }} />
          <Text style={styles.errorText}>
            {lang === 'hi' ? example.errorNote.hi : example.errorNote.en}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.button}
        onPress={advance}
        activeOpacity={0.85}
        hitSlop={touchSlop(44)}
        accessibilityRole="button"
        accessibilityLabel={
          allShown
            ? t('done', lang)
            : (lang === 'hi' ? 'अगला चरण · Next step' : 'Next step')
        }
      >
        <Text style={styles.buttonText}>
          {allShown
            ? (lang === 'hi' ? 'समझ गया · Got it' : 'Got it')
            : (lang === 'hi' ? 'अगला चरण' : 'Next step')}
        </Text>
        <Feather name={allShown ? 'check' : 'chevron-right'} size={16} color={C.primaryForeground} />
      </TouchableOpacity>

      {/* Progress dots: shows the child how much is left, so tapping through
          feels bounded rather than open-ended. */}
      <View style={styles.dots}>
        {example.steps.map((s, i) => (
          <View key={s.n} style={[styles.dot, i < revealed && styles.dotOn]} />
        ))}
      </View>
    </View>
  );
}

/**
 * Styles are a factory rather than a module constant: they reference palette
 * values, and a module-scope StyleSheet freezes those at import time — the
 * exact defect that left dark mode non-functional (docs/20 F1).
 */
const makeStyles = (C: ReturnType<typeof useLegacyPalette>) => StyleSheet.create({
  card: {
    backgroundColor: C.card, borderRadius: 18, borderWidth: 1,
    borderColor: C.primary + '55', padding: 16, marginTop: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  title: { fontSize: 13.5, fontFamily: 'Inter_700Bold', color: C.primary },
  problem: {
    fontSize: 20, fontFamily: 'Inter_700Bold', color: C.foreground,
    textAlign: 'center', marginBottom: 14,
  },
  steps: { maxHeight: 210 },
  step: { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'flex-start' },
  stepBadge: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: C.primary + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  stepNum: { fontSize: 11, fontFamily: 'Inter_700Bold', color: C.primary },
  stepText: { fontSize: 13.5, fontFamily: 'Inter_400Regular', color: C.foreground, lineHeight: 19 },
  work: {
    fontSize: 15, fontFamily: 'Inter_700Bold', color: C.primary,
    marginTop: 5, letterSpacing: 1,
  },
  errorNote: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: C.medium + '14', borderRadius: 10, padding: 10, marginBottom: 4,
  },
  errorText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: C.mutedForeground, lineHeight: 17 },
  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: C.primary, borderRadius: 12, paddingVertical: 13, marginTop: 10,
  },
  buttonText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.primaryForeground },
  dots: { flexDirection: 'row', gap: 5, justifyContent: 'center', marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.border },
  dotOn: { backgroundColor: C.primary },
});
