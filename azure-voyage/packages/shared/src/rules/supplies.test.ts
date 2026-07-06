import { describe, expect, it } from "vitest";
import { consumeSupplies } from "./supplies";

describe("consumeSupplies", () => {
  it("consumes food/water proportional to crew and raises morale when supplied", () => {
    const result = consumeSupplies({ food: 30, water: 30, morale: 70 }, 10);
    expect(result.food).toBe(20);
    expect(result.water).toBe(20);
    expect(result.starved).toBe(false);
    expect(result.morale).toBe(71);
  });

  it("clamps at zero and marks starved, dropping morale", () => {
    const result = consumeSupplies({ food: 5, water: 30, morale: 50 }, 10);
    expect(result.food).toBe(0);
    expect(result.starved).toBe(true);
    expect(result.morale).toBe(45);
  });

  it("caps morale at 100", () => {
    const result = consumeSupplies({ food: 100, water: 100, morale: 99 }, 1);
    expect(result.morale).toBe(100);
  });

  it("floors morale at 0", () => {
    const result = consumeSupplies({ food: 0, water: 0, morale: 2 }, 5);
    expect(result.morale).toBe(0);
  });
});
