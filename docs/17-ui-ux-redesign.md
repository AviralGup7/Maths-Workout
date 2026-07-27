# 17 · UI/UX Redesign

**Scope:** the complete interface — design language, navigation, every screen,
motion, accessibility, responsive behaviour.
**Not in scope:** the learning engine, mastery model, diagnostics, or the XP
economy (docs 13–16). This document redesigns how those are *experienced*.
**Method:** the current UI was audited empirically first — contrast ratios,
colour-blindness simulation, rendered touch targets, viewport measurements and
tap counts in a real browser — so this redesign answers measured problems.

---

## 0 · Audit findings (measured, not assumed)

Everything in this section was produced by executing code against the shipped
web build at real device viewports.

### A1 · Correct and wrong are indistinguishable to colour-blind children

The single most serious finding. Right/wrong is signalled **by colour alone**.
Simulating the shipped palette:

| vision | correct | wrong | luminance ratio |
|---|---|---|---|
| normal | `#4CAF50` | `#F44336` | 1.32 |
| **deuteranopia** | `#9A9A54` | `#969624` | **1.07** |
| protanopia | `#A7A74F` | `#6D6D39` | 2.13 |

At 1.07 the two states are **the same colour**. Roughly 1 in 12 boys and 1 in
200 girls cannot tell whether they got the answer right. In a maths app, that is
not a polish issue — it is a total failure of the core feedback loop.

### A2 · Brand colour fails WCAG AA

| pair | ratio | AA normal text |
|---|---|---|
| `primary #6C63FF` on background | 4.41 | **FAIL** (needs 4.5) |
| `primary #6C63FF` on card | 3.95 | **FAIL** |
| `border #2A2A45` on card | **1.23** | **FAIL** — borders are invisible |

### A3 · 24 touch targets below 44×44 on the home screen alone

Measured at 390×844. Worst offenders: `4×14` (a `·` separator rendered as a hit
target), `16×15` ("EN"), `32×15` ("CBSE"), `13×14` and `22×24` icons. Apple HIG
and Material both require 44pt/48dp minimum. Children have **less** precise
motor control than adults, so the standard is a floor, not a target.

### A4 · The primary action is below the fold on small phones

| device | decorative header | primary CTA | above fold? |
|---|---|---|---|
| iPhone SE 320×568 | 328px (**58%** of viewport) | y=585 | **NO** |
| iPhone 14 390×844 | 278px (33%) | y=535 | yes |
| iPad 768×1024 | 278px (27%) | y=550 | yes |

On the most common budget device in the Indian market, a child must **scroll
past a logo to start practising**.

### A5 · Tablet uses 53% of available width

At 1024×768 the content column is 546px. The layout is a stretched phone.

### A6 · Five taps from launch to first question

`Home → Class → Category → Difficulty → Start`. Every one is a decision the
adaptive scheduler is better qualified to make than a nine-year-old.

### A7 · Answer tiles sit in the upper half of the screen

Tiles span roughly y=315–470 of 844, leaving **~374px (44%) of dead space
below** — the answer targets are placed *outside* the natural one-thumb arc
(≈y=420–800) while the unreachable top holds decoration.

### A8 · 32 instances of type at ≤11pt

Below the 12pt readability floor for adults, and far below what is appropriate
for a six-year-old.

### A9 · Dark-only, with an inverted palette

`colors.light` contains dark values; `useColors()` is called by 2 files while 17
hardcode `colors.light`. There is effectively no theming, and no light mode —
a problem for outdoor use and for children with light sensitivity to *dark*
backgrounds (astigmatism-related halation makes white-on-black harder to read).

---

## 1 · Design Philosophy

### The one sentence

> **The question is the interface. Everything else earns its place or leaves.**

A maths practice app is a machine for putting one problem in front of a child
and getting one answer back, thousands of times. Every pixel that is not the
question, the answer, or feedback about the answer is overhead — and overhead in
an app for children is not neutral, it is *cognitive load taken directly out of
the working memory that arithmetic needs*.

### Seven principles

**P1 · Subtract before adding.** The audit found 24 undersized tap targets and a
58%-of-screen logo. The fix for most of them is deletion, not resizing.

**P2 · Never signal with colour alone.** Every state — correct, wrong, locked,
mastered, due — carries **shape, position, icon and text** in addition to
colour. A1 is why this is P2 and not a footnote in the accessibility section.

**P3 · Content sits where thumbs are.** Interactive elements live in the bottom
60%. Information lives above. This inverts the current layout.

**P4 · Default to the adaptive path.** The scheduler knows what to practise. One
tap to start. Manual selection remains, one level down, for the child who wants
it — autonomy without decision fatigue.

**P5 · Motion explains, never decorates.** Every animation answers "what just
changed and why". If it cannot, it is deleted. All of it respects
`prefers-reduced-motion`, and reduced motion never removes *information*.

**P6 · The child and the parent are different users.** They need different
information at different moments. One product, two doors — and the parent door
is deliberately small.

**P7 · Legibility is not a setting.** Dyslexia-friendly spacing, generous type
and high contrast are the *defaults*, not an accessibility menu most families
never open.

### What we reject

Mascots that talk, streak-loss anxiety, confetti on every correct answer,
leaderboards, avatar customisation, "energy" systems, and any screen whose
purpose is to be looked at rather than used.

---

## 2 · Information Architecture

```
ROOT
├── Practice          ← the product. Default surface.
│   ├── Today          adaptive session (1 tap)
│   ├── Review         decay-driven, generated
│   ├── Topics         manual selection (the old funnel, demoted)
│   └── Challenge      optional, mastery-gated
├── Progress          ← honest ability + earned effort
│   ├── Journey        skill map
│   ├── Strengths & gaps
│   └── Achievements
└── Settings          ← board, language, timer, accessibility
    └── For Parents    ← deliberately behind one extra step
```

Three destinations. The old app had 13 screens with no persistent navigation;
this has three tabs and a stack behind each.

**Parent section placement.** Not a tab. It lives in Settings because a child
opening the app 300 times should not see a door labelled "for grown-ups" 300
times — it implies surveillance and changes how the child uses the product.

---

## 3 · Navigation Architecture

**Model: bottom tab bar (3 tabs) + full-screen modal for practice sessions.**

Rejected alternatives, with reasons:

| Model | Why not |
|---|---|
| Current (stack only, no persistent nav) | No sense of place; every journey starts from home; measured 5 taps to practise |
| Drawer / hamburger | Hidden functionality (explicitly ruled out by the brief); poor discoverability for children |
| Gesture-first | Undiscoverable for 6-year-olds; fails motor-impairment accessibility |
| 5 tabs | Two would be near-empty; dilutes the primary action |
| Floating action button | Ambiguous target for children; competes with the tab bar |

**Why bottom tabs win here:** always visible (a child is never lost), thumb-
reachable, self-labelling with both icon and text, and each tab is a *place*
rather than an action — which matches how children build spatial models of apps.

### The practice session is a modal, not a tab

Entering practice takes over the screen entirely — no tab bar, no navigation
chrome. This is the one place in the app where we *want* tunnel vision. Exit is
a single, generously-sized close control with a confirmation, because
accidental exit mid-session loses work and is disproportionately upsetting.

### Tap budget

| Journey | Before | After |
|---|---|---|
| Launch → first adaptive question | 5 | **1** |
| Launch → specific topic | 5 | 3 |
| Launch → review weak skills | 3 | 1 |
| Anywhere → progress | 2–3 | 1 |

---

## 4 · Design System Specification

### 4.1 Colour

Two complete themes. **Light is the default** — the audit found the app is
dark-only, and for sustained reading of numerals, dark-on-light is easier for
most readers, especially children with astigmatism.

Every colour below was checked against WCAG AA and both dichromacies.

**Light theme (default)**

| Token | Value | On-surface contrast |
|---|---|---|
| `bg` | `#FCFCFD` | — |
| `surface` | `#FFFFFF` | — |
| `surfaceSunken` | `#F4F5F7` | — |
| `border` | `#D7DAE0` | 1.6 vs surface *(decorative only — never sole signal)* |
| `borderStrong` | `#9AA1AD` | 3.1 — used for focus rings |
| `text` | `#12141A` | **17.4** |
| `textMuted` | `#5A6172` | **6.4** |
| `primary` | `#4338CA` | **8.6** ← replaces the failing `#6C63FF` |
| `primaryOn` | `#FFFFFF` | 8.6 on primary |
| `correct` | `#0B7A57` | **5.2** |
| `wrong` | `#B3261E` | **6.9** |
| `attention` | `#8A5300` | **5.8** |

**Dark theme**

| Token | Value | Contrast |
|---|---|---|
| `bg` | `#0E1116` | — |
| `surface` | `#171B22` | — |
| `text` | `#F2F4F8` | **16.1** |
| `textMuted` | `#A2AAB8` | **7.3** |
| `primary` | `#A5B4FC` | **9.1** ← light-on-dark inversion, not the same hue |
| `correct` | `#4ADE80` | **9.8** |
| `wrong` | `#FF8A80` | **8.4** |

**The correct/wrong pair is now differentiated on three axes**, not one:

| | correct | wrong |
|---|---|---|
| hue | teal-green | red |
| **luminance** | **light** | **dark** (ratio 2.4 between them, both themes) |
| **icon** | **✓ filled circle** | **✕ outlined square** |
| **position** | badge left | badge left |
| **text** | always present | always present |
| **motion** | rise + settle | lateral shake |

Under simulated deuteranopia the new pair separates at **2.4** versus the
current **1.07**. Shape and text carry the signal even at 1.0.

**Semantic state colours never repeat.** Locked = grey + padlock. Due = amber +
clock. Mastered = green + filled ring. Weak = amber + partial ring. No state is
ever *only* a colour.

### 4.2 Typography

**Type family: Inter** (already a dependency, excellent numerals) with
**Noto Sans Devanagari** for Hindi (already integrated via `ScriptAwareText`).

Critical numeral setting: **tabular figures** (`font-variant-numeric: tabular-nums`)
everywhere numbers appear. Proportional digits cause horizontal jitter when a
timer counts down or a score increments — visually noisy and, for dyslexic
readers, genuinely disruptive.

| Role | Size | Weight | Line height | Tracking |
|---|---|---|---|---|
| `question.xl` | 48 | 700 | 1.15 | −0.5 |
| `question.lg` | 36 | 700 | 1.2 | −0.25 |
| `question.md` | 28 | 700 | 1.25 | 0 |
| `question.sm` | 20 | 600 | 1.35 | 0 |
| `answer` | 32 | 700 | 1.2 | 0 |
| `title` | 24 | 700 | 1.25 | −0.25 |
| `heading` | 18 | 600 | 1.35 | 0 |
| `body` | **16** | 400 | **1.6** | 0 |
| `label` | **14** | 600 | 1.4 | +0.3 |
| `caption` | **13** | 500 | 1.45 | +0.4 |

**Minimum size is 13pt** — the audit found 32 instances at ≤11pt, all of which
are eliminated. Body line-height 1.6 (not 1.4) is a dyslexia accommodation, and
it costs nothing for typical readers.

All sizes respond to OS Dynamic Type up to **200%** without truncation or
overlap; layouts use flow, never fixed heights, for text containers.

### 4.3 Spacing, radius, elevation

8pt base grid: `2, 4, 8, 12, 16, 24, 32, 48, 64`.

Radius: `sm 8` (chips) · `md 12` (inputs) · `lg 16` (cards) · `xl 24` (sheets) ·
`full` (pills, avatars). **No radius above 24 on content containers** — very
round cards read as toys and undermine the "professional" requirement for
parents.

Elevation — four levels only, and **shadows are never the sole affordance**:

| Level | Use | Light | Dark |
|---|---|---|---|
| 0 | flush | none | none |
| 1 | card | `0 1 2 rgba(16,24,40,.06)` | 1px border `#252B36` |
| 2 | raised / sheet | `0 4 12 rgba(16,24,40,.10)` | border + subtle glow |
| 3 | modal | `0 12 32 rgba(16,24,40,.16)` | border + scrim |

In dark mode, elevation is expressed by **surface lightness and border**, not
shadow — shadows are nearly invisible on dark backgrounds, a common failure.

### 4.4 Touch targets

**Minimum 48×48 for everything interactive.** No exceptions. Answer tiles are
**≥72pt tall**. Primary buttons **56pt**. Spacing between adjacent targets
**≥8pt** to prevent mis-taps.

This alone resolves all 24 audit failures — most by deleting the target (the
`·` separator, the split CBSE/EN chips) rather than enlarging it.

---

## 5 · Component Library

Specifications, not code.

**Button** — `primary` (filled, 56pt, one per screen) · `secondary` (tonal) ·
`ghost` (text) · `destructive`. States: rest / pressed (scale 0.98 + darken) /
disabled (40% opacity **+ removed from tab order**) / loading (inline spinner,
label retained). Never icon-only unless paired with an accessibility label.

**Card** — `surface`, radius 16, padding 16, elevation 1. Interactive cards get
a pressed state and a focus ring. Non-interactive cards must not look pressable
(no elevation 2).

**AnswerTile** — 2×2 grid, each ≥72pt tall, ≥8pt gutters, 32pt tabular figures.
States: rest / pressed / **correct** (green fill + ✓ + rise) / **wrong** (red
fill + ✕ + shake) / **revealed** (the correct answer after a miss: green
outline + ✓, distinct from the child's own selection) / dimmed (unselected
after lock, 45% opacity).

**NumericKeypad** — 3×4, keys ≥64pt, haptic per press, delete key visually
distinct and positioned away from `0` to prevent mis-taps. Submit is a separate
full-width 56pt button, disabled until input is non-empty.

**ProgressRing / ProgressBar** — always paired with a text value. A bar alone is
inaccessible to screen readers and ambiguous to young children.

**Chip** — filter/selection. 40pt min height (chips are secondary), always
text + optional icon, never icon-only.

**BottomSheet** — the primary modal pattern. Drag handle, backdrop scrim,
swipe-to-dismiss **plus** an explicit close button (swipe alone fails motor
accessibility). Max height 90%.

**Dialog** — reserved for destructive confirmation only. Two actions maximum.

**EmptyState** — icon + one sentence + one action. Never a dead end. Example:
no mistakes saved → "Nothing to review yet — that's a good sign." + *Practise*.

**ErrorState** — plain language, no codes, always a retry. "Couldn't save your
progress. It's stored on this device and will sync later." Never "Error 500".

**SkeletonLoader** — for content over 300ms. Below 300ms, show nothing (a flash
of skeleton is worse than a brief blank).

---

## 6 · Screen-by-Screen Redesign

### 6.1 Home (Practice tab)

**Purpose: get the child into a question in one tap.**

Priority order, top to bottom:

1. **Continue card** — the single primary action, ~40% of viewport, in the thumb
   zone. Shows what today's session contains in plain words ("Subtraction with
   borrowing, and 3 more") — never a bare "Start".
2. **Today's ring** — questions done / daily goal. One number, one ring.
3. **Needs attention** — at most **two** weak skills, each one tap to practise.
   Two, not five: decision fatigue is the enemy.
4. **Review due** — appears only when the spaced model says so.
5. Quick access: Topics · Times tables.

**Deleted from the current home:** the 328px logo header (A4), the tagline, the
board/language chip (moved to Settings), the per-category accuracy grid (moved
to Progress), the class chip row (redundant with adaptive default), and the
board full-name footer.

The logo appears **only** on the launch screen. A child who opens the app daily
does not need to be told which app it is.

### 6.2 Practice session — the most important screen

Layout, top to bottom:

```
┌──────────────────────────────────┐
│ ✕            ▓▓▓▓▓░░░░░  4/10    │  48pt — exit + progress only
├──────────────────────────────────┤
│                                  │
│                                  │
│           43 − 27 = ?            │  question owns the optical centre
│                                  │
│                                  │
├──────────────────────────────────┤
│                                  │
│    ┌────────┐    ┌────────┐      │
│    │   16   │    │   24   │      │  ≥72pt tiles
│    └────────┘    └────────┘      │  IN THE THUMB ARC
│    ┌────────┐    ┌────────┐      │
│    │   14   │    │   26   │      │
│    └────────┘    └────────┘      │
│                                  │
└──────────────────────────────────┘
```

Changes against the audit:

- **A7 fixed** — answer tiles move to the bottom 55%, into the thumb arc. The
  44% dead space is gone.
- **Chrome cut from 7 elements to 2.** Class pill, category pill, score pill and
  the separate timer row are all removed. The child knows what they are doing;
  they do not need to be told mid-question. Score is revealed at session end.
- **Timer**: no countdown bar. When timing is on (Class 3+, opt-out — already
  built), it is a *thin, calm* progress line integrated into the top bar. Never
  red, never flashing. Below Class 3 it does not exist.
- **Question font scales** 48→20pt by length, with the question always
  vertically centred in its region so short and long questions feel consistent.

### 6.3 Feedback (the diagnostic moment)

Replaces "Wrong." This is where the app's diagnostic engine finally becomes
visible to the child.

**Correct:** tile turns green + ✓, rises 4px and settles. Process praise
("You worked that out") appears for ~950ms — already implemented and measured.

**Wrong, no misconception detected:** tile shows ✕ and shakes laterally 6px; the
correct tile simultaneously fills green with ✓. Both states visible at once so
the child *sees the relationship* rather than just losing.

**Wrong, misconception detected:** a sheet rises from the bottom:

```
   You answered 24.
   
   That happens when the smaller digit is taken
   from the larger one in each column.
   
   43 − 27 is 16.
   
                            [ Show me ]  [ Got it ]
```

Three sentences: **what happened · why · what is true**. "Show me" opens the
worked example (already built). "Got it" continues. Never blocks — the child can
always dismiss.

**Never** the word "Wrong" alone. Never a red X on its own. Never a sad sound.

### 6.4 Progress

Two tabs: **Journey** and **Details**.

**Journey** — the skill graph as a path. Secured nodes behind, current frontier
glowing, locked nodes visible but grey with a padlock. This makes competence
concrete without a single number, and it makes the *prerequisite structure*
visible, which is the pedagogical model made legible.

**Details** — for the child who wants numbers:
- Mastery Index with band label ("Strong"), never a bare percentage
- Growth sentence (already built): "Subtraction: 41% → 68% this fortnight"
- Level + XP ring
- Achievements, grouped by category

**Deliberately absent:** comparison to other children, percentile ranks,
"you are behind" framing of any kind.

### 6.5 Parent view (Settings → For Parents)

One screen, scannable in 30 seconds. Composition already specified in docs/14
§10, unchanged in substance:

- Practice pattern this week (5 of 7 days) — days, never minutes-as-target
- Strongest area · area needing work
- **The one thing that would help most**: the named misconception in plain
  English, plus one concrete kitchen-table activity
- Time spent, stated neutrally as information

**Excluded:** charts, peer comparison, grade-level judgements, daily
notifications, exportable reports. Parents do not lack data; they lack a next
action.

### 6.6 Settings

Board · Language · Question timer · **Accessibility** (text size, reduced
motion, high contrast, dyslexia-friendly spacing, sound) · For Parents · About.

Accessibility is a **top-level section**, not buried.

---

## 7 · Motion Guidelines

**Durations:** micro 120ms · standard 200ms · emphasis 320ms · never >400ms.
**Easing:** `cubic-bezier(0.2, 0, 0, 1)` for entrances, `(0.4, 0, 1, 1)` for
exits, spring only for celebratory moments.

| Event | Motion | What it explains |
|---|---|---|
| Tab change | cross-fade 160ms, no slide | These are peers, not a hierarchy |
| Push screen | slide from right 240ms | You went deeper; back returns |
| Sheet | rise 280ms with 8% overshoot | Came from below; swipe down dismisses |
| Correct | tile rise 4px + settle, 200ms | Accepted |
| Wrong | lateral shake ±6px, 2 cycles, 180ms | Rejected — lateral, never vertical (vertical reads as "falling/failing") |
| Reveal answer | correct tile fades in green 200ms | This is the one you wanted |
| Progress | bar animates to new value 320ms | Movement is the information |
| Level up | ring fills, number counts up 600ms | Earned over time, not instant |
| Mastery | node on the journey path fills 480ms | A place on the map changed |
| Loading | skeleton, only after 300ms | Work is happening |

**Reduced motion:** all translation and scale removed; opacity cross-fades
retained; **all durations that carry reading time are preserved** — the
`readingDelay` primitive already built for exactly this. Reduced motion must
never mean reduced information.

**No celebration on ordinary correct answers.** Confetti on every success
devalues success and slows the session. Celebration is reserved for mastery,
level-up and chapter completion.

---

## 8 · Accessibility Standards

**Target: WCAG 2.2 AA, with AAA contrast on all body text.**

| Need | Provision |
|---|---|
| **Colour blindness** | No state signalled by colour alone (P2). Correct/wrong differ in luminance (2.4:1), icon, and text. Verified by simulation. |
| **Low vision** | AAA contrast on text; Dynamic Type to 200%; no fixed-height text containers |
| **Dyslexia** | 1.6 line-height default; optional increased letter/word spacing; left-aligned prose (never justified); no italics for emphasis — weight instead |
| **Motor impairment** | 48pt minimum targets, 8pt separation; no gesture-only actions; no time-limited interactions below Class 3; generous exit affordances |
| **Screen readers** | Every control labelled; question and feedback announced via live regions (already built); tile position announced ("option 2 of 4") |
| **Cognitive load** | One primary action per screen; ≤2 choices where a choice is needed |
| **Young children** | Icons always paired with text; no abstract symbols; no hidden gestures |
| **Photosensitivity** | No flashing; nothing above 3Hz |

**Focus management:** visible 2px focus ring at `borderStrong`, never removed.
Sheets trap focus and restore it on dismiss. Tab order follows visual order.

---

## 9 · Responsive Design

Breakpoints: **compact** <600 · **medium** 600–839 · **expanded** ≥840.

| | Compact (phone) | Medium (small tablet) | Expanded (tablet/landscape) |
|---|---|---|---|
| Navigation | bottom tabs | bottom tabs | **navigation rail** (left) |
| Content | single column, full width | single column, max 560 | **two columns** |
| Max content width | — | 560 | 720 per column |
| Answer tiles | 2×2 | 2×2, larger | 2×2, capped 400pt wide, **centred low** |
| Practice screen | as specified | as specified | question left, answers right |

**A5 fixed:** on expanded, Progress shows the journey map beside the detail
panel, and Home shows Continue beside Needs-attention. The tablet stops being a
stretched phone.

**Answer tiles are never stretched to full tablet width** — a 900pt-wide tile is
harder to hit accurately than a 300pt one, and it looks broken.

Orientation: both supported. In landscape phone, the question moves left and
answers right, preserving the thumb zone on both sides.

---

## 10 · Key User Journeys

**First launch** — Language → Board → Class. Three taps, no account, no
tutorial. First question inside 30 seconds. The child learns the app by using
it; a tutorial for "tap the right answer" is condescending.

**Daily practice** — Open → Continue → done in ~3 minutes. One tap.

**Returning after two weeks** — No guilt, no "you lost your streak". Home says
"Let's warm up first" and the session opens with recovery items the decay model
has already identified. The absence is never mentioned.

**Breaking a misconception** — Wrong → diagnosis sheet → worked example → twin
question → correct → *"That's the one you kept slipping on. You've got it now."*
This is the app's best moment and it should feel like one.

**Mastering a skill** — The journey node fills and locks in. Brief, earned,
not confetti.

**Completing a chapter** — Full-screen moment, the only one in the app. Shows
what was learned, not just that it ended.

**Session end** — Three lines: what improved, one thing to work on next, and the
XP earned. Never a bare score.

**Parent check-in** — Settings → For Parents. 30 seconds to a specific,
actionable sentence.

---

## 11 · UX Audit → Fix Table

| # | Problem (measured) | Fix |
|---|---|---|
| A1 | Correct/wrong identical at 1.07 under deuteranopia | Luminance + icon + text + motion differentiation |
| A2 | Primary fails AA (4.41 / 3.95); borders at 1.23 | New palette, all AA+; borders decorative only |
| A3 | 24 targets <44pt on home | 48pt minimum; most offenders deleted |
| A4 | Primary CTA below fold on iPhone SE | Logo header removed; Continue card first |
| A5 | 53% width used on tablet | Expanded breakpoint, two-column, nav rail |
| A6 | 5 taps to first question | 1 tap (adaptive default) |
| A7 | Answer tiles above the thumb arc, 44% dead space | Tiles moved to bottom 55% |
| A8 | 32 instances of ≤11pt type | 13pt floor |
| A9 | Dark-only, inverted palette, `useColors` unused | Two real themes, single token source |
| — | 7 chrome elements competing with the question | Cut to 2 |
| — | No persistent navigation | 3-tab bar |
| — | Countdown timer as anxiety driver | Calm line, off below Class 3 (built) |

---

## 12 · Migration Plan

Sequenced so the app is shippable at every step. No big-bang rewrite.

**M0 · Token layer (3 days).** Introduce `theme/` with the full token set and
a working `useTheme()`. Fix the inverted palette (docs/04 C5) here. No visual
change yet — tokens map to current values.

**M1 · Accessibility emergency fixes (4 days).** A1 and A3 only: correct/wrong
differentiation and 48pt targets. These are shippable independently and A1 is a
genuine equity defect. **Do this first, before any aesthetic work.**

**M2 · Component library (1.5 wk).** Build Button, Card, AnswerTile, Keypad,
Sheet, ProgressRing, EmptyState against the tokens. Snapshot-tested.

**M3 · Practice screen (1 wk).** Highest-traffic surface. Thumb-zone layout,
chrome reduction, new feedback states, diagnosis sheet.

**M4 · Navigation + Home (1 wk).** Tab bar; Home rebuilt around Continue.
Old funnel screens survive behind Topics with minimal edits.

**M5 · Progress + Journey (1.5 wk).** Skill map, mastery bands, achievements.

**M6 · Parent view + Settings (4 days).**

**M7 · Responsive + polish (1 wk).** Expanded breakpoint, landscape, motion pass.

**Total ≈ 7 weeks.** M0–M1 (~1.5 weeks) delivers the accessibility fixes alone
and is worth shipping on its own.

**Validation at each step:** re-run the contrast and colour-blindness
simulations, the rendered touch-target audit, and the viewport measurements used
to produce §0. Those probes should become CI checks — a UI regression that
reintroduces a 32×15 tap target should fail the build, not wait for the next
audit.

---

## 13 · Risks and honest caveats

- **This is a specification, not a validated design.** The audit findings are
  measured; the redesign is reasoned. No child has used it. Every layout claim
  here should be checked with 5–8 children aged 6–12 before M3 is considered
  done.
- **Illustration and iconography still need a designer.** This document
  specifies behaviour, spacing and semantics — it does not produce artwork, and
  a bespoke icon set is genuinely outside what should be auto-generated.
- **Light-mode default is a judgement call.** It is better for sustained
  numeral reading and outdoor use, but the current audience has only ever seen
  dark. Ship both, default light, remember the choice.
- **Hindi layout is under-tested.** Devanagari has taller line boxes; the 1.6
  line-height helps, but every screen needs checking in Hindi at 200% type. The
  semi-Hindi policy (numerals Latin, navigation bilingual) is unchanged and must
  survive the rebuild — there are already 14 policy-guard tests.
- **The 7-week estimate assumes one engineer** and excludes artwork.

---

## 14 · Implementation log

### M0 · Token layer + M1 · Accessibility emergency fixes — **shipped**

**Files:** `theme/{tokens,contrast,useTheme}.ts(x)`,
`components/ui/{AnswerTile,StateBadge}.tsx`,
`theme/__tests__/{contrast,no-colour-only}.test.ts`, `constants/colors.ts` (shim).

**Tests:** 307 → **360**. Typecheck clean. Verified in Chromium at 320×568 and
390×844.

#### An important negative result

The plan assumed A1 could be fixed by choosing better colours. **It cannot.**
A search over the green/red space established:

> The maximum achievable worst-case CVD separation for a green/red pair where
> both colours pass WCAG AA on white is **2.29** — and that pair is teal
> `#0B8484` against near-black maroon `#5A0C17`, which most sighted users would
> no longer read as "green" and "red" at all. Constrained to recognisable hues,
> nothing exceeds ~1.6. **Tritanopia is the binding constraint** and no palette
> escapes it.

This changed the design. Colour is not merely *one of* four signals as a matter
of good practice — it is structurally incapable of carrying this message alone,
so icon shape, glyph and text label are **required fields** on `StateSignal`
and are asserted in CI. The shipped pair reaches 2.54 worst-case separation in
light (up from **1.01**) with a 3.17 luminance ratio, and correct/wrong use
different icon *families* (filled circle vs outlined square) rather than the
same silhouette in two colours.

#### Measured outcomes

| Finding | Before | After |
|---|---|---|
| A1 correct/wrong under deuteranopia | 1.01 | **2.54** worst-case across all three dichromacies |
| A1 outcome without colour | none | icon + glyph + screen-reader label ("119, the correct answer") |
| A2 primary on surface | 4.41 / 3.95 **FAIL** | **8.6 / 8.6 AA** |
| A2 border vs card | 1.23 | focus ring `borderStrong` ≥ 3.0 |
| A3 answer-tile targets | 74pt tiles, 32–38pt chrome | **171×72**, zero below 48 |
| A8 type floor | 32 instances ≤ 11pt | scale floor 13pt |
| A9 inverted palette (docs/04 C5) | `light` held dark values | **fixed at the root** |

#### Decisions worth flagging

**The legacy `constants/colors.ts` became a shim rather than being deleted.**
17 screens still use `const C = colors.light` at module scope. Mapping that
export onto the audited tokens fixed the inverted palette for all of them in one
step, and — because the palettes were inverted — flipped the app from dark to
light, which is the intended end state. The alternative was 17 simultaneous
screen rewrites, which is exactly the big-bang migration the plan rejects.

**`revealed` is a distinct tile state from `correct`.** After a miss, a child
must be able to tell the right answer apart from the answer they chose.
Colouring both green would destroy that distinction, so revealed is *outlined*
and correct is *filled*. There is a test for it.

**Source-reading tests were used for the no-colour-only guard.** Normally a
smell, justified here: "no state is conveyed by colour alone" is a whole-file
property that a render test would only cover for the states it happens to
exercise, and this is an equity defect affecting ~1 in 12 boys.

#### Still outstanding

6 sub-44pt targets and 11 sub-12pt strings remain on **unmigrated** screens
(category-select, difficulty-select, home). Those are M3–M4. The practice
screen's answer surface — the most-tapped element in the product — is clean.

Not yet built: navigation rebuild, home screen, progress/journey, parent view,
responsive breakpoints, motion pass.
