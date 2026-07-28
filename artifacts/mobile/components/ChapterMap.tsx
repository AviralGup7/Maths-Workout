import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme/useTheme';
import { chapterStyle } from '@/curriculum/chapters';
import type { Chapter, ChapterStatus } from '@/curriculum/chapters';
import type { Lang } from '@/i18n/strings';

/**
 * The journey, as a path rather than a list.
 *
 * docs/28 item 43. "Your Journey" rendered as six identical grey rows with a
 * percentage on the right — an inventory, not a journey. A child could not see
 * where they were, where they had come from, or what was next, which is the
 * entire reason Duolingo and Khan Academy both use a path.
 *
 * ── What the shape is doing ─────────────────────────────────────────────────
 *
 * Vertical, top-to-bottom, one node per chapter, joined by a connector that
 * FILLS as the chapter completes. Progress is therefore legible in two ways at
 * once: how far down the path you are (position) and how solid the line behind
 * you is (density). Neither requires reading a number, which matters when a
 * third of the audience cannot yet read the chapter titles.
 *
 * ── Why not a winding/gamified map ──────────────────────────────────────────
 *
 * A meandering path with scenery is more charming and much worse: it implies
 * the route is fixed and linear, which is false — the scheduler interleaves,
 * revisits, and pulls chapters forward on evidence. A straight spine with
 * honest fill states says "these are the chapters, here is how solid each one
 * is" without lying about how the app actually sequences work.
 */
export function ChapterMap({
  items,
  lang,
  onSelect,
}: {
  items: { ch: Chapter; status: ChapterStatus; pct: number }[];
  lang: Lang;
  onSelect?: (ch: Chapter) => void;
}) {
  const { c, type, space } = useTheme();

  return (
    <View>
      {items.map(({ ch, status, pct }, i) => {
        const style = chapterStyle(ch.id);
        const isLast = i === items.length - 1;
        const done = status === 'complete';
        const active = status === 'inProgress';
        const locked = !done && !active;

        // The node reads its state from fill, ring and icon together — never
        // from colour alone, which is the standing rule in this product.
        const nodeBg =
          done ? style.colour
          : active ? style.colour + '26'
          : c.surfaceSunken;
        const nodeBorder = done || active ? style.colour : c.border;
        const iconColour = done ? '#FFFFFF' : active ? style.colour : c.textMuted;

        return (
          <View key={ch.id} style={{ flexDirection: 'row' }}>
            {/* Spine */}
            <View style={{ width: 48, alignItems: 'center' }}>
              <Pressable
                onPress={() => onSelect?.(ch)}
                disabled={!onSelect}
                accessibilityRole={onSelect ? 'button' : 'image'}
                accessibilityLabel={
                  `${lang === 'hi' ? ch.title.hi : ch.title.en}, ` +
                  (done
                    ? (lang === 'hi' ? 'पूरा' : 'complete')
                    : active
                      ? `${Math.round(pct * 100)}%`
                      : (lang === 'hi' ? 'अभी शुरू नहीं' : 'not started yet'))
                }
                style={{
                  width: 44, height: 44, borderRadius: 22, borderWidth: 2,
                  backgroundColor: nodeBg, borderColor: nodeBorder,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Feather
                  name={(done ? 'check' : locked ? 'lock' : style.icon) as never}
                  size={18}
                  color={iconColour}
                />
              </Pressable>

              {/* Connector. Its filled portion is the chapter's progress, so
                  the line itself carries information rather than decoration. */}
              {!isLast && (
                <View style={{
                  width: 4, height: 34, borderRadius: 2,
                  backgroundColor: c.border, marginVertical: 2, overflow: 'hidden',
                }}>
                  <View style={{
                    width: 4,
                    height: `${Math.round(Math.max(0, Math.min(1, pct)) * 100)}%` as unknown as number,
                    backgroundColor: style.colour,
                  }} />
                </View>
              )}
            </View>

            {/* Label */}
            <View style={{ flex: 1, paddingTop: 10, paddingBottom: isLast ? 0 : space.md }}>
              <Text style={[type('heading'), { color: locked ? c.textMuted : c.text }]}>
                {lang === 'hi' ? ch.title.hi : ch.title.en}
              </Text>
              <Text style={[type('caption'), { color: c.textMuted }]}>
                {done
                  ? (lang === 'hi' ? 'पूरा हुआ' : 'Complete')
                  : active
                    ? `${Math.round(pct * 100)}%`
                    : (lang === 'hi' ? 'अभी शुरू नहीं' : 'Not started yet')}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
