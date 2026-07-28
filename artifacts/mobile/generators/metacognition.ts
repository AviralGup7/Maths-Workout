// ─── Metacognitive question formats ──────────────────────────────────────────
// docs/27 P1-14 (method comparison) and P1-15 (reasoning selection).
//
// Every format in the bank until now asked the child to EXECUTE a procedure.
// These two ask them to evaluate one. That is a different construct, and the
// evidence base for it is unusually strong:
//
//   · Rittle-Johnson & Star (2007): comparing two worked methods side by side
//     produces larger gains in procedural flexibility AND conceptual knowledge
//     than studying the same two methods sequentially. The comparison is the
//     active ingredient, not the exposure.
//   · Selecting a justification separates children who know *that* a rule
//     works from those who know *why*. Both groups answer "48 ÷ 6 = ?"
//     identically; they diverge the moment they are asked how they know.
//
// Both formats stay inside docs/14's D5 constraint — gradeable offline and
// deterministically — because the child selects rather than writes.

import type { SchoolClass, Difficulty, Question } from './types';
import { ri, pick, shuffleArr, makeStrChoices } from './helpers';
import type { Lang } from '../i18n/strings';

function classNumber(cls: SchoolClass): number {
  return ['1st', '2nd', '3rd', '4th', '5th', '6th'].indexOf(cls) + 1;
}

function twoNames(lang: Lang): [string, string] {
  const pool = lang === 'hi'
    ? ['प्रिया', 'आरव', 'मीरा', 'कबीर', 'दिया', 'रोहन']
    : ['Priya', 'Aarav', 'Meera', 'Kabir', 'Diya', 'Rohan'];
  const s = shuffleArr(pool);
  return [s[0], s[1]];
}

// ─── P1-14 · Method comparison ───────────────────────────────────────────────

/**
 * Two children, two correct methods, one question: which is quicker here?
 *
 * The critical design decision: BOTH methods are correct. A comparison where
 * one method is wrong collapses into error-hunting, which the app already has
 * — and it teaches that non-standard methods are mistakes, which is the exact
 * belief that stops children inventing strategies.
 *
 * What varies is *efficiency for this particular question*, so the answer is
 * genuinely question-dependent: rounding-and-adjusting beats column addition
 * for 199 + 47 and loses for 342 + 176. A child who has learned "compensation
 * is always faster" is wrong, and the generator will catch them.
 */
export function genMethodCompare(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  const n = classNumber(cls);
  const hi = lang === 'hi';
  const [nameA, nameB] = twoNames(lang);

  type Cmp = { text: string; a: string; b: string; quicker: 'a' | 'b'; why: string };
  const builders: (() => Cmp)[] = [];

  // Compensation vs column addition, near a round number.
  builders.push(() => {
    const near = pick([99, 98, 199, 198]).valueOf();
    const other = ri(23, 68);
    return {
      text: `${near} + ${other}`,
      a: hi ? `${near} + ${other} को अंकों में जोड़ा`
            : `Added the columns: ones, then tens, then hundreds`,
      b: hi ? `${near + 1} + ${other} = ${near + 1 + other}, फिर 1 घटाया`
            : `Did ${near + 1} + ${other} = ${near + 1 + other}, then took 1 away`,
      quicker: 'b',
      why: hi ? `${near} गोल संख्या के बहुत पास है`
              : `${near} is very close to a round number`,
    };
  });

  // The same comparison where compensation is NOT the quicker route. Without
  // this the correct strategy is "always pick the clever-looking one".
  builders.push(() => {
    const a = ri(342, 468);
    const b = ri(213, 356);
    return {
      text: `${a} + ${b}`,
      a: hi ? `अंकों में जोड़ा: इकाई, दहाई, सैकड़ा`
            : `Added the columns: ones, then tens, then hundreds`,
      b: hi ? `${a} को 500 तक बढ़ाया, जोड़ा, फिर ${500 - a} घटाया`
            : `Rounded ${a} up to 500, added, then took ${500 - a} away`,
      quicker: 'a',
      why: hi ? `${a} किसी गोल संख्या के पास नहीं है, इसलिए सुधार करना ही मुश्किल है`
              : `${a} is not near a round number, so the adjustment is the hard part`,
    };
  });

  // Doubling vs repeated addition.
  if (n >= 2) {
    builders.push(() => {
      const k = pick([6, 7, 8, 9]);
      return {
        text: `${k} × 4`,
        a: hi ? `${k} को चार बार जोड़ा` : `Added ${k} four times`,
        b: hi ? `${k} का दुगुना ${k * 2}, फिर उसका दुगुना ${k * 4}`
              : `Doubled ${k} to get ${k * 2}, then doubled again to get ${k * 4}`,
        quicker: 'b',
        why: hi ? '×4 का मतलब है दो बार दुगुना — दो कदम, चार नहीं'
                : '×4 is two doublings — two steps instead of four additions',
      };
    });
  }

  // Distributing vs long multiplication.
  if (n >= 4) {
    builders.push(() => {
      const t = pick([19, 29, 39, 49]);
      const m = ri(3, 8);
      return {
        text: `${t} × ${m}`,
        a: hi ? `${t} × ${m} को लिखकर हल किया`
              : `Set out ${t} × ${m} as a written multiplication`,
        b: hi ? `${t + 1} × ${m} = ${(t + 1) * m}, फिर ${m} घटाया`
              : `Did ${t + 1} × ${m} = ${(t + 1) * m}, then took ${m} away`,
        quicker: 'b',
        why: hi ? `${t + 1} से गुणा करना मन में हो जाता है`
                : `${t + 1} × ${m} can be done in your head`,
      };
    });
  }

  // Simplify-first vs multiply-then-simplify.
  if (n >= 5) {
    builders.push(() => {
      const d = pick([4, 6, 8]);
      const total = d * pick([6, 9, 12]);
      return {
        text: hi ? `${total} का ${2}/${d}` : `${2}/${d} of ${total}`,
        a: hi ? `${total} × 2 = ${total * 2}, फिर ${d} से भाग`
              : `Did ${total} × 2 = ${total * 2}, then divided by ${d}`,
        b: hi ? `पहले ${d} से भाग: ${total / d}, फिर × 2`
              : `Divided by ${d} first to get ${total / d}, then × 2`,
        quicker: 'b',
        why: hi ? 'पहले भाग देने से संख्याएँ छोटी रहती हैं'
                : 'Dividing first keeps the numbers small',
      };
    });
  }

  const c = pick(builders)();
  const labelA = hi ? `${nameA} का तरीका` : `${nameA}'s way`;
  const labelB = hi ? `${nameB} का तरीका` : `${nameB}'s way`;
  const both = hi ? 'दोनों बराबर तेज़ हैं' : 'Both take about the same time';

  const answer = c.quicker === 'a' ? labelA : labelB;

  return {
    questionText:
      (hi ? `${c.text}\n\n${nameA}: ${c.a}\n${nameB}: ${c.b}\n\nइस सवाल के लिए कौन-सा तरीका तेज़ है?`
          : `${c.text}\n\n${nameA}: ${c.a}\n${nameB}: ${c.b}\n\nFor THIS question, whose way is quicker?`),
    answer,
    // Both methods are correct, so "neither is wrong" must not be offered as
    // an escape — the question is about efficiency, and a child who reads it
    // as a correctness question should find no tile that rewards that reading.
    choices: shuffleArr([labelA, labelB, both]),
    resolvedCategory: 'number_sense',
  };
}

// ─── P1-15 · Reasoning selection ─────────────────────────────────────────────

/**
 * Pick the justification, not the answer.
 *
 * The answer is given in the stem. That is deliberate and is what makes the
 * item work: with nothing left to compute, the only thing being measured is
 * whether the child can say why it is true.
 *
 * Distractors are the three failure modes that matter, and they are chosen
 * per item rather than generically:
 *   · a TRUE statement that does not justify this answer (relevance)
 *   · a restatement of the answer dressed as a reason (circularity)
 *   · a real misconception phrased confidently (the diagnostic one)
 */
export function genReasonSelect(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  const n = classNumber(cls);
  const hi = lang === 'hi';

  type Reason = { stem: string; right: string; wrong: string[] };
  const builders: (() => Reason)[] = [];

  // Why does the answer to a borrow subtraction end in that digit?
  builders.push(() => {
    const a = ri(52, 94);
    const b = ri(15, 39);
    const ans = a - b;
    return {
      stem: hi ? `${a} − ${b} = ${ans}.\nयह कैसे पता चलता है कि उत्तर सही है?`
               : `${a} − ${b} = ${ans}.\nHow do you know that is right?`,
      right: hi ? `क्योंकि ${ans} + ${b} = ${a}` : `Because ${ans} + ${b} = ${a}`,
      wrong: [
        hi ? `क्योंकि ${a} ${b} से बड़ा है` : `Because ${a} is bigger than ${b}`,
        hi ? `क्योंकि घटाने पर उत्तर छोटा होता है` : `Because subtracting always makes it smaller`,
        hi ? `क्योंकि ${a} − ${b} यही होता है` : `Because ${a} − ${b} just is ${ans}`,
      ],
    };
  });

  // Even/odd structure.
  if (n >= 3) {
    builders.push(() => {
      const a = ri(3, 9) * 2 + 1;
      const b = ri(3, 9) * 2 + 1;
      return {
        stem: hi ? `${a} + ${b} = ${a + b}, जो सम संख्या है।\nदो विषम संख्याओं का जोड़ हमेशा सम क्यों होता है?`
                 : `${a} + ${b} = ${a + b}, an even number.\nWhy is an odd number plus an odd number always even?`,
        right: hi ? 'दोनों में एक-एक बचता है, और वे दोनों मिलकर एक जोड़ा बना लेते हैं'
                  : 'Each one has a leftover of 1, and the two leftovers pair up',
        wrong: [
          hi ? `क्योंकि ${a + b} सम है` : `Because ${a + b} is even`,
          hi ? 'क्योंकि विषम संख्याएँ बड़ी होती हैं' : 'Because odd numbers are bigger',
          hi ? 'क्योंकि जोड़ने पर हमेशा सम संख्या आती है' : 'Because adding always gives an even number',
        ],
      };
    });
  }

  // Equivalent fractions.
  if (n >= 4) {
    builders.push(() => {
      const k = pick([2, 3, 4]);
      return {
        stem: hi ? `1/2 और ${k}/${k * 2} बराबर हैं।\nक्यों?`
                 : `1/2 and ${k}/${k * 2} are equal.\nWhy?`,
        right: hi ? `ऊपर और नीचे दोनों को ${k} से गुणा किया गया — टुकड़े छोटे हुए पर उतने ही ज़्यादा`
                  : `Both parts were multiplied by ${k} — smaller pieces, but proportionally more of them`,
        wrong: [
          hi ? `क्योंकि ${k * 2} 2 से बड़ा है` : `Because ${k * 2} is bigger than 2`,
          hi ? `क्योंकि ऊपर और नीचे में ${k * 2 - k} का अंतर है`
             : `Because the top and bottom differ by ${k * 2 - k}`,
          hi ? 'क्योंकि दोनों भिन्न हैं' : 'Because they are both fractions',
        ],
      };
    });
  }

  // Multiplying by a number less than 1 — the classic "multiplication makes
  // bigger" misconception, phrased confidently as a distractor.
  if (n >= 5) {
    builders.push(() => {
      const w = ri(4, 9) * 10;
      return {
        stem: hi ? `${w} × 0.5 = ${w * 0.5}, जो ${w} से छोटा है।\nगुणा करने पर उत्तर छोटा कैसे हो गया?`
                 : `${w} × 0.5 = ${w * 0.5}, which is smaller than ${w}.\nHow can multiplying make it smaller?`,
        right: hi ? 'क्योंकि 0.5 का मतलब है आधा — हम ${w} का आधा ले रहे हैं'.replace('${w}', String(w))
                  : `Because 0.5 means a half — we are taking half of ${w}`,
        wrong: [
          hi ? 'गुणा में गलती हुई होगी' : 'There must be a mistake — multiplying makes things bigger',
          hi ? 'क्योंकि 0.5 एक दशमलव है' : 'Because 0.5 is a decimal',
          hi ? `क्योंकि ${w * 0.5} ${w} से छोटा है` : `Because ${w * 0.5} is less than ${w}`,
        ],
      };
    });
  }

  // Area vs perimeter — the most persistent geometry confusion in the library.
  if (n >= 4) {
    builders.push(() => {
      const s = ri(4, 9);
      return {
        stem: hi ? `${s} भुजा वाले वर्ग का क्षेत्रफल ${s * s} है, परिमाप ${s * 4}।\nक्षेत्रफल के लिए गुणा और परिमाप के लिए जोड़ क्यों?`
                 : `A square of side ${s} has area ${s * s} and perimeter ${s * 4}.\nWhy multiply for one and add for the other?`,
        right: hi ? 'क्षेत्रफल भीतर के वर्गों की गिनती है; परिमाप किनारे की लंबाई है'
                  : 'Area counts the squares inside; perimeter measures the distance around the edge',
        wrong: [
          hi ? 'क्योंकि क्षेत्रफल हमेशा बड़ा होता है' : 'Because area is always the bigger number',
          hi ? 'क्योंकि वर्ग की चार भुजाएँ होती हैं' : 'Because a square has four sides',
          hi ? 'क्योंकि नियम यही है' : 'Because that is the rule',
        ],
      };
    });
  }

  const r = pick(builders)();
  return {
    questionText: r.stem,
    answer: r.right,
    choices: makeStrChoices(r.right, [r.right, ...r.wrong]),
    resolvedCategory: 'number_sense',
  };
}
