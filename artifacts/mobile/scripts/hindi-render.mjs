#!/usr/bin/env node
// ─── Hindi render check ──────────────────────────────────────────────────────
// Drives a real session with the language set to Hindi and reads the question
// text off the painted screen.
//
// Unit tests call the generators directly. This asserts on what a child
// actually sees, which is a different claim: the language has to survive the
// store, the context, the dispatcher AND the render. The bug this guards
// against was invisible to 704 unit tests because none of them passed `lang`.

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';

const DIR = process.argv[2] ?? '/tmp/webhi';
const PORT = Number(process.argv[3] ?? 8710);
const SHOTS = process.argv[4] ?? '/tmp/shots-hi';

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

// Units, acronyms and signage that stay Latin in Hindi by policy.
const ALLOWED = /\b(km|kg|cm|mm|mL|L|g|m|STOP|HCF|LCM|CBSE|ICSE)\b/g;

(async () => {
  let chromium;
  for (const spec of ['playwright', '/tmp/node_modules/playwright/index.js']) {
    try {
      const mod = await import(spec);
      chromium = mod.chromium ?? mod.default?.chromium;
      if (chromium) break;
    } catch { /* next */ }
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
  await page.evaluate(() => {
    localStorage.setItem('@maths_workout_seen_welcome', '1');
    localStorage.setItem('@maths_workout_placement_done', '1');
    // readEnum stores the bare string, not JSON — seeding JSON.stringify('hi')
    // writes \"hi\" with quotes, which fails the allow-list and silently falls
    // back to English. Found by rendering, not by reading the code.
    localStorage.setItem('@maths_workout_lang', 'hi');
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const home = await page.evaluate(() => document.body.innerText);
  check(/[\u0900-\u097F]/.test(home), 'the home screen renders Devanagari');
  await page.screenshot({ path: join(SHOTS, 'hi-home.png') });

  // Walk a session and collect the question text actually painted.
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('[role="button"]')]
      .find(e => /start practising|अभ्यास/i.test(e.getAttribute('aria-label') || e.textContent || ''));
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(2500);

  const seen = [];
  for (let i = 0; i < 8; i++) {
    const q = await page.evaluate(() => {
      const tiles = [...document.querySelectorAll('[role="button"]')]
        .filter(e => /option \d+ of \d+/.test(e.getAttribute('aria-label') || ''));
      return { text: document.body.innerText, tiles: tiles.map(t => t.getAttribute('aria-label')) };
    });
    if (q.tiles.length) seen.push(q.text);
    if (i === 0) await page.screenshot({ path: join(SHOTS, 'hi-question.png') });
    const moved = await page.evaluate(() => {
      const t = [...document.querySelectorAll('[role="button"]')]
        .filter(e => /option \d+ of \d+/.test(e.getAttribute('aria-label') || ''));
      if (t[0]) { t[0].dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; }
      return false;
    });
    if (!moved) break;
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('[role="button"]')]
        .find(e => /slipped|मुझसे|Sure|पक्का/i.test((e.getAttribute('aria-label') || e.textContent || '')));
      b?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(900);
  }

  check(seen.length >= 3, `collected ${seen.length} painted question screens`);

  // Strip the chrome we know is bilingual-by-policy, then look for English words.
  const englishy = seen.filter(s => {
    const body = s
      .split('\n')
      .filter(l => !/^(Class|कक्षा)/.test(l) && l.trim() !== '')
      .join(' ')
      .replace(ALLOWED, '');
    return /[A-Za-z]{4,}/.test(body);
  });
  if (englishy.length) console.log('  sample:', JSON.stringify(englishy[0].slice(0, 200)));
  check(englishy.length === 0, `${englishy.length} of ${seen.length} painted screens contained English words`);

  const devanagari = seen.filter(s => /[\u0900-\u097F]/.test(s));
  check(devanagari.length === seen.length, `${devanagari.length}/${seen.length} screens render Devanagari`);

  const devDigits = seen.filter(s => /[०-९]/.test(s));
  check(devDigits.length === 0, `${devDigits.length} screens used Devanagari numerals (must be 0 — semi-Hindi policy)`);

  // Devanagari matras (ि, ो, ै) and the shirorekha sit ABOVE the base glyph.
  // A line box smaller than the font size clips them, which does not look like
  // a bug in Latin and is unreadable in Hindi: "कितने" rendered with the
  // i-matra detached. The stylesheet had a fixed lineHeight of 32 against a
  // font size that scales to 44.
  const lineBoxes = await page.evaluate(() =>
    [...document.querySelectorAll('*')]
      .filter(e => e.children.length === 0 && /[\u0900-\u097F]/.test(e.textContent || ''))
      .map(e => {
        const cs = getComputedStyle(e);
        return {
          text: (e.textContent || '').slice(0, 24),
          size: parseFloat(cs.fontSize),
          line: cs.lineHeight === 'normal' ? parseFloat(cs.fontSize) * 1.2 : parseFloat(cs.lineHeight),
        };
      }));
  const clipped = lineBoxes.filter(b => b.line < b.size * 1.15);
  if (clipped.length) console.log('  clipped:', JSON.stringify(clipped.slice(0, 3)));
  check(clipped.length === 0,
    `${clipped.length} Devanagari elements have a line box too short for their glyphs`);

  check(errors.length === 0, `runtime errors: ${errors.length}${errors.length ? ' — ' + errors[0] : ''}`);

  await page.close();
  await browser.close();
  server.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})();
