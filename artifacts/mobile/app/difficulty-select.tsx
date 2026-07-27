import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useGame, CATEGORY_META, Difficulty, SessionType,
} from '@/context/GameContext';
import { useTheme } from '@/theme/useTheme';
import { Screen, ScreenHeader, SectionLabel } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { t, categoryLabel } from '@/i18n/strings';
import { CLASS_LABELS } from '@/curriculum/boards';

/**
 * Difficulty and session length.
 *
 * Labels are held as i18n KEYS rather than literals: this screen previously
 * hardcoded English, so a Hindi-medium learner met an all-English screen
 * halfway through an otherwise translated flow.
 */
const DIFF_META: {
  key: Difficulty; labelKey: string; descKey: string;
  icon: keyof typeof Feather.glyphMap; tone: 'correct' | 'attention' | 'wrong';
}[] = [
  { key: 'easy',   labelKey: 'easy',   descKey: 'easyDesc',   icon: 'smile',       tone: 'correct' },
  { key: 'medium', labelKey: 'medium', descKey: 'mediumDesc', icon: 'zap',         tone: 'attention' },
  { key: 'hard',   labelKey: 'hard',   descKey: 'hardDesc',   icon: 'trending-up', tone: 'wrong' },
];

const SESSION_META: {
  key: SessionType; labelKey: string; subKey: string; icon: keyof typeof Feather.glyphMap;
}[] = [
  { key: '10q',     labelKey: 'tenQuestions',    subKey: 'aboutMinutes',    icon: 'list' },
  { key: '20q',     labelKey: 'twentyQuestions', subKey: 'aboutSixMinutes', icon: 'layers' },
  { key: 'timed60', labelKey: 'blitz',           subKey: 'asManyAsYouCan',  icon: 'clock' },
];

export default function DifficultySelectScreen() {
  const router = useRouter();
  const { selectedClass, selectedCategory, startGame, getHighScore, lang } = useGame();
  const { c, type, space } = useTheme();

  const [selDiff, setSelDiff] = useState<Difficulty>('easy');
  const [selSession, setSelSession] = useState<SessionType>('10q');

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    startGame(selectedClass, selDiff, selectedCategory, selSession);
    router.push('/game');
  };

  const toneColour = { correct: c.correct, attention: c.attention, wrong: c.wrong };

  return (
    <Screen
      footer={
        <View style={{ padding: space.base }}>
          <Button
            label={t(selSession === 'timed60' ? 'startBlitz' : 'startGame', lang)}
            onPress={handleStart}
            icon="play"
          />
        </View>
      }
    >
      <ScreenHeader
        title={t('setUpGame', lang)}
        subtitle={`${CLASS_LABELS[selectedClass][lang === 'hi' ? 'hi' : 'en']} · ${categoryLabel(selectedCategory, lang)}`}
      />

      <SectionLabel>{t('difficulty', lang)}</SectionLabel>
      <View style={{ gap: space.sm }}>
        {DIFF_META.map(d => {
          const best = getHighScore(selectedClass, d.key, selectedCategory);
          const sel = selDiff === d.key;
          const tint = toneColour[d.tone];
          return (
            <Pressable
              key={d.key}
              onPress={() => { Haptics.selectionAsync(); setSelDiff(d.key); }}
              accessibilityRole="radio"
              accessibilityState={{ selected: sel }}
              accessibilityLabel={t(d.labelKey, lang)}
              accessibilityHint={t(d.descKey, lang)}
            >
              <Card elevation={sel ? 2 : 1} style={sel ? { borderColor: tint, borderWidth: 2 } : undefined}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <View style={{
                    width: 44, height: 44, borderRadius: 12,
                    backgroundColor: tint + '22', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Feather name={d.icon} size={20} color={tint} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[type('heading'), { color: tint }]}>{t(d.labelKey, lang)}</Text>
                    <Text style={[type('caption'), { color: c.textMuted }]}>{t(d.descKey, lang)}</Text>
                  </View>
                  {best > 0 && (
                    <Text style={[type('caption'), { color: c.textMuted }]}>
                      {t('best', lang)}: {best}
                    </Text>
                  )}
                  {sel && <Feather name="check-circle" size={20} color={tint} />}
                </View>
              </Card>
            </Pressable>
          );
        })}
      </View>

      <SectionLabel>{t('sessionType', lang)}</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {SESSION_META.map(s => (
          <Chip
            key={s.key}
            label={`${t(s.labelKey, lang)} · ${t(s.subKey, lang)}`}
            selected={selSession === s.key}
            onPress={() => { Haptics.selectionAsync(); setSelSession(s.key); }}
          />
        ))}
      </View>
    </Screen>
  );
}
