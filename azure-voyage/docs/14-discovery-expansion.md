# 14 — 探索／發現系統擴充（M22）

> 回應玩家願望清單第一項：「更豐富的探索/發現系統（原創的珍稀發現物、圖鑑）」。

## 1. 發現物內容擴充（12 → 23）

原本 12 件發現物全部集中在南半部（暮色洋／子午之海／珊瑚環弧／鐵崖海岸南緣），
北環海、琥珀灣、絹風海峽三個海域完全沒有任何發現物可探索。新增 11 件，補齊這些
海域，並讓探索體驗真正涵蓋整張海圖，而不是只有南方值得跑一趟：

| 海域 | 新增數量 | 風味 |
|------|---------|------|
| 北環海 | 3 | 極地／冰封主題（凍浪礁群、冰刃鯨群、霜封殘骸） |
| 琥珀灣 | 2 | 文明中心的沉沒遺跡（沉沒學院、灣區暗流） |
| 絹風海峽 | 3 | 織品之路的商隊軼事（絲道商隊殘跡、萬鏡淺灘、彩羽海鳥群棲地） |
| 鐵崖海岸北緣 | 1 | 磁鐵暗礁 |
| 子午之海北緣 | 1 | 海賊王的沉船（新增 S 級） |
| 珊瑚環弧 | 1 | 南天星域鏡池（新增 S 級） |

座標經程式篩選：位於可航行海格（非陸地）、與最近港口距離 ≥5 格、彼此間盡量分散
（farthest-point 取樣），並通過既有的 `discoveries.test.ts` 幾何驗證
（不重疊港口格、不落在陸地）。

每件發現物新增 `description`（圖鑑基礎描述，原創撰寫，找到後即可見）。

## 2. 圖鑑敘事生成（NARRATIVE_GEN，接上 docs/01 §4.6 原始規劃）

`DiscoveryRecord.narrative` 欄位在 schema 裡從 M1 就存在（註解寫著「AI 圖鑑文本，
一次生成後固化」），但實際上從未被寫入或讀出——圖鑑敘事生成一直是規劃了但沒接上
的功能。M22 補上：

- 新增 `DiscoveryNarrativeService`（`apps/api/src/modules/ai/discovery-narrative.service.ts`），
  沿用既有 PERSONA/DIALOGUE 的 AI + fallback 模式：`AI_ENABLED=false` 或呼叫失敗時，
  依發現物類別（地理/生物/遺跡/天象）從模板池挑一句敘事，遊戲永遠不因 AI 停擺而
  卡關（docs/06 §2 鐵律 2）。
- `explore()` 成功找到發現物後，先在交易內完成 `DiscoveryRecord` 建立與艦隊補給
  扣除；交易提交後才呼叫 AI 生成敘事並回寫 `narrative` 欄位——刻意不放進交易，
  避免拿著資料庫交易等網路 I/O。敘事生成失敗也不影響探索本身已經成功的事實。
- 敘事文本一次生成、固化存檔，同一世界內不會重複呼叫 AI（成本與一致性考量，
  docs/01 §4.6 原始設計）。

## 3. 圖鑑（Codex）UI

新增 `GET /worlds/:worldId/discoveries/codex`，回傳「全部」發現物（不只是已找到
的），未找到的項目只回傳 category/rarity，不洩漏名稱與獎勵（前端顯示為剪影
「？？？」）。前端新增 `DiscoveryCodexPanel`（彈窗），從主畫面頂列的「圖鑑」按鈕
開啟，顯示蒐集進度（X/23）、已找到項目的描述與 AI 敘事、未找到項目的剪影提示。

原本的 `DiscoveryPanel`（學會分部登錄面板）維持不變，只負責「已找到、待登錄」的
列表與登錄操作；圖鑑是新增的、涵蓋範圍更完整的瀏覽介面。

## 4. 傳世遺物蒐集勝利條件（RELIC_COLLECTOR）

docs/01 §2 原本就寫了「收集 12 件傳世遺物級發現物」是勝利條件之一，但
`VictoryService` 實際上只實作了海域霸權與總資產兩種——這個條件從未真正接上。
M22 補上：

- `BALANCE.VICTORY_RELICS_REQUIRED = 3`（對應內容規模，全部 3 件 S 級發現物）。
- `RELIC_DISCOVERY_IDS`（`packages/shared/src/content/discoveries.ts`）：S 級發現物
  id 清單，供勝利判定與快照統計共用。
- `VictoryService.checkVictory()`：海域霸權、總資產都未達成時，檢查已登錄的 S 級
  發現物數量是否達到門檻，達成則以 `RELIC_COLLECTOR` 原因結束世界。
- `WorldSnapshot.victoryProgress.relicsFound`：原本統計「全部已登錄發現物數」，
  語意其實對不上「relics」這個名字；改成統計「已登錄的 S 級發現物數」，
  和 §2 的文件用語、勝利判定邏輯一致。前端頂列新增「傳世遺物 X/3」進度顯示。

## 5. 測試

- `packages/shared`：`discoveries.test.ts`（幾何驗證，涵蓋全部 23 件）全綠。
- `apps/api`：`discovery.service.spec.ts`（explore/register 流程，含 narrative
  mock）、`victory.service.spec.ts`（新增 RELIC_COLLECTOR 達成/未達成兩案例）、
  `world.service.spec.ts`（既有案例維持綠燈，`relicsFound` 查詢邏輯改變但介面
  不變）全數通過。
- `apps/web`：`next build` 通過型別檢查與靜態頁面產生。
