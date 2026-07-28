import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGame, CLASS_CONFIGS, SchoolClass, getAvailableCategories } from '@/context/GameContext';
import { classTextTone } from '@/generators';
import { useTheme } from '@/theme/useTheme';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { CLASS_LABELS } from '@/curriculum/boards';
import { t } from '@/i18n/strings';

/**
 * Class selection.
 *
 * Migrated off the `const C = colors.light` shim (docs/20 F1): that constant
 * was evaluated once at import, so this screen could never respond to the dark
 * preference the app already exposed.
 */
export default function ClassSelectScreen() {
  const router = useRouter();
  const { setSelectedClass, getHighScore, progressStats, board, lang } = useGame();
  const { c, type, space, touch, name } = useTheme();

  const handleSelect = (cls: SchoolClass) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedClass(cls);
    router.push('/category-select');
  };

  const accuracyFor = (cls: SchoolClass) => {
    const entries = Object.entries(progressStats)
      .filter(([k]) => k.startsWith(cls + '_'))
      .map(([, v]) => v);
    const att = entries.reduce((s, e) => s + e.attempted, 0);
    const cor = entries.reduce((s, e) => s + e.correct, 0);
    return att > 0 ? Math.round((cor / att) * 100) : null;
  };

  return (
    <Screen>
      <ScreenHeader
        title={t('selectClass', lang)}
        subtitle={t('selectClassSub', lang)}
      />

      {CLASS_CONFIGS.map(cls => {
        const topics = getAvailableCategories(cls.key, board).length;
        const acc = accuracyFor(cls.key);
        return (
          <Card
            key={cls.key}
            onPress={() => handleSelect(cls.key)}
            accessibilityLabel={`${CLASS_LABELS[cls.key][lang === 'hi' ? 'hi' : 'en']}, ${topics} topics`}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{
                width: touch.min, height: touch.min, borderRadius: 12,
                backgroundColor: cls.color + '22',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={[type('heading'), { color: classTextTone(cls, name) }]}>
                  {CLASS_LABELS[cls.key].en.replace('Class ', '')}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type('heading'), { color: c.text }]}>
                  {CLASS_LABELS[cls.key][lang === 'hi' ? 'hi' : 'en']}
                </Text>
                <Text style={[type('caption'), { color: c.textMuted }]}>
                  {t('age', lang)} {CLASS_LABELS[cls.key].age} · {topics} {t('topicsAvailable', lang)}
                </Text>
              </View>
              {acc !== null && (
                <Text style={[type('label'), { color: c.textMuted }]}>{acc}%</Text>
              )}
              <Feather name="chevron-right" size={18} color={c.textMuted} />
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
