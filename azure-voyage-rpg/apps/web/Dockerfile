# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
# 先只複製套件清單（package.json + lockfile），讓 `pnpm install` 這層只在
# 依賴真的變動時才失效，原始碼變動不會逼它重新解析/下載全部依賴。
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/engine/package.json ./packages/engine/package.json
COPY packages/content/package.json ./packages/content/package.json
COPY packages/tsconfig/package.json ./packages/tsconfig/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN --mount=type=cache,id=azure-voyage-rpg-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store

# 這層之後才複製原始碼；只有原始碼變動時才會重跑，上面的 install 層仍能
# 命中快取（cache mount 讓 pnpm store 也跨 build 保留在 Docker host 上）。
COPY packages/engine ./packages/engine
COPY packages/content ./packages/content
COPY packages/tsconfig ./packages/tsconfig
COPY apps/web ./apps/web
RUN pnpm --filter @azure-voyage-rpg/engine build \
 && pnpm --filter @azure-voyage-rpg/content build \
 && pnpm --filter @azure-voyage-rpg/web build

FROM node:22-alpine
RUN corepack enable
WORKDIR /repo
COPY --from=build /repo .
EXPOSE 3100
CMD ["pnpm", "--filter", "@azure-voyage-rpg/web", "start"]
