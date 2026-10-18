import { describe, expect, it } from "vitest";
import { applyAdjustments, chooseRecipe, computedNutrition, ingredientChangeLabel, MEAL_BUDGET, nutritionWarnings, type ParsedRecipe } from "@/lib/recipe";
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
    expect(chooseRecipe(r, "yummy").ingredients[0]?.changedFrom).toBeNull();
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
  it("recomputes per-portion macros when ingredients are removed or amounts change", () => {
    const n = { kcal: 600, protein: 24, carbs: 48, fat: 18, salt: 1, freeSugar: 2 };
    const r: ParsedRecipe = {
      title: "Stir fry", servings: 2,
      ingredients: [
        ing({ name: "Noodles", quantity: 200, unit: "g", category: "pantry", nutrition: { kcal: 600, protein: 20, carbs: 120, fat: 2 } }),
        ing({ name: "Chicken", quantity: 300, unit: "g", category: "meat", nutrition: { kcal: 500, protein: 90, carbs: 0, fat: 14 } }),
      ],
      steps: ["Stir fry"], nutrition: n, healthier: null as unknown as ParsedRecipe["healthier"], changes: [],
    };
    // Both versions unused here; recompute from ingredients only.
    const base = { ...r, ingredients: r.ingredients, servings: 2 };
    expect(computedNutrition(base)).toMatchObject({ kcal: 550, protein: 55, carbs: 60, fat: 8 });
    const lessChicken = applyAdjustments(base, { 1: 0.5 }, new Set());
    expect(lessChicken.ingredients[1]?.quantity).toBe(150);
    expect(computedNutrition(lessChicken).kcal).toBe(425);
    const noChicken = applyAdjustments(base, {}, new Set([1]));
    expect(noChicken.ingredients.map((i) => i.name)).toEqual(["Noodles"]);
    expect(computedNutrition(noChicken).kcal).toBe(300);
    expect(computedNutrition(noChicken).salt).toBe(1);
    const moreNoodles = applyAdjustments(base, { 0: 2 }, new Set());
    expect(moreNoodles.ingredients[0]?.quantity).toBe(400);
    expect(computedNutrition(moreNoodles).kcal).toBe(850);
  });
  it("labels same-ingredient amount changes differently from real swaps", () => {
    const n = { kcal: 500, protein: 20, carbs: 40, fat: 15, salt: 1, freeSugar: 2 };
    const base = { title: "Stir fry", servings: 2, ingredients: [
      ing({ name: "Vegetable oil", dutchName: "zonnebloemolie", quantity: 3, unit: "tbsp", category: "pantry", nutrition: { kcal: 360, protein: 0, carbs: 0, fat: 42 } }),
      ing({ name: "minced beef", dutchName: "rundergehakt", quantity: 400, unit: "g", category: "meat", nutrition: { kcal: 900, protein: 70, carbs: 0, fat: 60 } }),
    ], steps: ["Stir fry"], nutrition: n };
    const r: ParsedRecipe = { ...base, healthier: { ...base, ingredients: [
      ing({ name: "Vegetable oil", dutchName: "zonnebloemolie", quantity: 1, unit: "tbsp", category: "pantry", nutrition: { kcal: 120, protein: 0, carbs: 0, fat: 14 } }),
      ing({ name: "extra lean minced beef", dutchName: "extra mager rundergehakt", quantity: 400, unit: "g", category: "meat", changedFrom: "minced beef", nutrition: { kcal: 700, protein: 75, carbs: 0, fat: 30 } }),
    ] }, changes: [] };
    const h = chooseRecipe(r, "healthier");
    const oil = h.ingredients[0];
    const beef = h.ingredients[1];
    expect(oil && ingredientChangeLabel(oil, h, r, 2)).toBe("Decreased by 30 ml");
    expect(beef && ingredientChangeLabel(beef, h, r, 2)).toBe("Changed · was: minced beef");
    // The same amount in both versions gets no label, and the swap text scales with portions.
    const y = chooseRecipe(r, "yummy");
    const yOil = y.ingredients[0];
    expect(yOil && ingredientChangeLabel(yOil, y, r, 2)).toBeNull();
    expect(beef && ingredientChangeLabel(beef, h, r, 4)).toBe("Changed · was: minced beef");
    // Oil decrease scales with portions: 6 tbsp vs 2 tbsp at 4 portions = 60 ml.
    expect(oil && ingredientChangeLabel(oil, h, r, 4)).toBe("Decreased by 60 ml");
  });
});