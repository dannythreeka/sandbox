# tools/artgen

M16 生圖管線（docs/11 §3 API 模式）。讀 `manifest.mjs` 的訂單表，呼叫 Google
Generative Language API（Gemini / Imagen，動態探測可用模型），輸出 webp 到
`apps/web/public/art/<category>/<id>.webp`，命名對應 `GameArt` 元件的資產 key。

## 使用方式

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

## 安全性

- **絕對不要**把 API key 寫進 `.env`、程式碼、commit message 或任何會被 `git add`
  的檔案。此腳本只從 `process.env.GEMINI_API_KEY` 讀取，用完即丟。
- 產生的圖片本身沒有秘密資訊，可以正常 commit 進 `apps/web/public/art/`。

## 缺圖不擋玩

`apps/web/src/game/GameArt.tsx` 對每張資產都有 fallback（剪影 / 字母頭像 / 待補），
這裡沒跑完、跑失敗的項目，遊戲照常可玩。
