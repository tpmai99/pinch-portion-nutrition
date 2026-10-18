import { describe, expect, it } from "vitest";
import { cookingSections } from "@/lib/cooking";

describe("cooking overview", () => {
  it("separates leading preparation from cooking while preserving all instructions", () => {
    const steps = ["Onion: dice finely", "Mix the sauce. Whisk until smooth.", "Heat the pan.", "Fry the onions."];
    const sections = cookingSections({ steps });
    expect(sections[0]?.tasks.map(t => t.instruction)).toEqual(steps.slice(0, 2));
    expect(sections[1]?.tasks.map(t => t.instruction)).toEqual(steps.slice(2));
    expect(sections.flatMap(s => s.tasks.map(t => t.instruction))).toEqual(steps);
    expect(sections[0]?.tasks[1]?.summary).toBe("Mix the sauce.");
  });
  it("does not move mixed steps or later cutting ahead of cooking", () => {
    const steps = ["Cut the onion and fry it in oil.", "Slice the herbs just before serving.", "Serve hot."];
    const sections = cookingSections({ steps });
    expect(sections[0]?.tasks).toEqual([]);
    expect(sections[1]?.tasks.map(t => t.instruction)).toEqual(steps);
  });
  it("keeps explicit Cooking section order even when its first task is mixing", () => {
    const sections = cookingSections({ steps: ["Preparation", "Wash the onions.", "Cooking:", "Mix the sauce.", "Simmer for 5 minutes."] });
    expect(sections[0]?.tasks.map(t => t.id)).toEqual([1]);
    expect(sections[1]?.tasks.map(t => t.id)).toEqual([3, 4]);
  });
  it("handles empty and preparation-only recipes without inventing steps", () => {
    expect(cookingSections({ steps: [""] }).flatMap(s => s.tasks)).toEqual([]);
    const sections = cookingSections({ steps: ["Slice the tomatoes.", "Mix the dressing."] });
    expect(sections[0]?.tasks).toHaveLength(2);
    expect(sections[1]?.tasks).toEqual([]);
  });
});