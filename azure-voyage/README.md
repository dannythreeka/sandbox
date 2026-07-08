# 蒼瀾航路 (Azure Voyage)

> 一款受 1990 年代航海貿易遊戲「精神啟發」的原創網頁遊戲。
> 玩家扮演一名船隊提督，在架空世界「蒼瀾海域」中經商、探索、結盟、爭奪各港口的商業影響力，最終成為海上霸主。

**重要：本專案為原創作品。** 我們借鑑的是「航海貿易 + 港口佔有率 + 艦隊經營」這一類「遊戲機制概念」（遊戲機制本身不受著作權保護），但所有的世界觀、地名、人名、船名、美術、文案、數值設計均為原創，不使用任何既有遊戲的素材、名稱或劇情。

**現況：M0–M9 全數完成，遊戲可從註冊帳號一路玩到達成勝利條件。** 完整迴圈涵蓋航行、貿易、招募航海士與造船、海戰、探索與發現物、港口影響力投資、NPC 商會（規則型 + AI 策略）、世界事件（規則型 + AI 生成傳聞）、海域霸權／總資產勝利判定。`AI_ENABLED=false`（預設）時全部走規則引擎 fallback，不需要 API key 也能完整遊玩；設定 `ANTHROPIC_API_KEY` 並開啟 `AI_ENABLED=true` 可讓 NPC 策略與世界事件改由 Claude 生成。

已知範圍外的項目（刻意不做，非疏漏）：
- **無破產／戰敗結局**——現有防呆機制（交易擋超額、薪資不足時扣忠誠度而非扣到負數、戰敗時艦隊會被強制留下最後一艘船）讓玩家目前無法真正「輸掉」遊戲，只有海域霸權／總資產兩種勝利路徑。
- **DIALOGUE（與 NPC 即時對話）**：docs/06 設計中的第四種 AI agent，M8 範圍內未實作，AI 層目前只有 NPC_STRATEGY 與 EVENT_GEN 兩種。

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
| 9 | [09-roadmap.md](docs/09-roadmap.md) | 實作路線圖：M0–M9 里程碑，每步的驗收標準（實際執行記錄見文件頂端） | 實作 AI / 開發者 |

## 快速開始

```bash
# 需求：Node 22+、pnpm 10、PostgreSQL 16 + Redis 7（本機或 docker compose up -d postgres redis）
cp .env.example .env          # 依需要調整 DATABASE_URL / REDIS_URL
pnpm install
pnpm db:migrate               # 建立資料表（prisma migrate dev）
pnpm dev                      # 同時啟動 api (:3001) 與 web (:3000)
```

打開 http://localhost:3000 → 註冊帳號 → 建立世界 → 進入遊戲頁。

驗證指令：`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`。

## 用 Docker 一鍵試玩（不動到本機環境）

不想在本機裝 Node / pnpm / PostgreSQL / Redis，只想開個容器玩玩看的話：

```bash
cp .env.example .env          # 預設值就能玩；要開 AI 就在這裡填 ANTHROPIC_API_KEY 並把 AI_ENABLED 改 true
docker compose --profile full up --build
```

等 `api` 印出 `listening on :3001`、`web` 印出 `Ready` 後，打開 http://localhost:3000 即可遊玩。
Postgres／Redis 資料存在 Docker volume（`azure-voyage_pgdata` / `azure-voyage_redisdata`）裡，不會碰到本機任何東西；`docker compose --profile full down`（要連資料一起清掉再加 `-v`）即可完整移除，不留痕跡。

想再切回本機開發模式（有熱重載），用預設不帶 `--profile full` 的 `docker compose up -d`（只起 postgres + redis）配合 `pnpm dev` 即可，兩種模式的資料庫連線資訊相同，不會互相干擾。

> **關於部署到遠端主機**：`web` 容器把 `NEXT_PUBLIC_API_URL` 烘進前端 build（Next.js 對 client-side 環境變數的限制，容器啟動後才給的環境變數對它沒作用）。本機用預設值 `http://localhost:3001` 沒問題；要放到遠端主機，先在 `.env` 把 `NEXT_PUBLIC_API_URL` 改成 API 對外實際可連到的網址，並視需要設定 `WEB_ORIGIN` 收斂 CORS，然後重新 `docker compose --profile full build web`。
>
> **註：這份 docker-compose 設定在本次修改中已對照目前完整程式碼修正過（補上 M8 的 `AI_ENABLED`/`ANTHROPIC_API_KEY`、Redis 健康檢查與啟動順序、`prisma` CLI 缺漏等問題），並額外挖到一個原本會讓 `apps/api` 的容器建置直接失敗的問題：pnpm v10 預設不允許 `pnpm deploy` 部署未設定 `inject-workspace-packages=true` 的 workspace（會丟 `ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE`），已透過新增根目錄 `.npmrc` 修好，並在本機直接跑過一次 `pnpm --filter @azure-voyage/api --prod deploy` 確認輸出（`dist/`、`prisma/`、`node_modules/.bin/prisma`、注入的 `@azure-voyage/shared`）齊全。但受限於目前開發環境的網路政策無法連線到 Docker Hub 拉取基礎映像，所以沒能在這裡實際跑一次 `docker compose up` 把容器建置到底跑完。麻煩您在本機或伺服器上驗證一次；如果跑起來有任何問題，把錯誤訊息貼給我，我可以繼續修。**

## 如何遊玩

1. **啟航**：建立世界後直接停靠在起始港，艦隊已配好一艘船與兩名航海士。
2. **貿易**：在港口市場面板低買高賣；同商品連續買賣會推動價格，注意庫存與船艙容量。
3. **航行**：點擊海圖上的**港口或任一海面**設定航向 → 出港（自動補滿糧水、按單價扣款）→ 用航速切換鍵（暫停／1x／2x／4x）推進時間。帆船會沿虛線航線在大海圖上平滑移動、留下航跡，鏡頭自動跟隨（拖曳地圖暫停跟隨，按「回到艦隊」恢復）。航向開放海域抵達後會自動下錨，可就地探索或點擊新目標直接續航；沿途可能遇上海盜或風暴。
4. **成長**：到酒館招募航海士並指派副官／航海長／炮術長／會計長／瞭望員角色；到造船廠修船、賣船、造新船。
5. **探索**：航行到未知地點使用「探索」，找到發現物後回到規模夠大的港口向學會分部登錄，換取金錢與聲望。
6. **影響力**：在港口面板投資，提升商會在當地的影響力份額（享有交易折扣），並與在地勢力、NPC 商會此消彼長。
7. **勝利**：達成任一條件即獲勝——① 同時稱霸 4 個海域（單一商會份額 ≥ 40% 且最高）；② 商會總資產（金幣＋船隊估值）達到難度對應門檻。

NPC 商會會依規則（或啟用 AI 後改由 Claude 生成）的策略自行在主場海域投資擴張，世界也會不定期傳出港邊傳聞事件，帶來額外的金錢與聲望獎勵。

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
