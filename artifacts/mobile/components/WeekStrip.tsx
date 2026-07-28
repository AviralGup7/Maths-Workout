import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import type { Lang } from '@/i18n/strings';

/**
 * Seven days of practice, at a glance. docs/28 item 50.
 *
 * The parent report already computed "practised on 4 of 7 days" and printed it
 * as a sentence. A sentence is precise and forgettable; a strip is scannable in
 * under a second, which is the actual constraint on a parent screen — the
 * report's own stated design goal is 30 seconds total.
 *
 * ── What it deliberately does not show ──────────────────────────────────────
 *
 * Minutes, question counts, or accuracy per day. A parent looking at a bar
 * chart of daily minutes starts optimising minutes, and time-on-task rewards
 * sitting still rather than thinking — which is why the report has never
 * carried a time target. This shows only whether the child practised, which is
 * the one daily fact that is both true and safe to act on.
 *
 * ── Why it starts today and reads backwards ─────────────────────────────────
 *
 * A Monday-first calendar week makes "we have not practised this week" true and
 * alarming every Monday morning. A rolling seven days is the honest window and
 * has no cliff edge.
 */
export function WeekStrip({
  days,
  lang,
  now = Date.now(),
}: {
  /** Epoch-ms timestamps of practice attempts, in any order. */
  days: number[];
  lang: Lang;
  now?: number;
}) {
  const { c, type, space } = useTheme();

  const DAY_MS = 86_400_000;
  const startOfDay = (t: number) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  const today = startOfDay(now);
  const practised = new Set(days.map(t => startOfDay(t)));

  // Oldest first, so the strip reads left-to-right like time.
  const cells = Array.from({ length: 7 }, (_, i) => {
    const day = today - (6 - i) * DAY_MS;
    return { day, on: practised.has(day), isToday: day === today };
  });

  const initials = lang === 'hi'
    ? ['र', 'सो', 'मं', 'बु', 'गु', 'शु', 'श']
    : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const count = cells.filter(x => x.on).length;

  return (
    <View>
      <View
        style={{ flexDirection: 'row', gap: space.xs }}
        accessibilityRole="image"
        accessibilityLabel={
          lang === 'hi'
            ? `पिछले 7 दिनों में ${count} दिन अभ्यास किया`
            : `Practised on ${count} of the last 7 days`
        }
      >
        {cells.map(({ day, on, isToday }) => (
          <View key={day} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View
              style={{
                width: '100%', height: 34, borderRadius: 8,
                backgroundColor: on ? c.correct : c.surfaceSunken,
                // Today is ringed rather than filled differently, so "today,
                // not yet practised" is visible without looking like a failure.
                borderWidth: isToday ? 2 : 0,
                borderColor: c.primary,
              }}
            />
            <Text style={[type('caption'), { color: c.textMuted }]}>
              {initials[new Date(day).getDay()]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
