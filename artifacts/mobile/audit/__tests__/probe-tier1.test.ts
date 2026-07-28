// ─── Tier 1 verification ─────────────────────────────────────────────────────
// docs/26. Re-measures the three findings that drove the Tier 1 work, against
// the same simulated learners docs/25 used.

import { describe, it, expect } from 'vitest';
import { runLearner, srand, installRng, table, DAY, type Profile } from '../harness';
import { buildSessionReport, headline, returnSentence } from '../../learning/sessionReport';
import { estimateAll, STRUGGLING_THRESHOLD, MASTERED_THRESHOLD } from '../../learning/mastery';
import { rebuildProgression } from '../../progression/recordAnswer';

installRng();
const base = { retentionHalfLife: 60, guessRate: 0.02, speed: 1, sessionLength: 20, cls: '4th' as const };

describe('T1 · the struggling learner now gets celebrated', () => {
  it('breakthroughs are reachable where masteries were not', () => {
    // docs/25 measured ZERO mastery celebrations in a year for this learner,
    // because every celebration was gated at MASTERED_THRESHOLD (0.85).
    // Breakthrough fires at STRUGGLING_THRESHOLD (0.55), which they DO cross.
    const profiles: Profile[] = [
      { ...base, name: 'struggling', learnRate: 0.06, attendance: 0.6, retentionHalfLife: 25 },
      { ...base, name: 'average', learnRate: 0.16, attendance: 0.6 },
    ];
    const rows: Record<string, unknown>[] = [];

    for (const [i, p] of profiles.entries()) {
      srand(7700 + i);
      const r = runLearner(p, 365);

      // Walk the log in 20-question sessions and count celebration-eligible ones.
      let masteryMoments = 0;
      let breakthroughMoments = 0;
      let chapterMoments = 0;
      let sessionsWithHeadline = 0;
      let sessions = 0;

      for (let cut = 0; cut + 20 <= r.state.log.length; cut += 20) {
        const before = r.state.log.slice(0, cut);
        const after = r.state.log.slice(0, cut + 20);
        const now = after[after.length - 1].answeredAt;
        const rep = buildSessionReport({
          before, after, cls: p.cls, now, ledger: rebuildProgression(before).ledger,
        });
        sessions++;
        if (rep.mastered.length > 0) masteryMoments++;
        if (rep.breakthroughs.length > 0) breakthroughMoments++;
        if (rep.chaptersCompleted.length > 0) chapterMoments++;
        if (headline(rep, 'en')) sessionsWithHeadline++;
      }

      const celebrated = masteryMoments + breakthroughMoments + chapterMoments;
      rows.push({
        profile: p.name, sessions,
        mastery: masteryMoments,
        breakthrough: breakthroughMoments,
        chapter: chapterMoments,
        totalCelebrations: celebrated,
        sessionsWithSomethingToSay: `${sessionsWithHeadline}/${sessions}`,
        headlineCoverage: `${(sessionsWithHeadline / sessions * 100).toFixed(0)}%`,
      });
    }

    console.log('\n===== T1 · CELEBRATION REACH AFTER TIER 1 =====');
    console.log(table(rows));

    const struggling = rows[0] as { totalCelebrations: number; sessions: number };
    // docs/25 measured 0. This asserts the mechanism reaches the learner it was
    // built for...
    expect(struggling.totalCelebrations).toBeGreaterThan(0);
    // ...and that it stays RARE. Gating on the XP ledger's high-water mark
    // means a threshold pays once per skill, so decay-driven re-crossings do
    // not fire again: without that guard 82% of sessions triggered a
    // full-screen celebration, which is the "celebrating everything means
    // nothing" failure `celebrationRules.ts` explicitly warns about.
    expect(struggling.totalCelebrations / struggling.sessions).toBeLessThan(0.35);
  }, 900_000);
});

describe('T2 · every session now has something true to say', () => {
  it('the results screen is never blank for an engaged learner', () => {
    srand(4321);
    const r = runLearner({ ...base, name: 'average', learnRate: 0.16, attendance: 0.7 }, 120);
    let withHeadline = 0, withReturnHook = 0, sessions = 0;

    for (let cut = 0; cut + 20 <= r.state.log.length; cut += 20) {
      const before = r.state.log.slice(0, cut);
      const after = r.state.log.slice(0, cut + 20);
      const now = after[after.length - 1].answeredAt;
      const rep = buildSessionReport({
        before, after, cls: '4th', now, ledger: rebuildProgression(before).ledger,
      });
      sessions++;
      if (headline(rep, 'en')) withHeadline++;
      if (returnSentence(rep, 'en')) withReturnHook++;
    }

    console.log('\n===== T2 · SESSION-END CONTENT =====');
    console.log(`sessions: ${sessions}`);
    console.log(`with a headline ("X is secure now" / "Fractions 62% → 71%"): ${withHeadline} (${(withHeadline / sessions * 100).toFixed(0)}%)`);
    console.log(`with a forward hook ("N skills ready tomorrow"): ${withReturnHook} (${(withReturnHook / sessions * 100).toFixed(0)}%)`);
    console.log('Before Tier 1 both were 0% — the screen showed score and stars only.');

    // The engine should have something honest to report in the large majority
    // of sessions. Not all: a session of pure consolidation genuinely moved
    // nothing, and inventing a message there would devalue every real one.
    expect(withHeadline / sessions).toBeGreaterThan(0.5);
  }, 900_000);
});

describe('T3 · the report never overstates', () => {
  it('reports no movement when nothing moved', () => {
    // The guard against the opposite failure: a screen that always finds
    // something to celebrate is a screen whose praise means nothing.
    const rep = buildSessionReport({ before: [], after: [], cls: '4th', now: Date.now() });
    expect(rep.improvements).toHaveLength(0);
    expect(rep.mastered).toHaveLength(0);
    expect(rep.breakthroughs).toHaveLength(0);
    expect(headline(rep, 'en')).toBeNull();
    expect(returnSentence(rep, 'en')).toBeNull();
  });

  it('every reported threshold crossing is real', () => {
    srand(99);
    const r = runLearner({ ...base, name: 'avg', learnRate: 0.2, attendance: 0.8 }, 180);
    for (let cut = 0; cut + 20 <= r.state.log.length; cut += 20) {
      const before = r.state.log.slice(0, cut);
      const after = r.state.log.slice(0, cut + 20);
      const now = after[after.length - 1].answeredAt;
      const rep = buildSessionReport({
        before, after, cls: '4th', now, ledger: rebuildProgression(before).ledger,
      });
      for (const m of rep.mastered) {
        expect(m.before).toBeLessThan(MASTERED_THRESHOLD);
        expect(m.after).toBeGreaterThanOrEqual(MASTERED_THRESHOLD);
      }
      for (const b of rep.breakthroughs) {
        expect(b.before).toBeLessThan(STRUGGLING_THRESHOLD);
        expect(b.after).toBeGreaterThanOrEqual(STRUGGLING_THRESHOLD);
      }
      for (const i of rep.improvements) expect(i.delta).toBeGreaterThan(0);
    }
  }, 900_000);
});
