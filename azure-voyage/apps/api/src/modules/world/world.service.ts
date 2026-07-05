import { Injectable } from "@nestjs/common";
import type { GameWorld } from "@prisma/client";
import {
  CONTENT_VERSION,
  MAX_ACTIVE_WORLDS_PER_USER,
  type CreateWorldInput,
  type WorldSnapshot,
  type WorldSummary,
} from "@azure-voyage/shared";
import { randomInt } from "node:crypto";
import { GameError } from "../../common/errors/game-error";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class WorldService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateWorldInput): Promise<WorldSummary> {
    const activeCount = await this.prisma.gameWorld.count({
      where: { userId, status: "ACTIVE" },
    });
    if (activeCount >= MAX_ACTIVE_WORLDS_PER_USER) {
      throw new GameError("WORLD_LIMIT_REACHED");
    }
    // M0：只建世界殼。M1 起在同一 transaction 內生成港口/商會/艦隊（docs/03 §5）。
    const world = await this.prisma.gameWorld.create({
      data: {
        userId,
        name: input.name,
        difficulty: input.difficulty,
        contentVersion: CONTENT_VERSION,
        seed: randomInt(0, 2 ** 31),
      },
    });
    return this.toSummary(world);
  }

  async list(userId: string): Promise<WorldSummary[]> {
    const worlds = await this.prisma.gameWorld.findMany({
      where: { userId, status: { not: "ABANDONED" } },
      orderBy: { updatedAt: "desc" },
    });
    return worlds.map((w) => this.toSummary(w));
  }

  async getSnapshot(userId: string, worldId: string): Promise<WorldSnapshot> {
    const world = await this.getOwned(userId, worldId);
    return { world: { ...this.toSummary(world), seed: world.seed } };
  }

  async abandon(userId: string, worldId: string): Promise<WorldSummary> {
    await this.getOwned(userId, worldId);
    const world = await this.prisma.gameWorld.update({
      where: { id: worldId },
      data: { status: "ABANDONED" },
    });
    return this.toSummary(world);
  }

  /** 所有權檢查：非本人的世界一律回 NOT_FOUND（不洩漏存在性）。 */
  async getOwned(userId: string, worldId: string): Promise<GameWorld> {
    const world = await this.prisma.gameWorld.findUnique({ where: { id: worldId } });
    if (!world || world.userId !== userId) {
      throw new GameError("NOT_FOUND");
    }
    return world;
  }

  private toSummary(world: GameWorld): WorldSummary {
    return {
      id: world.id,
      name: world.name,
      difficulty: world.difficulty as WorldSummary["difficulty"],
      status: world.status,
      currentTick: world.currentTick,
      contentVersion: world.contentVersion,
      createdAt: world.createdAt.toISOString(),
      updatedAt: world.updatedAt.toISOString(),
    };
  }
}
