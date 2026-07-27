import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';
import type { ChoiceValue } from '@/generators/types';

const C = colors.light;

/**
 * Build a sequence by tapping items in order.
 *
 * Tap-to-place rather than drag-and-drop: it is far more reliable on small
 * screens and with small fingers, needs no gesture handler, and is accessible
 * to screen readers. The learner taps items in the order they want them, and
 * can tap a placed item to return it.
 *
 * After grading, the correct sequence is shown beneath so the comparison is
 * immediate — that side-by-side is the teaching moment.
 */
export function OrderingTray({
  items,
  correctOrder,
  direction,
  locked,
  onSubmit,
}: {
  items: ChoiceValue[];
  correctOrder: ChoiceValue[];
  direction: 'asc' | 'desc';
  locked: boolean;
  onSubmit: (ordered: ChoiceValue[]) => void;
}) {
  const [placed, setPlaced] = useState<ChoiceValue[]>([]);

  useEffect(() => { if (!locked) setPlaced([]); }, [locked]);

  const remaining = items.filter(
    i => !placed.some(p => String(p) === String(i)),
  );

  const place = (v: ChoiceValue) => {
    if (locked) return;
    Haptics.selectionAsync();
    setPlaced(p => [...p, v]);
  };

  const remove = (idx: number) => {
    if (locked) return;
    Haptics.selectionAsync();
    setPlaced(p => p.filter((_, i) => i !== idx));
  };

  const submit = () => {
    if (locked || placed.length !== items.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSubmit(placed);
  };

  const slotTone = (idx: number) => {
    if (!locked) return C.primary;
    return String(placed[idx]) === String(correctOrder[idx]) ? C.correct : C.wrong;
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>
        {locked
          ? 'Your order — green means correctly placed'
          : `Tap in order · ${direction === 'desc' ? 'largest first' : 'smallest first'}`}
      </Text>

      {/* The sequence being built */}
      <View style={styles.slots}>
        {Array.from({ length: items.length }).map((_, idx) => {
          const v = placed[idx];
          return (
            <TouchableOpacity
              key={idx}
              style={[
                styles.slot,
                v !== undefined && { borderColor: slotTone(idx), backgroundColor: slotTone(idx) + '18' },
              ]}
              onPress={() => v !== undefined && remove(idx)}
              disabled={locked || v === undefined}
              activeOpacity={0.7}
            >
              {v !== undefined
                ? <Text style={[styles.slotText, { color: slotTone(idx) }]}>{String(v)}</Text>
                : <Text style={styles.slotIndex}>{idx + 1}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Reveal the target sequence once graded */}
      {locked && (
        <View style={styles.answerRow}>
          <Text style={styles.answerLabel}>Correct:</Text>
          {correctOrder.map((v, i) => (
            <View key={i} style={styles.answerChip}>
              <Text style={styles.answerChipText}>{String(v)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Items still to place */}
      {!locked && (
        <View style={styles.pool}>
          {remaining.map((v, i) => (
            <TouchableOpacity key={i} style={styles.poolChip} onPress={() => place(v)} activeOpacity={0.75}>
              <Text style={styles.poolText}>{String(v)}</Text>
            </TouchableOpacity>
          ))}
          {remaining.length === 0 && <Text style={styles.hint}>All placed — tap Check</Text>}
        </View>
      )}

      <TouchableOpacity
        style={[styles.submit, (locked || placed.length !== items.length) && styles.submitOff]}
        onPress={submit}
        disabled={locked || placed.length !== items.length}
        activeOpacity={0.85}
      >
        <Feather name="check" size={18} color="#fff" />
        <Text style={styles.submitText}>Check</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  hint: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.mutedForeground, textAlign: 'center' },
  slots: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  slot: {
    flex: 1, maxWidth: 78, height: 58, borderRadius: 12, borderWidth: 2,
    borderStyle: 'dashed', borderColor: C.border, backgroundColor: C.card,
    alignItems: 'center', justifyContent: 'center',
  },
  slotText: { fontSize: 19, fontFamily: 'Inter_700Bold' },
  slotIndex: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.mutedForeground },
  pool: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, justifyContent: 'center', minHeight: 54 },
  poolChip: {
    minWidth: 66, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12,
    backgroundColor: C.secondary, borderWidth: 1, borderColor: C.border, alignItems: 'center',
  },
  poolText: { fontSize: 19, fontFamily: 'Inter_600SemiBold', color: C.foreground },
  answerRow: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' },
  answerLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.mutedForeground },
  answerChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    backgroundColor: C.correct + '1E', borderWidth: 1, borderColor: C.correct + '55',
  },
  answerChipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.correct },
  submit: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 50, borderRadius: 13, backgroundColor: C.primary,
  },
  submitOff: { opacity: 0.4 },
  submitText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
});
