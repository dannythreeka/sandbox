# 05 — 遊戲引擎（tick 迴圈、經濟、戰鬥解算）

引擎 = 「clock 編排 + 各領域 service + shared 純函式規則」。**所有數值計算放 `packages/shared/src/rules/`（純函式、可單測、前端可 import 做預覽）**，service 只負責讀寫 DB 與編排。

## 1. tick 生命週期

觸發：前端 `client:advance` → `ClockService.requestAdvance(worldId, n)` → 逐 tick 排入 BullMQ（job id 去重）→ `world-tick.processor` 執行。

單一 tick 的階段（**順序固定，不可調換**）：

```
PHASE 0  載入世界快照（一次查齊：fleets+ships+officers / 受關注 portStates / active events / npc guilds）
PHASE 1  事件觸發檢查     scheduled events 中 triggerTick == now 者 → ACTIVE，套用 payload 效果
PHASE 2  艦隊推進         每支 SAILING 艦隊：風向 → 速度 → 沿 route 移動 → 抵港判定
PHASE 3  補給與士氣       消耗糧水、士氣增減、斷糧懲罰
PHASE 4  航行遭遇擲骰     風暴/海賊/漂流物…（用 world seed + tick 派生的 PRNG）
PHASE 5  NPC 商會行動     依 aiStrategy 執行 0-2 個原子行動（見 06 §4；策略過期則排 AI 任務刷新）
PHASE 6  經濟結算         受影響港口的庫存回歸 + 價格重算 + priceHistory push
PHASE 7  影響力結算       goodwill → share 轉化、自然衰減、擠壓、稅收分紅、海域霸權判定
PHASE 8  勝敗檢查         勝利/失敗條件 → 更新 world.status
PHASE 9  持久化 + 廣播    單一 transaction 寫回；組 server:tick / server:event 推送
```

實作骨架：

```ts
// world-tick.processor.ts（示意）
async process(job: Job<{worldId: string}>) {
  await this.redlock.using([`lock:world:${worldId}`], 5000, async () => {
    const snap = await this.snapshotLoader.load(worldId);        // PHASE 0
    const rng = tickRng(snap.world.seed, snap.world.currentTick); // 派生 PRNG
    const fx = new TickEffects();                                 // 收集所有變更與推送

    this.eventService.activateDue(snap, fx);                      // 1
    this.voyageService.advanceFleets(snap, rng, fx);              // 2,3
    this.encounterService.roll(snap, rng, fx);                    // 4
    await this.npcService.act(snap, rng, fx);                     // 5
    this.economyService.settle(snap, fx);                         // 6
    this.influenceService.settle(snap, fx);                       // 7
    this.victoryService.check(snap, fx);                          // 8
    await this.persister.commit(worldId, fx);                     // 9: 單一 $transaction
    this.gateway.broadcast(worldId, fx.toMessages());
  });
}
```

`TickEffects` 是「本 tick 全部變更」的收集器（entity 差分 + 待推送訊息 + 待排 AI 任務），使 PHASE 1–8 完全不碰 DB —— 好測、好重放。

**效能預算**：單 tick p95 < 80ms（40 港 × 36 商品的價格重算是純算術，非常快）。PHASE 6 只重算「dirty 港口」（有交易/事件/NPC 動作的港）+ 每 tick 輪動 1/10 的港口做庫存回歸，攤平成本。

## 2. 經濟引擎（economy）

```ts
// packages/shared/src/rules/pricing.ts
export function computePrice(input: {
  base: number;            // 商品基礎價（content）
  stock: number; baseStock: number;
  distanceFactor: number;  // 產地距離係數（content 預算好的矩陣）
  eventFactor: number;     // ACTIVE 事件乘數，clamp 0.5–2.0
  buyerInfluencePct: number;
}): { buy: number; sell: number }

// 供需曲線：sd = clamp((baseStock / max(stock,1)) ** ELASTICITY[category], 0.4, 3.0)
// ELASTICITY：奢侈品/香料高彈性（1.2），糧食低彈性（0.6）
// buy  = round(base * sd * distanceFactor * eventFactor * (1 - influenceDiscount))
// sell = round(buy * SELL_RATIO)  // 0.92，市場吃差價
```

- 庫存動態：交易即時增減 `stock`；回歸 `stock += (baseStock - stock) * REGEN_RATE`（產地港 REGEN 較快）。
- `MARKET_SHOCK` 類事件改的是 `eventFactor` 與 `baseStock`（暫時值，事件過期還原）——AI 事件也只能碰這兩個鉤子，天花板已 clamp。
- 防剝削：同港同商品「本日已交易量」超過 `stock` 的 30% 時，後續單價追加滑價（每 10% 量 +3% 價差）。

## 3. 航行引擎（voyage）

```ts
// packages/shared/src/rules/movement.ts
export function fleetSpeed(fleet, wind: Wind, hex: HexInfo): number
export function stepAlongRoute(route, speedBudget): { newPos, newCursor, arrived?: portId }
// hex 距離/鄰接/直線用 axial 座標標準演算法（cube 轉換）
```

- 風向：`content/regions.ts` 定義各海域四季主風向 + `tickRng` 每日 ±60° 擾動。
- 尋路：前端 A*（展示預覽航線）；**後端用同一份 shared A* 重新驗證** waypoints 合法（不可穿陸地/未知海域需已解鎖）。
- 遭遇擲骰：`P(encounter) = region.danger × season × (1 - lookoutSkill×0.3)`，命中後由權重表選類型。海賊遭遇 → 生成敵艦隊（規模隨玩家資產與海域危險度縮放）→ `server:event` 給玩家選：應戰 / 逃跑檢定 / 繳過路費。

## 4. 影響力引擎（influence）

```ts
// packages/shared/src/rules/influence.ts
export function goodwillFromTrade(tradeValue: number, currentShare: number): number
// 邊際遞減：goodwill = k * sqrt(tradeValue) * (1 - currentShare/120)

export function settleInfluence(pool: PortInfluenceView[]): PortInfluenceView[]
// 1) 每家 share -= share * DECAY(0.001)
// 2) goodwill 轉化：delta = goodwill * CONVERT_RATE
// 3) 擠壓：若 sum(share)+delta > 100，先壓 LOCAL，再按 share 比例壓其他家
// 4) Decimal 兩位數修約，守恆檢查 sum <= 100（單測必驗）
```

投資的立即影響力：`gain = amount / (COST_BASE * (1 + currentShare/25))` —— 越高越貴，防雪球。

## 5. 海戰解算（battle）

- `BattleState`（JSONB）為唯一真相；每個 `battle:action` 進來：Zod 驗證 → `packages/shared/src/rules/battle.ts` 的 `applyAction(state, action, rng)` 純函式產出新 state + log entry → 寫回 → 廣播差分。
- 敵方 AI 回合：規則型戰術 AI（非 LLM，保證即時）：評分函數選擇動作（距離、側舷角、血量威脅）。LLM 只在戰前生成敵將「戰術傾向參數」（激進/保守/掠貨優先），改變評分權重 —— 風味由 AI、判定由規則。
- `rng = battleRng(battle.seed, round, actionIndex)`：完全可重放，`actionLog` + seed 可重建全程（測試金礦）。
- 逃跑判定、接舷戰、投降門檻全部在 shared rules，公式見 01 §4.4。

## 6. NPC 商會執行器（npc）

NPC 每 tick 依 `aiStrategy.goals`（AI 產的高階目標佇列，如「提升 CORAL_ARC 兩港影響力」「組第二艦隊跑絹風航線」）由**規則執行器**翻譯成原子行動：move fleet / trade / invest / raid pirate。執行器保證合法性（NPC 也要有錢才能投資、也吃同一套價格），AI 永遠不直接改狀態。策略每 ~90 tick 或重大事件後刷新（排 AI 任務，見 06）。

## 7. 測試策略（引擎部分）

- `packages/shared/src/rules/**`：**100% 單元測試覆蓋目標**。重點：價格曲線單調性、影響力守恆、hex 幾何、戰鬥傷害邊界、PRNG 確定性（同 seed 同結果）。
- 引擎整合測試：以固定 seed 建測試世界 → 跑 200 tick → 斷言關鍵不變量（金錢守恆扣除稅損、share 總和 ≤ 100、無 NaN、無負庫存）。
- 戰鬥重放測試：records/ 目錄放 actionLog 快照，回放結果必須 bit-exact。
