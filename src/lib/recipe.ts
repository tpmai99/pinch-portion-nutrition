import { splitIngredientName, dutchGroceryTerm } from "./grocery";
import { formatQuantity, scaleQuantity } from "./scale";
import { baseQuantity } from "./units";

export type RecipeNutrition = {
  kcal: number; protein: number; carbs: number; fat: number;
  salt: number | null; freeSugar: number | null;
};
export type IngredientNutrition = { kcal: number; protein: number; carbs: number; fat: number };
export type RecipeIngredient = {
  name: string; dutchName: string; quantity: number | null; unit: string; category: string;
  changedFrom: string | null; nutrition: IngredientNutrition;
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
      },
    }];
  });
  return { ...r, ingredients };
}

/** Per-portion macros recomputed from the ingredients actually in the meal. Salt and free sugars stay at the version estimate. */
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
  return { ...sum, kcal: sum.kcal / s, protein: sum.protein / s, carbs: sum.carbs / s, fat: sum.fat / s, salt: r.nutrition.salt, freeSugar: r.nutrition.freeSugar };
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
