# 07 — 前端架構（Next.js）

## 1. App Router 結構

```
apps/web/src/
├── app/
│   ├── (marketing)/page.tsx          # 首頁/介紹（RSC，SEO）
│   ├── (auth)/login/page.tsx
│   ├── (auth)/register/page.tsx
│   ├── (lobby)/worlds/page.tsx       # 存檔列表/新世界（RSC + client 表單）
│   └── play/[worldId]/page.tsx       # ★ 遊戲本體：'use client'，dynamic import GameRoot（ssr:false）
├── game/                             # 遊戲本體（與 app 路由解耦，純 client）
│   ├── GameRoot.tsx                  # 載入快照→建 socket→掛 provider→場景路由
│   ├── scenes/                       # 場景 = 互斥的頂層畫面狀態
│   │   ├── SeaScene/                 # 海圖航行（Pixi 主畫布 + HUD）
│   │   ├── PortScene/                # 港口（背景圖 + 設施選單 + 各面板）
│   │   ├── BattleScene/              # 海戰棋盤（Pixi）
│   │   └── EventModal/               # 事件上演（全場景共用覆蓋層）
│   ├── pixi/                         # PixiJS 封裝層（React 之外的世界）
│   │   ├── PixiApp.ts                # Application 生命週期、resize、ticker
│   │   ├── HexMapLayer.ts            # 地形 tilemap（@pixi/tilemap，含戰爭迷霧）
│   │   ├── FleetLayer.ts             # 船隻精靈 + tick 間插值動畫（1.5s 內平滑移動）
│   │   ├── RoutePreviewLayer.ts      # A* 預覽航線（shared 的 pathfind）
│   │   ├── BattleBoard.ts            # 海戰 hex 棋盤
│   │   └── bridge.ts                 # ★ Zustand ↔ Pixi 訂閱橋（Pixi 不進 React tree）
│   ├── stores/                       # Zustand（見 §2）
│   ├── net/
│   │   ├── apiClient.ts              # fetch 封裝：zod parse、Idempotency-Key、錯誤碼→i18n
│   │   ├── socket.ts                 # Socket.IO client：連線/重連/resync、事件→store dispatch
│   │   └── queries/                  # TanStack Query hooks（港口詳情、酒館、市場等按需資料）
│   ├── ui/                           # 面板元件（React+Tailwind，疊在 canvas 上）
│   │   ├── hud/                      # 金錢/日期/補給/速度控制/艦隊小卡
│   │   ├── port/                     # TradePanel, ShipyardPanel, TavernPanel, InvestPanel
│   │   ├── fleet/                    # FleetManager, CargoView, OfficerAssign
│   │   ├── market/                   # 價格表 + 走勢 sparkline（priceHistory）
│   │   ├── influence/                # 港口/海域佔有率視覺化（堆疊條 + 地圖著色）
│   │   ├── battle/                   # 行動選單、單位資訊卡、回合順序條
│   │   └── dialogue/                 # SSE 串流對話框
│   └── audio/                        # howler 封裝：BGM 分場景、SFX 事件表
├── lib/                              # auth token 管理、i18n(next-intl, 繁中)
└── styles/
```

## 2. 狀態管理分層（嚴格分工）

| 層 | 工具 | 內容 | 寫入者 |
|----|------|------|--------|
| 世界即時狀態 | Zustand `worldStore` | tick、艦隊位置/補給、活動事件、影響力摘要 | **只有 socket.ts**（WS 事件 reducer 式更新，帶 tick 序號防亂序） |
| 按需伺服器資料 | TanStack Query | 港口詳情、市場表、酒館、戰鬥快照 | query hooks；交易成功後 invalidate |
| 場景/UI 狀態 | Zustand `uiStore` | 當前 scene、開啟的面板、選中艦隊、地圖鏡頭 | UI 元件 |
| 玩家操作 | mutation hooks | 交易/造船/設航線… | REST 成功 → 樂觀更新 or invalidate |

原則：**WS 是世界狀態唯一寫入口**（REST 回應中的世界變化也會由後端再經 WS 廣播，前端 REST 只處理該操作的直接結果），避免雙源打架。

## 3. Pixi 與 React 的橋接（易錯點，實作者必讀）

- Pixi `Application` 在 `useEffect` 建立一次，存 ref；**不要**把 Pixi 物件放進 React state。
- `bridge.ts`：用 `worldStore.subscribe(selector, cb)` 訂閱切片 → 命令式更新精靈（位置插值、迷霧揭示）。React 只負責掛載 canvas 容器與疊 UI。
- tick 節奏器：`SeaScene` 掛載時啟動 `setInterval`（依速度檔 1.5s/0.75s/0.3s）發 `client:advance`；收到 `server:tick` 前不重複發（in-flight flag）；港口/戰鬥/事件抉擇中暫停節奏器。
- 資產：v1 美術用向量/簡約風 spritesheet（原創），`assets/` 下按 atlas 打包，PixiJS Assets loader 預載 + 場景級懶載。

## 4. 關鍵使用者流程（前端視角）

**航行**：SeaScene 點擊目標 → shared A* 算預覽 → `POST route` → 節奏器跑 → `server:tick` 更新位置（插值動畫）→ `server:arrival` → 切 PortScene。

**交易**：PortScene 開 TradePanel（query 拉市場）→ 購物車式加單 → 送出（Idempotency-Key）→ 回成交明細 → invalidate 市場 query + 金錢由 WS 更新 → sparkline 立即反映新價。

**事件抉擇**：`server:event` 帶 `choices` → EventModal 蓋場景、暫停節奏器 → `POST /events/:id/choose` → 結果敘事 → 恢復。

**斷線**：socket reconnect → `client:resync` → 全量快照覆蓋 worldStore →  UI toast「已重新同步」。

## 5. 效能與品質預算

- 首屏（lobby）LCP < 2s；遊戲資產分包，SeaScene 首包 < 3MB。
- Pixi 60fps；船隻 ≤ 50 精靈毫無壓力，地圖用 tilemap 批次渲染。
- 所有面板元件 Storybook 化（v1 可選）＋ Playwright e2e：登入→建世界→完成一筆交易→出港航行 3 tick（CI 冒煙測試）。
- 無障礙底線：面板可鍵盤操作、色彩對比 AA（影響力配色同時用圖樣區分）。
