import { dutchGroceryTerm } from "./grocery";

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

/** Whether Pinch can put items into this store's cart on the customer's behalf. */
export type CartSupport = "auto" | "manual" | "none";

export type Store = {
  id: string;
  name: string;
  tier: Preference;
  priceFactor: number;
  searchUrl: (q: string) => string;
  cart: CartSupport;
  /** Shown before the customer picks this store, so the cart behaves as promised. */
  cartNote: string;
};

export const CART_LABEL: Record<CartSupport, string> = {
  auto: "Cart fills automatically",
  manual: "Cart fills one item at a time",
  none: "No online shop",
};

export const STORES: Store[] = [
  { id: "lidl", name: "Lidl", tier: "cheap", priceFactor: 0.78, cart: "none", searchUrl: (q) => `https://www.lidl.nl/q/search?q=${encodeURIComponent(dutchGroceryTerm(q))}`,
    cartNote: "Lidl has no online shop in the Netherlands, so no app can fill a cart there. Tap “Go there & buy” and shop this list in store." },
  { id: "aldi", name: "Aldi", tier: "cheap", priceFactor: 0.8, cart: "none", searchUrl: (q) => `https://www.aldi.nl/zoeken.html?query=${encodeURIComponent(dutchGroceryTerm(q))}`,
    cartNote: "Aldi has no online shop in the Netherlands, so no app can fill a cart there. Tap “Go there & buy” and shop this list in store." },
  { id: "dirk", name: "Dirk", tier: "cheap", priceFactor: 0.83, cart: "none", searchUrl: (q) => `https://www.dirk.nl/zoeken/producten/${encodeURIComponent(dutchGroceryTerm(q))}`,
    cartNote: "Dirk deliberately doesn't deliver or sell online, so no app can fill a cart there. Tap “Go there & buy” and shop this list in store." },
  { id: "vomar", name: "Vomar", tier: "cheap", priceFactor: 0.82, cart: "manual", searchUrl: (q) => `https://www.vomar.nl/zoeken?search=${encodeURIComponent(dutchGroceryTerm(q))}`,
    cartNote: "Vomar doesn't let other apps put items in your cart. Tap “Add” on each item to search it on vomar.nl and add it there, or shop this list in store. Results and availability may vary." },
  { id: "ah", name: "Albert Heijn", tier: "quality", priceFactor: 1.15, cart: "manual", searchUrl: (q) => `https://www.ah.nl/zoeken?query=${encodeURIComponent(dutchGroceryTerm(q))}`,
    cartNote: "Albert Heijn doesn't let other apps put items in your cart. Tap “Add” on each item to open it on ah.nl and add it there." },
  { id: "jumbo", name: "Jumbo", tier: "quality", priceFactor: 1.05, cart: "manual", searchUrl: (q) => `https://www.jumbo.com/producten/?searchTerms=${encodeURIComponent(dutchGroceryTerm(q))}`,
    cartNote: "Jumbo can't fill your cart automatically. Open a matched product and add it on Jumbo. Other items use Dutch search; results and availability may vary. If Jumbo says the page is blocked, copy the Dutch name and open Jumbo's catalogue in your regular browser or use the Jumbo app. Pinch cannot remove a block imposed by Jumbo." },
  { id: "ekoplaza", name: "Ekoplaza", tier: "quality", priceFactor: 1.35, cart: "manual", searchUrl: (q) => `https://www.ekoplaza.nl/nl/zoeken?q=${encodeURIComponent(dutchGroceryTerm(q))}`,
    cartNote: "Ekoplaza doesn't let other apps put items in your cart. Tap “Add” on each item to open it on ekoplaza.nl and add it there." },
];

const BASE: Record<string, number> = {
  produce: 1.4, dairy: 1.6, meat: 4.5, fish: 5.5, pantry: 1.3, bakery: 1.8, spices: 1.2, frozen: 2.5, other: 1.5,
};

export function estimateItemPrice(category: string) {
  return BASE[category] ?? 1.5;
}

export function estimateCart(categories: string[], store: Store) {
  const sum = categories.reduce((s: number, c) => s + estimateItemPrice(c), 0);
  return Math.round(sum * store.priceFactor * 100) / 100;
}

/** Deterministic pseudo-distance per store based on location seed (km). */
export function storeDistance(seed: string, storeId: string) {
  let h = 0;
  for (const ch of seed + storeId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return Math.round((0.3 + (h % 45) / 10) * 10) / 10;
}
