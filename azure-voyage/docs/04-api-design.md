# 04 — API 設計（REST + WebSocket 契約）

- 所有 REST 路徑前綴 `/api/v1`。認證後端點皆需 `Authorization: Bearer <jwt>`。
- 回應格式統一：`{ ok: true, data }` / `{ ok: false, error: { code, message, details? } }`。
- 每個端點的 request/response 型別在 `packages/shared/src/api/` 以 Zod schema 定義並由前後端共用（前端 client 由此生成型別，後端 pipe 由此驗證）。以下僅列語意與關鍵欄位。

## 1. 認證 `auth`

| Method | Path | 說明 |
|--------|------|------|
| POST | `/auth/register` | `{email, password, displayName}` → user + tokens |
| POST | `/auth/login` | → `{accessToken, refreshToken}` |
| POST | `/auth/refresh` | refresh 換新 access |

## 2. 存檔 `worlds`

| Method | Path | 說明 |
|--------|------|------|
| GET | `/worlds` | 我的存檔列表（含摘要：tick、資產、進度） |
| POST | `/worlds` | 建新世界 `{name, difficulty}`（流程見 03 §5） |
| GET | `/worlds/:id` | 世界完整快照（進入遊戲時的初始載入，見 §8） |
| DELETE | `/worlds/:id` | 放棄存檔（軟刪 → status=ABANDONED） |

## 3. 艦隊與航行 `fleets` / `voyage`

| Method | Path | 說明 |
|--------|------|------|
| GET | `/worlds/:wid/fleets` | 我的所有艦隊 |
| POST | `/worlds/:wid/fleets` | 新建艦隊（需在港、有閒置船） |
| PATCH | `/worlds/:wid/fleets/:fid` | 改名、重編船隻/航海士職位 |
| POST | `/worlds/:wid/fleets/:fid/route` | 設定/變更航線 `{waypoints}` → 後端驗證可通行性後存檔；`activity=SAILING` |
| POST | `/worlds/:wid/fleets/:fid/depart` | 出港（檢查補給警告；帶 `confirm` 旗標） |
| POST | `/worlds/:wid/fleets/:fid/anchor` | 海上下錨/取消 |
| POST | `/worlds/:wid/fleets/:fid/explore` | 在探索點發起探索檢定 |
| POST | `/worlds/:wid/fleets/:fid/supply` | 在港購買糧水 `{food, water}` |

## 4. 港內行動 `ports`

進港由 tick 引擎判定（艦隊抵達港口格）並經 WS 通知；以下皆要求艦隊 `DOCKED` 於該港。

| Method | Path | 說明 |
|--------|------|------|
| GET | `/worlds/:wid/ports/:portId` | 港口詳情：市場、設施、影響力分布、酒館人物 |
| POST | `/worlds/:wid/ports/:portId/trade` | 交易 `{fleetId, orders: [{commodityId, side: BUY\|SELL, quantity}]}` → 逐筆撮合，回成交明細與新價格（原子性：任一筆失敗全退） |
| POST | `/worlds/:wid/ports/:portId/invest` | 投資設施 `{facility, amount}` → 影響力/繁榮度變化 |
| POST | `/worlds/:wid/ports/:portId/shipyard/build` | 造船 `{shipClassId, name}` |
| POST | `/worlds/:wid/ports/:portId/shipyard/refit` | 改裝 `{shipId, fitting}` |
| POST | `/worlds/:wid/ports/:portId/shipyard/repair` | 修理 `{shipId \| fleetId}` |
| POST | `/worlds/:wid/ports/:portId/shipyard/sell` | 賣船 |
| GET | `/worlds/:wid/ports/:portId/tavern` | 酒館：可招募航海士、傳聞（事件鉤子）、委託 |
| POST | `/worlds/:wid/ports/:portId/tavern/recruit` | 招募 `{officerId}`（可能回 `REQUIRES_QUEST`） |
| POST | `/worlds/:wid/ports/:portId/guild-hall/register-discovery` | 登錄發現物 `{discoveryRecordId}` → 獎勵 |

## 5. 海戰 `battles`（建立走 WS 事件，行動走 WS，查詢走 REST）

| Method | Path | 說明 |
|--------|------|------|
| GET | `/worlds/:wid/battles/:bid` | 戰鬥快照（重連恢復用） |

## 6. AI 對話（SSE）

| Method | Path | 說明 |
|--------|------|------|
| POST | `/worlds/:wid/dialogue` | `{npcType: OFFICER\|TAVERN_MASTER\|GUILD_ENVOY, targetId, message}` → SSE 串流回覆。伺服器注入人設與世界上下文，見 06 §5 |

## 7. WebSocket 事件契約（Socket.IO，namespace `/game`）

連線握手帶 JWT；`join` 後加入房間 `world:{worldId}`。

### Client → Server

| event | payload | 說明 |
|-------|---------|------|
| `client:join` | `{worldId}` | 進入世界房間 |
| `client:advance` | `{worldId, ticks: 1}` | 請求推進 tick（前端節奏器發送；伺服器有上限保護：單請求 ≤ 7 tick，且 world 忙碌時回 `WORLD_BUSY`） |
| `client:resync` | `{worldId, lastTick}` | 斷線重連補狀態 |
| `battle:action` | `{battleId, unitId, action}` | 海戰行動（Zod: BattleActionSchema：move/fire/board/repair/flee） |

### Server → Client（皆帶 `tick` 序號）

| event | payload 摘要 | 說明 |
|-------|--------------|------|
| `server:tick` | `{tick, fleets: [{id, pos, food, water, morale}], notices: []}` | 每 tick 的增量狀態 |
| `server:arrival` | `{fleetId, portId}` | 抵港（前端切港口場景） |
| `server:event` | `{eventId, type, narrative, choices?}` | 事件上演；`choices` 存在時需玩家抉擇（回 REST `POST /worlds/:wid/events/:eid/choose`） |
| `server:battle-start` | `{battleId, snapshot}` | 進入海戰 |
| `battle:update` | `{battleId, round, state 差分, log}` | 每步行動後廣播 |
| `battle:end` | `{battleId, result, spoils}` | 戰鬥結束 |
| `server:market-pulse` | `{portId, changes: [{commodityId, price}]}` | 玩家關注中港口的價格變化（訂閱制，省流量） |
| `server:influence-update` | `{portId, shares}` | 影響力變化 |
| `server:npc-action` | `{guildId, summary}` | NPC 商會的可見動作（艦隊出沒、投資新聞）— 情報層 |
| `server:resync` | 完整快照 | 回應 `client:resync` |

## 8. 世界快照（`GET /worlds/:id`）結構

前端進入遊戲的一次性載入，之後靠 WS 增量：

```ts
interface WorldSnapshot {
  world: { id; name; tick; difficulty; status; contentVersion };
  playerGuild: { id; gold; fame };
  fleets: FleetView[];            // 含船、貨、航海士
  knownPorts: PortSummary[];      // 已知港口（迷霧：未到過的港只有名字與座標）
  activeEvents: EventView[];
  npcGuilds: NpcGuildPublicView[]; // 只給公開情報（名稱/顏色/聲望），不洩策略
  victoryProgress: { regionsDominated; relicsFound; totalAssets };
}
```

## 9. 冪等與併發規範

- 交易、造船、投資等寫端點必帶 `Idempotency-Key` header（前端每次操作生成 uuid），後端以 Redis `SETNX` 60 秒去重，防連點與重試重扣款。
- 寫操作使用 world 級 Redis 鎖與 tick 引擎互斥（見 02 §4）；被鎖時回 `WORLD_BUSY`，前端靜默重試 ≤ 3 次。
