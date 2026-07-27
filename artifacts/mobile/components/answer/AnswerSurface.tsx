import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import colors from '@/constants/colors';
import type { Question, ChoiceValue } from '@/generators/types';
import { normaliseSet, normaliseSequence, normaliseEntry, expectedAnswer } from '@/generators/interactions';
import { NumericEntry } from './NumericEntry';
import { MultiSelect } from './MultiSelect';
import { OrderingTray } from './OrderingTray';

const C = colors.light;

/**
 * Dispatches to the correct input surface for a question.
 *
 * This is the single boundary that keeps `game.tsx` free of interaction-type
 * knowledge: the screen owns the timer, progress, feedback and advance logic,
 * while everything about *how an answer is given* lives here. Adding a new
 * interaction type means adding a component and a branch — nothing else in the
 * app changes.
 *
 * Every surface reports its answer already normalised, so grading, the attempt
 * log and misconception diagnosis remain a single shared pipeline.
 */
export function AnswerSurface({
  question,
  locked,
  wasCorrect,
  selectedChoice,
  onSubmit,
}: {
  question: Question;
  locked: boolean;
  wasCorrect: boolean | null;
  selectedChoice: string | null;
  onSubmit: (normalised: string, raw: ChoiceValue | ChoiceValue[]) => void;
}) {
  const it = question.interaction;

  if (it?.kind === 'entry') {
    return (
      <NumericEntry
        allowDecimal={it.inputMode === 'decimal'}
        allowNegative={Number(question.answer) < 0}
        unit={it.unit}
        locked={locked}
        wasCorrect={wasCorrect}
        correctAnswer={expectedAnswer(question)}
        onSubmit={raw => onSubmit(normaliseEntry(raw), raw)}
      />
    );
  }

  if (it?.kind === 'multiSelect') {
    return (
      <MultiSelect
        options={it.options}
        correct={it.correct}
        locked={locked}
        onSubmit={sel => onSubmit(normaliseSet(sel), sel)}
      />
    );
  }

  if (it?.kind === 'ordering') {
    return (
      <OrderingTray
        items={it.items}
        correctOrder={it.correctOrder}
        direction={it.direction}
        locked={locked}
        onSubmit={ord => onSubmit(normaliseSequence(ord), ord)}
      />
    );
  }

  return (
    <ChoiceGrid
      question={question}
      locked={locked}
      selectedChoice={selectedChoice}
      onSubmit={c => onSubmit(String(c), c)}
    />
  );
}

/**
 * The original four-tile grid, extracted unchanged in behaviour.
 * Still the right affordance for early learners and for review, where seeing
 * the answer among options is a deliberate scaffold.
 */
function ChoiceGrid({
  question,
  locked,
  selectedChoice,
  onSubmit,
}: {
  question: Question;
  locked: boolean;
  selectedChoice: string | null;
  onSubmit: (choice: ChoiceValue) => void;
}) {
  const hasStringChoices = question.choices.some(c => typeof c === 'string');
  const fontSize = hasStringChoices
    ? 16
    : question.choices.some(c => Math.abs(Number(c)) > 999) ? 22 : 28;

  const format = (v: ChoiceValue): string => {
    if (typeof v === 'string') return v;
    if (!Number.isInteger(v)) return v.toFixed(2).replace(/\.?0+$/, '');
    return String(v);
  };

  const tileStyle = (choice: ChoiceValue) => {
    const base = [styles.tile, hasStringChoices && styles.tileText];
    if (!locked) return base;
    if (String(choice) === String(question.answer)) return [...base, styles.tileCorrect];
    if (String(choice) === selectedChoice) return [...base, styles.tileWrong];
    return [...base, styles.tileDim];
  };

  const textColor = (choice: ChoiceValue) => {
    if (!locked) return C.foreground;
    if (String(choice) === String(question.answer)) return C.correct;
    if (String(choice) === selectedChoice) return C.wrong;
    return C.mutedForeground;
  };

  return (
    <View style={styles.grid}>
      {question.choices.map((choice, i) => (
        <TouchableOpacity
          key={i}
          style={tileStyle(choice) as any}
          onPress={() => onSubmit(choice)}
          activeOpacity={0.75}
          disabled={locked}
        >
          <Text style={[styles.tileTextBase, { fontSize, color: textColor(choice) }]}>
            {format(choice)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  tile: {
    width: '48%', minHeight: 74, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.card, borderWidth: 2, borderColor: C.border, paddingHorizontal: 8,
  },
  tileText: { minHeight: 62 },
  tileTextBase: { fontFamily: 'Inter_700Bold', textAlign: 'center' },
  tileCorrect: { borderColor: C.correct, backgroundColor: C.correct + '1A' },
  tileWrong:   { borderColor: C.wrong,   backgroundColor: C.wrong + '1A' },
  tileDim:     { opacity: 0.45 },
});
