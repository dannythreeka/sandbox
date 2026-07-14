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
  web/        # 最小可玩前端（Next.js，純用戶端 + localStorage 存檔）
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
