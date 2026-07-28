// ─── Early Years generators (Class 1–2 focus) ────────────────────────────────
// Covers: counting, number sense
// Curriculum alignment:
//   Class 1: count objects 1–10 (easy), 1–20 (medium), skip-count by 2s/5s/10s (hard)
//   Number sense scaled to class — Class 1/2 within 20, Class 3+ within 999

import { SchoolClass, Difficulty, Question } from './types';
import { ri, pick, shuffleArr, makeIntChoices } from './helpers';

/** Countable glyphs that render identically on every platform. */
const SHAPES = ['●', '▲', '■', '◆', '★'];
import type { Lang } from '../i18n/strings';
import { qp } from '../i18n/questions';

export function genCounting(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  if (diff === 'hard') {
    // Skip counting — step size scales with class
    const stepOptions = cls === '1st' || cls === '2nd' ? [2, 5, 10] : [3, 4, 6, 7, 8, 9, 10, 25, 100];
    const steps = pick(stepOptions);
    const start = ri(1, 4) * steps;
    const count = ri(3, 6);
    const seq = Array.from({ length: count }, (_, i) => start + i * steps);
    return {
      questionText: `${qp('countBySeq', lang, steps)}\n${seq.join(', ')}, ___`,
      answer: start + count * steps,
      choices: makeIntChoices(start + count * steps),
    };
  }

  if (diff === 'medium') {
    // docs/28: these were emoji (🍎 ⭐). Emoji render differently on every OS,
    // cannot be styled to the theme and are not a designed asset — the app had
    // delegated its most important early-years visual to the platform. These
    // geometric glyphs are identical everywhere, and the ten-frame beneath the
    // question now carries the real pedagogical work.
    const e = pick(SHAPES);
    // Class 1: count up to 15; Class 2+: up to 20
    const n = cls === '1st' ? ri(10, 15) : ri(10, 20);
    return { questionText: `${qp('howManyOf', lang, e)}\n${e.repeat(n)}`, answer: n, choices: makeIntChoices(n) };
  }

  // Easy: count small objects — Class 1 stays within 10
  const n = cls === '1st' ? ri(1, 10) : ri(1, 15);
  const e = pick(SHAPES);
  return { questionText: `${qp('howManyOf', lang, e)}\n${e.repeat(n)}`, answer: n, choices: makeIntChoices(n) };
}

export function genNumberSense(cls: SchoolClass, diff: Difficulty, lang: Lang = 'en'): Question {
  // Number ranges scale with class level
  const isEarly = cls === '1st' || cls === '2nd';
  const max = isEarly ? 20 : cls === '3rd' ? 99 : 999;

  if (diff === 'hard') {
    // Ordering / number patterns
    if (isEarly) {
      // Class 1/2: arrange 4 single/double digit numbers, find smallest
      const arr = shuffleArr([ri(1, 20), ri(1, 20), ri(1, 20), ri(1, 20)]);
      while (new Set(arr).size < 4) arr[ri(0, 3)] = ri(1, 20);
      const sorted = [...arr].sort((a, b) => a - b);
      return {
        questionText: `${qp('orderSmallest', lang)}\n${arr.join('  ')}`,
        answer: sorted[0],
        choices: makeIntChoices(sorted[0]),
      };
    }
    const arr = shuffleArr([ri(10, max), ri(10, max), ri(10, max), ri(10, max)]);
    while (new Set(arr).size < 4) arr[ri(0, 3)] = ri(10, max);
    const sorted = [...arr].sort((a, b) => a - b);
    return {
      questionText: `${qp('orderWhatSmall', lang)}\n${arr.join('  ')}`,
      answer: sorted[0],
      choices: makeIntChoices(sorted[0]),
    };
  }

  // Class 1/2 templates use small numbers
  if (isEarly) {
    const templates = [
      () => {
        const a = ri(1, max); let b = ri(1, max); if (a === b) b = b < max ? b + 1 : b - 1;
        const bigger = Math.max(a, b);
        return { questionText: `${qp('whichIsBigger', lang)}\n${a}   or   ${b}`, answer: bigger, choices: makeIntChoices(bigger) };
      },
      () => { const n = ri(0, max - 1); return { questionText: qp('comesAfter', lang, n), answer: n + 1, choices: makeIntChoices(n + 1) }; },
      () => { const n = ri(1, max); return { questionText: qp('oneMoreThan', lang, n), answer: n + 1, choices: makeIntChoices(n + 1) }; },
      () => { const n = ri(2, max); return { questionText: qp('comesBefore', lang, n), answer: n - 1, choices: makeIntChoices(n - 1) }; },
    ];
    return pick(diff === 'easy' ? templates.slice(0, 3) : templates)();
  }

  // Class 3+ templates include 10-less, place value awareness
  const templates = [
    () => { const a = ri(1, max); let b = ri(1, max); if (a === b) b = b < max ? b + 1 : b - 1; const bigger = Math.max(a, b); return { questionText: `${qp('whichIsBigger', lang)}\n${a}   or   ${b}`, answer: bigger, choices: makeIntChoices(bigger) }; },
    () => { const n = ri(0, max - 1); return { questionText: qp('comesAfter', lang, n), answer: n + 1, choices: makeIntChoices(n + 1) }; },
    () => { const n = ri(1, max); return { questionText: qp('oneMoreThan', lang, n), answer: n + 1, choices: makeIntChoices(n + 1) }; },
    () => { const n = ri(10, max); return { questionText: qp('tenLessThan', lang, n), answer: n - 10, choices: makeIntChoices(n - 10) }; },
    () => { const n = ri(2, max); return { questionText: qp('comesBefore', lang, n), answer: n - 1, choices: makeIntChoices(n - 1) }; },
  ];
  return pick(diff === 'easy' ? templates.slice(0, 3) : templates.slice(1, 4))();
}
