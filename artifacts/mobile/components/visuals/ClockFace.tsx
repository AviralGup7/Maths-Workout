import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText, G } from 'react-native-svg';
import { useTheme } from '@/theme/useTheme';

/**
 * An analogue clock face — docs/27 P3-03.
 *
 * Time questions were pure text: "It is 7 o'clock. What time will it be in 3
 * hours?" A child who can read a digital clock can answer that by adding, and
 * never touches the skill the question is named for. Reading an analogue face
 * is a distinct competence — angle, direction, and the fact that the short
 * hand moves BETWEEN numbers rather than sitting on them — and it is what the
 * NCERT curriculum actually asks for.
 *
 * ── Why the hour hand is not on the hour ────────────────────────────────────
 *
 * At 7:30 the hour hand sits halfway between 7 and 8. Drawing it pointing
 * squarely at 7 is the single most common error in hand-drawn clock diagrams,
 * and it teaches a child to read the hour hand as a pointer rather than as a
 * position — which then breaks the moment they meet a real clock. The hand
 * angle here includes the minute fraction.
 *
 * ── Why there are no minute numerals ────────────────────────────────────────
 *
 * Printing 5, 10, 15 … around the rim removes the counting-in-fives that
 * reading a clock is supposed to build. The minute ticks are drawn, and the
 * five-minute ticks are longer, which is the scaffold — not the answer.
 */
export function ClockFace({
  hour,
  minute = 0,
  size = 180,
}: {
  hour: number;
  minute?: number;
  size?: number;
}) {
  const { c } = useTheme();

  const R = size / 2;
  const rim = R - 6;

  // Hour hand carries the minute fraction: at 7:30 it sits between 7 and 8.
  const hourAngle = ((hour % 12) + minute / 60) * 30 - 90;
  const minAngle = minute * 6 - 90;

  const point = (angleDeg: number, length: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: R + Math.cos(rad) * length, y: R + Math.sin(rad) * length };
  };

  const h = point(hourAngle, rim * 0.5);
  const m = point(minAngle, rim * 0.75);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Clock showing ${hour} ${minute === 0 ? "o'clock" : `${minute} minutes`}`}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={R} cy={R} r={rim} fill={c.surface} stroke={c.borderStrong} strokeWidth={3} />

        {/* Minute ticks. Five-minute ticks are longer — the scaffold for
            counting in fives, without printing the numbers. */}
        {Array.from({ length: 60 }).map((_, i) => {
          const major = i % 5 === 0;
          const a = i * 6 - 90;
          const outer = point(a, rim - 3);
          const inner = point(a, rim - (major ? 12 : 7));
          return (
            <Line
              key={i}
              x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
              stroke={major ? c.text : c.textMuted}
              strokeWidth={major ? 2.5 : 1}
            />
          );
        })}

        {/* Hour numerals, 1–12. */}
        {Array.from({ length: 12 }).map((_, i) => {
          const n = i + 1;
          const p = point(n * 30 - 90, rim - 26);
          return (
            <SvgText
              key={n}
              x={p.x} y={p.y}
              fill={c.text} fontSize={size * 0.11} fontWeight="700"
              textAnchor="middle" alignmentBaseline="central"
            >
              {n}
            </SvgText>
          );
        })}

        <G>
          {/* Hour hand: short and thick. Minute hand: long and thin. The
              contrast is what lets a child tell them apart at a glance, and
              is the part cheap clock diagrams usually get wrong. */}
          <Line
            x1={R} y1={R} x2={h.x} y2={h.y}
            stroke={c.primary} strokeWidth={6} strokeLinecap="round"
          />
          <Line
            x1={R} y1={R} x2={m.x} y2={m.y}
            stroke={c.text} strokeWidth={3} strokeLinecap="round"
          />
          <Circle cx={R} cy={R} r={5} fill={c.text} />
        </G>
      </Svg>
    </View>
  );
}
