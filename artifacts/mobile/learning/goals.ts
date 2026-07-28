// ─── Daily practice goal ─────────────────────────────────────────────────────
// docs/28 item 52.
//
// A goal a child sets is a commitment; a goal handed to them is a demand. The
// options are deliberately all achievable in one ordinary sitting — a target
// that can be missed by being busy teaches that practice is a debt.
//
// Pure module rather than living in GameContext: the context is a .tsx file,
// so anything importing it drags React into a domain layer and cannot be unit
// tested.

/** Default when the child has not chosen. */
export const DAILY_GOAL = 10;

/** The targets a child may pick. Ordered, distinct, all reachable. */
export const GOAL_CHOICES = [5, 10, 20] as const;

export type GoalChoice = (typeof GOAL_CHOICES)[number];

export const GOAL_KEY = '@maths_workout_daily_goal';

/** Validate a stored value, falling back to the default. */
export function normaliseGoal(value: unknown): number {
  const n = Number(value);
  return (GOAL_CHOICES as readonly number[]).includes(n) ? n : DAILY_GOAL;
}
