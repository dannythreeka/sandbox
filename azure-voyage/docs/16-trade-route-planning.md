# 16 — 貿易路線規劃（M24）

> 回應玩家願望清單第二項的後半段：「貿易路線規劃」（前半段航海士養成見 docs/15）。

## 1. 設計

貿易路線規劃是「市場情報」工具，不是新的遊戲機制——玩家原本就能自己記錄哪個港
賣什麼、去哪賣比較貴，這裡只是把這件事自動化：以目前所在港口為起點，算出「在這
裡買、去哪個港賣」的獲利建議清單。

沿用 docs/01 §1「全港名稱/座標可見」的既有 fog-of-war 設計（地圖本身從 M1 就全
部可見，只有「是否到訪過」有差別）——這裡採一致的簡化：貿易路線建議直接讀取
全部港口目前的市場快照，不要求玩家實際到訪過對方港口。這是一個「大帳房的貿易
情報」而非需要親自跑一趟才能知道的秘密。

## 2. 實作

- `packages/shared/src/rules/tradeRoutes.ts`：純函式 `bestTradeRoutesFrom(origin, candidates, limit)`。
  輸入「起點＋候選港」的市場快照（已算好各港的有效買/賣價），對每個起點有賣的
  商品，找候選港裡賣價更高的，算出 `profitPerUnit`（單位獲利）與 `distance`
  （hex 距離，沿用 `offsetDistance`），依 `score = profitPerUnit / max(1, distance)`
  排序——距離會拉低分數，避免推薦「獲利看似很高但要跑半張地圖」的路線。
- `MarketService.getTradeRouteSuggestions(userId, worldId, portId)`：抓全世界的
  `PortState`（排除 M21 刪除後留下的孤兒港口，見 docs/13 §2），用玩家在各港的
  影響力份額算出每港的有效買/賣價，組成快照丟給 `bestTradeRoutesFrom`。跟
  `getPortDetail` 一樣不套用 PURSER 職位加成（那是實際下單時的折扣，這裡單純是
  市場情報，維持簡化與行為一致）。
- 新 API：`GET /worlds/:worldId/ports/:portId/trade-routes`。
- 前端 `TradeRoutePanel`：停靠中顯示於港內面板，列出建議（商品／本港買價／目的
  港賣價／單位獲利／距離），並附「前往」按鈕——直接重用既有的
  `handleMapTarget({ targetPortId })`（跟點擊海圖港口設航線走同一條路徑），一鍵
  把建議轉成實際航線，而不只是純資訊展示。

## 3. 測試

- `packages/shared`：`tradeRoutes.test.ts`（4 案例：正常建議、排除無利可圖/不重疊
  商品、依「獲利/距離」而非純獲利排序、`limit` 生效）。
- `apps/api`：`market.service.spec.ts` 新增 `MarketService.getTradeRouteSuggestions`
  describe block（正常建議、未知起點港回 NOT_FOUND）。
- `apps/web`：`next build` 通過型別檢查與靜態頁面產生。
