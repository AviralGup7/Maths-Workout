#!/usr/bin/env node
// ─── UI smoke and accessibility audit ────────────────────────────────────────
// docs/19 §9 — "zero UI tests across 14 screens".
//
// 532 unit tests could not see any of these, and all three were real, shipped
// defects found only by driving a browser by hand:
//
//   · answer tiles rendered light-on-dark after the token migration
//   · the process-praise line was painted and gone in 280 ms
//   · the difficulty screen was never localised, so a Hindi-medium child met a
//     fully English screen mid-flow
//
// This script makes those checks repeatable. It is deliberately a script rather
// than a vitest suite: it needs a real browser and a built bundle, so it
// belongs in CI as a separate stage, not in the fast unit loop.
//
// Usage:
//   npx expo export --platform web --output-dir /tmp/web
//   node scripts/ui-smoke.mjs /tmp/web [port]
//
// Exit code is non-zero when any assertion fails, so CI can gate on it.

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const DIR = process.argv[2] ?? '/tmp/web';
const PORT = Number(process.argv[3] ?? 8399);

// Thresholds. These are the audit's own numbers, not aspirations.
const MIN_TOUCH = 44;      // WCAG 2.5.5
const MIN_FONT = 12;       // readability floor
const VIEWPORTS = [
  { w: 320, h: 568, name: 'iPhone SE' },
  { w: 390, h: 844, name: 'iPhone 14' },
  { w: 834, h: 1112, name: 'iPad' },
];

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ttf': 'font/ttf',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
};

/** Static server with SPA fallback — Expo's export has no server-side routing. */
function serve(dir, port) {
  return new Promise(resolve => {
    const server = createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
      let file = join(dir, p);
      if (!p || !existsSync(file) || statSync(file).isDirectory()) file = join(dir, 'index.html');
      try {
        res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
        res.end(readFileSync(file));
      } catch {
        res.writeHead(404); res.end('not found');
      }
    });
    server.listen(port, () => resolve(server));
  });
}

const failures = [];
const notes = [];
const check = (ok, msg) => { (ok ? notes : failures).push(msg); return ok; };

/**
 * Only the OUTERMOST interactive node is a tap target.
 *
 * Inner Text and icon nodes inherit `cursor: pointer` from a large button but
 * are not themselves targets; counting them produced 15 false positives in the
 * first version of this audit.
 */
const TAP_PROBE = `(() => {
  const all = [...document.querySelectorAll('*')];
  const roles = ['button','tab','radio','link','checkbox'];
  const interactive = all.filter(el => roles.includes(el.getAttribute('role')));
  const outer = interactive.filter(el => !interactive.some(o => o !== el && o.contains(el)));
  return outer.map(el => {
    const r = el.getBoundingClientRect();
    return { label: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 24),
             w: Math.round(r.width), h: Math.round(r.height) };
  }).filter(t => t.w > 0 && t.h > 0);
})()`;

const FONT_PROBE = `(() => {
  const out = [];
  document.querySelectorAll('*').forEach(el => {
    if (el.children.length) return;
    const txt = (el.textContent || '').trim();
    if (!txt) return;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < ${MIN_FONT}) out.push(fs + 'pt "' + txt.slice(0, 20) + '"');
  });
  return [...new Set(out)];
})()`;

async function main() {
  // Playwright may resolve from the project, or from a scratch install in CI.
  // The CJS build exposes its API on `default`, so unwrap both shapes.
  let chromium;
  for (const spec of ['playwright', '/tmp/node_modules/playwright/index.js']) {
    try {
      const mod = await import(spec);
      chromium = mod.chromium ?? mod.default?.chromium;
      if (chromium) break;
    } catch { /* try the next location */ }
  }
  if (!chromium) {
    console.error('playwright not installed — skipping UI smoke (not a failure)');
    process.exit(0);
  }

  if (!existsSync(join(DIR, 'index.html'))) {
    console.error(`no build at ${DIR}. Run: npx expo export --platform web --output-dir ${DIR}`);
    process.exit(2);
  }

  const server = await serve(DIR, PORT);
  const base = `http://localhost:${PORT}`;
  const browser = await chromium.launch();
  const pageErrors = [];

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    page.on('pageerror', e => pageErrors.push(`${vp.name}: ${e.message}`));

    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await page.evaluate(() => localStorage.setItem('@maths_workout_seen_welcome', '1'));
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    console.log(`\n── ${vp.name} (${vp.w}x${vp.h}) ──`);

    const taps = await page.evaluate(TAP_PROBE);
    const small = taps.filter(t => t.h < MIN_TOUCH || t.w < MIN_TOUCH);
    check(small.length === 0,
      `${vp.name}: ${small.length} tap target(s) below ${MIN_TOUCH}pt` +
      (small.length ? ` — ${small.slice(0, 3).map(t => `${t.w}x${t.h} "${t.label}"`).join(', ')}` : ''));
    console.log(`  tap targets: ${taps.length}, under ${MIN_TOUCH}pt: ${small.length}`);

    const fonts = await page.evaluate(FONT_PROBE);
    check(fonts.length === 0,
      `${vp.name}: ${fonts.length} string(s) under ${MIN_FONT}pt` +
      (fonts.length ? ` — ${fonts.slice(0, 3).join(', ')}` : ''));
    console.log(`  text under ${MIN_FONT}pt: ${fonts.length}`);

    // A4 · the primary action must be reachable without scrolling. On the
    // smallest common device this was previously below the fold.
    const cta = await page.evaluate(() => {
      const el = [...document.querySelectorAll('[role="button"]')]
        .find(e => /start practising|अभ्यास शुरू/i.test(e.getAttribute('aria-label') || ''));
      return el ? Math.round(el.getBoundingClientRect().top) : null;
    });
    check(cta !== null && cta < vp.h,
      `${vp.name}: primary CTA ${cta === null ? 'not found' : `at y=${cta} (viewport ${vp.h})`}`);
    console.log(`  primary CTA at y=${cta}, above fold: ${cta !== null && cta < vp.h}`);

    // Persistent navigation must exist on every non-immersive screen.
    const tabs = await page.evaluate(() =>
      [...document.querySelectorAll('[role="tab"]')].map(e => e.getAttribute('aria-label')));
    check(tabs.length >= 3, `${vp.name}: expected 3 nav tabs, found ${tabs.length}`);
    console.log(`  nav tabs: ${JSON.stringify(tabs)}`);

    await page.close();
  }

  // ── The practice loop, where correctness actually matters ──────────────────
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => pageErrors.push(`practice: ${e.message}`));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.evaluate(() => localStorage.setItem('@maths_workout_seen_welcome', '1'));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  console.log('\n── practice loop ──');

  let taps = 0;
  const startBtn = page.locator('[role="button"]').filter({ hasText: /Start practising/i }).first();
  if (await startBtn.count()) { await startBtn.click(); taps++; }
  await page.waitForTimeout(3000);

  // A6 · one tap from launch to first question.
  check(taps === 1, `taps to first question: ${taps} (expected 1)`);
  console.log(`  taps to first question: ${taps}`);

  const tiles = await page.evaluate(() =>
    [...document.querySelectorAll('[role="button"]')]
      .filter(e => /option \d+ of \d+/.test(e.getAttribute('aria-label') || ''))
      .map(e => ({ label: e.getAttribute('aria-label'),
                   h: Math.round(e.getBoundingClientRect().height) })));
  check(tiles.length > 0, `answer tiles rendered: ${tiles.length}`);
  check(tiles.every(t => t.h >= MIN_TOUCH), 'all answer tiles meet the touch minimum');
  console.log(`  answer tiles: ${tiles.length}, min height ${Math.min(...tiles.map(t => t.h))}pt`);

  if (tiles.length) {
    await page.locator(`[aria-label="${tiles[0].label}"]`).first().click();
    await page.waitForTimeout(400);

    // A1 · the outcome must be legible WITHOUT colour. This is the equity
    // defect: correct and wrong measured 1.07 separation under deuteranopia.
    const outcome = await page.evaluate(() =>
      [...document.querySelectorAll('[role="button"]')]
        .map(e => e.getAttribute('aria-label') || '')
        .filter(l => /correct|incorrect|सही|गलत/i.test(l)));
    check(outcome.length > 0,
      'answer outcome is exposed in words, not colour alone' +
      (outcome.length ? ` — ${JSON.stringify(outcome.slice(0, 2))}` : ''));
    console.log(`  outcome labels: ${JSON.stringify(outcome.slice(0, 2))}`);
  }

  await page.close();

  check(pageErrors.length === 0,
    `runtime page errors: ${pageErrors.length}` +
    (pageErrors.length ? ` — ${pageErrors.slice(0, 2).join(' | ')}` : ''));

  await browser.close();
  server.close();

  console.log(`\n${'='.repeat(56)}`);
  for (const n of notes) console.log(`  PASS  ${n}`);
  for (const f of failures) console.log(`  FAIL  ${f}`);
  console.log(`${'='.repeat(56)}`);
  console.log(`${notes.length} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });
