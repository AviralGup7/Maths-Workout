import React from 'react';
import { View } from 'react-native';
import Svg, { Rect, Circle } from 'react-native-svg';
import { useTheme } from '@/theme/useTheme';

/**
 * Ten-frame — the canonical early-number model.
 *
 * docs/28: measured 16 of 63 skills with any visual model, and the 47 without
 * included EVERY Class 1–2 foundation (`count.objects`, `count.skip`,
 * `add.within10`, `sub.within20`, `bonds.basic`). The youngest children — the
 * ones who need concrete-pictorial-abstract scaffolding most — were being given
 * pure symbol manipulation.
 *
 * ── Why a ten-frame rather than a row of objects ────────────────────────────
 *
 * A row of seven apples tells a child there are seven apples. A ten-frame tells
 * them that seven is "a full five and two more", and that it is "three short of
 * ten". Those two facts are the entire foundation of bridging-through-ten and
 * number bonds, and they are visible in the layout rather than needing to be
 * counted. This is why every early-years curriculum uses the frame and not the
 * row.
 *
 * ── Why this replaces emoji ─────────────────────────────────────────────────
 *
 * Counting questions used system emoji (🍎 ⭐ ● ♦) as the countable objects.
 * Those render differently on every OS and version, cannot be styled to the
 * theme, cannot be animated, cannot be arranged into a subitisable layout, and
 * are not a designed asset — the app had delegated its most important visual to
 * the platform. Drawn shapes are identical everywhere and inherit the theme.
 */
export function TenFrame({
  count,
  max = 10,
  size = 260,
}: {
  /** How many counters are filled. */
  count: number;
  /** Frame capacity — 10 for a single frame, 20 for a double. */
  max?: number;
  size?: number;
}) {
  const { c } = useTheme();

  const cols = 5;
  const rows = Math.max(1, Math.ceil(max / cols));
  const n = Math.max(0, Math.min(count, max));

  const cell = size / cols;
  const height = cell * rows;
  const r = cell * 0.31;

  const cells = [];
  for (let i = 0; i < max; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = col * cell + cell / 2;
    const cy = row * cell + cell / 2;
    cells.push(
      <React.Fragment key={i}>
        <Rect
          x={col * cell}
          y={row * cell}
          width={cell}
          height={cell}
          fill="none"
          stroke={c.border}
          strokeWidth={1.5}
        />
        {i < n && (
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            // The first five are one colour and the second five another, so the
            // "five and some more" structure is visible without counting. This
            // is the whole pedagogical point of the frame.
            fill={i < 5 ? c.primary : c.correct}
          />
        )}
      </React.Fragment>,
    );
  }

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Ten frame showing ${n} of ${max}`}
    >
      <Svg width={size} height={height} viewBox={`0 0 ${size} ${height}`}>
        {cells}
      </Svg>
    </View>
  );
}
