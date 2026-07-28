import React, { useMemo } from 'react';
import { View, Text, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useGame } from '@/context/GameContext';
import { useTheme } from '@/theme/useTheme';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { WeekStrip } from '@/components/WeekStrip';
import { buildParentReport } from '@/learning/parentReport';
import { t } from '@/i18n/strings';

/**
 * The parent view — docs/14 §10, docs/17 §6.5.
 *
 * One screen, scannable in 30 seconds. The governing constraint: **parents do
 * not lack data, they lack a next action.** So there are no charts, no
 * comparison to peers or grade level, no time-on-task target, and no daily
 * report. What a parent cannot get anywhere else is a named misconception and
 * something concrete to do about it at the kitchen table.
 *
 * docs/28: this is now the third tab ("Grown-ups"), replacing a "Settings" tab
 * that put an adult configuration screen in a six-year-old's primary
 * navigation. The door is labelled for grown-ups on purpose — a child who can
 * see it is a child who knows it is not for them, which is a clearer signal
 * than a gear icon they will tap out of curiosity. Settings are reachable from
 * here rather than from the child's home.
 */
export default function ParentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { attempts, mastery, lang } = useGame();
  const { c, type, space } = useTheme();

  const report = useMemo(
    () => buildParentReport({ log: attempts, estimates: mastery, lang }),
    [attempts, mastery, lang],
  );

  const top = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: space.base, gap: space.md }}>
        <Button
          label={t('back', lang)} onPress={() => router.back()}
          variant="ghost" size="md" icon="arrow-left" fullWidth={false}
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.base, gap: space.base, paddingBottom: space.xxl }}>
        <Text style={[type('title'), { color: c.text }]}>{t('forParents', lang)}</Text>

        {report.insufficientData ? (
          <EmptyState
            mascot="encouraging"
            title={t('notEnoughYet', lang)}
            body={lang === 'hi'
              ? 'कुछ और अभ्यास सत्रों के बाद यहाँ उपयोगी जानकारी दिखेगी।'
              : 'A few more practice sessions and there will be something useful to show here.'}
          />
        ) : (
          <>
            {/* Practice pattern. Days, not minutes — minutes invite a target,
                and a time target rewards sitting still rather than thinking. */}
            <Card>
              <Text style={[type('label'), { color: c.textMuted, marginBottom: space.sm }]}>
                {t('thisWeek', lang).toUpperCase()}
              </Text>
              <Text style={[type('heading'), { color: c.text }]}>
                {lang === 'hi'
                  ? `${report.daysInWindow} में से ${report.daysPractised} दिन अभ्यास किया`
                  : `Practised on ${report.daysPractised} of ${report.daysInWindow} days`}
              </Text>
              <Text style={[type('body'), { color: c.textMuted, marginTop: space.xs }]}>
                {report.questions} {lang === 'hi' ? 'प्रश्न' : 'questions'} · {report.minutes} {lang === 'hi' ? 'मिनट' : 'minutes'}
              </Text>
              {/* docs/28 item 50: the sentence above is precise and
                  forgettable. The strip is scannable in under a second, which
                  is the real constraint on this screen. */}
              <View style={{ marginTop: space.md }}>
                <WeekStrip days={attempts.map(a => a.answeredAt)} lang={lang} />
              </View>
            </Card>

            {(report.strongest || report.needsWork) && (
              <Card>
                {report.strongest && (
                  <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                    <Feather name="check-circle" size={16} color={c.correct} />
                    <Text style={[type('body'), { color: c.text, flex: 1 }]}>
                      {t('strongest', lang)}: {report.strongest.label}
                    </Text>
                  </View>
                )}
                {report.needsWork && (
                  <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center', marginTop: space.sm }}>
                    <Feather name="alert-circle" size={16} color={c.attention} />
                    <Text style={[type('body'), { color: c.text, flex: 1 }]}>
                      {lang === 'hi' ? 'ध्यान चाहिए' : 'Needs work'}: {report.needsWork.label}
                    </Text>
                  </View>
                )}
              </Card>
            )}

            {/* The whole point of the screen. */}
            {report.focus && (
              <Card>
                <Text style={[type('label'), { color: c.primary, marginBottom: space.sm }]}>
                  {t('whatWouldHelp', lang)}
                </Text>
                <Text style={[type('body'), { color: c.text }]}>{report.focus.what}</Text>
                <View style={{
                  marginTop: space.md, padding: space.md,
                  backgroundColor: c.primarySoft, borderRadius: 12,
                }}>
                  <Text style={[type('label'), { color: c.primary, marginBottom: space.xs }]}>
                    {t('tryThis', lang)}
                  </Text>
                  <Text style={[type('body'), { color: c.text }]}>{report.focus.tryThis}</Text>
                </View>
              </Card>
            )}

            {report.growth && (
              <Card>
                <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                  <Feather name="trending-up" size={16} color={c.correct} />
                  <Text style={[type('body'), { color: c.text, flex: 1 }]}>{report.growth}</Text>
                </View>
              </Card>
            )}
          </>
        )}

        {/* docs/28: "parents do not lack data, they lack a next action" is the
            screen's own stated principle, and the one thing a parent can do
            without a screen is talk. A concrete question at the kitchen table
            is the highest-value thing this surface can offer, and it works
            even when there is not yet enough data for a full report. */}
        <Card>
          <Text style={[type('label'), { color: c.primary, marginBottom: space.sm }]}>
            {lang === 'hi' ? 'खाने की मेज़ पर पूछें' : 'ASK AT THE DINNER TABLE'}
          </Text>
          <Text style={[type('body'), { color: c.text }]}>
            {report.focus
              ? (lang === 'hi'
                  ? `अपने बच्चे से पूछें कि "${report.focus.label}" का क्या मतलब है — और वे इसे कैसे ठीक करेंगे।`
                  : `Ask your child what "${report.focus.label}" means, and how they would fix it.`)
              : (lang === 'hi'
                  ? 'आज आपने कौन-सी गलती पकड़ी, और अगली बार क्या अलग करेंगे?'
                  : 'What mistake did you catch today, and what will you do differently next time?')}
          </Text>
          <Text style={[type('caption'), { color: c.textMuted, marginTop: space.sm }]}>
            {lang === 'hi'
              ? 'बच्चे से समझाने को कहना, खुद बताने से ज़्यादा असरदार है।'
              : 'Explaining it aloud teaches more than being told — the same reason the app asks before it reveals.'}
          </Text>
        </Card>

        {/* Settings live behind the grown-up door, not in the child's tab bar. */}
        <Card>
          <Text style={[type('label'), { color: c.textMuted, marginBottom: space.sm }]}>
            {lang === 'hi' ? 'सेटिंग · SETTINGS' : 'SETTINGS'}
          </Text>
          <Text style={[type('body'), { color: c.textMuted, marginBottom: space.md }]}>
            {lang === 'hi'
              ? 'बोर्ड, भाषा, टाइमर और थीम बदलें।'
              : 'Change board, language, timer and theme.'}
          </Text>
          <Button
            label={lang === 'hi' ? 'सेटिंग खोलें · Settings' : 'Open settings'}
            onPress={() => router.push('/board-select')}
            variant="secondary" size="md" icon="settings"
          />
        </Card>
      </ScrollView>
    </View>
  );
}
