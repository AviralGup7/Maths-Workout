import React from 'react';
import { View, Pressable } from 'react-native';
import Svg, { Rect, Circle, Path, G, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/theme/useTheme';

/**
 * Part-whole models for fractions: a bar, a circle, or a set of counters.
 *
 * docs/14 §2 marks this **essential**, and the reason is precise:
 * `1/2 + 1/3 = 2/5` is only *obviously* wrong when you can see the pieces.
 * The `frac.add-across` misconception survives symbolic correction because
 * symbols give the child nothing to contradict — two halves of a bar do.
 *
 * Three representations rather than one, because a child who only ever sees
 * pizza circles learns "fractions are circles" rather than "fractions are equal
 * parts of a whole". Varying the representation is what builds the concept.
 */
export type PartShape = 'bar' | 'circle' | 'set';

export interface PartModelProps {
  /** Total equal parts. */
  denominator: number;
  /** Parts currently shaded. */
  shaded: number;
  shape?: PartShape;
  /** Tapping a part toggles it — used for "shade two thirds". */
  onToggle?: (index: number) => void;
  /** Parts the learner has shaded, when interactive. */
  selected?: number[];
  height?: number;
  showState?: 'idle' | 'correct' | 'wrong';
  /** Renders "3/4" beneath the model. Off while the child is still shading. */
  showLabel?: boolean;
}

export function PartModel({
  denominator, shaded, shape = 'bar', onToggle, selected,
  height = 110, showState = 'idle', showLabel = false,
}: PartModelProps) {
  const { c, space } = useTheme();
  const [width, setWidth] = React.useState(300);

  const n = Math.max(1, Math.min(24, denominator));
  const isOn = (i: number) => (selected ? selected.includes(i) : i < shaded);

  const fill = showState === 'correct' ? c.correct
    : showState === 'wrong' ? c.wrong
    : c.primary;

  const interactive = !!onToggle;
  const labelY = height - 6;
  // Reserve label space only when a label is actually drawn; otherwise the
  // model silently loses a quarter of its height and a fraction bar collapses
  // into an unreadable strip.
  const modelH = showLabel ? height - 24 : height;

  const parts: React.ReactNode[] = [];

  if (shape === 'bar') {
    const pad = 4;
    const w = (width - pad * 2) / n;
    for (let i = 0; i < n; i++) {
      parts.push(
        <Rect
          key={i}
          x={pad + i * w} y={8} width={w - 2} height={modelH - 16}
          fill={isOn(i) ? fill : c.surfaceSunken}
          stroke={c.borderStrong} strokeWidth={1.5} rx={4}
          onPress={interactive ? () => onToggle?.(i) : undefined}
        />,
      );
    }
  } else if (shape === 'circle') {
    const r = Math.min(modelH / 2 - 8, 52);
    const cx = width / 2;
    const cy = modelH / 2;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const d = n === 1
        ? `M ${cx} ${cy} m ${-r} 0 a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`
        : `M ${cx} ${cy} L ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} `
          + `A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} Z`;
      parts.push(
        <Path
          key={i} d={d}
          fill={isOn(i) ? fill : c.surfaceSunken}
          stroke={c.borderStrong} strokeWidth={1.5}
          onPress={interactive ? () => onToggle?.(i) : undefined}
        />,
      );
    }
  } else {
    // Set model: discrete counters. The representation that makes "fraction of
    // an amount" concrete, which is where frac.numerator-as-whole goes wrong.
    const perRow = Math.min(n, 6);
    const rows = Math.ceil(n / perRow);
    const r = Math.min(16, (modelH - 16) / (rows * 2.4));
    const gapX = width / (perRow + 1);
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      parts.push(
        <Circle
          key={i}
          cx={gapX * (col + 1)} cy={16 + r + row * (r * 2.4)} r={r}
          fill={isOn(i) ? fill : c.surfaceSunken}
          stroke={c.borderStrong} strokeWidth={1.5}
          onPress={interactive ? () => onToggle?.(i) : undefined}
        />,
      );
    }
  }

  const count = selected ? selected.length : shaded;

  return (
    <View
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      style={{ marginVertical: space.sm }}
      accessibilityRole={interactive ? 'adjustable' : 'image'}
      accessibilityLabel={
        interactive
          ? `Shape divided into ${n} equal parts. ${count} shaded. Tap a part to shade it.`
          : `${count} of ${n} parts shaded`
      }
    >
      <Svg width={width} height={height}>
        <G>{parts}</G>
        {showLabel && (
          <SvgText x={width / 2} y={labelY} fontSize={15} fontWeight="700"
            fill={c.text} textAnchor="middle">
            {`${count}/${n}`}
          </SvgText>
        )}
      </Svg>
    </View>
  );
}
