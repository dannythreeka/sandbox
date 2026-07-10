# 11 — 美術方向計畫（M15–M17）

> 回應玩家回饋：「目前的美術部分，會讓人玩不下去遊戲」。
> 本文件定義：版權紅線、風格統一規範、完整資產清單（含生圖 prompt 模板）、
> 資產管線設計、以及 M15–M17 的分階段執行計畫。
> 原則沿用 docs/09/10：每里程碑一 PR、缺資產不擋玩（一律有程式繪製 fallback）、
> `AI_ENABLED=false` 與「零外部資產」狀態下遊戲都必須完整可玩。

## 0. 版權紅線（先說清楚哪些可以、哪些不行）

| 來源 | 判定 | 說明 |
|------|------|------|
| KOEI／大航海時代系列的圖片 | ❌ 禁止 | 直接侵權，無討論空間 |
| 「網路上找的類似圖片」 | ⚠️ 預設禁止 | 網路圖片**絕大多數也有版權**，「跟 KOEI 不一樣」不代表可以用。只有下方明確標示公有領域／CC0 的來源例外 |
| 真實人物照片當角色圖 | ❌ 避免 | 照片有攝影師著作權，人物另有肖像權——雙重風險 |
| 公有領域老畫作／古地圖 | ✅ 可以 | 文藝復興～大航海時代的肖像畫、船舶畫、古海圖本身早已過版權期。可靠來源：Wikimedia Commons（標 PD）、Rijksmuseum／The Met／Art Institute of Chicago 的 CC0 開放館藏、美國國會圖書館與 NYPL 地圖庫 |
| AI 生成圖片 | ✅ 主力方案 | 用乾淨的 prompt 生成原創圖。紅線：prompt **不得**出現 KOEI／大航海時代／其角色名／「in the style of 某在世畫家」。若未來商業化，需回頭確認所用生圖服務的商用授權條款 |
| 程式繪製（SVG/Canvas/Pixi） | ✅ 永遠安全 | M10–M14 的既有做法，continue 作為 fallback 層 |

**關於「直接用真實地中海地圖」**：法律上可行（用公有領域古地圖），但**不建議**，原因有二——
1. 架空世界觀是這個專案的版權安全網：一旦地名、航線、地理都對應真實地中海，
   整體觀感會迅速滑向「大航海時代換皮」，反而增加被比對的風險；
2. 海圖不是裝飾，是玩法本體（hexmap 上跑尋路、遭遇、海域霸權判定），
   換成真實地圖等於重做 M1 的世界生成與全部內容包。
   **正確做法**：保留架空地理，把「視覺風格」做成古典航海圖（羊皮紙、手繪海岸線、
   裝飾羅盤、海怪插畫邊飾）——風格是公有財，內容維持原創。

## 1. 風格統一規範（Style Guide）

所有生圖資產共用同一段風格前綴，確保整批圖像一致（風格方向見 §5 決策點）：

```
【風格前綴模板——確定風格方向後填定，全部資產共用】
<style_prefix> =
  "<畫風描述>, age of sail era, warm candlelight palette,
   consistent painterly style, game asset, clean composition,
   no text, no watermark, no signature"

【負面提示（若生圖工具支援）】
  "modern objects, photograph, real person, text, watermark,
   frame, border, low quality"
```

- **調色盤**：延續現有 UI 主題色（abyss `#0b1526`／wave `#12283f`／foam `#9fc3e0`／gold `#d9a441`），生圖資產以暖金＋深海藍為主調，避免高飽和霓虹色。
- **構圖**：人物立繪＝半身、視線微側、單色暗背景（方便去背/壓暗）；港口場景＝寬幅遠景、前景碼頭中景城鎮遠景地形；船＝側面 3/4 視角、海平面構圖。
- **禁止項**：畫面中不得出現文字、浮水印、真實國旗、真實地標。

## 2. 資產清單與生圖 Prompt 模板

規格統一：**webp**，人物 `768×1024`、場景 `1600×900`、船 `1024×768`、圖示 `256×256`。
命名即 contentId：`apps/web/public/art/<類別>/<contentId>.webp`，缺檔自動 fallback 程式繪製版。

| # | 類別 | 數量 | 檔名規則 | 優先級 |
|---|------|------|----------|--------|
| A | 港口場景 | 7 海域 × 規模 1–3 ＝ 21（可先做 7 張區域代表圖共用） | `port-scene/<regionId>-s<1|2|3>.webp` | P0 |
| B | 人物立繪：航海士 | 12 | `portrait/<officerId>.webp` | P0 |
| C | 人物立繪：NPC 商會會長 | 5 | `portrait/<npcGuildId>.webp` | P1 |
| D | 玩家頭像可選集 | 4 | `portrait/player-<1..4>.webp` | P2 |
| E | 船級側視圖 | 10 | `ship/<shipClassId>.webp` | P0 |
| F | 標題／登入頁主視覺 | 1 | `key-visual/title.webp` | P1 |
| G | 戰鬥背景（平靜海／風暴海／夜戰） | 3 | `battle-bg/<calm|storm|night>.webp` | P1 |
| H | 事件插圖（風暴/海賊/慶典/發現/傳聞/下錨探索） | 6 | `event/<type>.webp` | P2 |
| I | 商品類別圖示（8 大類；不必 36 個一對一） | 8 | `goods/<category>.webp` 或程式 SVG | P2 |

P0 合計 **43 張**（港口先做 7 張時為 **29 張**）——一次生圖工作坊就能完成的量。

### Prompt 模板（範例；`<style_prefix>` 見 §1）

```
【港口場景】<style_prefix>, wide establishing shot of a <規模詞> harbor town
  in a <海域氣候詞> region, sailing ships at anchor, stone piers,
  <海域特色詞：北方=snow-dusted roofs / 琥珀灣=golden sandstone / 絹風=terraced silk town …>
【航海士立繪】<style_prefix>, half-body portrait of a <年齡/性別/氣質詞> ship's
  <職業詞 navigator/gunner/quartermaster…>, <特徵詞：風霜的臉/自信的笑/學者氣質…>,
  dark plain background
【船】<style_prefix>, side view of a <船型詞 two-masted schooner / armed merchantman…>,
  full sails, calm sea, horizon composition
```

每張資產的完整 prompt 由實作時依 content 資料（人物個性、海域描述、船級數據）自動展開成
一份**生圖訂單表**（`docs/art-orders/<batch>.md`），內含：檔名、尺寸、完整 prompt、負面提示——
無論是人工貼到 Manus/豆包還是走 API，同一份訂單表都適用。

## 3. 資產管線設計

1. **目錄**：`apps/web/public/art/...`（見 §2 命名）。
2. **Fallback 元件**：`<GameArt category id fallback>`——`onError` 或檔案不存在時渲染現有
   程式繪製版（人物→字母頭像框、港口→剪影生成器（M13 已有）、船→M10 船形放大版）。
   **缺任何一張圖，遊戲照常可玩**——資產是漸進增強，不是硬相依。
3. **整合點**：
   - 港口停靠面板頂部：港口場景橫幅（A）
   - 酒館招募卡片／艦隊航海士列表：立繪（B/C）
   - 造船廠列表：船圖（E）
   - 登入/註冊頁：主視覺（F）
   - BattleScene 背景：依天氣選戰鬥背景（G，接 M14 天氣）
   - 事件通知 toast → 升級為含插圖的事件卡（H）
4. **產圖工作流**（二選一或混用，見 §5 決策點）：
   - **API 模式**：使用者提供生圖 API key → 我寫 `tools/artgen` 腳本批次生成
     （⚠️ 本沙盒網路受政策管制，拿到 API 後先做連通性測試；不通則自動退到訂單表模式）
   - **訂單表模式**：我產出訂單表 → 使用者貼到 Manus/豆包等工具生圖 → 回傳圖檔 →
     我做尺寸/命名/壓縮整理後入庫（一批 10–20 張來回即可）

## 4. 里程碑拆分

### M15 — 程式美術大改版（零外部資產，任何風格方向下都需要）
- 海圖視覺重繪：海岸線描邊與內陸陰影、深/淺海漸層與紋理、port 格徽章化、
  地圖底色與邊框裝飾（古典航海圖風）、裝飾羅盤（結合 M11 風向顯示）。
- UI 主題全面翻新：字體（標題襯線字型）、面板材質（CSS 漸層+SVG noise 做羊皮紙/木質感）、
  按鈕/表格/HUD 重設計、交易/酒館/造船面板排版升級。
- `<GameArt>` fallback 元件與 `public/art/` 管線落地（先全走 fallback）。
- **驗收**：無任何外部圖檔下，整體觀感明顯脫離「工程原型」；全 suite 綠；Playwright 截圖對比。

### M16 — 核心資產批次（P0：港口場景、航海士立繪、船圖）
- 產出第一批生圖訂單表（29–43 張）→ 依 §5 選定的工作流生產 → 整合進 M15 的管線。
- 港口停靠體驗重排版：場景橫幅＋設施分頁（市場/酒館/造船廠/學會/投資）。
- **驗收**：停靠任一港口有場景圖、酒館人物有臉、造船廠船有圖；缺圖 fallback 正常。

### M17 — 補完批次（P1/P2：標題視覺、戰鬥背景、會長立繪、事件卡、商品圖示）
- 第二批訂單表 + 整合；BattleScene 天氣背景；事件插圖卡；標題頁。
- **驗收**：從登入到勝利全程主要畫面皆有美術覆蓋；效能不退化（圖片 lazy load、webp）。

## 5. 待決策點（開工前需要確認）

1. **美術風格方向**（影響全部 prompt 與 M15 的 UI 方向）：
   A. 古典油畫×羊皮紙航海圖（沉穩、最貼近時代感）
   B. 日系動漫立繪×明亮海洋（人物表現力強）
   C. 復古像素風（工作量最低、風格自帶一致性）
   D. 水彩手繪繪本風（柔和、辨識度高）
2. **產圖工作流**：API 模式（提供 key）／訂單表模式（Manus/豆包人工）／
   公有領域館藏混搭（人物用古典肖像畫、UI 裝飾用古海圖掃描）／混用。

## 執行記錄（M15–M16 落地後回填，沿用 docs/09/10 慣例）

- **風格方向**：確定選 **A．古典油畫×羊皮紙**。M15 的 UI 主題（襯線標題字、木質面板
  ＋噪點材質、金線雙框、羅盤）已按此方向落地；`tools/artgen/manifest.mjs` 的
  `STYLE_PREFIX` 常數即 A 方向的 prompt 前綴，全部資產共用。
- **產圖工作流**：確定選 **API 模式，使用 Google AI Studio 的 Gemini API key**
  （`generativelanguage.googleapis.com`）。已於沙盒內測過連通性，非政策阻擋
  （未帶 key 時回應的是 Google 自己的 `PERMISSION_DENIED`，不是 proxy 拒絕頁）。
  `tools/artgen/generate.mjs` 動態探測帳號可用模型（優先 Imagen `:predict`，
  否則走支援圖片輸出的 Gemini `:generateContent`），不寫死特定型號名稱。
- **資產 id 慣例**（M15 程式已鎖定，與 §2 表格原始命名略有差異，以此為準）：
  - 港口場景：`port-scene/<regionId 去掉 "region." 前綴>-s<port.size>.webp`
    （P0 每海域先做 `s2` 一張代表圖共用；同海域的其他規模港口暫沿用同張或
    回退剪影，需要更細緻覆蓋時再補 `s1`/`s3`）
  - 航海士立繪：`portrait/<officer.portrait 去掉 "portrait." 前綴>.webp`
    （用的是 content 既有欄位值，不是 officer template 的 `key`）
  - 船級側視圖：`ship/<shipClassId 去掉 "ship." 前綴>.webp`——
    M16 新增整合點：`TavernShipyardPanel` 的艦隊船清單與建造船級選單預覽，
    先前 §3 規劃時船圖尚無任何 UI 整合點，此次一併補上。
- **P0 訂單表**：`tools/artgen/manifest.mjs`，29 筆（7 港口場景＋12 航海士＋10 船級），
  完整 prompt 已由 content 資料（`regions.ts`／`officersPool.ts`／`shipClasses.ts`）
  展開好，`node tools/artgen/generate.mjs --dry-run` 可預覽不耗配額。
- **P0 批次已完成落地**：Google Gemini／Imagen 這條路最終卡在帳號限制——免費層級的
  API key 對應專案，圖片類模型（Imagen `:predict` 與所有原生 Gemini 圖片輸出模型）
  配額皆為 0，需要專案開通計費才能用；改走 **Pollinations.ai**（使用者提供的
  API key）。因為這個 sandbox 的網路政策擋掉 `pollinations.ai`（proxy 在 CONNECT
  階段即回 403，經 `__agentproxy/status` 證實是政策阻擋，非帳號問題），新增
  `tools/artgen/generate-pollinations.mjs`（與 `generate.mjs` 共用同一份
  manifest，只是換一個生圖服務），由使用者在自己機器上執行，產出的 29 張 webp
  直接 push 回 `main`。全數核對：檔案格式/尺寸正確、風格與 A 方向（古典油畫×
  羊皮肌）一致、無文字浮水印/真實旗幟/真實地標，於 `/play/[worldId]` 實際頁面
  （港口橫幅、酒館頭像、造船廠船圖）render 正常，無 fallback 誤觸發。
- **M17 補完批次已完成落地**：`tools/artgen/manifest.mjs` 擴充到 52 筆（新增標題
  主視覺 ×1、戰鬥背景平靜/風暴/夜戰 ×3、NPC 商會會長立繪 ×5、事件插圖風暴/慶典/
  傳聞/發現/下錨探索/海賊 ×6、商品類別圖示 ×8），沿用同一套 Pollinations 管線，
  由使用者本機分批執行後 push 回 `main`。整合點：
  - `(auth)` 路由群組新增 `layout.tsx`，登入/註冊頁共用標題主視覺
  - `BattleScene` 依天氣（風暴醞釀→暴風海）＋tick 奇偶（簡易日夜判斷）挑戰鬥背景，
    標題列加海賊插圖
  - `InfluencePanel` 依商會名稱查對 `NPC_GUILD_TEMPLATES`，顯示對應會長立繪
  - `ExplorationPanel` 下錨成功／探索成功時顯示對應事件插圖
  - `TradePanel` 商品列前加分類圖示；世界事件（STORM/FESTIVAL/RUMOR）通知列同步加插圖
  - 全數 52 張資產核對：格式/尺寸正確、風格一致、無文字浮水印/真實旗幟/真實地標
  - 過程中順手修掉 `GameArt` 一個真實 race condition：靜態預渲染頁（登入/註冊）
    的 `<img>` 404 常在 React hydrate 掛上 `onError` 前就已完成，原生 error 事件
    被錯過、永久卡在破圖狀態；改成掛載後額外檢查 `img.complete + naturalWidth`
- **P0＋M17 全數 52 張資產已於 main 到齊**（`apps/web/public/art/`：7 港口場景、
  12＋5 人物立繪、10 船級、1 標題、3 戰鬥背景、6 事件、8 商品圖示）。M15–M17
  三個里程碑全數完成，遊戲從登入到勝利全程主要畫面皆有美術覆蓋；缺圖情境下
  （理論上不會發生，因資產已全數到齊）仍保有程式繪製 fallback 兜底。
