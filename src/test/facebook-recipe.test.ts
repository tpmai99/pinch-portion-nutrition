import { describe, expect, it } from "vitest";
import { extractFacebookRecipe, isFacebookRecipeLink } from "@/lib/facebook-recipe";

describe("Facebook full recipe extraction", () => {
  it("keeps beef toppings after a shortened broth preview and long page data", () => {
    const recipe = "Classic Vietnamese Pho\nIngredients:\nFor the broth:\n- 2 lbs beef bones\nFor the toppings:\n- 1 lb beef (eye of round, brisket, or flank), thinly sliced\n- 1 package rice noodles\nDirections:\n1. Cook broth.\n2. Top noodles with beef.\nServings: 4";
    const html = `<meta property="og:description" content="Ingredients: 2 lbs beef bones..."><script>${" ".repeat(40000)}${JSON.stringify({ message: { text: recipe } })}</script>`;
    expect(extractFacebookRecipe(html)).toBe(recipe);
    expect(extractFacebookRecipe(html)).toContain("1 lb beef (eye of round, brisket, or flank)");
  });
  it("decodes escaped lines, fractions and quotation marks", () => {
    const text = 'Ingredients:\n- 1/4 cup cilantro\nDirections:\n1. Say "ready" and serve.';
    expect(extractFacebookRecipe(`<script type="application/json">${JSON.stringify({ text })}</script>`)).toBe(text);
  });
  it("does not silently import a truncated description or login page", () => {
    expect(extractFacebookRecipe('<meta property="og:description" content="Ingredients: beef bones..."><p>Log in</p>')).toBeNull();
  });
  it("recognizes Facebook aliases without accepting unrelated domains", () => {
    expect(isFacebookRecipeLink("https://www.facebook.com/share/1FW7eSue9v/")).toBe(true);
    expect(isFacebookRecipeLink("https://m.facebook.com/example")).toBe(true);
    expect(isFacebookRecipeLink("https://fb.watch/example")).toBe(true);
    expect(isFacebookRecipeLink("https://facebook.com.example.org/example")).toBe(false);
  });
});