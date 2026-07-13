# 13 — 已刪除港口的存檔修復（M21 事後修補）

> 對應真實 production bug：既有存檔的艦隊仍停靠在 M21（docs/12）被刪除的港口
> `port.amber_gulf.vireno`，設定航線時 `portById()` 對這個未知 id 丟出未捕捉例外，
> 導致 `setRoute` 500。

## 0. 根本原因

M21 把 `PORTS` 內容從 40 港縮到 15 港，是**破壞性**（非 additive）的內容變更。
docs/12 §2 的影響範圍檢查只確認了世界生成邏輯（hexmap/discoveries/影響力/酒館池/
artgen manifest）不受影響，**沒有檢查既有存檔資料庫裡已經寫死的港口 id 參照**——
`Fleet.dockedPortId`、`Officer.locationPortId` 這類欄位在世界建立當下就已經固化成
字串，程式碼裡的 `PORTS` 陣列縮編後，這些欄位可能指向一個已經不存在的港口。

這違反了專案原本的「additive-only 遷移原則」（原本只套用在 schema，這次證明也要
套用在內容資料）。

## 1. 修復設計

**`packages/shared/src/content/ports.ts`**：

- `REMOVED_PORT_REPLACEMENTS`：M21 刪除的 25 個港口 id → 目前最近的存續港口 id
  （依 hex 距離，同海域內挑最近的）。
- `resolvePortId(id)`：id 若仍存在於 `PORTS` 原樣傳回；若是上面表裡的舊 id 傳回替代
  港口；都不是則退回首都港 `HOME_PORT_ID`（理論上不會發生，僅防禦）。
- `portByIdOrFallback(id)`：`portById(resolvePortId(id))`，不會對舊 id 丟例外。

**自我修復（讀取時順便修，不需要手動下 SQL）**：

- `WorldService.getSnapshot()`：每次讀快照時，掃描該世界的玩家艦隊
  （`dockedPortId`）與待業航海士（`locationPortId`），凡是指向已刪除港口的，
  直接 `UPDATE` 成 `resolvePortId()` 算出的存續港口，再繼續組快照。第一次讀取後
  資料就修好了，之後每次都是 no-op（找不到需要修的資料）。
- `VoyageService.setRoute()`：多一層保險——即使玩家還沒重新整理過、快照修復還沒
  跑過，設定航線時一樣會先檢查 `fleet.dockedPortId` 是否指向已刪除港口，是的話
  當場修正、寫回資料庫，再算航線起點。

**防禦性降級（其餘會用使用者輸入 portId 查內容的地方）**：

`market.service.ts`（`getPortDetail`）、`influence.service.ts`（`invest`）、
`discovery.service.ts`（`registerDiscovery`）原本直接呼叫 `portById(portId)`，
改成 `portByIdOrFallback(portId)`——即使有還沒被上面兩個自我修復流程處理到的
邊界情況，也只會拿到最近的存續港口資料，而不是丟未捕捉例外變成 500。

## 2. 不動的部分

- `PortState` / `MarketStock` / `PortInfluence` 這些以舊港口 id 建立的 DB row
  不刪除、不搬移——它們已經不會再被任何存續的 `dockedPortId`/`locationPortId`
  參照到，留著是無害的孤兒資料，之後若要徹底清理可以再開一個一次性清掃腳本，
  不影響本次修復的正確性。
- `HOME_PORT_ID`、`PORTS`、M21 的 15 港內容本身不變。

## 3. 測試

`apps/api/src/modules/world/world.service.spec.ts` 新增：
- 艦隊停在已刪除港口 → `getSnapshot()` 後端資料與回傳快照都改成最近存續港口。
- 待業航海士停在已刪除港口 → 同樣被修正。
- 艦隊本來就停在存續港口 → 不觸發任何 DB 寫入（no-op 驗證）。

既有的 `voyage.service.spec.ts`、`market.service.spec.ts`、
`influence.service.spec.ts`、`discovery.service.spec.ts`、`worldgen.test.ts`
全數維持綠燈。
