import React, { useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGame } from '@/context/GameContext';
import { useTheme } from '@/theme/useTheme';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Chip } from '@/components/ui/Chip';
import { Mascot } from '@/components/Mascot';
import { seasonFor } from '@/theme/seasons';
import { SEEN_WELCOME_KEY } from './welcome';
import { DAILY_GOAL, GOAL_CHOICES, GOAL_KEY, normaliseGoal } from '@/learning/goals';
import { t } from '@/i18n/strings';
import { SKILLS } from '@/learning/skills';
import { skillLabel } from '@/i18n/skills-hi';
import { STRUGGLING_THRESHOLD } from '@/learning/mastery';
import { dueReviewChapters, CHAPTERS, chapterStatus } from '@/curriculum/chapters';
import { MASTERED_THRESHOLD } from '@/learning/mastery';

/**
 * Home — rebuilt for docs/17 M4.
 *
 * Four measured defects drove this:
 *   A4 · on iPhone SE the primary action sat at y=585 in a 568px viewport —
 *        a child had to scroll past a logo occupying 58% of the screen to start
 *   A6 · five taps from launch to first question, every one a decision the
 *        adaptive scheduler is better qualified to make than a nine-year-old
 *   A5 · 53% of tablet width used; the layout was a stretched phone
 *   A3 · 24 touch targets below 44pt, several of them decorative
 *
 * The logo, tagline, board pill, per-category accuracy grid and class chip row
 * are all gone. A child who opens the app daily does not need to be told which
 * app it is. What remains is ordered by what the child needs to decide.
 */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    loadAll, savedMistakes, streak, answeredToday, startAdaptiveSession,
    selectedClass, lang, prefsLoaded, mastery, level, masteryLabel, attempts,
    storageFailing, needsPlacement,
  } = useGame();
  const { c, type, space, sizeClass, contentMaxWidth } = useTheme();
  const season = React.useMemo(() => seasonFor(new Date()), []);
  // docs/28 item 52. A goal the child sets is a commitment; one handed to them
  // is a demand. Read once on mount; every option is achievable by design.
  const [goal, setGoal] = React.useState<number>(DAILY_GOAL);
  React.useEffect(() => {
    AsyncStorage.getItem(GOAL_KEY).then(v => setGoal(normaliseGoal(v))).catch(() => {});
  }, []);
  const chooseGoal = (n: number) => {
    setGoal(n);
    AsyncStorage.setItem(GOAL_KEY, String(n)).catch(() => {});
  };

  useEffect(() => { loadAll(); }, []); // eslint-disable-line

  useEffect(() => {
    if (!prefsLoaded) return;
    let alive = true;
    AsyncStorage.getItem(SEEN_WELCOME_KEY)
      .then(seen => {
        if (!alive) return;
        if (!seen) { router.replace('/welcome'); return; }
        // docs/27 P1-01. A learner who has seen the intro but has no history
        // yet is offered placement once. `needsPlacement` is null while the
        // log is still loading, so a returning child never sees this flash.
        if (needsPlacement === true) router.replace('/placement');
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [prefsLoaded, needsPlacement]); // eslint-disable-line

  /**
   * At most TWO weak skills.
   *
   * Not five. Decision fatigue is the enemy on a screen whose job is to get a
   * child into a question — a list of everything they are bad at is
   * demoralising and slows the decision it is meant to help.
   */
  const weakest = useMemo(() =>
    Object.values(mastery)
      .filter(m => m.attempts >= 3 && m.value < STRUGGLING_THRESHOLD && SKILLS[m.skill])
      .sort((a, b) => a.value - b.value)
      .slice(0, 2),
    [mastery]);

  /**
   * The chapter closest to being finished (docs/25 Tier 1 item 8).
   *
   * Completion pull with no new mechanic: `chapterStatus` and the mastery map
   * already know this, and it was surfaced nowhere. "2 skills to finish
   * Fractions" is a goal a child can hold in their head; "18 chapters exist"
   * is not.
   */
  const nearlyDone = useMemo(() => {
    const m: Record<string, number> = {};
    for (const [k, v] of Object.entries(mastery)) m[k] = v.value;
    return CHAPTERS
      .filter(ch => chapterStatus(ch, m, selectedClass) === 'inProgress')
      .map(ch => ({
        ch,
        remaining: ch.skills.filter(s => (m[s] ?? 0) < MASTERED_THRESHOLD).length,
      }))
      .filter(x => x.remaining > 0 && x.remaining <= 2)
      .sort((a, b) => a.remaining - b.remaining)[0] ?? null;
  }, [mastery, selectedClass]);

  const reviewDue = useMemo(() => {
    const values: Record<string, number> = {};
    const ever: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(mastery)) {
      values[k] = v.value;
      // "Ever mastered" is approximated by a strong raw accuracy: the log does
      // not store a historical high-water mark for mastery itself.
      ever[k] = v.rawAccuracy >= 0.85 && v.attempts >= 5;
    }
    return dueReviewChapters(values, ever, selectedClass);
  }, [mastery, selectedClass]);

  const start = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    startAdaptiveSession(selectedClass, '10q');
    router.push('/game');
  };

  const top = Platform.OS === 'web' ? 67 : insets.top;
  const wide = sizeClass !== 'compact';

  const sessionSummary = useMemo(() => {
    if (weakest.length > 0) {
      const first = SKILLS[weakest[0].skill]
        ? skillLabel(weakest[0].skill, SKILLS[weakest[0].skill].label, lang) : '';
      return weakest.length > 1
        ? (lang === 'hi' ? `${first}, और ${weakest.length - 1} और` : `${first}, and ${weakest.length - 1} more`)
        : first;
    }
    return lang === 'hi' ? 'आपके लिए चुने गए प्रश्न' : 'Questions picked for you';
  }, [weakest, lang]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: top }}>
      <ScrollView
        contentContainerStyle={{
          padding: space.base,
          gap: space.base,
          paddingBottom: space.xxl,
          maxWidth: contentMaxWidth ?? undefined,
          width: '100%',
          alignSelf: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* docs/28: the app had no character at all — the largest single gap in
            the audit. The mascot greets the child before any number does, and
            its mood reflects how practice is actually going, so the first thing
            on screen is a face rather than a metric. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Mascot mood={season ? 'celebrate' : streak > 0 ? 'happy' : 'idle'} size={72} />
          <View style={{ flex: 1 }}>
            {/* docs/28 item 41: a seasonal greeting is a small signal that the
                app knows where it is. It replaces the greeting only — never a
                colour that has been contrast-tested, and never the semantics
                of correct/wrong. */}
            <Text style={[type('title'), { color: c.text }]} numberOfLines={2}>
              {season
                ? season.greeting[lang === 'hi' ? 'hi' : 'en']
                : (lang === 'hi' ? 'नमस्ते!' : 'Hello!')}
            </Text>
            <Text style={[type('body'), { color: c.textMuted }]}>
              {streak > 0
                ? (lang === 'hi' ? 'चलिए फिर से अभ्यास करें' : "Let's keep it going")
                : (lang === 'hi' ? 'आज कुछ नया सीखते हैं' : "Let's learn something today")}
            </Text>
          </View>
        </View>

        {/* A compact status strip replaces the 278px hero. Streak and level are
            information, not decoration, and they occupy one line. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          {/* docs/28: the streak is the strongest retention signal in the
              product and was rendered as the smallest element on screen. A
              live streak now gets a filled, high-contrast treatment; a streak
              of zero stays quiet rather than advertising a zero. */}
          {streak > 0 ? (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: c.attention, borderRadius: 999,
              paddingHorizontal: 14, paddingVertical: 8,
            }}>
              <Feather name="zap" size={16} color={c.primaryOn} />
              <Text style={[type('heading'), { color: c.primaryOn }]}>
                {streak}
              </Text>
              <Text style={[type('label'), { color: c.primaryOn }]}>
                {t(streak === 1 ? 'day' : 'days', lang)}
              </Text>
            </View>
          ) : (
            <Chip label={t('days', lang)} icon="zap" />
          )}
          <Chip label={`Lv ${level.level}`} icon="award" />
          <View style={{ flex: 1 }} />
          <Text style={[type('caption'), { color: c.textMuted }]}>{masteryLabel}</Text>
        </View>

        {/* docs/23 F5. Write failures were swallowed silently, so a full device
            meant days of invisible data loss while the app looked fine. The
            engine now tracks this; the child (and the parent reading over their
            shoulder) deserve to be told. */}
        {storageFailing && (
          <Card padded>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Feather name="alert-triangle" size={18} color={c.attention} />
              <Text style={[type('caption'), { color: c.text, flex: 1 }]}>
                {lang === 'hi'
                  ? 'प्रगति सहेजी नहीं जा पा रही — डिवाइस में जगह बनाएँ'
                  : "Couldn't save your progress — free up some space on this device"}
              </Text>
            </View>
          </Card>
        )}

        {/* THE primary action, first and largest, always above the fold. */}
        <Card elevation={2} padded>
          <Text style={[type('label'), { color: c.textMuted }]}>
            {t('todaysSession', lang).toUpperCase()}
          </Text>
          <Text style={[type('title'), { color: c.text, marginTop: space.xs }]}>
            {sessionSummary}
          </Text>
          <View style={{ marginTop: space.md }}>
            <ProgressBar
              value={Math.min(answeredToday, goal)}
              max={goal}
              label={t('todaysGoal', lang)}
              tint={answeredToday >= goal ? c.correct : c.primary}
            />
          </View>
          <View style={{ marginTop: space.base }}>
            <Button
              label={t('startPractising', lang)}
              onPress={start}
              icon="play"
              accessibilityHint={lang === 'hi' ? 'आपके लिए चुने गए 10 प्रश्न' : '10 questions chosen for you'}
            />
            {/* docs/28: a child (and a parent deciding whether there is time
                before school) should know what they are committing to before
                they tap, not discover it at question 7. */}
            <Text style={[type('caption'), { color: c.textMuted, textAlign: 'center', marginTop: space.sm }]}>
              {lang === 'hi' ? '10 सवाल · लगभग 3 मिनट' : '10 questions · about 3 minutes'}
            </Text>

            {/* The child picks their own target. Shown only once the goal is
                met, so it never reads as "you chose too little" mid-effort. */}
            {answeredToday >= goal && (
              <View style={{ marginTop: space.md, alignItems: 'center', gap: space.xs }}>
                <Text style={[type('caption'), { color: c.textMuted }]}>
                  {lang === 'hi' ? 'कल के लिए लक्ष्य' : "Tomorrow's goal"}
                </Text>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  {GOAL_CHOICES.map(n => (
                    <Pressable
                      key={n}
                      onPress={() => chooseGoal(n)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: goal === n }}
                      accessibilityLabel={
                        lang === 'hi' ? `${n} सवाल रोज़` : `${n} questions a day`
                      }
                      style={{
                        minWidth: 56, minHeight: 44, alignItems: 'center', justifyContent: 'center',
                        borderRadius: 12, borderWidth: 2,
                        borderColor: goal === n ? c.primary : c.border,
                        backgroundColor: goal === n ? c.primarySoft : 'transparent',
                      }}
                    >
                      <Text style={[type('heading'), { color: goal === n ? c.primary : c.text }]}>{n}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>
        </Card>

        {/* Two-column from the medium breakpoint: the tablet stops being a
            stretched phone (A5). */}
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: space.base }}>
          {weakest.length > 0 && (
            <View style={{ flex: wide ? 1 : undefined, gap: space.sm }}>
              <Text style={[type('label'), { color: c.textMuted }]}>
                {t('needsAttention', lang)}
              </Text>
              {weakest.map(m => (
                <Card key={m.skill} onPress={start} accessibilityLabel={skillLabel(m.skill, SKILLS[m.skill].label, lang)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                    <Feather name="target" size={18} color={c.attention} />
                    <View style={{ flex: 1 }}>
                      <Text style={[type('body'), { color: c.text }]}>{skillLabel(m.skill, SKILLS[m.skill].label, lang)}</Text>
                      <View style={{ marginTop: space.xs }}>
                        <ProgressBar value={m.value} tint={c.attention} showValue={false} height={5} />
                      </View>
                    </View>
                    <Feather name="chevron-right" size={18} color={c.textMuted} />
                  </View>
                </Card>
              ))}
            </View>
          )}

          <View style={{ flex: wide ? 1 : undefined, gap: space.sm }}>
            {reviewDue.length > 0 && (
              <Card onPress={start} accessibilityLabel={t('reviewDue', lang)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <Feather name="rotate-ccw" size={18} color={c.primary} />
                  <Text style={[type('body'), { color: c.text, flex: 1 }]}>
                    {t('reviewDue', lang)} · {reviewDue.length}
                  </Text>
                </View>
              </Card>
            )}

            {/* Completion pull: one concrete, reachable goal (docs/25 item 8). */}
            {nearlyDone && (
              <Card onPress={start} accessibilityLabel={nearlyDone.ch.title[lang === 'hi' ? 'hi' : 'en']}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <Feather name="flag" size={18} color={c.attention} />
                  <Text style={[type('body'), { color: c.text, flex: 1 }]}>
                    {lang === 'hi'
                      ? `${nearlyDone.ch.title.hi} पूरा करने के लिए ${nearlyDone.remaining} कौशल बाकी`
                      : `${nearlyDone.remaining} skill${nearlyDone.remaining === 1 ? '' : 's'} to finish ${nearlyDone.ch.title.en}`}
                  </Text>
                </View>
              </Card>
            )}

            {savedMistakes.length > 0 && (
              <Card onPress={() => router.push('/mistake-review')}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <Feather name="refresh-cw" size={18} color={c.attention} />
                  <Text style={[type('body'), { color: c.text, flex: 1 }]}>
                    {savedMistakes.length} {t(savedMistakes.length === 1 ? 'mistakeToReview' : 'mistakesToReview', lang)}
                  </Text>
                </View>
              </Card>
            )}

            {/* Manual selection survives, one level down. Autonomy without
                decision fatigue: the default is adaptive, the choice remains. */}
            <Card onPress={() => router.push('/class-select')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <Feather name="grid" size={18} color={c.textMuted} />
                <Text style={[type('body'), { color: c.text, flex: 1 }]}>{t('chooseTopic', lang)}</Text>
                <Feather name="chevron-right" size={18} color={c.textMuted} />
              </View>
            </Card>

            <Card onPress={() => router.push('/tables-mode')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <Feather name="hash" size={18} color={c.textMuted} />
                <Text style={[type('body'), { color: c.text, flex: 1 }]}>
                  {t('timesTables', lang).replace('\n', ' ')}
                </Text>
                <Feather name="chevron-right" size={18} color={c.textMuted} />
              </View>
            </Card>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
