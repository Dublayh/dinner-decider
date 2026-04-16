// Shared amount parsing/formatting used in recipe scaling and grocery combining

export function parseAmount(amt: string): number | null {
  if (!amt?.trim()) return null;
  const s = amt.trim();
  // Range like "2-3" — use the lower
  const range = s.match(/^([\d.]+)\s*[-–]\s*([\d.]+)$/);
  if (range) return parseFloat(range[1]);
  // Mixed number like "1 1/2"
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3]);
  // Simple fraction like "1/2"
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return parseInt(frac[1]) / parseInt(frac[2]);
  // Unicode fractions
  const unicodeMap: Record<string, number> = {
    '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 0.333, '⅔': 0.667,
    '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
  };
  for (const [sym, val] of Object.entries(unicodeMap)) {
    if (s === sym) return val;
    const mixedUnicode = s.match(new RegExp(`^(\\d+)\\s*${sym}$`));
    if (mixedUnicode) return parseInt(mixedUnicode[1]) + val;
  }
  // Plain number
  const num = parseFloat(s);
  return isNaN(num) ? null : num;
}

export function formatAmount(n: number): string {
  if (n === Math.floor(n)) return String(n);
  const fractions: [number, string][] = [
    [0.125, '⅛'], [0.25, '¼'], [0.333, '⅓'], [0.5, '½'],
    [0.667, '⅔'], [0.75, '¾'],
  ];
  const whole = Math.floor(n);
  const dec = n - whole;
  for (const [val, sym] of fractions) {
    if (Math.abs(dec - val) < 0.05) {
      return whole > 0 ? `${whole} ${sym}` : sym;
    }
  }
  return n % 1 === 0 ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}
