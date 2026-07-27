import React from 'react';
import { View } from 'react-native';
import Svg, { Rect, G, Text as SvgText, Line } from 'react-native-svg';
import { useTheme } from '@/theme/useTheme';

/**
 * Base-ten blocks: hundreds (flats), tens (rods) and ones (units).
 *
 * docs/14 §2 marks this **high value** as the canonical model for place value,
 * and it is the only visual that makes *carrying and borrowing* explicable
 * rather than procedural. `sub.smaller-from-larger` — the single most common
 * misconception in the library — happens because "borrow 1 ten" is a rule with
 * no referent. Breaking a rod into ten units gives it one.
 *
 * The `exchange` prop is the whole point: it renders the moment of regrouping,
 * which is precisely the step children skip.
 */
export interface BaseTenProps {
  value: number;
  /** Highlight the column being exchanged, for carry/borrow explanation. */
  exchange?: 'ones' | 'tens' | null;
  /** Label each column with its place name. */
  showPlaces?: boolean;
  height?: number;
  compact?: boolean;
}

export function BaseTen({
  value, exchange = null, showPlaces = true, height = 130, compact = false,
}: BaseTenProps) {
  const { c, space } = useTheme();
  const [width, setWidth] = React.useState(300);

  const v = Math.max(0, Math.min(999, Math.round(value)));
  const hundreds = Math.floor(v / 100);
  const tens = Math.floor((v % 100) / 10);
  const ones = v % 10;

  const unit = compact ? 5 : 7;      // side of a single "one" cube
  const gap = 2;
  const colGap = 18;

  const colour = (place: 'hundreds' | 'tens' | 'ones') =>
    exchange === place ? c.attention : c.primary;

  let cursorX = 8;
  const groups: React.ReactNode[] = [];
  const labels: React.ReactNode[] = [];
  const baseY = height - (showPlaces ? 26 : 8);

  // Hundreds — 10x10 flats
  for (let h = 0; h < hundreds; h++) {
    const side = unit * 10 + gap * 9;
    groups.push(
      <Rect key={`h${h}`} x={cursorX} y={baseY - side} width={side} height={side}
        fill={colour('hundreds')} opacity={0.85} stroke={c.borderStrong} strokeWidth={1} rx={2} />,
    );
    cursorX += side + gap * 2;
  }
  if (hundreds > 0) {
    labels.push(
      <SvgText key="lh" x={8 + (unit * 10) / 2} y={height - 8} fontSize={11} fontWeight="600"
        fill={c.textMuted} textAnchor="middle">100s</SvgText>,
    );
    cursorX += colGap;
  }

  // Tens — vertical rods of 10
  const tensStart = cursorX;
  for (let t = 0; t < tens; t++) {
    const h = unit * 10 + gap * 9;
    groups.push(
      <Rect key={`t${t}`} x={cursorX} y={baseY - h} width={unit} height={h}
        fill={colour('tens')} opacity={0.85} stroke={c.borderStrong} strokeWidth={1} rx={1.5} />,
    );
    cursorX += unit + gap * 2;
  }
  if (tens > 0) {
    labels.push(
      <SvgText key="lt" x={tensStart + ((cursorX - tensStart) / 2)} y={height - 8}
        fontSize={11} fontWeight="600" fill={c.textMuted} textAnchor="middle">10s</SvgText>,
    );
    cursorX += colGap;
  }

  // Ones — single cubes, stacked in a column of up to 10
  const onesStart = cursorX;
  for (let o = 0; o < ones; o++) {
    const row = o % 10;
    groups.push(
      <Rect key={`o${o}`} x={cursorX} y={baseY - unit - row * (unit + gap)}
        width={unit} height={unit}
        fill={colour('ones')} opacity={0.85} stroke={c.borderStrong} strokeWidth={1} rx={1.5} />,
    );
  }
  if (ones > 0) {
    labels.push(
      <SvgText key="lo" x={onesStart + unit / 2} y={height - 8} fontSize={11} fontWeight="600"
        fill={c.textMuted} textAnchor="middle">1s</SvgText>,
    );
  }

  return (
    <View
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      style={{ marginVertical: space.sm }}
      accessibilityRole="image"
      accessibilityLabel={
        `${v} shown as ${hundreds} hundreds, ${tens} tens and ${ones} ones`
      }
    >
      <Svg width={width} height={height}>
        <G>{groups}</G>
        {showPlaces && <G>{labels}</G>}
      </Svg>
    </View>
  );
}
