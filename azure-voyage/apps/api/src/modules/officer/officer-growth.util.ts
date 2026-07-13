import type { Prisma, PrismaClient } from "@prisma/client";
import { applyExpGain, type OfficerStats } from "@azure-voyage/shared";

type PrismaLike = Prisma.TransactionClient | PrismaClient;

/**
 * 艦隊全體航海士獲得經驗值（docs/01 §4.5，M23）：貿易/航行抵達/海戰勝利共用。
 * 跨過等級門檻時屬性同步成長（見 shared/rules/officerGrowth.ts），一次寫入。
 */
export async function awardExpToFleetOfficers(tx: PrismaLike, fleetId: string, amount: number): Promise<void> {
  const officers = await tx.officer.findMany({ where: { fleetId } });
  for (const officer of officers) {
    const result = applyExpGain(officer.exp, amount, officer.stats as unknown as OfficerStats);
    await tx.officer.update({
      where: { id: officer.id },
      data:
        result.levelsGained > 0
          ? { exp: result.exp, stats: result.stats as unknown as Prisma.InputJsonValue }
          : { exp: result.exp },
    });
  }
}
