# 03 — 資料模型

## 0. 最重要的設計決策：靜態內容 vs 動態狀態分離

- **靜態內容（Content Pack）**：交易品定義、船級定義、港口/海域/海圖 hex、技能表、平衡常數 —— 放在 `packages/shared/src/content/*.ts`（TypeScript 常數 + Zod schema 驗證），隨程式版本管理，**不進 DB**。內容有 `CONTENT_VERSION`，存檔記錄自己是用哪版內容建立的。
- **動態狀態**：一切會隨遊戲進行改變的東西 —— 進 PostgreSQL，以 `contentId`（字串）引用靜態內容，例如 `Ship.shipClassId = "brig"`、`PortState.portId = "port.amber_gulf.aurelia"`。

理由：內容迭代不需要 migration；純函式規則可以直接 import 內容表做單元測試；存檔體積小。

## 1. Prisma Schema（完整草案）

> 實作者注意：這是權威草案。欄位可加不可任意刪改；改動需回寫本文件。

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ───────────────────────── 帳號層 ─────────────────────────

model User {
  id           String      @id @default(cuid())
  email        String      @unique
  passwordHash String
  displayName  String
  createdAt    DateTime    @default(now())
  worlds       GameWorld[]
}

// ───────────────────────── 世界層 ─────────────────────────

enum WorldStatus {
  ACTIVE
  VICTORY
  DEFEAT
  ABANDONED
}

model GameWorld {
  id             String      @id @default(cuid())
  userId         String
  user           User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  name           String                       // 存檔名
  difficulty     String                       // "EASY" | "NORMAL" | "HARD"
  contentVersion String                       // 建立時的內容版本
  seed           Int                          // 世界隨機種子（可重現）
  currentTick    Int         @default(0)      // 遊戲內天數
  status         WorldStatus @default(ACTIVE)
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  guilds      Guild[]
  fleets      Fleet[]
  officers    Officer[]
  portStates  PortState[]
  events      WorldEvent[]
  battles     Battle[]
  discoveries DiscoveryRecord[]
  aiLogs      AiGenerationLog[]

  @@index([userId, status])
}

// ─────────────────────── 商會（勢力）───────────────────────

enum GuildKind {
  PLAYER
  NPC
  LOCAL        // 港口在地勢力（影響力的緩衝池，無實體艦隊）
}

model Guild {
  id        String    @id @default(cuid())
  worldId   String
  world     GameWorld @relation(fields: [worldId], references: [id], onDelete: Cascade)
  kind      GuildKind
  name      String                    // NPC 商會名（AI 生成後固化）
  color     String                    // UI 用 hex color
  gold      BigInt    @default(0)     // 資金（分為最小單位，避免浮點）
  fame      Int       @default(0)     // 聲望
  // NPC 專用：AI 個性與當前策略（Zod: NpcPersona / NpcStrategy）
  aiPersona   Json?
  aiStrategy  Json?
  aiStrategyUpdatedTick Int?

  fleets     Fleet[]
  influences PortInfluence[]

  @@unique([worldId, name])
  @@index([worldId, kind])
}

// ─────────────────────── 艦隊與船 ───────────────────────

enum FleetActivity {
  DOCKED       // 停靠港中（時間暫停的主場景）
  SAILING      // 依 route 航行中
  ANCHORED     // 海上下錨
  EXPLORING    // 探索檢定中
  IN_BATTLE
}

model Fleet {
  id        String        @id @default(cuid())
  worldId   String
  world     GameWorld     @relation(fields: [worldId], references: [id], onDelete: Cascade)
  guildId   String
  guild     Guild         @relation(fields: [guildId], references: [id], onDelete: Cascade)
  name      String
  activity  FleetActivity @default(DOCKED)
  posQ      Int                          // hex 座標（axial q,r）
  posR      Int
  dockedPortId String?                   // contentId，DOCKED 時必填
  route     Json?                        // Zod: Route = { waypoints: HexCoord[], cursor: number, targetPortId? }
  food      Int           @default(0)    // 艦隊層級補給（簡化：不分船）
  water     Int           @default(0)
  morale    Int           @default(70)   // 0-100
  ships     Ship[]
  officers  Officer[]                    // 已指派到此艦隊的航海士

  @@index([worldId, guildId])
  @@index([worldId, activity])
}

model Ship {
  id          String  @id @default(cuid())
  fleetId     String
  fleet       Fleet   @relation(fields: [fleetId], references: [id], onDelete: Cascade)
  shipClassId String                  // contentId → 船級（帆船種類、基礎值）
  name        String
  hull        Int                     // 目前耐久
  sails       Int                     // 目前帆面狀態(0-100)
  crew        Int                     // 現有船員數
  isFlagship  Boolean @default(false)
  // 改裝與強化（Zod: ShipFitting，例：加固船殼、擴充貨艙、炮位數）
  fitting     Json    @default("{}")
  cargo       CargoSlot[]

  @@index([fleetId])
}

model CargoSlot {
  id          String @id @default(cuid())
  shipId      String
  ship        Ship   @relation(fields: [shipId], references: [id], onDelete: Cascade)
  commodityId String              // contentId
  quantity    Int
  avgBuyPrice Int                 // 均價（利潤結算與 UI 顯示用）

  @@unique([shipId, commodityId])
}

// ─────────────────────── 航海士 ───────────────────────

model Officer {
  id       String     @id @default(cuid())
  worldId  String
  world    GameWorld  @relation(fields: [worldId], references: [id], onDelete: Cascade)
  fleetId  String?                       // null = 待業中（在某港酒館）
  fleet    Fleet?     @relation(fields: [fleetId], references: [id], onDelete: SetNull)
  name     String
  portrait String                        // 頭像資產 key
  role     String?                       // "FIRST_MATE"|"NAVIGATOR"|"GUNNER"|"PURSER"|"LOOKOUT"|null
  stats    Json                          // Zod: OfficerStats {lead,nav,combat,trade,lore}
  skills   String[]                      // 技能 tag 陣列
  loyalty  Int        @default(60)
  exp      Int        @default(0)
  salary   Int                           // 每 30 tick 支付
  locationPortId String?                 // 待業時所在港（contentId）
  // AI 生成的個性摘要（對話 agent 的人設輸入，生成一次後固化）
  persona  Json?

  @@index([worldId, fleetId])
  @@index([worldId, locationPortId])
}

// ─────────────────── 港口動態狀態與市場 ───────────────────

model PortState {
  id        String    @id @default(cuid())
  worldId   String
  world     GameWorld @relation(fields: [worldId], references: [id], onDelete: Cascade)
  portId    String                      // contentId（港口靜態定義）
  prosperity Int      @default(50)      // 繁榮度 0-100，影響庫存回復與稅收
  facilities Json     @default("{}")    // 設施等級 {shipyard:2, market:3,...}
  market    MarketStock[]
  influences PortInfluence[]

  @@unique([worldId, portId])
}

model MarketStock {
  id          String    @id @default(cuid())
  portStateId String
  portState   PortState @relation(fields: [portStateId], references: [id], onDelete: Cascade)
  commodityId String                    // contentId
  stock       Int                       // 現庫存
  baseStock   Int                       // 基準庫存（回歸目標）
  price       Int                       // 目前單價（每 tick 由 economy 重算）
  priceHistory Json    @default("[]")   // 近 60 tick 環形陣列 [{t,p}]，UI 畫走勢圖用

  @@unique([portStateId, commodityId])
}

model PortInfluence {
  id          String    @id @default(cuid())
  portStateId String
  portState   PortState @relation(fields: [portStateId], references: [id], onDelete: Cascade)
  guildId     String
  guild       Guild     @relation(fields: [guildId], references: [id], onDelete: Cascade)
  share       Decimal   @db.Decimal(5, 2)   // 0.00 - 100.00
  goodwill    Decimal   @db.Decimal(10, 2) @default(0) // 未結算商譽點

  @@unique([portStateId, guildId])
}

// ─────────────────────── 事件 ───────────────────────

enum EventStatus {
  SCHEDULED   // 已排程未觸發
  ACTIVE      // 生效中（有持續效果）
  RESOLVED
  EXPIRED
}

enum EventSource {
  RULE        // 規則引擎產生
  AI          // AI Orchestrator 產生
}

model WorldEvent {
  id        String      @id @default(cuid())
  worldId   String
  world     GameWorld   @relation(fields: [worldId], references: [id], onDelete: Cascade)
  source    EventSource
  type      String                     // "STORM"|"PIRATE"|"MARKET_SHOCK"|"FESTIVAL"|"RUMOR_QUEST"|...
  status    EventStatus @default(SCHEDULED)
  triggerTick Int                      // 觸發 tick
  expireTick  Int?                     // 持續效果結束 tick
  // Zod: EventPayload（依 type 區分的 discriminated union；
  // AI 事件的數值效果欄位在驗證時 clamp 到安全範圍）
  payload   Json
  narrative String?                    // 顯示給玩家的敘事文本（模板或 AI）

  @@index([worldId, status, triggerTick])
}

// ─────────────────────── 海戰 ───────────────────────

enum BattleStatus {
  ONGOING
  PLAYER_WIN
  PLAYER_LOSE
  FLED
}

model Battle {
  id        String       @id @default(cuid())
  worldId   String
  world     GameWorld    @relation(fields: [worldId], references: [id], onDelete: Cascade)
  status    BattleStatus @default(ONGOING)
  seed      Int                         // 戰鬥隨機種子（可重放）
  round     Int          @default(1)
  startedTick Int
  // Zod: BattleState —— 完整棋盤快照（單位位置/HP/風向/行動順序）。
  // 戰鬥是短生命週期實體，用單一 JSONB 快照 + actionLog 而非正規化，簡化且夠用。
  state     Json
  actionLog Json         @default("[]") // 每步行動的 append-only log（重放/除錯）

  @@index([worldId, status])
}

// ─────────────────────── 發現物 ───────────────────────

model DiscoveryRecord {
  id          String    @id @default(cuid())
  worldId     String
  world       GameWorld @relation(fields: [worldId], references: [id], onDelete: Cascade)
  discoveryId String                    // contentId（發現物定義：位置/稀有度/類型）
  foundTick   Int
  registered  Boolean   @default(false) // 是否已向學會登錄
  narrative   String?                   // AI 生成之圖鑑文本（一次生成後固化）

  @@unique([worldId, discoveryId])
}

// ─────────────────────── AI 稽核 ───────────────────────

model AiGenerationLog {
  id        String    @id @default(cuid())
  worldId   String
  world     GameWorld @relation(fields: [worldId], references: [id], onDelete: Cascade)
  kind      String                     // "EVENT_GEN"|"NPC_STRATEGY"|"DIALOGUE"|"NARRATIVE"|"PERSONA"
  model     String
  inputTokens  Int
  outputTokens Int
  ok        Boolean                    // 驗證是否通過（false = 走了 fallback）
  error     String?
  createdAt DateTime  @default(now())

  @@index([worldId, kind, createdAt])
}
```

## 2. 各表設計理由與注意事項

| 決策 | 理由 |
|------|------|
| `Guild` 統一玩家/NPC/在地勢力 | 影響力、資金、艦隊的規則對三者一致，NPC 只是多了 `aiPersona/aiStrategy`。避免兩套邏輯。 |
| 補給掛在 `Fleet` 而非 `Ship` | 大幅簡化 UI 與計算；船隻只承載貨物容量總和的約束。 |
| `CargoSlot @@unique([shipId, commodityId])` | 同船同商品合併一格，`avgBuyPrice` 做移動平均。 |
| `MarketStock.priceHistory` 用 JSONB 環形陣列 | 走勢圖只需近 60 tick，不值得開時序表；固定長度控制列大小。 |
| `PortInfluence.share` 用 `Decimal(5,2)` | 影響力要做百分比擠壓運算，浮點誤差會累積，用 Decimal + 共用 rounding 函式。 |
| `Battle.state` 用 JSONB 快照 | 戰鬥實體生命週期短（幾分鐘）、結束後只留 log；正規化成 unit 表毫無收益。 |
| `Guild.gold` 用 `BigInt` | 後期資產可能超過 2^31；金額一律整數最小單位。 |
| `seed` 存於 world 與 battle | 一切隨機使用 seeded PRNG（`packages/shared/src/rules/rng.ts`，演算法用 mulberry32），使 tick 與戰鬥可重現、可測試。 |
| AI 文本「生成後固化」 | `Officer.persona`、`DiscoveryRecord.narrative`、`Guild.name` 等生成一次即存，保證世界一致性並控制成本。 |

## 3. JSONB 欄位的 Zod Schema 對照表

所有 JSONB 欄位在 `packages/shared/src/schemas/` 都有對應 Zod schema，**讀寫都必須經過 parse**：

| 欄位 | Schema | 摘要 |
|------|--------|------|
| `Fleet.route` | `RouteSchema` | `{ waypoints: {q,r}[], cursor: number, targetPortId?: string }` |
| `Ship.fitting` | `ShipFittingSchema` | `{ hullReinforce?: 0-3, cargoExpand?: 0-3, cannons: number, figurehead?: string }` |
| `Officer.stats` | `OfficerStatsSchema` | `{ lead, nav, combat, trade, lore }` 各 1-100 |
| `Guild.aiPersona` | `NpcPersonaSchema` | `{ archetype, riskTolerance, aggression, focusRegions[], flavorText }` |
| `Guild.aiStrategy` | `NpcStrategySchema` | `{ goals: NpcGoal[], validUntilTick }`（見 06 §4） |
| `WorldEvent.payload` | `EventPayloadSchema` | discriminated union by `type`，數值欄位帶 min/max clamp |
| `Battle.state` | `BattleStateSchema` | 棋盤、單位陣列、風向、回合順序 |
| `MarketStock.priceHistory` | `PricePointSchema[]` | `{ t: number, p: number }[]` max 60 |

## 4. 靜態內容檔案結構（packages/shared/src/content/）

```
content/
├── version.ts          # export const CONTENT_VERSION = "1.0.0"
├── regions.ts          # 7 海域：id、名稱、危險度、季節風向表
├── ports.ts            # ~40 港：id、海域、hex 座標、規模、產物、設施上限
├── commodities.ts      # ~36 商品：id、分類、基礎價、產地港、體積
├── shipClasses.ts      # ~10 船級：速度/耐久/貨艙/炮位/船員數/價格
├── officersPool.ts     # 航海士生成模板（名字池由 AI 補、屬性範圍規則生）
├── skills.ts           # 技能 tag 定義與效果係數
├── discoveries.ts      # ~60 發現物：id、hex 位置、稀有度、所需學識
├── map/
│   ├── hexmap.json     # 120x80 axial 地形陣列（工具腳本產出）
│   └── mapgen.ts       # 地圖產生腳本（一次性，結果 commit 進 repo）
└── constants.ts        # 全部平衡常數（含 difficulty 乘數表）
```

## 5. 世界建立（New Game）流程

`POST /worlds` 時在單一 transaction 內：
1. 建 `GameWorld`（帶 seed、contentVersion、difficulty）。
2. 為每個靜態港口建 `PortState` + `MarketStock`（初始庫存=baseStock、初始價=公式跑一次）+ `LOCAL` guild 的 `PortInfluence`（各港在地勢力 100%）。
3. 建玩家 `Guild` + 起始 `Fleet`（1 艘入門船）+ 2 名起始 `Officer`。
4. 建 5 個 NPC `Guild`：規則先給占位名與起始地盤影響力（從 LOCAL 擠壓 15-25%），再排一個 `PERSONA` AI 任務非同步補全名稱/個性（AI 未回前用占位資料，不阻塞開局）。
5. 排入第一批規則事件（季節風暴日程等）。
