import { Injectable } from "@nestjs/common";
import {
  BALANCE,
  shipClassById,
  type BuildShipInput,
  type RepairInput,
  type SellShipInput,
} from "@azure-voyage/shared";
import { GameError } from "../../common/errors/game-error";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ShipyardService {
  constructor(private readonly prisma: PrismaService) {}

  private async getDockedPlayerFleet(userId: string, worldId: string, portId: string, fleetId: string) {
    const world = await this.prisma.gameWorld.findUnique({ where: { id: worldId } });
    if (!world || world.userId !== userId) throw new GameError("NOT_FOUND");

    const fleet = await this.prisma.fleet.findUnique({
      where: { id: fleetId },
      include: { guild: true, ships: true },
    });
    if (!fleet || fleet.worldId !== worldId || fleet.guild.kind !== "PLAYER") {
      throw new GameError("NOT_FOUND");
    }
    if (fleet.activity !== "DOCKED" || fleet.dockedPortId !== portId) {
      throw new GameError("PORT_NOT_DOCKED");
    }
    return fleet;
  }

  async build(userId: string, worldId: string, portId: string, input: BuildShipInput) {
    const fleet = await this.getDockedPlayerFleet(userId, worldId, portId, input.fleetId);
    const shipClass = shipClassById(input.shipClassId);

    return this.prisma.$transaction(async (tx) => {
      const guild = await tx.guild.findUniqueOrThrow({ where: { id: fleet.guildId } });
      const gold = Number(guild.gold);
      if (gold < shipClass.price) throw new GameError("INSUFFICIENT_GOLD");

      await tx.guild.update({ where: { id: guild.id }, data: { gold: BigInt(gold - shipClass.price) } });
      const ship = await tx.ship.create({
        data: {
          fleetId: fleet.id,
          shipClassId: input.shipClassId,
          name: input.name,
          hull: shipClass.maxHull,
          crew: Math.round(shipClass.crewMax * BALANCE.STARTING_CREW_RATIO),
          isFlagship: fleet.ships.length === 0,
        },
      });
      return { shipId: ship.id, goldRemaining: gold - shipClass.price };
    });
  }

  async repair(userId: string, worldId: string, portId: string, input: RepairInput) {
    const fleet = await this.getDockedPlayerFleet(userId, worldId, portId, input.fleetId);
    const targets = input.shipId ? fleet.ships.filter((s) => s.id === input.shipId) : fleet.ships;
    if (input.shipId && targets.length === 0) throw new GameError("NOT_FOUND");

    return this.prisma.$transaction(async (tx) => {
      const guild = await tx.guild.findUniqueOrThrow({ where: { id: fleet.guildId } });
      let gold = Number(guild.gold);
      let totalCost = 0;

      for (const ship of targets) {
        const shipClass = shipClassById(ship.shipClassId);
        const missing = shipClass.maxHull - ship.hull;
        if (missing <= 0) continue;
        const cost = missing * BALANCE.REPAIR_COST_PER_HULL;
        if (gold < totalCost + cost) break; // 資金不夠就修到哪算哪（不整批失敗，讓玩家部分修理）
        totalCost += cost;
        gold -= cost;
        await tx.ship.update({ where: { id: ship.id }, data: { hull: shipClass.maxHull, sails: 100 } });
      }
      await tx.guild.update({ where: { id: guild.id }, data: { gold: BigInt(gold) } });
      return { cost: totalCost, goldRemaining: gold };
    });
  }

  async sell(userId: string, worldId: string, portId: string, input: SellShipInput) {
    const fleet = await this.getDockedPlayerFleet(userId, worldId, portId, input.fleetId);
    if (fleet.ships.length <= 1) throw new GameError("CANNOT_SELL_LAST_SHIP");
    const ship = fleet.ships.find((s) => s.id === input.shipId);
    if (!ship) throw new GameError("NOT_FOUND");

    const shipClass = shipClassById(ship.shipClassId);
    const refund = Math.round(shipClass.price * BALANCE.SHIP_SELL_REFUND_RATIO);

    return this.prisma.$transaction(async (tx) => {
      await tx.ship.delete({ where: { id: ship.id } });
      if (ship.isFlagship) {
        const nextFlagship = fleet.ships.find((s) => s.id !== ship.id);
        if (nextFlagship) {
          await tx.ship.update({ where: { id: nextFlagship.id }, data: { isFlagship: true } });
        }
      }
      const guild = await tx.guild.findUniqueOrThrow({ where: { id: fleet.guildId } });
      const gold = Number(guild.gold) + refund;
      await tx.guild.update({ where: { id: guild.id }, data: { gold: BigInt(gold) } });
      return { refund, goldRemaining: gold };
    });
  }
}
