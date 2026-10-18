import { describe, expect, it } from "vitest";
import { applyAdjustments, applyOptionalAmounts, chooseRecipe, computedNutrition, ingredientChangeLabel, MEAL_BUDGET, nutritionWarnings, type ParsedRecipe } from "@/lib/recipe";
import { dutchGroceryTerm, jumboBeefProduct } from "@/lib/grocery";
import { STORES } from "@/lib/scale";

const ing = (over: Partial<Parameters<typeof chooseRecipe>[0]["ingredients"][number]> = {}) =>
  ({ name: "Onion", dutchName: "ui", quantity: 1, unit: "pc", category: "produce", changedFrom: null, nutrition: { kcal: 40, protein: 1, carbs: 9, fat: 0 }, ...over });

describe("recipe and grocery choices", () => {
  it("keeps ingredient calorie contributions per portion in sync with amounts and removal", () => {
    const ingredient = ing({ nutrition: { kcal: 330, protein: 60, carbs: 0, fat: 10 } });
    const recipe = { title: "Chicken", servings: 3, ingredients: [ingredient], steps: [], nutrition: { kcal: 110, protein: 20, carbs: 0, fat: 10 / 3, salt: null, freeSugar: null } };
    expect(ingredient.nutrition.kcal / recipe.servings).toBe(110);
    const doubled = applyAdjustments(recipe, { 0: 2 }, new Set());
    expect((doubled.ingredients[0]?.nutrition.kcal ?? -1) / recipe.servings).toBe(220);
    expect(computedNutrition(doubled).kcal).toBe(220);
    const removed = applyAdjustments(recipe, { 0: 2 }, new Set([0]));
    expect(computedNutrition(removed).kcal).toBe(0);
  });
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
    expect(computedNutrition(noChicken).salt).toBeNull();
    const moreNoodles = applyAdjustments(base, { 0: 2 }, new Set());
    expect(moreNoodles.ingredients[0]?.quantity).toBe(400);
    expect(computedNutrition(moreNoodles).kcal).toBe(850);
  });
  it("increasing fish sauce scales per-portion salt and changes its warning", () => {
    const r = { title: "Fish sauce rice", servings: 2, ingredients: [
      ing({ name: "Fish sauce", quantity: 15, unit: "ml", nutrition: { kcal: 10, protein: 1, carbs: 1, fat: 0, salt: 3, freeSugar: 0.5 } }),
      ing({ name: "Rice", nutrition: { kcal: 300, protein: 6, carbs: 66, fat: 1, salt: 0, freeSugar: 0 } }),
    ], steps: [], nutrition: { kcal: 155, protein: 3.5, carbs: 33.5, fat: 0.5, salt: 1.5, freeSugar: 0.25 } };
    expect(computedNutrition(r).salt).toBe(1.5);
    expect(nutritionWarnings(computedNutrition(r)).salt).toBe(false);
    const more = computedNutrition(applyAdjustments(r, { 0: 2 }, new Set()));
    expect(more.salt).toBe(3);
    expect(more.freeSugar).toBe(0.5);
    expect(nutritionWarnings(more).salt).toBe(true);
    expect(computedNutrition(applyAdjustments(r, { 0: 0.5 }, new Set())).salt).toBe(0.75);
    expect(computedNutrition(applyAdjustments(r, {}, new Set([0]))).salt).toBe(0);
  });
  it("shows a minimum instead of unknown when an unknown ingredient is increased", () => {
    const r = { title: "Sauce", servings: 2, ingredients: [ing()], steps: [], nutrition: { kcal: 20, protein: 0.5, carbs: 4.5, fat: 0, salt: 1, freeSugar: 2 } };
    expect(computedNutrition(r).salt).toBe(1);
    const more = computedNutrition(applyAdjustments(r, { 0: 2 }, new Set()));
    expect(more).toMatchObject({ salt: 1, saltAtLeast: true, freeSugar: 2, freeSugarAtLeast: true });
    // Reducing an unknown contribution cannot be bounded from below.
    expect(computedNutrition(applyAdjustments(r, { 0: 0.5 }, new Set())).salt).toBeNull();
    const partial = { ...r, ingredients: [ing({ nutrition: { kcal: 40, protein: 1, carbs: 9, fat: 0, salt: null, freeSugar: 0 } })] };
    expect(computedNutrition(applyAdjustments(partial, { 0: 2 }, new Set())).saltAtLeast).toBe(true);
    expect(computedNutrition(applyAdjustments(partial, { 0: 2 }, new Set())).freeSugar).toBe(0);
  });
  it("recalculates legacy sugar amounts without losing a known meal estimate", () => {
    const r = { title: "Sweet rice", servings: 2, ingredients: [
      ing({ name: "Sugar", quantity: 10, unit: "g", nutrition: { kcal: 40, protein: 0, carbs: 10, fat: 0 } }),
      ing({ name: "Rice", nutrition: { kcal: 300, protein: 6, carbs: 66, fat: 1 } }),
    ], steps: [], nutrition: { kcal: 170, protein: 3, carbs: 38, fat: 0.5, salt: 0.1, freeSugar: 6 } };
    const more = computedNutrition(applyAdjustments(r, { 0: 2 }, new Set()));
    expect(more.freeSugar).toBe(11);
    expect(more.salt).toBe(0.1);
    expect(nutritionWarnings(more).freeSugar).toBe(true);
    expect(computedNutrition(applyAdjustments(r, { 0: 0.5 }, new Set())).freeSugar).toBe(3.5);
    expect(computedNutrition(applyAdjustments(r, {}, new Set([0]))).freeSugar).toBe(1);
    expect(computedNutrition(applyAdjustments(r, { 1: 2 }, new Set()))).toMatchObject({ freeSugar: 6, freeSugarAtLeast: true });
    expect(r.ingredients[0]?.quantity).toBe(10);
  });
  it("uses known sugar contributions even if another unchanged ingredient is unknown", () => {
    const r = { title: "Sauce", servings: 2, ingredients: [
      ing({ name: "Palm sugar", quantity: 10, unit: "g", nutrition: { kcal: 38, protein: 0, carbs: 9.5, fat: 0, freeSugar: 9.5 } }),
      ing({ name: "Chilli", nutrition: { kcal: 10, protein: 0, carbs: 2, fat: 0, freeSugar: null } }),
    ], steps: [], nutrition: { kcal: 24, protein: 0, carbs: 5.75, fat: 0, salt: null, freeSugar: 5 } };
    expect(computedNutrition(applyAdjustments(r, { 0: 2 }, new Set())).freeSugar).toBe(9.75);
  });
  it("recalculates plain salt from its amount and warns on the minimum when the meal total is unknown", () => {
    const r = { title: "Soup", servings: 2, ingredients: [
      ing({ name: "Salt", quantity: 1, unit: "tsp", nutrition: { kcal: 0, protein: 0, carbs: 0, fat: 0 } }),
      ing({ name: "Broth", nutrition: { kcal: 30, protein: 2, carbs: 2, fat: 1 } }),
    ], steps: [], nutrition: { kcal: 15, protein: 1, carbs: 1, fat: 0.5, salt: null, freeSugar: null } };
    const base = computedNutrition(r);
    expect(base).toMatchObject({ salt: 3, saltAtLeast: true });
    expect(nutritionWarnings(base).salt).toBe(true);
    expect(computedNutrition(applyAdjustments(r, { 0: 2 }, new Set())).salt).toBe(6);
    expect(computedNutrition(applyAdjustments(r, {}, new Set([0]))).salt).toBeNull();
  });
  it("estimates plain sugar in spoons and cups but never guesses for substitutes or unknown amounts", () => {
    const make = (name: string, quantity: number | null, unit: string) => ({ title: "Sugar", servings: 2,
      ingredients: [ing({ name, quantity, unit })], steps: [],
      nutrition: { kcal: 20, protein: 0, carbs: 5, fat: 0, salt: null, freeSugar: null } });
    expect(computedNutrition(applyAdjustments(make("Caster sugar", 1, "tbsp"), { 0: 2 }, new Set())).freeSugar).toBe(12.5);
    expect(computedNutrition(make("White sugar", 1, "cup")).freeSugar).toBe(100);
    expect(computedNutrition(make("Sugar substitute", 10, "g")).freeSugar).toBeNull();
    expect(computedNutrition(make("Sugar-free sweetener", 10, "g")).freeSugar).toBeNull();
    expect(computedNutrition(make("Sugar", null, "to taste")).freeSugar).toBeNull();
  });
  it("merges duplicate fish sauce salt before scaling", () => {
    const sauce = ing({ name: "Fish sauce", quantity: 15, unit: "ml", nutrition: { kcal: 10, protein: 1, carbs: 1, fat: 0, salt: 3, freeSugar: 0.5 } });
    const base = { title: "Sauce", servings: 2, ingredients: [sauce, sauce], steps: [], nutrition: { kcal: 10, protein: 1, carbs: 1, fat: 0, salt: 3, freeSugar: 0.5 } };
    const selected = chooseRecipe({ ...base, healthier: base, changes: [] }, "yummy");
    expect(selected.ingredients[0]?.nutrition.salt).toBe(6);
    expect(computedNutrition(applyAdjustments(selected, { 0: 2 }, new Set())).salt).toBe(6);
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
import { verifiedProduct } from "@/lib/grocery";
describe("verified store products", () => {
  it("recommends the AH chicken breast page only for chicken breast", () => {
    expect(verifiedProduct("ah", "Chicken breast")?.url).toBe("https://www.ah.nl/producten/product/wi533083/ah-scharrel-kipfilet-2-stuks");
    expect(verifiedProduct("ah", "kipfilet")).not.toBeNull();
    expect(verifiedProduct("ah", "Chicken thigh")).toBeNull();
    expect(verifiedProduct("jumbo", "Chicken breast")).toBeNull();
  });
});
describe("dutch supermarket terms", () => {
  it("uses the common supermarket name, not a literal translation", () => {
    expect(dutchGroceryTerm("gedroogde rijstnoedels")).toBe("rijstnoedels");
    expect(dutchGroceryTerm("Dried rice noodles")).toBe("rijstnoedels");
    expect(dutchGroceryTerm("rice vermicelli")).toBe("mihoen");
  });
});

describe("optional to-taste ingredients", () => {
  const beef = () => ing({ name: "Beef tenderloin", quantity: null, unit: "", optional: true, nutrition: { kcal: 0, protein: 0, carbs: 0, fat: 0, per100g: { kcal: 150, protein: 22, carbs: 0, fat: 7 } } });
  it("estimates an optional ingredient from the grams the user adds", () => {
    const recipe = { title: "Pho", servings: 2, ingredients: [beef()], steps: [], nutrition: { kcal: 5, protein: 1, carbs: 0, fat: 0, salt: null, freeSugar: null } };
    const added = applyOptionalAmounts(recipe, { 0: 200 });
    expect(added.ingredients[0]?.quantity).toBe(200);
    expect(added.ingredients[0]?.unit).toBe("g");
    expect(added.ingredients[0]?.nutrition.kcal).toBe(300);
    expect(computedNutrition(added).kcal).toBe(150);
    // The amount multiplier then applies on top of the added grams.
    const scaled = applyAdjustments(added, { 0: 2 }, new Set());
    expect(scaled.ingredients[0]?.nutrition.kcal).toBe(600);
    // Clearing the amount returns to the to-taste state.
    expect(applyOptionalAmounts(recipe, {}).ingredients[0]?.quantity).toBeNull();
  });
  it("keeps the optional flag and per-100 g estimate when duplicate lines merge", () => {
    const base = { title: "Pho", servings: 4, ingredients: [beef(), ing({ name: "Beef tenderloin, thinly sliced", quantity: null, unit: "", optional: true, nutrition: { kcal: 0, protein: 0, carbs: 0, fat: 0 } })], steps: ["Simmer broth"], nutrition: { kcal: 10, protein: 1, carbs: 0, fat: 0, salt: null, freeSugar: null } };
    const chosen = chooseRecipe(base as ParsedRecipe, "yummy");
    expect(chosen.ingredients).toHaveLength(1);
    expect(chosen.ingredients[0]?.optional).toBe(true);
    expect(chosen.ingredients[0]?.nutrition.per100g?.kcal).toBe(150);
  });
});
