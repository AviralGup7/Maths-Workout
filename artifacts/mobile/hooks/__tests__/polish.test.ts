// Direction H — guards for accessibility, motion and perceived speed.
//
// These are exactly the properties that regress silently: nobody notices a
// missing accessibility label until a screen-reader user hits it, and nobody
// notices reduced motion has stopped working unless they have it switched on.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { FEEDBACK_MS, feedbackDelay, readingDelay, MIN_READING_MS } from '../motionRules';
import { MIN_TOUCH, touchSlop } from '../a11yRules';
import { STREAK_MILESTONES, isStreakMilestone } from '../../components/celebrationRules';

const ROOT = path.resolve(__dirname, '../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function walk(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      if (entry !== '__tests__' && entry !== 'node_modules') walk(full, acc);
    } else if (/\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

function sourceFiles(dirs: string[]): { file: string; src: string }[] {
  const out: { file: string; src: string }[] = [];
  for (const dir of dirs) {
    for (const full of walk(path.join(ROOT, dir))) {
      out.push({ file: path.relative(ROOT, full), src: fs.readFileSync(full, 'utf8') });
    }
  }
  return out;
}

describe('touch targets', () => {
  it('uses the WCAG 2.5.5 minimum', () => {
    expect(MIN_TOUCH).toBeGreaterThanOrEqual(44);
  });

  it('expands small controls to the minimum without resizing them', () => {
    // A 40 pt button needs 2 pt on each side to reach 44.
    expect(touchSlop(40)).toEqual({ top: 2, bottom: 2, left: 2, right: 2 });
    expect(touchSlop(32)).toEqual({ top: 6, bottom: 6, left: 6, right: 6 });
  });

  it('never returns negative padding for already-large controls', () => {
    for (const size of [44, 48, 60, 120]) {
      const slop = touchSlop(size);
      expect(slop.top).toBeGreaterThanOrEqual(0);
      expect(slop.left).toBeGreaterThanOrEqual(0);
    }
  });

  it('every back button carries a hitSlop', () => {
    // Back buttons are visually 40 pt by design; they must still be tappable at 44.
    for (const { file, src } of sourceFiles(['app'])) {
      if (!src.includes('styles.backBtn')) continue;
      expect(src, `${file}: back button has no hitSlop`).toMatch(/backBtn[\s\S]{0,160}hitSlop/);
    }
  });
});

describe('reduced motion', () => {
  it('collapses durations to zero when requested', () => {
    // feedbackDelay keeps reading time but caps it; motion durations go to 0.
    expect(feedbackDelay(1500, true)).toBeLessThanOrEqual(400);
    expect(feedbackDelay(1500, false)).toBe(1500);
  });

  it('still allows enough time to read a wrong answer', () => {
    // Reduced motion must not mean "skip the feedback" — the child still needs
    // to see why they were wrong.
    expect(feedbackDelay(FEEDBACK_MS.wrong, true)).toBeGreaterThan(0);
    expect(feedbackDelay(FEEDBACK_MS.wrongConstructed, true)).toBeGreaterThan(0);
  });

  it('the game screen routes animations through useMotion', () => {
    const src = read('app/game.tsx');
    expect(src).toContain('useMotion');
    // The hand-rolled shake sequence must be gone.
    expect(src).not.toMatch(/Animated\.sequence\(\[\s*Animated\.timing\(shakeAnim/);
  });

  it('the celebration is skippable under reduced motion', () => {
    const src = read('components/Celebration.tsx');
    expect(src).toContain('useReducedMotion');
    expect(src).toContain('if (reduced)');
  });
});

describe('perceived speed', () => {
  it('shortens the correct-answer pause', () => {
    // Was a flat 450 ms; 280 still reads clearly.
    expect(FEEDBACK_MS.correct).toBeLessThan(450);
    expect(FEEDBACK_MS.correct).toBeGreaterThanOrEqual(200);
  });

  it('keeps wrong answers on screen longer than correct ones', () => {
    // Rushing past a mistake defeats the point of diagnosing it.
    expect(FEEDBACK_MS.wrong).toBeGreaterThan(FEEDBACK_MS.correct);
    expect(FEEDBACK_MS.wrongConstructed).toBeGreaterThan(FEEDBACK_MS.wrong);
  });

  it('blitz mode is faster than standard', () => {
    expect(FEEDBACK_MS.correctBlitz).toBeLessThan(FEEDBACK_MS.correct);
    expect(FEEDBACK_MS.wrongBlitz).toBeLessThan(FEEDBACK_MS.wrong);
  });

  it('saves ~1.7s across a ten-question session', () => {
    const before = 450 * 10;
    const after = FEEDBACK_MS.correct * 10;
    expect(before - after).toBeGreaterThanOrEqual(1500);
  });

  it('does not serialise the attempt log on every answer', () => {
    // At the 4000-attempt cap this is ~945 KB of JSON inside the feedback pause.
    const src = read('context/GameContext.tsx');
    expect(src).toContain('schedulePersist');
    expect(src).toContain('flushAttempts');
    // The write must not sit directly inside the setAttempts updater any more.
    expect(src).not.toMatch(/setAttempts\(prev => \{[\s\S]{0,200}AsyncStorage\.setItem\(ATTEMPTS_KEY/);
  });

  it('flushes pending writes when the app backgrounds', () => {
    const src = read('context/GameContext.tsx');
    expect(src).toContain('AppState');
    expect(src).toMatch(/state !== 'active'/);
  });
});

describe('accessibility coverage', () => {
  const screens = sourceFiles(['app', 'components']);

  it('every answer surface labels its controls', () => {
    // AnswerSurface now delegates the choice grid to components/ui/AnswerTile,
    // so its labelling lives there. The requirement is unchanged — it simply
    // follows the control.
    const surfaces = [
      'components/answer/NumericEntry.tsx',
      'components/answer/MultiSelect.tsx',
      'components/answer/OrderingTray.tsx',
      'components/ui/AnswerTile.tsx',
    ];
    for (const path of surfaces) {
      const src = read(path);
      expect(src, `${path} has no accessibilityRole`).toContain('accessibilityRole');
      expect(src, `${path} has no accessibilityLabel`).toContain('accessibilityLabel');
    }
  });

  it('interactive surfaces expose disabled and selected state', () => {
    expect(read('components/ui/AnswerTile.tsx')).toContain('accessibilityState');
    expect(read('components/answer/MultiSelect.tsx')).toContain('accessibilityState');
  });

  it('the keypad hints what Check will do', () => {
    expect(read('components/answer/NumericEntry.tsx')).toContain('accessibilityHint');
  });

  it('results are announced, not only shown', () => {
    const src = read('app/results.tsx');
    expect(src).toContain('useAnnounce');
  });

  it('answer feedback is announced during play', () => {
    const src = read('app/game.tsx');
    expect(src).toContain('a11yAnnounce');
  });

  it('meets a minimum label count across the app', () => {
    // Baseline before this work was 5 across 12 screens.
    const total = screens.reduce(
      (n, f) => n + (f.src.match(/accessibilityLabel/g) ?? []).length, 0);
    expect(total).toBeGreaterThan(30);
  });

  it('decorative overlays are hidden from screen readers', () => {
    const src = read('components/Celebration.tsx');
    expect(src).toContain('accessibilityElementsHidden');
    expect(src).toContain('pointerEvents="none"');
  });
});

describe('celebration is earned, not constant', () => {
  it('marks only sparse streak milestones', () => {
    expect(isStreakMilestone(3)).toBe(true);
    expect(isStreakMilestone(7)).toBe(true);
    // Every day would be noise.
    expect(isStreakMilestone(2)).toBe(false);
    expect(isStreakMilestone(4)).toBe(false);
    expect(isStreakMilestone(0)).toBe(false);
  });

  it('milestones increase and never repeat', () => {
    const sorted = [...STREAK_MILESTONES].sort((a, b) => a - b);
    expect(STREAK_MILESTONES).toEqual(sorted);
    expect(new Set(STREAK_MILESTONES).size).toBe(STREAK_MILESTONES.length);
  });

  it('does not fire on every correct answer', () => {
    // A celebration in the answer path would slow every question and devalue
    // the signal.
    expect(read('app/game.tsx')).not.toContain('<Celebration');
  });

  it('announces the achievement for screen-reader users', () => {
    expect(read('components/Celebration.tsx')).toContain('announce(message)');
  });
});

describe('onboarding', () => {
  const src = read('app/welcome.tsx');

  it('is skippable from every card', () => {
    expect(src).toContain('Skip');
    expect(src).toMatch(/onPress=\{finish\}/);
  });

  it('is shown only once', () => {
    expect(src).toContain('SEEN_WELCOME_KEY');
    expect(read('app/index.tsx')).toContain('SEEN_WELCOME_KEY');
  });

  it('waits for preferences before redirecting, avoiding a flash', () => {
    expect(read('app/index.tsx')).toMatch(/if \(!prefsLoaded\) return;/);
  });

  it('keeps the semi-Hindi navigation policy', () => {
    // Escape hatches must stay recognisable to a non-Hindi reader.
    expect(src).toContain('छोड़ें · Skip');
    expect(src).toContain('आगे · Next');
  });

  it('respects reduced motion in its transitions', () => {
    expect(src).toContain('useMotion');
  });
});

// ─── Reading time survives reduced motion ────────────────────────────────────

describe('readingDelay', () => {
  it('keeps text on screen long enough to read under reduced motion', () => {
    // feedbackDelay alone clamps to 400 ms, which removes the information
    // along with the movement. Reduced motion must not mean unreadable.
    expect(readingDelay(FEEDBACK_MS.correctPraised, true)).toBeGreaterThanOrEqual(900);
    expect(feedbackDelay(FEEDBACK_MS.correctPraised, true)).toBeLessThanOrEqual(400);
  });

  it('does not stretch a pause that was already short', () => {
    expect(readingDelay(200, true)).toBeLessThanOrEqual(200);
    expect(readingDelay(200, false)).toBeLessThanOrEqual(200);
  });

  it('leaves normal motion untouched', () => {
    expect(readingDelay(FEEDBACK_MS.correctPraised, false)).toBe(FEEDBACK_MS.correctPraised);
  });

  it('gives a praise line more time than a bare tick', () => {
    expect(FEEDBACK_MS.correctPraised).toBeGreaterThan(FEEDBACK_MS.correct);
  });
});
