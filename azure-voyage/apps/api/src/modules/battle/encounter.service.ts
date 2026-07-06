import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  axialToOddr,
  autoResolveEnemyTurns,
  BALANCE,
  deriveSeed,
  initBattleState,
  regionForCoord,
  Rng,
  shipClassById,
  unitFromShip,
  type BattleUnit,
} from "@azure-voyage/shared";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { ServerBattleStartPayload } from "@azure-voyage/shared";

export const WORLD_BATTLE_START_EVENT = "world.battle-start";

/** 遭遇機率隨危險度浮動的簡易海賊船池（M5；風味與難度分級留給 M6/M8 內容擴充）。 */
const PIRATE_SHIP_POOL = ["ship.sloop", "ship.schooner"] as const;

@Injectable()
export class EncounterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** 每 tick 為仍在航行的艦隊擲骰是否遭遇海賊（docs/01 §4.1、docs/05 §3）。 */
  async rollEncounters(worldId: string, tick: number): Promise<void> {
    const world = await this.prisma.gameWorld.findUniqueOrThrow({ where: { id: worldId } });
    const sailingFleets = await this.prisma.fleet.findMany({
      where: { worldId, activity: "SAILING" },
      include: { ships: true },
    });

    for (const fleet of sailingFleets) {
      const rng = new Rng(deriveSeed(world.seed, tick, hashId(fleet.id)));
      const region = regionForCoord(axialToOddr({ q: fleet.posQ, r: fleet.posR }));
      const chance = region.danger * BALANCE.ENCOUNTER_CHANCE_PER_DANGER;
      if (!rng.chance(chance)) continue;

      const playerUnits: BattleUnit[] = fleet.ships.map((ship, i) =>
        unitFromShip(
          ship.id,
          "PLAYER",
          ship.name,
          shipClassById(ship.shipClassId),
          { q: -2, r: i - Math.floor(fleet.ships.length / 2) },
          ship.hull,
          ship.crew,
        ),
      );
      const enemyCount = region.danger > 0.4 ? 2 : 1;
      const enemyUnits: BattleUnit[] = Array.from({ length: enemyCount }, (_, i) => {
        const classId = rng.pick(PIRATE_SHIP_POOL);
        const shipClass = shipClassById(classId);
        return unitFromShip(
          `enemy-${i}`,
          "ENEMY",
          `海賊船・${shipClass.name}`,
          shipClass,
          { q: 3, r: i - Math.floor(enemyCount / 2) },
          shipClass.maxHull,
          Math.round(shipClass.crewMax * 0.7),
        );
      });

      const battleSeed = deriveSeed(world.seed, tick, hashId(fleet.id), 0xba77);
      const initialState = initBattleState([...playerUnits, ...enemyUnits]);

      // 敵艦可能比玩家船快，回合順序初始化後敵方可能排在最前面；
      // 開戰前先自動解算這些「連續的領先敵方回合」，玩家看到的一定是輪到自己行動的畫面。
      const auto = autoResolveEnemyTurns(initialState, battleSeed, 0);
      if (auto.battleOver) {
        // 理論上極罕見（1-2 艘輕型海賊船很難在玩家出手前就解決整支艦隊）：
        // 視為這次埋伏不成立，直接放棄本次遭遇，艦隊維持航行不受影響。
        continue;
      }

      const battle = await this.prisma.battle.create({
        data: {
          worldId,
          seed: battleSeed,
          startedTick: tick,
          state: auto.state as unknown as Prisma.InputJsonValue,
          actionLog: auto.logs as unknown as Prisma.InputJsonValue,
        },
      });
      await this.prisma.fleet.update({ where: { id: fleet.id }, data: { activity: "IN_BATTLE" } });

      const payload: ServerBattleStartPayload = {
        battleId: battle.id,
        battle: { id: battle.id, status: "ONGOING", state: auto.state },
      };
      this.events.emit(WORLD_BATTLE_START_EVENT, { worldId, payload });
    }
  }
}

/** 字串 id → 穩定整數 hash，供 deriveSeed 使用（cuid 本身非數字）。 */
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}
