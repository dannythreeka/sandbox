# 15 — 航海士養成深化（M23）

> 回應玩家願望清單第二項：「更深的航海士養成、貿易路線規劃」。本文件涵蓋前半段
> （養成／職位效果）；貿易路線規劃另開 M24。

## 1. 根本原因：兩個從 M1/M4 就存在、卻從未接上的欄位

- `Officer.exp`（Prisma schema）：從第一個里程碑就有這個欄位，但整個程式碼庫沒有
  任何地方寫入或讀出它——docs/01 §4.5「參與航行/戰鬥/交易獲得經驗，屬性緩慢成長」
  這段規劃從未真正實作。
- 職位槽（`FIRST_MATE`/`GUNNER`/`PURSER`/`LOOKOUT`）：五個職位裡，只有
  `NAVIGATOR`（航海長）真的有效果（`movement.ts` 的航速加成）。其餘四個職位純粹
  是資料庫裡的一個字串，指派了也沒有任何遊戲效果——docs/01 §4.5「職位把對應屬性/
  技能轉為艦隊 buff」同樣只完成了五分之一。

M23 把這兩塊都接上。

## 2. 經驗成長

`packages/shared/src/rules/officerGrowth.ts`：

- `officerLevel(exp)`：每滿 `BALANCE.OFFICER_EXP_PER_LEVEL`（150）exp 升一級，
  純函式、由 exp 直接推算，不額外存一個 `level` 欄位。
- `applyExpGain(currentExp, gain, currentStats)`：算出新 exp，跨過門檻時全體屬性
  `+1`（上限 100），一次可能連跳多級。

`apps/api/src/modules/officer/officer-growth.util.ts` 的 `awardExpToFleetOfficers`
供三個服務共用（艦隊全員一起成長，不特別挑「誰在船上出力最多」，維持簡單）：

| 觸發時機 | 呼叫點 | 經驗值 |
|---------|--------|--------|
| 完成一筆貿易 | `MarketService.trade()` | `OFFICER_EXP_PER_TRADE`（8） |
| 航行抵達港口 | `VoyageService.advanceOneTick()` | `OFFICER_EXP_PER_ARRIVAL`（5） |
| 海戰獲勝 | `BattleService.resolveBattleEnd()` | `OFFICER_EXP_PER_BATTLE_WIN`（25） |

前端 `TavernShipyardPanel` 在艦隊航海士列表顯示 `Lv.X`（`officerLevel(o.exp)`）。

## 3. 職位效果（艦隊 buff）

新增係數函式（`officerGrowth.ts`），公式都是「屬性 × 係數，夾限上限」：

| 職位 | 屬性 | 效果 | 上限 | 接入點 |
|------|------|------|------|--------|
| 副官 FIRST_MATE | 統率 lead | 欠薪忠誠度懲罰減免 | 60% | `OfficerService.paySalariesIfDue()` |
| 炮術長 GUNNER | 戰鬥 combat | 砲擊傷害加成 | 30% | `battle.ts` FIRE 動作、`EncounterService` 建立戰鬥單位時 |
| 會計長 PURSER | 商才 trade | 買賣折扣加成（與影響力折扣疊加） | 6% | `pricing.ts effectiveBuyPrice/effectiveSellPrice`、`MarketService.trade()` |
| 瞭望員 LOOKOUT | 學識 lore | 風暴／海賊遭遇機率降低 | 40% | `EventService.rollStorms()`、`EncounterService.rollEncounters()` |
| 航海長 NAVIGATOR | 航海 nav | 艦隊航速加成（M4 既有） | — | `movement.ts`（不動） |

沒有指派對應職位時，加成一律是 0——五個職位槽現在都「有存在的理由」，不再只是
擺設。

## 4. 測試

- `packages/shared`：新增 `officerGrowth.test.ts`（9 案例，涵蓋升級門檻、多級跳升、
  屬性上限、四個職位係數函式的邊界行為）；`battle.test.ts` 新增 GUNNER 傷害加成
  對照組測試。
- `apps/api`：`market.service.spec.ts`（PURSER 折扣 + 交易後航海士獲得 exp）、
  `battle.service.spec.ts`（勝利後獲得 exp）、`voyage.service.spec.ts`（抵達港口
  獲得 exp）、`officer.service.spec.ts`（FIRST_MATE 減免欠薪懲罰）、
  `encounter.service.spec.ts`（GUNNER 傷害加成套用到戰鬥單位、LOOKOUT 降低遭遇
  觸發率的統計對照）、`event.service.spec.ts`（LOOKOUT 降低風暴觸發率的統計對照）
  全數新增或更新，維持綠燈。

## 5. 待辦（下一個里程碑）

貿易路線規劃（多港口比價、建議航線）另開 M24，不在本次範圍內。
