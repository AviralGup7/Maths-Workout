import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGame } from '@/context/GameContext';
import { BOARD_CONFIGS, categoriesFor, CLASS_LABELS } from '@/curriculum/boards';
import type { Board } from '@/curriculum/boards';
import { LANGUAGES, t, categoryLabel } from '@/i18n/strings';
import type { Lang } from '@/i18n/strings';
import type { TimerPreference } from '@/learning/timerPolicy';
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
 * Board and language selection.
 *
 * Shown as a first-run step and reachable later from Home. Board choice is not
 * cosmetic — it changes which topics exist at each class and how large the
 * numbers are, so the screen previews that rather than just naming the board.
 */
export default function BoardSelectScreen() {
  const C = useLegacyPalette();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { board, setBoard, lang, setLang, timerPref, setTimerPref } = useGame();

  const top = Platform.OS === 'web' ? 67 : insets.top;
  const bot = Platform.OS === 'web' ? 34 : insets.bottom;

  const chooseBoard = (b: Board) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBoard(b);
  };

  const chooseLang = (l: Lang) => {
    Haptics.selectionAsync();
    setLang(l);
  };

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}
          hitSlop={touchSlop(40)} accessibilityRole="button" accessibilityLabel="Go back">
          <Feather name="arrow-left" size={22} color={C.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('selectBoard', lang)}</Text>
          <Text style={styles.headerSub}>{t('selectBoardSub', lang)}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bot + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Language first: everything below should already read in it. */}
        <Text style={styles.sectionLabel}>{t('selectLanguage', lang).toUpperCase()}</Text>
        <View style={styles.langRow}>
          {LANGUAGES.map(l => {
            const sel = lang === l.key;
            return (
              <TouchableOpacity
                key={l.key}
                style={[styles.langChip, sel && styles.langChipOn]}
                onPress={() => chooseLang(l.key)}
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityState={{ selected: sel }}
              >
                <Text style={[styles.langText, sel && { color: C.primary }]}>{l.nativeLabel}</Text>
                {sel && <Feather name="check" size={15} color={C.primary} />}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 22 }]}>{t('selectBoard', lang).toUpperCase()}</Text>
        {BOARD_CONFIGS.map(b => {
          const sel = board === b.key;
          // Preview the practical difference: how many topics this board opens
          // at Class 5, where the CBSE/ICSE divergence is clearest.
          const sample = categoriesFor(b.key, '5th').length;
          return (
            <TouchableOpacity
              key={b.key}
              style={[styles.card, { borderColor: sel ? b.colour : C.border }, sel && { borderWidth: 2 }]}
              onPress={() => chooseBoard(b.key)}
              activeOpacity={0.85}
              accessibilityRole="radio"
              accessibilityState={{ selected: sel }}
            >
              <View style={[styles.badge, { backgroundColor: b.colour + '22' }]}>
                <Text style={[styles.badgeText, { color: b.colour }]}>
                  {lang === 'hi' ? b.labelHi : b.label}
                </Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{lang === 'hi' ? b.fullNameHi : b.fullName}</Text>
                <Text style={styles.cardNote}>{lang === 'hi' ? b.noteHi : b.note}</Text>
                <Text style={styles.cardMeta}>
                  {CLASS_LABELS['5th'][lang === 'hi' ? 'hi' : 'en']} · {sample} {t('topicsAvailable', lang)}
                </Text>
              </View>
              {sel && <Feather name="check-circle" size={20} color={b.colour} />}
            </TouchableOpacity>
          );
        })}

        {/* §9 M1 — the timer is a setting, not a fact of the app.
            Timed testing is a documented driver of mathematics anxiety in early
            primary, so 'auto' turns it off below Class 3. Kept here beside the
            other preferences rather than buried behind a new settings screen. */}
        <Text style={[styles.sectionLabel, { marginTop: 22 }]}>
          {t('questionTimer', lang).toUpperCase()}
        </Text>
        <View style={styles.langRow}>
          {([
            { key: 'auto' as const, label: t('timerAuto', lang) },
            { key: 'on'   as const, label: t('timerOn', lang) },
            { key: 'off'  as const, label: t('timerOff', lang) },
          ]).map(opt => {
            const sel = timerPref === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.langChip, sel && styles.langChipOn]}
                onPress={() => { Haptics.selectionAsync(); setTimerPref(opt.key as TimerPreference); }}
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityState={{ selected: sel }}
              >
                <Text style={[styles.langText, sel && { color: C.primary }]}>{opt.label}</Text>
                {sel && <Feather name="check" size={15} color={C.primary} />}
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.timerNote}>
          {timerPref === 'auto' ? t('timerAutoNote', lang) : t('timerNote', lang)}
        </Text>

        {/* Parents live here rather than in a tab: a child opening the app 300
            times should not see a door labelled "for grown-ups" 300 times. */}
        <TouchableOpacity
          style={[styles.card, { borderColor: C.border, marginTop: 22 }]}
          onPress={() => { Haptics.selectionAsync(); router.push('/parent'); }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t('forParents', lang)}
        >
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>{t('forParents', lang)}</Text>
            <Text style={styles.cardNote}>
              {lang === 'hi'
                ? 'प्रगति, मज़बूत और कमज़ोर विषय, और आगे क्या करें'
                : 'Progress, strengths and gaps, and what to do next'}
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={C.mutedForeground} />
        </TouchableOpacity>

        {/* What actually changes, so the choice is informed rather than arbitrary. */}
        <View style={styles.diffCard}>
          <Text style={styles.diffTitle}>
            {lang === 'hi' ? 'बोर्ड बदलने से क्या बदलता है' : 'What changes with your board'}
          </Text>
          {(['percentages', 'ratio', 'decimals'] as const).map(cat => {
            const cbse = BOARD_CONFIGS.map(b => ({
              b,
              from: categoriesFor(b.key, '1st').includes(cat) ? 1
                : [1, 2, 3, 4, 5, 6].find(n =>
                    categoriesFor(b.key, (['1st','2nd','3rd','4th','5th','6th'] as const)[n - 1]).includes(cat),
                  ),
            }));
            return (
              <View key={cat} style={styles.diffRow}>
                <Text style={styles.diffCat}>{categoryLabel(cat, lang)}</Text>
                {cbse.map(({ b, from }) => (
                  <View key={b.key} style={styles.diffCell}>
                    <Text style={[styles.diffCellLabel, { color: b.colour }]}>{b.label}</Text>
                    <Text style={styles.diffCellValue}>
                      {from ? `${lang === 'hi' ? 'कक्षा' : 'Cl'} ${from}` : '—'}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.continueBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); router.back(); }}
          activeOpacity={0.85}
        >
          <Text style={styles.continueText}>{t('done', lang)}</Text>
          <Feather name="arrow-right" size={18} color="#fff" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

/**
 * Styles are a factory rather than a module constant: they reference palette
 * values, and a module-scope StyleSheet freezes those at import time — the
 * exact defect that left dark mode non-functional (docs/20 F1).
 */
const makeStyles = (C: ReturnType<typeof useLegacyPalette>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: C.card,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.foreground },
  headerSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.mutedForeground, textAlign: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },
  sectionLabel: {
    fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.mutedForeground,
    letterSpacing: 1.5, marginBottom: 10,
  },
  langRow: { flexDirection: 'row', gap: 10 },
  langChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 14, borderRadius: 13, backgroundColor: C.card,
    borderWidth: 2, borderColor: C.border,
  },
  langChipOn: { borderColor: C.primary, backgroundColor: C.primary + '18' },
  langText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.foreground },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    borderRadius: 14, borderWidth: 1, backgroundColor: C.card, marginBottom: 10,
  },
  badge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, minWidth: 62, alignItems: 'center' },
  badgeText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  cardBody: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 13.5, fontFamily: 'Inter_600SemiBold', color: C.foreground },
  cardNote: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.mutedForeground, lineHeight: 16 },
  cardMeta: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.mutedForeground, marginTop: 2 },
  timerNote: {
    fontSize: 13, fontFamily: 'Inter_400Regular', color: C.mutedForeground,
    marginTop: 8, marginBottom: 4,
  },
  diffCard: {
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 14, gap: 12, marginTop: 12,
  },
  diffTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.foreground },
  diffRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  diffCat: { flex: 1.3, fontSize: 13, fontFamily: 'Inter_500Medium', color: C.mutedForeground },
  diffCell: { flex: 1, alignItems: 'center' },
  diffCellLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  diffCellValue: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.foreground },
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, borderRadius: 14, backgroundColor: C.primary, marginTop: 18,
  },
  continueText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
});
