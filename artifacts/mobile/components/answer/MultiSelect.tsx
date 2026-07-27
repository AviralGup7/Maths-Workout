import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';
import type { ChoiceValue } from '@/generators/types';

const C = colors.light;

/**
 * "Tap all that apply."
 *
 * The natural shape for factors, primes and multiples — questions that are
 * about a *set*, and which multiple choice had to distort into "how many
 * factors does 12 have?" (a counting question) to fit four tiles.
 *
 * After grading, every option is revealed: missed correct answers are outlined
 * in green, wrongly-selected ones in red. That review is where the learning is.
 */
export function MultiSelect({
  options,
  correct,
  locked,
  onSubmit,
}: {
  options: ChoiceValue[];
  correct: ChoiceValue[];
  locked: boolean;
  onSubmit: (selected: ChoiceValue[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const correctSet = new Set(correct.map(String));

  useEffect(() => { if (!locked) setSelected([]); }, [locked]);

  const toggle = (v: ChoiceValue) => {
    if (locked) return;
    Haptics.selectionAsync();
    const key = String(v);
    setSelected(s => (s.includes(key) ? s.filter(x => x !== key) : [...s, key]));
  };

  const submit = () => {
    if (locked || selected.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSubmit(options.filter(o => selected.includes(String(o))));
  };

  const chipStyle = (v: ChoiceValue) => {
    const key = String(v);
    const isSel = selected.includes(key);
    const isRight = correctSet.has(key);
    if (!locked) return [styles.chip, isSel && styles.chipSelected];
    // Reveal: what they should have picked, and what they wrongly picked.
    if (isRight) return [styles.chip, styles.chipCorrect];
    if (isSel) return [styles.chip, styles.chipWrong];
    return [styles.chip, styles.chipDim];
  };

  const chipTextColor = (v: ChoiceValue) => {
    const key = String(v);
    if (!locked) return selected.includes(key) ? C.primary : C.foreground;
    if (correctSet.has(key)) return C.correct;
    if (selected.includes(key)) return C.wrong;
    return C.mutedForeground;
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>
        {locked ? 'Green shows every correct answer' : 'Tap all that apply, then check'}
      </Text>

      <View style={styles.grid}>
        {options.map((o, i) => (
          <TouchableOpacity
            key={i}
            style={chipStyle(o) as any}
            onPress={() => toggle(o)}
            disabled={locked}
            activeOpacity={0.75}
            accessibilityRole="checkbox"
            accessibilityLabel={`${o}`}
            accessibilityState={{ checked: selected.includes(String(o)), disabled: locked }}
          >
            <Text style={[styles.chipText, { color: chipTextColor(o) }]}>{String(o)}</Text>
            {locked && correctSet.has(String(o)) && (
              <Feather name="check" size={13} color={C.correct} style={styles.tick} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.submit, (locked || selected.length === 0) && styles.submitOff]}
        onPress={submit}
        disabled={locked || selected.length === 0}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Check answer"
        accessibilityHint={
          selected.length === 0 ? 'Select at least one option first'
          : `Submit ${selected.length} selected`
        }
      >
        <Feather name="check" size={18} color="#fff" />
        <Text style={styles.submitText}>
          Check{selected.length > 0 ? ` (${selected.length})` : ''}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  hint: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.mutedForeground, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, justifyContent: 'center' },
  chip: {
    minWidth: 66, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 13,
    backgroundColor: C.card, borderWidth: 2, borderColor: C.border, alignItems: 'center',
  },
  chipSelected: { borderColor: C.primary, backgroundColor: C.primary + '20' },
  chipCorrect:  { borderColor: C.correct, backgroundColor: C.correct + '1E' },
  chipWrong:    { borderColor: C.wrong,   backgroundColor: C.wrong + '1E' },
  chipDim:      { opacity: 0.45 },
  chipText: { fontSize: 19, fontFamily: 'Inter_600SemiBold' },
  tick: { position: 'absolute', top: 4, right: 5 },
  submit: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 50, borderRadius: 13, backgroundColor: C.primary,
  },
  submitOff: { opacity: 0.4 },
  submitText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
});
