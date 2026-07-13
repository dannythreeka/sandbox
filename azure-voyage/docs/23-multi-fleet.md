# 23 — M29：多艦隊管理

> 對應使用者需求：「往大航海時代靠近」，接續 M27（提督成長）、M28（主線任務）。
> docs/19 的比較調查點出：UW4 中後期「分艦隊分別跑貿易/探索/戰鬥」是重要的
> 策略深度，現況版本每個世界只會建立一支艦隊，且從未有過建立第二支的方法。

## 0. 為什麼改動範圍可以很小

深入調查後發現**後端幾乎已經是多艦隊就緒的架構**：

- 航行推進（`voyage.service.ts#advanceOneTick`）、海賊遭遇
  （`encounter.service.ts#rollEncounters`）都是 `fleet.findMany({ where: { worldId,
  activity: "SAILING" } })` 這種泛用查詢，本來就會逐一處理**該世界裡所有**在航行
  的玩家艦隊，不是寫死抓第一支。
- 設定航線／出港／下錨／探索／招募／指派職位／造船廠建造／修理／賣船——這些
  動作的 API 早就都吃明確的 `fleetId` 參數（`voyage.service.ts`、
  `market.service.ts`、`officer.service.ts`、`shipyard.service.ts` 皆是）。

真正的缺口只有兩個：**(1)** 從來沒有「建立第二支艦隊」的方法（整個程式碼庫只有
一個 `fleet.create` 呼叫點，在世界建立時）；**(2)** 前端整個假設「艦隊」是單數
（`snapshot.fleets[0]`），沒有切換多支艦隊的 UI。本里程碑就是補上這兩塊。

## 1. 後端：分艦（Split Fleet）

**`apps/api/src/modules/shipyard/shipyard.service.ts`** 新增 `splitFleet()`：
從既有艦隊（必須 DOCKED）勾選部分船隻（可選帶走部分航海士），成立一支停靠在
**同一港口**的新艦隊。

- 補給對半分（無條件捨去），兩支艦隊都不會憑空多出資源；士氣沿用原值。
- 旗艦邏輯：移動的船隻裡若含原旗艦，新艦隊繼承它當旗艦、來源艦隊從留下的船
  裡指定新旗艦；若原旗艦沒被移動，新艦隊的第一艘移動船自動升格為旗艦。兩支
  艦隊事後都恰好有一艘旗艦。
- 防呆：不能把艦隊裡所有的船都分出去（新錯誤碼 `CANNOT_SPLIT_ALL_SHIPS`），
  沿用既有 `sell()` 的「不能賣最後一艘船」同一種防呆精神。
- 路由：`POST /worlds/:worldId/ports/:portId/shipyard/split-fleet`，跟
  build/repair/sell 同一個 controller、同一套 docked-fleet 驗證。

## 2. 副作用修正：主線任務 ch3 的多艦隊正確性

M28 的「海上見真章」（贏得一場海戰）章節原本用 `fleet.findFirst()` 只抓「隨便
一支」艦隊來查勝場——多艦隊上線後這是真的 bug：如果贏球的是第二支艦隊，這個
判定會永遠讀不到。已修正為先撈玩家**所有**艦隊 id，再用
`battle.count({ fleetId: { in: [...] } })` 聚合查詢（`quest.service.ts`）。

## 3. 前端：切換與獨立操作

- **`apps/web/src/game/FleetSwitcher.tsx`**（新增）：只有一支艦隊時不顯示；
  多支時列出每支艦隊的名稱／狀態／所在港口或活動／船數，點擊切換「目前操作
  中」的艦隊。
- **`apps/web/src/app/play/[worldId]/page.tsx`**：新增 `selectedFleetId` 狀態，
  `fleet` 改為「選中的艦隊，找不到則退回第一支」；切換艦隊時清空屬於「上一支
  艦隊」的暫存畫面狀態（`fleetDelta`／`route`／`battleId` 等），避免混淆。
  地圖、貿易、造船廠、酒館等既有面板全部沿用「傳入 `fleet.id`」的既有寫法，
  不需要另外改——只要 `fleet` 這個變數指對艦隊，其餘全部自動正確。
- **`apps/web/src/game/TavernShipyardPanel.tsx`**：造船廠新增「分艦」區塊
  （只有艦隊船數 ≥ 2 才顯示）——船隻與航海士清單各自多一個勾選框，填新艦隊
  名稱後送出。

## 4. 刻意不做的部分（v1 範圍界線）

- **海圖不會同時畫出多支艦隊的船隻**：`SeaMap.tsx` 目前是單一 PIXI 精靈/軌跡
  的渲染模型，只畫「目前選中」的那支艦隊；要同時顯示多艘船需要把單一
  ref 改成以艦隊 id 為 key 的集合，屬於較大的渲染重構，留給之後如果有需要
  再做。
- **入港/事件推播不會自動幫你切換到發生事件的那支艦隊**：`SERVER_ARRIVAL`／
  `SERVER_EVENT` 目前仍是「只認目前選中的艦隊 id」，如果你在操作艦隊 A 時
  艦隊 B 抵港或發生風味事件，畫面不會跳過去通知——下次手動切過去看快照就
  會是正確狀態，只是少了即時提示。`SERVER_BATTLE_START` 例外：不論哪支艦隊
  遭遇海賊，戰鬥畫面都會照常彈出（只是不會連帶把 `selectedFleetId` 切過去），
  所以海戰本身不會被錯過，只是事後畫面焦點還停在原本選的艦隊上。
- 沒有做「解散艦隊／合併回單一艦隊」——賣船本來就不能賣到 0 艘
  （`CANNOT_SELL_LAST_SHIP`），分艦也不能分到 0 艘，所以目前不會出現「空艦隊」
  這種需要清理的邊界情況；真的要精簡回單一艦隊，之後可以再開一個對稱的
  「併艦」端點。

## 5. 測試

- `apps/api/src/modules/shipyard/shipyard.service.spec.ts` 新增 7 則：分艦成功
  建立新艦隊並正確搬運船隻／補給對半分／兩種旗艦繼承情境／搬運航海士／禁止
  分光所有船／未知船隻 id 報錯。
- `apps/api/src/modules/quest/quest.service.spec.ts` 新增 1 則：驗證 ch3 的勝場
  判定會正確聚合玩家名下**所有**艦隊，不會漏掉非第一支艦隊的勝場。
- 真實環境端對端驗證（本機 Postgres + Redis + 真實 API/web server +
  Playwright）：建立世界、造第二艘船、勾選分艦、確認艦隊切換列正確顯示兩支
  艦隊；切到第二艦隊、用鍵盤操舵設定航向並出港；切回第一艦隊，確認它完全
  不受影響、仍停靠在原港口——證明兩支艦隊確實各自獨立運作。

既有的 API 全部測試（20 個 suite、163 個測試）、`@azure-voyage/shared` 全部
測試（23 個檔案、168 個測試）、API/web `tsc --noEmit`、`next build` 全數維持
綠燈。
