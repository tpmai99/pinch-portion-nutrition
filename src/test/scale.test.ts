import { describe, it, expect } from "vitest";
import { scaleQuantity, formatQuantity, estimateCart, STORES } from "@/lib/scale";

describe("portion scaling", () => {
  it("scales 200g from 4 to 2 portions to 100g", () => {
    expect(scaleQuantity(200, 4, 2)).toBe(100);
  });
  it("keeps null quantities (to taste)", () => {
    expect(scaleQuantity(null, 4, 8)).toBeNull();
  });
  it("formats 0.5 as ½", () => {
    expect(formatQuantity(0.5)).toBe("½");
  });
  it("cheap stores are cheaper than quality stores for the same cart", () => {
    const cats = ["produce", "meat"];
    const lidl = STORES.find((s) => s.id === "lidl")!;
    const ah = STORES.find((s) => s.id === "ah")!;
    expect(estimateCart(cats, lidl)).toBeLessThan(estimateCart(cats, ah));
  });
});
