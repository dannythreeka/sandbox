# 21 — M27：艦長／提督個人成長系統

> 對應使用者需求：「往大航海時代靠近」。docs/19（比較調查）點出現況與大航海時代4
> 最大的結構性落差之一——玩家在遊戲裡只是幕後的商會經營者，沒有「自己」這個角色，
> 所有五維成長都掛在雇來的官員身上。本里程碑補上玩家角色本人的 RPG 化成長。

## 1. 設計

**核心概念**：玩家的 `Guild`（商會）現在多帶一組「提督」狀態——統率／航海／戰鬥／
商才／學識五維＋經驗值，跟官員（`Officer`）的成長曲線對稱但完全獨立累計。提督
不佔用職位槽，效果是**永遠生效的艦隊全域小幅加成**，與對應職位的官員加成疊加
（不互斥）：

| 提督屬性 | 效果 | 對應職位加成 |
|---|---|---|
| 航海 | 艦隊航速加成 | 航海長（NAVIGATOR） |
| 戰鬥 | 海戰砲擊傷害加成 | 炮術長（GUNNER） |
| 商才 | 買賣折扣加成 | 會計長（PURSER） |
| 學識 | 降低風暴／海賊遭遇機率 | 瞭望員（LOOKOUT） |
| 統率 | 緩解欠薪對官員忠誠度的衝擊 | 副官（FIRST_MATE） |

起始值統一 20（`BALANCE.CAPTAIN_STARTING_STAT`），每滿 `CAPTAIN_EXP_PER_LEVEL`
(200) 升一級，升級時五維各 +1（上限 100，公式對稱 `officerGrowth.ts`）。經驗來源：
航行抵港、完成交易、海戰獲勝、登錄發現物——分別對應官員成長的四個既有觸發點，
提督與艦隊官員同時獲得經驗（各自累計，互不影響）。

**稱號**（純風味，`captainTitles.ts`）：依等級解鎖，見習船長 → 自由船長 → 商隊
領航員 → 海道先驅 → 七海提督 → 蒼瀾傳說，顯示在遊戲頁首與提督面板。

## 2. 實作

- **Schema**：`Guild` 新增 `captainExp`/`captainLead`/`captainNav`/`captainCombat`/
  `captainTrade`/`captainLore`（新遷移 `20260713124924_captain_progression`）。
  NPC／在地勢力商會不使用這組欄位，維持預設值即可（不影響其邏輯）。
- **`packages/shared/src/rules/captainGrowth.ts`**：`applyCaptainExpGain`（成長曲線）
  ＋五個加成係數函式，公式與 `officerGrowth.ts` 對稱。
- **`packages/shared/src/content/captainTitles.ts`**：等級門檻 → 稱號對照表。
- **`apps/api/src/modules/officer/captain-growth.util.ts`**：`awardCaptainExp()`，
  與既有 `awardExpToFleetOfficers()` 對稱，供各服務共用。
- **加成疊加點**（提督加成與對應職位加成用加法疊加，各自維持原本上限）：
  - `voyage.service.ts`：`advanceOneTick` 的 `navBonus` 疊加 `captainNavSpeedBonus`；
    抵港時額外呼叫 `awardCaptainExp(..., CAPTAIN_EXP_PER_ARRIVAL)`。
  - `encounter.service.ts`：遭遇機率的 `dangerReduction`、開戰時的
    `damageBonusPct` 都疊加提督學識／戰鬥加成。
  - `battle.service.ts`：`resolveBattleEnd` 的 `PLAYER_WIN` 分支額外呼叫
    `awardCaptainExp(..., CAPTAIN_EXP_PER_BATTLE_WIN)`。
  - `market.service.ts`：`purserBonus` 疊加 `captainTradeBonus`；成交後額外呼叫
    `awardCaptainExp(..., CAPTAIN_EXP_PER_TRADE)`。
  - `discovery.service.ts`：`registerDiscovery` 額外呼叫
    `awardCaptainExp(..., CAPTAIN_EXP_PER_DISCOVERY)`。
  - `officer.service.ts`：`paySalariesIfDue` 的欠薪忠誠度懲罰疊加
    `captainLoyaltyMitigation`。
- **`WorldSnapshotSchema`**：`playerGuild` 新增 `captain: CaptainViewSchema`
  （exp／level／title／五維），由 `world.service.ts#getSnapshot` 組裝。
- **前端**：`apps/web/src/game/CaptainPanel.tsx`（新增）——顯示稱號、等級、經驗
  進度條、五維與各自的效果說明；遊戲頁首把商會名稱旁的稱號做成可點擊按鈕開啟
  這個面板（`apps/web/src/app/play/[worldId]/page.tsx`）。

## 3. 測試

- `packages/shared/src/rules/captainGrowth.test.ts`（新增，11 則）：成長曲線、
  五個加成係數函式的邊界與上限、稱號門檻。
- `apps/api/src/modules/battle/battle.service.spec.ts`：既有 PLAYER_WIN 測試延伸
  驗證不影響；guild mock 補上 captain 預設欄位。
- 既有 `voyage.service.spec.ts`／`encounter.service.spec.ts`／
  `market.service.spec.ts`／`discovery.service.spec.ts`／`officer.service.spec.ts`／
  `world.service.spec.ts` 的 mock 補上 captain 預設欄位；三則原本斷言精確金額／
  忠誠度扣減數值的測試（market 的 BUY/SELL 單價、officer 的欠薪懲罰）更新為把
  提督預設加成一併算入的期望值。
- 真實環境端對端驗證（本機 Postgres + Redis + 真實 API/web server + Playwright）：
  註冊帳號、建立世界，開啟提督面板確認顯示「見習船長」「等級 0」與五維初始值
  20；實際在 UI 上執行一筆交易，確認 DB 內 `Guild.captainExp` 從 0 增加到 6
  （`CAPTAIN_EXP_PER_TRADE`）。

既有的 API 全部測試（19 個 suite、147 個測試）、`@azure-voyage/shared` 全部測試
（23 個檔案、168 個測試）、API/web `tsc --noEmit`、`next build` 全數維持綠燈。

## 4. 後續方向（未做，留給下一里程碑）

docs/19 同時點出的另外兩大落差——**多艦隊管理**與**主線劇情/章節任務**——
不在本次範圍內，是否接續施作待使用者確認。
