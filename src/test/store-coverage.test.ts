import { describe, expect, it } from "vitest";
import { storeCoverage } from "@/lib/store-coverage";

describe("whole shopping-list coverage", () => {
  const items = [
    { name: "Chicken breast", dutchName: "kipfilet" },
    { name: "Rice noodles", dutchName: "rijstnoedels" },
    { name: "Fish sauce", dutchName: "vissaus" },
  ];
  it("does not treat one matched product as a complete three-item basket", () => {
    const coverage = storeCoverage("ah", items);
    expect(coverage.total).toBe(3);
    expect(coverage.matched).toBe(1);
    expect(coverage.unmatched).toBe(2);
    expect(coverage.completeStockConfirmed).toBe(false);
    expect(coverage.products.map((item) => item.name)).toEqual(["Chicken breast", "Rice noodles", "Fish sauce"]);
  });
  it("does not infer stock from a saved product page", () => {
    const coverage = storeCoverage("ah", items.slice(0, 1));
    expect(coverage.matched).toBe(1);
    expect(coverage.stockConfirmed).toBe(0);
    expect(coverage.products[0]?.stock).toBe("unverified");
    expect(coverage.completeStockConfirmed).toBe(false);
  });
  it("keeps unsupported products unverified rather than reporting unavailable", () => {
    const coverage = storeCoverage("lidl", items);
    expect(coverage.matched).toBe(0);
    expect(coverage.unmatched).toBe(3);
    expect(coverage.products.every((item) => item.stock === "unverified")).toBe(true);
  });
  it("does not use a translated search to recommend an incompatible ingredient", () => {
    const coverage = storeCoverage("ah", [{ name: "Chicken thigh", dutchName: "kipfilet" }]);
    expect(coverage.products[0]?.product).toBeNull();
  });
  it("does not imply a saved product satisfies a specified fat percentage", () => {
    expect(storeCoverage("jumbo", [{ name: "Minced beef 5% fat", dutchName: "rundergehakt" }]).matched).toBe(0);
  });
});