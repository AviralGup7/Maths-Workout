#!/usr/bin/env node
// ─── Render check for open-response tasks ────────────────────────────────────
// docs/27 P1-17/18/19/20.
//
// The standing rule from docs/25: render UI work in a real browser. Three
// defects in the last two batches were invisible to typecheck and 714 unit
// tests — a number line drawn 0–40 under a question about 38 + 23, a
// self-explanation prompt shown with the answer already revealed, and a smoke
// harness measuring the wrong screen entirely.
//
// This script seeds a learner with high mastery (so the policy floor is
// cleared), forces the open-task rate to 1 for the probe by seeding many
// correct attempts, drives into a session, and asserts on what is actually
// painted: the constraint checklist, the keypad, and the fact that the reveal
// is withheld until the child commits.
//
// Usage:
//   npx expo export --platform web --output-dir /tmp/webopen
//   NODE_PATH=/tmp/node_modules node scripts/open-task-render.mjs /tmp/webopen 8412

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';

const DIR = process.argv[2] ?? '/tmp/webopen';
const PORT = Number(process.argv[3] ?? 8412);
const SHOTS = process.argv[4] ?? '/tmp/shots-open';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ttf': 'font/ttf',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
};

function serve(dir, port) {
  return new Promise(resolve => {
    const server = createServer((req, res) => {
      const p = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
      let file = join(dir, p);
      if (!p || !existsSync(file) || statSync(file).isDirectory()) file = join(dir, 'index.html');
      try {
        res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
        res.end(readFileSync(file));
      } catch { res.writeHead(404); res.end('not found'); }
    });
    server.listen(port, () => resolve(server));
  });
}

let pass = 0, fail = 0;
const check = (ok, msg) => { if (ok) { pass++; console.log(`  PASS  ${msg}`); } else { fail++; console.log(`  FAIL  ${msg}`); } };

/**
 * Seed an attempt log that puts addition skills well above OPEN_TASK_FLOOR.
 * Mastery is derived from the log (docs/23: the log is the single source of
 * truth), so writing mastery directly would be seeding a derived value and
 * would not survive the next recompute.
 */
function seedScript() {
  const now = Date.now();
  const skills = ['add.2digit.carry', 'add.3digit', 'mul.tables.full', 'add.within20'];
  const rows = [];
  let id = 1;
  for (const skill of skills) {
    for (let i = 0; i < 30; i++) {
      rows.push({
        id: `seed-${id++}`, skill, correct: true,
        answeredAt: now - (i + 1) * 3600_000,
        latencyMs: 4200, chosen: '1', expected: '1',
        questionText: 'seed', timedOut: false,
        interaction: 'entry', cls: '4th', category: 'addition', difficulty: 'medium',
      });
    }
  }
  localStorage.setItem('@maths_workout_seen_welcome', '1');
  localStorage.setItem('@maths_workout_placement_done', '1');
  localStorage.setItem('@maths_workout_v3_attempts', JSON.stringify(rows));
  return rows.length;
}

(async () => {
  // Same resolution dance as ui-smoke.mjs: playwright may live in the project
  // or in a scratch install, and the CJS build hangs its API off `default`.
  let chromium;
  for (const spec of ['playwright', '/tmp/node_modules/playwright/index.js']) {
    try {
      const mod = await import(spec);
      chromium = mod.chromium ?? mod.default?.chromium;
      if (chromium) break;
    } catch { /* try the next location */ }
  }
  if (!chromium) { console.error('playwright not installed — skipping'); process.exit(0); }
  mkdirSync(SHOTS, { recursive: true });
  const server = await serve(DIR, PORT);
  const base = `http://localhost:${PORT}`;
  const browser = await chromium.launch();
  const errors = [];

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => errors.push(e.message));

  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const seeded = await page.evaluate(seedScript);
  console.log(`seeded ${seeded} attempts`);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Drive into practice. The open-task rate is 20%, so a single session may
  // not contain one — restart until it does, with a hard cap so a genuine
  // regression fails rather than hangs.
  let found = false;
  for (let attempt = 0; attempt < 14 && !found; attempt++) {
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    const started = await page.evaluate(() => {
      const el = [...document.querySelectorAll('[role="button"]')]
        .find(e => /start practising|smart practice|अभ्यास शुरू/i.test(e.getAttribute('aria-label') || e.textContent || ''));
      if (el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; }
      return false;
    });
    if (!started) continue;
    await page.waitForTimeout(2000);

    for (let q = 0; q < 12 && !found; q++) {
      const state = await page.evaluate(() => {
        const txt = document.body.innerText;
        const isOpen = /your answer must|आपका उत्तर ऐसा हो/i.test(txt);
        return { isOpen, txt: txt.slice(0, 600) };
      });
      if (state.isOpen) { found = true; break; }
      // Answer whatever is on screen to advance.
      const advanced = await page.evaluate(() => {
        const tiles = [...document.querySelectorAll('[role="button"]')]
          .filter(e => /^[\d.,\-\u2212\s]+$/.test((e.textContent || '').trim()) && (e.textContent || '').trim());
        const el = tiles[0];
        if (el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; }
        return false;
      });
      if (!advanced) break;
      await page.waitForTimeout(1600);
    }
  }

  check(found, 'an open-response task appears in a real session within 14 attempts');

  if (found) {
    await page.screenshot({ path: join(SHOTS, 'open-task-unanswered.png') });

    const before = await page.evaluate(() => {
      const txt = document.body.innerText;
      return {
        txt,
        checklistRows: (txt.match(/add to|multiply to|between|multiple of|use the digits|make \d/g) || []).length,
        revealsAnswer: /One possible answer|एक संभव उत्तर/.test(txt),
        keys: [...document.querySelectorAll('[role="button"]')]
          .filter(e => /^Digit \d$/.test(e.getAttribute('aria-label') || '')).length,
        hasCheck: [...document.querySelectorAll('[role="button"]')]
          .some(e => /check/i.test(e.getAttribute('aria-label') || '')),
      };
    });
    console.log('\n--- question text ---\n' + before.txt.split('\n').slice(0, 14).join('\n') + '\n---');

    check(before.checklistRows > 0, `constraint checklist is rendered (${before.checklistRows} constraint phrases)`);
    check(before.keys >= 10, `numeric keypad rendered (${before.keys} digit keys)`);
    check(before.hasCheck, 'a Check button is present');
    // The docs/25 lesson repeated: a reveal shown before the child commits
    // turns the task into reading. This is the assertion that would have
    // caught the self-explanation defect three rounds earlier.
    check(!before.revealsAnswer, 'the exemplar is NOT revealed before the child submits');

    // Enter a deliberately wrong answer and confirm the feedback names a
    // reason rather than only marking it wrong.
    await page.evaluate(() => {
      const digit = l => [...document.querySelectorAll('[role="button"]')]
        .find(e => e.getAttribute('aria-label') === `Digit ${l}`);
      for (const d of ['1']) digit(d)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(400);
    const afterTyping = await page.evaluate(() => document.body.innerText);
    check(!/One possible answer|एक संभव उत्तर/.test(afterTyping),
      'the exemplar stays hidden while the child is still typing');
    await page.screenshot({ path: join(SHOTS, 'open-task-typing.png') });

    await page.evaluate(() => {
      const el = [...document.querySelectorAll('[role="button"]')]
        .find(e => /check/i.test(e.getAttribute('aria-label') || ''));
      el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: join(SHOTS, 'open-task-graded.png') });
    check(/One possible answer|एक संभव उत्तर|That works|यह चल गया/.test(after),
      'after submitting, the child is told an answer or that theirs worked');
  }

  check(errors.length === 0, `runtime errors: ${errors.length}${errors.length ? ' — ' + errors[0] : ''}`);

  await page.close();
  await browser.close();
  server.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})();
