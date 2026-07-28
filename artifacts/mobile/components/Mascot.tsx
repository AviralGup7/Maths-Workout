import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path, G, Rect } from 'react-native-svg';
import { useTheme } from '@/theme/useTheme';

/**
 * Ganit — the app's character.
 *
 * docs/28 measured the single largest gap in the product: **two image assets in
 * the entire app**, both of them launcher icons. No character, no illustration,
 * no world. Against Khan Academy Kids (Kodi), Duolingo (Duo) and DragonBox, a
 * child comparing the two apps was choosing between a talking animal and a grey
 * card headed "TODAY'S PRACTICE". Child appeal scored 3.2/10 — the lowest of
 * every product benchmarked — while parent trust scored 8.6.
 *
 * ── Why an owl, and why drawn in code ───────────────────────────────────────
 *
 * A vector component rather than a PNG set, deliberately:
 *   · it inherits the theme, so it is correct in light AND dark with no second
 *     asset and no chance of the two drifting
 *   · it scales to any size without shipping @2x/@3x variants
 *   · expressions are props, not files, so adding one costs a path and not a
 *     round-trip to an illustrator
 *   · it adds no bytes to the bundle beyond this file
 *
 * The shape language is deliberately soft — circles, no corners, no teeth, wide
 * eyes with large pupils. Baby-schema proportions (oversized head, low-set
 * features) reliably read as friendly and non-threatening to young children,
 * which matters most in the one place the character must appear: immediately
 * after a wrong answer.
 *
 * ── The rule this character must obey ───────────────────────────────────────
 *
 * It never mocks, never looks disappointed and never reacts to failure with a
 * sad face. `thinking` is the expression for a wrong answer — curiosity, not
 * judgement. Shame is not motivation, and a character that performs
 * disappointment teaches a child that mistakes are shameful, which is the exact
 * opposite of what the error-analysis work in this product exists to do.
 */

export type MascotMood =
  /** Resting. Home screen, menus. */
  | 'idle'
  /** Correct answer, session going well. */
  | 'happy'
  /** Mastery, chapter complete, streak milestone. The biggest expression. */
  | 'celebrate'
  /** Wrong answer. Curious, NEVER disappointed. */
  | 'thinking'
  /** Reading a hint or worked example aloud. */
  | 'encouraging';

export function Mascot({
  mood = 'idle',
  size = 96,
}: {
  mood?: MascotMood;
  size?: number;
}) {
  const { c } = useTheme();

  // Body colour comes from the brand so the character IS the brand mark rather
  // than a sticker placed next to it.
  const body = c.primary;
  const belly = c.primarySoft;
  const beak = c.attention;
  const eyeWhite = '#FFFFFF';
  const pupil = '#12141A';

  // Eyes carry almost all of the expression. Pupil size and lid position do
  // more work than mouth shape at small sizes, which is where this renders.
  const eye = {
    idle:        { r: 7.5, lid: 0,   browY: -2 },
    happy:       { r: 8.5, lid: 0,   browY: -3 },
    celebrate:   { r: 9.0, lid: 0,   browY: -5 },
    thinking:    { r: 7.0, lid: 2.5, browY: 1 },
    encouraging: { r: 8.0, lid: 0,   browY: -2 },
  }[mood];

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Ears / tufts — set wide and low so the head reads round, not pointed */}
        <Path d="M26 26 L20 10 L38 20 Z" fill={body} />
        <Path d="M74 26 L80 10 L62 20 Z" fill={body} />

        {/* Body */}
        <Ellipse cx="50" cy="56" rx="34" ry="36" fill={body} />

        {/* Belly — a lighter field so the face reads against the body */}
        <Ellipse cx="50" cy="64" rx="23" ry="24" fill={belly} />

        {/* Wings. On celebrate they lift; everywhere else they rest. */}
        {mood === 'celebrate' ? (
          <>
            <Ellipse cx="14" cy="40" rx="9" ry="17" fill={body} transform="rotate(-35 14 40)" />
            <Ellipse cx="86" cy="40" rx="9" ry="17" fill={body} transform="rotate(35 86 40)" />
          </>
        ) : (
          <>
            <Ellipse cx="17" cy="58" rx="8" ry="18" fill={body} />
            <Ellipse cx="83" cy="58" rx="8" ry="18" fill={body} />
          </>
        )}

        {/* Eyes */}
        <G>
          <Circle cx="38" cy="44" r="13" fill={eyeWhite} />
          <Circle cx="62" cy="44" r="13" fill={eyeWhite} />
          <Circle cx={mood === 'thinking' ? 40 : 38} cy={44 + eye.browY} r={eye.r} fill={pupil} />
          <Circle cx={mood === 'thinking' ? 64 : 62} cy={44 + eye.browY} r={eye.r} fill={pupil} />
          {/* Catchlight — the single detail that makes eyes read as alive */}
          <Circle cx={(mood === 'thinking' ? 40 : 38) + 2.5} cy={41 + eye.browY} r="2.4" fill="#FFFFFF" />
          <Circle cx={(mood === 'thinking' ? 64 : 62) + 2.5} cy={41 + eye.browY} r="2.4" fill="#FFFFFF" />
          {/* Lids — only for thinking, and only partial. A fully closed eye
              reads as bored or asleep, which is the wrong note after an error. */}
          {eye.lid > 0 && (
            <>
              <Path d={`M25 ${44 - eye.lid} h26 v-13 h-26 Z`} fill={body} />
              <Path d={`M49 ${44 - eye.lid} h26 v-13 h-26 Z`} fill={body} />
            </>
          )}
        </G>

        {/* Beak */}
        {mood === 'celebrate' || mood === 'happy' ? (
          // Open beak = a small cheer. Rounded, never a jagged shape.
          <Path d="M50 56 q7 0 7 6 q0 7 -7 7 q-7 0 -7 -7 q0 -6 7 -6 Z" fill={beak} />
        ) : (
          <Path d="M50 55 L57 62 L43 62 Z" fill={beak} />
        )}

        {/* Feet */}
        <Path d="M38 90 l-5 5 M38 90 l0 6 M38 90 l5 5" stroke={beak} strokeWidth="3" strokeLinecap="round" />
        <Path d="M62 90 l-5 5 M62 90 l0 6 M62 90 l5 5" stroke={beak} strokeWidth="3" strokeLinecap="round" />

        {/* A thinking owl holds a question mark, not a frown. This is the whole
            emotional contract of the character in one shape. */}
        {mood === 'thinking' && (
          <G>
            <Circle cx="82" cy="20" r="12" fill={c.surface} stroke={body} strokeWidth="2" />
            <Path
              d="M78 16 q0 -5 4 -5 q4 0 4 4 q0 3 -4 4 v2"
              stroke={body} strokeWidth="2.4" fill="none" strokeLinecap="round"
            />
            <Circle cx="82" cy="26" r="1.6" fill={body} />
          </G>
        )}

        {/* Celebration sparks — three, not a shower. Restraint is the house style. */}
        {mood === 'celebrate' && (
          <G>
            <Rect x="10" y="12" width="5" height="5" rx="1.5" fill={beak} transform="rotate(20 12 14)" />
            <Rect x="86" y="16" width="4" height="4" rx="1.2" fill={c.correct} transform="rotate(-15 88 18)" />
            <Rect x="50" y="4" width="5" height="5" rx="1.5" fill={beak} transform="rotate(35 52 6)" />
          </G>
        )}
      </Svg>
    </View>
  );
}
