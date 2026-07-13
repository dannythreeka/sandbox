# 19 — 海戰卡住無法動彈的修復（production bug）

> 對應真實回報：「遇到海賊之後，都會bug無法動彈」。玩家的艦隊其實正卡在一場
> `ONGOING` 的海戰裡（`activity=IN_BATTLE`），但畫面顯示的是完全正常的海圖，
> 沒有任何戰鬥 UI，也點不到任何能繼續遊戲的按鈕。

## 0. 根本原因

戰鬥畫面（`battleId` / `battleState`）在前端只有一個來源：即時 WS 事件
`SERVER_BATTLE_START`。玩家一旦錯過那一次推播——重新整理分頁、斷線重連、切分頁
背景太久、手機瀏覽器把分頁凍結——就再也沒有任何機制能把戰鬥畫面接回來。

而 `VoyageService` 的 `NON_ROUTABLE_ACTIVITIES = new Set(["IN_BATTLE", "EXPLORING"])`
在 `activity=IN_BATTLE` 時會擋掉所有設定航線／操舵的請求，於是玩家會卡在一個
「看起來很正常但什麼都做不了」的海圖畫面，且沒有任何錯誤訊息或提示。

深一層看，`Battle` model 原本也沒有 `fleetId` 欄位，就算想在重新連線時主動查
「我的艦隊是不是還在一場進行中的海戰裡」也做不到。

## 1. 修復設計

**`apps/api/prisma/schema.prisma` / 新遷移 `20260713094836_battle_fleet_id`**：

- `Battle` 新增 `fleetId String?`（nullable：舊資料或系統戰鬥可能沒有）與索引
  `@@index([worldId, fleetId, status])`，讓「這個世界裡，這支艦隊，是否有一場
  `ONGOING` 的戰鬥」變成一個可以直接查的問題。

**`apps/api/src/modules/battle/encounter.service.ts`**：

- 建立 `Battle` 時多帶入 `fleetId: fleet.id`。

**`packages/shared/src/schemas/world.ts`**：

- `FleetViewSchema` 新增 `activeBattleId: z.string().nullable()`。

**`apps/api/src/modules/world/world.service.ts`（`getSnapshot()`）**：

- 額外查一次「這個世界裡，屬於目前這些艦隊、狀態是 `ONGOING` 的 `Battle`」，
  組成 `fleetId → battleId` 的 map，塞進每個 `FleetView.activeBattleId`。

**前端（`apps/web/src/app/play/[worldId]/page.tsx` / `apps/web/src/lib/api.ts`）**：

- 新增 `api.getBattle(worldId, battleId)`。
- 新增一個 `useEffect`：每次收到快照，若 `snapshot.fleets[0].activeBattleId`
  有值、而本地 `battleId` 還是空的，就主動打 `getBattle` 把戰鬥畫面接回來
  （設定 `battleId` / `battleState`）。這樣不管玩家是重新整理、重新連線、還是
  剛好在推播那一刻沒連上，只要艦隊實際上還在戰鬥中，畫面一定會顯示戰鬥 UI。

## 2. 不動的部分

- 戰鬥本身的回合制邏輯（`BattleService`）、`SERVER_BATTLE_START` 即時推播本身
  都不變——這次修的是「錯過推播之後要怎麼補回來」，不是戰鬥系統本身。
- `NON_ROUTABLE_ACTIVITIES` 擋航線設定的邏輯不變：戰鬥中本來就不該讓艦隊亂跑，
  正確行為是把戰鬥畫面接回來、而不是放行航線指令。

## 3. 測試

- `apps/api/src/modules/world/world.service.spec.ts` 新增兩則：艦隊有進行中戰鬥
  時 `activeBattleId` 正確帶出、沒有時維持 `null`。
- `apps/api/src/modules/battle/encounter.service.spec.ts`：既有「觸發海戰」測試
  補上 `battleData.fleetId` 斷言，確保新戰鬥一定會記下艦隊 id。
- 真實環境端對端驗證（本機 Postgres + Redis + 真實 API/web server + Playwright）：
  直接在 DB 插入一筆 `ONGOING` 且帶 `fleetId` 的 `Battle`、把艦隊 `activity` 設成
  `IN_BATTLE`（模擬「從沒收到過那次即時推播」），重新整理分頁後畫面正確顯示
  「海戰進行中」與完整戰鬥操作按鈕（移動／砲擊／接舷／搶修／逃跑），修復前
  同樣的操作只會看到正常但無法動彈的海圖。

既有的 API 全部測試（19 個 suite、146 個測試）、`@azure-voyage/shared` 全部測試
（22 個檔案、157 個測試，含更新 `schemas.test.ts` 的快照 fixture 補上
`activeBattleId: null`）、API/web `tsc --noEmit`、`next build` 全數維持綠燈。
