import { Injectable } from "@nestjs/common";
import type { GameWorld, Prisma } from "@prisma/client";
import {
  BALANCE,
  buildNewWorldPlan,
  CONTENT_VERSION,
  PORT_NOTABLE_TEMPLATES,
  PORTS,
  regionsDominatedBy,
  RELIC_DISCOVERY_IDS,
  resolvePortId,
  shipClassById,
  WorldSnapshotSchema,
  type CreateWorldInput,
  type WorldPlan,
  type WorldSnapshot,
  type WorldSummary,
} from "@azure-voyage/shared";
import { randomInt } from "node:crypto";
import { GameError } from "../../common/errors/game-error";
import { PrismaService } from "../../prisma/prisma.service";

const LOCAL_GUILD_KEY = "LOCAL";
const LOCAL_GUILD_NAME = "在地勢力";
const LOCAL_GUILD_COLOR = "#8a8f98";
const PLAYER_FLEET_NAME = "第一艦隊";

@Injectable()
export class WorldService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateWorldInput): Promise<WorldSummary> {
    const activeCount = await this.prisma.gameWorld.count({
      where: { userId, status: "ACTIVE" },
    });
    if (activeCount >= BALANCE.MAX_ACTIVE_WORLDS_PER_USER) {
      throw new GameError("WORLD_LIMIT_REACHED");
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const seed = randomInt(0, 2 ** 31);
    const plan = buildNewWorldPlan(seed, input.difficulty);

    const world = await this.prisma.$transaction(
      (tx) =>
        this.persistNewWorld(tx, {
          userId,
          name: input.name,
          difficulty: input.difficulty,
          seed,
          playerGuildName: `${user.displayName}商會`,
          plan,
        }),
      { timeout: 30000 },
    );
    return this.toSummary(world);
  }

  /** New Game 持久化（docs/03 §5）。單一 transaction，批次寫入。 */
  private async persistNewWorld(
    tx: Prisma.TransactionClient,
    args: {
      userId: string;
      name: string;
      difficulty: string;
      seed: number;
      playerGuildName: string;
      plan: WorldPlan;
    },
  ): Promise<GameWorld> {
    const { plan } = args;

    // 1. 世界
    const world = await tx.gameWorld.create({
      data: {
        userId: args.userId,
        name: args.name,
        difficulty: args.difficulty,
        contentVersion: CONTENT_VERSION,
        seed: args.seed,
      },
    });

    // 2. 商會：玩家 + 在地 + 5 NPC（占位人設，M5 由 PERSONA agent 補全）
    const playerGuild = await tx.guild.create({
      data: {
        worldId: world.id,
        kind: "PLAYER",
        name: args.playerGuildName,
        color: "#d9a441",
        gold: BigInt(plan.playerGold),
      },
    });
    const localGuild = await tx.guild.create({
      data: {
        worldId: world.id,
        kind: "LOCAL",
        name: LOCAL_GUILD_NAME,
        color: LOCAL_GUILD_COLOR,
      },
    });
    const guildIdByKey = new Map<string, string>([[LOCAL_GUILD_KEY, localGuild.id]]);
    for (const npc of plan.npcGuilds) {
      const guild = await tx.guild.create({
        data: {
          worldId: world.id,
          kind: "NPC",
          name: npc.name,
          color: npc.color,
          gold: BigInt(npc.gold),
          aiPersona: npc.persona,
        },
      });
      guildIdByKey.set(npc.key, guild.id);
    }

    // 3. 港口狀態（批次），再回查 id 對應
    await tx.portState.createMany({
      data: plan.ports.map((p) => ({
        worldId: world.id,
        portId: p.portId,
        prosperity: p.prosperity,
      })),
    });
    const portStates = await tx.portState.findMany({
      where: { worldId: world.id },
      select: { id: true, portId: true },
    });
    const portStateIdByPortId = new Map(portStates.map((p) => [p.portId, p.id]));

    // 3.5 港口人物（M25，docs/17）：每港一位原創人物，占位人設，PersonaService 補全
    await tx.portNotable.createMany({
      data: PORT_NOTABLE_TEMPLATES.map((t) => ({
        worldId: world.id,
        portId: t.portId,
        name: t.name,
        portrait: t.portrait,
        archetype: t.archetype,
      })),
    });

    // 4. 市場與影響力（批次）
    await tx.marketStock.createMany({
      data: plan.ports.flatMap((p) =>
        p.market.map((m) => ({
          portStateId: portStateIdByPortId.get(p.portId)!,
          commodityId: m.commodityId,
          stock: m.stock,
          baseStock: m.baseStock,
          price: m.price,
        })),
      ),
    });
    await tx.portInfluence.createMany({
      data: plan.ports.flatMap((p) =>
        p.influences.map((inf) => ({
          portStateId: portStateIdByPortId.get(p.portId)!,
          guildId: guildIdByKey.get(inf.guildKey)!,
          share: inf.share,
        })),
      ),
    });

    // 5. 起始艦隊 + 旗艦 + 2 名航海士
    const fleet = await tx.fleet.create({
      data: {
        worldId: world.id,
        guildId: playerGuild.id,
        name: PLAYER_FLEET_NAME,
        activity: "DOCKED",
        posQ: plan.fleetPos.q,
        posR: plan.fleetPos.r,
        dockedPortId: plan.homePortId,
        food: plan.startingFood,
        water: plan.startingWater,
        morale: plan.startingMorale,
      },
    });
    const starterClass = shipClassById(plan.starterShipClassId);
    await tx.ship.create({
      data: {
        fleetId: fleet.id,
        shipClassId: plan.starterShipClassId,
        name: plan.starterShipName,
        hull: starterClass.maxHull,
        crew: plan.starterCrew,
        isFlagship: true,
      },
    });
    for (const officer of plan.officers) {
      await tx.officer.create({
        data: {
          worldId: world.id,
          fleetId: fleet.id,
          name: officer.name,
          portrait: officer.portrait,
          stats: { ...officer.stats },
          skills: officer.skills,
          salary: officer.salary,
        },
      });
    }
    // 6. 待業航海士分派到各港酒館（M4）
    for (const officer of plan.tavernOfficers) {
      await tx.officer.create({
        data: {
          worldId: world.id,
          fleetId: null,
          name: officer.name,
          portrait: officer.portrait,
          stats: { ...officer.stats },
          skills: officer.skills,
          salary: officer.salary,
          locationPortId: officer.locationPortId,
        },
      });
    }
    return world;
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

    const [guilds, fleets, influenceRows, relicsFound] = await Promise.all([
      this.prisma.guild.findMany({ where: { worldId } }),
      this.prisma.fleet.findMany({
        where: { worldId, guild: { kind: "PLAYER" } },
        include: {
          ships: { include: { cargo: true }, orderBy: { isFlagship: "desc" } },
          officers: true,
        },
      }),
      this.prisma.portInfluence.findMany({
        where: { portState: { worldId } },
        include: { portState: true },
      }),
      this.prisma.discoveryRecord.count({
        where: { worldId, registered: true, discoveryId: { in: [...RELIC_DISCOVERY_IDS] } },
      }),
    ]);

    // M21 縮編後既有存檔可能還有艦隊/待業航海士停在已刪除的港口 id；讀取時順便自我修復
    // （改停到最近的存續港口），避免之後設定航線等操作對著不存在的港口 id 崩潰。
    const staleFleets = fleets.filter(
      (f) => f.dockedPortId !== null && resolvePortId(f.dockedPortId) !== f.dockedPortId,
    );
    if (staleFleets.length > 0) {
      await this.prisma.$transaction(
        staleFleets.map((f) =>
          this.prisma.fleet.update({
            where: { id: f.id },
            data: { dockedPortId: resolvePortId(f.dockedPortId!) },
          }),
        ),
      );
      for (const f of staleFleets) f.dockedPortId = resolvePortId(f.dockedPortId!);
    }
    const staleTavernOfficers = (
      await this.prisma.officer.findMany({
        where: { worldId, fleetId: null, locationPortId: { not: null } },
      })
    ).filter((o) => o.locationPortId !== null && resolvePortId(o.locationPortId) !== o.locationPortId);
    if (staleTavernOfficers.length > 0) {
      await this.prisma.$transaction(
        staleTavernOfficers.map((o) =>
          this.prisma.officer.update({
            where: { id: o.id },
            data: { locationPortId: resolvePortId(o.locationPortId!) },
          }),
        ),
      );
    }

    // bug 修復：重新連線時要能知道「我的艦隊是否還在一場進行中的海戰裡」，否則前端
    // 沒收到當初那次 SERVER_BATTLE_START 推播的話，會永遠卡在 IN_BATTLE 卻沒有戰鬥畫面。
    const ongoingBattles = await this.prisma.battle.findMany({
      where: { worldId, status: "ONGOING", fleetId: { in: fleets.map((f) => f.id) } },
      select: { id: true, fleetId: true },
    });
    const activeBattleIdByFleetId = new Map(ongoingBattles.map((b) => [b.fleetId!, b.id]));

    const playerGuild = guilds.find((g) => g.kind === "PLAYER");
    if (!playerGuild) throw new GameError("INTERNAL", "world has no player guild");

    const dockedPortIds = new Set(
      fleets.map((f) => f.dockedPortId).filter((p): p is string => p !== null),
    );
    const shipValue = fleets
      .flatMap((f) => f.ships)
      .reduce((acc, s) => acc + shipClassById(s.shipClassId).price, 0);
    const regionsDominated = regionsDominatedBy(
      playerGuild.id,
      influenceRows.map((r) => ({ portId: r.portState.portId, guildId: r.guildId, share: Number(r.share) })),
    );

    const snapshot: WorldSnapshot = {
      world: { ...this.toSummary(world), seed: world.seed },
      playerGuild: {
        id: playerGuild.id,
        name: playerGuild.name,
        gold: Number(playerGuild.gold),
        fame: playerGuild.fame,
      },
      fleets: fleets.map((f) => ({
        id: f.id,
        name: f.name,
        activity: f.activity,
        pos: { q: f.posQ, r: f.posR },
        dockedPortId: f.dockedPortId,
        food: f.food,
        water: f.water,
        morale: f.morale,
        activeBattleId: activeBattleIdByFleetId.get(f.id) ?? null,
        ships: f.ships.map((s) => ({
          id: s.id,
          shipClassId: s.shipClassId,
          name: s.name,
          hull: s.hull,
          sails: s.sails,
          crew: s.crew,
          isFlagship: s.isFlagship,
          cargo: s.cargo.map((c) => ({
            commodityId: c.commodityId,
            quantity: c.quantity,
            avgBuyPrice: c.avgBuyPrice,
          })),
        })),
        officers: f.officers.map((o) => ({
          id: o.id,
          name: o.name,
          portrait: o.portrait,
          role: o.role,
          stats: o.stats as { lead: number; nav: number; combat: number; trade: number; lore: number },
          skills: o.skills,
          loyalty: o.loyalty,
          salary: o.salary,
          exp: o.exp,
          persona: (o.persona as WorldSnapshot["fleets"][number]["officers"][number]["persona"]) ?? undefined,
        })),
      })),
      // M1：全港名稱/座標可見；visited 僅停靠中港口（迷霧細化在 M2 航行時）
      knownPorts: PORTS.map((p) => ({
        portId: p.id,
        name: p.name,
        regionId: p.regionId,
        coord: p.coord,
        size: p.size,
        visited: dockedPortIds.has(p.id),
      })),
      npcGuilds: guilds
        .filter((g) => g.kind === "NPC")
        .map((g) => {
          const persona = g.aiPersona as { placeholder?: boolean; description?: string; greeting?: string } | null;
          return {
            id: g.id,
            name: g.name,
            color: g.color,
            fame: g.fame,
            persona:
              persona && !persona.placeholder && persona.description && persona.greeting
                ? { description: persona.description, greeting: persona.greeting }
                : undefined,
          };
        }),
      victoryProgress: {
        regionsDominated,
        relicsFound,
        totalAssets: Number(playerGuild.gold) + shipValue,
      },
    };
    // 驗收要求：快照必須通過 shared zod schema（docs/09 M1）
    return WorldSnapshotSchema.parse(snapshot);
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
