# 18 — 原創敘事文字：海域與港口簡介、世界開篇（M26）

> 回應玩家願望清單第四項：「參考系列的節奏設計歷史氛圍的敘事文字（原創撰寫，
> 不是抄錄）」。

## 1. 缺口

到 M25 為止，「原創敘事文字」其實已經散布在遊戲各處——發現物圖鑑（M22）、港口
人物人設（M25）、NPC 商會/航海士人設（M8/M19）、對話（M20）——但兩個最基本的
地理實體，7 大海域與 15 個港口，反而完全沒有任何簡介文字，玩家看到的只有名稱
和數值。這是最後也是最明顯的一塊空白。

## 2. 實作

- `packages/shared/src/content/regions.ts`：`RegionDef` 新增 `description`
  欄位，7 段原創簡介，扣著各海域的危險度/特產設定寫（北環海苦寒多琥珀、
  琥珀灣是文明中心、鐵崖海岸礦脈密布、絹風海峽是關稅重鎮、子午之海海賊活躍、
  珊瑚環弧珍珠與潛水人、暮色洋是外洋邊界）。
- `packages/shared/src/content/ports.ts`：`PortDef` 新增 `description` 欄位，
  15 段原創簡介，仿系列作品「港町簡介」的節奏——每段扣著港口的規模、特產、
  在地角色寫，讀起來像地方誌條目而非數值說明。
- `packages/shared/src/rules/narrative.ts`（新）：`openingNarrativeFor(seed)`，
  5 段原創的「世界開篇」文字（新科船長離港啟航的場景），依世界 seed 決定性
  選一段——同一個世界每次算出來的開篇都一樣，不同世界看到的不同。
- `PortDetailSchema` 新增 `description`；`MarketService.getPortDetail()` 回傳
  時帶上（沿用既有的 `portByIdOrFallback` 解析邏輯，已刪除的舊港口 id 一樣會
  拿到替代港口的簡介）。
- 前端：
  - `TradePanel` 在市場標題下方顯示港口簡介。
  - 頂列的海域名稱加上 `title` 提示（hover 顯示海域簡介），不佔版面。
  - 新世界第一次載入（`currentTick <= 1`）且這台裝置沒關過這個世界的開篇時，
    顯示一段開篇敘事橫幅，附「啟航」按鈕關閉——用 `localStorage`（key 含
    worldId）記錄關閉狀態，仿既有的過場動畫略過機制（M13），不會在玩到一半的
    存檔上突然跳出來。

已在本機 PostgreSQL 16 + Redis 上驗證：建立新世界 → 查詢港口詳情，確認
`description` 正確帶出、世界快照的 `seed`/`currentTick` 可供前端算開篇文字。

## 3. 測試

- `packages/shared`：`narrative.test.ts`（3 案例：同 seed 決定性、跨 seed 有
  變化、輸出非空原創文字）；既有的 `regions.test.ts`／`discoveries.test.ts`
  等內容驗證測試維持綠燈（新增欄位不影響既有斷言）。
- `apps/api`：既有 `market.service.spec.ts` 全數維持綠燈（`description` 是
  新增欄位，`toMatchObject` 斷言不受影響）。
- 端對端：見上方「已在本機 PostgreSQL 16 + Redis 上驗證」。
