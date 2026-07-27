import { describe, it } from 'vitest';
import { runLearner, srand, installRng, table, type Profile, DAY } from '../harness';
import { estimateAll, MASTERED_THRESHOLD } from '../../learning/mastery';
import { buildSession, scheduleSkills, reviewIntervalDays, isDue } from '../../learning/scheduler';
import { SKILLS } from '../../learning/skills';
import { CHAPTERS, chapterStatus } from '../../curriculum/chapters';

installRng();
const base = { retentionHalfLife: 60, guessRate: 0.02, speed: 1, sessionLength: 20 };

describe('scheduler coverage & curriculum reach', () => {
  it('S1 · how much of the curriculum does a learner ever meet?', () => {
    const rows: any[] = [];
    for (const cls of ['1st', '3rd', '4th', '6th'] as const) {
      srand(9);
      const r = runLearner({ ...base, name: `avg-${cls}`, learnRate: 0.18, attendance: 0.8, cls }, 365);
      const touched = Object.keys(r.skillCounts);
      const counts = Object.entries(r.skillCounts).sort((a, b) => b[1] - a[1]);
      rows.push({
        cls, answered: r.totalAnswered,
        skillsTouched: touched.length, ofTotal: Object.keys(SKILLS).length,
        top1: `${counts[0][0]} (${(counts[0][1] / r.totalAnswered * 100).toFixed(0)}%)`,
        top3share: `${(counts.slice(0, 3).reduce((s, c) => s + c[1], 0) / r.totalAnswered * 100).toFixed(0)}%`,
        neverSeen: Object.keys(SKILLS).length - touched.length,
      });
    }
    console.log('\n===== S1 · CURRICULUM COVERAGE AFTER 365 DAYS =====');
    console.log(table(rows));
  }, 600_000);

  it('S2 · which skills does a Class 4 learner never meet in a year?', () => {
    srand(9);
    const r = runLearner({ ...base, name: 'avg', learnRate: 0.18, attendance: 0.8, cls: '4th' }, 365);
    const seen = new Set(Object.keys(r.skillCounts));
    const missed = Object.keys(SKILLS).filter(s => !seen.has(s));
    console.log('\n===== S2 · NEVER SCHEDULED (Class 4, 365 days, 80% attendance) =====');
    console.log(missed.join('\n'));
    console.log(`\nseen ${seen.size} / ${Object.keys(SKILLS).length}`);
    const dist = Object.entries(r.skillCounts).sort((a, b) => b[1] - a[1])
      .map(([s, n]) => ({ skill: s, times: n, pct: `${(n / r.totalAnswered * 100).toFixed(1)}%`,
        mastery: +(r.estimates[s]?.value ?? 0).toFixed(2) }));
    console.log('\n--- distribution of scheduled practice ---');
    console.log(table(dist));
  }, 600_000);

  it('S3 · maintenance review of mastered skills over a year', () => {
    srand(11);
    const r = runLearner({ ...base, name: 'strong', learnRate: 0.45, attendance: 0.85, cls: '4th' }, 365);
    // For each skill that reached mastery, measure the gap distribution afterwards.
    const rows: any[] = [];
    for (const [skill, est] of Object.entries(r.estimates)) {
      const ts = r.state.log.filter(a => a.skill === skill).map(a => a.answeredAt).sort((x, y) => x - y);
      let maxGap = 0;
      for (let i = 1; i < ts.length; i++) maxGap = Math.max(maxGap, (ts[i] - ts[i - 1]) / DAY);
      const lastGap = (r.end - ts[ts.length - 1]) / DAY;
      rows.push({ skill, attempts: est.attempts, mastery: +est.value.toFixed(2),
        maxGapDays: +maxGap.toFixed(1), daysSinceLast: +lastGap.toFixed(1),
        nominalInterval: +reviewIntervalDays(est.value, est.attempts).toFixed(1) });
    }
    rows.sort((a, b) => b.daysSinceLast - a.daysSinceLast);
    console.log('\n===== S3 · REVIEW GAPS, STRONG LEARNER, 365 DAYS =====');
    console.log(table(rows));
  }, 600_000);

  it('S4 · chapter unlock/complete trajectory', () => {
    srand(13);
    const r = runLearner({ ...base, name: 'strong', learnRate: 0.45, attendance: 0.85, cls: '4th' }, 365);
    const m: Record<string, number> = {};
    for (const [k, v] of Object.entries(r.estimates)) m[k] = v.value;
    const rows = CHAPTERS.map(c => ({
      chapter: c.id, kind: (c as any).kind, cls: (c as any).cls ?? '',
      skills: c.skills.length,
      status: chapterStatus(c, m, '4th'),
      meanMastery: +(c.skills.reduce((s, k) => s + (m[k] ?? 0), 0) / c.skills.length).toFixed(2),
      unseen: c.skills.filter(k => !(k in m)).length,
    }));
    console.log('\n===== S4 · CHAPTER STATE AFTER 365 DAYS (strong learner) =====');
    console.log(table(rows));
  }, 600_000);
});
