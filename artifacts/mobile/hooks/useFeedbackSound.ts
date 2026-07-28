// ─── Answer sounds ───────────────────────────────────────────────────────────
// docs/28.
//
// The audit measured zero audio in the product. Haptics were used well (21
// components), but haptics do not exist on the web, are silent on a tablet lying
// on a table, and are invisible to a child watching a sibling play. Sound is the
// channel every benchmark in this category uses and this product had none.
//
// ── Why synthesised tones rather than audio files ───────────────────────────
//
// No .mp3 assets, no expo-av dependency, no licensing, no bundle cost, and no
// loading delay before the first correct answer of a session. Web Audio gives a
// clean two-note figure that is indistinguishable in use from a recorded one at
// this scale. On native, where Web Audio is unavailable, the existing haptics
// already carry the same signal, so this degrades to silence rather than error.
//
// ── The design constraint ───────────────────────────────────────────────────
//
// A wrong answer must NOT sound like a buzzer. Game-show failure sounds are
// exactly the affective note this product spends its entire feedback design
// avoiding — the misconception work, the process praise and the
// self-explanation prompt all exist to make a mistake feel like information.
// The wrong tone is therefore soft, low, short and *descending a whole tone*:
// unmistakably "not that", never "you lose".

type Tone = { freq: number; at: number; dur: number; gain: number };

/** Two notes rising a fifth — arrival, not fanfare. */
const CORRECT: Tone[] = [
  { freq: 660, at: 0,     dur: 0.09, gain: 0.16 },
  { freq: 990, at: 0.085, dur: 0.13, gain: 0.14 },
];

/** One soft note falling a whole tone. Never a buzz. */
const WRONG: Tone[] = [
  { freq: 320, at: 0,    dur: 0.10, gain: 0.11 },
  { freq: 285, at: 0.09, dur: 0.14, gain: 0.09 },
];

/** A brighter three-note figure, reserved for genuinely earned moments. */
const CELEBRATE: Tone[] = [
  { freq: 660,  at: 0,    dur: 0.10, gain: 0.15 },
  { freq: 880,  at: 0.10, dur: 0.10, gain: 0.15 },
  { freq: 1320, at: 0.20, dur: 0.22, gain: 0.13 },
];

export type SoundName = 'correct' | 'wrong' | 'celebrate';

const FIGURES: Record<SoundName, Tone[]> = {
  correct: CORRECT,
  wrong: WRONG,
  celebrate: CELEBRATE,
};

let ctx: AudioContext | null = null;
let enabled = true;

/** Global mute. Parents and older children switch this off from settings. */
export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

export function isSoundEnabled(): boolean {
  return enabled;
}

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = (window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  });
  const C = Ctor.AudioContext ?? Ctor.webkitAudioContext;
  if (!C) return null;
  if (!ctx) { try { ctx = new C(); } catch { return null; } }
  return ctx;
}

/**
 * Play a feedback figure.
 *
 * Total and silent on failure: audio is an enhancement, and a device that
 * cannot play a tone must never block or delay the answer path.
 */
export function playSound(name: SoundName): void {
  if (!enabled) return;
  const ac = audioContext();
  if (!ac) return;
  try {
    // Browsers suspend the context until a user gesture; by the time a child
    // has answered a question they have gestured, so this resolves silently.
    if (ac.state === 'suspended') void ac.resume();
    const now = ac.currentTime;
    for (const tone of FIGURES[name]) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      // A sine is the softest waveform available and the least fatiguing over
      // a 10-question session. Square and sawtooth read as arcade.
      osc.type = 'sine';
      osc.frequency.value = tone.freq;
      // Ramped, never stepped: an instantaneous gain change produces an
      // audible click that children notice more than adults.
      gain.gain.setValueAtTime(0.0001, now + tone.at);
      gain.gain.exponentialRampToValueAtTime(tone.gain, now + tone.at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.at + tone.dur);
      osc.connect(gain).connect(ac.destination);
      osc.start(now + tone.at);
      osc.stop(now + tone.at + tone.dur + 0.02);
    }
  } catch { /* never let audio break the answer path */ }
}
