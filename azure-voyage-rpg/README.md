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
- 額外加入 battle-bg/key-visual/portrait 圖庫與天候效果（雨幕、燈光、飛鳥），提升場景動畫密度。
- 每個場景可用 `SceneVisual.theme` 指定專屬動畫主題包（港務廳文件塵霧／酒館爐火煙霧／市場帆旗人流／佩爾蘭潮霧燈號）。
- 主題包支援 content 端可配置：場景可用 `SceneVisual.themePresetId` 引用 `packages/content/src/themePresets.ts` 的共用模板，並可透過 `SceneVisual.themeTemplate` 做局部覆寫；未指定時會回退到 `apps/web/src/game/sceneThemeTemplates.ts` 的主題預設。

## 上線前觀測性（P0/P1）

- 前端埋點與錯誤回報位於 `apps/web/src/lib/telemetry.ts`。
- 遊戲核心流程（互動、選項、轉場、等待、新開局）會送出結構化事件。
- 另有全域 `window.error` / `unhandledrejection` 監聽（`RuntimeMonitor`）補捉前端 runtime 例外。
- 透過環境變數控制：
  - `NEXT_PUBLIC_OBSERVABILITY_ENABLED=1`：啟用觀測事件
  - `NEXT_PUBLIC_OBSERVABILITY_ENDPOINT=https://...`：送往你的 collector（未設定時退回 console）

### P1.5 事件 schema 對照表

事件基礎欄位（所有事件共用）：

- `source`: `azure-voyage-rpg-web`
- `level`: `info | error`
- `event`: 事件名稱
- `timestamp`: ISO 時間
- `sessionId`: 單次遊玩 session id
- `pathname`: 前端路徑
- `payload`: 事件細節（見下表）

| event | level | payload keys |
| --- | --- | --- |
| `session.start` | info | `sceneId`, `day`, `phase`, `saveStatus` |
| `gameplay.interact.hit` | info | `hotspotId`, `sceneId`, `day`, `phase`, `nextNodeKind` |
| `gameplay.interact.miss` | info | `hotspotId`, `sceneId`, `day`, `phase` |
| `gameplay.continue` | info | `fromNodeKind`, `toNodeKind`, `sceneId`, `day` |
| `gameplay.choice.select` | info | `choiceIndex`, `toNodeKind`, `sceneId`, `day` |
| `gameplay.wait.advance_time` | info | `fromDay`, `fromPhase`, `toDay`, `toPhase`, `sceneId` |
| `gameplay.travel.scene` | info | `fromSceneId`, `toSceneId`, `day`, `phase` |
| `gameplay.travel.scene_failed` | error | `fromSceneId`, `toSceneId`, `errorName`, `errorMessage` |
| `gameplay.travel.area` | info | `fromAreaId`, `toAreaId`, `toSceneId`, `day`, `phase` |
| `gameplay.travel.area_failed` | error | `toAreaId`, `toSceneId`, `errorName`, `errorMessage` |
| `gameplay.new_game.confirmed` | info | `previousPlaythrough`, `previousDay`, `previousSceneId` |
| `gameplay.transition` | info | `kind`, `label`, `fromSceneId`, `toSceneId`, `day`, `phase` |
| `runtime.window.error` | error | `filename`, `line`, `column`, `errorName`, `errorMessage` |
| `runtime.window.unhandled_rejection` | error | `errorName`, `errorMessage` |

Schema 常數來源：`apps/web/src/lib/telemetry.ts` 的 `TELEMETRY_EVENT_SCHEMA`。

### P1.5 dashboard 查詢範本

> 假設資料表/索引內含欄位：`timestamp`, `event`, `level`, `sessionId`, `pathname`, `payload`（JSON）。

#### BigQuery（JSON payload）

```sql
-- 1) 每日錯誤率（error / all）
WITH base AS (
  SELECT DATE(timestamp) AS d, level
  FROM `project.dataset.telemetry_events`
  WHERE source = 'azure-voyage-rpg-web'
    AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 14 DAY)
)
SELECT
  d,
  COUNTIF(level = 'error') AS error_count,
  COUNT(*) AS total_count,
  SAFE_DIVIDE(COUNTIF(level = 'error'), COUNT(*)) AS error_rate
FROM base
GROUP BY d
ORDER BY d;
```

```sql
-- 2) 互動命中率（interact hit ratio）
SELECT
  DATE(timestamp) AS d,
  COUNTIF(event = 'gameplay.interact.hit') AS hit_count,
  COUNTIF(event IN ('gameplay.interact.hit', 'gameplay.interact.miss')) AS total_interact,
  SAFE_DIVIDE(
    COUNTIF(event = 'gameplay.interact.hit'),
    COUNTIF(event IN ('gameplay.interact.hit', 'gameplay.interact.miss'))
  ) AS hit_ratio
FROM `project.dataset.telemetry_events`
WHERE source = 'azure-voyage-rpg-web'
  AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 14 DAY)
GROUP BY d
ORDER BY d;
```

```sql
-- 3) 場景卡點排行（travel failed）
SELECT
  JSON_VALUE(payload, '$.toSceneId') AS to_scene_id,
  JSON_VALUE(payload, '$.errorMessage') AS error_message,
  COUNT(*) AS fail_count
FROM `project.dataset.telemetry_events`
WHERE source = 'azure-voyage-rpg-web'
  AND event IN ('gameplay.travel.scene_failed', 'gameplay.travel.area_failed')
  AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 14 DAY)
GROUP BY to_scene_id, error_message
ORDER BY fail_count DESC
LIMIT 20;
```

#### Datadog（Log/Analytics）

- Total events：`source:azure-voyage-rpg-web`
- Error events：`source:azure-voyage-rpg-web @level:error`
- Error rate 監控：`A = errors`, `B = total`, monitor 設 `A/B > 0.02`（可依實際調整）
- Travel failure Top list：`@event:(gameplay.travel.scene_failed OR gameplay.travel.area_failed)` group by `@payload.toSceneId`
- Runtime exceptions：`@event:(runtime.window.error OR runtime.window.unhandled_rejection)` group by `@payload.errorName`

#### Grafana Loki（LogQL）

```logql
# 1) 每 5 分鐘 error 事件速率
sum(rate({source="azure-voyage-rpg-web", level="error"}[5m]))
```

```logql
# 2) 轉場失敗速率
sum(rate({source="azure-voyage-rpg-web"} |= "gameplay.travel.scene_failed" [5m]))
+ sum(rate({source="azure-voyage-rpg-web"} |= "gameplay.travel.area_failed" [5m]))
```

```logql
# 3) runtime error 趨勢
sum(rate({source="azure-voyage-rpg-web"} |= "runtime.window.error" [5m]))
+ sum(rate({source="azure-voyage-rpg-web"} |= "runtime.window.unhandled_rejection" [5m]))
```

### P1.6 SLO / Alert 門檻預設

SLO 設定來源：`apps/web/src/lib/telemetry-slo.ts`（`SLO_DEFINITIONS`）。  
下表為預設值，上線穩定後可視實際量收緊。

| SLO ID | 名稱 | 視窗 | 門檻 | 觸發邏輯 | 嚴重度 |
| --- | --- | --- | --- | --- | --- |
| `slo.error_rate` | 整體 error rate | 5 min | > 3 % | error / all events | P1 |
| `slo.error_rate_hourly` | 整體 error rate（1 hr） | 60 min | > 2 % | error / all events | P2 |
| `slo.travel_fail_rate` | travel fail rate | 5 min | > 5 % | travel_failed / all_travel | P1 |
| `slo.runtime_exception_burst` | runtime exception burst | 5 min | > 10 次 | runtime.window.\* count | P1 |
| `slo.interact_hit_ratio` | interact 命中率下限 | 60 min | < 30 % | hit / (hit + miss) | P2 |

#### Datadog Monitor YAML（可直接貼 terraform / DD CLI）

```yaml
# SLO-1: Error rate (P1)
monitors:
  - name: "[azure-voyage-rpg] Error rate > 3%"
    type: log alert
    query: >
      logs("source:azure-voyage-rpg-web @level:error").rollup("count").last("5m")
        / logs("source:azure-voyage-rpg-web").rollup("count").last("5m") > 0.03
    message: |
      @slack-alerts 整體 error rate 超過 3%，請立即查看。
      Runbook：1. 查 runtime.window.error payload；2. 查 travel_failed toSceneId Top；3. 看 session.start.saveStatus。
    priority: 1
    thresholds: { critical: 0.03, warning: 0.02 }
    evaluation_delay: 0
    tags: [service:azure-voyage-rpg-web, slo:error_rate, env:prod]

  # SLO-2: Travel fail rate (P1)
  - name: "[azure-voyage-rpg] Travel fail rate > 5%"
    type: log alert
    query: >
      logs("source:azure-voyage-rpg-web @event:(gameplay.travel.scene_failed OR gameplay.travel.area_failed)").rollup("count").last("5m")
        / logs("source:azure-voyage-rpg-web @event:(gameplay.travel.scene OR gameplay.travel.area OR gameplay.travel.scene_failed OR gameplay.travel.area_failed)").rollup("count").last("5m") > 0.05
    message: |
      @slack-alerts Travel 失敗率超標，查 toSceneId 前幾名。
    priority: 1
    thresholds: { critical: 0.05, warning: 0.03 }
    tags: [service:azure-voyage-rpg-web, slo:travel_fail_rate, env:prod]

  # SLO-3: Runtime exception burst (P1)
  - name: "[azure-voyage-rpg] Runtime exception burst > 10 in 5m"
    type: log alert
    query: >
      logs("source:azure-voyage-rpg-web @event:(runtime.window.error OR runtime.window.unhandled_rejection)").rollup("count").last("5m") > 10
    message: |
      @slack-alerts Runtime exception burst（5 分鐘內超過 10 次）。
      查 payload.errorName 確認類型，查 payload.filename 定位 chunk。
    priority: 1
    thresholds: { critical: 10, warning: 5 }
    tags: [service:azure-voyage-rpg-web, slo:runtime_exception_burst, env:prod]
```

#### Grafana 告警規則（PromQL 等效）

```yaml
groups:
  - name: azure-voyage-rpg-web.rules
    interval: 1m
    rules:
      - alert: AzureVoyageRpgErrorRateHigh
        expr: >
          sum(rate(telemetry_events_total{source="azure-voyage-rpg-web",level="error"}[5m]))
          / sum(rate(telemetry_events_total{source="azure-voyage-rpg-web"}[5m])) > 0.03
        for: 2m
        labels: { severity: critical, slo: error_rate }
        annotations:
          summary: "Error rate > 3% (5m)"
          runbook: "查 runtime.window.error filename；查 travel_failed toSceneId"

      - alert: AzureVoyageRpgTravelFailHigh
        expr: >
          sum(rate(telemetry_events_total{source="azure-voyage-rpg-web",event=~"gameplay\\.travel\\.(scene|area)_failed"}[5m]))
          / sum(rate(telemetry_events_total{source="azure-voyage-rpg-web",event=~"gameplay\\.travel\\..*"}[5m])) > 0.05
        for: 2m
        labels: { severity: critical, slo: travel_fail_rate }
        annotations:
          summary: "Travel fail rate > 5% (5m)"

      - alert: AzureVoyageRpgRuntimeExceptionBurst
        expr: >
          sum(increase(telemetry_events_total{source="azure-voyage-rpg-web",event=~"runtime\\.window\\..*"}[5m])) > 10
        for: 0m
        labels: { severity: critical, slo: runtime_exception_burst }
        annotations:
          summary: "Runtime exception burst > 10 in 5m"

      - alert: AzureVoyageRpgLowInteractHitRatio
        expr: >
          sum(rate(telemetry_events_total{source="azure-voyage-rpg-web",event="gameplay.interact.hit"}[1h]))
          / sum(rate(telemetry_events_total{source="azure-voyage-rpg-web",event=~"gameplay\\.interact\\.(hit|miss)"}[1h])) < 0.30
        for: 5m
        labels: { severity: warning, slo: interact_hit_ratio }
        annotations:
          summary: "Interact hit ratio < 30% (1h) — 內容空窗偏多"
          runbook: "確認哪個 sceneId + hotspotId miss 最多；考慮加 P0 repeatable events"
```

## 用 Docker 一鍵試玩

純前端原型，不需要資料庫/佇列，存檔在瀏覽器 localStorage（含版本化封包與舊檔自動升級）：

```bash
docker compose up --build
```

等 `web` 印出 `Ready` 後，打開 http://localhost:3100 即可遊玩。想清掉容器就
`docker compose down`（沒有掛 volume，不會留下任何資料）。
