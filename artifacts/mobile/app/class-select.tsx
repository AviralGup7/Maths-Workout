import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGame, CLASS_CONFIGS, SchoolClass, getAvailableCategories } from '@/context/GameContext';
import colors from '@/constants/colors';
import { CLASS_LABELS } from '@/curriculum/boards';
import { t } from '@/i18n/strings';

const C = colors.light;

export default function ClassSelectScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setSelectedClass, getHighScore, progressStats, board, lang } = useGame();

  const top = Platform.OS === 'web' ? 67 : insets.top;
  const bot = Platform.OS === 'web' ? 34 : insets.bottom;

  const handleSelect = (cls: SchoolClass) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedClass(cls);
    router.push('/category-select');
  };

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={C.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('selectClass', lang)}</Text>
          <Text style={styles.headerSub}>{t('selectClassSub', lang)}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bot + 24 }]} showsVerticalScrollIndicator={false}>
        {CLASS_CONFIGS.map((cls, idx) => {
          const cats = getAvailableCategories(cls.key, board);
          const hsVals = cats.flatMap(cat =>
            ['easy', 'medium', 'hard'].map(d => getHighScore(cls.key, d as any, cat))
          );
          const totalBest = hsVals.reduce((s, v) => s + v, 0);
          const maxBest = cats.length * 3 * 10;

          const statsForClass = Object.entries(progressStats)
            .filter(([k]) => k.startsWith(cls.key + '_'))
            .map(([, v]) => v);
          const attempted = statsForClass.reduce((s, e) => s + e.attempted, 0);
          const correct   = statsForClass.reduce((s, e) => s + e.correct, 0);
          const acc = attempted > 0 ? Math.round((correct / attempted) * 100) : -1;

          return (
            <TouchableOpacity key={cls.key} style={[styles.card, { borderColor: cls.color + '44' }]} onPress={() => handleSelect(cls.key)} activeOpacity={0.8}>
              <View style={[styles.accent, { backgroundColor: cls.color }]} />
              <View style={styles.body}>
                <View style={styles.topRow}>
                  <View style={[styles.numBadge, { backgroundColor: cls.color + '22' }]}>
                    <Text style={[styles.numText, { color: cls.color }]}>{idx + 1}</Text>
                  </View>
                  <View style={styles.titleBlock}>
                    <Text style={styles.cardLabel}>{CLASS_LABELS[cls.key][lang === 'hi' ? 'hi' : 'en']}</Text>
                    <Text style={styles.cardAge}>{t('age', lang)} {CLASS_LABELS[cls.key].age}</Text>
                  </View>
                  <View style={styles.rightCol}>
                    {acc >= 0 && (
                      <View style={[styles.accBadge, { backgroundColor: (acc >= 80 ? C.easy : acc >= 50 ? C.medium : C.hard) + '22' }]}>
                        <Text style={[styles.accText, { color: acc >= 80 ? C.easy : acc >= 50 ? C.medium : C.hard }]}>{acc}%</Text>
                      </View>
                    )}
                    <Feather name="chevron-right" size={18} color={C.mutedForeground} />
                  </View>
                </View>
                <Text style={styles.catCount}>{cats.length} {t('topicsAvailable', lang)}</Text>
                {totalBest > 0 && (
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${(totalBest / maxBest) * 100}%` as unknown as number, backgroundColor: cls.color }]} />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.foreground },
  headerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.mutedForeground },
  scroll: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  card: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, flexDirection: 'row', overflow: 'hidden' },
  accent: { width: 5 },
  body: { flex: 1, padding: 16, gap: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  numBadge: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  numText: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  titleBlock: { flex: 1 },
  cardLabel: { fontSize: 17, fontFamily: 'Inter_700Bold', color: C.foreground },
  cardAge: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.mutedForeground, marginTop: 1 },
  rightCol: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  accText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  catCount: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.mutedForeground },
  progressTrack: { height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
});
