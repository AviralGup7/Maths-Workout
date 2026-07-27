import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useGame, CLASS_CONFIGS, CATEGORY_META, CLASS_TOPICS,
  Category, getAvailableCategories,
} from '@/context/GameContext';
import colors from '@/constants/colors';

const C = colors.light;

export default function CategorySelectScreen() {
  const insets = useSafeAreaInsets();
  const router  = useRouter();
  const { selectedClass, setSelectedCategory, progressStats, getHighScore } = useGame();

  const classConfig = CLASS_CONFIGS.find(c => c.key === selectedClass)!;
  const available   = getAvailableCategories(selectedClass);
  const { theme }   = CLASS_TOPICS[selectedClass];

  const top = Platform.OS === 'web' ? 67 : insets.top;
  const bot = Platform.OS === 'web' ? 34 : insets.bottom;

  const handleSelect = (cat: Category) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedCategory(cat);
    if (cat === 'tables') router.push('/tables-mode');
    else router.push('/difficulty-select');
  };

  const getCatAccuracy = (cat: Category): number => {
    const entries = Object.entries(progressStats)
      .filter(([k]) => k.startsWith(`${selectedClass}_${cat}_`))
      .map(([, v]) => v);
    const att = entries.reduce((s, e) => s + e.attempted, 0);
    const cor = entries.reduce((s, e) => s + e.correct, 0);
    return att > 0 ? Math.round((cor / att) * 100) : -1;
  };

  const getCatBest = (cat: Category): number =>
    (['easy', 'medium', 'hard'] as const)
      .map(d => getHighScore(selectedClass, d, cat))
      .reduce((s, v) => s + v, 0);

  // Group categories by row for visual structure
  const coreCats: Category[]  = available.filter(c =>
    ['addition','subtraction','multiplication','division','mixed','tables'].includes(c));
  const topicCats: Category[] = available.filter(c =>
    !['addition','subtraction','multiplication','division','mixed','tables'].includes(c));

  const SectionHeader = ({ label }: { label: string }) => (
    <Text style={styles.sectionLabel}>{label}</Text>
  );

  const CatCard = ({ cat }: { cat: Category }) => {
    const meta  = CATEGORY_META[cat];
    const acc   = getCatAccuracy(cat);
    const best  = getCatBest(cat);
    const isSpecial = cat === 'tables';

    return (
      <TouchableOpacity
        style={[styles.card, { borderColor: meta.color + '44' }]}
        onPress={() => handleSelect(cat)}
        activeOpacity={0.8}
      >
        <View style={[styles.iconBox, { backgroundColor: meta.color + '22' }]}>
          <Feather name={meta.icon as any} size={24} color={meta.color} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={[styles.cardTitle, { color: meta.color }]}>{meta.label}</Text>
            {isSpecial && (
              <View style={[styles.tagPill, { backgroundColor: C.catTables + '22' }]}>
                <Text style={[styles.tagText, { color: C.catTables }]}>Drill</Text>
              </View>
            )}
            {acc >= 0 && !isSpecial && (
              <View style={[styles.accBadge, {
                backgroundColor: (acc >= 80 ? C.easy : acc >= 50 ? C.medium : C.hard) + '22',
              }]}>
                <Text style={[styles.accText, {
                  color: acc >= 80 ? C.easy : acc >= 50 ? C.medium : C.hard,
                }]}>{acc}%</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardDesc} numberOfLines={1}>{meta.desc}</Text>
          {best > 0 && !isSpecial && (
            <View style={styles.bestRow}>
              <Feather name="star" size={10} color={C.gold} />
              <Text style={styles.bestText}>Best: {best} pts</Text>
            </View>
          )}
        </View>
        <Feather name="chevron-right" size={16} color={C.mutedForeground} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={C.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Choose Topic</Text>
          <View style={styles.headerBadgeRow}>
            <View style={[styles.clsBadge, { backgroundColor: classConfig.color + '22' }]}>
              <Text style={[styles.clsBadgeText, { color: classConfig.color }]}>{classConfig.label}</Text>
            </View>
            <Text style={styles.themeTxt}>{theme}</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bot + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {coreCats.length > 0 && (
          <>
            <SectionHeader label="ARITHMETIC" />
            {coreCats.map(cat => <CatCard key={cat} cat={cat} />)}
          </>
        )}

        {topicCats.length > 0 && (
          <>
            <SectionHeader label="CURRICULUM TOPICS" />
            {topicCats.map(cat => <CatCard key={cat} cat={cat} />)}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.card, alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center', gap: 5 },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.foreground },
  headerBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clsBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  clsBadgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  themeTxt: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.mutedForeground },
  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  sectionLabel: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.mutedForeground,
    letterSpacing: 1.5, marginTop: 12, marginBottom: 8,
  },
  card: {
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 12, marginBottom: 8,
  },
  iconBox: {
    width: 46, height: 46, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardBody: { flex: 1, gap: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  cardTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  tagPill: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  accBadge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  accText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  cardDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.mutedForeground },
  bestRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bestText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.gold },
});
