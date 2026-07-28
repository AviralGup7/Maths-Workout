// ─── Self-explanation ────────────────────────────────────────────────────────
// docs/27 P1-13.
//
// docs/26 measured zero questions in 126,000 asking a child to explain
// anything, against a body of evidence (Chi et al. and successors) in which
// self-explanation carries one of the largest effect sizes available in
// instructional research. Explaining a step produces more learning than being
// told it — which is exactly what this app does today: it diagnoses the
// misconception precisely and then hands the child the answer.
//
// ── Why selectable reasons rather than free text ────────────────────────────
//
// Free-text explanation was rejected early on, and correctly: it cannot be graded
// offline, deterministically, or equally across two languages, and shipping it
// ungraded would be theatre. But that rejection was of the INPUT METHOD, not
// of the pedagogy, and the two got conflated.
//
// The misconception taxonomy already enumerates the plausible wrong reasonings
// for every skill — 35 of them, covering 45 of 45 skills. That is exactly the
// option set a selectable self-explanation needs, and it is already written,
// already bilingual, and already diagnosed per answer. The child picks *why*
// they think it went wrong from real candidates, which is retrieval of the
// reasoning rather than recognition of the answer.
//
// ── Why it must be rare ─────────────────────────────────────────────────────
//
// A prompt on every mistake would double the length of a bad session and turn
// a struggling child's practice into an interrogation. It fires on the errors
// where understanding the cause actually changes what happens next: a
// diagnosed misconception, not a slip.

import type { SkillId } from './skills';
import { MISCONCEPTIONS } from './misconceptions';
import { MISCONCEPTIONS_HI } from '../i18n/misconceptions-hi';
import type { Attempt } from './attempts';
import type { Lang } from '../i18n/strings';

/** Consecutive-answer distance before the same skill may prompt again. */
export const SE_COOLDOWN_ATTEMPTS = 12;

/** Most prompts a single session may show, however many mistakes are made. */
export const SE_MAX_PER_SESSION = 2;

/** Options offered, including the true diagnosis. */
export const SE_OPTION_COUNT = 3;

export interface SelfExplanationOption {
  /** Misconception id, or `'slip'` for the careless-mistake option. */
  id: string;
  text: { en: string; hi: string };
  /** True when this is the diagnosis the engine actually made. */
  correct: boolean;
}

export interface SelfExplanationPrompt {
  skill: SkillId;
  question: { en: string; hi: string };
  options: SelfExplanationOption[];
}

/**
 * "I just wasn't careful" — always offered, and frequently true.
 *
 * Without it the prompt forces a child to claim a conceptual error they may
 * not have made, which would both annoy them and pollute the signal. A learner
 * who genuinely slipped should be able to say so.
 */
const SLIP_OPTION: SelfExplanationOption = {
  id: 'slip',
  text: {
    en: 'I knew it — I just slipped',
    hi: 'मुझे आता था — बस चूक हो गई',
  },
  correct: false,
};

const PROMPT_COPY = {
  en: 'Before we look — what do you think went wrong?',
  hi: 'देखने से पहले — आपको क्या लगता है कि क्या गड़बड़ हुई?',
};

/**
 * Should we ask the learner to explain this error?
 *
 * Deliberately conservative. Every gate has a reason:
 *
 *  · a diagnosed misconception — a slip has no reasoning worth retrieving
 *  · session budget            — practice, not interrogation
 *  · per-skill cooldown        — the same question twice in five minutes is
 *                                nagging, and the second answer is a guess
 */
export function shouldAskWhy(args: {
  misconception: string | null | undefined;
  skill: SkillId;
  /** Attempts recorded so far this session, oldest first. */
  sessionLog: Attempt[];
  /** How many prompts have already been shown this session. */
  shownThisSession: number;
}): boolean {
  const { misconception, skill, sessionLog, shownThisSession } = args;
  if (!misconception) return false;
  if (misconception === 'legacy-import' || misconception === 'guessing') return false;
  if (!MISCONCEPTIONS[misconception]) return false;
  if (shownThisSession >= SE_MAX_PER_SESSION) return false;

  // Cooldown: how long since this skill last appeared at all.
  const sinceSkill = [...sessionLog].reverse().findIndex(a => a.skill === skill);
  if (sinceSkill >= 0 && sinceSkill < SE_COOLDOWN_ATTEMPTS && sessionLog.length > SE_COOLDOWN_ATTEMPTS) {
    return false;
  }
  return true;
}

/**
 * Build the prompt for a diagnosed error.
 *
 * Distractors are drawn from OTHER misconceptions on the same skill wherever
 * possible. That matters: choosing between three plausible reasonings about
 * the same mathematics is a genuine discrimination, whereas choosing between
 * one plausible reason and two irrelevant ones is a reading exercise.
 */
export function buildWhyPrompt(args: {
  skill: SkillId;
  misconception: string;
  /** Injected for determinism in tests. */
  shuffle?: <T>(xs: T[]) => T[];
}): SelfExplanationPrompt | null {
  const { skill, misconception, shuffle = defaultShuffle } = args;
  const truth = MISCONCEPTIONS[misconception];
  if (!truth) return null;

  const sameSkill = Object.values(MISCONCEPTIONS)
    .filter(m => m.id !== truth.id && m.skills.includes(skill));
  const others = sameSkill.length > 0
    ? sameSkill
    : Object.values(MISCONCEPTIONS).filter(m => m.id !== truth.id);

  const distractors = shuffle(others).slice(0, Math.max(0, SE_OPTION_COUNT - 2));

  // The Hindi label comes from MISCONCEPTIONS_HI, not from the English one.
  // This previously read `hi: truth.label`, so a Hindi-medium child met a
  // Hindi prompt with English options — "Miscounting by one" next to
  // "मुझे आता था — बस चूक हो गई". The translations already existed for all 47
  // misconceptions; nothing consulted them here. Found by photographing the
  // Hindi render, not by any unit test.
  const label = (m: { id: string; label: string }) => ({
    en: m.label,
    hi: MISCONCEPTIONS_HI[m.id]?.label ?? m.label,
  });

  const options: SelfExplanationOption[] = [
    { id: truth.id, text: label(truth), correct: true },
    ...distractors.map(m => ({ id: m.id, text: label(m), correct: false })),
    SLIP_OPTION,
  ];

  return { skill, question: PROMPT_COPY, options: shuffle(options) };
}

function defaultShuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Feedback after the learner commits to an explanation.
 *
 * Never says "wrong". Identifying your own error is hard and getting it
 * imperfectly right is still an act of reflection worth reinforcing — telling
 * a child they were wrong about being wrong is the fastest way to stop them
 * engaging with the prompt at all.
 */
export function whyFeedback(
  chosen: SelfExplanationOption | null,
  prompt: SelfExplanationPrompt,
  lang: Lang,
): string {
  const hi = lang === 'hi';
  const truth = prompt.options.find(o => o.correct);
  if (chosen?.correct) {
    return hi ? 'बिलकुल — आपने ख़ुद पहचान लिया।' : 'Exactly — you spotted it yourself.';
  }
  if (chosen?.id === 'slip') {
    return hi
      ? 'हो सकता है। नीचे देखें कि आमतौर पर यहाँ क्या होता है।'
      : 'Could be. Have a look at what usually happens here.';
  }
  const label = truth ? (hi ? truth.text.hi : truth.text.en) : '';
  return hi
    ? `अच्छी सोच। इस बार असल वजह थी: ${label}`
    : `Good thinking. This time it was: ${label}`;
}
