export type RecipeNutrition = {
  kcal: number; protein: number; carbs: number; fat: number;
  salt: number | null; freeSugar: number | null;
};
export type RecipeVersion = {
  title: string; servings: number;
  ingredients: { name: string; dutchName: string; quantity: number | null; unit: string; category: string }[];
  steps: string[]; nutrition: RecipeNutrition;
};
export type ParsedRecipe = RecipeVersion & { healthier: RecipeVersion; changes: string[] };
export type RecipeChoice = "yummy" | "healthier";
export function chooseRecipe(recipe: ParsedRecipe, choice: RecipeChoice): RecipeVersion {
  return choice === "healthier" ? recipe.healthier : recipe;
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