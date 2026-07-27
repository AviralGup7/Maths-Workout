import React from 'react';
import { View, Pressable } from 'react-native';
import Svg, { Line, Circle, Text as SvgText, Rect, Polygon } from 'react-native-svg';
import { useTheme } from '@/theme/useTheme';

/**
 * A number line.
 *
 * docs/14 §2 marks this **essential** for integers, decimals, magnitude and
 * rounding. The reasoning: for these concepts the number line *is* the concept,
 * not an illustration of it. Negative magnitude is genuinely counter-intuitive,
 * and `0.45 < 0.5` is a spatial fact that the symbols actively obscure — which
 * is exactly why `dec.longer-is-bigger` is one of the most common misconceptions
 * in the library.
 *
 * Two modes, and the distinction carries the pedagogy:
 *   · `input: 'none'` — illustrative, sits beside a normal question
 *   · `input: 'tap'`  — the line IS the question ("tap where 0.45 goes"), and
 *                       the child's wrong tap reveals their mental model in a
 *                       way a wrong multiple-choice tap never can.
 *
 * The fade is driven by mastery elsewhere (see docs/14 §2): below 0.55 the
 * visual is interactive, 0.55–0.80 illustrative, above 0.80 it disappears.
 * Support that never withdraws produces dependence.
 */
export interface NumberLineProps {
  min: number;
  max: number;
  /** Distance between labelled ticks. */
  step: number;
  /** Values to mark permanently on the line. */
  marks?: { value: number; label?: string }[];
  /** The learner's current answer, if they have tapped. */
  value?: number | null;
  /** The correct value, revealed after answering. */
  target?: number | null;
  onSelect?: (value: number) => void;
  /** Snap taps to this resolution. Defaults to a tenth of `step`. */
  snap?: number;
  height?: number;
  showState?: 'idle' | 'correct' | 'wrong';
}

export function NumberLine({
  min, max, step, marks = [], value = null, target = null,
  onSelect, snap, height = 120, showState = 'idle',
}: NumberLineProps) {
  const { c, space } = useTheme();
  const [width, setWidth] = React.useState(320);

  const padX = 24;
  const usable = Math.max(1, width - padX * 2);
  const y = height - 46;
  const range = max - min || 1;

  const xFor = (v: number) => padX + ((v - min) / range) * usable;
  const vFor = (x: number) => min + ((x - padX) / usable) * range;

  const resolution = snap ?? step / 10;
  const snapTo = (v: number) => {
    const snapped = Math.round(v / resolution) * resolution;
    // Floating point: 0.1 * 3 is 0.30000000000000004, which would render as a
    // nonsense label on a decimals question.
    const dp = Math.max(0, -Math.floor(Math.log10(resolution)));
    return Number(Math.min(max, Math.max(min, snapped)).toFixed(dp));
  };

  const ticks: number[] = [];
  for (let v = min; v <= max + 1e-9; v += step) ticks.push(Number(v.toFixed(6)));

  const interactive = !!onSelect;
  const answerColour =
    showState === 'correct' ? c.correct : showState === 'wrong' ? c.wrong : c.primary;

  const body = (
    <Svg width={width} height={height}>
      {/* The line itself */}
      <Line x1={padX} y1={y} x2={width - padX} y2={y} stroke={c.borderStrong} strokeWidth={2} />

      {/* Ticks and labels */}
      {ticks.map(t => (
        <React.Fragment key={t}>
          <Line x1={xFor(t)} y1={y - 7} x2={xFor(t)} y2={y + 7} stroke={c.borderStrong} strokeWidth={1.5} />
          <SvgText
            x={xFor(t)} y={y + 26} fontSize={12} fontWeight="600"
            fill={c.textMuted} textAnchor="middle"
          >
            {String(t)}
          </SvgText>
        </React.Fragment>
      ))}

      {/* Fixed marks */}
      {marks.map(m => (
        <React.Fragment key={`m-${m.value}`}>
          <Circle cx={xFor(m.value)} cy={y} r={6} fill={c.attention} />
          {!!m.label && (
            <SvgText x={xFor(m.value)} y={y - 16} fontSize={12} fontWeight="700"
              fill={c.attention} textAnchor="middle">{m.label}</SvgText>
          )}
        </React.Fragment>
      ))}

      {/* The correct answer, revealed after a miss. Drawn as a hollow ring so
          it reads differently from the child's own solid marker. */}
      {target !== null && showState !== 'idle' && (
        <Circle cx={xFor(target)} cy={y} r={9} fill="none" stroke={c.correct} strokeWidth={3} />
      )}

      {/* The learner's answer — a pin, not a dot, so it is unambiguous which
          point on the line is being claimed. */}
      {value !== null && (
        <>
          <Line x1={xFor(value)} y1={y - 30} x2={xFor(value)} y2={y} stroke={answerColour} strokeWidth={3} />
          <Polygon
            points={`${xFor(value) - 6},${y - 30} ${xFor(value) + 6},${y - 30} ${xFor(value)},${y - 20}`}
            fill={answerColour}
          />
          <SvgText x={xFor(value)} y={y - 36} fontSize={13} fontWeight="700"
            fill={answerColour} textAnchor="middle">{String(value)}</SvgText>
        </>
      )}
    </Svg>
  );

  if (!interactive) {
    return (
      <View
        onLayout={e => setWidth(e.nativeEvent.layout.width)}
        style={{ marginVertical: space.sm }}
        accessibilityRole="image"
        accessibilityLabel={`Number line from ${min} to ${max}`}
      >
        {body}
      </View>
    );
  }

  return (
    <Pressable
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      onPress={e => onSelect?.(snapTo(vFor(e.nativeEvent.locationX)))}
      style={{ marginVertical: space.sm }}
      accessibilityRole="adjustable"
      accessibilityLabel={`Number line from ${min} to ${max}. Tap to place your answer.`}
      accessibilityValue={value !== null ? { text: String(value) } : undefined}
    >
      {body}
    </Pressable>
  );
}
