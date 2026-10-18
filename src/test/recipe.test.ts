import { describe, expect, it } from "vitest";
import { chooseRecipe, MEAL_BUDGET, nutritionWarnings, type ParsedRecipe } from "@/lib/recipe";
import { dutchGroceryTerm, jumboBeefProduct } from "@/lib/grocery";
import { STORES } from "@/lib/scale";

describe("recipe and grocery choices", () => {
  it("moves spring-onion preparation into cooking and searches for bosui in both versions", () => {
    const base = { title: "Onions", servings: 2, ingredients: [{ name: "Spring onions, cut into 3 cm pieces, whites and greens separated (or a handful of garlic chives)", dutchName: "bosui, gesneden", quantity: 3, unit: "pc", category: "produce" }], steps: ["Fry onions"], nutrition: { kcal: 30, protein: 1, carbs: 5, fat: 0, salt: null, freeSugar: null } };
    const recipe: ParsedRecipe = { ...base, healthier: base, changes: [] };
    for (const choice of ["yummy", "healthier"] as const) {
      const selected = chooseRecipe(recipe, choice);
      expect(selected.ingredients[0]?.name).toBe("Spring onions");
      expect(selected.ingredients[0]?.dutchName).toBe("bosui");
      expect(selected.steps[0]).toBe("Spring onions: cut into 3 cm pieces, whites and greens separated (or a handful of garlic chives)");
      expect(selected.steps[1]).toBe("Fry onions");
    }
    expect(recipe.ingredients[0]?.name).toContain("cut into 3 cm pieces");
    expect(dutchGroceryTerm(base.ingredients[0].name)).toBe("bosui");
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
    const base = { title: "Beef", servings: 2, ingredients: [{ name: "minced beef", dutchName: "rundergehakt", quantity: 400, unit: "g", category: "meat" }], steps: ["Fry beef"], nutrition: n };
    const r: ParsedRecipe = { ...base, healthier: { ...base, ingredients: [{ name: "extra lean minced beef", dutchName: "extra mager rundergehakt", quantity: 400, unit: "g", category: "meat" }], steps: ["Fry extra lean beef"], nutrition: { ...n, kcal: 400 } }, changes: ["Use lean beef"] };
    expect(chooseRecipe(r, "yummy").ingredients[0]?.name).toBe("minced beef");
    expect(chooseRecipe(r, "healthier").ingredients[0]?.name).toBe("extra lean minced beef");
    expect(chooseRecipe(r, "healthier").steps[0]).toBe("Fry extra lean beef");
    expect(chooseRecipe(r, "healthier").nutrition.kcal).toBe(400);
  });
});