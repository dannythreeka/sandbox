# 08 — Monorepo 結構與工具鏈

## 1. 目錄總覽

```
azure-voyage/
├── package.json                # pnpm workspace root（private）
├── pnpm-workspace.yaml         # packages: apps/*, packages/*
├── turbo.json                  # build/test/lint pipeline（shared → api/web 依賴序）
├── docker-compose.yml          # postgres + redis + api + web
├── .env.example
├── apps/
│   ├── api/                    # NestJS（結構見 02 §2）
│   │   ├── src/...
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # 以 03 為準
│   │   │   └── migrations/
│   │   └── test/               # e2e（supertest + testcontainers）
│   └── web/                    # Next.js（結構見 07 §1）
├── packages/
│   ├── shared/                 # ★ 前後端共用核心（無任何框架依賴、無 IO）
│   │   └── src/
│   │       ├── content/        # 靜態內容包（見 03 §4）
│   │       ├── rules/          # 純函式遊戲規則：pricing/movement/influence/battle/rng/pathfind
│   │       ├── schemas/        # 全部 Zod schema（JSONB、API DTO、WS payload）
│   │       ├── api/            # API 契約型別（由 schemas 推導）
│   │       ├── errors.ts       # 錯誤碼字典
│   │       └── i18n/zh-TW.ts   # 文案 key 表（模板文案、錯誤訊息）
│   ├── eslint-config/          # 共用 lint 設定
│   └── tsconfig/               # 共用 tsconfig base
└── tools/
    └── mapgen/                 # 地圖產生腳本（產出 content/map/hexmap.json）
```

## 2. 套件依賴規則（用 eslint import 規則強制）

```
web  ──► shared ◄── api
 │                   │
 └── 禁止 ──X──► api  └─ 禁止 ─X─► web
shared 禁止 import 任何框架（react/nest/prisma）；只允許 zod。
```

## 3. 關鍵依賴清單（版本由實作時鎖定 LTS/穩定版）

| 範疇 | 套件 |
|------|------|
| api | `@nestjs/core` `@nestjs/platform-fastify` `@nestjs/websockets` `socket.io` `@nestjs/bullmq` `bullmq` `ioredis` `prisma` `@prisma/client` `argon2` `@anthropic-ai/sdk` `pino` `redlock` `zod` |
| web | `next` `react` `pixi.js` `@pixi/tilemap` `zustand` `@tanstack/react-query` `socket.io-client` `tailwindcss` `howler` `next-intl` |
| dev | `turbo` `typescript` `vitest`（shared/web 單測）`jest`（api，Nest 慣例）`@playwright/test` `testcontainers` `eslint` `prettier` |

## 4. npm scripts 約定（root）

```
pnpm dev            # turbo run dev（docker-compose up -d db redis 後，api + web 並行）
pnpm build / lint / test
pnpm test:rules     # 只跑 shared 規則單測（最快回饋圈）
pnpm db:migrate     # prisma migrate dev
pnpm db:seed        # 建 demo 帳號 + demo 世界（固定 seed，開發用）
pnpm mapgen         # 重生成 hexmap.json（改地圖參數時）
```

## 5. CI（GitHub Actions）

`pull_request` 觸發：`lint → typecheck → test(shared) → test(api, 起 pg/redis service) → build → e2e 冒煙（Playwright，AI_ENABLED=false）`。main 分支另跑 docker image build。

## 6. 程式碼規範摘要

- TypeScript `strict: true`；禁 `any`（AI JSONB 邊界處用 `unknown` + zod parse）。
- 命名：contentId 用 `域.海域.名稱` 點分字串（`port.amber_gulf.aurelia`）；事件名 `server:*` / `client:*` / `battle:*`。
- 金額/數量一律整數；百分比計算用 shared 的 decimal 工具，禁止裸浮點比較。
- 每個 module 的 public surface 只有 service 與 events，controller 不含邏輯。
