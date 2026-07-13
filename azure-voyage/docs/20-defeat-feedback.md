# 20 — 戰敗回饋改善（對應 bug 回報：離開遊戲後回到起始城市）

> 對應真實回報：「不管我到哪一個城市，跳出遊戲在進入遊戲之後，都會出現在初始城市
> 裡面」。深入排查後，這不是資料錯亂／存檔重置 bug，而是刻意設計的戰敗懲罰機制
> （`battle.service.ts` 打輸海戰會被拖回母港＋扣贖金）回饋做得不夠明確所致。

## 0. 根本原因

`BattleService.resolveBattleEnd()` 在 `PLAYER_LOSE` 時本來就會把艦隊強制傳送回
`HOME_PORT_ID` 並扣一筆贖金——這是設計好的懲罰，不管玩家本來要航向哪個城市，
打輸了都會被送回起始港口，跟目的地無關，完全符合回報描述的症狀。

問題出在回饋管道：這件事發生時，前端只丟一個一閃即逝的 `notice` 小通知
（「艦隊戰敗，被拖回母港療傷……」），非常容易被忽略，尤其是切分頁、視窗不在
前景，或是疊加上 docs/19 那個「海戰凍結」bug（修復前玩家常常根本看不到海戰在
進行）——等於完全沒感覺到自己「正在打」也不知道「打輸了」，直接跳到下次打開
遊戲才發現艦隊已經在起始城市，感覺像無緣無故被重置。

## 1. 修復設計

**`packages/shared/src/schemas/battle.ts`**：

- `ServerBattleEndSchema` 新增 `ransom: z.number().int().optional()`——只有
  `PLAYER_LOSE` 會帶這個值，供前端過場畫面顯示扣了多少贖金。

**`apps/api/src/modules/battle/battle.service.ts`**：

- `resolveBattleEnd()` 回傳值從 `void` 改成 `number | undefined`：`PLAYER_LOSE`
  時回傳實際扣除的贖金金額，`PLAYER_WIN`／`FLED` 回傳 `undefined`。
- `applyAction()` 把這個回傳值一併放進 `BATTLE_END` 事件的 payload。

**前端（`apps/web/src/game/PortCutscene.tsx` / `apps/web/src/app/play/[worldId]/page.tsx`）**：

- `CutsceneState` 新增 `kind: "defeat"` 與 `ransom?: number`。
- `PortCutscene` 新增戰敗過場的顯示：紅色標題、「戰敗，艦隊被拖回母港療傷」、
  贖金金額（若 >0），停留時間拉長到 3.5 秒（`DEFEAT_MS`），比抵港過場（2 秒）
  久，讓玩家有足夠時間看清楚發生了什麼事。
- `BATTLE_END` 事件處理：`PLAYER_LOSE` 時不再只丟 `notice`，改成跟抵港一樣
  明確、不可略過的全螢幕過場畫面（**不**受「不再顯示這個動畫」設定影響——
  這是會改變艦隊位置與資金的重要狀態變化，不是單純的氣氛動畫，不應該被
  略過）；`PLAYER_WIN`／`FLED` 維持原本的 `notice` 小通知。

## 2. 不動的部分

- 戰敗懲罰機制本身（拖回母港＋扣贖金比例 `DEFEAT_RANSOM_RATIO`）不變——這次
  只修回饋是否清楚，不是覺得懲罰機制設計錯誤。
- docs/19 的海戰重新連線修復不變；兩者疊加後，玩家現在無論是「正在打」還是
  「錯過推播後重新連線接回戰鬥」，都能清楚看到戰鬥發生與結果。

## 3. 測試

- `apps/api/src/modules/battle/battle.service.spec.ts` 新增：建構「玩家血量僅剩
  1、敵方血量健康」的確定性情境（玩家 MOVE 不回血，敵方 AI 血量健康時必定
  `FIRE`、傷害保底至少 1 點），驗證 `PLAYER_LOSE` 時：狀態正確、商會資金確實
  減少、艦隊確實被送回 `HOME_PORT_ID`、`BATTLE_END` 事件的 payload 帶有正確的
  `ransom` 金額。
- 真實環境端對端驗證（本機 Postgres + Redis + 真實 API/web server +
  Playwright）：註冊帳號、建立世界、在 DB 插入一場玩家血量僅剩 1 的
  `ONGOING` 海戰（帶 `fleetId`，重現「錯過即時推播」情境）、重新整理接回
  戰鬥畫面、在畫面上實際點擊「移動」→ 填入座標 →「執行」送出真實的
  `BATTLE_ACTION`，確認：
  - 敵方自動開火擊沉玩家船，戰鬥正確判定 `PLAYER_LOSE`；
  - 前端顯示紅色戰敗過場畫面：「奧雷利亞」「第 0 日 戰敗，艦隊被拖回母港
    療傷」「商會支付了 1,000 金幣贖金，船隻已就地搶修完畢」；
  - 過場結束後，資料庫確認艦隊 `dockedPortId` 為母港、`activity=DOCKED`，
    商會資金從 10,000 正確扣至 9,000。

既有的 API 全部測試（19 個 suite、147 個測試，含本次新增的 1 則）、
`@azure-voyage/shared` 全部測試（22 個檔案、157 個測試）、API/web
`tsc --noEmit`、`next build` 全數維持綠燈。
