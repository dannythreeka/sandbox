# 10 — 航海體驗強化計畫（M11–M14）

> 回應 M10 後的玩家回饋方向：讓「航行本身」更有遊戲性與畫面感。
> 本文件是 M11–M14 的**執行規格**：機制公式、資料模型、API/WS 契約、驗收標準與 PR 拆分。
> 原則沿用 docs/09：每個里程碑一個 PR、結束時遊戲可運行可驗證、`AI_ENABLED=false` 全程可玩、
> 所有美術一律程式繪製原創圖形（禁用任何既有遊戲素材）、規則計算放 `packages/shared/src/rules/` 純函式＋單測。

> **執行記錄**：M11、M12 已完成，設計與下方規格一致，僅一處實務調整——M12
> 的預設出港航向改由前端在「玩家第一次按 ↑ 卻從未操舵過」時即時挑選
> （`firstNavigableHeading`），而非在 depart() 內硬性要求；`setHeading`
> 統一支援 DOCKED/SAILING/ANCHORED 三種狀態（與 `setRoute` 對稱），讓「方向鍵
> 預先瞄準再出港」與「航行中隨時轉舵」共用同一支端點。

## 總覽與依賴順序

| 里程碑 | 內容 | 依賴 | 一句話目標 |
|--------|------|------|-----------|
| M11 | 風向系統影響航速 | 無（資料已在 M1 埋好） | 航線規劃出現「順風/逆風」的策略深度 |
| M12 | 鍵盤即時操舵 | M11（操舵要看風） | 從「點目的地等結果」變成「自己開船」 |
| M13 | 港口進出過場動畫 | 無（純前端） | 出港/入港有儀式感的輕過場 |
| M14 | 海域天氣視覺效果 | M11（風紋用風向資料驅動） | 海面有生命感，抽象事件視覺化 |

建議執行順序：**M11 → M12 → M13 → M14**（M13 獨立，必要時可與 M12/M14 對調）。

向後相容總原則：Prisma 欄位一律 additive（nullable 或帶 default，舊存檔照玩）；
WS payload 新欄位一律 zod `optional`（舊前端不炸）；新常數全部進 `BALANCE`。

---

## M11 — 風向系統（風向影響航速）

### 現況資產（M1 已埋、從未接線）

- `regions.ts`：`SEASONS`（四季）、`WindDirection`（0–5，0=東、逆時針六向）、七海域各季主風向 `winds`、海域範圍 `bounds`。
- `movement.ts`：`fleetSpeed()` 註解明言「待海況/風系統上線後補上 wind_modifier」。
- docs/01 §4.1 原始公式：`N = base_speed × wind_modifier × condition_modifier`，順風 1.3 / 側風 1.0 / 逆風 0.6。

### 機制設計

1. **季節推導**（純函式 `seasonAtTick(tick)`）
   - `BALANCE.SEASON_TICKS = 90`（一年 360 天）。
   - `season = SEASONS[Math.floor(tick / SEASON_TICKS) % 4]`。
2. **海域歸屬**（純函式 `regionAt(coord)`）
   - 以 `RegionDef.bounds` 查找；多個命中取第一個，皆未命中取邊界距離最近者（地圖邊角防呆）。
3. **當日風向**（純函式 `windAtTick(regionId, tick, worldSeed)`）
   - 基準 = 該海域當季主風向；每日確定性擾動（shared `rng`，seed = `worldSeed ⊕ hash(regionId) ⊕ tick`）：
     60% 主風向、15% 左鄰向、15% 右鄰向、10% 其餘三向均分（`BALANCE.WIND_JITTER_TABLE`）。
   - **確定性**是硬需求：斷線重連一致、前後端可各自計算、可單測。
4. **風向修正表**（`BALANCE.WIND_MODIFIERS`）
   - 行進方位與風向的夾角檔位 `d = min(|dir−wind| mod 6, 6−(|dir−wind| mod 6))`：
     `d=0` 順風 **1.3** ／ `d=1` 側順 **1.15** ／ `d=2` 側風 **1.0** ／ `d=3` 逆風 **0.6**。
5. **移動整合**（`stepAlongRoute` 呼叫端）
   - 每 tick 取 route 目前段（`waypoints[cursor] → waypoints[cursor+1]`）的 hex 方位算單一 modifier，
     `budget = fleetSpeed(slowest, navBonus) × modifier`。
     （逐段換算更精確但複雜度不成比例；per-tick 單一 modifier 已足夠呈現順逆風差異，先簡後繁。）
   - **剩餘進位累積**：`Fleet.speedCarry Float @default(0)`（migration additive）。
     `budget += speedCarry`，tick 結束把未消耗掉的 budget 存回（上限 clamp 至一次滿額，防累積爆量）。
     解決逆風 0.6 × 慢船 budget 1 → 0.6 走不動一格的死路（M10 曾實測過 cost>budget 的凍結風險）。
   - 手動操舵（M12）沿用同一 modifier 管線。
6. **契約擴充**
   - `FleetTickDelta` 加 `wind?: { dir: number; modifier: number }`（玩家艦隊所在海域當日風向與對當前航向的修正）。
   - `WorldSnapshot.world` 加 `season?: Season`（HUD 顯示用；亦可前端自算，回傳只為單一事實來源）。
7. **UI**
   - HUD 加：海域名稱、季節、**風向羅盤**（六向箭頭 + 依 modifier 上色：綠=順、白=側、紅=逆）。
   - SeaMap 不需新繪製（M14 的風紋才做視覺化）；順逆風差異透過船速內插自然可感。

### 測試與驗收

- 單測：`seasonAtTick` 邊界（0、89、90、359、360）；`windAtTick` 同 seed 重現性 + 大樣本分布近似擾動表；
  modifier 夾角表全 24 組合；含風 `stepAlongRoute` 順風 vs 逆風 200 tick 行距比 ≈ 1.3/0.6；
  speedCarry 不變量（永不為負、永不超過單 tick 滿額、總行距不因進位丟失）。
- 驗收：同一條東西向長航線，夏季與冬季（主風向相反的海域）航行天數有可感差異；
  HUD 羅盤與伺服器 delta 一致；斷線重連後風向顯示不跳變；全 suite 綠。

### 平衡備註

逆風 0.6 會拉長航程、增加補給消耗——M10 的出港自動補滿已緩解斷糧；
若實測仍過苦，調 `WIND_MODIFIERS`（如逆風 0.7）而非改公式。

---

## M12 — 鍵盤即時操舵（自由操舵模式）

### 設計目標與架構決策

「自己開船」的操作感，與點擊尋路**並存、互斥、可隨時切換**。

方案比較（記錄決策理由）：
- **A. 舵向欄位（採用）**：後端仍是每 tick 權威推進，玩家只改「舵向」。改動小、無雙權威漂移、tick 制語意不變。
- B. 前端假移動+對帳（否決：位置雙權威必然漂移，M10 的教訓是位置只能有一個事實來源）。
- C. 每格即時指令流（否決：tick 制下無意義、徒增流量與競態面）。

### 機制設計

1. **資料模型**：`Fleet.heading Int?`（0–5 hex 方位，nullable、additive migration）。
   - 語意：`SAILING 且 route=null 且 heading≠null` ＝ 手動操舵模式；`route≠null` ＝ 自動尋路模式。兩欄位互斥（設 route 清 heading、設 heading 清 route，各自在同一次 update 原子完成——沿用 M10「原子收錨」的教訓，**絕不**拆兩個請求）。
2. **WS 契約**：新增 `client:steer` `{ worldId, fleetId, heading: 0–5 }`（zod 驗證 + 所有權檢查同 voyage 其他端點）。
   - steer 只寫單一欄位、最後值為準，與 `client:advance` 天然無競態；前端節流（每 150ms 至多一發）。
3. **手動推進**（`advanceOneTick` 分支）
   - 無 route 有 heading：沿 heading 走（budget 管線同 M11，含風向 modifier 與 speedCarry）。
   - 前方不可航行（陸地；暗礁**可**過、照 moveCost 減速）：停止移動並自動下錨 + tick notice「前方陸地，已緊急收帆下錨」。第一版不做滑牆繞行——簡單、可預期、不會把玩家開進奇怪的地方。
4. **操作對映**（僅海圖 focus 時攔截，不干擾表單輸入）
   - `←/→`（或 `A/D`）：逆時針/順時針轉一檔（60°，六向舵——hex 世界沒有微調角，文件明示）。轉舵時若在自動模式 → 立即切手動（route 清空）。
   - `↑/W`：出港（停靠中）或收錨啟航（下錨中），進入手動模式，heading 預設取目前船首方向。
   - `空白鍵`：下錨/收錨。`1–4`：航速檔（暫停/1x/2x/4x）。
   - 點擊海圖任意目標：切回自動尋路（既有 M10 流程）。
5. **出港放寬**：`depart` 的 `NO_ROUTE_SET` 改為「route 與 heading 皆無」才擋；帶 heading 的自由出港照常走自動補給。
6. **前端表現**：船 sprite 轉向**即時**（本地 rotation 立刻轉），位移仍等 tick delta（既有內插）——「轉向即時、位移權威」。
   HUD 模式指示（自動航行 ⇄ 手動操舵）+ 舵向/風向疊加羅盤（配 M11：搶順風是操舵的核心樂趣）。
7. **照常生效**：補給消耗、遭遇擲骰、事件、探索——手動模式不是安全模式。
8. **契約擴充**：`FleetTickDelta` 加 `heading?: number | null`。

### 測試與驗收

- 單測:steer 驗證（方位範圍、權限、非 SAILING/ANCHORED 拒絕）；手動推進直線行距=自動模式同向行距；
  撞陸地自動下錨 + route/heading 清理；模式互斥（設 route 清 heading、反之亦然，單次 update 內完成）；
  自由出港觸發補給。
- e2e（Playwright）：鍵盤操舵繞過一個海岬入港：`W` 出港 → `←/→` 轉向數次 → 沿岸航行 → 點擊港口切自動 → 入港。
  全程斷言 UI 模式指示與實際行為一致。
- 驗收：手動模式下 200 tick 整合測試不變量（補給、位置合法性）通過；全 suite 綠。

---

## M13 — 港口進出過場動畫

### 範圍界定（先說不做什麼）

- 不做：美術圖檔、3D、港內步行/人物街景、音效（音效歸 M6 遺留的打磨線）。
- 做：**程式繪製 + CSS/Pixi 動畫的輕過場**，一律可跳過（點擊/ESC 單次跳過；設定「永久跳過」存 localStorage）。

### 內容設計

1. **出港過場**（約 2.5s，React 全屏 overlay）
   - 港名牌匾淡入（港名 + 「第 N 日 啟航」）。
   - **程式生成港口剪影**：以 `hash(portId)` 為 seed 確定性生成碼頭 + 建築輪廓（Canvas/SVG 折線 + 漸層），
     `PortDef.size 1–3` 決定建築密度與碼頭長度——每港外觀固定且彼此不同，零美術資產。
   - 帆船剪影（M10 的船形放大版）自碼頭滑出畫面 + 少量海鷗粒子。
   - 過場結束：海圖鏡頭從港口位置平滑 zoom-out 回艦隊（既有 world.scale/position lerp 基建）。
2. **入港過場**（約 2s）
   - 收到 `server:arrival`：海圖鏡頭先 zoom-in 至港口 → 白幕淡入 → 牌匾（港名 + 「第 N 日 抵達」）
     + **本次航程摘要**：航行天數、消耗糧水、途中事件數（前端自出港起累計，不需後端改動）。
   - 淡出後進入既有停靠面板。
3. **狀態機**（純前端，後端無感知）
   - `DOCKED →(depart)→ CUTSCENE_OUT → SAILING`；`SERVER_ARRIVAL → CUTSCENE_IN → DOCKED 面板`。
   - 過場期間**暫停 advance 節奏器**（2 秒多的世界暫停，與「暫停」檔語意一致，無資料面副作用）。
4. **實作層**：React overlay（absolute 全屏 div + CSS keyframes）為主；Pixi 只負責鏡頭 zoom。
   剪影生成器放 `apps/web/src/game/portSilhouette.ts`，輸出確定性頂點序列（可單測）。

### 測試與驗收

- 單測：剪影生成確定性（同 portId 同輸出）、不同 size 頂點數遞增。
- e2e：出港與入港各出現過場一次；ESC 跳過即時生效；「永久跳過」後不再出現；過場中節奏器無 advance 發出。
- 驗收：過場不阻塞錯誤處理（depart 失敗不進過場）；斷線重連落在過場中不卡死（逾時自動收尾）；全 suite 綠。

---

## M14 — 海域天氣視覺效果

### 設計目標

把抽象機制視覺化（風向看得到、風暴有預兆），海面有生命感；附帶一層**輕量**天氣機制銜接既有事件系統。

### 機制設計（輕量、全部進 BALANCE 可調）

1. **每日天氣**（純函式 `weatherAtTick(regionId, tick, worldSeed)`，管線同 M11 風向，確定性）
   - 狀態：`CLEAR / BREEZE / FOG / STORM_BREWING`。
   - 機率表按海域 `danger` 加權（例：danger 0.1 → 風暴醞釀 4%；danger 0.5 → 12%；`BALANCE.WEATHER_TABLE`）。
2. **數值效果**（刻意輕微）
   - `BREEZE`：航速 ×1.05。
   - `FOG`：遭遇率 +10%、探索成功率 −10%（接既有 encounter/discovery 機率入口）。
   - `STORM_BREWING`：風暴事件機率 ×2（接既有 `event.service` 風暴；風暴仍是事件，天氣只是預兆）。
3. **契約擴充**：`FleetTickDelta` 加 `weather?: WeatherKind`（玩家所在海域當日天氣）。

### 視覺設計（Pixi、全程式繪製、可關閉）

- **海面波光**：深海格上低密度白點粒子緩慢閃爍（視口裁剪，只畫可見區）。
- **風紋**（M11 資料驅動）：沿當日風向緩慢平移的短弧線粒子——風「看得見」，操舵（M12）時直接目測風向。
- `FOG`：半透明灰白 overlay + 視野邊緣暗角；`STORM_BREWING`：色調濾鏡壓暗 + 斜向雨絲粒子 + 偶發閃光；`BREEZE`：波光密度提高。
- 風暴事件實際觸發（`server:event`）當下：全屏短促震動 + 閃白一幀。
- **效能守則**：粒子總量上限常數化；視口外不更新；設定面板提供「關閉天氣特效」開關（localStorage）。

### 測試與驗收

- 單測：`weatherAtTick` 確定性與分布；FOG/STORM_BREWING 對遭遇率/事件率的修正係數；BREEZE 航速修正。
- e2e：冒煙級——航行數十 tick 截圖確認 canvas 正常渲染、HUD 天氣字樣與 delta 一致（粒子效果以截圖人工確認，文件明示此限制）。
- 驗收：關閉特效開關後 FPS 無粒子負擔；`weather` 欄位缺席時舊前端不炸（zod optional）；全 suite 綠。

---

## 新增常數與 schema 變更總表

| 類別 | 名稱 | 值（初版） | 里程碑 |
|------|------|-----------|--------|
| BALANCE | `SEASON_TICKS` | 90 | M11 |
| BALANCE | `WIND_MODIFIERS` | [1.3, 1.15, 1.0, 0.6]（夾角 0–3 檔） | M11 |
| BALANCE | `WIND_JITTER_TABLE` | 主 60%／左右鄰各 15%／其餘均分 10% | M11 |
| BALANCE | `WEATHER_TABLE` | 按海域 danger 加權的四態機率表 | M14 |
| BALANCE | `WEATHER_BREEZE_SPEED` | 1.05 | M14 |
| BALANCE | `WEATHER_FOG_ENCOUNTER` | +0.10 | M14 |
| BALANCE | `WEATHER_STORM_EVENT_MULT` | 2.0 | M14 |
| Prisma | `Fleet.speedCarry Float @default(0)` | additive | M11 |
| Prisma | `Fleet.heading Int?` | additive | M12 |
| WS | `client:steer` | 新事件 | M12 |
| WS | `FleetTickDelta.wind? / heading? / weather?` | zod optional | M11/M12/M14 |

## 每-PR 檢查清單（沿用 docs/09 並補充）

1. 對照本文件該里程碑的驗收標準逐條自驗，PR 描述列出結果。
2. 新增規則計算＝shared 純函式＋單測；所有隨機必須是「world seed 派生的確定性隨機」。
3. Playwright 實機全流程驗證至少一輪，關鍵畫面附截圖。
4. Prisma migration 僅 additive；WS 新欄位僅 optional；`AI_ENABLED=false` 回歸全綠。
5. 位置/狀態只有伺服器一個事實來源；跨欄位狀態轉換必須單次原子 update（M10 錨死競態的教訓）。
6. 禁止任何既有商業遊戲的名稱/文本/素材；所有視覺一律程式繪製。
