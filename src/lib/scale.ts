export function scaleQuantity(qty: number | null, from: number, to: number): number | null {
  if (qty == null || from <= 0) return qty;
  return (qty * to) / from;
}

export function formatQuantity(qty: number | null): string {
  if (qty == null) return "";
  if (qty >= 10) return String(Math.round(qty));
  const r = Math.round(qty * 100) / 100;
  const whole = Math.floor(r);
  const frac = r - whole;
  const fracs: [number, string][] = [[0.25, "¼"], [0.33, "⅓"], [0.5, "½"], [0.67, "⅔"], [0.75, "¾"]];
  for (const [v, s] of fracs) if (Math.abs(frac - v) < 0.02) return whole ? `${whole}${s}` : s;
  return String(Math.round(r * 10) / 10);
}

/** Total nutrition for the batch = per-portion value × portions. Per-portion stays constant. */
export function totalNutrition(perPortion: number, portions: number) {
  return Math.round(perPortion * portions);
}

export type Preference = "cheap" | "quality";

export type Store = {
  id: string;
  name: string;
  tier: Preference;
  priceFactor: number;
  searchUrl: (q: string) => string;
};

export const STORES: Store[] = [
  { id: "lidl", name: "Lidl", tier: "cheap", priceFactor: 0.78, searchUrl: (q) => `https://www.lidl.nl/q/search?q=${encodeURIComponent(q)}` },
  { id: "aldi", name: "Aldi", tier: "cheap", priceFactor: 0.8, searchUrl: (q) => `https://www.aldi.nl/zoeken.html?query=${encodeURIComponent(q)}` },
  { id: "dirk", name: "Dirk", tier: "cheap", priceFactor: 0.83, searchUrl: (q) => `https://www.dirk.nl/zoeken/producten/${encodeURIComponent(q)}` },
  { id: "ah", name: "Albert Heijn", tier: "quality", priceFactor: 1.15, searchUrl: (q) => `https://www.ah.nl/zoeken?query=${encodeURIComponent(q)}` },
  { id: "jumbo", name: "Jumbo", tier: "quality", priceFactor: 1.05, searchUrl: (q) => `https://www.jumbo.com/zoeken/producten?searchTerms=${encodeURIComponent(q)}` },
  { id: "ekoplaza", name: "Ekoplaza", tier: "quality", priceFactor: 1.35, searchUrl: (q) => `https://www.ekoplaza.nl/nl/zoeken?q=${encodeURIComponent(q)}` },
];

const BASE: Record<string, number> = {
  produce: 1.4, dairy: 1.6, meat: 4.5, fish: 5.5, pantry: 1.3, bakery: 1.8, spices: 1.2, frozen: 2.5, other: 1.5,
};

export function estimateItemPrice(category: string) {
  return BASE[category] ?? BASE.other;
}

export function estimateCart(categories: string[], store: Store) {
  const sum = categories.reduce((s, c) => s + estimateItemPrice(c), 0);
  return Math.round(sum * store.priceFactor * 100) / 100;
}

/** Deterministic pseudo-distance per store based on location seed (km). */
export function storeDistance(seed: string, storeId: string) {
  let h = 0;
  for (const ch of seed + storeId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return Math.round((0.3 + (h % 45) / 10) * 10) / 10;
}
