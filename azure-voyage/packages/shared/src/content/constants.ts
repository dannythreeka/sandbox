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

  // ── 影響力結算 ──
  INFLUENCE_DECAY: 0.001,
  GOODWILL_CONVERT_RATE: 0.05,
  /** 交易額 → 商譽點轉換係數（docs/05 §4 goodwillFromTrade） */
  GOODWILL_K: 0.6,
  /** 影響力折扣上限（docs/01 §4.3）：買價最多 -8%、賣價最多 +8% */
  MAX_INFLUENCE_DISCOUNT: 0.08,
  /** 港口投資基準成本（docs/01 §4.3 investmentGain 分母） */
  INVESTMENT_COST_BASE: 40,

  // ── 市場價格（M3 起使用，docs/05 §2）──
  SELL_RATIO: 0.92,
  /** 每 tick 庫存回歸基準值的比例 */
  MARKET_REGEN_RATE: 0.05,

  // ── 補給消耗（M2 起使用）──
  FOOD_PER_CREW_PER_TICK: 1,
  WATER_PER_CREW_PER_TICK: 1,
  /** 出港自動補給的單價（每 1 糧或 1 水；M10 起使用） */
  SUPPLY_GOLD_PER_UNIT: 2,

  // ── 風向系統（M11 起使用，docs/10 §M11）──
  /** 一季的 tick 數（一年 = 4 × 90 = 360 天） */
  SEASON_TICKS: 90,
  /** 航向與風向夾角檔位 0–3（順風/側順/側風/逆風）的速度修正 */
  WIND_MODIFIERS: [1.3, 1.15, 1.0, 0.6] as const,
  /** 每日風向擾動：主風向機率；左右鄰向各一份；剩餘機率均分給其他三向 */
  WIND_JITTER_MAIN: 0.6,
  WIND_JITTER_ADJACENT: 0.15,

  // ── 每日天氣（M14 起使用，docs/10 §M14）──
  /** 風暴醞釀機率 = base + 海域 danger × factor（danger 0.1→4%、0.5→12%） */
  WEATHER_STORM_BASE: 0.02,
  WEATHER_STORM_DANGER_FACTOR: 0.2,
  /** 起霧機率（固定，不隨危險度變化） */
  WEATHER_FOG_PROB: 0.15,
  /** 微風機率（固定） */
  WEATHER_BREEZE_PROB: 0.2,
  /** 微風天氣的航速加成 */
  WEATHER_BREEZE_SPEED_MULT: 1.05,
  /** 起霧對遭遇率的加成／對探索成功率的減損（同一係數，正負號依場景而定） */
  WEATHER_FOG_MODIFIER: 0.1,
  /** 風暴醞釀對風暴事件機率的加乘 */
  WEATHER_STORM_EVENT_MULT: 2.0,

  // ── 航海士（M4 起使用，docs/01 §4.5）──
  /** 每 30 tick 結算一次薪資 */
  SALARY_INTERVAL_TICKS: 30,
  /** 欠薪時忠誠度扣減 */
  LOYALTY_PENALTY_UNPAID: 10,

  // ── 造船廠（M4 起使用）──
  /** 修理費：每點缺損耐久的金額 */
  REPAIR_COST_PER_HULL: 15,
  /** 賣船退款比例（原價的比例） */
  SHIP_SELL_REFUND_RATIO: 0.5,

  // ── 海戰與遭遇（M5 起使用）──
  /** 每 tick 遭遇機率 = 海域危險度 × 此係數 */
  ENCOUNTER_CHANCE_PER_DANGER: 0.15,
  /** 擊沉敵艦的戰利品 = 該船級造價 × 此比例 */
  BATTLE_LOOT_RATIO: 0.15,
  /** 戰敗被拖回母港的贖金比例（現有資金） */
  DEFEAT_RANSOM_RATIO: 0.1,

  // ── 探索與事件（M6 起使用）──
  /** 探索點判定半徑（offset 格距離） */
  EXPLORE_RADIUS: 2,
  EXPLORE_FOOD_COST: 5,
  EXPLORE_WATER_COST: 5,
  /** 每 tick 風暴機率 = 海域危險度 × 此係數（獨立於海賊遭遇） */
  STORM_CHANCE_PER_DANGER: 0.08,
  /** 風暴對船體造成的傷害比例（占最大耐久） */
  STORM_HULL_DAMAGE_RATIO: 0.1,
  STORM_SUPPLY_LOSS: 8,
  /** 港口慶典排程間隔與持續時間 */
  FESTIVAL_INTERVAL_TICKS: 25,
  FESTIVAL_DURATION_TICKS: 10,
  FESTIVAL_PROSPERITY_BOOST: 15,
  /** 登錄發現物的學會港口最低規模 */
  GUILD_HALL_MIN_PORT_SIZE: 2,

  // ── NPC 商會（M7 起使用）──
  /** 每隔幾 tick 讓每個 NPC 商會做一次投資行動 */
  NPC_ACT_INTERVAL_TICKS: 5,
  /** 每次行動投入現有資金的比例（乘上該商會的 riskTolerance） */
  NPC_INVEST_GOLD_FRACTION: 0.05,

  // ── 勝利條件（M7 起使用，docs/02 §2）──
  /** 海域霸權門檻：該海域內單一商會份額需達到的百分比 */
  REGION_DOMINANCE_SHARE: 40,
  /** 達成海域霸權的海域數門檻（共 7 海域） */
  VICTORY_REGIONS_REQUIRED: 4,
  /** 總資產勝利門檻（金額，難度乘數同 startingGold） */
  VICTORY_ASSET_TARGET: 800000,

  // ── 存檔 ──
  MAX_ACTIVE_WORLDS_PER_USER: 5,

  // ── AI Agent 層（M8 起使用，docs/06）──
  /** 結構化生成用模型（EVENT_GEN / NPC_STRATEGY） */
  AI_MODEL_STRUCTURED: "claude-sonnet-5",
  /** 每個 NPC 商會多久重新生成一次策略目標佇列 */
  NPC_STRATEGY_INTERVAL_TICKS: 90,
  /** 每隔幾 tick 嘗試提出一次傳聞事件（RUMOR） */
  AI_EVENT_INTERVAL_TICKS: 25,
  /** 每個世界每日 token 預算（input+output 合計），超額當日全走 fallback */
  AI_DAILY_TOKEN_BUDGET: 250_000,
  /** 單次生成呼叫預估用量（保守估計，超出實際值也沒關係，只影響配額判斷） */
  AI_CALL_TOKEN_ESTIMATE: 2_000,
  /** 每個 tick 最多補全幾筆 PERSONA（NPC 商會＋航海士合計），避免開局那次 tick 序列呼叫太多次 Claude */
  PERSONA_MAX_PER_TICK: 3,
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

/** 難度越高，總資產勝利門檻越低（補償較少的起始資金與較高的遭遇率）。 */
export function victoryAssetTarget(difficulty: Difficulty): number {
  return Math.round(BALANCE.VICTORY_ASSET_TARGET / DIFFICULTY_MODS[difficulty].encounterMul);
}
