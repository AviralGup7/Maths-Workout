import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
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

// ─── Storage keys ─────────────────────────────────────────────────────────
const HIGH_SCORES_KEY    = '@maths_workout_v2_high_scores';
const STATS_KEY          = '@maths_workout_v2_progress_stats';
const TABLES_BEST_KEY    = '@maths_workout_v2_tables_best';
const SAVED_MISTAKES_KEY = '@maths_workout_v2_saved_mistakes';
const DEVICE_ID_KEY      = '@maths_workout_device_id';

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

/** Union merge — deduplicate by display + correctAnswer */
function mergeMistakes(base: WrongAnswer[], incoming: WrongAnswer[]): WrongAnswer[] {
  const seen = new Set(base.map(m => `${m.display}|${m.correctAnswer}`));
  return [...base, ...incoming.filter(m => !seen.has(`${m.display}|${m.correctAnswer}`))];
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
  submitAnswer:     (choice: import('../generators').ChoiceValue) => boolean;
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
      const [hs, ps, tb, sm] = await Promise.all([
        AsyncStorage.getItem(HIGH_SCORES_KEY),
        AsyncStorage.getItem(STATS_KEY),
        AsyncStorage.getItem(TABLES_BEST_KEY),
        AsyncStorage.getItem(SAVED_MISTAKES_KEY),
      ]);

      let localHS: Record<string, number> = hs ? JSON.parse(hs) : {};
      let localPS: ProgressStats          = ps ? JSON.parse(ps) : {};
      let localTB: Record<number, number> = tb ? JSON.parse(tb) : {};
      let localSM: WrongAnswer[]          = sm ? JSON.parse(sm) : [];

      const deviceId = await getOrCreateDeviceId();
      const remote   = await fetchProgress(deviceId);
      if (remote) {
        localHS = mergeHighScores(localHS, remote.highScores);
        localPS = mergeProgressStats(localPS, remote.progressStats);
        localTB = mergeTablesBest(localTB, remote.tablesBest);
        localSM = mergeMistakes(localSM, remote.wrongAnswers ?? []);

        await Promise.all([
          AsyncStorage.setItem(HIGH_SCORES_KEY,    JSON.stringify(localHS)),
          AsyncStorage.setItem(STATS_KEY,          JSON.stringify(localPS)),
          AsyncStorage.setItem(TABLES_BEST_KEY,    JSON.stringify(localTB)),
          AsyncStorage.setItem(SAVED_MISTAKES_KEY, JSON.stringify(localSM)),
        ]);
        pushProgress(deviceId, buildPayload(localHS, localPS, localTB, localSM));
      }

      setHighScores(localHS);
      setProgressStats(localPS);
      setTablesBest(localTB);
      setSavedMistakes(localSM);
    } catch (e) { console.error('[GameContext] loadAll failed:', e); }
  }, [getOrCreateDeviceId, buildPayload]);

  // ─── Helpers ──────────────────────────────────────────────────────────

  const getHighScore = useCallback(
    (cls: SchoolClass, diff: Difficulty, cat: Category): number =>
      highScores[`${cls}_${cat}_${diff}`] ?? 0,
    [highScores],
  );

  // ─── Game flow ────────────────────────────────────────────────────────

  const startGame = useCallback(
    (cls: SchoolClass, diff: Difficulty, cat: Category, sess: SessionType) => {
      const count = sess === '20q' ? 20 : 10;
      setIsTablesMode(false);
      setSelectedClass(cls);
      setDifficulty(diff);
      setSelectedCategory(cat);
      setSessionType(sess);
      setTotalQuestions(count);
      setQuestions(Array.from({ length: count }, () => generateQuestion(cls, diff, cat)));
      setCurrentIndex(0);
      setScore(0);
      setIsGameOver(false);
      setWrongAnswers([]);
    },
    [],
  );

  const startTablesGame = useCallback((tableNum: number) => {
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

  const submitAnswer = useCallback(
    (choice: import('../generators').ChoiceValue): boolean => {
      const q = questions[currentIndex];
      const correct = String(choice) === String(q.answer);
      if (correct) {
        setScore(prev => prev + 1);
      } else {
        setWrongAnswers(prev => [
          ...prev,
          { display: q.questionText, userAnswer: String(choice), correctAnswer: String(q.answer) },
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
