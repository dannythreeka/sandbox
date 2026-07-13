import { describe, expect, it } from "vitest";
import { RegisterInputSchema } from "./auth";
import { CreateWorldInputSchema, WorldSnapshotSchema } from "./world";
import { ClientJoinSchema, ClientResyncSchema } from "./ws";

describe("auth schemas", () => {
  it("accepts a valid registration", () => {
    const parsed = RegisterInputSchema.parse({
      email: "captain@example.com",
      password: "s3cret-pass",
      displayName: "蒼瀾提督",
    });
    expect(parsed.email).toBe("captain@example.com");
  });

  it("rejects short passwords and bad emails", () => {
    expect(
      RegisterInputSchema.safeParse({
        email: "not-an-email",
        password: "short",
        displayName: "x",
      }).success,
    ).toBe(false);
  });
});

describe("world schemas", () => {
  it("accepts valid world creation input", () => {
    expect(
      CreateWorldInputSchema.safeParse({ name: "初航", difficulty: "NORMAL" }).success,
    ).toBe(true);
  });

  it("rejects unknown difficulty", () => {
    expect(
      CreateWorldInputSchema.safeParse({ name: "初航", difficulty: "NIGHTMARE" }).success,
    ).toBe(false);
  });

  it("validates the full snapshot shape", () => {
    const snapshot = {
      world: {
        id: "w1",
        name: "初航",
        difficulty: "EASY",
        status: "ACTIVE",
        currentTick: 0,
        contentVersion: "1.0.0",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        seed: 12345,
      },
      playerGuild: { id: "g1", name: "提督商會", gold: 10000, fame: 0 },
      fleets: [
        {
          id: "f1",
          name: "第一艦隊",
          activity: "DOCKED",
          pos: { q: 30, r: 30 },
          dockedPortId: "port.amber_gulf.aurelia",
          food: 30,
          water: 30,
          morale: 70,
          ships: [
            {
              id: "s1",
              shipClassId: "ship.lugger",
              name: "海燕號",
              hull: 55,
              sails: 100,
              crew: 8,
              isFlagship: true,
              cargo: [],
            },
          ],
          officers: [
            {
              id: "o1",
              name: "賽菈・凡德",
              portrait: "portrait.sera",
              role: null,
              stats: { lead: 45, nav: 70, combat: 30, trade: 40, lore: 60 },
              skills: ["skill.cartography"],
              loyalty: 60,
              salary: 120,
              exp: 0,
            },
          ],
        },
      ],
      knownPorts: [
        {
          portId: "port.amber_gulf.aurelia",
          name: "奧雷利亞",
          regionId: "region.amber_gulf",
          coord: { col: 44, row: 30 },
          size: 3,
          visited: true,
        },
      ],
      npcGuilds: [{ id: "g2", name: "霜港同盟", color: "#7fb8d4", fame: 0 }],
      victoryProgress: { regionsDominated: 0, relicsFound: 0, totalAssets: 10000 },
    };
    expect(WorldSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });
});

describe("ws schemas", () => {
  it("validates join/resync payloads", () => {
    expect(ClientJoinSchema.safeParse({ worldId: "w1" }).success).toBe(true);
    expect(ClientResyncSchema.safeParse({ worldId: "w1", lastTick: -1 }).success).toBe(false);
  });
});
