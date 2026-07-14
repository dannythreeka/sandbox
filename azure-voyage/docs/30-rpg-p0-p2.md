# 30 — Azure Voyage RPG：P0 引擎骨架 + P1 垂直切片 + P2 主線第一部

> 實作 `docs/29` 路線圖的前三個階段。不是設計提案——這是真正可玩、可測試
> 的程式碼：新增 `packages/rpg-engine`（純框架）、`packages/rpg-content`
> （蒼瀾世界的內容包）、`apps/rpg`（最小可玩前端）。不改動既有沙盒經營版
> （`apps/web`/`apps/api`），兩款遊戲並存，共用同一個世界觀。

## 1. P0：`packages/rpg-engine`（純框架，無內容）

依 `docs/29` §2–§13 落地：

- `types.ts`：`Condition`/`Effect` 統一語言、三層世界架構
  （`WorldRegion`/`Area`/`Scene`/`Hotspot`）、事件節點型別（`Dialogue`/
  `Choice`/`SkillCheck`/`Effect`/`Goto`）、`WorldState`、`SaveState`。
- `condition.ts` / `effect.ts`：條件求值與後果套用。**踩到一個真實 bug**：
  `WorldState` 的 `guildOrder`/`regionCorruption` 是 `Record<string,
  number>`，鍵本身就含有點（例如 `"npc.crimson_sails"`）；原本用
  `path.split(".")` 遞迴逐層取值，會把這種鍵誤拆成好幾段。改成「只在第一個
  點切一刀」的兩層 `splitPath`（欄位名 + 選填的 record 鍵），鍵裡的點不再
  被誤判為巢狀路徑。
- `engine.ts`：`RpgEngine` 類別——`interact`/`continue`/`choose` 三個入口
  推進事件節點，`getSceneView`/`getAreaView`/`getWorldMapView` 供 UI 讀取，
  `travelTo`/`isSceneOpen` 處理場景時段閘門，`advanceTime` 供玩家主動等待。
  **另一個真實 bug**：事件池加權隨機選取時，`weight: 0`（設計上「只能被
  `startEvent()` 直接觸發，不進隨機池」的稀有事件）在候選只剩它自己時，
  因為 `totalWeight === 0` 導致演算法必然選中它。修成候選階段直接濾掉
  `weight <= 0` 的事件。
- `validate.ts`：建置期內容檢查——所有 id 引用完整、事件節點無孤島。

**22 個單元測試**（`condition.test.ts`/`effect.test.ts`/`engine.test.ts`），
含上述兩個 bug 的回歸測試、時段閘門、完整事件播放（dialogue→choice→
effect→dialogue→end）、once/cooldown/weight 過濾、技能判定的確定性驗證
（注入 `rng`）。

## 2. P1+P2：`packages/rpg-content`（垂直切片內容）

對映小說（`docs/28`）第一部第一～四章、第六章，全部原創文字，重寫成事件
宣告：

- **奧雷利亞 3 場景**：港務廳（`DAWN/DAY/DUSK` 開）、錨與星酒館
  （`DUSK/NIGHT` 開）、中央市場（`DAWN/DAY` 開）——示範 `docs/29` 設計的
  「白天皇宮、夜晚黑市」時段閘門模式。
- **佩爾蘭 1 場景**：碼頭（老漁夫圖克），解鎖條件是 `flag.crew_assembled`
  （呼應小說第四章的敘事順序——組好班底、站穩腳跟後才順道繞去補鹽）。
- **9 個事件**：開場（掛名入行）、公告欄傳聞（repeatable flavor）、招募
  布拉姆／賽菈（各一個 `lead`/`trade` 技能判定，失敗不是拒絕、只是換一種
  說服過程——`docs/29` 強調的「判定即敘事」）、酒館流言（repeatable
  flavor）、第一筆交易（`trade` 判定）、緋帆團初現（`combat`/`nav`
  二選一判定，兩條路都推進劇情，勝負只影響過場文字，統一觸發
  `crimsonThreat +10` 並解鎖佩爾蘭）、佩爾蘭支線兩段（答應/拒絕分支，
  拒絕會讓後續事件永久不可達——玩家的選擇是真的有後果）。
- **4 個任務宣告**（`quests.ts`）：主線 ch1–ch3 對應現有沙盒版 M28 的前三章
  目標語意，支線「老漁夫的家傳鹽田」。目標判定沿用 M28 QuestService「用
  既有可查詢狀態」的哲學，全部讀事件留下的 flag，任務獎勵已經在完成任務的
  事件 effect 節點直接發放，`quests.ts` 的 `rewards` 欄位純粹是任務面板的
  文案來源，引擎不會自動套用它，避免重複發放。
- `createStartState()`：新遊戲存檔工廠——起始港口（奧雷利亞）的全部場景
  一開始就看得到（沒有港內迷霧），佩爾蘭則要等事件解鎖。

**4 個測試**：內容包無孤島引用、任務目標條件語法正確、**完整主線＋支線
一輪遊玩**（開場→招募雙人→第一筆交易→緋帆團初現→解鎖佩爾蘭→答應/拒絕
兩種支線分支），確定性 rng 注入驗證每一步的 flag/affinity/worldState/
unlocked 變化。

## 3. P1：`apps/rpg`（最小可玩前端）

獨立 Next.js app（`transpilePackages` 指向兩個新 package，不需要後端，
純前端 + `localStorage` 存檔——`docs/29` §13.2 存檔模型本身就是純資料
（陣列/物件/純值），可以直接 `JSON.stringify`）。

- `GameClient.tsx`：單頁遊戲殼——世界地圖層（已解鎖港口，超過 1 個才顯示）
  → 港口場景切換（依 `isSceneOpen` 灰階不可點）→ 熱點互動 → 事件面板
  （dialogue/choice/checkResult 三種節點的渲染）→ 航海日誌（任務清單，
  即時用 `evaluateCondition` 算完成狀態，不需要額外的「任務進度」欄位）。
- `page.tsx` 用 `next/dynamic` + `ssr: false` 掛載 `GameClient`——存檔內容
  依裝置而異，避免伺服器渲染的初始 HTML 跟客戶端 hydrate 後的內容對不上。
- `save.ts`：`localStorage` 讀寫，`SaveState` 全由純資料構成，不需要自訂
  序列化。

## 4. 端對端驗證

本機啟動 `apps/rpg`（`next dev -p 3100`，純前端、不需要 Postgres/Redis），
Playwright 完整跑一輪：

1. 開場港務廳（選擇回應台詞）→ 確認 `flag.game_started`、時鐘推進。
2. 等到黃昏、進入酒館，依序招募布拉姆／賽菈（技能判定隨機成功/勉強成功
   兩種過場都有覆蓋）→ 確認航海日誌「組建班底」打勾。
3. 等到隔天白晝、進入市場，完成第一筆交易 → 市場自己的 `advanceTime`
   效果把場景推進到休息時段，驗證「完成事件當下把自己所在的場景關門」
   這個邊界情況會正確反映在 UI（熱點消失、顯示「休息中」）。
4. 緋帆團初現事件（碼頭瞭望，正面周旋分支）→ 確認 `crimsonThreat` 累加、
   世界地圖層新增佩爾蘭、`getWorldMapView` 能切換港口。
5. 佩爾蘭老漁夫圖克：答應幫忙 → 再訪完成支線，確認道具 `item.perlan_salt`
   進背包、`area.perlan` 聲望 +10。
6. 航海日誌四項任務（主線三章 + 支線）全數打勾，畫面截圖確認。

過程中修正一個真實的前端設計缺口：**最初完全沒有「切換港口」的 UI**——
只做了同一港口內的場景切換，佩爾蘭解鎖後玩家其實無路可去。補上世界地圖層
（列出 `state.unlocked.areas`，點擊進入該港口的第一個場景）後才打通。

## 5. 測試/建置總結

- `@azure-voyage/rpg-engine`：22 測試全綠。
- `@azure-voyage/rpg-content`：4 測試全綠。
- `@azure-voyage/rpg`：`tsc --noEmit`、`next build` 全綠。
- 新增三個套件的 ESLint 全綠（`eslint.config.mjs` 補上
  `apps/rpg/next-env.d.ts` 忽略規則，比照 `apps/web` 既有寫法）。
- 既有 `@azure-voyage/api`／`@azure-voyage/web` 的 `tsc --noEmit` 確認不受
  影響（本次改動完全沒有碰沙盒經營版的程式碼）。

## 6. 下一步（P3–P5，見 docs/29 §14）

P3 開放鐵崖／絹風／子午海域與更多支線，P4 接上柯爾/賽菈斐娜/奧丁三條真結局
支線與四種結局分支文字（可直接引用 `docs/28` 小說正文），P5 打磨立繪/音效/
存檔雲端化。
