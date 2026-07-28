// ─── Skill names in Hindi ────────────────────────────────────────────────────
// docs/28 item 39.
//
// `SKILLS[id].label` is English-only and always has been. That was invisible
// while skill names only appeared in the parent report and the progress list —
// both of which a Hindi-medium child rarely reads — but showing the skill name
// on the question screen puts it in front of them every few seconds.
//
// Semi-Hindi policy applies, and does real work here:
//   · numerals stay Western Arabic — "20 तक जोड़", never "२० तक जोड़"
//   · unit and notation tokens stay Latin — HCF, LCM, x, %
//   · the mathematics is translated; the notation is not
//
// Any id missing from this map falls back to the English label rather than
// rendering blank, so adding a skill can never produce an empty chip.

import type { Lang } from './strings';

/**
 * Deliberately keyed by plain string rather than importing `SkillId`.
 *
 * `i18n` sits at layer 0 and `learning` at layer 2, so importing the type
 * would be an upward dependency — the architecture guard rejected the first
 * version of this file for exactly that. The coverage test asserts this map
 * and `SKILLS` agree in both directions, which is a stronger guarantee than
 * the type would have given: a type only checks the keys that are present,
 * whereas the test also catches a skill that has no translation at all.
 */

export const SKILL_LABELS_HI: Record<string, string> = {
  // Addition
  'add.within10':        '10 तक जोड़',
  'add.within20':        '20 तक जोड़',
  'add.2digit.nocarry':  '2-अंकीय जोड़ (बिना हासिल)',
  'add.2digit.carry':    'हासिल के साथ जोड़',
  'add.3digit':          '3-अंकीय जोड़',
  'add.large':           'बड़ी संख्याओं का जोड़',

  // Subtraction
  'sub.within10':        '10 तक घटाव',
  'sub.within20':        '20 तक घटाव',
  'sub.2digit.noborrow': '2-अंकीय घटाव (बिना उधार)',
  'sub.2digit.borrow':   'उधार के साथ घटाव',
  'sub.3digit':          '3-अंकीय घटाव',
  'sub.large':           'बड़ी संख्याओं का घटाव',

  // Multiplication
  'mul.tables.easy':     'पहाड़े 2, 5, 10',
  'mul.tables.mid':      '10 तक के पहाड़े',
  'mul.tables.full':     '12 तक के पहाड़े',
  'mul.2digit':          '2-अंकीय गुणा',
  'mul.large':           'बड़ी संख्याओं का गुणा',

  // Division
  'div.basic':           '2–5 से भाग',
  'div.tables':          'पहाड़ों से भाग',
  'div.large':           'बड़ी संख्याओं का भाग',

  // Counting and number sense
  'count.objects':       'वस्तुएँ गिनना',
  'count.skip':          'छलांग गिनती',
  'numsense.compare':    'संख्याओं की तुलना',
  'numsense.estimate':   'अनुमान लगाना',
  'numsense.reasonable': 'क्या उत्तर ठीक लगता है?',
  'patterns.basic':      'संख्या पैटर्न',
  'symmetry.basic':      'समरूपता की रेखाएँ',
  'placevalue':          'स्थानीय मान',

  // Fractions and decimals
  'frac.ofAmount':       'किसी संख्या का भिन्न',
  'frac.equivalence':    'तुल्य भिन्न',
  'frac.addSameDenom':   'भिन्न जोड़ (समान हर)',
  'dec.tenths':          'दशमलव — दहाईवाँ',
  'dec.hundredths':      'दशमलव — सौवाँ',

  // Later strands. HCF/LCM stay Latin: they are the notation a child meets in
  // an Indian textbook regardless of medium.
  'percent.basic':       'प्रतिशत',
  'ratio.basic':         'अनुपात',
  'factors.basic':       'गुणनखंड, अभाज्य, HCF और LCM',

  // Geometry
  'geometry.basic':      'क्षेत्रफल, परिमाप और कोण',
  'geometry.area':       'क्षेत्रफल',
  'geometry.perimeter':  'परिमाप',
  'geometry.angles':     'कोण',
  'geometry.volume':     'आयतन',

  // Measurement
  'measurement.basic':   'माप और इकाइयाँ',
  'measurement.length':  'लंबाई की इकाइयाँ',
  'measurement.mass':    'द्रव्यमान की इकाइयाँ',
  'measurement.capacity':'धारिता की इकाइयाँ',

  // Data
  'data.basic':          'माध्य, माध्यिका, बहुलक और परिसर',
  'data.mean':           'माध्य',
  'data.median':         'माध्यिका',
  'data.mode':           'बहुलक',
  'data.range':          'परिसर',

  // Class 6
  'integers.basic':      'धनात्मक और ऋणात्मक संख्याएँ',
  'algebra.basic':       'अज्ञात मान ज्ञात करें',

  // Structure
  'bonds.basic':         'संख्या युग्म',
  'equality.balance':    'बराबर यानी संतुलित',
  'frac.numberline':     'संख्या रेखा पर भिन्न',
  'frac.compare':        'भिन्नों की तुलना',
  'compare.multiplicative': 'कितने गुना',
  'inverse.basic':       'विपरीत संक्रियाएँ',
  'rounding.decide':     'समझदारी से पूर्णांकन',

  // Topics
  'wordproblems':        'शब्द समस्याएँ',
  'shapes.basic':        'आकृतियाँ',
  'time.basic':          'समय देखना',
  'money.basic':         'पैसे और शेष',
};

/**
 * A skill's display name in the active language.
 *
 * Falls back to the English label rather than the raw id, so a skill added
 * without a translation degrades to readable English instead of
 * `add.2digit.carry` appearing on screen.
 */
export function skillLabel(id: string, englishLabel: string, lang: Lang): string {
  if (lang !== 'hi') return englishLabel;
  return SKILL_LABELS_HI[id] ?? englishLabel;
}
