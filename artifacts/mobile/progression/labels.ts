// ─── Bonus copy ──────────────────────────────────────────────────────────────
// Learner-facing names for the bonus events in xp.ts.
//
// Each names the ACHIEVEMENT, not the mechanic: "Breakthrough", never
// "+40 XP threshold bonus". A child should understand what they did, not what
// the economy did. Hindi follows the semi-Hindi policy — these describe
// learning, so they are translated; the numerals beside them are not.

import type { BONUS } from './xp';

export const BONUS_LABEL: Record<keyof typeof BONUS, { en: string; hi: string }> = {
  firstContact:         { en: 'First try',            hi: 'पहली बार' },
  retention:            { en: 'Still remembered',     hi: 'याद रहा' },
  trueRecall:           { en: 'From memory',          hi: 'याद से' },
  recovered:            { en: 'Got it back',          hi: 'फिर से आया' },
  transferAfterTeaching:{ en: 'Used what you learned',hi: 'सीखा हुआ लगाया' },
  breakthrough:         { en: 'Breakthrough',         hi: 'बड़ी छलांग' },
  misconceptionCleared: { en: 'Mistake fixed',        hi: 'गलती सुधरी' },
  mastery:              { en: 'Mastered',             hi: 'पक्का हुआ' },
  chapterMastery:       { en: 'Chapter complete',     hi: 'अध्याय पूरा' },
};
