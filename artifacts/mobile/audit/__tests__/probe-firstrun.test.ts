import { describe, it } from 'vitest';
import { runLearner, srand, installRng, table, DAY } from '../harness';
import { estimateAll } from '../../learning/mastery';
import { isDue, reviewIntervalDays } from '../../learning/scheduler';
import { levelForXp } from '../../progression/levels';
import { evaluateAchievements } from '../../progression/achievements';
import { praiseFor, PRAISE } from '../../learning/feedback';

installRng();
const base = { retentionHalfLife: 60, guessRate: 0.02, speed: 1, sessionLength: 20, cls: '4th' as const };

describe('F1 · the first five minutes', () => {
  it('what a brand-new child experiences in session one', () => {
    srand(1);
    const r = runLearner({ ...base, name: 'new', learnRate: 0.16, attendance: 1, sessionLength: 10 }, 1);
    const est = estimateAll(r.state.log, r.end);
    const ach = evaluateAchievements({ log: r.state.log, estimates: est, cls: '4th', now: r.end });

    console.log('\n===== F1 · FIRST SESSION (10 questions) =====');
    console.log(`questions answered: ${r.totalAnswered}`);
    console.log(`XP earned: ${Math.round(r.state.totalXp)} → level ${levelForXp(r.state.totalXp).level}`);
    console.log(`distinct skills met: ${Object.keys(est).length}`);
    console.log(`achievements earned: ${ach.filter(a => a.earned).length}`);
    console.log(`achievements showing ANY progress: ${ach.filter(a => a.progress > 0).length}/${ach.length}`);
    console.log(`accuracy: ${(r.state.log.filter(a => a.correct).length / r.state.log.length * 100).toFixed(0)}%`);
  }, 300_000);

  it('praise variety within a single session', () => {
    // The child sees one of five praise lines per correct answer. How varied
    // does a 10-question session actually feel?
    const kinds = new Set<string>();
    const scenarios = [
      { mastery: 0.3, latencyMs: 8000, afterMistake: false },
      { mastery: 0.3, latencyMs: 3000, afterMistake: false },
      { mastery: 0.9, latencyMs: 2000, afterMistake: false },
      { mastery: 0.6, latencyMs: 4000, afterMistake: false },
      { mastery: 0.6, latencyMs: 4000, afterMistake: true },
      { mastery: 0.5, latencyMs: 4000, afterMistake: false, scaffolded: true },
    ];
    for (const s of scenarios) kinds.add(praiseFor(s));
    console.log('\n===== F1b · PRAISE VARIETY =====');
    console.log(`distinct praise kinds reachable: ${kinds.size}/${Object.keys(PRAISE).length}`);
    console.log(`lines: ${[...kinds].map(k => `"${PRAISE[k as keyof typeof PRAISE].en}"`).join(', ')}`);
    console.log('→ a 20-question session draws from at most 5 sentences.');
  });
});

describe('F2 · the return hook', () => {
  it('what is genuinely waiting for the child tomorrow', () => {
    srand(55);
    const r = runLearner({ ...base, name: 'avg', learnRate: 0.16, attendance: 0.7 }, 40);
    const now = r.end;
    const tomorrow = now + DAY;
    const est = estimateAll(r.state.log, tomorrow);

    const dueToday = Object.values(est).filter(e => isDue(e, now)).length;
    const dueTomorrow = Object.values(est).filter(e => isDue(e, tomorrow)).length;
    const newlyDue = Object.values(est).filter(e => !isDue(e, now) && isDue(e, tomorrow));

    console.log('\n===== F2 · TOMORROW =====');
    console.log(`skills due today: ${dueToday}`);
    console.log(`skills due tomorrow: ${dueTomorrow}`);
    console.log(`skills becoming due overnight: ${newlyDue.length}`);
    console.log(`  ${newlyDue.slice(0, 5).map(e => `${e.skill} (interval ${reviewIntervalDays(e.value, e.attempts).toFixed(1)}d)`).join(', ')}`);
    console.log('→ the scheduler KNOWS all of this. Nothing in the UI says it.');
  }, 300_000);
});

describe('F3 · session length by age', () => {
  it('reports the session sizes on offer', () => {
    console.log('\n===== F3 · SESSION SIZES =====');
    console.log('SessionType: 10q | 20q | timed60');
    console.log('Home screen "Start practising" always launches 10q adaptive.');
    console.log('DAILY_GOAL = 10 questions.');
    console.log('At ~25 s/question, 10q ≈ 4 min, 20q ≈ 8 min, timed60 = 60 s.');
    console.log('→ no age-differentiated default: a Class 1 six-year-old and a');
    console.log('   Class 6 eleven-year-old both get 10 questions.');
  });
});
