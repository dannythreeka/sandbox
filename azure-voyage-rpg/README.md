# Azure Voyage RPG（蒼瀾航路：晨汐紀事）

敘事探索型 RPG（Narrative Exploration RPG）——探索世界 → 遇見人物 → 做選擇
→ 影響世界 → 解開真相。與同系列的即時沙盒經營遊戲 `azure-voyage` 是**完全
獨立的專案**（獨立的 pnpm workspace、獨立的套件範圍 `@azure-voyage-rpg/*`），
共用同一個原創世界觀，但不共用任何程式碼或建置依賴。

## 結構

```
packages/
  engine/     # 純框架：Condition/Effect 條件語言、三層世界架構、事件引擎
  content/    # 蒼瀾世界的內容包：場景、事件、人物、任務（宣告式資料）
  tsconfig/   # 共用 tsconfig 基底
apps/
  web/        # 可玩前端（Next.js，含場景圖像、角色立繪、動畫式互動）
docs/
  01-story-bible.md              # RPG 故事流程設計提案
  02-novel-azure-voyage.md       # 原創中篇小說《蒼瀾航路》（世界觀底本）
  03-rpg-framework.md            # RPG Framework 完整設計
  04-p0-p2-implementation.md     # P0（引擎骨架）～P2（主線第一部）實作紀錄
```

## 開發

```bash
pnpm install
pnpm dev        # apps/web 開發伺服器（預設 port 3100）
pnpm typecheck
pnpm test
pnpm build
```

## 視覺呈現

- `apps/web/public/art/*`：RPG 前端使用的背景圖、事件圖與角色立繪。
- 場景視覺資料直接宣告在 `packages/content/src/scenes/*.ts`，可為每個場景指定背景、疊圖、色盤與熱點位置。
- 角色對話視覺資料宣告在 `packages/content/src/npcs.ts`，可指定別名與對話時使用的立繪／色彩。
- 前端提供可手動啟用（符合瀏覽器限制）的 Web Audio 音效/BGM 控制，依不同場景 ambience 動態調整音場。
- 戰鬥／交火段落會在對話區上方顯示動態戰鬥演出（艦船與光效），強化事件張力。

## 用 Docker 一鍵試玩

純前端原型，不需要資料庫/佇列，存檔在瀏覽器 localStorage：

```bash
docker compose up --build
```

等 `web` 印出 `Ready` 後，打開 http://localhost:3100 即可遊玩。想清掉容器就
`docker compose down`（沒有掛 volume，不會留下任何資料）。
