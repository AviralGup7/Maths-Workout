import React from 'react';
import { View } from 'react-native';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';
import { useTheme } from '@/theme/useTheme';

/**
 * The array model for multiplication.
 *
 * docs/14 §2 marks this **high value** because a single object unifies three
 * things a child otherwise meets as unrelated topics: multiplication, area, and
 * factors. `3 × 4` is a rectangle; the area of that rectangle is the product;
 * and the numbers that can form a rectangle from 12 counters *are* its factors.
 *
 * It also directly targets `mul.added-instead`: an array of 6 rows of 4 makes
 * the difference between 6 + 4 and 6 × 4 visible rather than definitional.
 *
 * Deliberately NOT used for times-table drill. The goal there is automaticity,
 * and a visual slows retrieval — actively counterproductive once the fact
 * should be recalled rather than derived.
 */
export interface ArrayGridProps {
  rows: number;
  cols: number;
  /** Highlight a sub-rectangle, for partial products in long multiplication. */
  highlight?: { rows: number; cols: number };
  /** Show row/column counts beside the grid. */
  showCounts?: boolean;
  height?: number;
  showState?: 'idle' | 'correct' | 'wrong';
}

export function ArrayGrid({
  rows, cols, highlight, showCounts = true, height = 150, showState = 'idle',
}: ArrayGridProps) {
  const { c, space } = useTheme();
  const [width, setWidth] = React.useState(300);

  // Cap the grid so a 12x12 array stays legible on a small phone rather than
  // collapsing into a grey rectangle.
  const r = Math.max(1, Math.min(12, rows));
  const k = Math.max(1, Math.min(12, cols));

  const labelPad = showCounts ? 26 : 6;
  const availW = width - labelPad - 8;
  const availH = height - labelPad - 8;
  const cell = Math.max(6, Math.min(availW / k, availH / r, 30));
  const gridW = cell * k;
  const gridH = cell * r;
  const x0 = labelPad + (availW - gridW) / 2;
  const y0 = labelPad;

  const fill = showState === 'correct' ? c.correct
    : showState === 'wrong' ? c.wrong
    : c.primary;

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < k; j++) {
      const inHighlight = highlight
        ? i < highlight.rows && j < highlight.cols
        : true;
      cells.push(
        <Rect
          key={`${i}-${j}`}
          x={x0 + j * cell} y={y0 + i * cell}
          width={cell - 2} height={cell - 2} rx={2}
          fill={inHighlight ? fill : c.surfaceSunken}
          opacity={inHighlight ? 0.85 : 1}
          stroke={c.borderStrong} strokeWidth={0.75}
        />,
      );
    }
  }

  return (
    <View
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      style={{ marginVertical: space.sm }}
      accessibilityRole="image"
      accessibilityLabel={`Array of ${r} rows and ${k} columns, ${r * k} squares in total`}
    >
      <Svg width={width} height={height}>
        {cells}
        {showCounts && (
          <>
            {/* Row count, read down the left edge */}
            <SvgText x={12} y={y0 + gridH / 2 + 5} fontSize={14} fontWeight="700"
              fill={c.textMuted} textAnchor="middle">{r}</SvgText>
            {/* Column count, read across the top */}
            <SvgText x={x0 + gridW / 2} y={16} fontSize={14} fontWeight="700"
              fill={c.textMuted} textAnchor="middle">{k}</SvgText>
          </>
        )}
      </Svg>
    </View>
  );
}
