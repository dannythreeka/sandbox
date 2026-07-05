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

  it("validates the M0 snapshot shape", () => {
    const snapshot = {
      world: {
        id: "w1",
        name: "初航",
        difficulty: "EASY",
        status: "ACTIVE",
        currentTick: 0,
        contentVersion: "0.0.0-m0",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        seed: 12345,
      },
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
