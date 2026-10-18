import { splitIngredientName, dutchGroceryTerm } from "./grocery";
import { formatQuantity, scaleQuantity } from "./scale";
import { baseQuantity, gramsPerCup } from "./units";

export type RecipeNutrition = {
  kcal: number; protein: number; carbs: number; fat: number;
  salt: number | null; freeSugar: number | null;
  // Computed in the browser only (never part of the import schema): the value is a minimum.
  saltAtLeast?: boolean; freeSugarAtLeast?: boolean;
};
export type IngredientNutrition = {
  kcal: number; protein: number; carbs: number; fat: number;
  // Optional only for recipes imported before per-ingredient estimates existed.
  salt?: number | null; freeSugar?: number | null;
  // Per-100 g macros, so Pinch can estimate an amount the user enters for unquantified items.
  per100g?: Per100g | null;
};
export type Per100g = { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null };

function addEstimate(a: number | null | undefined, b: number | null | undefined): number | null {
  return a == null || b == null ? null : a + b;
}
export type RecipeIngredient = {
  name: string; dutchName: string; quantity: number | null; unit: string; category: string;
  changedFrom: string | null; nutrition: IngredientNutrition;
  // The source marks it optional / to taste, or no amount is stated; the user can add grams.
  optional?: boolean;
};
export type RecipeVersion = {
  title: string; servings: number;
  ingredients: RecipeIngredient[];
  steps: string[]; nutrition: RecipeNutrition;
};
export type ParsedRecipe = RecipeVersion & { healthier: RecipeVersion; changes: string[] };
export type RecipeChoice = "yummy" | "healthier";

/** One shopping row per ingredient: the source often lists an item twice (e.g. in the sauce, then as garnish). */
function mergeIngredients(ingredients: RecipeVersion["ingredients"]): { merged: RecipeVersion["ingredients"]; extras: string[] } {
  const groups = new Map<string, { ing: RecipeVersion["ingredients"][number]; others: { quantity: number | null; unit: string }[] }>();
  for (const ing of ingredients) {
    const key = ing.name.trim().toLowerCase();
    const group = groups.get(key);
    if (!group) { groups.set(key, { ing: { ...ing }, others: [] }); continue; }
    if (ing.quantity != null && (ing.unit || "") === (group.ing.unit || "")) {
      group.ing.quantity = (group.ing.quantity ?? 0) + ing.quantity;
    } else {
      group.others.push({ quantity: ing.quantity, unit: ing.unit });
    }
    group.ing.nutrition = {
      kcal: group.ing.nutrition.kcal + ing.nutrition.kcal,
      protein: group.ing.nutrition.protein + ing.nutrition.protein,
      carbs: group.ing.nutrition.carbs + ing.nutrition.carbs,
      fat: group.ing.nutrition.fat + ing.nutrition.fat,
      salt: addEstimate(group.ing.nutrition.salt, ing.nutrition.salt),
      freeSugar: addEstimate(group.ing.nutrition.freeSugar, ing.nutrition.freeSugar),
    };
  }
  const extras: string[] = [];
  const merged = [...groups.values()].map(({ ing, others }) => {
    if (others.length) {
      const amounts = others.map(o => o.quantity == null ? "extra to taste" : `${formatQuantity(o.quantity)}${o.unit ? " " + o.unit : ""}`).join(" + ");
      extras.push(`${ing.name}: add ${amounts} (listed separately in the source)`);
    }
    return ing;
  });
  return { merged, extras };
}

export function chooseRecipe(recipe: ParsedRecipe, choice: RecipeChoice): RecipeVersion {
  const version = choice === "healthier" ? recipe.healthier : recipe;
  const preparation: string[] = [];
  const split = version.ingredients.map(ingredient => {
    const s = splitIngredientName(ingredient.name);
    if (s.preparation) preparation.push(`${s.name}: ${s.preparation}`);
    return { ...ingredient, name: s.name };
  });
  const { merged, extras } = mergeIngredients(split);
  const ingredients = merged.map(ing => {
    const translated = dutchGroceryTerm(ing.name);
    return { ...ing, dutchName: translated !== ing.name ? translated : dutchGroceryTerm(ing.dutchName) };
  });
  return { ...version, ingredients, steps: [...preparation, ...extras, ...version.steps] };
}

function normName(s: string): string {
  return splitIngredientName(s).name.trim().toLowerCase();
}

const PLAIN_SUGAR = /^(?:(?:white|brown|granulated|caster|castor|superfine|table|cane|raw|demerara|muscovado)\s+)*sugar$/;
const PLAIN_SALT = /^(?:(?:sea|table|kosher|fine|coarse|rock|iodised|iodized)\s+)*salt$/;

/** Only plain added sugar / plain salt are inferred from their mass; never confuse total carbs with free sugars. */
function ingredientEstimate(ing: RecipeIngredient, key: "salt" | "freeSugar"): number | null {
  const supplied = ing.nutrition[key];
  if (supplied != null) return supplied;
  const name = normName(ing.name);
  const isSugar = PLAIN_SUGAR.test(name);
  const isSalt = PLAIN_SALT.test(name);
  if (!isSugar && !isSalt) return null;
  if ((key === "salt" && isSugar) || (key === "freeSugar" && isSalt)) return 0;
  if (ing.quantity == null) return null;
  const base = baseQuantity(ing.quantity, ing.unit);
  if (!base) return null;
  if (base.unit === "g") return base.amount;
  const density = gramsPerCup(name);
  return density == null ? null : base.amount * density / 240;
}

/** Why a healthier-version ingredient differs from the original: a pure amount change
 *  ("Decreased by 2 tbsp") when it is the same product in a different quantity, otherwise
 *  the swap text ("Changed · was: oil"). Amounts are compared at the chosen portions. */
export function ingredientChangeLabel(
  ing: RecipeIngredient, version: RecipeVersion, original: RecipeVersion, portions: number,
): string | null {
  const name = normName(ing.name);
  const from = ing.changedFrom ? normName(ing.changedFrom) : null;
  const match = original.ingredients.find((o) => {
    const on = normName(o.name);
    return on === name || (from != null && on === from);
  });
  const sameProduct = match != null && normName(match.name) === name;
  if (!match || !sameProduct) return from && from !== name ? `Changed · was: ${ing.changedFrom}` : null;
  if (ing.quantity == null || match.quantity == null) return null;
  const shown = (q: number, servings: number) => scaleQuantity(q, servings > 0 ? servings : 1, portions);
  const qH = shown(ing.quantity, version.servings);
  const qO = shown(match.quantity, original.servings);
  if (qH == null || qO == null) return null;
  const hu = (ing.unit || "").trim().toLowerCase();
  const ou = (match.unit || "").trim().toLowerCase();
  let delta = qH - qO;
  let unit = hu || ou;
  if (hu && ou && hu !== ou) {
    const bh = baseQuantity(qH, hu);
    const bo = baseQuantity(qO, ou);
    if (!bh || !bo || bh.unit !== bo.unit) return null;
    delta = bh.amount - bo.amount;
    unit = bh.unit;
  } else {
    // Prefer g / ml for the delta (the user asked for grams or millilitres); keep native units like pc or handful.
    const base = unit ? baseQuantity(1, unit) : null;
    if (base) { delta = delta * base.amount; unit = base.unit; }
  }
  const rel = Math.abs(delta) / Math.max(Math.abs(qH), Math.abs(qO), 1e-9);
  if (rel < 0.06) return null;
  const abs = Math.abs(delta) >= 10 ? Math.round(Math.abs(delta)) : Math.round(Math.abs(delta) * 2) / 2;
  return `${delta < 0 ? "Decreased" : "Increased"} by ${formatQuantity(abs)}${unit ? ` ${unit}` : ""}`;
}

/** Drops removed ingredients and scales kept ones (with their nutrition) by the user's amount multiplier. */
export function applyAdjustments(r: RecipeVersion, adjust: Record<number, number>, removed: Set<number>): RecipeVersion {
  const ingredients = r.ingredients.flatMap((ing, i) => {
    if (removed.has(i)) return [];
    const m = adjust[i] ?? 1;
    if (m === 1) return [ing];
    return [{
      ...ing,
      quantity: ing.quantity == null ? null : ing.quantity * m,
      nutrition: {
        kcal: ing.nutrition.kcal * m, protein: ing.nutrition.protein * m,
        carbs: ing.nutrition.carbs * m, fat: ing.nutrition.fat * m,
        salt: ingredientEstimate(ing, "salt") == null ? null : (ingredientEstimate(ing, "salt") ?? 0) * m,
        freeSugar: ingredientEstimate(ing, "freeSugar") == null ? null : (ingredientEstimate(ing, "freeSugar") ?? 0) * m,
      },
    }];
  });
  // Keep a known recipe estimate by applying only known changes. Unknown unchanged
  // ingredients do not invalidate it; increasing an unknown contribution turns it into
  // a minimum ("at least"), while reducing or removing one makes it unknown.
  const fallback = (key: "salt" | "freeSugar"): { value: number | null; atLeast: boolean } => {
    const original = r.nutrition[key];
    if (original == null) return { value: null, atLeast: false };
    let delta = 0;
    let atLeast = !!r.nutrition[key === "salt" ? "saltAtLeast" : "freeSugarAtLeast"];
    for (const [i, ing] of r.ingredients.entries()) {
      const multiplier = removed.has(i) ? 0 : (adjust[i] ?? 1);
      if (multiplier === 1) continue;
      const estimate = ingredientEstimate(ing, key);
      if (estimate == null) {
        if (multiplier > 1) { atLeast = true; continue; }
        return { value: null, atLeast: false };
      }
      delta += estimate * (multiplier - 1);
    }
    return { value: Math.max(0, original + delta / (r.servings > 0 ? r.servings : 1)), atLeast };
  };
  const salt = fallback("salt");
  const sugar = fallback("freeSugar");
  return { ...r, ingredients, nutrition: { ...r.nutrition, salt: salt.value, saltAtLeast: salt.atLeast, freeSugar: sugar.value, freeSugarAtLeast: sugar.atLeast } };
}

/** Recompute per-portion nutrition from included ingredients; never treat unknown as zero.
 *  When some ingredients are unknown, the known ones still give a minimum ("at least"). */
export function computedNutrition(r: RecipeVersion): RecipeNutrition {
  const s = r.servings > 0 ? r.servings : 1;
  const sum = r.ingredients.reduce(
    (a, ing) => ({
      kcal: a.kcal + ing.nutrition.kcal,
      protein: a.protein + ing.nutrition.protein,
      carbs: a.carbs + ing.nutrition.carbs,
      fat: a.fat + ing.nutrition.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  const estimate = (key: "salt" | "freeSugar"): { value: number | null; atLeast: boolean } => {
    const known = r.ingredients.map(ing => ingredientEstimate(ing, key));
    const partial = known.reduce<number>((t, v) => t + (v ?? 0), 0) / s;
    if (known.every(v => v != null)) return { value: partial, atLeast: false };
    const total = r.nutrition[key];
    const totalAtLeast = !!r.nutrition[key === "salt" ? "saltAtLeast" : "freeSugarAtLeast"];
    if (total != null) return totalAtLeast ? { value: Math.max(total, partial), atLeast: true } : { value: total, atLeast: false };
    return known.some(v => v != null && v > 0) ? { value: partial, atLeast: true } : { value: null, atLeast: false };
  };
  const salt = estimate("salt");
  const sugar = estimate("freeSugar");
  return {
    ...sum, kcal: sum.kcal / s, protein: sum.protein / s, carbs: sum.carbs / s, fat: sum.fat / s,
    salt: salt.value, saltAtLeast: salt.atLeast, freeSugar: sugar.value, freeSugarAtLeast: sugar.atLeast,
  };
}
// Planning budgets, not official per-meal recommendations: one third of
// WHO adult daily salt limit and preferred free-sugar target at 2,000 kcal.
export const MEAL_BUDGET = { salt: 5 / 3, freeSugar: 25 / 3 };
export function nutritionWarnings(n: RecipeNutrition) {
  return {
    salt: n.salt != null && n.salt > MEAL_BUDGET.salt,
    freeSugar: n.freeSugar != null && n.freeSugar > MEAL_BUDGET.freeSugar,
  };
}
