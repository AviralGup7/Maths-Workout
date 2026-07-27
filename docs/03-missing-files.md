# 03 · Missing Files — Forensic Reconstruction

The single commit in this repository is titled **"Clean project history"**. That
cleanup deleted six workspace packages from disk but left **every reference to
them intact**. The lockfile in particular is a complete fossil record: it still
describes each deleted package's exact dependency set, which lets us
reconstruct what was removed with high confidence.

---

## 1. The evidence

`pnpm-lock.yaml` declares **10 importers** (workspace packages). Only **2**
exist on disk:

```console
$ grep -n "^  [a-z@./_-]*:$" pnpm-lock.yaml
8:    default:
149:  .:                          ✅ EXISTS (workspace root)
158:  artifacts/api-server:       ❌ MISSING
210:  artifacts/mobile:           ✅ EXISTS
345:  artifacts/mockup-sandbox:   ❌ MISSING
522:  lib/api-client-react:       ❌ MISSING
528:  lib/api-spec:               ❌ MISSING
534:  lib/api-zod:                ❌ MISSING
540:  lib/db:                     ❌ MISSING
565:  scripts:                    ❌ MISSING
```

Cross-checked against the filesystem:

```console
$ for d in lib lib/db lib/api-client-react lib/api-zod lib/api-spec scripts \
           artifacts/api-server artifacts/mockup-sandbox; do
    [ -e "$d" ] && echo "EXISTS:  $d" || echo "MISSING: $d"
  done
MISSING: lib
MISSING: lib/db
MISSING: lib/api-client-react
MISSING: lib/api-zod
MISSING: lib/api-spec
MISSING: scripts
MISSING: artifacts/api-server
MISSING: artifacts/mockup-sandbox
```

The entire `lib/` tree, the entire backend, and the root `scripts/` package are
gone.

---

## 2. What each missing package was

### 2.1 `artifacts/api-server` — the REST backend 🔴

Reconstructed from lockfile lines 158–207:

```yaml
artifacts/api-server:
  dependencies:
    '@workspace/api-zod':  { specifier: workspace:*, version: link:../../lib/api-zod }
    '@workspace/db':       { specifier: workspace:*, version: link:../../lib/db }
    cookie-parser:         ^1.4.7
    cors:                  ^2.8.6
    drizzle-orm:           catalog:  (0.45.2, with pg)
    express:               ^5.2.1
    pino:                  ^9.14.0
    pino-http:             ^10.5.0
  devDependencies:
    '@types/cookie-parser', '@types/cors', '@types/express', '@types/node'
    esbuild:               0.27.3
    esbuild-plugin-pino:   ^2.3.3
    pino-pretty:           ^13.1.3
    thread-stream:         3.1.0
```

**Therefore it was:** an Express 5 HTTP API, using Drizzle ORM against
PostgreSQL, structured logging via Pino (with `esbuild-plugin-pino` for
bundling transports), CORS + cookie parsing, bundled to a single file with
esbuild.

**What it served.** `artifacts/mobile/lib/progressApi.ts` is the surviving
client and defines the contract exactly:

```ts
export interface ProgressData {
  highScores:    Record<string, number>;
  progressStats: Record<string, { attempted: number; correct: number }>;
  tablesBest:    Record<string, number>;
  wrongAnswers:  WrongAnswer[];
}

GET  /api/progress/:deviceId  →  ProgressData | 404
POST /api/progress/:deviceId  ←  ProgressData   (fire-and-forget)
```

**Impact:** every call to `fetchProgress` returns `null` and every
`pushProgress` silently fails. Because both are wrapped in `try/catch` that
swallows errors, **the app appears to work** — cross-device sync just never
happens, with no user-visible signal. This is the most insidious consequence of
the deletion.

---

### 2.2 `lib/db` — database schema & client 🔴

```yaml
lib/db:
  dependencies:
    drizzle-orm:  catalog: (0.45.2)
    drizzle-zod:  ^0.8.3
    pg:           ^8.22.0
    zod:          catalog: (3.25.76)
  devDependencies:
    '@types/node', '@types/pg', drizzle-kit: ^0.31.10
```

**Therefore it was:** the Drizzle schema definition plus a `pg` connection
pool. `drizzle-zod` means Zod validators were **derived from the schema**, and
`drizzle-kit` means migrations were version-controlled.

**Inferred schema**, from the `ProgressData` contract:

```ts
// Reconstruction — not recovered source
export const progress = pgTable('progress', {
  deviceId:      text('device_id').primaryKey(),
  highScores:    jsonb('high_scores').$type<Record<string, number>>().notNull().default({}),
  progressStats: jsonb('progress_stats')
                   .$type<Record<string, { attempted: number; correct: number }>>()
                   .notNull().default({}),
  tablesBest:    jsonb('tables_best').$type<Record<string, number>>().notNull().default({}),
  wrongAnswers:  jsonb('wrong_answers').$type<WrongAnswer[]>().notNull().default([]),
  updatedAt:     timestamp('updated_at').defaultNow().notNull(),
});
```

**Also missing:** the `drizzle/` migrations directory and any
`drizzle.config.ts`. Even with the schema rewritten, migration history is
unrecoverable.

---

### 2.3 `lib/api-zod` — shared validation schemas 🟠

```yaml
lib/api-zod:
  dependencies:
    zod: catalog: (3.25.76)
```

A tiny package depended on by **both** `api-server` and (transitively) the
mobile app. This was the shared contract — one Zod schema validating the
request on the server and typing the response on the client. Its absence is why
`progressApi.ts` casts blindly:

```ts
return (await res.json()) as ProgressData;   // ← no runtime validation
```

A malformed or hostile response is accepted as-is and merged straight into
persisted learner state.

---

### 2.4 `lib/api-client-react` — typed React Query client 🔴

```yaml
lib/api-client-react:
  dependencies:
    '@tanstack/react-query': catalog: (5.101.2, react 19.1.0)
```

**This is the package that breaks `pnpm install`.** `artifacts/mobile/package.json`
still declares it:

```json
"@workspace/api-client-react": "workspace:*",
```

pnpm resolves `workspace:*` against the on-disk workspace, finds nothing, and
aborts:

```console
ERR_PNPM_WORKSPACE_PKG_NOT_FOUND  In artifacts/mobile:
"@workspace/api-client-react@workspace:*" is in the dependencies but
no package named "@workspace/api-client-react" is present in the workspace
```

**Key insight from the audit:** the dependency is declared but **never
imported**.

```console
$ grep -rn "@workspace/" artifacts/mobile --include=*.ts --include=*.tsx
(no matches)
```

The app hand-rolls `lib/progressApi.ts` with plain `fetch` instead. So the
dependency is pure dead weight — which is why removing it is safe and is the
recommended fix. It also explains why `@tanstack/react-query` sits in the
catalog but appears nowhere in the app.

---

### 2.5 `lib/api-spec` — OpenAPI codegen 🟡

```yaml
lib/api-spec:
  devDependencies:
    orval: ^8.22.0
```

[Orval](https://orval.dev/) generates typed clients from an OpenAPI document.
So the original pipeline was:

```
OpenAPI spec  ──orval──▶  lib/api-client-react  (React Query hooks)
              └─────────▶  lib/api-zod          (Zod validators)
```

This means `api-client-react` and `api-zod` were **generated artifacts**, not
hand-written. Recovering the spec would regenerate both.

---

### 2.6 `scripts` — workspace tooling 🟡

```yaml
scripts:
  devDependencies:
    '@types/node': catalog:
    tsx:           catalog: (4.23.1)
```

TypeScript scripts executed with `tsx`. Referenced by the root `typecheck`
script:

```json
"typecheck": "pnpm run typecheck:libs && pnpm -r --filter \"./artifacts/**\" --filter \"./scripts\" --if-present run typecheck"
```

The `--if-present` flag means its absence is tolerated here. Contents unknown —
likely seeding, migration running, or codegen orchestration.

---

### 2.7 `artifacts/mockup-sandbox` — design prototype 🟢

Lockfile lines 345–521 (the largest importer). Given the root catalog entries
that nothing else uses:

```yaml
'@tailwindcss/vite', '@vitejs/plugin-react', class-variance-authority,
clsx, framer-motion, lucide-react, tailwind-merge, tailwindcss, vite, wouter
```

**Therefore it was:** a Vite + React web app with Tailwind CSS 4, shadcn-style
utilities (`cva` + `clsx` + `tailwind-merge`), Framer Motion animations, Lucide
icons and Wouter routing — a design sandbox / web mockup.

**Evidence it mattered:** `hooks/useColors.ts` still refers to it in a comment:

> *"When a sibling web artifact's dark tokens are synced into a `dark` key,
> this hook will automatically switch palettes based on the device's appearance
> setting."*

So `constants/colors.ts` was **synced from the mockup**. That sync is very
likely how the palettes came to be inverted — see
[C5](./04-critical-issues.md#c5). Loss severity is low (it was not shipped) but
it explains the theming anomaly.

---

## 3. Dangling references left behind

### 3.1 `tsconfig.json` — three broken project references 🔴

```json
{
  "references": [
    { "path": "./lib/db" },
    { "path": "./lib/api-client-react" },
    { "path": "./lib/api-zod" }
  ]
}
```

Verified failure:

```console
$ tsc --build
error TS5083: Cannot read file '/…/Maths-Workout/lib/db/tsconfig.json'.
error TS5083: Cannot read file '/…/Maths-Workout/lib/api-client-react/tsconfig.json'.
error TS5083: Cannot read file '/…/Maths-Workout/lib/api-zod/tsconfig.json'.
EXIT=1
```

This breaks `pnpm run typecheck` and therefore `pnpm run build`, independently
of the install failure.

### 3.2 `pnpm-workspace.yaml` — three dead globs 🟡

```yaml
packages:
  - artifacts/*          # ✅ matches artifacts/mobile
  - lib/*                # ❌ lib/ does not exist
  - lib/integrations/*   # ❌ never existed even in the lockfile
  - scripts              # ❌ deleted
```

Non-fatal (pnpm tolerates globs matching nothing) but misleading.

### 3.3 Root `package.json` — scripts referencing missing packages 🟡

```json
"typecheck:libs": "tsc --build",
"typecheck": "pnpm run typecheck:libs && pnpm -r --filter \"./artifacts/**\" --filter \"./scripts\" --if-present run typecheck"
```

`typecheck:libs` is meaningless with no libs, and fails hard.

### 3.4 Root catalog — 11 unused entries 🟢

Catalog pins for packages no remaining code uses: `@tailwindcss/vite`,
`@tanstack/react-query`, `@vitejs/plugin-react`, `class-variance-authority`,
`clsx`, `drizzle-orm`, `framer-motion`, `lucide-react`, `tailwind-merge`,
`tailwindcss`, `vite`, `wouter`. Harmless, but noise.

### 3.5 `pnpm-lock.yaml` — describes a workspace that no longer exists 🟠

Beyond the 8 phantom importers, the lockfile is also **out of sync with the one
real package**:

```console
$ pnpm install --frozen-lockfile
ERR_PNPM_OUTDATED_LOCKFILE
  * 2 dependencies are mismatched:
    - expo  (lockfile: ~54.0.27, manifest: ~54.0.36)
    - react (lockfile: catalog:, manifest: 19.1.0)
```

This is a **second, independent** failure — it would break CI even if the
workspace packages existed. Its cause is the duplicated dependency block
described in [C2](./04-critical-issues.md#c2).

---

## 4. Impact matrix

| Missing package | Breaks install | Breaks typecheck | Breaks runtime | Severity |
|-----------------|:--------------:|:----------------:|:--------------:|:--------:|
| `lib/api-client-react` | ✅ **yes** | ✅ yes | no (unused) | 🔴 Blocker |
| `lib/db` | no | ✅ yes | — | 🔴 Blocker (for backend) |
| `lib/api-zod` | no | ✅ yes | — | 🟠 High |
| `artifacts/api-server` | no | no | ⚠️ silent sync failure | 🔴 Blocker (for sync) |
| `lib/api-spec` | no | no | no | 🟡 Medium |
| `scripts` | no | no | no | 🟡 Medium |
| `artifacts/mockup-sandbox` | no | no | no | 🟢 Low |

---

## 5. Recovery options

### Option A — Ship mobile-only (recommended, ~15 min)

Accept that this is a local-first offline app and cleanly remove the sync layer.

1. `artifacts/mobile/package.json` — delete `"@workspace/api-client-react"`,
   delete the duplicated `dependencies` block.
2. `tsconfig.json` — `"references": []`.
3. `pnpm-workspace.yaml` — remove `lib/*`, `lib/integrations/*`, `scripts`.
4. Root `package.json` — drop `typecheck:libs`, simplify `typecheck`.
5. Either delete `lib/progressApi.ts` and its call sites, **or** keep it and
   make the no-backend case explicit (guard on `EXPO_PUBLIC_DOMAIN`).
6. Prune the 11 unused catalog entries.
7. `pnpm install --no-frozen-lockfile` to regenerate the lockfile.

**Verified:** steps 1, 2 and 7 alone produce a clean install (746 packages,
7.3 s) and `tsc --noEmit` with **0 errors**.

### Option B — Rebuild the backend (~1–2 days)

Recreate `lib/db`, `lib/api-zod` and `artifacts/api-server` from the lockfile
dependency sets and the `ProgressData` contract. Skip `lib/api-spec`/orval and
write the client by hand (the app already does). While rebuilding, fix the
design flaws identified in [02 §6](./02-architecture.md#6-synchronisation--conflict-resolution):
authenticate the endpoint, sum counters instead of maxing them, and validate
payloads with Zod.

### Option C — Recover from history

The commit is titled "Clean project history", so the prior history was almost
certainly discarded. Worth attempting before rebuilding:

```bash
git reflog --all
git fsck --lost-found
```

If the author retains the pre-cleanup clone, that is the cheapest recovery.
