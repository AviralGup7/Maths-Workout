import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { Mascot } from '@/components/Mascot';
import { chapterStyle } from '@/curriculum/chapters';
import type { Lang } from '@/i18n/strings';

/**
 * A certificate for finishing a chapter. docs/28 item 51.
 *
 * The audit found the product had no ARTEFACT — nothing a child could keep,
 * show a parent, or put on a wall. Every reward was a number that moved on a
 * screen they had to open the app to see.
 *
 * ── Why a chapter and not a session ─────────────────────────────────────────
 *
 * A chapter is complete only when EVERY skill in it is secure (0.85), which
 * takes weeks and cannot be earned by a lucky session. That is the whole point:
 * a certificate for finishing ten questions would be participation confetti
 * and both the child and the parent would learn to discount it. This one is
 * rare enough to mean something, and it certifies understanding rather than
 * attendance — the wording says "knows", not "completed".
 *
 * ── Why it names the skills ─────────────────────────────────────────────────
 *
 * "Chapter Complete" tells a parent nothing. Listing the secured skills turns
 * the certificate into the clearest statement of learning the product ever
 * makes, and it is the artefact most likely to be photographed and sent to a
 * grandparent — which is the honest reason to build it well.
 *
 * Rendered as a view rather than a PDF: it is designed to be screenshotted,
 * which every child and parent already knows how to do, and adds no
 * dependency or file-system permission.
 */
export function Certificate({
  chapterId,
  chapterTitle,
  skills,
  lang,
  date = new Date(),
}: {
  chapterId: string;
  chapterTitle: string;
  /** Display names of the skills now secure. */
  skills: string[];
  lang: Lang;
  date?: Date;
}) {
  const { c, type, space } = useTheme();
  const style = chapterStyle(chapterId);
  const hi = lang === 'hi';

  // Western Arabic numerals in both languages — semi-Hindi policy.
  const stamp = `${date.getDate()} / ${date.getMonth() + 1} / ${date.getFullYear()}`;

  return (
    <View
      style={[styles.card, { backgroundColor: c.surface, borderColor: style.colour }]}
      accessibilityRole="summary"
      accessibilityLabel={
        hi ? `प्रमाणपत्र: ${chapterTitle}` : `Certificate: ${chapterTitle}`
      }
    >
      <View style={[styles.ribbon, { backgroundColor: style.colour }]} />

      <Mascot mood="celebrate" size={96} />

      <Text style={[type('label'), { color: style.colour, letterSpacing: 1.5 }]}>
        {hi ? 'प्रमाणपत्र' : 'CERTIFICATE'}
      </Text>

      <Text style={[type('title'), { color: c.text, textAlign: 'center' }]}>
        {chapterTitle}
      </Text>

      {/* "Knows", not "completed". The claim is about understanding, and the
          product is only entitled to make it because completion requires every
          skill in the chapter to be secure. */}
      <Text style={[type('body'), { color: c.textMuted, textAlign: 'center' }]}>
        {hi ? 'अब यह सब आता है:' : 'Now knows:'}
      </Text>

      <View style={{ gap: 4, alignSelf: 'stretch' }}>
        {skills.slice(0, 6).map(s => (
          <Text key={s} style={[type('body'), { color: c.text, textAlign: 'center' }]}>
            {s}
          </Text>
        ))}
      </View>

      <Text style={[type('caption'), { color: c.textMuted, marginTop: space.sm }]}>
        {stamp}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 3, borderRadius: 20, padding: 22,
    alignItems: 'center', gap: 10, overflow: 'hidden',
  },
  ribbon: { position: 'absolute', top: 0, left: 0, right: 0, height: 8 },
});
