/**
 * New Game 世界生成（docs/03 §5）。
 * 純函式：同 seed + difficulty 產出完全相同的 WorldPlan。
 * api 端負責把 plan 持久化（單一 transaction）；這裡不碰任何 IO。
 */
import { BALANCE, startingGold } from "../content/constants";
import { COMMODITIES, commodityById } from "../content/commodities";
import { NPC_GUILD_TEMPLATES } from "../content/npcGuilds";
import { OFFICER_TEMPLATES, STARTING_OFFICER_KEYS, type OfficerStats } from "../content/officersPool";
import { HOME_PORT_ID, PORTS, portById } from "../content/ports";
import { STARTER_SHIP_CLASS_ID, shipClassById } from "../content/shipClasses";
import type { Difficulty } from "../schemas/world";
import { oddrToAxial } from "./hex";
import { deriveSeed, Rng } from "./rng";

export interface MarketInitPlan {
  commodityId: string;
  stock: number;
  baseStock: number;
  price: number;
}

export interface InfluenceInitPlan {
  /** "PLAYER" | "LOCAL" | npc template key */
  guildKey: string;
  share: number; // 0–100，兩位小數
}

export interface PortInitPlan {
  portId: string;
  prosperity: number;
  market: MarketInitPlan[];
  influences: InfluenceInitPlan[];
}

export interface OfficerInitPlan {
  templateKey: string;
  name: string;
  portrait: string;
  stats: OfficerStats;
  skills: string[];
  salary: number;
}

export interface NpcGuildInitPlan {
  key: string;
  name: string;
  color: string;
  gold: number;
  persona: {
    archetype: string;
    riskTolerance: number;
    aggression: number;
    homeRegionId: string;
    /** M5 PERSONA agent 補全前的占位 */
    placeholder: true;
  };
}

export interface WorldPlan {
  playerGold: number;
  homePortId: string;
  starterShipClassId: string;
  starterShipName: string;
  starterCrew: number;
  fleetPos: { q: number; r: number };
  startingFood: number;
  startingWater: number;
  startingMorale: number;
  officers: OfficerInitPlan[];
  npcGuilds: NpcGuildInitPlan[];
  ports: PortInitPlan[];
}

function rollStats(rng: Rng, ranges: Record<keyof OfficerStats, [number, number]>): OfficerStats {
  return {
    lead: rng.int(...ranges.lead),
    nav: rng.int(...ranges.nav),
    combat: rng.int(...ranges.combat),
    trade: rng.int(...ranges.trade),
    lore: rng.int(...ranges.lore),
  };
}

function buildMarket(rng: Rng, portId: string): MarketInitPlan[] {
  const port = portById(portId);
  const produceSet = new Set(port.produces);
  const extraCount = BALANCE.MARKET_EXTRA_BASE + port.size;
  const candidates = COMMODITIES.filter((c) => !produceSet.has(c.id)).map((c) => c.id);
  const imports = rng.sample(candidates, extraCount);

  const entries: MarketInitPlan[] = [];
  for (const commodityId of [...port.produces, ...imports]) {
    const def = commodityById(commodityId);
    const isProduce = produceSet.has(commodityId);
    const baseStock =
      (isProduce ? BALANCE.PRODUCE_STOCK_PER_SIZE : BALANCE.IMPORT_STOCK_PER_SIZE) * port.size;
    const factor = isProduce ? BALANCE.PRODUCE_PRICE_FACTOR : BALANCE.IMPORT_PRICE_FACTOR;
    const jitter = 1 + (rng.float() * 2 - 1) * BALANCE.INIT_PRICE_JITTER;
    entries.push({
      commodityId,
      stock: baseStock,
      baseStock,
      price: Math.max(1, Math.round(def.basePrice * factor * jitter)),
    });
  }
  return entries;
}

function buildInfluences(rng: Rng, portId: string): InfluenceInitPlan[] {
  const port = portById(portId);
  const entries: InfluenceInitPlan[] = [];
  let localShare = 100;
  for (const npc of NPC_GUILD_TEMPLATES) {
    if (npc.homeRegionId !== port.regionId) continue;
    const share = rng.int(BALANCE.NPC_HOME_INFLUENCE_MIN, BALANCE.NPC_HOME_INFLUENCE_MAX);
    entries.push({ guildKey: npc.key, share });
    localShare -= share;
  }
  entries.push({ guildKey: "LOCAL", share: localShare });
  return entries;
}

export function buildNewWorldPlan(seed: number, difficulty: Difficulty): WorldPlan {
  const rng = new Rng(deriveSeed(seed, 0x0e0_11e));
  const homePort = portById(HOME_PORT_ID);
  const starterClass = shipClassById(STARTER_SHIP_CLASS_ID);

  const officers: OfficerInitPlan[] = STARTING_OFFICER_KEYS.map((key) => {
    const template = OFFICER_TEMPLATES.find((t) => t.key === key)!;
    return {
      templateKey: template.key,
      name: template.name,
      portrait: template.portrait,
      stats: rollStats(rng, template.statRanges),
      skills: [...template.skills],
      salary: template.salary,
    };
  });

  const npcGuilds: NpcGuildInitPlan[] = NPC_GUILD_TEMPLATES.map((t) => ({
    key: t.key,
    name: t.name,
    color: t.color,
    gold: t.startingGold,
    persona: {
      archetype: t.archetype,
      riskTolerance: t.riskTolerance,
      aggression: t.aggression,
      homeRegionId: t.homeRegionId,
      placeholder: true,
    },
  }));

  const ports: PortInitPlan[] = PORTS.map((port) => ({
    portId: port.id,
    prosperity: 40 + port.size * 10,
    market: buildMarket(rng, port.id),
    influences: buildInfluences(rng, port.id),
  }));

  return {
    playerGold: startingGold(difficulty),
    homePortId: HOME_PORT_ID,
    starterShipClassId: STARTER_SHIP_CLASS_ID,
    starterShipName: "海燕號",
    starterCrew: Math.round(starterClass.crewMax * BALANCE.STARTING_CREW_RATIO),
    fleetPos: oddrToAxial(homePort.coord),
    startingFood: BALANCE.STARTING_FOOD,
    startingWater: BALANCE.STARTING_WATER,
    startingMorale: BALANCE.STARTING_MORALE,
    officers,
    npcGuilds,
    ports,
  };
}
