# 22 — M28：主線劇情章節任務系統

> 對應使用者需求：「往大航海時代靠近」，接續 M27（提督成長）。docs/19 的比較
> 調查點出現況與大航海時代4最根本的類型差異——現況是純開放式沙盒經營，沒有
> 敘事驅動的推進感；UW4 骨子裡是有主線的角色扮演/冒險遊戲。本里程碑補上一條
> 原創主線任務鏈。

## 1. 設計

**單一原創主線，六個章節**（`packages/shared/src/content/questChapters.ts`），
從「初出茅廬」到「蒼瀾傳說」，呼應商會從新手到稱霸七海的完整歷程：

| # | 章節 | 目標 |
|---|---|---|
| 1 | 初出茅廬 | 完成第一筆交易 |
| 2 | 組建班底 | 艦隊招募滿 2 名航海士 |
| 3 | 海上見真章 | 贏得一場海戰 |
| 4 | 站穩腳跟 | 任一港口取得 20% 以上影響力 |
| 5 | 海道先驅 | 商會總資產達到 100,000 金幣 |
| 6 | 蒼瀾傳說 | 達成任一正式勝利條件 |

**關鍵設計決策：條件全部從既有可查詢狀態評估，不新增任何行動計數器**——
六個章節的判定分別對應：交易商譽（`PortInfluence.goodwill`，只會因交易累積）、
艦隊官員數、`Battle.status='PLAYER_WIN'` 筆數、`PortInfluence.share`、
「金幣＋船隻估值」（與 `VictoryService` 算法一致）、`GameWorld.status`。
只有「目前進行到第幾章」（`GameWorld.questChapter`）是新增的持久化狀態。

完成一個章節會：發放金幣／聲望獎勵、章節指標 +1、廣播一則原創過場敘事
（不是規則性的重複文案，六段各自獨立寫）。

## 2. 實作

- **Schema**：`GameWorld` 新增 `questChapter Int @default(0)`（新遷移
  `20260713133402_quest_chapters`）。
- **`apps/api/src/modules/quest/quest.service.ts`**（新模組）：`checkProgress()`
  比照 `VictoryService.checkVictory()` 的結構——讀目前章節、判定條件、達成則
  發獎勵＋推進＋emit `world.quest-chapter` domain event。
- **`world-tick.processor.ts`**：在既有 `victoryService.checkVictory()` **之後**
  緊接呼叫 `questService.checkProgress()`——順序刻意如此：`ch6`（正式勝利）的
  判定要讀「這個 tick 剛更新的 `world.status`」，兩者共用同一次 tick 迴圈才能
  同一 tick 內完成，玩家達成勝利與「蒼瀾傳說」章節完成過場會同時出現。
- **`WorldSnapshotSchema`**：新增 `quest: QuestProgressViewSchema`（目前章節
  index/總章節數/是否全部完成/目前章節的 id·標題·目標描述），`world.service.ts`
  的 `getSnapshot()` 組裝。
- **WS**：新事件 `SERVER_QUEST_CHAPTER`（`ServerQuestChapterPayload`：章節 id、
  標題、過場敘事、金幣／聲望獎勵、tick），`game.gateway.ts` 監聽
  `world.quest-chapter` 廣播。
- **前端**：
  - 遊戲頁首下方新增一則常駐的主線任務橫幅（`apps/web/src/app/play/[worldId]/page.tsx`），
    顯示「主線．第 X/6 章：標題 — 目標」，全部完成後顯示收尾文案。
  - `apps/web/src/game/QuestChapterCutscene.tsx`（新增）：章節完成時的全螢幕
    過場——標題、過場敘事、獎勵，5 秒逾時自動收尾（比照 `PortCutscene` 的
    ESC 跳過／自動收尾模式，但不綁定特定港口，視覺上獨立於港口進出過場）。

## 3. 不動的部分

- 既有勝利判定（`VictoryService`）、勝利畫面完全不變——`ch6` 只是在勝利發生的
  同一 tick 額外疊加一段主線收尾過場，不影響原本的勝負邏輯。
- 沒有新增任何會改變遊戲平衡的機制——章節獎勵金額刻意設定得比裡程碑本身的
  數值門檻小很多（例如 ch5 給 4000 金幣，門檻是 10 萬），純粹是敘事回饋。

## 4. 測試

- `apps/api/src/modules/quest/quest.service.spec.ts`（新增，8 則）：全部章節
  完成後不再判定；每個章節的條件邊界（差一點不算、剛好達標才推進）；達成時
  正確發獎勵、推進章節、emit 正確 payload。
- 真實環境端對端驗證（本機 Postgres + Redis + 真實 API/web server +
  Playwright）：註冊帳號、建立世界，確認初始顯示「第 1/6 章：初出茅廬」；
  完成一筆交易後出港（觸發 tick 推進），密集截圖捕捉到即時的章節完成過場畫面
  （「主線任務完成 / 初出茅廬」＋過場敘事＋「獲得 500 金幣．聲望 +5」）；
  重新整理頁面後確認橫幅正確顯示已推進到「第 2/6 章：組建班底」，且資料庫
  `GameWorld.questChapter` 正確為 1。

既有的 API 全部測試（20 個 suite、155 個測試）、`@azure-voyage/shared` 全部
測試（23 個檔案、168 個測試）、API/web `tsc --noEmit`、`next build` 全數維持
綠燈。
