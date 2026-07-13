import { describe, expect, it } from "vitest";
import { openingNarrativeFor } from "./narrative";

describe("openingNarrativeFor", () => {
  it("is deterministic for a fixed seed", () => {
    expect(openingNarrativeFor(123)).toBe(openingNarrativeFor(123));
  });

  it("varies across different seeds", () => {
    const texts = new Set(Array.from({ length: 20 }, (_, i) => openingNarrativeFor(i)));
    expect(texts.size).toBeGreaterThan(1);
  });

  it("returns non-empty original text", () => {
    for (let seed = 0; seed < 10; seed++) {
      expect(openingNarrativeFor(seed).length).toBeGreaterThan(10);
    }
  });
});
