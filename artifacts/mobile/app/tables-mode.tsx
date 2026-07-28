import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGame } from '@/context/GameContext';
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
const TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function starLabel(best: number): string {
  if (best === 0) return '';
  if (best === 12) return '⭐ Perfect';
  if (best >= 10) return `${best}/12 ✓`;
  return `${best}/12`;
}

export default function TablesModeScreen() {
  const C = useLegacyPalette();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const router  = useRouter();
  const { startTablesGame, tablesBest } = useGame();

  const top = Platform.OS === 'web' ? 67 : insets.top;
  const bot = Platform.OS === 'web' ? 34 : insets.bottom;

  const handlePick = (n: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    startTablesGame(n);
    router.push('/game');
  };

  // Colour based on best score
  const getColor = (n: number): string => {
    const best = tablesBest[n] ?? 0;
    if (best === 0) return C.catTables;
    if (best === 12) return C.easy;
    if (best >= 8) return C.medium;
    return C.hard;
  };

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}
          hitSlop={touchSlop(40)} accessibilityRole="button" accessibilityLabel="Go back">
          <Feather name="arrow-left" size={22} color={C.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Times Tables</Text>
          <Text style={styles.headerSub}>Choose a table to drill — 12 questions each</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bot + 24 }]} showsVerticalScrollIndicator={false}>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: C.catTables }]} /><Text style={styles.legendText}>Not started</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: C.easy }]} /><Text style={styles.legendText}>12/12 perfect</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: C.medium }]} /><Text style={styles.legendText}>8–11/12</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: C.hard }]} /><Text style={styles.legendText}>Under 8</Text></View>
        </View>

        {/* Table grid */}
        <View style={styles.grid}>
          {TABLES.map(n => {
            const best  = tablesBest[n] ?? 0;
            const color = getColor(n);
            const label = starLabel(best);
            return (
              <TouchableOpacity key={n} style={[styles.tableCard, { borderColor: color + '55' }]} onPress={() => handlePick(n)} activeOpacity={0.8}>
                <View style={[styles.tableNum, { backgroundColor: color + '22' }]}>
                  <Text style={[styles.tableNumText, { color }]}>{n}</Text>
                </View>
                <Text style={styles.tableMultiply}>× table</Text>
                {label !== '' && (
                  <View style={[styles.tableBest, { backgroundColor: color + '22' }]}>
                    <Text style={[styles.tableBestText, { color }]}>{label}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Preview of a table */}
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>How it works</Text>
          <Text style={styles.previewDesc}>
            Pick a table. You'll get all 12 questions (e.g. 7×1 through 7×12) in random order.{'\n'}
            4 choices · instant feedback · track your personal best.
          </Text>
        </View>
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.foreground },
  headerSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.mutedForeground, textAlign: 'center', marginTop: 2 },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 18 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.mutedForeground },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  tableCard: {
    width: '30%', backgroundColor: C.card, borderRadius: 16, borderWidth: 1,
    alignItems: 'center', paddingVertical: 16, paddingHorizontal: 8, gap: 6,
  },
  tableNum: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  tableNumText: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  tableMultiply: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.mutedForeground },
  tableBest: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  tableBestText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  previewCard: { backgroundColor: C.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  previewTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.foreground, marginBottom: 6 },
  previewDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.mutedForeground, lineHeight: 20 },
});
