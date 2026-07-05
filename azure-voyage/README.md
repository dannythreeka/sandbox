# 蒼瀾航路 (Azure Voyage)

> 一款受 1990 年代航海貿易遊戲「精神啟發」的原創網頁遊戲。
> 玩家扮演一名船隊提督，在架空世界「蒼瀾海域」中經商、探索、結盟、爭奪各港口的商業影響力，最終成為海上霸主。

**重要：本專案為原創作品。** 我們借鑑的是「航海貿易 + 港口佔有率 + 艦隊經營」這一類「遊戲機制概念」（遊戲機制本身不受著作權保護），但所有的世界觀、地名、人名、船名、美術、文案、數值設計均為原創，不使用任何既有遊戲的素材、名稱或劇情。

---

## 文件導覽（依閱讀順序）

| # | 文件 | 內容 | 主要讀者 |
|---|------|------|----------|
| 0 | [00-overview.md](docs/00-overview.md) | 專案總覽、技術選型決策、名詞表 | 所有人 |
| 1 | [01-game-design.md](docs/01-game-design.md) | 遊戲設計文件（GDD）：核心循環、六大系統規則 | 遊戲邏輯實作者 |
| 2 | [02-system-architecture.md](docs/02-system-architecture.md) | 系統架構：前後端分層、模組圖、即時通訊、部署 | 全端 |
| 3 | [03-data-model.md](docs/03-data-model.md) | 資料模型：完整 Prisma schema 草案 + 設計理由 | 後端 |
| 4 | [04-api-design.md](docs/04-api-design.md) | API 契約：REST + WebSocket 事件完整清單 | 前後端 |
| 5 | [05-game-engine.md](docs/05-game-engine.md) | 遊戲引擎：tick 迴圈、經濟模擬、海戰解算、偽代碼 | 後端 |
| 6 | [06-ai-agents.md](docs/06-ai-agents.md) | AI Agent 層：事件生成、NPC 對手、對話，含 prompt 設計與防護欄 | 後端 |
| 7 | [07-frontend.md](docs/07-frontend.md) | 前端架構：Next.js 結構、狀態管理、地圖渲染 | 前端 |
| 8 | [08-project-structure.md](docs/08-project-structure.md) | Monorepo 目錄結構、共用套件、開發工具鏈 | 所有人 |
| 9 | [09-roadmap.md](docs/09-roadmap.md) | 實作路線圖：M0–M6 里程碑，每步的驗收標準 | 實作 AI / 開發者 |

## 快速開始（M0）

```bash
# 需求：Node 22+、pnpm 10、PostgreSQL 16（本機或 docker compose up -d postgres）
cp .env.example .env          # 依需要調整 DATABASE_URL
pnpm install
pnpm db:migrate               # 建立資料表（prisma migrate dev）
pnpm dev                      # 同時啟動 api (:3001) 與 web (:3000)
```

打開 http://localhost:3000 → 註冊帳號 → 建立世界 → 進入遊戲頁（M0 顯示世界資訊與 WS 連線狀態；海圖在 M2 登場）。

驗證指令：`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`。

## 技術棧一覽

- **Monorepo**: pnpm workspaces + Turborepo
- **前端**: Next.js 15 (App Router) + TypeScript + Tailwind CSS + Zustand + TanStack Query + PixiJS（海圖渲染）
- **後端**: NestJS（掛 Fastify adapter）+ Socket.IO + BullMQ
- **資料庫**: PostgreSQL 16 + Prisma ORM；Redis 7（快取 / 佇列 / pub-sub）
- **AI**: Anthropic Claude API（事件生成、NPC 決策、對話），Zod 驗證 + 規則引擎 fallback
- **共用**: `packages/shared` 內放 Zod schema、常數、純函式遊戲規則，前後端共用

## 給實作 AI 的指示

1. 依照 [09-roadmap.md](docs/09-roadmap.md) 的里程碑順序實作，**每個里程碑完成後必須可獨立運行與驗證**。
2. 所有遊戲規則的「純計算」寫在 `packages/shared/src/rules/`，必須是無副作用純函式並附單元測試。
3. 資料表結構以 [03-data-model.md](docs/03-data-model.md) 為準；API 以 [04-api-design.md](docs/04-api-design.md) 為準。若實作中發現矛盾，以 03 為最高優先，並在 PR 說明中記錄偏差。
4. AI Agent 的輸出一律經過 Zod 驗證，驗證失敗時走規則引擎 fallback，**絕不讓 LLM 輸出直接進資料庫**。
