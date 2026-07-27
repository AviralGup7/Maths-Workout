// ─── Celebration rules ───────────────────────────────────────────────────────
// Pure logic, deliberately free of React Native imports so it can be unit
// tested directly.

/**
 * Streak lengths worth marking.
 *
 * Sparse on purpose: celebrating every single day turns the signal into noise,
 * and manufactures the kind of pressure this app should not put on a child.
 */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

export function isStreakMilestone(streak: number): boolean {
  return STREAK_MILESTONES.includes(streak);
}
