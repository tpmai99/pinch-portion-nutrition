import { describe, expect, it } from "vitest";
import { convertAmount, gramsPerCup } from "@/lib/units";

describe("unit conversion", () => {
  it("keeps count-based amounts unchanged in both modes", () => {
    expect(convertAmount("garlic", 2, "cloves", 2, 4, "metric")).toBe("4 cloves");
    expect(convertAmount("garlic", 2, "cloves", 2, 4, "cups")).toBe("4 cloves");
    expect(convertAmount("salt", null, "", 2, 4, "cups")).toBe("to taste");
  });

  it("metric mode shows grams for mass and ml for volume", () => {
    expect(convertAmount("minced beef", 400, "g", 2, 2, "metric")).toBe("400 g");
    expect(convertAmount("minced beef", 0.5, "kg", 2, 2, "metric")).toBe("500 g");
    expect(convertAmount("soy sauce", 2, "tbsp", 2, 2, "metric")).toBe("30 ml");
    expect(convertAmount("milk", 1, "cup", 2, 2, "metric")).toBe("240 ml");
  });

  it("cups mode converts volume amounts to cups", () => {
    expect(convertAmount("milk", 480, "ml", 2, 2, "cups")).toBe("2 cups");
    expect(convertAmount("milk", 1, "cup", 2, 2, "cups")).toBe("1 cup");
    expect(convertAmount("stock", 4, "tbsp", 2, 2, "cups")).toBe("¼ cup");
  });

  it("cups mode uses density for known ingredients", () => {
    // flour: 120 g per cup -> 240 g = 2 cups
    expect(convertAmount("all-purpose flour", 240, "g", 2, 2, "cups")).toBe("2 cups");
    // butter: 227 g per cup -> 113.5 g = 0.5 cup
    expect(convertAmount("butter", 113.5, "g", 2, 2, "cups")).toBe("½ cup");
  });

  it("cups mode keeps grams when the density is unknown", () => {
    // Minced beef is not measured in cups — keep grams instead of guessing.
    expect(convertAmount("minced beef", 400, "g", 2, 2, "cups")).toBe("400 g");
    expect(gramsPerCup("minced beef")).toBeNull();
  });

  it("metric mode shows grams, not ml, for solid ingredients given in volume", () => {
    // Beansprouts are a solid — 1 cup ≈ 65 g, never "240 ml".
    expect(gramsPerCup("beansprouts")).toBe(65);
    expect(gramsPerCup("bean sprouts")).toBe(65);
    expect(convertAmount("beansprouts", 1, "cup", 2, 2, "metric")).toBe("65 g");
    // Tofu is a solid — 120 ml ≈ 125 g, never "120 ml".
    expect(gramsPerCup("firm tofu")).toBe(250);
    expect(convertAmount("firm tofu", 120, "ml", 2, 2, "metric")).toBe("125 g");
    expect(convertAmount("silken tofu", 0.5, "cup", 2, 2, "cups")).toBe("½ cup");
    // Liquids stay in ml.
    expect(convertAmount("milk", 1, "cup", 2, 2, "metric")).toBe("240 ml");
    expect(convertAmount("soy sauce", 2, "tbsp", 2, 2, "metric")).toBe("30 ml");
  });

  it("scales quantities with portions before converting", () => {
    // recipe for 2 portions, now 4: 100 g flour -> 200 g -> 200/120 ≈ 1.67 cups
    expect(convertAmount("flour", 100, "g", 2, 4, "cups")).toBe("1⅔ cups");
  });

  it("shows tablespoons for tiny cup amounts", () => {
    // 30 g butter ≈ 0.13 cup ≈ 2 tbsp
    expect(convertAmount("butter", 30, "g", 2, 2, "cups")).toBe("2 tbsp");
  });
});
