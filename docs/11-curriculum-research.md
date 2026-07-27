# 11 · Curriculum Research (CBSE / ICSE / State)

> Source notes behind `curriculum/boards.ts`. Recorded so the topic and
> difficulty mappings can be audited and corrected rather than trusted blindly.
>
> Researched against NCERT / CBSE syllabus listings (2025–27 sessions) and
> CISCE / Selina *Concise Mathematics* chapter lists.

---

## 1 · Why this matters

Before this work the app shipped **one hardcoded curriculum**, and it was the
wrong one:

```
generators/index.ts:56   // Based on Irish primary school curriculum
generators/advanced.ts   13 × "€"   0 × "₹"
```

Class levels were labelled "1st Class … 6th Class" (Irish convention) rather
than "Class 1 … Class 6", money questions were in euros, and word problems
used Tom and Jane. For the stated CBSE audience this is wrong at every level:
sequencing, currency, and cultural context.

---

## 2 · CBSE / NCERT

CBSE follows NCERT. NEP 2020 replaced the *Math-Magic* series with
**Joyful Mathematics** (Classes 1–2), **Maths Mela** (Class 3), and
**Ganita Prakash** (Class 6+). Both old and new sequences were checked because
schools are mid-transition.

### Class 1 — *Joyful Mathematics*
Pre-number concepts · shapes · numbers 1–9 · numbers 10–20 · addition and
subtraction of single digits · addition and subtraction up to 20 · measurement ·
numbers 21–99 · patterns · time · **multiplication ("How Many Times?")** ·
money · data handling

> **Correction to the app.** The previous `CLASS_TOPICS` excluded
> multiplication from Class 1 entirely. The new NCERT book introduces it as
> repeated addition / equal groups. It is now included at Class 1, restricted
> to doubling and 2s/5s/10s.

### Class 2 — *Joyful Mathematics*
Numbers to 100 · place value · addition and subtraction with regrouping ·
multiplication (2, 5, 10 tables) · division as equal sharing (informal) ·
money · time · measurement · patterns · data handling

### Class 3 — *Maths Mela*
Numbers to 999 · place value ("House of Hundreds") · 3-digit addition and
subtraction · **multiplication ("Raksha Bandhan")** · **division ("Fair Share")** ·
shapes · data handling · weight and capacity · money ("Give and Take") ·
time and calendars · patterns

> Division formally begins at Class 3 in CBSE. Fractions appear only as
> informal "fair share" ideas — half, quarter, third of a set.

### Class 4
Shapes · symmetry · patterns · **thousands and place value** · sharing and
measuring (division) · length · weight and capacity · equal groups
(multiplication) · time and calendar · data handling · **fractions —
halves and quarters** · **perimeter and area ("Fields and Fences")**

### Class 5
Large numbers · shapes and angles · **area ("How Many Squares")** ·
**fractions ("Parts and Wholes")** · symmetry · **factors and multiples
("Be My Multiple, I'll Be Your Factor")** · patterns · mapping · nets ·
**decimals ("Tenths and Hundredths")** · area and perimeter · data handling ·
multiplication and division of large numbers · measurement

> **Percentages are NOT in CBSE Class 5.** The app previously offered them.
> In CBSE they appear from Class 6–7 (*Comparing Quantities*). Corrected.

### Class 6 — *Ganita Prakash*
Knowing our numbers — Indian and international place value, estimation,
**Roman numerals** · whole numbers · playing with numbers — factors, multiples,
divisibility, **HCF and LCM** · **integers** · fractions · decimals ·
**algebra** · **ratio and proportion** · basic geometrical ideas ·
understanding elementary shapes · symmetry · mensuration · data handling

> Roman numerals sit in Class 6 *Knowing Our Numbers* in CBSE.

---

## 3 · ICSE / CISCE

ICSE is widely regarded as broader and more detailed at the same grade, and it
introduces several topics **one to two years earlier** than CBSE. Verified
against the Selina *Concise Mathematics* chapter lists.

### Class 6 — Selina *Concise Mathematics* (34 chapters)
Number system · estimation · Indian and international system · place value ·
**exponents** · natural and whole numbers · **negative numbers and integers** ·
**HCF and LCM** · playing with numbers · **sets** · **ratio** · **proportion** ·
**unitary method** · fractions · decimal fractions · **percent** ·
**speed, distance and time** · algebra — fundamental concepts, operations,
substitution, framing expressions, **simple linear equations** · geometry —
angles, parallel lines, triangles, quadrilaterals, polygons, circle · symmetry ·
solids · **perimeter and area** · data handling · **mean and median**

### Key divergences from CBSE

| Topic | CBSE | ICSE |
|---|---|---|
| Percentage | Class 6–7 | **Class 5** |
| Ratio / proportion | Class 6 | **Class 5** |
| Unitary method | Class 7 | **Class 6** |
| Profit and loss | Class 7 | **Class 5** (introductory) |
| Speed, distance, time | Class 7 | **Class 6** |
| Mean / median | Class 7 | **Class 6** |
| Sets | Class 11 | **Class 6** |
| Exponents | Class 7 | **Class 6** |
| Roman numerals | Class 6 | **Class 3–4** |
| Simple equations | Class 6–7 | **Class 6** |

Profit/loss formulae are taught from ICSE Class 5 and reused unchanged through
Class 8; only problem complexity increases.

---

## 4 · State boards

State boards (SCERT) vary widely. Most track NCERT closely but run roughly
**half a year to a year behind CBSE** on abstract topics, with more emphasis on
local context in word problems.

Modelled as a third profile: CBSE sequencing, with the most abstract topics
(algebra, integers, ratio) deferred by one class and operand ranges reduced.

---

## 5 · Resulting model

Three inputs now drive content:

```
board  ×  class  →  available topics
board  ×  class  ×  difficulty  →  operand ranges
```

Implemented in `curriculum/boards.ts` as:

- `BOARD_CONFIGS` — display metadata per board
- `TOPIC_AVAILABILITY` — earliest class per (board, category)
- `DIFFICULTY_PROFILE` — per-board scaling of operand magnitude

### Topic availability matrix (earliest class)

| Category | CBSE | ICSE | State |
|---|:--:|:--:|:--:|
| counting, shapes, time, money | 1 | 1 | 1 |
| addition, subtraction | 1 | 1 | 1 |
| multiplication | 1 | 1 | 2 |
| place value | 2 | 2 | 2 |
| measurement | 2 | 2 | 2 |
| division | 3 | 3 | 3 |
| word problems | 3 | 3 | 3 |
| fractions | 3 | 3 | 4 |
| geometry (area/perimeter) | 4 | 4 | 5 |
| decimals | 5 | 4 | 5 |
| factors, primes, HCF/LCM | 5 | 5 | 6 |
| data / averages | 5 | 5 | 6 |
| percentages | 6 | **5** | 6 |
| ratio | 6 | **5** | 6 |
| integers | 6 | 6 | — |
| algebra | 6 | 6 | — |

Dashes mean the topic is not offered for that board at Classes 1–6.

### Difficulty scaling

ICSE runs slightly ahead, state boards slightly behind:

```
operandScale:  CBSE 1.00   ICSE 1.20   State 0.85
```

Applied to the generated operand ranges, so "Class 5 hard addition" is a
genuinely larger sum for an ICSE learner than a state-board one.

---

## 6 · Localisation notes

- **Currency** — `₹` throughout; `€` removed. Real Indian denominations
  (coins ₹1/₹2/₹5/₹10, notes ₹10–₹500). Euro-cent phrasing like "9c + 2c" is
  gone; paise are effectively out of circulation so amounts are whole rupees.
- **Names** — Aarav, Priya, Rohan, Ananya, Kabir, Diya, Meera, Arjun replace
  Tom and Jane.
- **Contexts** — cricket, tiffin, mangoes, laddoos, festivals.
- **Class labels** — "Class 1" not "1st Class" (Irish convention).

### 6.1 The "semi-Hindi" policy

Hindi mode is **deliberately partial**, mirroring how Hindi-medium schooling
actually works in India — and protecting a child who switches language by
accident.

**Translated — what is being *learned*:**

| | |
|---|---|
| Question text | `8 − 3 = ?` phrased in Hindi where it has words |
| Category names | जोड़, घटाव, गुणा, भाग |
| Topic descriptions | full Hindi |
| Misconception diagnosis | full Hindi — a child struggling in Hindi must be told *why* in Hindi |
| Encouragement, results | full Hindi |

**Kept in English — what is being *navigated* or *computed*:**

| | Rule | Example |
|---|---|---|
| **Numerals** | Always Western Arabic, never Devanagari | `कक्षा 5`, not `कक्षा ५` |
| **Navigation** | Bilingual, Latin always present | `पूरा · Done`, `वापस · Back` |
| **Language control** | Bilingual | `भाषा चुनें · Select Language` |
| **Board acronyms** | Latin retained | CBSE, ICSE, State Board |
| **Units and symbols** | Untranslated | km, cm, kg, %, ₹, °C |

**Why numerals stay Western Arabic.** Indian maths teaching and every board
exam use `1 2 3`, including in Hindi-medium classrooms. Devanagari digits in an
arithmetic app would be actively confusing — the child would have to translate
before computing.

**Why navigation is bilingual.** This is the escape hatch. A child who taps
हिन्दी by mistake can still find *Back*, *Done*, *Home* and *Select Language*
without needing an adult. A fully translated interface strands a non-Hindi
reader with no way out.

Enforced by tests in `i18n/__tests__/i18n.test.ts`:

- no shipped string, category, class label, board note, question phrase or
  misconception may contain a Devanagari digit
- every escape-hatch string must retain its English word
- every escape-hatch string must contain Latin characters
- generated Hindi questions are scanned for Devanagari digits

---

## 7 · Caveats

1. NCERT is mid-transition between the old *Math-Magic* and new NEP-aligned
   books. Where they disagree, the **new** sequence is used, since that is what
   schools are adopting.
2. State boards are modelled as one generic profile. Real SCERT syllabi differ
   per state; a Maharashtra/Tamil Nadu/UP split would need separate research.
3. Topic *availability* is modelled; chapter-level ordering within a year is
   not. That is a deliberate limit — the app practises skills, not chapters.
4. This mapping should be reviewed by a practising Indian primary teacher
   before any claim of "CBSE-aligned" is made in marketing.
