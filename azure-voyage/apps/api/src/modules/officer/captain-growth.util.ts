import type { Prisma, PrismaClient } from "@prisma/client";
import { applyCaptainExpGain, type CaptainStats } from "@azure-voyage/shared";

type PrismaLike = Prisma.TransactionClient | PrismaClient;

/**
 * 提督（艦長）本人獲得經驗值（M27，往大航海時代靠近：玩家角色的 RPG 成長）：
 * 貿易/航行抵達/海戰勝利/發現物登錄共用。跨過等級門檻時五維同步成長（見
 * shared/rules/captainGrowth.ts），一次寫入。與 awardExpToFleetOfficers 對稱，
 * 但作用對象是 Guild（玩家本人），不是雇用的 Officer。
 */
export async function awardCaptainExp(tx: PrismaLike, guildId: string, amount: number): Promise<void> {
  const guild = await tx.guild.findUniqueOrThrow({ where: { id: guildId } });
  const currentStats: CaptainStats = {
    lead: guild.captainLead,
    nav: guild.captainNav,
    combat: guild.captainCombat,
    trade: guild.captainTrade,
    lore: guild.captainLore,
  };
  const result = applyCaptainExpGain(guild.captainExp, amount, currentStats);
  await tx.guild.update({
    where: { id: guildId },
    data: {
      captainExp: result.exp,
      ...(result.levelsGained > 0
        ? {
            captainLead: result.stats.lead,
            captainNav: result.stats.nav,
            captainCombat: result.stats.combat,
            captainTrade: result.stats.trade,
            captainLore: result.stats.lore,
          }
        : {}),
    },
  });
}
