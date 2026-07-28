import React from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useGame, CATEGORY_META, Category, getAvailableCategories,
} from '@/context/GameContext';
import { useTheme } from '@/theme/useTheme';
import { Screen, ScreenHeader, SectionLabel } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { CLASS_LABELS, CLASS_THEME } from '@/curriculum/boards';
import { t, categoryLabel, categoryDesc } from '@/i18n/strings';

const ARITHMETIC: Category[] = ['addition', 'subtraction', 'multiplication', 'division', 'mixed', 'tables'];

/** Topic selection. Migrated off the legacy palette shim (docs/20 F1). */
export default function CategorySelectScreen() {
  const router = useRouter();
  const { selectedClass, setSelectedCategory, progressStats, board, lang } = useGame();
  const { c, type, space, sizeClass } = useTheme();

  const available = getAvailableCategories(selectedClass, board);
  const theme = CLASS_THEME[board][selectedClass][lang === 'hi' ? 'hi' : 'en'];

  const handleSelect = (cat: Category) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedCategory(cat);
    router.push(cat === 'tables' ? '/tables-mode' : '/difficulty-select');
  };

  const accuracyFor = (cat: Category): number | null => {
    const entries = Object.entries(progressStats)
      .filter(([k]) => k.startsWith(`${selectedClass}_${cat}_`))
      .map(([, v]) => v);
    const att = entries.reduce((s, e) => s + e.attempted, 0);
    const cor = entries.reduce((s, e) => s + e.correct, 0);
    return att > 0 ? Math.round((cor / att) * 100) : null;
  };

  const arithmetic = available.filter(cat => ARITHMETIC.includes(cat));
  const topics = available.filter(cat => !ARITHMETIC.includes(cat));
  const wide = sizeClass !== 'compact';

  const renderGroup = (list: Category[]) => (
    <View style={{ flexDirection: wide ? 'row' : 'column', flexWrap: 'wrap', gap: space.sm }}>
      {list.map(cat => {
        const meta = CATEGORY_META[cat];
        const acc = accuracyFor(cat);
        return (
          <View key={cat} style={wide ? { width: '48.5%' } : undefined}>
            <Card onPress={() => handleSelect(cat)} accessibilityLabel={categoryLabel(cat, lang)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                {/* docs/28: the symbol tile is the only thing on this row a
                    pre-reader can use to tell Addition from Counting. Sized up
                    from 40 to 52 with a larger glyph so it leads the row
                    rather than decorating it. */}
                <View style={{
                  width: 52, height: 52, borderRadius: 14,
                  backgroundColor: meta.color + '22',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={[type('heading'), { color: meta.color, fontSize: 22 }]}>{meta.symbol}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[type('heading'), { color: c.text }]}>{categoryLabel(cat, lang)}</Text>
                  <Text style={[type('caption'), { color: c.textMuted }]} numberOfLines={1}>
                    {categoryDesc(cat, lang)}
                  </Text>
                </View>
                {acc !== null && (
                  <Text style={[type('label'), { color: c.textMuted }]}>{acc}%</Text>
                )}
                <Feather name="chevron-right" size={18} color={c.textMuted} />
              </View>
            </Card>
          </View>
        );
      })}
    </View>
  );

  return (
    <Screen>
      <ScreenHeader
        title={t('setUpGame', lang)}
        subtitle={`${CLASS_LABELS[selectedClass][lang === 'hi' ? 'hi' : 'en']} · ${theme}`}
      />
      {arithmetic.length > 0 && (
        <>
          <SectionLabel>{t('arithmetic', lang)}</SectionLabel>
          {renderGroup(arithmetic)}
        </>
      )}
      {topics.length > 0 && (
        <>
          <SectionLabel>{t('curriculumTopics', lang)}</SectionLabel>
          {renderGroup(topics)}
        </>
      )}
    </Screen>
  );
}
