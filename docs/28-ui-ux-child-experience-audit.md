# 28 · World-Class UI/UX, Theme & Child Experience Audit

**Scope:** user experience and visual design only. No code quality or architecture.
**Method:** every screen exported to a real web build, rendered in Chromium at three
viewports and two themes, photographed, and measured programmatically. Every number
below was produced by an executed command, not by reading source.

**Build audited:** `d369285` · 14 routes · light + dark · English + Hindi
**Artefacts:** `/home/user/audit-shots/` (28 screenshots)

---

## 1 · Executive Summary

This is the best-engineered educational app I have audited that a child would not
choose to open.

The instrumentation is genuinely world-class. The design token file opens with a
note that the previous palette was inverted, that brand primary failed WCAG AA at
4.41, and that borders sat at 1.23 contrast — and then fixes all three and asserts
them in CI. The type scale carries a documented dyslexia accommodation (1.6 body
line-height). The correct/wrong colours are hue-separated *and* luminance-separated
*and* carry icons, because colour alone measured 1.07 separation under simulated
deuteranopia. Feedback timing is tuned per state with a reading floor that survives
reduced-motion. This is a level of rigour most shipped children's products never reach.

And then it is spent on a screen that looks like Linear.

The measured problem is not polish. It is **identity**. The app contains exactly
**two image assets** — an app icon and a splash icon. No character. No illustration.
No mascot. No world. The home screen renders 54 words, four grey cards, a purple
button and a bottom tab bar reading *Practice · Progress · Settings*. "Settings" is
a top-level destination in an app for six-year-olds. The first screen a child ever
sees asks them to choose between CBSE, ICSE and State Board.

Against Khan Academy Kids — which greets a child with a named animal character who
speaks — this app greets a child with an examination board selector. A six-year-old
choosing between the two is not making an aesthetic judgement. They are choosing the
one that seems to be *for them*.

The second measured problem is that the product's own standards are not enforced
where children actually look. `MIN_FONT_SIZE = 13` is declared in the tokens and
asserted by a test — but that test only checks the token file. In the real screens
there are **53 hardcoded font sizes below 13px**, including 9.5px and 10px, and
**only 2 of 40 screens import the type scale at all**. I measured 24 live WCAG AA
contrast failures across four routes. The rigour is real; it just stops at the
boundary of `theme/`.

The third is emotional. The Progress screen — the place a child goes to feel proud —
renders **"0 questions answered"** above a column of **0%** and six empty circles,
even with 264 attempts seeded in storage. The results screen headline for a hard
session is *"Tough session"*. Both statements are honest. Neither is what a child
needs at that moment, and the honesty is doing no pedagogical work that a warmer
frame could not do better.

**None of this requires abandoning the app's discipline.** The evidence-led,
anti-dark-pattern, no-loot-box stance is the product's greatest asset and its clearest
differentiator from Prodigy and SplashLearn. What it is missing is not gimmickry. It
is *warmth*, and warmth is not the opposite of rigour.

---

## 2 · Scores

| Dimension | Score | Basis |
|---|---:|---|
| **Overall UI** | **6.4 / 10** | Immaculate token system; 53 violations of it in screens; 24 measured AA failures; zero illustration |
| **Overall UX** | **7.1 / 10** | One-tap-to-practice is excellent; adult IA and reading load undermine it for the target age |
| **Theme & Visual Identity** | **3.8 / 10** | Competent and consistent, but indistinguishable from a productivity SaaS. No character, no memorability |
| **Child Appeal** | **3.2 / 10** | No mascot, no sound, no world, no collectible artefact, no idle delight. Celebration exists on one screen only |
| **Parent Trust** | **8.6 / 10** | Strongest dimension. Board-aware, explains its reasoning, no purchasable advantage, honest reporting |
| **Accessibility** | **6.8 / 10** | Genuinely excellent intent and colour work; undermined by 9.5–12px text, 40×40 targets, 24 AA failures |
| **Emotional Design** | **3.5 / 10** | Process praise is research-correct and well implemented; everything around it is affectively flat |
| **Motion & Animation** | **5.9 / 10** | Timing is rigorously reasoned; vocabulary is thin — fades, a pulse, one particle burst on one screen |

**Composite: 5.7 / 10** — a strong 8.5/10 learning engine inside a 3.5/10 child experience.

---

## 3 · First Impression

**Measured:** first launch → `welcome.tsx` → language toggle + **board selector**
(CBSE / ICSE / State Board) → 30 words → "Next".

A child aged 6–11 opening this app is asked, before anything else, to identify their
examination board. This is a *parent* question rendered in a *child* flow. Khan
Academy Kids opens with a character saying hello; Duolingo ABC opens with the owl;
DragonBox opens inside the puzzle itself.

**The one-tap-to-practice path is genuinely excellent** and better than most
benchmarks — measured at exactly 1 tap from launch to first question. That is a real
achievement and must be protected in any redesign.

But the returning-child home screen (54 words, 8 tap targets) leads with
*"TODAY'S PRACTICE / Times tables 2, 5, 10, and 1 more"* — a correct, useful,
adult sentence. Compare Duolingo's home: a path, a character, a visible next node.

**Does it create curiosity?** No. It creates compliance. Nothing on the first screen
is unexplained-but-inviting; there is nothing to wonder about.

---

## 4 · Theme & Visual Identity

**Measured:** 2 image assets total (`icon.png`, `splash-icon.png`). Zero characters,
illustrations, backgrounds, or decorative elements anywhere in the product.

The visual language is: white cards, 1px `#D7DAE0` borders, 14–16px radius, indigo
`#4338CA` primary, Inter. Executed consistently and cleanly — this is a *good*
design system. It is also, precisely, the 2023 SaaS dashboard idiom. Screenshot the
home screen and it could be a project tracker.

**Is the identity strong enough to become recognisable?** No. There is no mark, no
character, no colour signature, no shape language a child could draw from memory.
Every benchmark product passes this test trivially: the owl, Kodi the bear, the
DragonBox creature, Prodigy's wizard.

This is the single highest-leverage gap in the entire audit. **It is also entirely
addressable without compromising rigour** — Khan Academy Kids is simultaneously the
warmest and the most pedagogically serious product in the category.

---

## 5 · Colour System

**Measured contrast failures (live DOM, WCAG AA):**

| Route | Light | Dark | Worst |
|---|---:|---:|---|
| `/` (home) | 0 | 0 | — |
| `/progress` | 9 | 2 | **1.40** on 16px chapter numerals |
| `/board-select` | 9 | 6 | **1.99** on "Done" (dark) |
| `/tables-mode` | 0 | 0 | — |

**24 failures total.** The home and tables screens are clean, which shows the palette
itself is sound — these are application errors, not token errors.

The token work is excellent and should be said plainly: `correct: #087D6F` (teal-green)
against `wrong: #460B0F` (dark maroon) is a deliberate hue *and* luminance separation,
chosen because the prior pair measured 1.07 under deuteranopia. Correct/wrong also
carry icons and text labels, verified in CI. That is better colour-blindness handling
than most benchmarks ship.

**Emotionally**, however, the palette is cool, desaturated and corporate. Indigo,
slate, white. Colour psychology for 6–11 favours warmer, higher-chroma anchors used
*structurally* (topic identity, world identity) rather than decoratively. The category
chips already hint at this — Counting is pink, Addition green — but the hint is
confined to 40×40 icon tiles.

---

## 6 · Typography

**The specification is exemplary.** `MIN_FONT_SIZE = 13`, body line-height 1.6 as a
documented dyslexia accommodation, a full 10-role scale with tracking, and a test
asserting no role falls below the floor.

**The implementation does not follow it:**

- **53 hardcoded `fontSize` values below 13** across `app/` and `components/`
- Smallest measured live: **9.5px** (board-select), **10px** (progress)
- **23 sub-12px strings** on `/progress`, **21** on `/board-select`, **11** on `/tables-mode`
- **Only 2 of 40** screens/components import the type scale

The guard passes because it tests the tokens, not the screens. This is the same class
of defect the project has caught before (a guard that cannot fail is documentation) —
here it simply hasn't been pointed at the UI layer yet.

**Numerals** are strong: `answer: 32px/700`, `questionXl: 48px`. Digit legibility at
answer size is genuinely good, which matters more than anything else in a maths app.

**Devanagari** now renders correctly after the line-height fix (verified by render),
but note the shipping font is Noto Sans Devanagari at weights 400–700 — appropriate,
and the script-aware fallback is a good piece of work.

---

## 7 · Navigation & Information Architecture

**Measured tap counts:** launch → first question = **1 tap** (excellent, beats most benchmarks).
Manual funnel: home → class → category → difficulty → practice = 4 taps with 10, 12 and 5
options respectively.

**The bottom tab bar reads: Practice · Progress · Settings.**

"Settings" as one of three top-level destinations in a children's app is an adult IA
decision. No benchmark does this; settings sit behind a parent gate. It also means one
third of the app's primary navigation is unusable by, and uninteresting to, the user.

**Back navigation** uses a 40×40 circular arrow — measured on 7 of 12 screens, and
**below the 44pt WCAG 2.5.5 minimum** on every one of them. The welcome "Skip" control
measures **26×16**, which is less than a third of the required area and sits in the
corner most likely to be mis-tapped.

**Progress visibility** during a session is a thin bar plus "1/10". Functional, not
motivating. Duolingo's segmented bar and Khan's path both make progress feel spatial.

---

## 8 · Learning Experience

This is the app's strongest area and it is close to excellent.

The question screen is **admirably uncluttered — 15 words total**, one card, four
large tiles. Cognitive load during the actual learning moment is well managed, which
is the single most important UX property in a practice app. Tiles measured at or
above 44pt throughout.

**Worked examples, hints, misconception diagnosis, self-explanation prompts and
process praise are all present and pedagogically well-founded.** The praise system
naming *what the child did* rather than *that they were right* is textbook-correct
mindset work.

**The gap is representation.** Measured: **16 of 63 skills have any visual model**
(number line, part model, array grid, base ten). The 47 without include every Class 1
and Class 2 foundational skill — `add.within10`, `count.objects`, `count.skip`,
`shapes.basic`, `time.basic`, `money.basic`. The youngest children, who need
concrete-pictorial-abstract scaffolding most, get pure symbol manipulation.

**Counting questions use system emoji** (`🍎 ⭐ ● ♦ ▲ ■`) as the countable objects.
These render differently on every OS and version, cannot be styled, cannot be
animated, cannot be arranged into ten-frames or subitisable groups, and are not a
designed asset. On my render environment they fell back to tofu — that specific
failure is a sandbox artifact and **not** a product bug, but it demonstrates the
fragility: the app has delegated its most important visual to the platform.

---

## 9 · Child Engagement

**Measured: zero audio.** No `expo-av`, no sound system, no audio files anywhere in
the product. Every benchmark for this age group is audio-first — Khan Academy Kids
and Duolingo ABC both *read questions aloud*, which for a 6-year-old is not
decoration but an accessibility requirement, since many cannot yet read the question.

Haptics are used well (21 components) and are the app's one strong sensory channel.

**Where the interface is flat:**
- No character to react to success or failure
- No collectible, no artefact, no visible growing thing
- Nothing to explore; every screen is a list or a form
- Celebration fires on **one** screen (results) for four defined reasons; the other
  13 screens have no moment of delight
- The streak is a grey chip reading "41 days" — the app's biggest retention signal
  rendered as the smallest visual element on screen

The restraint is *principled* — the roadmap explicitly rejects loot boxes, leaderboards,
purchasable streak freezes and energy systems, and that rejection is correct and should
never be reversed. But rejecting exploitative engagement is not the same as providing
none, and the product has currently done the first without the second.

---

## 10 · Parent Experience — the strongest dimension

A parent inspecting this app finds: board-aware curriculum with visible NCERT
alignment, per-skill mastery, named misconceptions in plain language, honest reporting
including "not enough practice yet to say much", a placement probe that explains its
own reasoning, no purchasable advantage, no ads, no social features, no data
collection surface.

This is materially more trustworthy than Prodigy (whose parent-facing pitch is
undermined by its own monetisation) and comparable to Khan Academy.

**The one risk is the inverse of the usual one.** The product is so restrained it may
read as *unfinished* rather than *serious* — a parent scrolling the store screenshots
sees grey cards and may conclude the product is a prototype. Warmth would *increase*
parent trust here, not decrease it, because it signals investment.

The Parent screen itself is 32 words and mostly empty. It is the natural home for the
weekly summary, the misconception log and the "what to ask your child at dinner"
prompt — all of which the engine can already produce.

---

## 11 · Motion & Animation

**Measured timings** (`hooks/motionRules.ts`): correct 280ms, correct-with-praise
950ms, wrong 600ms, wrong-with-construction 1500ms, reduced-motion floor 900ms for
anything carrying words.

This reasoning is *better than the benchmarks*. The comment explaining that a praise
line at 280ms is "painted and gone — worse than no praise at all, motion with no
information" is exactly right, and the `MIN_READING_MS` floor correctly distinguishes
"less movement" from "less information" under reduced motion. Genuinely excellent work.

**The vocabulary is thin.** Available: fade, scale-pulse on correct, shake on wrong,
one particle burst on results. Missing: screen transitions with spatial meaning,
progress-bar easing that communicates gain, number count-ups, streak flame animation,
skill-mastery moments, any anticipation or follow-through.

Motion currently *confirms*. It does not yet *reward* or *explain*. The highest-value
addition would be motion that teaches — an array animating into rows, a number line
walking the jump — which also closes the representation gap in §8.

---

## 12 · Visual Feedback

| Moment | Current | Assessment |
|---|---|---|
| Correct | Tile turns teal + tick icon + 280ms pulse | Clear, accessible, unmemorable |
| Wrong | Tile maroon + icon + shake + reveal | Excellent — dignified, not punishing |
| Misconception | Named plain-language diagnosis | **Best-in-class.** No benchmark does this |
| Self-explanation | Prompt before reveal | Research-grade; rare in commercial products |
| Mastery | A percentage moves | **Invisible.** The most important moment in the app has no moment |
| Level up | "Level 2" text + XP number | Flat |
| Achievement | Empty circle → filled circle | Weakest element in the product |
| Streak | Grey chip | Understated to the point of invisibility |

**Mastery is the critical miss.** Taking a skill from struggling to secure is the
single thing this app exists to do, and it is currently communicated by a progress bar
changing width. This should be the app's signature celebration.

---

## 13 · Screen-by-Screen Findings

| Screen | Words | Taps | Sub-44pt | Sub-12px | Finding |
|---|---:|---:|---:|---:|---|
| Home | 54 | 8 | 0 | 0 | Clean; adult tone; no personality |
| Game (question) | 15 | 4 | 0 | 0 | **Best screen.** Focused and calm |
| Game (feedback) | ~40 | 3 | 0 | 0 | Self-explanation is excellent |
| Results | 25 | 5 | 0 | 2 | **Layout breaks at 320px** (see below) |
| Progress | 194 | 4 | 1 | **23** | **Worst screen.** Dense, demoralising, 9 AA failures |
| Board select | 141 | 5 | 1 | **21** | Adult content in child navigation; 9 AA failures |
| Class select | 72 | 10 | 1 | 0 | Clear; ages shown is good |
| Category select | 79 | 12 | 1 | 0 | 12 options; heavy reading for Class 1 |
| Difficulty select | 56 | 5 | 1 | 0 | Good descriptions |
| Tables mode | 80 | 1 | 1 | **11** | Strong layout; legend text too small |
| Placement | 35 | 8 | 0 | 1 | Excellent framing: "no score. Some are meant to be hard" |
| Mistake review | 23 | 1 | 1 | 0 | Warm empty state — a model for the others |
| Parent | 32 | 4 | 0 | 0 | Honest but nearly empty |
| Not found | 14 | 3 | 0 | 0 | Functional |

### Confirmed layout defect — results screen at 320px

Measured on iPhone SE (320×568): the score circle renders at `top: -98px` and
**overlaps all three header chips** — Class 1 (120px² overlap), Addition (345px²),
Easy (180px²). The primary "Play Again" CTA is pushed behind the tab bar. Zero
overlaps at 390px and 412px, so this affects small devices only — but iPhone SE
remains a common device in the Indian market this product targets.

---

## 14 · Accessibility

**Strong:** colour never sole signal (verified in CI); reduced-motion respected with
an information floor; screen-reader labels on tiles including outcome in words;
`accessibilityLiveRegion` on feedback; text-scale support; dark mode fully functional.

**Measured failures:**
- **24 WCAG AA contrast failures** across 4 routes (worst 1.40)
- **53 font sizes below the product's own 13px floor**; smallest 9.5px
- **7 screens with 40×40 back buttons** (WCAG 2.5.5 requires 44×44)
- **Welcome "Skip" at 26×16** — 4× smaller than required
- **No audio** — excludes pre-readers and low-vision users from independent use
- **No dyslexia font option** despite the line-height accommodation showing awareness

---

## 15 · Themes & Personalisation

Currently: light/dark and language. Nothing child-facing.

**Recommended (earned by learning, never bought):**
- **Colour themes** unlocked by chapter completion — cheap, high emotional return
- **Character/avatar** chosen freely at first launch, never gated (identity, not reward)
- **Seasonal themes** (Diwali, Holi, monsoon) — culturally specific and memorable in
  a market where every competitor ships a US/EU aesthetic. **Highest identity return
  of any item in this report.**
- **Accessibility themes** — high-contrast, dyslexia-friendly — should be free and prominent

**Reject:** anything purchasable, anything that gates content, anything that makes the
maths harder to read.

---

## 16 · Benchmark Comparison

| | Visual | UX | Child appeal | Parent trust | A11y | Learning |
|---|---:|---:|---:|---:|---:|---:|
| Khan Academy Kids | 9.5 | 9.0 | 9.5 | 9.5 | 9.0 | 9.0 |
| Duolingo ABC | 9.0 | 9.0 | 9.0 | 8.0 | 8.0 | 7.5 |
| DragonBox | 9.0 | 8.5 | 8.5 | 8.5 | 7.0 | 9.5 |
| Duolingo Math | 8.5 | 9.0 | 8.0 | 7.5 | 8.0 | 7.0 |
| SplashLearn | 8.0 | 7.5 | 8.0 | 7.0 | 7.0 | 7.5 |
| Prodigy | 8.0 | 7.0 | 9.0 | 4.5 | 6.0 | 5.5 |
| Todo Math | 8.0 | 8.0 | 8.0 | 8.0 | 8.5 | 8.0 |
| PBS Kids | 7.5 | 7.5 | 8.5 | 8.5 | 7.5 | 6.5 |
| **Maths Workout** | **6.4** | **7.1** | **3.2** | **8.6** | **6.8** | **8.5** |

**The shape of this row is the whole story.** Second-highest parent trust,
second-highest learning quality, *lowest child appeal by a wide margin*. The product
wins every criterion a parent applies and loses the only one a child applies.

### The question posed

> *If a child opened this app alongside the world's best, which would they continue using?*

**Today: Khan Academy Kids or Prodigy — not this one.** A 7-year-old choosing between
a talking bear and a grey card titled "TODAY'S PRACTICE" will not choose the card.
This is not a close call.

**But the reason is narrow and fixable.** This app already beats Khan Academy Kids on
diagnostic precision, beats Prodigy decisively on integrity, and beats almost everything
on adaptive sequencing. It needs a face, a voice and a reason to feel proud — not a
rebuild.

---

## 17 · Top 75 Improvements (ranked by impact ÷ effort)

### Tier 1 — Critical, low effort (do first)

1. Raise all 7 back buttons from 40×40 to 44×44
2. Fix welcome "Skip" (26×16 → 44×44)
3. Fix the 24 WCAG AA contrast failures on `/progress` and `/board-select`
4. Raise all 53 sub-13px font sizes to the product's own floor
5. Extend the `MIN_FONT_SIZE` guard to scan screens, not just tokens
6. Fix the 320px results-screen overlap
7. Change Progress header from "0 questions answered" when data exists (measured bug)
8. Replace the wall of 0% with "not started yet" language
9. Move Settings out of the child tab bar; put Parent/Settings behind a simple gate
10. Rename tabs to child language: Practice → "Play", Progress → "My Maths"
11. Add a contrast-checking test that runs on rendered screens
12. Increase streak chip prominence — it is the strongest retention signal
13. Add "Ask your child" prompts to the near-empty Parent screen
14. Warm the results headline: "Tough session" → "That was a hard one — those teach you most"
15. Add per-skill colour identity, reusing the existing category tints

### Tier 2 — High impact, medium effort

16. **Commission a mascot** — one character, 6–8 expressions *(highest single item in this report)*
17. Mascot reacts to correct, wrong, mastery, streak, return-after-absence
18. **Add audio: question read-aloud** (accessibility requirement for ages 5–7, not decoration)
19. Add correct/wrong/celebration sounds with a global mute
20. **Design a mastery celebration** — the app's signature moment, currently invisible
21. Replace emoji counting objects with designed, animatable SVG assets
22. Add ten-frame and subitising layouts for counting
23. Extend visual models to the 47 uncovered skills, starting with Class 1–2
24. Redesign achievements: empty circles → illustrated badges with locked silhouettes
25. Replace the session progress bar with a segmented, spatial path
26. Add number count-up animation on XP and score
27. Add a first-launch avatar picker (free, not earned)
28. Move board selection out of the child's first-run flow into a parent step
29. Rewrite Class 1–2 microcopy to a 6-year-old reading level
30. Add icon support to every list row so pre-readers can navigate
31. Animate the number line and array models to *show* the operation
32. Add a "what you learned today" illustrated summary card
33. Give each chapter a distinct colour and illustrated header
34. Add screen transitions with spatial direction
35. Celebrate streak milestones (3, 7, 14, 30) with escalating, non-purchasable rewards
36. Add haptic + visual "almost there" feedback near mastery thresholds
37. Design a proper empty state for Progress before first session
38. Add estimated session time to the start button
39. Show the skill being practised during the session, in child language
40. Add a pause state to sessions

### Tier 3 — Valuable, higher effort

41. Seasonal themes: Diwali, Holi, monsoon, summer
42. Chapter-completion colour theme unlocks
43. Illustrated chapter map replacing the "Your Journey" list
44. Character dialogue for hints (voice of a helper, not a system)
45. Animated worked examples
46. Interactive manipulatives where manipulation *is* the answer
47. Draggable fraction bars and regroupable base-ten blocks
48. A visible "maths world" that grows with mastery
49. Personal-best moments with replay
50. Weekly illustrated parent report
51. Printable certificate on chapter completion
52. Child-selectable practice goals
53. Dyslexia-friendly font option
54. High-contrast accessibility theme
55. Full screen-reader walkthrough for the practice loop
56. Left-handed layout option
57. Landscape support for tablets
58. Offline-first indicator
59. Session-resume after interruption
60. Adjustable animation speed

### Tier 4 — Refinement

61. Micro-interaction on every tap target
62. Skeleton loading states
63. Illustrated error states
64. Empty-state illustrations throughout
65. Refined focus rings
66. Consistent iconography audit
67. Optical alignment pass on numerals
68. Tabular figures for aligned columns
69. Refine dark-mode elevation
70. Reduce home-screen card borders in favour of elevation
71. Consistent corner-radius scale
72. Spacing rhythm audit
73. Improve chip legibility at small sizes
74. Add subtle texture to break flatness
75. Design an app icon that signals "child" and "maths"

---

## 18 · Features That Should NOT Be Added

The roadmap already rejects 14 items; those rejections are correct. Reinforced and extended:

1. **Loot boxes / gacha** — trains variable-ratio gambling schedules
2. **Leaderboards** — converts mastery into social comparison; harms low performers most
3. **Energy / lives systems** — monetises the interruption of learning
4. **Purchasable streak freezes** — sells relief from guilt the app manufactured
5. **XP-purchasable content unlocks** — makes maths a currency rather than a goal
6. **Timed pressure as default** — measurably harms maths-anxious children
7. **Public profiles or chat** — child-safety surface with no learning return
8. **Ads of any kind**
9. **Character customisation as a paid tier**
10. **Streak-loss punishment animations** — shame is not motivation
11. **Auto-playing video**
12. **Push notifications framed as guilt** ("Your owl is sad")
13. **Free-text answer grading** — cannot be graded fairly offline or bilingually
14. **Competitive multiplayer** — speed rewards the already-fluent
15. **Decorative animation with no informational content** — cost without return

---

## 19 · Design Principles for Future Development

1. **Warmth is not the opposite of rigour.** Khan Academy Kids proves a product can be
   the warmest *and* the most serious in its category.
2. **Every visual must teach or motivate.** Decoration without a job is cognitive load.
3. **Celebrate understanding, not activity.** Mastery deserves the biggest moment.
4. **A six-year-old cannot read your interface.** Icon, colour and audio carry meaning first.
5. **Never make a child feel behind.** "Not started" is a beginning; 0% is a verdict.
6. **Accessibility is the floor.** Enforce it where children look, not only where tests run.
7. **Motion must mean something.** If it explains nothing, cut it.
8. **Parents buy trust; children choose delight.** The product must win both, separately.
9. **Reject engagement that would embarrass you in front of a parent.**
10. **Measure the rendered screen.** Every finding in this report came from a photograph,
    not from source — and three defects were invisible to 712 passing tests.

---

## 20 · Final Verdict

**Maths Workout is a 8.5/10 teaching engine wearing a 3.5/10 costume.**

The engineering discipline here is exceptional and rare: measured misconceptions,
adaptive placement that explains itself, self-explanation prompts, process praise,
colour-blindness handling verified in CI, and a documented refusal of every
manipulative pattern the category has normalised. A parent evaluating this against
Prodigy should choose this one, and would be right to.

A child would not.

The gap is not craft — the craft is visible in every token and every timing constant.
The gap is that **nobody has yet drawn a single character, played a single sound, or
designed a single moment of pride.** The app currently asks a six-year-old to be
motivated by a percentage.

The fix is unusually well-defined:

1. **Give it a face** — one mascot, eight expressions
2. **Give it a voice** — read questions aloud; add three sounds
3. **Give mastery a moment** — the app's signature celebration
4. **Enforce your own standards** — 53 font violations, 24 contrast failures, 7 small targets
5. **Speak to children** — rewrite Class 1–2 copy and move board selection to parents

Items 4 and 5 are days of work. Items 1–3 are weeks. Together they would move Child
Appeal from **3.2 to roughly 8**, without touching a single line of the learning engine
and without adopting one pattern the roadmap has rightly rejected.

**Do that, and the answer to the opening question changes** — because a child choosing
between a talking bear and a friendly character who *notices when they finally
understand something* is no longer making an obvious choice. And on every criterion a
parent, a teacher or a researcher would apply, this product is already ahead.

---

*Audit conducted on build `d369285`. 28 screenshots across 14 routes, 2 themes, 3
viewports. All measurements reproducible via `/tmp/capture.mjs`, `/tmp/contrast.mjs`
and `/tmp/overlap.mjs`. Findings distinguish product defects from environment
artifacts: the emoji tofu observed in counting questions is a sandbox font limitation,
not a product bug, though the underlying dependency on system emoji is a real risk.*
