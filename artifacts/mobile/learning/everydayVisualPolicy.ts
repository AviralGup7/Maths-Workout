// ─── Clock and money visuals ─────────────────────────────────────────────────
// docs/27 P3-03 and P3-04.
//
// Both categories had the same defect: the question named an everyday skill
// and then tested arithmetic instead.
//
//   "It is 7 o'clock. What time in 3 hours?"   → addition with a clock word
//   "3 × ₹5 coins. How much altogether?"       → a times table with a ₹ sign
//
// A child who can already add answers both without ever reading a clock face
// or recognising a coin — which are the actual competences the NCERT
// curriculum asks for, and the ones they need outside the app.
//
// Like `barModelPolicy`, this classifies from the SENTENCE and is bilingual,
// because a Hindi-medium child is no less likely to need the picture.

/** Denominations in circulation, largest first. */
export const DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1] as const;

/** Coins in India go up to ₹20; anything larger is a note. */
export const COIN_MAX = 20;

/**
 * Greedy breakdown of an amount into real denominations.
 *
 * Greedy is exactly right for Indian currency — the set is canonical, so the
 * greedy result is also the minimum-piece result. Capped so ₹500 does not
 * render as a wall of tiles.
 */
export function breakdown(amount: number, maxPieces = 10): number[] {
  const out: number[] = [];
  let left = Math.max(0, Math.floor(amount));
  for (const d of DENOMINATIONS) {
    while (left >= d && out.length < maxPieces) {
      out.push(d);
      left -= d;
    }
  }
  return out;
}

export interface ClockSpec { kind: 'clock'; hour: number; minute: number }
export interface MoneySpec { kind: 'money'; amount: number }
export type EverydaySpec = ClockSpec | MoneySpec;

function numbers(text: string): number[] {
  return (text.match(/\d+/g) ?? []).map(Number);
}

/**
 * A clock for the STARTING time, never the answer.
 *
 * "It is 7 o'clock, what time in 3 hours?" shows 7 — the child moves the hands
 * in their head. Showing 10 would answer the question, the same rule the bar
 * model and base-ten already follow.
 */
export function clockFor(text: string): ClockSpec | null {
  const t = text.toLowerCase();
  const n = numbers(text);
  if (n.length === 0) return null;

  const valid = (h: number, m = 0) =>
    Number.isFinite(h) && h >= 1 && h <= 12 && m >= 0 && m < 60
      ? { kind: 'clock' as const, hour: h, minute: m }
      : null;

  // "It is 7 o'clock. What time will it be in 3 hours?"
  if (/o'clock|बजे हैं/.test(t)) return valid(n[0]);

  // "A lesson starts at 9:00 and lasts 2 hours."  /  "School starts at 8:00…"
  if (/starts at|शुरू होती है|शुरू होता है/.test(t)) return valid(n[0]);

  // "The clock reads quarter past 4."
  // "The clock reads half past 4." — the outer guard must admit all three
  // forms, not just quarter past. It previously required `quarter past`, so
  // "half past" never entered the branch and fell through to no diagram at
  // all: the one question form that literally shows a clock got none.
  if (/quarter past|half past|quarter to|घड़ी में|सवा|साढ़े|पौने/.test(t)) {
    const m = /half past|साढ़े/.test(t) ? 30
      : /quarter to|पौने/.test(t) ? 45
      : 15;
    return valid(n[0], m);
  }

  // Everything else gets no face, and that is correct rather than a
  // shortfall. Measured on the live stream, the remainder is:
  //
  //   unit conversion   "3 weeks = ___ days?", "How many hours in 4 days?"
  //   duration          "How many hours from 9:00 to 14:00?"
  //   partial hour      "It is 25 minutes past the hour."
  //
  // A conversion has no time to show. A duration would need two faces and
  // the child would read the answer off the gap. A partial hour has no known
  // hour, so a face would have to invent one — and an invented hour hand is
  // worse than none, because it looks authoritative.
  return null;
}

/**
 * Money shown as real denominations.
 *
 * The amount drawn is always one the child is GIVEN, never the one they must
 * work out. For "I have ₹45 and spend ₹18", that is the 45.
 */
export function moneyFor(text: string): MoneySpec | null {
  const t = text.toLowerCase();
  const n = numbers(text);
  if (n.length === 0) return null;

  const valid = (v: number) =>
    Number.isFinite(v) && v >= 1 && v <= 500
      ? { kind: 'money' as const, amount: v }
      : null;

  // "3 × ₹5 coins. How much altogether?" — show the coins themselves, which is
  // the one form where the pieces ARE the question.
  if (/coins|सिक्के/.test(t) && n.length >= 2) {
    const [count, denom] = n;
    if (count >= 1 && count <= 10 && denom >= 1 && denom <= 20) {
      return valid(count * denom);
    }
    return null;
  }

  // "I have ₹45 and spend ₹18. How much is left?" — show what they start with.
  if (/i have|मेरे पास/.test(t)) return valid(n[0]);

  // "Price is ₹60. I pay ₹100. Change?" — show what was handed over, because
  // change is worked out from it.
  // The Hindi change forms say "नोट दिया" / "देने पर", not "देता हूँ" — matching
  // only the latter left Hindi at 12% against English at 31% for the same
  // questions, which is exactly the group least able to afford a missing
  // scaffold.
  if (/i pay|change|देता हूँ|शेष|नोट दिया|देने पर|वापस/.test(t)) return valid(n[1] ?? n[0]);

  // "₹12 + ₹9 = ?" — show the first addend as pieces. Measured as the second
  // largest form in both languages and trivially representable.
  if (/^₹?\d+\s*\+/.test(text.trim())) return valid(n[0]);

  // "₹60 shared equally among 4 friends" — show the whole being divided.
  if (/shared equally|बराबर बाँट/.test(t)) return valid(n[0]);

  // "One notebook costs ₹15. What do 4 notebooks cost?" — show the UNIT
  // price, not the total: the total is the answer.
  if (/one .* costs|एक .* की है|एक .* की कीमत/.test(t)) return valid(n[0]);

  return null;
}

/**
 * Fade both out with mastery, on the same principle as every other scaffold
 * here: a child who can already read a clock does not need one drawn, and
 * leaving it up teaches dependence on the picture.
 */
export const EVERYDAY_HIDDEN_ABOVE = 0.75;

export function shouldShowEveryday(mastery: number): boolean {
  return mastery < EVERYDAY_HIDDEN_ABOVE;
}
