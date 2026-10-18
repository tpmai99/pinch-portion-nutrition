import { splitIngredientName, dutchGroceryTerm } from "./grocery";
import { formatQuantity } from "./scale";

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
// Planning budgets, not official per-meal recommendations: one third of
// WHO adult daily salt limit and preferred free-sugar target at 2,000 kcal.
export const MEAL_BUDGET = { salt: 5 / 3, freeSugar: 25 / 3 };
export function nutritionWarnings(n: RecipeNutrition) {
  return {
    salt: n.salt != null && n.salt > MEAL_BUDGET.salt,
    freeSugar: n.freeSugar != null && n.freeSugar > MEAL_BUDGET.freeSugar,
  };
}
