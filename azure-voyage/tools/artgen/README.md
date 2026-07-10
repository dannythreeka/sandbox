# tools/artgen

生圖管線（docs/11 §3 API 模式）。讀 `manifest.mjs` 的訂單表，兩支腳本共用同一份
manifest（M16 P0 + M17 補完 + M18 港口規模擴充，現有 64 筆），差別只在打哪個生圖服務：

- `generate.mjs` → Google Generative Language API（Gemini / Imagen）
- `generate-pollinations.mjs` → Pollinations.ai

輸出都是 webp，寫到 `apps/web/public/art/<category>/<id>.webp`，命名對應 `GameArt`
元件的資產 key。

## Gemini / Imagen（`generate.mjs`）

```bash
cd tools/artgen
pnpm install

# 先 dry-run 看訂單表（不呼叫 API，不花配額）
node generate.mjs --dry-run

# 正式產生（key 只用環境變數，不要寫進任何檔案／不要 commit）
GEMINI_API_KEY=xxx node generate.mjs

# 只做某個 category 或某一筆，方便先測試/校色
GEMINI_API_KEY=xxx node generate.mjs --only=ship
GEMINI_API_KEY=xxx node generate.mjs --id=sera
```

注意：Imagen 的 `:predict` 目前只開放付費方案；免費 API key 的 Google Cloud 專案
如果沒開計費，所有圖片模型（含原生 Gemini 圖片輸出模型）配額都是 0，會收到
`RESOURCE_EXHAUSTED`。需要專案啟用計費才能真的產圖。

## Pollinations.ai（`generate-pollinations.mjs`）

⚠️ **這支必須在你自己的機器上跑**，不能在 Claude 執行的 sandbox 裡跑——sandbox
的網路政策直接擋掉 `pollinations.ai`（proxy 在 CONNECT 階段就回 403，不是 key
或程式的問題）。用法一樣：

```bash
cd tools/artgen
pnpm install
POLLINATIONS_API_KEY=xxx node generate-pollinations.mjs --dry-run
POLLINATIONS_API_KEY=xxx node generate-pollinations.mjs
POLLINATIONS_API_KEY=xxx node generate-pollinations.mjs --only=ship

# 只補目前缺少的檔案（例如 manifest 擴充後只想跑新增的項目）
POLLINATIONS_API_KEY=xxx node generate-pollinations.mjs --skip-existing
```

跑完後 `apps/web/public/art/` 底下會多出對應的 webp 檔，直接 commit/push 回來，
或把整個資料夾傳回來給我整理入庫都可以。

Pollinations 認證機制若跟目前版本兜不起來（他們近期調整過幾次），去
https://pollinations.ai 的官方文件確認目前正確的認證參數，再調整
`callPollinations()` 裡送出的 header/query 參數。

## 安全性

- **絕對不要**把 API key 寫進 `.env`、程式碼、commit message 或任何會被 `git add`
  的檔案。兩支腳本都只從環境變數讀取（`GEMINI_API_KEY` / `POLLINATIONS_API_KEY`），
  用完即丟。
- 產生的圖片本身沒有秘密資訊，可以正常 commit 進 `apps/web/public/art/`。

## 缺圖不擋玩

`apps/web/src/game/GameArt.tsx` 對每張資產都有 fallback（剪影 / 字母頭像 / 待補），
這裡沒跑完、跑失敗的項目，遊戲照常可玩。
