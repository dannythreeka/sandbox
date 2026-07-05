# 09 — 實作路線圖（給實作 AI 的工作分解）

原則：**每個里程碑結束時，遊戲都處於「可運行、可驗證」狀態**。每個 M 是一個或多個 PR；驗收標準必須全綠才進下一個 M。全程 `AI_ENABLED=false` 也必須可玩（M5 才開 AI）。

## M0 — 骨架與地基（無遊戲邏輯）

- Monorepo 建置（08 全套）：pnpm + turbo + apps/api + apps/web + packages/shared，docker-compose，CI。
- auth module（註冊/登入/JWT）+ worlds CRUD（空世界）。
- Socket.IO gateway：join room、心跳、resync 空實作。
- **驗收**：`pnpm dev` 一鍵起全套；註冊→登入→建立/列出存檔；WS 能連上房間；CI 全綠。

## M1 — 內容包與世界生成

- `packages/shared/content/` 全部靜態內容：7 海域、40 港、36 商品、10 船級、常數表；`tools/mapgen` 產出 hexmap.json。
- Prisma schema（03 全量）+ migration；New Game 流程（03 §5，NPC 用占位人設）；`GET /worlds/:id` 快照。
- shared: rng、hex 幾何、A* pathfind + 單測。
- **驗收**：建新世界後 DB 有完整初始狀態；快照 API 回傳通過 zod；`pnpm test:rules` 綠。

## M2 — 航行迴圈（第一個可「玩」的版本）

- clock + BullMQ tick 管線（05 §1 的 PHASE 0/2/3/9，其餘空轉）；voyage module：設航線/出港/移動/抵港。
- 前端：SeaScene + Pixi 海圖 + 艦隊精靈 + 航線預覽 + tick 節奏器 + HUD（日期/補給/金錢）。
- 補給消耗與斷糧懲罰；`server:tick`/`server:arrival` 全通。
- **驗收（手動腳本）**：出港 → 航行至另一港（畫面平滑移動、糧水遞減）→ 抵港切場景；斷線重連後狀態一致；200 tick 整合測試不變量通過。

## M3 — 經濟與貿易

- economy module（PHASE 6）：價格公式、庫存回歸、priceHistory；market module：交易端點（含冪等、滑價、原子多單）。
- 前端：PortScene + TradePanel + 價格 sparkline + 貨艙視圖。
- 影響力最小版：交易累積 goodwill → share 轉化（PHASE 7 核心）+ 港口影響力 UI。
- **驗收**：低買高賣一趟有利潤；同商品爆買會推高價格；交易後影響力上升且享折扣；價格曲線單測（單調性/邊界）綠。

## M4 — 完整六系統

- 海戰全套（battle module + BattleScene + 規則戰術 AI + 重放測試）。
- 航行遭遇（PHASE 4）與規則事件（風暴/海賊/行情，EventModal + 抉擇流程）。
- 航海士系統（招募/職位 buff/薪資/忠誠）；造船廠全功能；探索與發現物 + 學會登錄。
- 投資拉影響力、海域霸權判定、勝敗條件（PHASE 8）+ 勝利/失敗畫面。
- NPC 商會規則版：固定策略模板輪替（無 LLM），PHASE 5 執行器全通。
- **驗收**：不開 AI 之下，一局可以從開局玩到三種勝利條件任一達成；戰鬥 seed 重放 bit-exact；e2e 冒煙通過。

## M5 — AI Agent 層

- ai module 全套（06）：orchestrator、claude client、digest、四種 agent、驗證/clamp/fallback、預算配額、AiGenerationLog。
- 開局 PERSONA 補全 NPC 商會與航海士個性；EVENT_GEN 排程事件 + RUMOR_QUEST 任務鏈；NPC_STRATEGY 取代模板策略；DIALOGUE SSE 對話 UI。
- **驗收**：processor 單測四類回應全過；fallback 率監控可見；`AI_ENABLED=false` 回歸測試仍全綠；實際跑 100 tick 出現至少一個 AI 事件且數值都在 clamp 範圍內。

## M6 — 打磨與發布

- 平衡調參（difficulty 表）、音效/BGM、教學引導（前 10 tick 的 guided tour）、存檔刪除/多存檔上限、錯誤文案全 i18n、效能檢查（tick p95、首屏）、部署腳本與正式環境文件。
- **驗收**：一位新玩家不看文件可完成「第一桶金」；Lighthouse ≥ 90（lobby）；正式環境一鍵部署成功。

## 給實作 AI 的每-PR 檢查清單

1. 對照本文件的驗收標準逐條自驗，PR 描述中列出結果。
2. 新增/修改的規則計算必附單元測試；JSONB 讀寫必經 zod。
3. 不引入文件外的新依賴/新表/新事件名；確有必要時先在 PR 中提出並更新對應文件（03/04 為契約，改動必同步）。
4. 禁止出現任何既有商業遊戲的名稱/文本/素材。
