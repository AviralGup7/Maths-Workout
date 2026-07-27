// ─── System balance scorecard ────────────────────────────────────────────────
// docs/21. One measured score per subsystem, from the real engine.
//
// Every metric below is a PROPERTY the design claims, expressed as a number
// with an explicit target. The score is not an opinion — it is the fraction of
// each subsystem's properties that currently hold, at the measured margin.

import { describe, it } from 'vitest';
import { runLearner, srand, installRng, table, type Profile } from '../harness';
import { estimateAll, MASTERED_THRESHOLD } from '../../learning/mastery';
import { CHAPTERS, chapterStatus } from '../../curriculum/chapters';
import { evaluateAchievements, ACHIEVEMENTS } from '../../progression/achievements';
import { SKILLS } from '../../learning/skills';
import { generateQuestion, getAvailableCategories } from '../../generators';
import type { Category, Difficulty, SchoolClass } from '../../generators/types';

installRng();

const base = { retentionHalfLife: 60, guessRate: 0.02, speed: 1, sessionLength: 20, cls: '4th' as const };

interface Check { subsystem: string; property: string; measured: string; target: string; pass: boolean }
const checks: Check[] = [];
const add = (subsystem: string, property: string, measured: string, target: string, pass: boolean) =>
  checks.push({ subsystem, property, measured, target, pass });

describe('SYSTEM BALANCE SCORECARD', () => {
  it('measures every subsystem against its design claims', () => {
    // ── Run the population once, reuse everywhere ────────────────────────────
    const profiles: Record<string, Profile> = {
      gifted:      { ...base, name: 'gifted', learnRate: 0.42, attendance: 0.85 },
      average:     { ...base, name: 'average', learnRate: 0.16, attendance: 0.65 },
      struggling:  { ...base, name: 'struggling', learnRate: 0.06, attendance: 0.6, retentionHalfLife: 25 },
      guesser:     { ...base, name: 'guesser', learnRate: 0.0001, attendance: 0.7, guessRate: 0.95, speed: 0.2 },
      alwaysEasy:  { ...base, name: 'always-easy', learnRate: 0.16, attendance: 0.65, difficultyBias: 'easy' },
      alwaysHard:  { ...base, name: 'always-hard', learnRate: 0.16, attendance: 0.65, difficultyBias: 'hard' },
      neverLearns: { ...base, name: 'never-perfect', learnRate: 0.0001, attendance: 0.7 },
    };
    const runs: Record<string, ReturnType<typeof runLearner>> = {};
    Object.entries(profiles).forEach(([k, p], i) => { srand(6100 + i); runs[k] = runLearner(p, 365); });

    const trueLearning = (k: string) => {
      const r = runs[k];
      return Object.keys(r.estimates).reduce((s, sk) => s + r.learner.abilityAt(sk, r.end), 0);
    };
    const xp = (k: string) => runs[k].state.totalXp;

    // ── XP economy ───────────────────────────────────────────────────────────
    add('XP economy', 'honest learner out-earns a guesser',
      `${Math.round(xp('average'))} vs ${Math.round(xp('guesser'))}`, '> 50x', xp('average') > xp('guesser') * 50);
    add('XP economy', 'honest learner out-earns a never-improver',
      `${Math.round(xp('average'))} vs ${Math.round(xp('neverLearns'))}`, '> 3x', xp('average') > xp('neverLearns') * 3);
    add('XP economy', 'struggling learner out-earns a guesser',
      `${Math.round(xp('struggling'))} vs ${Math.round(xp('guesser'))}`, '> 20x', xp('struggling') > xp('guesser') * 20);
    const perTrue = (k: string) => xp(k) / Math.max(0.5, trueLearning(k));
    const honest = ['gifted', 'average', 'struggling', 'alwaysEasy', 'alwaysHard'].map(perTrue);
    const spread = Math.max(...honest) / Math.min(...honest);
    add('XP economy', 'XP per unit learned is consistent across strategies',
      `${spread.toFixed(1)}x spread`, '< 2.0x', spread < 2.0);
    add('XP economy', 'easy-farming does not beat adaptive practice per unit learned',
      `${perTrue('alwaysEasy').toFixed(0)} vs ${perTrue('average').toFixed(0)}`, '< 1.45x',
      perTrue('alwaysEasy') < perTrue('average') * 1.45);

    // ── Mastery ──────────────────────────────────────────────────────────────
    for (const k of ['average', 'gifted']) {
      const r = runs[k];
      const vals = Object.values(r.estimates);
      const over = vals.filter(e => e.value - r.learner.abilityAt(e.skill, r.end) > 0.25).length;
      add('Mastery', `${k}: few skills overstated by >0.25`,
        `${over}/${vals.length}`, '< 8%', over < vals.length * 0.08);
    }
    const g = runs.guesser;
    const gOver = Object.values(g.estimates).filter(e => e.value >= MASTERED_THRESHOLD).length;
    add('Mastery', 'a guesser is never certified as having mastered anything',
      `${gOver} skills >= 0.85`, '0', gOver === 0);
    const gConf = Object.values(g.estimates).filter(e => e.confidence > 0.9).length;
    add('Mastery', 'confidence is not maxed out on pure guessing',
      `${gConf} skills > 0.9 confidence`, '0', gConf === 0);

    // ── Scheduler / curriculum reach ─────────────────────────────────────────
    for (const cls of ['4th', '6th'] as SchoolClass[]) {
      srand(700);
      const r = runLearner({ ...base, name: `reach-${cls}`, learnRate: 0.18, attendance: 0.8, cls }, 365);
      const touched = Object.keys(r.skillCounts).length;
      const top = Math.max(...Object.values(r.skillCounts)) / r.totalAnswered;
      add('Scheduler', `Class ${cls}: broad curriculum coverage in a year`,
        `${touched}/45 skills`, '>= 38', touched >= 38);
      add('Scheduler', `Class ${cls}: no single skill dominates practice`,
        `top skill ${(top * 100).toFixed(1)}%`, '< 6%', top < 0.06);
    }

    // ── Progression / chapters ───────────────────────────────────────────────
    srand(1300);
    const strong = runLearner({ ...base, name: 'strong', learnRate: 0.45, attendance: 0.85, cls: '6th' }, 730);
    const m: Record<string, number> = {};
    for (const [k, v] of Object.entries(strong.estimates)) m[k] = v.value;
    const statuses = CHAPTERS.map(c => chapterStatus(c, m, '6th'));
    const locked = statuses.filter(s => s === 'locked').length;
    const complete = statuses.filter(s => s === 'complete').length;
    add('Progression', 'no chapter is permanently unreachable',
      `${locked} locked after 2 years`, '0', locked === 0);
    add('Progression', 'a strong learner completes most of the map',
      `${complete}/${CHAPTERS.length} complete`, '>= 14', complete >= 14);

    // ── Achievements ─────────────────────────────────────────────────────────
    const ach = (k: string) => evaluateAchievements({
      log: runs[k].state.log, estimates: runs[k].estimates, cls: '4th', now: runs[k].end,
    });
    const gEarned = ach('guesser').filter(a => a.earned).length;
    add('Achievements', 'a guesser earns nothing', `${gEarned} earned`, '0', gEarned === 0);
    const aEarned = ach('average').filter(a => a.earned).length;
    add('Achievements', 'an honest learner earns a substantial share',
      `${aEarned}/${ACHIEVEMENTS.length}`, '>= 11', aEarned >= 11);
    const sDead = ach('struggling').filter(a => a.progress === 0).length;
    add('Achievements', 'a struggling learner sees progress on most of the wall',
      `${sDead}/${ACHIEVEMENTS.length} at zero`, '<= 2', sDead <= 2);

    // ── Question distribution ────────────────────────────────────────────────
    let thin = 0, cells = 0;
    for (const cls of ['1st', '2nd', '3rd', '4th', '5th', '6th'] as SchoolClass[]) {
      for (const cat of getAvailableCategories(cls)) {
        if (cat === 'tables' || cat === 'mixed') continue;
        for (const d of ['easy', 'medium', 'hard'] as Difficulty[]) {
          const seen = new Set<string>();
          for (let i = 0; i < 1500; i++) {
            try { seen.add(generateQuestion(cls, d, cat as Category).questionText); } catch { /* n/a */ }
          }
          if (seen.size === 0) continue;
          cells++;
          if (seen.size < 12) thin++;
        }
      }
    }
    add('Question supply', 'few cells fall below the variety floor',
      `${thin}/${cells} cells < 12 distinct`, '<= 1', thin <= 1);

    // ── Long-term pacing & retention ─────────────────────────────────────────
    // Properties that only show up over months, and that the earlier audit
    // could not check because the economy was inverted.
    {
      const r = runs.average;
      const first = r.state.log[0].answeredAt;
      const months: number[] = [];
      for (let mth = 0; mth < 12; mth++) {
        const lo = first + mth * 30 * 86_400_000;
        const seg = r.state.log.filter(a => a.answeredAt >= lo && a.answeredAt < lo + 30 * 86_400_000);
        if (seg.length > 50) months.push(new Set(seg.map(a => a.skill)).size);
      }
      // Curriculum must keep opening, not plateau — the F5 failure mode.
      const grew = months.length > 3 && months[months.length - 1] > months[0];
      add('Progression', 'skill breadth keeps growing across the year',
        `month 1: ${months[0]} → month ${months.length}: ${months[months.length - 1]} skills`,
        'increasing', grew);

      // Repetition must not climb as content is exhausted.
      const early = r.state.log.slice(0, 500);
      const late = r.state.log.slice(-500);
      const rep = (xs: typeof early) => 1 - new Set(xs.map(a => a.questionText)).size / xs.length;
      add('Question supply', 'repetition does not worsen over a year',
        `${(rep(early) * 100).toFixed(0)}% → ${(rep(late) * 100).toFixed(0)}%`, '< +8pp',
        rep(late) < rep(early) + 0.08);
    }

    // A learner who returns after a long absence must not be over-credited.
    {
      srand(4400);
      const back = runLearner({ ...base, name: 'returner', learnRate: 0.16, attendance: 1,
        attend: d => (d < 40 || d > 220 ? 1 : 0) }, 300);
      const est = estimateAll(back.state.log, back.end);
      const stale = Object.values(est).filter(e =>
        e.lastPracticed !== null && back.end - e.lastPracticed > 120 * 86_400_000);
      const inflated = stale.filter(e => e.value > 0.7).length;
      add('Mastery', 'skills abandoned for four months are not still reported secure',
        `${inflated}/${stale.length} stale skills > 0.7`, '0', inflated === 0);
    }

    // Nobody who practises honestly should ever be stuck with nothing to do.
    {
      let starved = 0;
      for (const k of ['gifted', 'average', 'struggling']) {
        const r = runs[k];
        const daily = new Map<string, number>();
        for (const a of r.state.log) {
          const d = new Date(a.answeredAt).toISOString().slice(0, 10);
          daily.set(d, (daily.get(d) ?? 0) + 1);
        }
        // A session that could not be filled would show as a short day.
        starved += [...daily.values()].filter(n => n > 0 && n < 10).length;
      }
      add('Scheduler', 'sessions are always fillable for honest learners',
        `${starved} short sessions`, '0', starved === 0);
    }

    // ── Report ───────────────────────────────────────────────────────────────
    const bySub = new Map<string, Check[]>();
    for (const c of checks) {
      if (!bySub.has(c.subsystem)) bySub.set(c.subsystem, []);
      bySub.get(c.subsystem)!.push(c);
    }
    console.log('\n' + table(checks.map(c => ({
      subsystem: c.subsystem, property: c.property,
      measured: c.measured, target: c.target, result: c.pass ? 'PASS' : 'FAIL',
    }))));

    console.log('\n===== SUBSYSTEM SCORES =====');
    const scores = [...bySub.entries()].map(([sub, cs]) => ({
      subsystem: sub,
      passed: `${cs.filter(c => c.pass).length}/${cs.length}`,
      score: +(cs.filter(c => c.pass).length / cs.length * 10).toFixed(1),
    }));
    console.log(table(scores));
    const overall = checks.filter(c => c.pass).length / checks.length * 10;
    console.log(`\nOVERALL: ${overall.toFixed(1)} / 10  (${checks.filter(c => c.pass).length}/${checks.length} properties hold)`);
    const failing = checks.filter(c => !c.pass);
    if (failing.length) {
      console.log('\nFAILING:');
      for (const f of failing) console.log(`  · [${f.subsystem}] ${f.property} — measured ${f.measured}, need ${f.target}`);
    }
  }, 1_800_000);
});
