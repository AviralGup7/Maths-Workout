import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useGame } from '@/context/GameContext';
import { useTheme } from '@/theme/useTheme';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { AnswerSurface } from '@/components/answer/AnswerSurface';
import { QuestionVisual } from '@/components/visuals/QuestionVisual';
import { useAnnounce } from '@/hooks/useA11y';
import {
  emptyPlacement, nextProbe, recordProbe, placementSummary,
  MAX_PLACEMENT_QUESTIONS, type PlacementState,
} from '@/learning/placement';
import { SKILLS } from '@/learning/skills';
import { categoryForSkill } from '@/learning/scheduler';
import { generateForSkill } from '@/generators';
import { expectedAnswer } from '@/generators/interactions';
import type { Question } from '@/generators/types';

/**
 * Placement — docs/27 P1-01.
 *
 * The app previously had no idea where to start a learner, so the scheduler
 * discovered it one answer at a time. Measured, that cost a capable Class 6
 * child 47% of their first two months on Class 1–2 material and delayed
 * algebra to day 37. Twenty questions here replace five weeks of guessing.
 *
 * Three deliberate choices in how this is presented:
 *
 *  · It is NOT called a test. Children arrive at a maths app with a history,
 *    and opening with an assessment is the fastest way to lose one who is
 *    already anxious. The copy frames it as the app learning about them.
 *
 *  · There is NO feedback per question. Right/wrong marks would turn it into
 *    the test it is trying not to be, and the probe deliberately asks
 *    questions above the learner's level — being told you got six wrong is a
 *    terrible first experience of a product meant to build confidence.
 *
 *  · It is SKIPPABLE. A child who does not want to do this should not be
 *    trapped; skipping simply means the scheduler discovers the level the slow
 *    way, which is exactly the previous behaviour.
 */
export default function PlacementScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { c, type, space, contentMaxWidth } = useTheme();
  const announce = useAnnounce();
  const { selectedClass, lang, applyPlacement, skipPlacement } = useGame();

  const [state, setState] = useState<PlacementState>(emptyPlacement());
  const [question, setQuestion] = useState<Question | null>(null);
  const [skill, setSkill] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const lockRef = useRef(false);

  const hi = lang === 'hi';
  const top = Platform.OS === 'web' ? 67 : insets.top;

  /** Draw the next probe question, or finish. */
  const advance = useCallback((s: PlacementState) => {
    const next = nextProbe(s, selectedClass);
    if (next === null) {
      setDone(true);
      setQuestion(null);
      setSkill(null);
      return;
    }
    const cat = categoryForSkill(next);
    let q: Question | null = null;
    try {
      // Mid mastery: the probe should ask a fair question, not the easiest or
      // hardest presentation of the skill.
      q = generateForSkill(selectedClass, 'medium', cat, next);
    } catch { q = null; }
    if (!q) {
      // A skill whose generator cannot serve this class is simply skipped
      // rather than stalling the probe.
      advance(recordProbe(s, next, false));
      return;
    }
    setSkill(next);
    setQuestion(q);
    lockRef.current = false;
  }, [selectedClass]);

  useEffect(() => { advance(emptyPlacement()); }, [advance]);

  const onSubmit = useCallback((normalised: string) => {
    if (lockRef.current || !question || !skill) return;
    lockRef.current = true;
    const correct = normalised === expectedAnswer(question);
    // No haptic verdict: this is not a test, and a buzz on a wrong answer
    // would tell the child they are failing before they have started.
    Haptics.selectionAsync().catch(() => {});
    const next = recordProbe(state, skill, correct);
    setState(next);
    advance(next);
  }, [question, skill, state, advance]);

  const summary = useMemo(
    () => placementSummary(state, hi ? 'hi' : 'en'), [state, hi]);

  const finish = useCallback(async () => {
    await applyPlacement(state);
    router.replace('/');
  }, [applyPlacement, state, router]);

  const skip = useCallback(async () => {
    await skipPlacement();
    router.replace('/');
  }, [skipPlacement, router]);

  useEffect(() => {
    if (done) announce(hi ? 'पहचान पूरी' : 'All done');
  }, [done, hi, announce]);

  const asked = state.asked.length;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: top }}>
      <View style={{
        flex: 1, padding: space.base, gap: space.base,
        maxWidth: contentMaxWidth ?? undefined, width: '100%', alignSelf: 'center',
      }}>
        {!done && (
          <>
            <View style={{ gap: space.xs }}>
              <Text style={[type('label'), { color: c.textMuted }]}>
                {(hi ? 'आपको जानना' : 'Getting to know you').toUpperCase()}
              </Text>
              <Text style={[type('caption'), { color: c.textMuted }]}>
                {hi
                  ? 'कुछ सवाल — कोई अंक नहीं। कुछ जान-बूझकर कठिन हैं।'
                  : 'A few questions — no score. Some are meant to be hard.'}
              </Text>
              <View style={{ marginTop: space.sm }}>
                <ProgressBar
                  value={asked}
                  max={MAX_PLACEMENT_QUESTIONS}
                  showValue={false}
                  label={hi ? 'प्रगति' : 'Progress'}
                  tint={c.primary}
                />
              </View>
            </View>

            {question && (
              <Card padded elevation={1}>
                <Text style={[type('title'), { color: c.text }]}>
                  {question.questionText}
                </Text>
                {!!skill && (
                  <View style={{ marginTop: space.md }}>
                    <QuestionVisual skill={skill} question={question} mastery={0.5} />
                  </View>
                )}
              </Card>
            )}

            {question && (
              <AnswerSurface
                question={question}
                locked={false}
                wasCorrect={null}
                selectedChoice={null}
                onSubmit={onSubmit}
              />
            )}

            <View style={{ flex: 1 }} />
            <Button
              label={hi ? 'छोड़ें' : 'Skip this'}
              variant="ghost"
              onPress={skip}
              accessibilityHint={hi
                ? 'ऐप अभ्यास के दौरान आपका स्तर पहचान लेगा'
                : 'The app will work out your level as you practise'}
            />
          </>
        )}

        {done && (
          <View style={{ gap: space.base, justifyContent: 'center', flex: 1 }}>
            <View style={{ alignItems: 'center', gap: space.sm }}>
              <Feather name="check-circle" size={44} color={c.correct} />
              <Text style={[type('title'), { color: c.text, textAlign: 'center' }]}>
                {hi ? 'हो गया' : 'All done'}
              </Text>
            </View>

            {/* docs/27 P1-03. A parent told WHY the app started their child
                where it did has a reason to trust the adaptive claim; one who
                sees a level appear from nowhere does not. */}
            <Card padded>
              <Text style={[type('body'), { color: c.text }]}>{summary.sentence}</Text>
              {summary.secure.length > 0 && (
                <Text style={[type('caption'), { color: c.textMuted, marginTop: space.sm }]}>
                  {hi ? 'पक्का लगा: ' : 'Looked secure: '}
                  {summary.secure.slice(0, 4).map(s => SKILLS[s]?.label).filter(Boolean).join(', ')}
                </Text>
              )}
            </Card>

            <Button label={hi ? 'अभ्यास शुरू करें' : 'Start practising'} icon="play" onPress={finish} />
          </View>
        )}
      </View>
    </View>
  );
}
