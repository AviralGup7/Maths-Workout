// ─── Scaffolding hints ───────────────────────────────────────────────────────
// docs/14 §4.
//
// Distinct from worked examples (§1): a worked example shows a *completed*
// solution, a hint helps the child produce their own. The order matters — hints
// come first, and the worked example is what happens when hints have not been
// enough.
//
// Two design decisions carry almost all the value here.
//
// **Hints are earned by TIME, not requested on demand.** A visible "hint"
// button produces two documented failure modes at once: help-avoidance in
// anxious children who will not press it, and help-abuse in children who press
// it reflexively. Time-triggering removes the asymmetry — the children who most
// need help are the least likely to ask for it.
//
// **Hints never contain the answer.** Level 3 stops exactly one step short.
// A hint that completes the problem is not scaffolding, it is the answer with
// extra steps, and it removes the productive struggle where the learning is.

import type { SkillId } from './skills';
import { SKILLS } from './skills';
import type { Attempt } from './attempts';
import { MASTERED_THRESHOLD, STRUGGLING_THRESHOLD } from './mastery';
import type { Lang } from '../i18n/strings';

export type HintLevel = 0 | 1 | 2 | 3;

export interface HintTriple {
  /** L1 · Orientation — reframes the task, gives nothing away. */
  orient: { en: string; hi: string };
  /** L2 · Strategy — names the method, not the answer. */
  strategy: { en: string; hi: string };
  /** L3 · Directed — narrows to one step, still stops short of the answer. */
  directed: { en: string; hi: string };
}

// ─── Timing ──────────────────────────────────────────────────────────────────

/**
 * Seconds before each hint level, by mastery band.
 *
 * The delays lengthen as competence grows and vanish entirely above 0.80. This
 * is contingent scaffolding (Wood, Bruner & Ross): support calibrated to need
 * and withdrawn as it stops being needed.
 *
 * `null` means the level is never reached at that band.
 */
export function hintDelays(mastery: number): [number, number, number | null] {
  if (mastery < STRUGGLING_THRESHOLD) return [20, 40, 60];
  if (mastery < 0.80) return [35, 70, null];
  return [Infinity, Infinity, null];   // secure: no hints at all
}

/**
 * Which hint level should be visible right now.
 *
 * Wrong attempts advance the level directly — a child who has already tried
 * twice has demonstrated need more clearly than one who has simply paused, and
 * making them wait out the clock as well would be perverse.
 */
export function hintLevelFor(args: {
  elapsedSeconds: number;
  wrongAttempts: number;
  mastery: number;
  /** No hints for a skill with no authored copy. */
  hasCopy: boolean;
}): HintLevel {
  const { elapsedSeconds, wrongAttempts, mastery, hasCopy } = args;
  if (!hasCopy) return 0;
  if (mastery >= 0.80) return 0;

  const [t1, t2, t3] = hintDelays(mastery);

  let byTime: HintLevel = 0;
  if (t3 !== null && elapsedSeconds >= t3) byTime = 3;
  else if (elapsedSeconds >= t2) byTime = 2;
  else if (elapsedSeconds >= t1) byTime = 1;

  let byAttempts: HintLevel = 0;
  if (wrongAttempts >= 2) byAttempts = 3;
  else if (wrongAttempts >= 1) byAttempts = 2;

  const level = Math.max(byTime, byAttempts) as HintLevel;
  // Level 3 is gated for mid-band learners even when they have failed twice:
  // at that mastery they can get there themselves, and a directed hint would
  // short-circuit the struggle that is doing the work.
  if (level === 3 && t3 === null) return 2;
  return level;
}

// ─── Dependence prevention ───────────────────────────────────────────────────

/** Hints used on a skill within the recent window. */
export function hintUsageFor(log: Attempt[], skill: SkillId, window = 10): number {
  return log.filter(a => a.skill === skill).slice(-window)
    .filter(a => a.scaffolded).length;
}

/**
 * Heavy hint use means the hints are not working.
 *
 * The correct response is NOT more hints — it is to go and fix whatever is
 * missing underneath (§3 M2 prerequisite descent). A child who needs a directed
 * hint on most attempts is not being scaffolded, they are being carried.
 */
export const HEAVY_HINT_THRESHOLD = 6;

export function needsDescentNotHints(log: Attempt[], skill: SkillId): boolean {
  return hintUsageFor(log, skill) >= HEAVY_HINT_THRESHOLD;
}

// ─── Copy ────────────────────────────────────────────────────────────────────
//
// One triple per skill family rather than per skill: the method for
// `add.2digit.carry` and `add.3digit` is the same, and duplicating the copy
// would guarantee the two drift apart.

const H = (
  orientEn: string, orientHi: string,
  stratEn: string, stratHi: string,
  dirEn: string, dirHi: string,
): HintTriple => ({
  orient:   { en: orientEn, hi: orientHi },
  strategy: { en: stratEn,  hi: stratHi },
  directed: { en: dirEn,    hi: dirHi },
});

export const HINTS: Partial<Record<SkillId, HintTriple>> = {
  'add.within10': H(
    'How many are there altogether?', 'कुल कितने हैं?',
    'Start at the bigger number and count on.', 'बड़ी संख्या से शुरू करके आगे गिनें।',
    'Hold the bigger number in your head, then count on using your fingers.',
    'बड़ी संख्या मन में रखें, फिर उँगलियों पर आगे गिनें।',
  ),
  'add.within20': H(
    'Can you make a ten first?', 'क्या पहले दस बना सकते हैं?',
    'Split the smaller number so one part fills up to ten.',
    'छोटी संख्या को ऐसे बाँटें कि एक भाग से दस पूरे हो जाएँ।',
    'Fill up to ten, then add whatever is left over.',
    'पहले दस पूरे करें, फिर बचा हुआ जोड़ें।',
  ),
  'add.2digit.carry': H(
    'Which column do you add first?', 'पहले कौन-सा स्तंभ जोड़ेंगे?',
    'Add the ones. If they make ten or more, a ten carries over.',
    'इकाई जोड़ें। अगर दस या अधिक हों तो एक दहाई आगे जाती है।',
    'Write the carried 1 above the tens column before you add it.',
    'दहाई जोड़ने से पहले हासिल का 1 ऊपर लिखें।',
  ),
  'sub.2digit.borrow': H(
    'Is the top digit big enough to take from?',
    'क्या ऊपर का अंक घटाने के लिए काफ़ी बड़ा है?',
    'When the top ones digit is smaller, exchange one ten for ten ones.',
    'जब ऊपर की इकाई छोटी हो, एक दहाई को दस इकाइयों में बदलें।',
    'Cross out the tens digit, make it one less, and add ten to the ones.',
    'दहाई का अंक काटकर एक कम करें, और इकाई में दस जोड़ें।',
  ),
  'mul.tables.mid': H(
    'What does this multiplication mean?', 'इस गुणा का अर्थ क्या है?',
    'It is repeated addition — equal groups added together.',
    'यह बार-बार जोड़ है — बराबर समूहों को जोड़ना।',
    'Skip count in steps of the smaller number, as many times as the larger.',
    'छोटी संख्या की छलांग में, बड़ी संख्या जितनी बार गिनें।',
  ),
  'div.basic': H(
    'Are you sharing out, or making groups?',
    'बराबर बाँट रहे हैं या समूह बना रहे हैं?',
    'Ask how many of the smaller number fit inside the larger one.',
    'पूछें कि बड़ी संख्या में छोटी संख्या कितनी बार आती है।',
    'Use the times table of the divisor and count up to the total.',
    'भाजक का पहाड़ा लें और कुल तक गिनते जाएँ।',
  ),
  'frac.ofAmount': H(
    'What does the bottom number tell you?', 'नीचे की संख्या क्या बताती है?',
    'The bottom number says how many equal parts to split into.',
    'नीचे की संख्या बताती है कि कितने बराबर भागों में बाँटना है।',
    'Divide by the bottom number to find one part, then multiply by the top.',
    'नीचे की संख्या से भाग देकर एक भाग निकालें, फिर ऊपर वाली से गुणा करें।',
  ),
  'frac.addSameDenom': H(
    'What stays the same when you add fractions?',
    'भिन्न जोड़ते समय क्या नहीं बदलता?',
    'The denominator names the size of each piece — it does not change.',
    'हर टुकड़े का आकार हर बताता है — वह नहीं बदलता।',
    'Add only the top numbers and keep the bottom number as it is.',
    'केवल ऊपर की संख्याएँ जोड़ें, नीचे की वैसी ही रखें।',
  ),
  'dec.tenths': H(
    'Which digit is worth the most?', 'कौन-सा अंक सबसे बड़ा मान रखता है?',
    'Compare place by place, starting from the left.',
    'बाएँ से शुरू करके स्थान दर स्थान तुलना करें।',
    'Line up the decimal points and compare the tenths first.',
    'दशमलव बिंदु सीध में रखें और पहले दहाईवें की तुलना करें।',
  ),
  'placevalue': H(
    'What does each digit stand for here?',
    'यहाँ हर अंक किसका मान बता रहा है?',
    'Read the columns from the right: ones, tens, hundreds.',
    'दाएँ से स्तंभ पढ़ें: इकाई, दहाई, सैकड़ा।',
    'Count the columns from the right to find which place the digit sits in.',
    'दाएँ से स्तंभ गिनकर पता करें कि अंक किस स्थान पर है।',
  ),
  'percent.basic': H(
    'What is a percentage a fraction of?', 'प्रतिशत किसका भाग होता है?',
    'Per cent means "out of a hundred".', 'प्रतिशत का अर्थ है "सौ में से"।',
    'Find 10% first by dividing by ten, then scale to what you need.',
    'पहले दस से भाग देकर 10% निकालें, फिर उसे बढ़ाएँ।',
  ),
  'numsense.estimate': H(
    'Do you need the exact answer here?',
    'क्या यहाँ सटीक उत्तर चाहिए?',
    'Round each number to something easy before you work with it.',
    'काम शुरू करने से पहले हर संख्या को आसान संख्या तक पूर्णांकित करें।',
    'Round to the nearest ten, then work with the rounded numbers.',
    'निकटतम दहाई तक पूर्णांकित करें, फिर उन्हीं से काम करें।',
  ),
  'geometry.basic': H(
    'Are you covering the shape or walking around it?',
    'आकृति भर रहे हैं या उसके चारों ओर चल रहे हैं?',
    'Perimeter is the distance round the edge; area is the space inside.',
    'परिमाप किनारे की लंबाई है; क्षेत्रफल अंदर की जगह है।',
    'For area multiply the sides; for perimeter add all the way round.',
    'क्षेत्रफल के लिए भुजाएँ गुणा करें; परिमाप के लिए सब जोड़ें।',
  ),
  'wordproblems': H(
    'What is the story actually asking?', 'कहानी असल में क्या पूछ रही है?',
    'Decide whether things are being combined, taken away, grouped or shared.',
    'तय करें कि चीज़ें मिलाई जा रही हैं, हटाई जा रही हैं, समूह बन रहे हैं या बाँटी जा रही हैं।',
    'Write the numbers down with the operation between them before working it out.',
    'हल करने से पहले संख्याओं के बीच संक्रिया लिखें।',
  ),
  'patterns.basic': H(
    'What changes from one term to the next?',
    'एक पद से अगले तक क्या बदलता है?',
    'Write the gaps between the terms underneath.',
    'पदों के बीच के अंतर नीचे लिखें।',
    'If the gaps are equal it is adding; if they grow, the rule is different.',
    'अगर अंतर बराबर हैं तो जोड़ है; अगर बढ़ते हैं तो नियम अलग है।',
  ),
};

/** Family fallbacks, so a skill without its own copy still gets sensible hints. */
const FAMILY: [RegExp, SkillId][] = [
  [/^add\.(3digit|large)/, 'add.2digit.carry'],
  [/^add\.2digit\.nocarry/, 'add.2digit.carry'],
  [/^sub\.(3digit|large|2digit\.noborrow)/, 'sub.2digit.borrow'],
  [/^sub\.within/, 'add.within20'],
  [/^mul\.(tables|2digit|large)/, 'mul.tables.mid'],
  [/^div\./, 'div.basic'],
  [/^frac\.equivalence/, 'frac.addSameDenom'],
  [/^dec\./, 'dec.tenths'],
  [/^numsense\./, 'numsense.estimate'],
  [/^symmetry\./, 'geometry.basic'],
  [/^algebra\./, 'patterns.basic'],
];

export function hintsFor(skill: SkillId): HintTriple | null {
  if (HINTS[skill]) return HINTS[skill]!;
  for (const [re, target] of FAMILY) {
    if (re.test(skill) && HINTS[target]) return HINTS[target]!;
  }
  return null;
}

/** The line to show at a given level, or null. */
export function hintText(skill: SkillId, level: HintLevel, lang: Lang): string | null {
  if (level === 0) return null;
  const t = hintsFor(skill);
  if (!t) return null;
  const entry = level === 1 ? t.orient : level === 2 ? t.strategy : t.directed;
  return lang === 'hi' ? entry.hi : entry.en;
}

/** Skills with hint copy, for coverage reporting. */
export const HINTED_SKILLS = Object.keys(HINTS);
