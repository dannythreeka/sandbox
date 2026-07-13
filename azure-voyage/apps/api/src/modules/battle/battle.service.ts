import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  applyBattleAction,
  autoResolveEnemyTurns,
  BALANCE,
  deriveSeed,
  HOME_PORT_ID,
  oddrToAxial,
  portById,
  Rng,
  shipClassById,
  type BattleActionInput,
  type BattleState,
  type BattleView,
} from "@azure-voyage/shared";
import { Prisma } from "@prisma/client";
import { GameError } from "../../common/errors/game-error";
import { awardExpToFleetOfficers } from "../officer/officer-growth.util";
import { awardCaptainExp } from "../officer/captain-growth.util";
import { PrismaService } from "../../prisma/prisma.service";

export const BATTLE_UPDATE_EVENT = "battle.update";
export const BATTLE_END_EVENT = "battle.end";

@Injectable()
export class BattleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async getBattle(userId: string, worldId: string, battleId: string): Promise<BattleView> {
    const battle = await this.loadOwned(userId, worldId, battleId);
    return { id: battle.id, status: battle.status, state: battle.state as unknown as BattleState };
  }

  private async loadOwned(userId: string, worldId: string, battleId: string) {
    const world = await this.prisma.gameWorld.findUnique({ where: { id: worldId } });
    if (!world || world.userId !== userId) throw new GameError("NOT_FOUND");
    const battle = await this.prisma.battle.findUnique({ where: { id: battleId } });
    if (!battle || battle.worldId !== worldId) throw new GameError("NOT_FOUND");
    return battle;
  }

  /**
   * 套用玩家的一步戰鬥行動，接著自動解算敵方回合，直到輪回玩家或戰鬥結束
   * （docs/05 §5）。全部行動與結果 append 進 actionLog，供重放/除錯。
   */
  async applyAction(userId: string, worldId: string, battleId: string, action: BattleActionInput) {
    const world = await this.prisma.gameWorld.findUnique({ where: { id: worldId } });
    if (!world || world.userId !== userId) throw new GameError("NOT_FOUND");

    return this.prisma.$transaction(async (tx) => {
      const battle = await tx.battle.findUnique({ where: { id: battleId } });
      if (!battle || battle.worldId !== worldId) throw new GameError("NOT_FOUND");
      if (battle.status !== "ONGOING") throw new GameError("BATTLE_NOT_ACTIVE");

      let state = battle.state as unknown as BattleState;
      const actor = state.units.find((u) => u.id === action.unitId);
      if (!actor || actor.side !== "PLAYER") throw new GameError("BATTLE_ACTION_INVALID");

      const log: string[] = [...(battle.actionLog as string[])];
      let actionIndex = log.length;
      let outcome: "PLAYER_WIN" | "PLAYER_LOSE" | "FLED" | undefined;

      const rng = new Rng(deriveSeed(battle.seed, state.round, actionIndex++));
      let playerResult;
      try {
        playerResult = applyBattleAction(state, action, rng);
      } catch {
        throw new GameError("BATTLE_ACTION_INVALID");
      }
      state = playerResult.state;
      log.push(playerResult.log);
      outcome = playerResult.battleOver;

      // 自動解算後續連續的敵方回合，直到輪到玩家或戰鬥結束（docs/05 §5）
      if (!outcome) {
        const auto = autoResolveEnemyTurns(state, battle.seed, actionIndex);
        state = auto.state;
        log.push(...auto.logs);
        actionIndex = auto.nextActionIndex;
        outcome = auto.battleOver;
      }

      const status = outcome ?? "ONGOING";
      await tx.battle.update({
        where: { id: battleId },
        data: {
          state: state as unknown as Prisma.InputJsonValue,
          actionLog: log as unknown as Prisma.InputJsonValue,
          round: state.round,
          status,
        },
      });

      let ransom: number | undefined;
      if (outcome) {
        ransom = await this.resolveBattleEnd(tx, state, outcome);
      }

      this.events.emit(BATTLE_UPDATE_EVENT, {
        worldId,
        payload: { battleId, state, log: log[log.length - 1] },
      });
      if (outcome) {
        this.events.emit(BATTLE_END_EVENT, { worldId, payload: { battleId, status, ransom } });
      }

      return { state, status };
    });
  }

  /**
   * 戰後結算：持久化船隻損傷/沉沒、戰利品或贖金，並讓艦隊恢復可航行狀態（docs/05 §5）。
   * 回傳值僅 PLAYER_LOSE 有意義（扣了多少贖金），供上層推播給前端過場畫面顯示。
   */
  private async resolveBattleEnd(
    tx: Prisma.TransactionClient,
    state: BattleState,
    outcome: "PLAYER_WIN" | "PLAYER_LOSE" | "FLED",
  ): Promise<number | undefined> {
    const playerUnits = state.units.filter((u) => u.side === "PLAYER");
    if (playerUnits.length === 0) return undefined;

    const ships = await tx.ship.findMany({ where: { id: { in: playerUnits.map((u) => u.id) } } });
    const fleetId = ships[0]?.fleetId;
    if (!fleetId) return undefined;
    const fleet = await tx.fleet.findUniqueOrThrow({ where: { id: fleetId } });

    const survivingCount = playerUnits.filter((u) => !u.destroyed).length;
    for (const unit of playerUnits) {
      // 保底：不讓艦隊歸零艘船（正式的戰敗/game over 流程留給 M7 勝敗系統）
      const forceSurvive = unit.destroyed && survivingCount === 0;
      if (unit.destroyed && !forceSurvive) {
        await tx.ship.delete({ where: { id: unit.id } });
      } else {
        await tx.ship.update({
          where: { id: unit.id },
          data: { hull: forceSurvive ? 1 : Math.max(1, unit.hull) },
        });
      }
    }

    if (outcome === "PLAYER_WIN") {
      const loot = state.units
        .filter((u) => u.side === "ENEMY" && u.destroyed)
        .reduce((acc, u) => acc + Math.round(shipClassById(u.shipClassId).price * BALANCE.BATTLE_LOOT_RATIO), 0);
      if (loot > 0) {
        const guild = await tx.guild.findUniqueOrThrow({ where: { id: fleet.guildId } });
        await tx.guild.update({ where: { id: guild.id }, data: { gold: guild.gold + BigInt(loot) } });
      }
      await tx.fleet.update({ where: { id: fleetId }, data: { activity: "SAILING" } });
      await awardExpToFleetOfficers(tx, fleetId, BALANCE.OFFICER_EXP_PER_BATTLE_WIN);
      await awardCaptainExp(tx, fleet.guildId, BALANCE.CAPTAIN_EXP_PER_BATTLE_WIN);
      return undefined;
    } else if (outcome === "FLED") {
      await tx.fleet.update({ where: { id: fleetId }, data: { activity: "SAILING" } });
      return undefined;
    } else {
      const guild = await tx.guild.findUniqueOrThrow({ where: { id: fleet.guildId } });
      const ransom = Math.round(Number(guild.gold) * BALANCE.DEFEAT_RANSOM_RATIO);
      const homeAxial = oddrToAxial(portById(HOME_PORT_ID).coord);
      await tx.guild.update({
        where: { id: guild.id },
        data: { gold: guild.gold - BigInt(ransom) },
      });
      await tx.fleet.update({
        where: { id: fleetId },
        data: {
          activity: "DOCKED",
          dockedPortId: HOME_PORT_ID,
          posQ: homeAxial.q,
          posR: homeAxial.r,
          route: Prisma.DbNull,
        },
      });
      return ransom;
    }
  }
}
