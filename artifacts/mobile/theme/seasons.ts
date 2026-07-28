// ─── Seasonal accents ────────────────────────────────────────────────────────
// docs/28 item 41.
//
// The audit's note: every competitor ships a US/EU aesthetic, so a product
// that acknowledges Diwali, Holi and the monsoon is memorable in this market
// in a way that no amount of general polish achieves. It called this the
// highest identity return of any item in the list.
//
// ── What a season is allowed to change ──────────────────────────────────────
//
// An ACCENT and a GREETING. Nothing else. Specifically it may not change:
//   · text or surface colours — those are contrast-tested and must stay so
//   · the correct/wrong semantics — a child must never have to relearn what
//     green means because it is October
//   · question content, difficulty, or anything the scheduler reads
//
// This is a deliberately small surface. A seasonal theme that repaints the
// interface is a novelty that costs legibility twice a year; one that changes
// a greeting and a highlight is a small, warm signal that the app knows where
// it is.
//
// ── Why dates rather than an unlock ─────────────────────────────────────────
//
// Seasons arrive for everyone, which is the point. Gating Diwali behind a
// streak would turn a shared cultural moment into a reward for compliance,
// and a child who missed it would be told they had failed at a festival.

export type SeasonId = 'diwali' | 'holi' | 'monsoon' | 'summer' | 'newYear' | 'none';

export interface Season {
  id: SeasonId;
  /** Accent used for highlights only — never for text or state. */
  accent: string;
  greeting: { en: string; hi: string };
}

const SEASONS: Record<Exclude<SeasonId, 'none'>, Season> = {
  diwali: {
    id: 'diwali',
    accent: '#E8A33D',
    greeting: { en: 'Happy Diwali!', hi: 'दीपावली की शुभकामनाएँ!' },
  },
  holi: {
    id: 'holi',
    accent: '#E0479E',
    greeting: { en: 'Happy Holi!', hi: 'होली की शुभकामनाएँ!' },
  },
  monsoon: {
    id: 'monsoon',
    accent: '#2E8BC0',
    greeting: { en: 'Rainy days, good practice days', hi: 'बारिश के दिन, अभ्यास के दिन' },
  },
  summer: {
    id: 'summer',
    accent: '#F2994A',
    greeting: { en: 'Summer holidays!', hi: 'गर्मी की छुट्टियाँ!' },
  },
  newYear: {
    id: 'newYear',
    accent: '#5B8DEF',
    greeting: { en: 'Happy New Year!', hi: 'नव वर्ष की शुभकामनाएँ!' },
  },
};

/**
 * Which season a date falls in.
 *
 * Diwali and Holi move with the lunar calendar, so a precise date would need a
 * Hindu calendar dependency and would go stale. These are generous windows
 * around the months they always fall in — being a week early is a warm
 * greeting, not an error, and the alternative is shipping a lookup table that
 * silently expires. The narrow windows are deliberate: a season that lasts two
 * months is not a season.
 */
export function seasonFor(date: Date): Season | null {
  const m = date.getMonth() + 1;   // 1-12
  const d = date.getDate();

  // Diwali: mid-October to mid-November.
  if ((m === 10 && d >= 15) || (m === 11 && d <= 15)) return SEASONS.diwali;
  // Holi: March.
  if (m === 3 && d >= 1 && d <= 20) return SEASONS.holi;
  // Monsoon: June to September, the school year's wettest stretch.
  if (m >= 6 && m <= 9) return SEASONS.monsoon;
  // Summer holidays: April-May, when Indian schools break.
  if (m === 4 || m === 5) return SEASONS.summer;
  // New year: the turn of the calendar.
  if ((m === 12 && d >= 28) || (m === 1 && d <= 7)) return SEASONS.newYear;

  return null;
}

/** The greeting for a season, or null when it is an ordinary week. */
export function seasonGreeting(date: Date, lang: 'en' | 'hi'): string | null {
  const s = seasonFor(date);
  return s ? s.greeting[lang] : null;
}
