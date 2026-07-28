import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/theme/useTheme';

/**
 * Bar model / tape diagram — docs/27 P3-05.
 *
 * The representation Singapore maths is built on, and the highest-value one
 * still missing from this product. Word problems were the app's least
 * supported category: the child reads a sentence and is expected to leap
 * straight to an arithmetic sentence, which is exactly the step that fails.
 *
 * ── What a bar model actually does ──────────────────────────────────────────
 *
 * It makes the STRUCTURE of the problem visible before any number is
 * calculated. "Priya has 12 mangoes and gives away 5" and "a class has 12 boys
 * and 5 girls" produce the same arithmetic but different structures, and a
 * child who cannot tell them apart guesses the operation. Drawing the bars
 * answers "what kind of problem is this?" — after which the operation is
 * usually obvious.
 *
 * ── The four structures ─────────────────────────────────────────────────────
 *
 * These map onto the four word-problem families the generator actually
 * produces, which is why there are four and not a generic diagram:
 *
 *   partWhole   two parts joined into a whole      3 + 4 = ?
 *   difference  two bars compared side by side     12 − 5 = ?
 *   equalGroups n identical units                  4 rows of 6
 *   sharing     a whole cut into n equal parts     24 shared by 4
 *
 * ── Why the unknown is marked and never computed ────────────────────────────
 *
 * The bar shows a `?` where the answer goes. Filling it in would turn the
 * model into the answer and remove the thinking, which is the same reason
 * `QuestionVisual` shows only the first operand for base-ten and the same
 * reason the manipulative does not pre-tint its cells.
 */

export type BarStructure = 'partWhole' | 'difference' | 'equalGroups' | 'sharing';

export function BarModel({
  structure,
  a,
  b,
  /** Label for the unknown. Always a symbol, never the computed value. */
  unknown = '?',
  width = 300,
}: {
  structure: BarStructure;
  a: number;
  b: number;
  unknown?: string;
  width?: number;
}) {
  const { c } = useTheme();

  const H = 34;          // bar height
  const GAP = 12;        // vertical gap between bars
  const LABEL = 26;      // room for the brace label
  const stroke = c.borderStrong;

  // Guard: a bar model of an absurd ratio is unreadable, and one of zero is
  // meaningless. The caller gets nothing rather than a misleading picture.
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null;

  const label = (x: number, y: number, text: string, colour: string) => (
    <SvgText
      x={x} y={y} fill={colour} fontSize={15} fontWeight="700"
      textAnchor="middle" alignmentBaseline="middle"
    >
      {text}
    </SvgText>
  );

  if (structure === 'partWhole') {
    // Two parts on one row, a brace beneath marking the unknown whole.
    const total = a + b;
    const wa = Math.max(38, (a / total) * width);
    const wb = Math.max(38, width - wa);
    const h = H + LABEL + 8;
    return (
      <Frame label="Part and part make a whole" width={width} height={h}>
        <Rect x={0} y={0} width={wa} height={H} fill={c.primarySoft} stroke={stroke} strokeWidth={2} rx={4} />
        <Rect x={wa} y={0} width={wb} height={H} fill={c.correctSoft} stroke={stroke} strokeWidth={2} rx={4} />
        {label(wa / 2, H / 2, String(a), c.text)}
        {label(wa + wb / 2, H / 2, String(b), c.text)}
        <Line x1={0} y1={H + 8} x2={wa + wb} y2={H + 8} stroke={stroke} strokeWidth={2} />
        {label((wa + wb) / 2, H + 20, unknown, c.primary)}
      </Frame>
    );
  }

  if (structure === 'difference') {
    // Two stacked bars, aligned left. The gap IS the answer, which is what
    // makes "how many more" visible rather than deduced.
    const big = Math.max(a, b);
    const small = Math.min(a, b);
    const wBig = width;
    const wSmall = Math.max(30, (small / big) * width);
    const h = H * 2 + GAP + LABEL;
    return (
      <Frame label="How much longer is one than the other?" width={width} height={h}>
        <Rect x={0} y={0} width={wBig} height={H} fill={c.primarySoft} stroke={stroke} strokeWidth={2} rx={4} />
        {label(wBig / 2, H / 2, String(big), c.text)}
        <Rect x={0} y={H + GAP} width={wSmall} height={H} fill={c.correctSoft} stroke={stroke} strokeWidth={2} rx={4} />
        {label(wSmall / 2, H + GAP + H / 2, String(small), c.text)}
        {/* The difference, drawn as an open segment rather than filled. */}
        <Rect
          x={wSmall} y={H + GAP} width={Math.max(2, wBig - wSmall)} height={H}
          fill="none" stroke={c.primary} strokeWidth={2} strokeDasharray="5 4" rx={4}
        />
        {label(wSmall + (wBig - wSmall) / 2, H + GAP + H / 2, unknown, c.primary)}
      </Frame>
    );
  }

  if (structure === 'equalGroups') {
    // n identical units. Capped so twelve rows of six does not render as
    // a wall of slivers — beyond 8 the count stops being subitisable anyway.
    const n = Math.min(a, 8);
    const unit = (width - (n - 1) * 4) / n;
    const h = H + LABEL + 8;
    return (
      <Frame label={`${a} equal groups of ${b}`} width={width} height={h}>
        {Array.from({ length: n }).map((_, i) => (
          <React.Fragment key={i}>
            <Rect
              x={i * (unit + 4)} y={0} width={unit} height={H}
              fill={c.primarySoft} stroke={stroke} strokeWidth={2} rx={4}
            />
            {unit > 26 && label(i * (unit + 4) + unit / 2, H / 2, String(b), c.text)}
          </React.Fragment>
        ))}
        <Line x1={0} y1={H + 8} x2={width} y2={H + 8} stroke={stroke} strokeWidth={2} />
        {label(width / 2, H + 20, unknown, c.primary)}
      </Frame>
    );
  }

  // sharing — a known whole cut into b equal parts, one part unknown.
  const parts = Math.min(Math.max(2, b), 8);
  const unit = (width - (parts - 1) * 4) / parts;
  const h = H + LABEL + 8;
  return (
    <Frame label={`${a} shared into ${b} equal parts`} width={width} height={h}>
      {Array.from({ length: parts }).map((_, i) => (
        <React.Fragment key={i}>
          <Rect
            x={i * (unit + 4)} y={0} width={unit} height={H}
            fill={i === 0 ? c.correctSoft : c.surfaceSunken}
            stroke={stroke} strokeWidth={2} rx={4}
          />
          {i === 0 && unit > 26 && label(unit / 2, H / 2, unknown, c.primary)}
        </React.Fragment>
      ))}
      <Line x1={0} y1={H + 8} x2={width} y2={H + 8} stroke={stroke} strokeWidth={2} />
      {label(width / 2, H + 20, String(a), c.text)}
    </Frame>
  );
}

function Frame({
  label, width, height, children,
}: {
  label: string; width: number; height: number; children: React.ReactNode;
}) {
  const { c, type, space } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: space.xs }} accessibilityRole="image"
      accessibilityLabel={label}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {children}
      </Svg>
      <Text style={[type('caption'), { color: c.textMuted, textAlign: 'center' }]}>
        {label}
      </Text>
    </View>
  );
}
