import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Question, ChoiceValue } from '@/generators/types';
import { normaliseSet, normaliseSequence, normaliseEntry, normaliseBand, expectedAnswer } from '@/generators/interactions';
import { AnswerTile } from '@/components/ui/AnswerTile';
import type { TileState } from '@/components/ui/AnswerTile';
import { useTheme } from '@/theme/useTheme';
import { useGame } from '@/context/GameContext';
import { NumericEntry } from './NumericEntry';
import { MultiSelect } from './MultiSelect';
import { OrderingTray } from './OrderingTray';


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

  if (it?.kind === 'estimate') {
    return (
      <EstimateBands
        bands={it.bands}
        unit={it.unit}
        low={it.low}
        high={it.high}
        locked={locked}
        selectedChoice={selectedChoice}
        onSubmit={(lo, hi) => onSubmit(normaliseBand(lo, hi), `${lo}-${hi}`)}
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
 * Estimation bands.
 *
 * A separate surface because estimation grades against a RANGE, not a value.
 * Rendered as ranges ("about 300 to 400") rather than single numbers so the
 * child is never tempted to read them as exact answers to compute towards —
 * the framing is doing pedagogical work, not just formatting.
 */
function EstimateBands({
  bands, unit, low, high, locked, selectedChoice, onSubmit,
}: {
  bands: [number, number][];
  unit?: string;
  low: number;
  high: number;
  locked: boolean;
  selectedChoice: string | null;
  onSubmit: (lo: number, hi: number) => void;
}) {
  const C = useLegacyPalette();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const { space } = useTheme();
  const { lang } = useGame();

  const stateFor = (lo: number, hi: number): TileState => {
    if (!locked) return 'idle';
    const isAnswer = lo <= high && hi >= low;
    const isChosen = selectedChoice === `${lo}-${hi}`;
    if (isAnswer && isChosen) return 'correct';
    if (isAnswer) return 'revealed';
    if (isChosen) return 'wrong';
    return 'dimmed';
  };

  const rows: [number, number][][] = [];
  for (let i = 0; i < bands.length; i += 2) rows.push(bands.slice(i, i + 2));

  return (
    <View style={{ gap: space.md }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: space.md }}>
          {row.map(([lo, hi], i) => (
            <AnswerTile
              key={`${r}-${i}`}
              label={`${lo}–${hi}${unit ? ' ' + unit : ''}`}
              state={stateFor(lo, hi)}
              onPress={() => onSubmit(lo, hi)}
              lang={lang}
              index={r * 2 + i + 1}
              total={bands.length}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * The four-tile answer grid.
 *
 * Rebuilt on AnswerTile for M1 of docs/17. The previous implementation
 * signalled correct/wrong with border and background colour ONLY, which
 * measured 1.07 separation under simulated deuteranopia — the two states were
 * literally the same colour for roughly 1 in 12 boys. Tiles now carry an icon
 * and an accessible outcome label as well, and the "revealed" state is visually
 * distinct from a correct tap so a child can tell the right answer apart from
 * their own.
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
  const C = useLegacyPalette();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const { space } = useTheme();
  const { lang } = useGame();

  const format = (v: ChoiceValue): string => {
    if (typeof v === 'string') return v;
    if (!Number.isInteger(v)) return v.toFixed(2).replace(/\.?0+$/, '');
    return String(v);
  };

  const stateFor = (choice: ChoiceValue): TileState => {
    if (!locked) return 'idle';
    const isAnswer = String(choice) === String(question.answer);
    const isChosen = String(choice) === selectedChoice;
    if (isAnswer && isChosen) return 'correct';
    if (isAnswer) return 'revealed';        // right answer the child did not pick
    if (isChosen) return 'wrong';
    return 'dimmed';
  };

  // Two rows of two, so tiles stay wide enough to hit comfortably.
  const rows: ChoiceValue[][] = [];
  for (let i = 0; i < question.choices.length; i += 2) {
    rows.push(question.choices.slice(i, i + 2));
  }

  return (
    <View style={{ gap: space.md }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: space.md }}>
          {row.map((choice, i) => (
            <AnswerTile
              key={`${r}-${i}`}
              label={format(choice)}
              state={stateFor(choice)}
              onPress={() => onSubmit(choice)}
              lang={lang}
              index={r * 2 + i + 1}
              total={question.choices.length}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * Styles are a factory rather than a module constant: they reference palette
 * values, and a module-scope StyleSheet freezes those at import time — the
 * exact defect that left dark mode non-functional (docs/20 F1).
 */
const makeStyles = (C: ReturnType<typeof useLegacyPalette>) => StyleSheet.create({
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
