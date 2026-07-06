import { describe, expect, it } from "vitest";
import { goodwillFromTrade, investmentGain, settleInfluence, type InfluenceEntry } from "./influence";

describe("goodwillFromTrade", () => {
  it("increases with trade value", () => {
    expect(goodwillFromTrade(1000, 0)).toBeGreaterThan(goodwillFromTrade(100, 0));
  });

  it("has diminishing returns as current share grows", () => {
    const low = goodwillFromTrade(1000, 5);
    const high = goodwillFromTrade(1000, 80);
    expect(high).toBeLessThan(low);
  });

  it("never goes negative even at/above the saturation share", () => {
    expect(goodwillFromTrade(1000, 120)).toBeGreaterThanOrEqual(0);
    expect(goodwillFromTrade(1000, 500)).toBe(0);
  });

  it("is zero for zero trade value", () => {
    expect(goodwillFromTrade(0, 10)).toBe(0);
  });
});

describe("investmentGain", () => {
  it("is positive for positive investment", () => {
    expect(investmentGain(1000, 0)).toBeGreaterThan(0);
  });

  it("yields less share per gold as current share grows (diminishing returns)", () => {
    const low = investmentGain(1000, 0);
    const high = investmentGain(1000, 50);
    expect(high).toBeLessThan(low);
  });

  it("scales linearly with amount at a fixed share", () => {
    expect(investmentGain(2000, 10)).toBeCloseTo(investmentGain(1000, 10) * 2, 5);
  });
});

function entry(overrides: Partial<InfluenceEntry>): InfluenceEntry {
  return { guildId: "g1", isLocal: false, share: 0, goodwill: 0, ...overrides };
}

describe("settleInfluence", () => {
  it("never lets the total exceed 100", () => {
    const pool = [
      entry({ guildId: "local", isLocal: true, share: 60 }),
      entry({ guildId: "player", share: 30, goodwill: 500 }),
      entry({ guildId: "npc", share: 25, goodwill: 300 }),
    ];
    const result = settleInfluence(pool);
    const total = result.reduce((acc, e) => acc + e.share, 0);
    expect(total).toBeLessThanOrEqual(100.001);
  });

  it("squeezes LOCAL first before touching other guilds", () => {
    const pool = [
      entry({ guildId: "local", isLocal: true, share: 50 }),
      entry({ guildId: "player", share: 40, goodwill: 2000 }), // 大量商譽湧入，把總和推過 100
    ];
    const result = settleInfluence(pool);
    const local = result.find((e) => e.guildId === "local")!;
    const player = result.find((e) => e.guildId === "player")!;
    expect(local.share).toBeLessThan(50); // local 被壓縮
    expect(player.share).toBeGreaterThan(40); // player 吃到自己轉化的份額，沒被反過來壓縮
  });

  it("converts goodwill into share and depletes the goodwill pool", () => {
    const pool = [entry({ guildId: "local", isLocal: true, share: 20 }), entry({ guildId: "player", share: 10, goodwill: 100 })];
    const result = settleInfluence(pool);
    const player = result.find((e) => e.guildId === "player")!;
    expect(player.share).toBeGreaterThan(10);
    expect(player.goodwill).toBeLessThan(100);
    expect(player.goodwill).toBeGreaterThanOrEqual(0);
  });

  it("keeps shares non-negative even under heavy squeeze", () => {
    const pool = [
      entry({ guildId: "local", isLocal: true, share: 5 }),
      entry({ guildId: "a", share: 5, goodwill: 10000 }),
      entry({ guildId: "b", share: 5, goodwill: 10000 }),
    ];
    const result = settleInfluence(pool);
    for (const e of result) {
      expect(e.share).toBeGreaterThanOrEqual(0);
    }
  });

  it("is a no-op on an empty pool", () => {
    expect(settleInfluence([])).toEqual([]);
  });

  it("decays share slightly even with zero goodwill", () => {
    const pool = [entry({ guildId: "local", isLocal: true, share: 100 })];
    const result = settleInfluence(pool);
    expect(result[0].share).toBeLessThan(100);
  });

  it("holds the sum<=100 invariant across many randomized pools (regression: rounding overshoot)", () => {
    let seed = 1;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let trial = 0; trial < 500; trial++) {
      const guildCount = 2 + Math.floor(rand() * 4);
      const pool: InfluenceEntry[] = Array.from({ length: guildCount }, (_, i) =>
        entry({
          guildId: `g${i}`,
          isLocal: i === 0,
          share: rand() * 40,
          goodwill: rand() * 3000,
        }),
      );
      const result = settleInfluence(pool);
      const total = result.reduce((acc, e) => acc + e.share, 0);
      // 浮點加總本身有 ~1e-14 等級的表示誤差，屬正常現象，不是份額洩漏；
      // 給一個遠小於「一分」的容差，仍能抓到真正的邏輯性超額（例如先前的捨入放大問題）。
      expect(total, `trial ${trial}: ${JSON.stringify(pool)}`).toBeLessThanOrEqual(100 + 1e-9);
      for (const e of result) expect(e.share).toBeGreaterThanOrEqual(0);
    }
  });
});
