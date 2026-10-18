import { describe, expect, it } from "vitest";
import { applyAdjustments, chooseRecipe, computedNutrition, MEAL_BUDGET, nutritionWarnings, type ParsedRecipe } from "@/lib/recipe";
import { dutchGroceryTerm, jumboBeefProduct } from "@/lib/grocery";
import { STORES } from "@/lib/scale";

const ing = (over: Partial<Parameters<typeof chooseRecipe>[0]["ingredients"][number]> = {}) =>
  ({ name: "Onion", dutchName: "ui", quantity: 1, unit: "pc", category: "produce", changedFrom: null, nutrition: { kcal: 40, protein: 1, carbs: 9, fat: 0 }, ...over });

describe("recipe and grocery choices", () => {
  it("moves spring-onion preparation into cooking and searches for bosui in both versions", () => {
    const base = { title: "Onions", servings: 2, ingredients: [{ name: "Spring onions, cut into 3 cm pieces, whites and greens separated (or a handful of garlic chives)", dutchName: "bosui, gesneden", quantity: 3, unit: "pc", category: "produce", changedFrom: null, nutrition: { kcal: 30, protein: 1, carbs: 5, fat: 0 } }], steps: ["Fry onions"], nutrition: { kcal: 30, protein: 1, carbs: 5, fat: 0, salt: null, freeSugar: null } };
    const recipe: ParsedRecipe = { ...base, healthier: base, changes: [] };
    for (const choice of ["yummy", "healthier"] as const) {
      const selected = chooseRecipe(recipe, choice);
      expect(selected.ingredients[0]?.name).toBe("Spring onions");
      expect(selected.ingredients[0]?.dutchName).toBe("bosui");
      expect(selected.steps[0]).toBe("Spring onions: cut into 3 cm pieces, whites and greens separated (or a handful of garlic chives)");
      expect(selected.steps[1]).toBe("Fry onions");
    }
    expect(recipe.ingredients[0]?.name).toContain("cut into 3 cm pieces");
    expect(dutchGroceryTerm(base.ingredients[0]?.name ?? "")).toBe("bosui");
  });
  it("uses the supplied lean beef page, and extra-lean beef has fewer label calories", () => {
    expect(jumboBeefProduct("lean minced beef")?.url).toBe("https://www.jumbo.com/producten/jumbo-rund-mager-gehakt-400-g-716180TRA");
    expect(jumboBeefProduct("extra lean minced beef")?.kcal).toBe(161);
    expect(jumboBeefProduct("minced beef")?.kcal).toBe(244);
  });
  it("does not replace vegetarian mince with beef", () => {
    expect(jumboBeefProduct("vegetarian ground beef")).toBeNull();
    expect(jumboBeefProduct("extra lean minced beef 5% fat")).toBeNull();
  });
  it("searches Dutch stores in Dutch without Jumbo's broken path", () => {
    expect(dutchGroceryTerm("Minced beef")).toBe("rundergehakt");
    const jumbo = STORES.find(s => s.id === "jumbo");
    expect(jumbo?.searchUrl("Minced beef")).toBe("https://www.jumbo.com/producten/?searchTerms=rundergehakt");
    for (const store of STORES) expect(decodeURIComponent(store.searchUrl("Minced beef"))).toContain("rundergehakt");
  });
  it("warns above a third of 5g salt, but not at the budget", () => {
    const n = { kcal: 500, protein: 20, carbs: 40, fat: 15, salt: 2, freeSugar: null };
    expect(nutritionWarnings(n).salt).toBe(true);
    expect(nutritionWarnings({ ...n, salt: MEAL_BUDGET.salt }).salt).toBe(false);
  });
  it("warns above a third of 25g free sugars and never treats unknown as zero", () => {
    const n = { kcal: 500, protein: 20, carbs: 40, fat: 15, salt: null, freeSugar: 9 };
    expect(nutritionWarnings(n).freeSugar).toBe(true);
    expect(nutritionWarnings({ ...n, freeSugar: null }).freeSugar).toBe(false);
  });
  it("keeps the original or switches ingredients, steps and nutrition together", () => {
    const n = { kcal: 500, protein: 20, carbs: 40, fat: 15, salt: 2, freeSugar: 9 };
    const base = { title: "Beef", servings: 2, ingredients: [{ name: "minced beef", dutchName: "rundergehakt", quantity: 400, unit: "g", category: "meat", changedFrom: null, nutrition: { kcal: 1000, protein: 80, carbs: 0, fat: 70 } }], steps: ["Fry beef"], nutrition: n };
    const r: ParsedRecipe = { ...base, healthier: { ...base, ingredients: [{ name: "extra lean minced beef", dutchName: "extra mager rundergehakt", quantity: 400, unit: "g", category: "meat", changedFrom: "minced beef", nutrition: { kcal: 800, protein: 84, carbs: 0, fat: 38 } }], steps: ["Fry extra lean beef"], nutrition: { ...n, kcal: 400 } }, changes: ["Use lean beef"] };
    expect(chooseRecipe(r, "yummy").ingredients[0]?.name).toBe("minced beef");
    expect(chooseRecipe(r, "healthier").ingredients[0]?.name).toBe("extra lean minced beef");
    expect(chooseRecipe(r, "healthier").ingredients[0]?.changedFrom).toBe("minced beef");
    expect(chooseRecipe(r, "yummy").ingredients[0]?.changedFrom).toBeUndefined();
    expect(chooseRecipe(r, "healthier").steps[0]).toBe("Fry extra lean beef");
    expect(chooseRecipe(r, "healthier").nutrition.kcal).toBe(400);
  });
  it("merges repeat mentions of the same ingredient into one shopping row", () => {
    const n = { kcal: 500, protein: 20, carbs: 40, fat: 15, salt: 1, freeSugar: 2 };
    const base = { title: "Pad thai", servings: 2, ingredients: [
      ing({ name: "Peanuts", dutchName: "pinda's", quantity: 30, unit: "g", category: "pantry", nutrition: { kcal: 170, protein: 8, carbs: 5, fat: 14 } }),
      ing({ name: "Beansprouts", dutchName: "tauge", quantity: 100, unit: "g", category: "produce", nutrition: { kcal: 30, protein: 3, carbs: 6, fat: 0 } }),
      ing({ name: "Peanuts, crushed", dutchName: "pinda's", quantity: 2, unit: "tbsp", category: "pantry", nutrition: { kcal: 100, protein: 5, carbs: 3, fat: 8 } }),
      ing({ name: "beansprouts", dutchName: "tauge", quantity: 1, unit: "handful", category: "produce", nutrition: { kcal: 10, protein: 1, carbs: 2, fat: 0 } }),
    ], steps: ["Stir fry"], nutrition: n };
    const r: ParsedRecipe = { ...base, healthier: base, changes: [] };
    const selected = chooseRecipe(r, "yummy");
    expect(selected.ingredients.map(i => i.name)).toEqual(["Peanuts", "Beansprouts"]);
    expect(selected.ingredients[0]?.quantity).toBe(30);
    expect(selected.ingredients[0]?.dutchName).toBe("pinda's");
    expect(selected.steps).toContain("Peanuts: crushed");
    expect(selected.steps).toContain("Peanuts: add 2 tbsp (listed separately in the source)");
    expect(selected.steps).toContain("Beansprouts: add 1 handful (listed separately in the source)");
  });
});