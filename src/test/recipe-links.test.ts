import { describe, expect, it } from "vitest";
import { hasRecipeCaption, isTikTokRecipeLink } from "@/lib/recipe-links";

describe("TikTok recipe link access", () => {
  it("recognizes the user's shared tt.site link and TikTok aliases", () => {
    expect(isTikTokRecipeLink("https://www.tt.site/t/ZGdCCpRxB/")).toBe(true);
    expect(isTikTokRecipeLink("https://vm.tiktok.com/example/")).toBe(true);
    expect(isTikTokRecipeLink("https://www.tiktok.com/@chef/video/123")).toBe(true);
    expect(isTikTokRecipeLink("https://not-tiktok.com/")).toBe(false);
    expect(isTikTokRecipeLink("https://tiktok.com.example.org/")).toBe(false);
  });
  it("does not treat a post title as the video's recipe", () => {
    expect(hasRecipeCaption("Extra garlic pls")).toBe(false);
    expect(hasRecipeCaption("Watch this amazing dinner video! Like and subscribe for more cooking inspiration every day.")).toBe(false);
    expect(hasRecipeCaption("Serves 3. Ingredients: 300 g chicken, 150 g noodles, 15 ml oil. Slice chicken, boil noodles, fry the chicken and combine.")).toBe(true);
  });
});