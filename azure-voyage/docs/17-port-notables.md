# 17 — 港口互動強化：原創港口人物（M25）

> 回應玩家願望清單第三項：「更接近系列神韻的港口互動（原創港名、原創人物）」。
> 原創港名在 M1 就有了；這個里程碑補上「原創人物」。

## 1. 設計

系列作品裡「進港會遇到誰」是很重要的體驗——不是只有市場數字，而是有一個角色
站在那裡代表這座港口。蒼瀾海域目前已經有 NPC 商會（PERSONA+DIALOGUE，M8/M19/M20）
與航海士（同樣有人設與對話），但港口本身沒有「人」，只有市場/影響力/學會這些
系統面板。

M25 幫 15 個港口各配一位原創人物：一個角色原型（港務總管/商會元老/老漁夫/鐵匠
工頭/珍珠商……共 11 種），一個原創姓名，沿用既有 PERSONA（人設一次生成、固化）
與 DIALOGUE（即時對話）的 AI Agent 架構，不重新發明一套機制。

角色原型與港口的對應（節錄，完整清單見
`packages/shared/src/content/portNotables.ts`）：首都港（規模 3）配「港務總管」，
其餘依海域特色配對應行業的原創人物——北環海是毛皮商，鐵崖海岸是鐵匠，絹風海峽
是絲織商人，珊瑚環弧是珍珠商與潛水人長老，暮色洋是製圖師與隱居占星師。

## 2. 實作

- **新 Prisma model `PortNotable`**：`worldId+portId` 唯一，`persona Json?`
  沿用 `Officer.persona` 的「null＝尚未生成」模式（不像 `Guild.aiPersona` 需要
  額外的 placeholder 旗標，因為 archetype 本來就是獨立欄位）。這是本專案自 M12
  以來第一個真正新增的 Prisma migration（`20260713065719_m25_port_notables`）
  ——先前所有里程碑用到的欄位（`Officer.exp`／`.persona`、
  `DiscoveryRecord.narrative` 等）都是 M1 就預先建好、後續里程碑才接上邏輯的，
  這次是貨真價實的新表。**已在本機 PostgreSQL 16 上跑過
  `prisma migrate dev --create-only` → `migrate deploy` → 建世界 → 查詢港口
  →對話的完整流程**，不是只靠 mock 測試過。API 的 Dockerfile 本來就是
  `prisma migrate deploy && node dist/main.js`，所以這個新 migration 會在使用者
  下次部署時自動套用，不需要額外操作。
- `packages/shared/src/content/portNotables.ts`：15 個港口人物的原創姓名/角色
  原型清單，`portNotableTemplateForPort(portId)` 查表。
- `packages/shared/src/rules/aiFallback.ts`：`fallbackPortNotablePersonaGen`，
  依 11 種 archetype 各自的模板池生成 fallback 人設（AI 停用/失敗時使用）。
- `WorldService.persistNewWorld()`：世界建立時批次寫入 15 筆 `PortNotable`
  佔位資料（`persona: null`）。
- `PersonaService.refreshPortNotablePersonas()`：跟 NPC 商會、航海士共用同一份
  `PERSONA_MAX_PER_TICK` 額度（商會→航海士→港口人物依序補，額度用完留給下個
  tick），AI 生成一次後固化，不重複呼叫。
- `DialogueService`：`DIALOGUE_TARGET_TYPES` 新增 `"PORT_NOTABLE"`，`loadTarget`
  新增對應分支（`prisma.portNotable.findFirst`）。
- `MarketService.getPortDetail()`：回傳的 `PortDetail` 多一個 `notable` 欄位
  （用「解析後」的港口 id 查——已刪除的舊港口 id 沒有對應人物，見 docs/13）。
- 前端新增 `PortNotablePanel`：停靠中顯示於港內面板最上方，含頭像（沿用既有
  `GameArt` 缺圖時的首字頭像 fallback，尚未產生對應美術資產）、姓名、角色原型
  標籤、人設描述，以及「對話」按鈕（開啟既有的 `DialoguePanel`，
  `targetType="PORT_NOTABLE"`）。

## 3. 測試

- `packages/shared`：`portNotables.test.ts`（3 案例：15 港各一位、姓名不重複、
  查表函式行為）、`aiFallback.test.ts` 新增 fallback 人設案例（涵蓋全部 11 種
  archetype）。
- `apps/api`：`persona.service.spec.ts`、`dialogue.service.spec.ts`、
  `market.service.spec.ts` 都新增對應案例；另外直接在本機 Postgres+Redis 上跑
  真實的 API server，完成註冊→建世界→查港口→對話的端對端驗證（見上）。

## 4. 待辦

15 位港口人物目前沒有專屬美術資產（`portrait.notable_*`），跟其餘尚未補圖的
內容一樣走 `GameArt` 的首字頭像 fallback。之後若要走 `tools/artgen` 生圖管線
補上，屬於美術覆蓋範疇的後續工作，不影響這次的功能完整性。
