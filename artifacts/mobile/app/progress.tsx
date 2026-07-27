import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGame, CLASS_CONFIGS, CATEGORY_META, SchoolClass, Category } from '@/context/GameContext';
import colors from '@/constants/colors';
import { touchSlop } from '@/hooks/useA11y';
import { MISCONCEPTIONS_HI } from '@/i18n/misconceptions-hi';
import { t, categoryLabel } from '@/i18n/strings';
import { CLASS_LABELS } from '@/curriculum/boards';
import { SKILLS } from '@/learning/skills';
import { MASTERED_THRESHOLD, STRUGGLING_THRESHOLD } from '@/learning/mastery';
import { biggestGain, growthSentence } from '@/learning/feedback';

const C = colors.light;
const CATS: Category[] = ['addition', 'subtraction', 'multiplication', 'division', 'mixed'];

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const router  = useRouter();
  const { progressStats, getHighScore, tablesBest, savedMistakes,
          mastery, topMisconceptions, rootGapFor, streak, lang, attempts } = useGame();

  const [filterClass, setFilterClass] = useState<SchoolClass | 'all'>('all');

  const top = Platform.OS === 'web' ? 67 : insets.top;
  const bot = Platform.OS === 'web' ? 34 : insets.bottom;

  const getAccuracy = useMemo(() => (cls: SchoolClass | 'all', cat: Category): { pct: number; att: number } => {
    const entries = Object.entries(progressStats)
      .filter(([k]) => {
        const startsWithCls = cls === 'all' ? true : k.startsWith(cls + '_');
        return startsWithCls && k.includes(`_${cat}_`);
      })
      .map(([, v]) => v);
    const att = entries.reduce((s, e) => s + e.attempted, 0);
    const cor = entries.reduce((s, e) => s + e.correct, 0);
    return { pct: att > 0 ? Math.round((cor / att) * 100) : -1, att };
  }, [progressStats]);

  const getClassOverall = useMemo(() => (cls: SchoolClass): { pct: number; att: number } => {
    const entries = Object.entries(progressStats)
      .filter(([k]) => k.startsWith(cls + '_'))
      .map(([, v]) => v);
    const att = entries.reduce((s, e) => s + e.attempted, 0);
    const cor = entries.reduce((s, e) => s + e.correct, 0);
    return { pct: att > 0 ? Math.round((cor / att) * 100) : -1, att };
  }, [progressStats]);

  const { totalAtt, totalCor, overallPct } = useMemo(() => {
    const totalAtt = Object.values(progressStats).reduce((s, e) => s + e.attempted, 0);
    const totalCor = Object.values(progressStats).reduce((s, e) => s + e.correct, 0);
    return { totalAtt, totalCor, overallPct: totalAtt > 0 ? Math.round((totalCor / totalAtt) * 100) : 0 };
  }, [progressStats]);

  const tablesPerfect = Object.values(tablesBest).filter(v => v === 12).length;
  const tablesTotal   = Object.keys(tablesBest).length;

  // ── Direction D: turn raw attempts into actionable insight ────────────────
  const insights = useMemo(() => topMisconceptions().slice(0, 3), [topMisconceptions]);

  // §9 M2 — the mastery model has always computed a trend and shown it nowhere.
  // Growth-mindset framing needs evidence of growth, and the data already exists.
  const gain = useMemo(() => biggestGain(attempts), [attempts]);

  const skillRows = useMemo(() => {
    return Object.values(mastery)
      .filter(m => m.attempts >= 3 && SKILLS[m.skill])
      .sort((a, b) => a.value - b.value)
      .slice(0, 6);
  }, [mastery]);

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}
          hitSlop={touchSlop(40)} accessibilityRole="button" accessibilityLabel="Go back">
          <Feather name="arrow-left" size={22} color={C.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('myProgress', lang).replace('\n', ' ')}</Text>
          <Text style={styles.headerSub}>{totalAtt} {t('questionsAnswered', lang)}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bot + 24 }]} showsVerticalScrollIndicator={false}>

        {/* Growth first: the learner should meet progress before problems. */}
        {gain && (
          <>
            <Text style={styles.sectionLabel}>{t('yourProgress', lang)}</Text>
            <View style={styles.growthCard}>
              <Feather name="trending-up" size={16} color={C.easy} />
              <Text style={styles.growthText}>{growthSentence(gain, lang)}</Text>
            </View>
          </>
        )}

        {/* What to work on — named misconceptions with concrete next steps.
            This is the difference between "68% correct" and knowing *why*. */}
        {insights.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>{t('whatToWorkOn', lang)}</Text>
            <View style={styles.insightCard}>
              {insights.map(({ id, count, info }) => (
                <View key={id} style={styles.insightRow}>
                  <View style={styles.insightBadge}>
                    <Text style={styles.insightCount}>{count}×</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    {(() => {
                      const hi = MISCONCEPTIONS_HI[id];
                      const copy = lang === 'hi' && hi ? hi : info;
                      return (
                        <>
                          <Text style={styles.insightTitle}>{copy.label}</Text>
                          <Text style={styles.insightBody}>{copy.explanation}</Text>
                          <View style={styles.insightFix}>
                            <Feather name="arrow-right" size={11} color={C.easy} />
                            <Text style={styles.insightFixText}>{copy.remediation}</Text>
                          </View>
                        </>
                      );
                    })()}
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Per-skill mastery, weakest first, with the root cause where known. */}
        {skillRows.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>{t('skillMastery', lang)}</Text>
            <View style={styles.insightCard}>
              {skillRows.map(m => {
                const pct = Math.round(m.value * 100);
                const tone = m.value >= MASTERED_THRESHOLD ? C.easy
                           : m.value >= STRUGGLING_THRESHOLD ? C.medium : C.hard;
                const gap = rootGapFor(m.skill);
                return (
                  <View key={m.skill} style={styles.skillRow}>
                    <View style={styles.skillTop}>
                      <Text style={styles.skillName} numberOfLines={1}>{SKILLS[m.skill].label}</Text>
                      <Text style={[styles.skillPct, { color: tone }]}>{pct}%</Text>
                    </View>
                    <View style={styles.skillTrack}>
                      <View style={[styles.skillFill, { width: `${pct}%` as unknown as number, backgroundColor: tone }]} />
                    </View>
                    {gap && SKILLS[gap] && (
                      <Text style={styles.skillGap}>
                        {t('likelyCause', lang)}: {SKILLS[gap].label} — {t('needsWorkFirst', lang)}
                      </Text>
                    )}
                    {m.trend !== 0 && Math.abs(m.trend) > 0.15 && (
                      <Text style={[styles.skillTrend, { color: m.trend > 0 ? C.easy : C.medium }]}>
                        {m.trend > 0 ? `▲ ${t('improving', lang)}` : `▼ ${t('slipping', lang)}`}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Empty state */}
        {totalAtt === 0 && (
          <View style={styles.emptyCard}>
            <Feather name="trending-up" size={28} color={C.primary} />
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptySub}>Complete a practice session to see your stats here.</Text>
          </View>
        )}

        {/* Saved mistakes shortcut */}
        {savedMistakes.length > 0 && (
          <TouchableOpacity
            style={styles.mistakeCard}
            onPress={() => router.push('/mistake-review')}
            activeOpacity={0.85}
          >
            <View style={styles.mistakeIcon}>
              <Feather name="alert-circle" size={18} color={C.hard} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.mistakeTitle}>
                {savedMistakes.length} mistake{savedMistakes.length !== 1 ? 's' : ''} to review
              </Text>
              <Text style={styles.mistakeSub}>Tap to practice and clear them</Text>
            </View>
            <Feather name="chevron-right" size={16} color={C.hard} />
          </TouchableOpacity>
        )}

        {/* Summary row */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryVal, { color: C.primary }]}>{overallPct}%</Text>
            <Text style={styles.summaryLbl}>Overall</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryVal, { color: C.easy }]}>{totalCor}</Text>
            <Text style={styles.summaryLbl}>Correct</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryVal, { color: C.hard }]}>{totalAtt - totalCor}</Text>
            <Text style={styles.summaryLbl}>Wrong</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryVal, { color: C.catTables }]}>{tablesPerfect}/{tablesTotal || '—'}</Text>
            <Text style={styles.summaryLbl}>Tables ✓</Text>
          </View>
        </View>

        {/* Class filter */}
        <Text style={styles.sectionLabel}>FILTER BY CLASS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterStrip} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
          <TouchableOpacity
            style={[styles.filterChip, filterClass === 'all' && styles.filterChipActive]}
            onPress={() => { Haptics.selectionAsync(); setFilterClass('all'); }}
          >
            <Text style={[styles.filterChipText, filterClass === 'all' && { color: C.primary }]}>All Classes</Text>
          </TouchableOpacity>
          {CLASS_CONFIGS.map(cls => (
            <TouchableOpacity
              key={cls.key}
              style={[styles.filterChip, filterClass === cls.key && { borderColor: cls.color, backgroundColor: cls.color + '18' }]}
              onPress={() => { Haptics.selectionAsync(); setFilterClass(cls.key); }}
            >
              <Text style={[styles.filterChipText, filterClass === cls.key && { color: cls.color }]}>{cls.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Per-category accuracy */}
        <Text style={styles.sectionLabel}>ACCURACY BY TOPIC</Text>
        <View style={styles.catCard}>
          {CATS.map(cat => {
            const meta = CATEGORY_META[cat];
            const { pct, att } = getAccuracy(filterClass, cat);
            const barPct = pct >= 0 ? pct : 0;
            return (
              <View key={cat} style={styles.catRow}>
                <View style={[styles.catIconBox, { backgroundColor: meta.color + '22' }]}>
                  <Feather name={meta.icon as any} size={14} color={meta.color} />
                </View>
                <View style={styles.catInfo}>
                  <View style={styles.catTopRow}>
                    <Text style={styles.catLabel}>{meta.label}</Text>
                    <Text style={[styles.catPct, {
                      color: pct < 0 ? C.mutedForeground : pct >= 80 ? C.easy : pct >= 50 ? C.medium : C.hard
                    }]}>
                      {pct < 0 ? '—' : `${pct}%`}
                    </Text>
                  </View>
                  <View style={styles.catBar}>
                    <View style={[styles.catBarFill, { width: `${barPct}%` as unknown as number, backgroundColor: meta.color }]} />
                  </View>
                  <Text style={styles.catAtt}>{att > 0 ? `${att} question${att !== 1 ? 's' : ''} answered` : 'Not started'}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Per-class breakdown */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>BY CLASS</Text>
        <View style={styles.classGrid}>
          {CLASS_CONFIGS.map(cls => {
            const { pct, att } = getClassOverall(cls.key);
            const hsTotal = ['addition','subtraction','multiplication','division','mixed'].flatMap(cat =>
              ['easy','medium','hard'].map(d => getHighScore(cls.key, d as any, cat as any))
            ).reduce((s, v) => s + v, 0);

            return (
              <View key={cls.key} style={[styles.classBox, { borderColor: cls.color + '44' }]}>
                <View style={[styles.classBoxNum, { backgroundColor: cls.color + '22' }]}>
                  <Text style={[styles.classBoxNumText, { color: cls.color }]}>{CLASS_CONFIGS.indexOf(cls) + 1}</Text>
                </View>
                <Text style={styles.classBoxLabel}>{cls.label}</Text>
                <Text style={[styles.classBoxPct, {
                  color: pct < 0 ? C.mutedForeground : pct >= 80 ? C.easy : pct >= 50 ? C.medium : C.hard
                }]}>
                  {pct < 0 ? '—' : `${pct}%`}
                </Text>
                {hsTotal > 0 && (
                  <View style={styles.classBoxBest}>
                    <Feather name="star" size={9} color={C.gold} />
                    <Text style={styles.classBoxBestText}>{hsTotal} pts</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Tables progress */}
        {tablesTotal > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>TIMES TABLES</Text>
            <View style={styles.tablesGrid}>
              {[2,3,4,5,6,7,8,9,10,11,12].map(n => {
                const best = tablesBest[n] ?? 0;
                const color = best === 0 ? C.border : best === 12 ? C.easy : best >= 8 ? C.medium : C.hard;
                return (
                  <View key={n} style={[styles.tableBox, { borderColor: color + '55' }]}>
                    <Text style={[styles.tableNum, { color: color === C.border ? C.mutedForeground : color }]}>{n}×</Text>
                    {best > 0 && <Text style={[styles.tableBest, { color }]}>{best}/12</Text>}
                  </View>
                );
              })}
            </View>
          </>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  growthCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.easy + '14', borderRadius: 14,
    borderWidth: 1, borderColor: C.easy + '3A',
    paddingVertical: 14, paddingHorizontal: 14, marginBottom: 18,
  },
  growthText: { flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.easy },
  insightCard: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, gap: 16 },
  insightRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  insightBadge: {
    minWidth: 34, height: 24, borderRadius: 7, backgroundColor: C.hard + '22',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  insightCount: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: C.hard },
  insightTitle: { fontSize: 13.5, fontFamily: 'Inter_700Bold', color: C.foreground, marginBottom: 3 },
  insightBody: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.mutedForeground, lineHeight: 17 },
  insightFix: { flexDirection: 'row', gap: 5, alignItems: 'flex-start', marginTop: 6 },
  insightFixText: { flex: 1, fontSize: 11.5, fontFamily: 'Inter_500Medium', color: C.easy, lineHeight: 16 },
  skillRow: { gap: 5 },
  skillTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  skillName: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: C.foreground },
  skillPct: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  skillTrack: { height: 5, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  skillFill: { height: 5, borderRadius: 3 },
  skillGap: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.medium, marginTop: 1 },
  skillTrend: { fontSize: 10.5, fontFamily: 'Inter_600SemiBold' },
  container: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.foreground },
  headerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.mutedForeground },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  summaryCard: { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  summaryVal: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  summaryLbl: { fontSize: 10, fontFamily: 'Inter_400Regular', color: C.mutedForeground, marginTop: 2 },
  emptyCard: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 24, alignItems: 'center', gap: 8, marginBottom: 20 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.foreground },
  emptySub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.mutedForeground, textAlign: 'center' },
  mistakeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.hard + '14', borderRadius: 14, borderWidth: 1, borderColor: C.hard + '44', padding: 14, marginBottom: 16 },
  mistakeIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.hard + '22', alignItems: 'center', justifyContent: 'center' },
  mistakeTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.foreground },
  mistakeSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.mutedForeground, marginTop: 1 },
  sectionLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.mutedForeground, letterSpacing: 1.5, marginBottom: 10 },
  filterStrip: { marginBottom: 20 },
  filterChip: { borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, paddingHorizontal: 14, paddingVertical: 8 },
  filterChipActive: { borderColor: C.primary, backgroundColor: C.primary + '18' },
  filterChipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.mutedForeground },
  catCard: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16, gap: 16, marginBottom: 4 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  catIconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  catInfo: { flex: 1, gap: 4 },
  catTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.foreground },
  catPct: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  catBar: { height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  catBarFill: { height: 6, borderRadius: 3 },
  catAtt: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.mutedForeground },
  classGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  classBox: { width: '30%', backgroundColor: C.card, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: 'center', gap: 4 },
  classBoxNum: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  classBoxNumText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  classBoxLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.foreground },
  classBoxPct: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  classBoxBest: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  classBoxBestText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.gold },
  tablesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tableBox: { width: '17%', backgroundColor: C.card, borderRadius: 10, borderWidth: 1, padding: 8, alignItems: 'center', gap: 2 },
  tableNum: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  tableBest: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
});
