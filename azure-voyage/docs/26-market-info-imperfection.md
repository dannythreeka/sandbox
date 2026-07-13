# 26 — M32：市場情報不完全（港口情報時效性）

> 使用者要求的第三項里程碑「市場情報不完全」。排查後發現貿易路線建議
> （`getTradeRouteSuggestions`，M24）其實是全知的——不論商會有沒有實際去過
> 某港口，一律讀那個港口「當下」的即時市場真相。這代表玩家一開局就能看到
> 全地圖 15 港的最佳套利路線，完全不需要真的出海打探，跟「不完全情報」的
> 貿易遊戲精神背道而馳。

## 1. 設計：起點港即時，其餘港口只認「上次抵達當下」的舊情報

不去動 `getPortDetail`（玩家人正站在這個港口，看到即時市場天經地義），只改
`getTradeRouteSuggestions`：

- **起點港**（玩家目前停靠的港口）：照舊讀 `PortState` 即時真相。
- **其餘候選港**：改讀新增的 `PortIntel` 表——商會對某港口「已知的市場情報」，
  只在艦隊**實際抵達當下**寫入一次快照（`voyage.service.ts#advanceOneTick`
  的 `arrivedPort` 分支），之後就是固定不變的舊資料，直到下次真的再訪。
  **從沒去過的港口沒有 `PortIntel` 資料列，直接不列入候選**——不是「顯示
  舊情報」，是「根本不知道」。

停靠期間時間不會前進（docs/01 §核心循環），所以「抵達當下」snapshot 一次即
代表這次停靠所知道的全部，不需要在停靠期間持續更新。

```prisma
model PortIntel {
  id              String    @id @default(cuid())
  worldId         String
  world           GameWorld @relation(fields: [worldId], references: [id], onDelete: Cascade)
  portId          String
  lastVisitedTick Int
  market          Json // [{commodityId, buyPrice, sellPrice}]（抵達當下算好的有效買賣價）

  @@unique([worldId, portId])
  @@index([worldId])
}
```

`bestTradeRoutesFrom`（`packages/shared/src/rules/tradeRoutes.ts`）新增
`PortMarketSnapshot#intelAgeTicks`／`TradeRouteSuggestion#sellIntelAgeTicks`：
起點港 `undefined`＝即時，候選港的值＝`目前 tick - lastVisitedTick`，讓前端
能標示情報時效。

新世界的家鄉港在建檔當下（`world.service.ts#persistNewWorld`）就先種一筆
`PortIntel`（`lastVisitedTick: 0`）——否則新玩家一開局連自己家港的貿易建議
都會被判定成「從沒去過」。

## 2. 順便修正的既有問題：`visited` 只反映「當下正停靠」

`WorldSnapshot.knownPorts[].visited`（M1 起的欄位）原本只用
`fleet.dockedPortId` 判斷「現在停在這裡」，離港之後這個港口的 `visited` 就
變回 `false`，不是真正的「歷史造訪紀錄」。既然這次已經在追蹤
「商會對某港口是否有情報」，`world.service.ts#getSnapshot` 順便改用
`PortIntel` 是否存在來判定 `visited`（保留「目前正停靠」作為 OR 條件，
防呆）。

## 3. 測試

- `packages/shared` `tradeRoutes.test.ts`：既有 4 個測試全數維持通過（新欄位
  是可選的，不影響既有介面）。
- `apps/api` `market.service.spec.ts`：改寫 `getTradeRouteSuggestions` 的
  mock 為「起點港走 `portState.findUnique`、候選港走 `portIntel.findMany`」，
  新增「從沒去過的港口不列入候選」測試。
- `voyage.service.spec.ts`：mock 補上 `portState.findUnique` / `portIntel.upsert`
  以涵蓋抵達時的情報凍結呼叫。
- `world.service.spec.ts`：mock 補上 `portIntel.findMany`。
- 真實環境端對端驗證（本機 Postgres + Redis + 真實 API/web server +
  Playwright）：
  1. 新世界建立後，家鄉港有且僅有 1 筆 `PortIntel`；此時查家鄉港的貿易路線
     建議回傳空陣列（其餘 14 港都「從沒去過」）。
  2. 設航線出港、真正跑過真實 tick pipeline 抵達一個新港：`PortIntel` 增加
     為 2 筆；查詢新港的貿易路線建議，回傳「運回家鄉港賣」的建議，且
     `sellIntelAgeTicks` 正確等於「目前 tick − 家鄉港上次造訪 tick」
     （驗證中為 4）。
  3. 前端 `TradeRoutePanel` 正確顯示「情報：N 天前，實際價格可能已變動」
     字樣（截圖確認）。

既有的 API 全部測試（21 個 suite、171 個測試）、`@azure-voyage/shared` 全部
測試（23 個檔案、168 個測試）、API/web `tsc --noEmit`、`next build` 全數維持
綠燈。
