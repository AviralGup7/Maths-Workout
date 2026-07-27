// ─── Level curves ────────────────────────────────────────────────────────────
//
// Four distinct progression tracks, because they answer four different
// questions and conflating them is how progression systems go wrong:
//
//   Player Level    "how much have I done overall?"      — never resets, never
//                                                          decays, purely
//                                                          cumulative
//   Mastery Level   "how good am I actually?"            — CAN go down
//   Chapter Level   "how far through this topic am I?"   — per chapter
//   Course Complete "am I finished?"                     — binary, gated
//
// The separation matters most for the second one. If the only number in the
// product can go down, the app feels punishing. If no number can go down, the
// app lies about ability. Having both — a cumulative effort number that only
// rises, and an honest ability number that moves both ways — lets us be
// truthful about mastery without ever erasing a child's history of effort.

// ─── Player level ────────────────────────────────────────────────────────────

/**
 * Cumulative XP required to *reach* a given player level.
 *
 * Curve: cost(n) = 110 · (n−1)^1.15, SOLVED against simulated honest pace.
 *
 * Rationale for the exponent:
 *   · Linear (n)      → late levels arrive too fast; progression feels weightless
 *   · Quadratic (n²)  → late levels take years; the curve becomes a wall and the
 *                       child stops perceiving movement at all
 *   · n^1.15          → each level costs ~3–5% more than the last: perceptible
 *                       as "getting harder" without ever stalling
 *
 * The exponent was NOT the hard part — the coefficient was. A first pass used
 * 40·n^1.55, which simulation showed put level 10 at 146 days and level 50 at
 * 27 years: a curve that reads as reasonable in the abstract and is grotesque
 * against real earn rates. These parameters were then obtained by least-squares
 * fit against explicit milestone targets, not chosen by feel.
 *
 * Measured against the simulated honest learner (~200 XP/day, 20 questions):
 *   Level  5  ≈  6 days       Level 30 ≈ 1.0 year
 *   Level 10 ≈ 32 days        Level 50 ≈ 3.1 years (a primary-school career)
 *   Level 20 ≈  5 months
 *
 * Milestone targets were set from retention research: a visible early climb
 * (the first week decides whether a child returns), a meaningful one-month
 * marker, and a top end reachable across primary school without ever stalling.
 *
 * Early game is deliberately fast — levels 1–5 inside the first week, because
 * the first week determines whether a child returns at all.
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(110 * Math.pow(level - 1, 1.15));
}

/** Total cumulative XP needed from zero to reach `level`. */
export function cumulativeXpForLevel(level: number): number {
  let total = 0;
  for (let l = 2; l <= level; l++) total += xpForLevel(l);
  return total;
}

export function levelForXp(totalXp: number): { level: number; into: number; needed: number } {
  let level = 1;
  let spent = 0;
  for (;;) {
    const cost = xpForLevel(level + 1);
    if (spent + cost > totalXp) {
      return { level, into: totalXp - spent, needed: cost };
    }
    spent += cost;
    level++;
    if (level > 200) return { level, into: 0, needed: xpForLevel(level + 1) };
  }
}

// ─── Mastery level ───────────────────────────────────────────────────────────

/**
 * The honest ability number. Derived from the mastery model, not from XP,
 * and therefore able to fall when skills decay.
 *
 * Expressed as a 0–100 index over the skills in the learner's current course,
 * weighted so that securing many skills partially beats mastering one utterly
 * — the shape of a well-rounded mathematician rather than a specialist.
 */
export function masteryIndex(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  // Penalise variance slightly: 10 skills at 0.7 beats 5 at 1.0 and 5 at 0.4.
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.round(Math.max(0, mean - variance * 0.25) * 100);
}

export const MASTERY_BANDS = [
  { from: 0,  label: 'Starting out' },
  { from: 25, label: 'Getting steady' },
  { from: 45, label: 'Confident' },
  { from: 65, label: 'Strong' },
  { from: 80, label: 'Secure' },
  { from: 92, label: 'Fluent' },
] as const;

export function masteryBand(index: number): string {
  return [...MASTERY_BANDS].reverse().find(b => index >= b.from)!.label;
}

// ─── Chapter progression ─────────────────────────────────────────────────────

/**
 * Chapter unlock policy.
 *
 * Decision: unlock by **prerequisite mastery**, never by XP.
 *
 * XP is an effort currency. Gating content on effort means a child who grinds
 * enough easy questions unlocks material they cannot do — which is precisely
 * the failure mode the whole design exists to prevent. Mastery gating means the
 * gate asks the only question that matters: *are you ready?*
 *
 * XP therefore unlocks NOTHING pedagogical. It is a record of work done, and a
 * motivational surface. This separation is the single most important structural
 * decision in this document.
 */
export const CHAPTER_UNLOCK_MASTERY = 0.70;   // mean over prerequisite skills
export const CHAPTER_COMPLETE_MASTERY = 0.85; // every skill in the chapter

export type ChapterKind = 'core' | 'review' | 'challenge';

export interface ChapterState {
  id: string;
  kind: ChapterKind;
  skills: string[];
  prerequisiteChapters: string[];
}

export function chapterUnlocked(
  chapter: ChapterState,
  chapters: Record<string, ChapterState>,
  mastery: Record<string, number>,
): boolean {
  return chapter.prerequisiteChapters.every(pid => {
    const p = chapters[pid];
    if (!p) return true;
    const vals = p.skills.map(s => mastery[s] ?? 0);
    if (vals.length === 0) return true;
    return vals.reduce((a, b) => a + b, 0) / vals.length >= CHAPTER_UNLOCK_MASTERY;
  });
}

export function chapterComplete(chapter: ChapterState, mastery: Record<string, number>): boolean {
  return chapter.skills.every(s => (mastery[s] ?? 0) >= CHAPTER_COMPLETE_MASTERY);
}

/**
 * Review chapters unlock on DECAY, not on progress.
 *
 * A review chapter becomes available when its skills have slipped — it is
 * generated by the spaced-repetition model rather than authored. This makes
 * review a living part of the map instead of optional revision nobody opens.
 */
export function reviewChapterDue(
  chapter: ChapterState,
  mastery: Record<string, number>,
  everMastered: Record<string, boolean>,
): boolean {
  return chapter.skills.some(s => everMastered[s] && (mastery[s] ?? 1) < 0.70);
}

/**
 * Challenge chapters require high mastery to ENTER, not to complete.
 *
 * They exist so that a strong learner has somewhere to go that is not "more of
 * the same, faster" — the ceiling problem that makes able children disengage.
 * Deliberately optional: never on the critical path, never required for course
 * completion, so a child who finds them daunting loses nothing.
 */
export const CHALLENGE_ENTRY_MASTERY = 0.88;
