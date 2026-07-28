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
  // ── Split sub-skills (docs/27 P2-01/02/03) ─────────────────────────────────
  // Each gets its OWN ladder rather than inheriting the parent's via FAMILY.
  // A family fallback here would defeat the split: the reason to separate area
  // from perimeter is that a child confusing them needs to be told something
  // DIFFERENT, and "are you covering the shape or walking around it?" is the
  // question they have already answered wrongly.
  'geometry.area': H(
    'How much space is inside the shape?',
    'आकृति के अंदर कितनी जगह है?',
    'Think of covering the shape with unit squares — how many fit?',
    'सोचें कि आकृति को इकाई वर्गों से भर रहे हैं — कितने आएँगे?',
    'Area of a rectangle is length × width. The answer is in square units.',
    'आयत का क्षेत्रफल = लंबाई × चौड़ाई। उत्तर वर्ग इकाई में आता है।',
  ),
  'geometry.perimeter': H(
    'How far is it all the way round the edge?',
    'किनारे के चारों ओर कुल कितनी दूरी है?',
    'Trace the outside with your finger and add each side as you pass it.',
    'उँगली से बाहरी किनारा घूमें और हर भुजा जोड़ते जाएँ।',
    'Add every side. For a rectangle that is length + width + length + width.',
    'हर भुजा जोड़ें। आयत के लिए लंबाई + चौड़ाई + लंबाई + चौड़ाई।',
  ),
  'geometry.angles': H(
    'What do these angles add up to together?',
    'ये कोण मिलकर कितने बनते हैं?',
    'A right angle is 90°, a straight line 180°, a full turn 360°.',
    'समकोण 90°, सरल रेखा 180°, पूरा चक्कर 360°।',
    'Subtract the angle you know from the total for that shape or line.',
    'उस आकृति या रेखा के कुल में से ज्ञात कोण घटाएँ।',
  ),
  'measurement.length': H(
    'Are you going to a bigger unit or a smaller one?',
    'बड़ी इकाई की ओर जा रहे हैं या छोटी की ओर?',
    'There are a thousand metres in a kilometre, and a hundred centimetres in a metre.',
    'एक किलोमीटर में हज़ार मीटर होते हैं, और एक मीटर में सौ सेंटीमीटर।',
    'To a smaller unit, multiply. To a bigger unit, divide.',
    'छोटी इकाई में जाएँ तो गुणा; बड़ी इकाई में जाएँ तो भाग।',
  ),
  'measurement.mass': H(
    'Are you going to a bigger unit or a smaller one?',
    'बड़ी इकाई की ओर जा रहे हैं या छोटी की ओर?',
    'There are a thousand grams in a kilogram.',
    'एक किलोग्राम में हज़ार ग्राम होते हैं।',
    'kg to g multiplies by 1000; g to kg divides by 1000.',
    'kg से g में ×1000; g से kg में ÷1000।',
  ),
  'measurement.capacity': H(
    'Are you going to a bigger unit or a smaller one?',
    'बड़ी इकाई की ओर जा रहे हैं या छोटी की ओर?',
    'There are a thousand millilitres in a litre.',
    'एक लीटर में हज़ार मिलीलीटर होते हैं।',
    'L to mL multiplies by 1000; mL to L divides by 1000.',
    'L से mL में ×1000; mL से L में ÷1000।',
  ),
  'data.mean': H(
    'If everyone got the same share, how much would each get?',
    'अगर सबको बराबर हिस्सा मिले, तो हर एक को कितना मिलेगा?',
    'Add every value first, then count how many there are.',
    'पहले सब मान जोड़ें, फिर गिनें कि कितने हैं।',
    'Mean = total ÷ how many. Do not forget the dividing step.',
    'माध्य = कुल ÷ संख्या। भाग वाला कदम न भूलें।',
  ),
  'data.median': H(
    'The median is the middle one — but middle of WHAT order?',
    'माध्यिका बीच वाली है — पर किस क्रम के बीच?',
    'Put the numbers in order from smallest to largest first.',
    'पहले संख्याओं को छोटे से बड़े क्रम में रखें।',
    'Once sorted, the median is the value in the middle position.',
    'क्रम में रखने के बाद बीच की स्थिति वाला मान माध्यिका है।',
  ),
  'data.mode': H(
    'Which value turns up most often?',
    'कौन-सा मान सबसे ज़्यादा बार आया है?',
    'Count how many times each different value appears.',
    'गिनें कि हर मान कितनी बार आया है।',
    'The mode is the value itself, not how many times it appeared.',
    'बहुलक वह मान है, न कि वह कितनी बार आया।',
  ),
  'data.range': H(
    'How far apart are the biggest and smallest?',
    'सबसे बड़ा और सबसे छोटा कितनी दूर हैं?',
    'Find the largest value and the smallest value first.',
    'पहले सबसे बड़ा और सबसे छोटा मान खोजें।',
    'Range = largest − smallest. It is one number, not a pair.',
    'परिसर = सबसे बड़ा − सबसे छोटा। यह एक संख्या है, जोड़ी नहीं।',
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

  // ── docs/27 P1-04/P1-05 ────────────────────────────────────────────────────
  // The ten skills that resolved to NO hint even after family fallback. Four of
  // them are Class 1 topics, so the youngest and most support-dependent
  // learners previously had the least support: a six-year-old who could not
  // tell the time simply received more time questions.
  //
  // These are facts and conventions rather than procedures, which is why they
  // correctly have no worked example (see the note above SOLVERS). The hint
  // ladder still applies: orient the child, name a strategy, then direct — the
  // strategy tier is what turns "remember this" into "here is how to work it
  // out", which is the difference between recall and reasoning.

  'count.objects': H(
    'How will you make sure you count each one only once?',
    'आप कैसे पक्का करेंगे कि हर चीज़ एक ही बार गिनी जाए?',
    'Touch or mark each one as you say the number.',
    'हर चीज़ को छूते या निशान लगाते हुए संख्या बोलें।',
    'Go left to right in order, saying one number for each object.',
    'बाएँ से दाएँ क्रम से चलें, हर वस्तु के लिए एक संख्या बोलें।',
  ),
  'count.skip': H(
    'How big is each jump?', 'हर छलांग कितनी बड़ी है?',
    'Find the gap between two numbers, then keep making that same jump.',
    'दो संख्याओं के बीच का अंतर देखें, फिर वही छलांग दोहराते रहें।',
    'Add the jump size to the last number you said.',
    'आपने जो आख़िरी संख्या बोली, उसमें छलांग जोड़ दें।',
  ),
  'shapes.basic': H(
    'What can you count on this shape?',
    'इस आकृति पर आप क्या गिन सकते हैं?',
    'Count the straight sides, then the corners — they match on flat shapes.',
    'सीधी भुजाएँ गिनें, फिर कोने — सपाट आकृतियों में ये बराबर होते हैं।',
    'Trace round the edge with your finger and count each straight side.',
    'उँगली से किनारे पर घूमें और हर सीधी भुजा गिनें।',
  ),
  'time.basic': H(
    'Which hand are you reading?', 'आप कौन-सी सुई पढ़ रहे हैं?',
    'The short hand gives the hour; the long hand counts minutes in fives.',
    'छोटी सुई घंटा बताती है; बड़ी सुई पाँच-पाँच में मिनट गिनती है।',
    'Read the hour first, then count the minutes round in fives from the top.',
    'पहले घंटा पढ़ें, फिर ऊपर से पाँच-पाँच करके मिनट गिनें।',
  ),
  'money.basic': H(
    'Are you putting money together, or finding what is left?',
    'आप पैसे जोड़ रहे हैं या बचा हुआ निकाल रहे हैं?',
    'Change is what is left after you take the cost away from what you paid.',
    'दिए हुए पैसों में से क़ीमत घटाने पर जो बचे, वही बाक़ी है।',
    'Count on from the price up to the amount you handed over.',
    'क़ीमत से शुरू करके दिए हुए पैसों तक आगे गिनें।',
  ),
  'measurement.basic': H(
    'Are you changing to a bigger unit or a smaller one?',
    'आप बड़ी इकाई में बदल रहे हैं या छोटी में?',
    'Smaller units mean more of them, so the number gets bigger.',
    'छोटी इकाई में गिनती बढ़ जाती है, इसलिए संख्या बड़ी होगी।',
    'Multiply when moving to a smaller unit, divide when moving to a bigger one.',
    'छोटी इकाई में जाएँ तो गुणा करें, बड़ी इकाई में जाएँ तो भाग दें।',
  ),
  'factors.basic': H(
    'What divides into this number exactly?',
    'इस संख्या को कौन पूरा-पूरा बाँट देता है?',
    'Try each number in turn and see if it divides with nothing left over.',
    'हर संख्या से बारी-बारी बाँटकर देखें कि कुछ बचता तो नहीं।',
    'Work up in pairs from 1 — each factor has a partner that multiplies to give the number.',
    '1 से जोड़ों में ऊपर बढ़ें — हर गुणनखंड का एक साथी होता है जिससे गुणा करने पर वही संख्या मिलती है।',
  ),
  'ratio.basic': H(
    'How many parts are there altogether?',
    'कुल कितने भाग हैं?',
    'A ratio splits the whole into equal parts — add the numbers to count them.',
    'अनुपात पूरे को बराबर भागों में बाँटता है — संख्याएँ जोड़कर भाग गिनें।',
    'Divide the total by the number of parts to find one part, then scale up.',
    'कुल को भागों की संख्या से बाँटकर एक भाग निकालें, फिर बढ़ाएँ।',
  ),
  'data.basic': H(
    'Which average is the question asking for?',
    'प्रश्न कौन-सा औसत माँग रहा है?',
    'Mean shares out evenly; median is the middle; mode is the most common.',
    'माध्य बराबर बाँटता है; माध्यिका बीच वाली है; बहुलक सबसे अधिक बार आने वाली।',
    'For the median, put the numbers in order first, then find the middle one.',
    'माध्यिका के लिए पहले संख्याएँ क्रम में रखें, फिर बीच वाली चुनें।',
  ),
  'integers.basic': H(
    'Which way along the number line does this move?',
    'यह संख्या रेखा पर किस ओर जाता है?',
    'Negative numbers sit left of zero — further left means smaller.',
    'ऋणात्मक संख्याएँ शून्य के बाएँ होती हैं — जितना बाएँ, उतना छोटा।',
    'Start at the first number and move right to add, left to subtract.',
    'पहली संख्या से शुरू करें; जोड़ने पर दाएँ, घटाने पर बाएँ जाएँ।',
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
