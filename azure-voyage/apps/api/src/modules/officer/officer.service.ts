import { Injectable } from "@nestjs/common";
import { BALANCE, type AssignRoleInput, type TavernOfficerView } from "@azure-voyage/shared";
import { GameError } from "../../common/errors/game-error";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class OfficerService {
  constructor(private readonly prisma: PrismaService) {}

  async getTavern(userId: string, worldId: string, portId: string): Promise<TavernOfficerView[]> {
    const world = await this.prisma.gameWorld.findUnique({ where: { id: worldId } });
    if (!world || world.userId !== userId) throw new GameError("NOT_FOUND");

    const officers = await this.prisma.officer.findMany({
      where: { worldId, locationPortId: portId, fleetId: null },
    });
    return officers.map((o) => ({
      id: o.id,
      name: o.name,
      portrait: o.portrait,
      stats: o.stats as TavernOfficerView["stats"],
      skills: o.skills,
      salary: o.salary,
      persona: (o.persona as TavernOfficerView["persona"]) ?? undefined,
    }));
  }

  async recruit(userId: string, worldId: string, portId: string, fleetId: string, officerId: string) {
    const world = await this.prisma.gameWorld.findUnique({ where: { id: worldId } });
    if (!world || world.userId !== userId) throw new GameError("NOT_FOUND");

    return this.prisma.$transaction(async (tx) => {
      const fleet = await tx.fleet.findUnique({ where: { id: fleetId }, include: { guild: true } });
      if (!fleet || fleet.worldId !== worldId || fleet.guild.kind !== "PLAYER") {
        throw new GameError("NOT_FOUND");
      }
      if (fleet.activity !== "DOCKED" || fleet.dockedPortId !== portId) {
        throw new GameError("PORT_NOT_DOCKED");
      }
      const officer = await tx.officer.findUnique({ where: { id: officerId } });
      if (!officer || officer.worldId !== worldId || officer.fleetId !== null || officer.locationPortId !== portId) {
        throw new GameError("OFFICER_UNAVAILABLE");
      }
      await tx.officer.update({
        where: { id: officerId },
        data: { fleetId, locationPortId: null },
      });
      return { recruited: true };
    });
  }

  async assignRole(userId: string, worldId: string, fleetId: string, officerId: string, input: AssignRoleInput) {
    const world = await this.prisma.gameWorld.findUnique({ where: { id: worldId } });
    if (!world || world.userId !== userId) throw new GameError("NOT_FOUND");

    return this.prisma.$transaction(async (tx) => {
      const officer = await tx.officer.findUnique({ where: { id: officerId } });
      if (!officer || officer.worldId !== worldId || officer.fleetId !== fleetId) {
        throw new GameError("NOT_FOUND");
      }
      if (input.role !== null) {
        // 一個職位同時只能一人擔任：頂替原任者（docs/01 §4.5）
        await tx.officer.updateMany({
          where: { worldId, fleetId, role: input.role, NOT: { id: officerId } },
          data: { role: null },
        });
      }
      await tx.officer.update({ where: { id: officerId }, data: { role: input.role } });
      return { role: input.role };
    });
  }

  /** 每 SALARY_INTERVAL_TICKS 結算薪資（docs/01 §4.5）：付得起就扣款，付不起就扣忠誠度。 */
  async paySalariesIfDue(worldId: string, tick: number): Promise<void> {
    if (tick % BALANCE.SALARY_INTERVAL_TICKS !== 0) return;

    const fleets = await this.prisma.fleet.findMany({
      where: { worldId, guild: { kind: "PLAYER" } },
      include: { officers: true, guild: true },
    });

    for (const fleet of fleets) {
      if (fleet.officers.length === 0) continue;
      const totalSalary = fleet.officers.reduce((acc, o) => acc + o.salary, 0);
      const gold = Number(fleet.guild.gold);

      if (gold >= totalSalary) {
        await this.prisma.guild.update({
          where: { id: fleet.guildId },
          data: { gold: BigInt(gold - totalSalary) },
        });
      } else {
        await this.prisma.$transaction(
          fleet.officers.map((o) =>
            this.prisma.officer.update({
              where: { id: o.id },
              data: { loyalty: Math.max(0, o.loyalty - BALANCE.LOYALTY_PENALTY_UNPAID) },
            }),
          ),
        );
      }
    }
  }
}
