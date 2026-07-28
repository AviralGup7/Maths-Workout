import React from 'react';
import { View } from 'react-native';
import Svg, { Rect, Circle, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/theme/useTheme';
import { breakdown, COIN_MAX } from '@/learning/everydayVisualPolicy';

/**
 * Indian coins and notes — docs/27 P3-04.
 *
 * Money questions were pure arithmetic wearing a rupee sign: "3 × ₹5 coins,
 * how much altogether?" is a times-table question. The skill the category is
 * named for — recognising denominations and combining them — never appeared.
 *
 * ── Why denominations and not just a number ─────────────────────────────────
 *
 * "₹35" tells a child the answer. Two ₹10 notes, a ₹10 coin and a ₹5 coin
 * tells them how to GET there, and matches what is actually in their hand at a
 * shop. It also makes the common error visible: a child who counts coins
 * rather than value says "four" instead of "thirty-five".
 *
 * ── Why shapes rather than pictures of real currency ────────────────────────
 *
 * Reproducing Indian banknotes is a legal question in most jurisdictions and a
 * maintenance one in all of them — the notes are redesigned. Simple shapes
 * with the denomination printed on them carry the whole pedagogical payload:
 * coins are circles, notes are rectangles, and the value is legible. This also
 * keeps them theme-aware and costs no assets.
 */

export function MoneyRow({
  amount,
  pieces,
  width = 300,
}: {
  /** Render the greedy breakdown of this amount. */
  amount?: number;
  /** Or give the exact denominations to show. */
  pieces?: number[];
  width?: number;
}) {
  const { c } = useTheme();

  const list = pieces ?? (amount !== undefined ? breakdown(amount) : []);
  if (list.length === 0) return null;

  const perRow = Math.min(5, list.length);
  const rows = Math.ceil(list.length / perRow);
  const cell = Math.min(58, width / perRow);
  const height = rows * (cell + 8);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Money: ${list.map(v => `${v} rupees`).join(', ')}`}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {list.map((value, i) => {
          const col = i % perRow;
          const row = Math.floor(i / perRow);
          const x = col * cell + 4;
          const y = row * (cell + 8) + 4;
          const isCoin = value <= COIN_MAX;
          const label = `₹${value}`;

          if (isCoin) {
            const r = (cell - 12) / 2;
            return (
              <React.Fragment key={i}>
                <Circle
                  cx={x + r + 2} cy={y + r + 2} r={r}
                  fill={c.attentionSoft} stroke={c.attention} strokeWidth={2}
                />
                <SvgText
                  x={x + r + 2} y={y + r + 2}
                  fill={c.text} fontSize={r * 0.72} fontWeight="700"
                  textAnchor="middle" alignmentBaseline="central"
                >
                  {label}
                </SvgText>
              </React.Fragment>
            );
          }

          // Notes: wider than tall, so they read as notes at a glance.
          const w = cell - 6;
          const h = (cell - 6) * 0.62;
          return (
            <React.Fragment key={i}>
              <Rect
                x={x} y={y + (cell - h) / 2 - 2} width={w} height={h} rx={4}
                fill={c.correctSoft} stroke={c.correct} strokeWidth={2}
              />
              <SvgText
                x={x + w / 2} y={y + (cell - h) / 2 - 2 + h / 2}
                fill={c.text} fontSize={h * 0.42} fontWeight="700"
                textAnchor="middle" alignmentBaseline="central"
              >
                {label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}
