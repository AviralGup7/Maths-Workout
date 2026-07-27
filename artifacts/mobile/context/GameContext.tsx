import React, { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchProgress, pushProgress } from '../lib/progressApi';
import type { ProgressData } from '../lib/progressApi';

// ─── Re-export everything consumers need ────────────────────────────────────
export type {
  SchoolClass, Difficulty, Operation, ChoiceValue, Category, SessionType,
  Question, WrongAnswer, StatEntry, ProgressStats, ClassConfig,
} from '../generators';
export {
  CLASS_CONFIGS, CATEGORY_META, CLASS_TOPICS,
  getAvailableCategories,
  generateQuestion, generateTablesQuestions,
} from '../generators';

// ─── Local imports for context internals ────────────────────────────────────
import type {
  SchoolClass, Difficulty, Category, SessionType,
  Question, WrongAnswer, ProgressStats,
} from '../generators';
import { generateQuestion, generateTablesQuestions } from '../generators';
import { expectedAnswer, pickInteraction, toEntry } from '../generators/interactions';
import {
  genFactorSelect, genPrimeSelect, genMultipleSelect,
  genOrderNumbers, genOrderDecimals, genOrderFractions,
  genMissingNumber, genTableRecall, genDoubleHalve,
} from '../generators/topics-interactive';

// ─── Learning engine (Directions C & D) ─────────────────────────────────────
import type { Attempt } from '../learning/attempts';
import {
  appendAttempts, mergeAttempts, sanitiseLog, deriveLegacyStats,
  migrateLegacyStats, currentStreak, todayCount,
} from '../learning/attempts';
import type { MasteryEstimate } from '../learning/mastery';
import { estimateAll, findRootGap } from '../learning/mastery';
import type { SkillId } from '../learning/skills';
import { resolveSkill, SKILLS } from '../learning/skills';
import { buildSession, categoryForSkill } from '../learning/scheduler';
import { diagnose, summariseMisconceptions } from '../learning/misconceptions';

// ─── Storage keys ─────────────────────────────────────────────────────────
const HIGH_SCORES_KEY    = '@maths_workout_v2_high_scores';
const STATS_KEY          = '@maths_workout_v2_progress_stats';
const TABLES_BEST_KEY    = '@maths_workout_v2_tables_best';
const SAVED_MISTAKES_KEY = '@maths_workout_v2_saved_mistakes';
const DEVICE_ID_KEY      = '@maths_workout_device_id';
const ATTEMPTS_KEY       = '@maths_workout_v3_attempts';
const SCHEMA_VERSION_KEY = '@maths_workout_schema_version';
const CURRENT_SCHEMA     = 3;
/** Daily practice target used for the streak/goal display. */
export const DAILY_GOAL  = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────

function generateDeviceId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function mergeHighScores(
  local: Record<string, number>,
  remote: Record<string, number>,
): Record<string, number> {
  const merged = { ...local };
  for (const [key, val] of Object.entries(remote)) {
    merged[key] = Math.max(merged[key] ?? 0, val);
  }
  return merged;
}

function mergeProgressStats(local: ProgressStats, remote: Record<string, { attempted: number; correct: number }>): ProgressStats {
  const merged: ProgressStats = { ...local };
  for (const [key, val] of Object.entries(remote)) {
    const e = merged[key];
    merged[key] = e
      ? { attempted: Math.max(e.attempted, val.attempted), correct: Math.max(e.correct, val.correct) }
      : val;
  }
  return merged;
}

function mergeTablesBest(local: Record<number, number>, remote: Record<string, number>): Record<number, number> {
  const merged: Record<number, number> = { ...local };
  for (const [key, val] of Object.entries(remote)) {
    const k = Number(key);
    merged[k] = Math.max(merged[k] ?? 0, val);
  }
  return merged;
}

/**
 * Cap on retained mistakes.
 * Previously unbounded: the array was JSON-serialised on every save and pushed
 * over the network in full, growing without limit.
 */
const MAX_SAVED_MISTAKES = 200;

/** Union merge — deduplicate by display + correctAnswer, keeping the most recent. */
function mergeMistakes(base: WrongAnswer[], incoming: WrongAnswer[]): WrongAnswer[] {
  const seen = new Set(base.map(m => `${m.display}|${m.correctAnswer}`));
  const merged = [...base, ...incoming.filter(m => !seen.has(`${m.display}|${m.correctAnswer}`))];
  return merged.length > MAX_SAVED_MISTAKES
    ? merged.slice(merged.length - MAX_SAVED_MISTAKES)
    : merged;
}

// ─── Context type ──────────────────────────────────────────────────────────

interface GameContextType {
  selectedClass:    SchoolClass; setSelectedClass:(c: SchoolClass) => void;
  selectedCategory: Category;   setSelectedCategory:(c: Category) => void;
  difficulty:       Difficulty;  setDifficulty:(d: Difficulty) => void;
  sessionType:      SessionType; setSessionType:(s: SessionType) => void;
  selectedTable:    number;      setSelectedTable:(n: number) => void;
  score:            number;
  questions:        Question[];
  currentIndex:     number;
  isGameOver:       boolean;
  totalQuestions:   number;
  wrongAnswers:     WrongAnswer[];
  isTablesMode:     boolean;
  startGame:        (cls: SchoolClass, diff: Difficulty, cat: Category, sess: SessionType) => void;
  startTablesGame:  (tableNum: number) => void;
  submitAnswer:     (choice: import('../generators').ChoiceValue, correctOverride?: boolean) => boolean;
  nextQuestion:     () => void;
  endGame:          () => void;
  highScores:       Record<string, number>;
  progressStats:    ProgressStats;
  tablesBest:       Record<number, number>;
  /** Persisted mistakes accumulated across sessions */
  savedMistakes:    WrongAnswer[];
  saveScore:        () => Promise<void>;
  saveProgressStats:(correct: boolean, actualCategory?: Category) => Promise<void>;
  /** Remove one mistake from the persisted list (called after correct retry) */
  clearMistake:     (display: string, correctAnswer: string) => Promise<void>;
  loadAll:          () => Promise<void>;
  getHighScore:     (cls: SchoolClass, diff: Difficulty, cat: Category) => number;

  // ── Learning engine (Directions C & D) ──────────────────────────────────
  /** Immutable log of every answered question — the source of truth. */
  attempts:         Attempt[];
  /** Derived per-skill mastery estimates. */
  mastery:          Record<SkillId, MasteryEstimate>;
  /** Consecutive days practised. */
  streak:           number;
  /** Questions answered today. */
  answeredToday:    number;
  /** Start an adaptive session: the engine chooses what to practise. */
  startAdaptiveSession: (cls: SchoolClass, sess: SessionType) => void;
  /** True when the current session was chosen by the scheduler. */
  isAdaptive:       boolean;
  /** Record an answer with timing and diagnosis. Returns the misconception, if any. */
  recordAttempt:    (args: {
                      question: Question; chosen: string; correct: boolean;
                      latencyMs: number; timedOut: boolean;
                    }) => string | null;
  /** Weakest prerequisite behind a struggling skill, for explaining *why*. */
  rootGapFor:       (skill: SkillId) => SkillId | null;
  /** Most frequent misconceptions across recent practice. */
  topMisconceptions: () => ReturnType<typeof summariseMisconceptions>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

// ─── Provider ──────────────────────────────────────────────────────────────

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [selectedClass,    setSelectedClass]    = useState<SchoolClass>('1st');
  const [selectedCategory, setSelectedCategory] = useState<Category>('addition');
  const [difficulty,       setDifficulty]       = useState<Difficulty>('easy');
  const [sessionType,      setSessionType]      = useState<SessionType>('10q');
  const [selectedTable,    setSelectedTable]    = useState<number>(2);
  const [isTablesMode,     setIsTablesMode]     = useState(false);
  const [questions,        setQuestions]        = useState<Question[]>([]);
  const [currentIndex,     setCurrentIndex]     = useState(0);
  const [score,            setScore]            = useState(0);
  const [isGameOver,       setIsGameOver]       = useState(false);
  const [totalQuestions,   setTotalQuestions]   = useState(10);
  const [wrongAnswers,     setWrongAnswers]     = useState<WrongAnswer[]>([]);
  const [highScores,       setHighScores]       = useState<Record<string, number>>({});
  const [progressStats,    setProgressStats]    = useState<ProgressStats>({});
  const [tablesBest,       setTablesBest]       = useState<Record<number, number>>({});
  const [savedMistakes,    setSavedMistakes]    = useState<WrongAnswer[]>([]);
  const [attempts,         setAttempts]         = useState<Attempt[]>([]);
  const [isAdaptive,       setIsAdaptive]       = useState(false);
  /** Skills chosen by the scheduler for the current session, index-aligned to `questions`. */
  const sessionSkillsRef = useRef<SkillId[]>([]);

  // Stable ref so callbacks can access device ID without stale closure issues
  const deviceIdRef = useRef<string | null>(null);

  const getOrCreateDeviceId = useCallback(async (): Promise<string> => {
    if (deviceIdRef.current) return deviceIdRef.current;
    try {
      let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (!id) {
        id = generateDeviceId();
        await AsyncStorage.setItem(DEVICE_ID_KEY, id);
      }
      deviceIdRef.current = id;
      return id;
    } catch {
      const id = generateDeviceId();
      deviceIdRef.current = id;
      return id;
    }
  }, []);

  // ─── Build a complete ProgressData snapshot ────────────────────────────
  // Helper used in all push calls so every field is always included.
  const buildPayload = useCallback((
    hs: Record<string, number>,
    ps: ProgressStats,
    tb: Record<number, number>,
    sm: WrongAnswer[],
  ): ProgressData => ({
    highScores:    hs,
    progressStats: ps,
    tablesBest:    tb,
    wrongAnswers:  sm,
  }), []);

  // ─── Load & sync ──────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      const [hs, ps, tb, sm, at, ver] = await Promise.all([
        AsyncStorage.getItem(HIGH_SCORES_KEY),
        AsyncStorage.getItem(STATS_KEY),
        AsyncStorage.getItem(TABLES_BEST_KEY),
        AsyncStorage.getItem(SAVED_MISTAKES_KEY),
        AsyncStorage.getItem(ATTEMPTS_KEY),
        AsyncStorage.getItem(SCHEMA_VERSION_KEY),
      ]);

      let localHS: Record<string, number> = hs ? JSON.parse(hs) : {};
      let localPS: ProgressStats          = ps ? JSON.parse(ps) : {};
      let localTB: Record<number, number> = tb ? JSON.parse(tb) : {};
      let localSM: WrongAnswer[]          = sm ? JSON.parse(sm) : [];
      let localAT: Attempt[]              = at ? sanitiseLog(JSON.parse(at)) : [];

      // ── Schema migration ────────────────────────────────────────────────
      // Legacy installs stored only {attempted, correct} counters. Those carry
      // no timestamps, latency or chosen answers, so the detail is genuinely
      // unrecoverable — but rather than discard the learner's history we seed
      // the log with dated placeholders so mastery has something to work from.
      const schemaVersion = ver ? Number(ver) : 2;
      if (schemaVersion < CURRENT_SCHEMA && localAT.length === 0) {
        localAT = migrateLegacyStats(localPS, Date.now(), resolveSkill);
        await AsyncStorage.setItem(ATTEMPTS_KEY, JSON.stringify(localAT));
        await AsyncStorage.setItem(SCHEMA_VERSION_KEY, String(CURRENT_SCHEMA));
      }

      const deviceId = await getOrCreateDeviceId();
      const remote   = await fetchProgress(deviceId);
      if (remote) {
        localHS = mergeHighScores(localHS, remote.highScores);
        localPS = mergeProgressStats(localPS, remote.progressStats);
        localTB = mergeTablesBest(localTB, remote.tablesBest);
        localSM = mergeMistakes(localSM, remote.wrongAnswers ?? []);
        // Attempts are immutable facts, so union-merge is correct and
        // commutative — unlike the legacy Math.max merge on counters.
        localAT = mergeAttempts(localAT, sanitiseLog((remote as { attempts?: unknown }).attempts));

        await Promise.all([
          AsyncStorage.setItem(HIGH_SCORES_KEY,    JSON.stringify(localHS)),
          AsyncStorage.setItem(STATS_KEY,          JSON.stringify(localPS)),
          AsyncStorage.setItem(TABLES_BEST_KEY,    JSON.stringify(localTB)),
          AsyncStorage.setItem(SAVED_MISTAKES_KEY, JSON.stringify(localSM)),
          AsyncStorage.setItem(ATTEMPTS_KEY,        JSON.stringify(localAT)),
        ]);
        pushProgress(deviceId, buildPayload(localHS, localPS, localTB, localSM));
      }

      setHighScores(localHS);
      // The attempt log is authoritative; counters are derived from it so the
      // two can never disagree. Fall back to stored counters pre-migration.
      setProgressStats(localAT.length > 0 ? deriveLegacyStats(localAT) : localPS);
      setTablesBest(localTB);
      setSavedMistakes(localSM);
      setAttempts(localAT);
    } catch (e) { console.error('[GameContext] loadAll failed:', e); }
  }, [getOrCreateDeviceId, buildPayload]);

  // ─── Helpers ──────────────────────────────────────────────────────────

  const getHighScore = useCallback(
    (cls: SchoolClass, diff: Difficulty, cat: Category): number =>
      highScores[`${cls}_${cat}_${diff}`] ?? 0,
    [highScores],
  );

  // ─── Game flow ────────────────────────────────────────────────────────

  // ── Learning engine ───────────────────────────────────────────────────
  // Derived, never stored: mastery is always recomputed from the log so a
  // change to the estimator can never leave stale values behind.
  const mastery = useMemo(() => estimateAll(attempts), [attempts]);
  const streak = useMemo(() => currentStreak(attempts), [attempts]);
  const answeredToday = useMemo(() => todayCount(attempts), [attempts]);

  /**
   * Interaction-rich alternatives for skills where a different input modality
   * teaches the concept better than four tiles.
   *
   * Keyed by skill so the scheduler stays in charge of *what* to practise while
   * this decides *how* it is asked.
   */
  const INTERACTIVE_VARIANTS: Partial<Record<string, ((c: SchoolClass, d: Difficulty) => Question)[]>> = useMemo(() => ({
    'factors.basic':     [genFactorSelect, genPrimeSelect],
    'mul.tables.mid':    [genMultipleSelect, genTableRecall],
    'mul.tables.full':   [genMultipleSelect, genTableRecall],
    'numsense.compare':  [genOrderNumbers],
    'placevalue':        [genOrderNumbers],
    'dec.tenths':        [genOrderDecimals],
    'dec.hundredths':    [genOrderDecimals],
    'frac.equivalence':  [genOrderFractions],
    'add.within20':      [genMissingNumber, genDoubleHalve],
    'add.2digit.carry':  [genMissingNumber],
    'sub.within20':      [genMissingNumber],
    'sub.2digit.borrow': [genMissingNumber],
    'div.basic':         [genDoubleHalve],
  }), []);

  /**
   * Build one question for a skill, choosing the interaction type.
   *
   * Shared by the manual funnel and adaptive sessions so that the richer
   * question types are not exclusive to Smart Practice — a learner who picks
   * "Factors" from the menu should still meet "tap all the factors".
   */
  const buildQuestion = useCallback((
    cls: SchoolClass, diff: Difficulty, cat: Category, skill: string, level: number,
  ): Question => {
    const variants = INTERACTIVE_VARIANTS[skill];
    if (variants && variants.length > 0 && Math.random() < 0.34) {
      const q = variants[Math.floor(Math.random() * variants.length)](cls, diff);
      return { ...q, resolvedCategory: q.resolvedCategory ?? cat };
    }
    const q = generateQuestion(cls, diff, cat);
    // The ladder: secure skills lose the multiple-choice scaffold.
    const withLadder = pickInteraction(level, { entry: true }) === 'entry' ? toEntry(q) : q;
    return { ...withLadder, resolvedCategory: withLadder.resolvedCategory ?? cat };
  }, [INTERACTIVE_VARIANTS]);

  const startGame = useCallback(
    (cls: SchoolClass, diff: Difficulty, cat: Category, sess: SessionType) => {
      // C4 fix: Blitz previously fell through to 10 questions, so a 60-second
      // session ended after ~20 seconds.
      const count = sess === '20q' ? 20 : sess === 'timed60' ? 60 : 10;
      sessionSkillsRef.current = [];
      setIsAdaptive(false);
      setIsTablesMode(false);
      setSelectedClass(cls);
      setDifficulty(diff);
      setSelectedCategory(cat);
      setSessionType(sess);
      setTotalQuestions(count);
      const skill = resolveSkill(cls, cat, diff);
      const level = mastery[skill]?.value ?? 0.5;
      sessionSkillsRef.current = Array.from({ length: count }, () => skill);
      setQuestions(Array.from({ length: count }, () => buildQuestion(cls, diff, cat, skill, level)));
      setCurrentIndex(0);
      setScore(0);
      setIsGameOver(false);
      setWrongAnswers([]);
    },
    [mastery, buildQuestion],
  );

  /**
   * Adaptive session (Direction C).
   *
   * Instead of asking the learner to pick a category and difficulty, the
   * scheduler selects skills by spaced-repetition due-ness, prerequisite gaps
   * and target success rate, then generates a question per selected skill.
   */
  const startAdaptiveSession = useCallback((cls: SchoolClass, sess: SessionType) => {
    const count = sess === '20q' ? 20 : sess === 'timed60' ? 60 : 10;
    const plan = buildSession(cls, mastery, count);

    const qs: Question[] = [];
    const skills: SkillId[] = [];
    for (const step of plan) {
      const cat = categoryForSkill(step.skill);
      try {
        const level = mastery[step.skill]?.value ?? 0.5;
        qs.push(buildQuestion(cls, step.difficulty, cat, step.skill, level));
        skills.push(step.skill);
      } catch {
        // A skill whose generator rejects this class/difficulty pair is skipped
        // rather than breaking the session.
      }
    }
    // Guarantee a full session even if some skills could not generate.
    while (qs.length < count) {
      const q = generateQuestion(cls, 'easy', 'addition');
      qs.push({ ...q, resolvedCategory: 'addition' });
      skills.push(resolveSkill(cls, 'addition', 'easy'));
    }

    sessionSkillsRef.current = skills;
    setIsAdaptive(true);
    setIsTablesMode(false);
    setSelectedClass(cls);
    setSessionType(sess);
    setTotalQuestions(qs.length);
    setQuestions(qs);
    setCurrentIndex(0);
    setScore(0);
    setIsGameOver(false);
    setWrongAnswers([]);
  }, [mastery, buildQuestion]);

  /**
   * Record one answered question (Directions C & D).
   *
   * Captures the three fields the legacy model discarded — when, how long, and
   * what was chosen — then runs misconception diagnosis on wrong answers.
   */
  const recordAttempt = useCallback(({ question, chosen, correct, latencyMs, timedOut }: {
    question: Question; chosen: string; correct: boolean; latencyMs: number; timedOut: boolean;
  }): string | null => {
    const category = question.resolvedCategory ?? selectedCategory;
    const skill = sessionSkillsRef.current[currentIndex]
      ?? resolveSkill(selectedClass, isTablesMode ? 'tables' : category, difficulty);

    // Prefer the distractor map: if this exact wrong option was generated *by*
    // a known misconception, that is a direct observation rather than inference.
    const mapped = !correct ? question.distractorMap?.[chosen] : undefined;
    const misconception = mapped ?? (correct ? null : diagnose({
      questionText: question.questionText,
      expected: String(question.answer),
      chosen, skill, latencyMs, timedOut,
    }));

    const attempt: Attempt = {
      skill, correct, answeredAt: Date.now(), latencyMs, chosen,
      expected: String(question.answer), questionText: question.questionText,
      timedOut, misconception: misconception ?? undefined,
      cls: selectedClass, category, difficulty,
    };

    setAttempts(prev => {
      const next = appendAttempts(prev, [attempt]);
      // Persist and re-derive counters; failures are non-fatal (offline-first).
      AsyncStorage.setItem(ATTEMPTS_KEY, JSON.stringify(next)).catch(() => {});
      AsyncStorage.setItem(SCHEMA_VERSION_KEY, String(CURRENT_SCHEMA)).catch(() => {});
      setProgressStats(deriveLegacyStats(next));
      return next;
    });

    return misconception ?? null;
  }, [currentIndex, selectedClass, selectedCategory, difficulty, isTablesMode]);

  const rootGapFor = useCallback(
    (skill: SkillId) => findRootGap(skill, mastery), [mastery]);

  const topMisconceptions = useCallback(
    () => summariseMisconceptions(attempts.slice(-200).map(a => a.misconception)),
    [attempts]);

  const startTablesGame = useCallback((tableNum: number) => {
    sessionSkillsRef.current = [];
    setIsAdaptive(false);
    setIsTablesMode(true);
    setSelectedTable(tableNum);
    const qs = generateTablesQuestions(tableNum);
    setQuestions(qs);
    setTotalQuestions(12);
    setCurrentIndex(0);
    setScore(0);
    setIsGameOver(false);
    setWrongAnswers([]);
  }, []);

  /**
   * Record an answer.
   *
   * `correctOverride` lets non-choice interactions (typed entry, multi-select,
   * ordering) report their own grading, since their answers are normalised
   * composites — "2,3,6" — that cannot be compared to `q.answer` directly.
   * Multiple choice keeps the original string comparison.
   */
  const submitAnswer = useCallback(
    (choice: import('../generators').ChoiceValue, correctOverride?: boolean): boolean => {
      const q = questions[currentIndex];
      const correct = correctOverride ?? (String(choice) === String(q.answer));
      if (correct) {
        setScore(prev => prev + 1);
      } else {
        setWrongAnswers(prev => [
          ...prev,
          {
            display: q.questionText,
            userAnswer: String(choice),
            correctAnswer: expectedAnswer(q),
          },
        ]);
      }
      return correct;
    },
    [questions, currentIndex],
  );

  const nextQuestion = useCallback(() => {
    if (currentIndex + 1 >= totalQuestions) setIsGameOver(true);
    else setCurrentIndex(prev => prev + 1);
  }, [currentIndex, totalQuestions]);

  const endGame = useCallback(() => setIsGameOver(true), []);

  // ─── Persistence — local-first, then background server sync ──────────

  const saveScore = useCallback(async () => {
    try {
      let nextHS = highScores;
      let nextTB = tablesBest;

      if (isTablesMode) {
        const current = tablesBest[selectedTable] ?? 0;
        if (score > current) {
          nextTB = { ...tablesBest, [selectedTable]: score };
          setTablesBest(nextTB);
          await AsyncStorage.setItem(TABLES_BEST_KEY, JSON.stringify(nextTB));
        }
      } else {
        const key     = `${selectedClass}_${selectedCategory}_${difficulty}`;
        const current = highScores[key] ?? 0;
        if (score > current) {
          nextHS = { ...highScores, [key]: score };
          setHighScores(nextHS);
          await AsyncStorage.setItem(HIGH_SCORES_KEY, JSON.stringify(nextHS));
        }
      }

      // Merge session wrong answers into saved mistakes
      let nextSM = savedMistakes;
      if (wrongAnswers.length > 0) {
        nextSM = mergeMistakes(savedMistakes, wrongAnswers);
        setSavedMistakes(nextSM);
        await AsyncStorage.setItem(SAVED_MISTAKES_KEY, JSON.stringify(nextSM));
      }

      const deviceId = await getOrCreateDeviceId();
      pushProgress(deviceId, buildPayload(nextHS, progressStats, nextTB, nextSM));
    } catch (e) { console.error('[GameContext] saveScore failed:', e); }
  }, [
    score, isTablesMode, selectedTable, selectedClass, selectedCategory, difficulty,
    highScores, tablesBest, progressStats, savedMistakes, wrongAnswers,
    getOrCreateDeviceId, buildPayload,
  ]);

  const saveProgressStats = useCallback(async (correct: boolean, actualCategory?: Category) => {
    if (isTablesMode) return;
    try {
      const catForStats = actualCategory ?? selectedCategory;
      const key   = `${selectedClass}_${catForStats}_${difficulty}`;
      const entry = progressStats[key] ?? { attempted: 0, correct: 0 };
      const nextPS: ProgressStats = {
        ...progressStats,
        [key]: { attempted: entry.attempted + 1, correct: entry.correct + (correct ? 1 : 0) },
      };
      setProgressStats(nextPS);
      await AsyncStorage.setItem(STATS_KEY, JSON.stringify(nextPS));

      const deviceId = await getOrCreateDeviceId();
      pushProgress(deviceId, buildPayload(highScores, nextPS, tablesBest, savedMistakes));
    } catch (e) { console.error('[GameContext] saveProgressStats failed:', e); }
  }, [
    isTablesMode, selectedClass, selectedCategory, difficulty, progressStats,
    highScores, tablesBest, savedMistakes, getOrCreateDeviceId, buildPayload,
  ]);

  /** Remove a single mistake from the persisted list after a successful retry */
  const clearMistake = useCallback(async (display: string, correctAnswer: string) => {
    try {
      const next = savedMistakes.filter(
        m => !(m.display === display && m.correctAnswer === correctAnswer),
      );
      setSavedMistakes(next);
      await AsyncStorage.setItem(SAVED_MISTAKES_KEY, JSON.stringify(next));
      const deviceId = await getOrCreateDeviceId();
      pushProgress(deviceId, buildPayload(highScores, progressStats, tablesBest, next));
    } catch (e) { console.error('[GameContext] clearMistake failed:', e); }
  }, [savedMistakes, highScores, progressStats, tablesBest, getOrCreateDeviceId, buildPayload]);

  return (
    <GameContext.Provider value={{
      selectedClass, setSelectedClass, selectedCategory, setSelectedCategory,
      difficulty, setDifficulty, sessionType, setSessionType, selectedTable, setSelectedTable,
      score, questions, currentIndex, isGameOver, totalQuestions, wrongAnswers, isTablesMode,
      startGame, startTablesGame, submitAnswer, nextQuestion, endGame,
      highScores, progressStats, tablesBest, savedMistakes,
      saveScore, saveProgressStats, clearMistake, loadAll, getHighScore,
      attempts, mastery, streak, answeredToday,
      startAdaptiveSession, isAdaptive, recordAttempt, rootGapFor, topMisconceptions,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
