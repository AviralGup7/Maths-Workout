#!/usr/bin/env node
// ─── Architecture guard ──────────────────────────────────────────────────────
// docs/19 §13 — "promote the audit scripts to CI".
//
// The V2 audit measured four structural properties that took real discipline to
// achieve. Properties that are not enforced decay, and they decay silently: a
// single convenient import can introduce a cycle, and nobody notices until the
// next audit months later.
//
// This script re-derives those measurements and fails the build when they
// regress. It is fast (no build step, no browser) so it belongs in the normal
// CI lane alongside typecheck.
//
// Usage:  node scripts/arch-check.mjs

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Intended layering, low (pure data) to high (UI).
 *
 * A module may import from its own rank or below. The whole point of the
 * ordering is that the domain never depends on the framework.
 */
const RANK = {
  i18n: 0, constants: 0, theme: 0, lib: 0,
  generators: 1, curriculum: 1,
  learning: 2, progression: 3,
  hooks: 4, context: 5, components: 6, app: 7,
};

/**
 * Known, reviewed upward edges.
 *
 * These are type and identifier dependencies, not behavioural coupling:
 * `SkillId` and the misconception catalogue are shared vocabulary that the
 * content layer legitimately needs. They are allow-listed rather than ignored
 * so a NEW one has to be justified rather than slipping in unnoticed.
 */
const ALLOWED_UPWARD = new Set([
  'generators/arithmetic.ts -> learning/skills.ts',
  'generators/arithmetic.ts -> learning/misconceptions.ts',
  'generators/reasoning.ts -> learning/misconceptions.ts',
  'curriculum/chapters.ts -> learning/skills.ts',
  'lib/progressApi.ts -> generators/index.ts',
  // docs/27 P2-01/02/03. The sub-skill classifier is shared by the router and
  // the migration ON PURPOSE — two copies would drift, and a migration that
  // disagreed with the router would move a child's history onto skills they
  // are never served again. Same category as the edges above: shared
  // vocabulary, not behavioural coupling.
  'generators/index.ts -> learning/skillSplit.ts',
]);

/** Layers that must never touch React or React Native. */
const PURE_LAYERS = ['learning', 'progression', 'generators', 'curriculum', 'i18n'];

/** Hard ceiling on the public surface of a single React context. */
const MAX_CONTEXT_MEMBERS = 60;

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (['node_modules', '.expo', 'dist', '.bench', 'scripts'].includes(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

const files = walk(ROOT).filter(f => !f.includes('__tests__') && !f.includes('__sim__'));
const rel = f => relative(ROOT, f);
const layerOf = f => {
  const r = rel(f);
  return Object.keys(RANK).find(l => r.startsWith(l + '/')) ?? null;
};

function resolveImport(from, spec) {
  let base;
  if (spec.startsWith('@/')) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(from), spec);
  else return null;
  for (const c of [base + '.ts', base + '.tsx', join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(c)) return c;
  }
  return null;
}

const edges = new Map();
const sources = new Map();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  sources.set(f, src);
  const set = new Set();
  for (const m of src.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)) {
    const t = resolveImport(f, m[1]);
    if (t && t !== f) set.add(t);
  }
  edges.set(f, set);
}

const failures = [];
const passes = [];
const report = (ok, msg) => (ok ? passes : failures).push(msg);

// ── 1 · No circular dependencies ─────────────────────────────────────────────
{
  const WHITE = 0, GREY = 1, BLACK = 2;
  const colour = new Map(files.map(f => [f, WHITE]));
  const cycles = [];
  const stack = [];
  const visit = u => {
    colour.set(u, GREY); stack.push(u);
    for (const v of edges.get(u) ?? []) {
      if (!colour.has(v)) continue;
      if (colour.get(v) === GREY) {
        cycles.push(stack.slice(stack.indexOf(v)).map(rel).concat(rel(v)).join(' -> '));
      } else if (colour.get(v) === WHITE) visit(v);
    }
    stack.pop(); colour.set(u, BLACK);
  };
  for (const f of files) if (colour.get(f) === WHITE) visit(f);
  report(cycles.length === 0,
    `circular dependencies: ${cycles.length}` + (cycles.length ? `\n      ${cycles.slice(0, 5).join('\n      ')}` : ''));
}

// ── 2 · No new upward layering edges ─────────────────────────────────────────
{
  const unexpected = [];
  for (const f of files) {
    const a = layerOf(f);
    if (a === null) continue;
    for (const t of edges.get(f) ?? []) {
      const b = layerOf(t);
      if (b === null || RANK[b] <= RANK[a]) continue;
      const edge = `${rel(f)} -> ${rel(t)}`;
      if (!ALLOWED_UPWARD.has(edge)) unexpected.push(edge);
    }
  }
  report(unexpected.length === 0,
    `unreviewed upward dependencies: ${unexpected.length}` +
    (unexpected.length ? `\n      ${[...new Set(unexpected)].slice(0, 5).join('\n      ')}` : ''));
}

// ── 3 · The domain stays framework-free ──────────────────────────────────────
// This is the property everything else rests on: it is why the engine can be
// unit tested and simulated without a renderer, and why the UI has been
// replaced twice without touching learning logic.
{
  const tainted = [];
  for (const f of files) {
    const layer = layerOf(f);
    if (!PURE_LAYERS.includes(layer)) continue;
    const imports = (sources.get(f).match(/^\s*import[^;]+;/gm) ?? []).join('\n');
    if (/from\s+['"]react(-native)?['"]/.test(imports)) tainted.push(rel(f));
  }
  report(tainted.length === 0,
    `domain modules importing React/RN: ${tainted.length}` +
    (tainted.length ? `\n      ${tainted.join('\n      ')}` : ''));
}

// ── 4 · No context grows back into a god object ──────────────────────────────
{
  const offenders = [];
  for (const f of files) {
    if (!rel(f).startsWith('context/')) continue;
    const m = sources.get(f).match(/interface\s+\w*ContextType\s*\{([\s\S]*?)\n\}/);
    if (!m) continue;
    const members = (m[1].match(/^\s{2}[a-zA-Z_]\w*[?]?\s*:/gm) ?? []).length;
    if (members > MAX_CONTEXT_MEMBERS) offenders.push(`${rel(f)} exposes ${members} members`);
  }
  report(offenders.length === 0,
    `contexts over ${MAX_CONTEXT_MEMBERS} members: ${offenders.length}` +
    (offenders.length ? `\n      ${offenders.join('\n      ')}` : ''));
}

// ── 5 · No module-scope palette constants ────────────────────────────────────
// docs/20 F1. `const C = colors.light` at module scope is evaluated once at
// import, before any preference can be read, so a screen written that way can
// never honour the theme. That defect left dark mode non-functional on 10 of 12
// screens while the app advertised a dark preference in settings.
{
  const offenders = [];
  for (const f of files) {
    const src = sources.get(f);
    if (/^const\s+C\s*=\s*colors\./m.test(src)) offenders.push(rel(f));
    if (/^import\s+colors\s+from/m.test(src)) offenders.push(rel(f));
  }
  report(offenders.length === 0,
    `modules resolving colour at import time: ${offenders.length}` +
    (offenders.length ? `\n      ${[...new Set(offenders)].join('\n      ')}` : ''));
}

// ── 6 · No unreachable subsystems ────────────────────────────────────────────
// docs/20 F2. A domain module whose ONLY importer is a test file is a feature
// that is specified, built, tested and documented — but that no user can reach.
// That is more dangerous than dead code, because the suite is green and the
// docs record it as delivered.
{
  const DOMAIN = ['learning/', 'progression/', 'curriculum/'];
  const testFiles = walk(ROOT).filter(f => f.includes('__tests__'));
  const testSrc = testFiles.map(f => readFileSync(f, 'utf8')).join('\n');
  const dark = [];
  for (const f of files) {
    const r = rel(f);
    if (!DOMAIN.some(d => r.startsWith(d))) continue;
    if (r.includes('__tests__')) continue;
    const stem = r.split('/').pop().replace(/\.tsx?$/, '');
    const importedByProd = files.some(g => g !== f && (edges.get(g) ?? new Set()).has(f));
    if (importedByProd) continue;
    // Referenced by a test but by no production module.
    if (new RegExp(`/${stem}'`).test(testSrc)) dark.push(`${r} (only imported by tests)`);
  }
  report(dark.length === 0,
    `unreachable domain modules: ${dark.length}` +
    (dark.length ? `\n      ${dark.join('\n      ')}` : ''));
}

// ── 7 · Storage keys go through the manifest ─────────────────────────────────
// An unmanifested key has no version and no validator, and its failure mode is
// silent: JSON.parse succeeds, the shape is wrong, behaviour degrades elsewhere.
{
  const manifest = readFileSync(join(ROOT, 'lib/storage.ts'), 'utf8');
  const declared = new Set([...manifest.matchAll(/'(@maths_workout[^']*)'/g)].map(m => m[1]));
  const used = new Map();
  for (const f of files) {
    if (rel(f) === 'lib/storage.ts') continue;
    for (const m of sources.get(f).matchAll(/'(@maths_workout[^']*)'/g)) {
      if (!declared.has(m[1])) used.set(m[1], rel(f));
    }
  }
  report(used.size === 0,
    `storage keys missing from the manifest: ${used.size}` +
    (used.size ? `\n      ${[...used].map(([k, f]) => `${k}  (${f})`).join('\n      ')}` : ''));
}

console.log('\nArchitecture guard\n' + '='.repeat(56));
for (const p of passes) console.log(`  PASS  ${p}`);
for (const f of failures) console.log(`  FAIL  ${f}`);
console.log('='.repeat(56));
console.log(`${files.length} modules checked · ${passes.length} passed, ${failures.length} failed\n`);
process.exit(failures.length ? 1 : 0);
