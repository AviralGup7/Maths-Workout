// ─── Contrast and colour-vision maths ────────────────────────────────────────
//
// Shipped as real code rather than a one-off audit script, so the accessibility
// properties of the palette are asserted in CI. A UI change that reintroduces
// an inaccessible colour pair should fail the build, not wait for someone to
// re-run an audit by hand.

export interface Rgb { r: number; g: number; b: number }

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/** sRGB → linear, per WCAG 2.x. */
function channelLuminance(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG contrast ratio, 1:1 to 21:1. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

export const WCAG = {
  AA_NORMAL: 4.5,
  AA_LARGE: 3.0,
  AAA_NORMAL: 7.0,
  AAA_LARGE: 4.5,
  /** Non-text UI components and graphical objects — WCAG 1.4.11. */
  AA_NON_TEXT: 3.0,
} as const;

export function meetsAA(fg: string, bg: string, large = false): boolean {
  return contrastRatio(fg, bg) >= (large ? WCAG.AA_LARGE : WCAG.AA_NORMAL);
}

export function meetsAAA(fg: string, bg: string, large = false): boolean {
  return contrastRatio(fg, bg) >= (large ? WCAG.AAA_LARGE : WCAG.AAA_NORMAL);
}

// ─── Colour-vision deficiency simulation ─────────────────────────────────────
//
// LMS-space simulation (Viénot / Brettel style). Used to prove that no state in
// the product is distinguishable by hue alone — the defect that made correct
// and wrong render identically for roughly 1 in 12 boys.

export type Cvd = 'protanopia' | 'deuteranopia' | 'tritanopia';

function srgbToLinear(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(v: number): number {
  const c = Math.max(0, Math.min(1, v));
  return (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255;
}

/** Simulate how a colour appears to someone with the given dichromacy. */
export function simulateCvd(hex: string, kind: Cvd): string {
  const { r: r8, g: g8, b: b8 } = hexToRgb(hex);
  const r = srgbToLinear(r8), g = srgbToLinear(g8), b = srgbToLinear(b8);

  let L = 17.8824 * r + 43.5161 * g + 4.11935 * b;
  let M = 3.45565 * r + 27.1554 * g + 3.86714 * b;
  let S = 0.0299566 * r + 0.184309 * g + 1.46709 * b;

  if (kind === 'protanopia')        L = 2.02344 * M - 2.52581 * S;
  else if (kind === 'deuteranopia') M = 0.494207 * L + 1.24827 * S;
  else                              S = -0.395913 * L + 0.801109 * M;

  return rgbToHex({
    r: linearToSrgb(0.080944 * L - 0.130504 * M + 0.116721 * S),
    g: linearToSrgb(-0.0102485 * L + 0.0540194 * M - 0.113615 * S),
    b: linearToSrgb(-0.000365294 * L - 0.00412163 * M + 0.693513 * S),
  });
}

/**
 * Can two colours still be told apart under a given colour-vision deficiency?
 *
 * Threshold of 2.0 is deliberately conservative. It is NOT a claim that colour
 * alone is sufficient — the design requires icon, text and motion regardless —
 * but a pair that collapses below this is a design smell worth failing on.
 */
export function distinguishableUnder(a: string, b: string, kind: Cvd, min = 2.0): boolean {
  return contrastRatio(simulateCvd(a, kind), simulateCvd(b, kind)) >= min;
}

/** Worst-case separation across all three dichromacies. */
export function worstCaseSeparation(a: string, b: string): { kind: Cvd; ratio: number } {
  const kinds: Cvd[] = ['protanopia', 'deuteranopia', 'tritanopia'];
  let worst = { kind: kinds[0], ratio: Infinity };
  for (const kind of kinds) {
    const ratio = contrastRatio(simulateCvd(a, kind), simulateCvd(b, kind));
    if (ratio < worst.ratio) worst = { kind, ratio };
  }
  return worst;
}
