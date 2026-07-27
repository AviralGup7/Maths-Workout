import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useGame, CLASS_CONFIGS, CATEGORY_META,
  Difficulty, SessionType,
} from '@/context/GameContext';
import colors from '@/constants/colors';

const C = colors.light;

const DIFF_META: { key: Difficulty; label: string; icon: keyof typeof Feather.glyphMap; color: string; desc: string }[] = [
  { key: 'easy',   label: 'Easy',   icon: 'smile',       color: C.easy,   desc: 'Smaller numbers, no carrying' },
  { key: 'medium', label: 'Medium', icon: 'zap',         color: C.medium, desc: 'Carrying, borrowing, mid-range' },
  { key: 'hard',   label: 'Hard',   icon: 'trending-up', color: C.hard,   desc: 'Large numbers, full operations' },
];

const SESSION_META: { key: SessionType; label: string; sub: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: '10q',     label: '10 Questions', sub: '~3 minutes',      icon: 'list' },
  { key: '20q',     label: '20 Questions', sub: '~6 minutes',      icon: 'layers' },
  { key: 'timed60', label: '60s Blitz',    sub: 'As many as you can!', icon: 'clock' },
];

export default function DifficultySelectScreen() {
  const insets = useSafeAreaInsets();
  const router  = useRouter();
  const { selectedClass, selectedCategory, startGame, getHighScore } = useGame();

  const [selDiff, setSelDiff]       = useState<Difficulty>('easy');
  const [selSession, setSelSession] = useState<SessionType>('10q');

  const classConfig = CLASS_CONFIGS.find(c => c.key === selectedClass)!;
  const catMeta     = CATEGORY_META[selectedCategory];
  const top = Platform.OS === 'web' ? 67 : insets.top;
  const bot = Platform.OS === 'web' ? 34 : insets.bottom;

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    startGame(selectedClass, selDiff, selectedCategory, selSession);
    router.push('/game');
  };

  return (
    <View style={[styles.container, { paddingTop: top, paddingBottom: bot + 16 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={C.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Set Up Game</Text>
          <View style={styles.breadcrumb}>
            <View style={[styles.crumbPill, { backgroundColor: classConfig.color + '22' }]}>
              <Text style={[styles.crumbText, { color: classConfig.color }]}>{classConfig.label}</Text>
            </View>
            <Feather name="chevron-right" size={12} color={C.mutedForeground} />
            <View style={[styles.crumbPill, { backgroundColor: catMeta.color + '22' }]}>
              <Text style={[styles.crumbText, { color: catMeta.color }]}>{catMeta.label}</Text>
            </View>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Difficulty */}
        <Text style={styles.sectionLabel}>DIFFICULTY</Text>
        <View style={styles.diffList}>
          {DIFF_META.map(d => {
            const best = getHighScore(selectedClass, d.key, selectedCategory);
            const sel  = selDiff === d.key;
            return (
              <TouchableOpacity
                key={d.key}
                style={[styles.diffCard, sel && { borderColor: d.color, borderWidth: 2 }]}
                onPress={() => { Haptics.selectionAsync(); setSelDiff(d.key); }}
                activeOpacity={0.8}
              >
                <View style={[styles.diffIcon, { backgroundColor: d.color + '22' }]}>
                  <Feather name={d.icon} size={22} color={d.color} />
                </View>
                <View style={styles.diffBody}>
                  <Text style={[styles.diffLabel, { color: d.color }]}>{d.label}</Text>
                  <Text style={styles.diffDesc}>{d.desc}</Text>
                </View>
                <View style={styles.diffRight}>
                  {best > 0 && (
                    <View style={styles.bestPill}>
                      <Feather name="star" size={10} color={C.gold} />
                      <Text style={styles.bestText}>Best: {best}</Text>
                    </View>
                  )}
                  {sel && <Feather name="check-circle" size={18} color={d.color} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Session type */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>SESSION TYPE</Text>
        <View style={styles.sessionRow}>
          {SESSION_META.map(s => {
            const sel = selSession === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                style={[styles.sessionCard, sel && { borderColor: C.primary, borderWidth: 2, backgroundColor: C.primary + '18' }]}
                onPress={() => { Haptics.selectionAsync(); setSelSession(s.key); }}
                activeOpacity={0.8}
              >
                <Feather name={s.icon} size={20} color={sel ? C.primary : C.mutedForeground} />
                <Text style={[styles.sessionLabel, sel && { color: C.primary }]}>{s.label}</Text>
                <Text style={styles.sessionSub}>{s.sub}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Start */}
      <View style={styles.startWrap}>
        <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.85}>
          <Feather name="play" size={20} color="#fff" />
          <Text style={styles.startText}>Start{selSession === 'timed60' ? ' Blitz!' : ' Game'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center', gap: 6 },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.foreground },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  crumbPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  crumbText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  sectionLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.mutedForeground, letterSpacing: 1.5, marginBottom: 10 },
  diffList: { gap: 10 },
  diffCard: {
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12,
  },
  diffIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  diffBody: { flex: 1 },
  diffLabel: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  diffDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.mutedForeground, marginTop: 2 },
  diffRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bestPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.gold + '22', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  bestText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.gold },
  sessionRow: { flexDirection: 'row', gap: 10 },
  sessionCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 14, alignItems: 'center', gap: 6,
  },
  sessionLabel: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.foreground, textAlign: 'center' },
  sessionSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.mutedForeground, textAlign: 'center' },
  startWrap: { paddingHorizontal: 16, paddingTop: 12 },
  startBtn: {
    backgroundColor: C.primary, borderRadius: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18,
  },
  startText: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#fff' },
});
