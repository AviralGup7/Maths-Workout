import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/useTheme';
import { useGame } from '@/context/GameContext';
import type { OpenSpec, OpenOp } from '@/generators/openResponse';
import { gradeOpen, describeSpec, normaliseOpen } from '@/generators/openResponse';

/**
 * Legacy palette keys, resolved reactively from the theme.
 * Same pattern as every other answer surface — a module-scope StyleSheet
 * freezes colours at import and breaks dark mode (docs/20 F1).
 */
function useLegacyPalette() {
  const { c } = useTheme();
  return React.useMemo(() => ({
    foreground: c.text, card: c.surface, border: c.border,
    primary: c.primary, secondary: c.surfaceSunken,
    mutedForeground: c.textMuted, correct: c.correct, wrong: c.wrong,
    attention: c.attention,
  }), [c]);
}

/**
 * Open-response entry: "give an answer that works", not "give the answer".
 *
 * docs/27 P1-17. Two input modes behind one surface, because the constraint
 * grader does not care which was used:
 *
 *   · `slots`      — n numeric boxes, filled from a shared keypad. The right
 *                    shape for "two numbers that add to 50", where the child
 *                    is producing values, not composing an expression.
 *   · `expression` — one line with digits and operators. The right shape for
 *                    Open Middle and reverse problems, where the *structure*
 *                    of the sentence is the answer.
 *
 * The live constraint checklist is the pedagogical core of this component.
 * An open task graded only at submit time is a worse experience than a closed
 * one: the child gets a red cross with no idea which of three requirements
 * they broke. Here each requirement ticks green as it is met, while they type,
 * so the task teaches the constraints rather than testing memory of them.
 */
export function OpenResponse({
  spec,
  locked,
  wasCorrect,
  onSubmit,
}: {
  spec: OpenSpec;
  locked: boolean;
  wasCorrect: boolean | null;
  onSubmit: (normalised: string) => void;
}) {
  const C = useLegacyPalette();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { lang } = useGame();
  const hi = lang === 'hi';

  const slotCount = spec.mode === 'slots' ? Math.max(1, spec.slots ?? 2) : 0;
  const [slots, setSlots] = useState<string[]>(() => Array(slotCount).fill(''));
  const [active, setActive] = useState(0);
  const [line, setLine] = useState('');

  useEffect(() => {
    if (!locked) { setSlots(Array(slotCount).fill('')); setLine(''); setActive(0); }
  }, [locked, slotCount]);

  const current = spec.mode === 'slots'
    ? normaliseOpen(slots.map(s => s.trim()).filter(s => s !== ''))
    : normaliseOpen(line);

  // Graded live in English internally, but the messages the child reads are
  // built in their own language.
  const verdict = gradeOpen(spec, current, lang);
  const hasInput = spec.mode === 'slots' ? slots.some(s => s !== '') : line !== '';

  const digits = spec.digitPool ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
  const ops: OpenOp[] = spec.opPool ?? ['+', '-', '*', '/'];
  const OP_GLYPH: Record<OpenOp, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

  const tap = (ch: string) => {
    if (locked) return;
    Haptics.selectionAsync();
    if (spec.mode === 'slots') {
      setSlots(s => s.map((v, i) => (i === active ? (v.length >= 5 ? v : v + ch) : v)));
    } else {
      setLine(v => (v.length >= 24 ? v : v + ch));
    }
  };

  const del = () => {
    if (locked) return;
    Haptics.selectionAsync();
    if (spec.mode === 'slots') {
      setSlots(s => s.map((v, i) => (i === active ? v.slice(0, -1) : v)));
    } else {
      setLine(v => v.slice(0, -1));
    }
  };

  const submit = () => {
    if (locked || !hasInput) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSubmit(current);
  };

  const tone = locked ? (wasCorrect ? C.correct : C.wrong) : C.foreground;

  return (
    <View style={styles.wrap}>
      {spec.mode === 'slots' ? (
        <View style={styles.slotRow}>
          {slots.map((v, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.slot,
                i === active && !locked && styles.slotActive,
                locked && { borderColor: tone },
              ]}
              onPress={() => !locked && setActive(i)}
              disabled={locked}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={
                hi ? `खाना ${i + 1}: ${v || 'खाली'}` : `Box ${i + 1}: ${v || 'empty'}`
              }
              accessibilityState={{ selected: i === active, disabled: locked }}
            >
              <Text style={[styles.slotText, { color: v ? tone : C.mutedForeground }]}>
                {v || '?'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View
          style={[styles.display, locked && { borderColor: tone }]}
          accessibilityLiveRegion="polite"
          accessibilityLabel={
            line === ''
              ? (hi ? 'कुछ नहीं लिखा' : 'Nothing entered')
              : (hi ? `आपका उत्तर: ${line}` : `Your answer: ${line}`)
          }
        >
          <Text style={[styles.value, { color: tone }]} numberOfLines={1} adjustsFontSizeToFit>
            {line || ' '}
          </Text>
        </View>
      )}

      {/*
        Live constraint checklist — the reason this format can be self-taught.
        A summary line above the boxes was removed after the browser render:
        it restated the same phrases the checklist already shows, word for
        word, so the child read the requirements twice and the screen carried
        no extra information for the space it cost.
      */}
      <Text style={styles.checksHead}>
        {hi ? 'आपका उत्तर ऐसा हो' : 'Your answer must'}
      </Text>
      <View style={styles.checks}>
        {spec.constraints.map((c, i) => {
          const fail = hasInput ? failureFor(spec, current, i, lang) : null;
          const met = hasInput && fail === null;
          return (
            <View key={i} style={styles.checkRow}>
              <Feather
                name={met ? 'check-circle' : 'circle'}
                size={13}
                color={met ? C.correct : C.mutedForeground}
              />
              <Text style={[styles.checkText, met && { color: C.correct }]}>
                {constraintLine(spec, i, lang)}
              </Text>
            </View>
          );
        })}
      </View>

      {locked && (
        <Text style={styles.feedback}>
          {wasCorrect
            ? (hi ? 'यह चल गया — और भी उत्तर संभव थे।'
                  : 'That works — and other answers would too.')
            : `${verdict.message ?? ''} ${hi ? 'एक संभव उत्तर' : 'One possible answer'}: `}
          {!wasCorrect && (
            <Text style={{ color: C.correct, fontFamily: 'Inter_700Bold' }}>{spec.exemplar}</Text>
          )}
        </Text>
      )}

      <View style={styles.pad}>
        {digits.map(d => (
          <TouchableOpacity
            key={`d${d}`}
            style={styles.key}
            onPress={() => tap(String(d))}
            disabled={locked}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={hi ? `अंक ${d}` : `Digit ${d}`}
          >
            <Text style={styles.keyText}>{d}</Text>
          </TouchableOpacity>
        ))}
        {spec.mode === 'expression' && ops.map(o => (
          <TouchableOpacity
            key={`o${o}`}
            style={[styles.key, styles.keyOp]}
            onPress={() => tap(o)}
            disabled={locked}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Operator ${OP_GLYPH[o]}`}
          >
            <Text style={styles.keyText}>{OP_GLYPH[o]}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.key, styles.keyMuted]}
          onPress={del}
          disabled={locked}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={hi ? 'मिटाएँ · Delete' : 'Delete last entry'}
        >
          <Feather name="delete" size={18} color={C.mutedForeground} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.submit, (locked || !hasInput) && styles.submitOff]}
        onPress={submit}
        disabled={locked || !hasInput}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={hi ? 'जाँचें · Check' : 'Check answer'}
        accessibilityState={{ disabled: locked || !hasInput }}
      >
        <Feather name="check" size={18} color="#fff" />
        <Text style={styles.submitText}>{hi ? 'जाँचें · Check' : 'Check'}</Text>
      </TouchableOpacity>
    </View>
  );
}

/** Failure message for one constraint, or null when it is satisfied. */
function failureFor(spec: OpenSpec, submitted: string, index: number, lang: 'en' | 'hi') {
  const single: OpenSpec = { ...spec, constraints: [spec.constraints[index]] };
  return gradeOpen(single, submitted, lang).correct ? null : 'x';
}

function constraintLine(spec: OpenSpec, index: number, lang: 'en' | 'hi'): string {
  // Reuse the shared describer so the checklist and the task line can never
  // disagree about what the task asks for.
  const single: OpenSpec = { ...spec, constraints: [spec.constraints[index]] };
  const text = describeSpec(single, lang);
  if (text) return text;
  // Constraints hidden from the summary (whole numbers, how many boxes) still
  // need a checklist row, or a child cannot see why they are being told off.
  const c = spec.constraints[index];
  if (c.type === 'integerParts') return lang === 'hi' ? 'पूर्ण संख्याएँ' : 'whole numbers';
  if (c.type === 'partCount') {
    return lang === 'hi' ? `${c.count} संख्याएँ` : `${c.count} numbers`;
  }
  return '';
}

const makeStyles = (C: ReturnType<typeof useLegacyPalette>) => StyleSheet.create({
  wrap: { gap: 10 },
  checksHead: {
    fontSize: 11.5, fontFamily: 'Inter_600SemiBold', color: C.mutedForeground,
    textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 4,
  },
  slotRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  slot: {
    minWidth: 78, height: 62, borderRadius: 14, borderWidth: 2, borderColor: C.border,
    backgroundColor: C.card, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 12,
  },
  slotActive: { borderColor: C.primary, backgroundColor: C.primary + '14' },
  slotText: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  display: {
    alignItems: 'center', justifyContent: 'center', minHeight: 62, borderRadius: 14,
    borderWidth: 2, borderColor: C.border, backgroundColor: C.card, paddingHorizontal: 16,
  },
  value: { fontSize: 30, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  checks: { gap: 4, paddingHorizontal: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.mutedForeground, flex: 1 },
  feedback: {
    textAlign: 'center', fontSize: 12.5, fontFamily: 'Inter_500Medium',
    color: C.mutedForeground,
  },
  pad: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center' },
  key: {
    width: 52, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  keyOp: { backgroundColor: C.secondary },
  keyMuted: { backgroundColor: C.secondary },
  keyText: { fontSize: 20, fontFamily: 'Inter_600SemiBold', color: C.foreground },
  submit: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 50, borderRadius: 13, backgroundColor: C.primary,
  },
  submitOff: { opacity: 0.4 },
  submitText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
});
