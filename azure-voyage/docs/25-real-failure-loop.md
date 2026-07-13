# 25 — M31：真實失敗循環（破產 DEFEAT 狀態）

> 使用者要求的「真實失敗循環」。深入排查後發現 docs/01 §2 原始設計的失敗
> 條件（「破產：現金 < 0 且無船可賣」「旗艦沉沒且無力再購船」）在現有規則下
> 其實**結構性不可達**——不是漏做判定，而是全系統的金流路徑都刻意設計成
> 不會讓資金變負值，賣船/分艦也都保底至少留一艘船。`WORLD_STATUSES` 雖然
> 定義了 `DEFEAT`，但整個程式碼庫從沒有任何地方真正寫入過這個狀態；前端更
> 只要 `status !== "ACTIVE"` 就顯示「商會稱霸四海！」的勝利畫面，DEFEAT
> 真的發生時反而會顯示錯的訊息。

## 1. 為什麼「現金 < 0」結構性不可達

逐一檢查金流路徑：

- 交易：`market.service.ts` 買入前檢查 `gold < total` 就丟 `INSUFFICIENT_GOLD`。
- 薪資：`officer.service.ts#paySalariesIfDue` 付不起就走忠誠度懲罰，不硬扣。
- 修理：`shipyard.service.ts#repair` 資金不夠就修到哪算哪，不會透支。
- 出港補給：按可負擔比例補，不會透支。
- 海戰贖金：只扣現有資金的固定比例（`DEFEAT_RANSOM_RATIO`），不會透支。
- 賣船／分艦：`CANNOT_SELL_LAST_SHIP`／`CANNOT_SPLIT_ALL_SHIPS` 保底至少留
  一艘船；海戰戰敗的 `forceSurvive` 邏輯保底艦隊不會歸零艘船。

**結論**：現金永遠 ≥0、艦隊永遠 ≥1 艘船，是這個專案從 M2 到 M29 一路刻意維持
的不變量，不是巧合。

## 2. 判定條件：用可達成的絕境對應原始設計精神

不去打破「現金不變負值」這個貫穿全系統的不變量（風險太高、牽動太多既有
邏輯），改用**對應原始設計精神、但實際可達成**的絕境狀態：

> 商會資金 ≤0，且名下全部艦隊合計只剩最後一艘船。

`apps/api/src/modules/defeat/defeat.service.ts`（新模組，比照 `VictoryService`
的結構）：`checkDefeat()` 每 tick 檢查這個條件——

- 條件不成立：若 `bankruptTicks > 0` 就歸零（讓玩家翻本後倒數重置，不是
  「曾經窮過一次就注定完蛋」）。
- 條件成立：`bankruptTicks + 1`；未達 `BANKRUPTCY_GRACE_TICKS`（30）就只是
  累加繼續等；達到才正式把 `GameWorld.status` 設成 `DEFEAT`，廣播
  `world.defeat` domain event。

**30 tick 的寬限期**是這次「真實失敗循環」的核心——不是絕境當下立刻結束，
是給玩家一段真實的窗口去翻本（賣掉貨艙裡的存貨、去做一次發現物登錄、賭一把
短程貿易）。這才是「循環」：陷入絕境 → 看得到倒數 → 有機會掙脫或真的沉沒。

## 3. 玩家看得到倒數，不是無預警結束

`WorldSnapshot` 新增 `bankruptcyWarning: { ticksElapsed, graceTicks } | null`
（`world.service.ts#getSnapshot`，唯讀呈現，判定邏輯仍然只在 `DefeatService`
一個地方）。前端在絕境成立時顯示醒目的紅色警示橫幅：「瀕臨破產！...若持續
N 天沒有翻本，商會將宣告破產」，`N` 即時倒數。

## 4. 修正既有 bug：DEFEAT 畫面被誤標成勝利

`apps/web/src/app/play/[worldId]/page.tsx` 原本的結局畫面邏輯：

```js
const gameEnded = victory !== null || (snapshot ? snapshot.world.status !== "ACTIVE" : false);
```

只要世界不是 ACTIVE 就顯示同一塊寫死的「商會稱霸四海！」——這代表**萬一
DEFEAT 真的發生過，畫面會顯示錯的訊息**（歡慶戰敗）。修正為區分
`isDefeat`／勝利兩種結局，各自對應的原創收尾敘事與樣式（DEFEAT 用紅色邊框，
VICTORY 維持金色）。

## 5. 測試

- `apps/api/src/modules/defeat/defeat.service.spec.ts`（新增，7 則）：資金
  健康／破產但船數足夠／船數見底但資金健康——三種都不觸發；寬限期內累加、
  翻本後歸零；達到寬限期正式判定 DEFEAT 並廣播正確 payload；非 ACTIVE 世界
  不重複判定。
- 真實環境端對端驗證（本機 Postgres + Redis + 真實 API/web server +
  Playwright）：建立世界、直接把商會資金歸零、把 `bankruptTicks` 設到只差
  2 tick 就達標，出港讓真實 tick pipeline 跑起來——確認重整後立刻看到「瀕臨
  破產」警示橫幅（倒數 2 天），約 2 秒後（2 個真實 tick）畫面正確切換成獨立
  的紅色「商會傾覆……第 2 日」結局畫面（而非誤標成勝利），資料庫
  `GameWorld.status` 正確寫入 `DEFEAT`。

既有的 API 全部測試（21 個 suite、170 個測試）、`@azure-voyage/shared` 全部
測試（23 個檔案、168 個測試）、API/web `tsc --noEmit`、`next build` 全數維持
綠燈。
