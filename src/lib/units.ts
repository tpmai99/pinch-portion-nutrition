import { formatQuantity, scaleQuantity } from "./scale";

export type UnitMode = "metric" | "cups";

/** Mass units to grams. */
const MASS_G: Record<string, number> = {
  g: 1, gr: 1, gram: 1, grams: 1, kg: 1000, kilo: 1000, kilos: 1000,
  oz: 28.35, ounce: 28.35, ounces: 28.35, lb: 453.6, lbs: 453.6, pound: 453.6, pounds: 453.6,
};

/** Volume units to millilitres (1 US cup = 240 ml). */
const VOL_ML: Record<string, number> = {
  ml: 1, milliliter: 1, millilitre: 1, dl: 100, l: 1000, liter: 1000, litre: 1000,
  tbsp: 15, tbsps: 15, tablespoon: 15, tablespoons: 15,
  tsp: 5, tsps: 5, teaspoon: 5, teaspoons: 5,
  cup: 240, cups: 240,
};

/** Approximate grams per US cup (240 ml) for common ingredients, keyed by name keywords.
 *  Kept deliberately conservative: an unknown density returns grams instead of a guess. */
const GRAMS_PER_CUP: [RegExp, number][] = [
  [/flour/, 120],
  [/sugar|caster|sucrose/, 200],
  [/rice/, 185],
  [/oat\b|oats\b|oatmeal/, 90],
  [/butter|ghee|margarine|shortening/, 227],
  [/oil/, 216],
  [/milk|buttermilk/, 245],
  [/yog?urt/, 245],
  [/cream(?! of)/, 238],
  [/honey|syrup|molasses|treacle/, 330],
  [/cheese|parmesan|cheddar|mozzarella/, 110],
  [/almond flour|almond meal|nut flour/, 96],
  [/peanut|almond\b|walnut|cashew|pistachio|pecan|hazelnut|nut\b|nuts\b/, 130],
  [/bread ?crumb|panko|crouton/, 110],
  [/cocoa/, 120],
  [/bean ?sprout|tauge|alfalfa|sunflower sprout/, 65],
  [/beans?\b|chickpea|lentil|legume/, 180],
  [/corn\b|peas?\b/, 150],
  [/spinach|kale|lettuce|arugula|rocket|greens\b|cabbage/, 60],
  [/tomato/, 180],
  [/onion\b|shallot|scallion|spring onion|leek/, 160],
  [/coconut\b/, 80],
  [/pasta|noodle|macaroni|spaghetti|penne|fusilli/, 100],
  [/quinoa|couscous|bulgur|barley|buckwheat/, 170],
  [/seeds?\b|sesame|sunflower|pumpkin seed|flax|chia/, 140],
  [/mushroom/, 90],
  [/carrot|celery|pepper\b|zucchini|courgette|aubergine|eggplant/, 130],
  [/tofu|tempeh/, 250],
  [/apple|banana|berry|berries|strawberr|blueberr|raspberr|mango|pineapple/, 150],
  [/stock|broth|water\b|juice/, 240],
];

/** Ingredients that are naturally measured as liquids: keep volume (ml) in metric mode.
 *  Everything else given in volume units converts to grams when its density is known. */
const LIQUID: RegExp[] = [
  /water/, /milk|buttermilk/, /oil/, /stock|broth|bouillon/, /juice/,
  /cream(?! of)/, /wine|beer|cider/, /vinegar/, /soy ?sauce|fish ?sauce|oyster ?sauce/,
  /honey|syrup|molasses|treacle/, /sauce\b/, /dressing/, /melted/,
];

export function isLiquid(name: string): boolean {
  const n = name.toLowerCase();
  return LIQUID.some((re) => re.test(n));
}

export function gramsPerCup(name: string): number | null {
  const n = name.toLowerCase();
  for (const [re, g] of GRAMS_PER_CUP) if (re.test(n)) return g;
  return null;
}

/** Base amount for comparing two quantities: grams for mass units, ml for volume units, null otherwise. */
export function baseQuantity(quantity: number, unit: string): { unit: "g" | "ml"; amount: number } | null {
  const u = (unit || "").trim().toLowerCase();
  if (MASS_G[u]) return { unit: "g", amount: quantity * MASS_G[u] };
  if (VOL_ML[u]) return { unit: "ml", amount: quantity * VOL_ML[u] };
  return null;
}

function gramsText(g: number): string {
  const r = g >= 500 ? Math.round(g / 10) * 10 : g >= 100 ? Math.round(g / 5) * 5 : Math.round(g);
  return `${r} g`;
}

function mlText(ml: number): string {
  const r = ml >= 100 ? Math.round(ml / 5) * 5 : Math.round(ml);
  return `${r} ml`;
}

function cupsText(cups: number): string {
  if (cups < 0.25) {
    // Too small for cups — show tablespoons instead of a misleading fraction.
    const tbsp = Math.max(0.5, Math.round((cups * 240) / 15 * 2) / 2);
    return `${formatQuantity(tbsp)} tbsp`;
  }
  return `${formatQuantity(cups)} ${cups > 1 ? "cups" : "cup"}`;
}

/** Formatted amount for an ingredient at the chosen unit mode, scaled from `from` to `to` portions.
 *  Count-based units (pc, cloves, "to taste") are left untouched in both modes. */
export function convertAmount(
  name: string, quantity: number | null, unit: string, from: number, to: number, mode: UnitMode,
): string {
  const q = scaleQuantity(quantity, from, to);
  const u = (unit || "").trim().toLowerCase();
  if (q == null) return unit || "to taste";
  const massG = q * (MASS_G[u] ?? 0);
  const volMl = q * (VOL_ML[u] ?? 0);
  const fallback = `${formatQuantity(q)}${unit ? " " + unit : ""}`;
  if (mode === "metric") {
    if (massG) return gramsText(massG);
    if (volMl) {
      // Solids should not be shown in ml — convert to grams when the density is known.
      const density = gramsPerCup(name);
      if (!isLiquid(name) && density) return gramsText((volMl * density) / 240);
      return mlText(volMl);
    }
    return fallback;
  }
  if (volMl) return cupsText(volMl / 240);
  if (massG) {
    const density = gramsPerCup(name);
    return density ? cupsText(massG / density) : gramsText(massG);
  }
  return fallback;
}
