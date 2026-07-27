import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/useTheme';


/**
 * Legacy palette keys, resolved reactively from the theme.
 *
 * docs/20 F1: `const C = colors.light` was evaluated once at import, so this
 * screen could never honour the dark preference the app already exposed. This
 * keeps the same key names — so the StyleSheet below is unchanged — while
 * making them re-render with the theme.
 */
function useLegacyPalette() {
  const { c } = useTheme();
  return React.useMemo(() => ({
    text: c.text, tint: c.primary, background: c.bg, foreground: c.text,
    card: c.surface, cardForeground: c.text,
    primary: c.primary, primaryForeground: c.primaryOn,
    secondary: c.surfaceSunken, secondaryForeground: c.text,
    muted: c.surfaceSunken, mutedForeground: c.textMuted,
    accent: c.primary, accentForeground: c.primaryOn,
    destructive: c.wrong, destructiveForeground: c.wrongOn,
    border: c.border, input: c.border,
    easy: c.correct, medium: c.attention, hard: c.wrong,
    correct: c.correct, wrong: c.wrong, timerWarning: c.attention,
    gold: c.attention, silver: c.textMuted, bronze: c.attention,
    catAddition: c.correct, catSubtraction: c.attention,
    catMultiplication: c.primary, catDivision: c.correct,
    catMixed: c.attention, catTables: c.primary,
  }), [c]);
}

/**
 * Numeric keypad entry.
 *
 * A custom keypad rather than the OS keyboard: the layout is predictable for
 * children, there is no autocorrect or emoji row, and it cannot be dismissed
 * accidentally mid-question.
 *
 * Deliberately does NOT auto-submit on digit count — a child typing "12" for a
 * single-digit answer must not be graded after the first keystroke.
 */
export function NumericEntry({
  allowDecimal,
  allowNegative,
  unit,
  locked,
  correctAnswer,
  wasCorrect,
  onSubmit,
}: {
  allowDecimal: boolean;
  allowNegative: boolean;
  unit?: string;
  locked: boolean;
  correctAnswer: string;
  wasCorrect: boolean | null;
  onSubmit: (value: string) => void;
}) {
  const C = useLegacyPalette();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const [value, setValue] = useState('');

  // Clear the field whenever a new question is presented.
  useEffect(() => { if (!locked) setValue(''); }, [locked]);

  const press = (key: string) => {
    if (locked) return;
    Haptics.selectionAsync();
    if (key === 'del') { setValue(v => v.slice(0, -1)); return; }
    if (key === '.') {
      if (!allowDecimal || value.includes('.')) return;
      setValue(v => (v === '' ? '0.' : v + '.'));
      return;
    }
    if (key === '-') {
      if (!allowNegative) return;
      setValue(v => (v.startsWith('-') ? v.slice(1) : '-' + v));
      return;
    }
    // Cap length so the display cannot overflow.
    if (value.replace('-', '').replace('.', '').length >= 6) return;
    setValue(v => v + key);
  };

  const submit = () => {
    if (locked || value === '' || value === '-') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSubmit(value);
  };

  // After grading, show what the learner entered alongside the truth.
  const display = locked && !wasCorrect ? value || '—' : value;
  const tone = locked ? (wasCorrect ? C.correct : C.wrong) : C.foreground;

  const keys = ['1','2','3','4','5','6','7','8','9', allowDecimal ? '.' : (allowNegative ? '-' : ''), '0', 'del'];

  return (
    <View style={styles.wrap}>
      <View
        style={[styles.display, locked && { borderColor: tone }]}
        accessibilityLiveRegion="polite"
        accessibilityLabel={value === '' ? 'No answer entered' : `Your answer: ${value}`}
      >
        <Text style={[styles.value, { color: tone }]} numberOfLines={1} adjustsFontSizeToFit>
          {display || ' '}
        </Text>
        {!!unit && <Text style={styles.unit}>{unit}</Text>}
      </View>

      {locked && !wasCorrect && (
        <Text style={styles.truth}>
          Answer: <Text style={{ color: C.correct, fontFamily: 'Inter_700Bold' }}>{correctAnswer}</Text>
        </Text>
      )}

      <View style={styles.pad}>
        {keys.map((k, i) =>
          k === '' ? <View key={i} style={styles.key} /> : (
            <TouchableOpacity
              key={i}
              style={[styles.key, k === 'del' && styles.keyMuted]}
              onPress={() => press(k)}
              disabled={locked}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={k === 'del' ? 'Delete last digit' : `Digit ${k}`}
            >
              {k === 'del'
                ? <Feather name="delete" size={20} color={C.mutedForeground} />
                : <Text style={styles.keyText}>{k}</Text>}
            </TouchableOpacity>
          ),
        )}
      </View>

      <TouchableOpacity
        style={[styles.submit, (locked || value === '') && styles.submitOff]}
        onPress={submit}
        disabled={locked || value === ''}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Check answer"
        accessibilityHint={value === '' ? 'Enter a number first' : `Submit ${value}`}
        accessibilityState={{ disabled: locked || value === '' }}
      >
        <Feather name="check" size={18} color="#fff" />
        <Text style={styles.submitText}>Check</Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * Styles are a factory rather than a module constant: they reference palette
 * values, and a module-scope StyleSheet freezes those at import time — the
 * exact defect that left dark mode non-functional (docs/20 F1).
 */
const makeStyles = (C: ReturnType<typeof useLegacyPalette>) => StyleSheet.create({
  wrap: { gap: 10 },
  display: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6,
    minHeight: 62, borderRadius: 14, borderWidth: 2, borderColor: C.border,
    backgroundColor: C.card, paddingHorizontal: 18, paddingVertical: 10,
  },
  value: { fontSize: 34, fontFamily: 'Inter_700Bold', color: C.foreground, letterSpacing: 1 },
  unit: { fontSize: 15, fontFamily: 'Inter_500Medium', color: C.mutedForeground },
  truth: { textAlign: 'center', fontSize: 12.5, fontFamily: 'Inter_500Medium', color: C.mutedForeground },
  pad: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  key: {
    width: '31.5%', height: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  keyMuted: { backgroundColor: C.secondary },
  keyText: { fontSize: 22, fontFamily: 'Inter_600SemiBold', color: C.foreground },
  submit: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 50, borderRadius: 13, backgroundColor: C.primary,
  },
  submitOff: { opacity: 0.4 },
  submitText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
});
