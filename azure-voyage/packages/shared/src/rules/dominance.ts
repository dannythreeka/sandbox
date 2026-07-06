/** 海域霸權判定（docs/01 §4.3、docs/02 §2）。 */
import { BALANCE } from "../content/constants";
import { PORTS } from "../content/ports";

export interface PortShareRow {
  portId: string;
  guildId: string;
  share: number;
}

/**
 * 依「各港影響力」彙總出每個海域的主導商會與其平均份額，
 * 判定是否達到海域霸權（份額 ≥ REGION_DOMINANCE_SHARE 且為該海域最高）。
 */
export function regionsDominatedBy(guildId: string, rows: readonly PortShareRow[]): number {
  const portToRegion = new Map(PORTS.map((p) => [p.id, p.regionId]));
  const byRegion = new Map<string, Map<string, number[]>>();

  for (const row of rows) {
    const regionId = portToRegion.get(row.portId);
    if (!regionId) continue;
    if (!byRegion.has(regionId)) byRegion.set(regionId, new Map());
    const guildShares = byRegion.get(regionId)!;
    if (!guildShares.has(row.guildId)) guildShares.set(row.guildId, []);
    guildShares.get(row.guildId)!.push(row.share);
  }

  let dominatedCount = 0;
  for (const guildShares of byRegion.values()) {
    let bestGuild: string | null = null;
    let bestAvg = -1;
    for (const [gid, shares] of guildShares) {
      const avg = shares.reduce((a, b) => a + b, 0) / shares.length;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestGuild = gid;
      }
    }
    if (bestGuild === guildId && bestAvg >= BALANCE.REGION_DOMINANCE_SHARE) {
      dominatedCount++;
    }
  }
  return dominatedCount;
}
