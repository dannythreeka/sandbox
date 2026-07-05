/**
 * 全部平衡常數的單一真相來源（docs/01 §5）。
 * 禁止在業務代碼硬編碼數值；難度以乘數覆蓋。
 */
import type { Difficulty } from "../schemas/world";

export const BALANCE = {
  // ── 開局 ──
  STARTING_GOLD: 10000,
  STARTING_FOOD: 30,
  STARTING_WATER: 30,
  STARTING_MORALE: 70,
  STARTING_CREW_RATIO: 0.8, // 起始船員 = crewMax * ratio

  // ── 市場初始化（worldgen）──
  /** 特產基準庫存 = PRODUCE_STOCK_PER_SIZE × 港口規模 */
  PRODUCE_STOCK_PER_SIZE: 400,
  /** 非特產基準庫存 = IMPORT_STOCK_PER_SIZE × 港口規模 */
  IMPORT_STOCK_PER_SIZE: 120,
  /** 市場品項數 = 特產 + MARKET_EXTRA_BASE + 規模 */
  MARKET_EXTRA_BASE: 3,
  /** 初始價格乘數（正式價格公式 M3 接手） */
  PRODUCE_PRICE_FACTOR: 0.85,
  IMPORT_PRICE_FACTOR: 1.1,
  /** 初始價格隨機擾動 ±10% */
  INIT_PRICE_JITTER: 0.1,

  // ── 影響力初始化 ──
  /** NPC 商會在主場海域每港的初始影響力範圍（自在地勢力擠壓） */
  NPC_HOME_INFLUENCE_MIN: 15,
  NPC_HOME_INFLUENCE_MAX: 25,

  // ── 影響力結算（M3 起使用）──
  INFLUENCE_DECAY: 0.001,
  GOODWILL_CONVERT_RATE: 0.05,

  // ── 補給消耗（M2 起使用）──
  FOOD_PER_CREW_PER_TICK: 1,
  WATER_PER_CREW_PER_TICK: 1,

  // ── 存檔 ──
  MAX_ACTIVE_WORLDS_PER_USER: 5,
} as const;

/** 難度乘數（覆蓋 BALANCE 的比例） */
export const DIFFICULTY_MODS: Record<
  Difficulty,
  { startingGoldMul: number; encounterMul: number; priceSpreadMul: number }
> = {
  EASY: { startingGoldMul: 1.5, encounterMul: 0.7, priceSpreadMul: 1.15 },
  NORMAL: { startingGoldMul: 1.0, encounterMul: 1.0, priceSpreadMul: 1.0 },
  HARD: { startingGoldMul: 0.7, encounterMul: 1.4, priceSpreadMul: 0.85 },
};

export function startingGold(difficulty: Difficulty): number {
  return Math.round(BALANCE.STARTING_GOLD * DIFFICULTY_MODS[difficulty].startingGoldMul);
}
