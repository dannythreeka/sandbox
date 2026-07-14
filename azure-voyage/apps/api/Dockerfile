# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
# 先只複製套件清單（package.json + lockfile），讓 `pnpm install` 這層只在
# 依賴真的變動時才失效——原本整包原始碼複製完才 install，改一行程式碼就要
# 重新解析/下載全部依賴，是這裡最大的建置時間浪費。
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/tsconfig/package.json ./packages/tsconfig/package.json
COPY apps/api/package.json ./apps/api/package.json
RUN --mount=type=cache,id=azure-voyage-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store

# 這層之後才複製原始碼；只有原始碼變動時才會重跑，上面的 install 層仍能命中
# 快取（同一台 Docker host 上，cache mount 讓 pnpm store 也跨 build 保留，
# 就算 lockfile 真的變了也不必整批重新下載——web 端 Dockerfile 用同一個
# cache id，`docker compose --profile full up --build` 同時建置兩個
# image 時，共用依賴只需下載一次）。
COPY packages/shared ./packages/shared
COPY packages/tsconfig ./packages/tsconfig
COPY apps/api ./apps/api
RUN pnpm --filter @azure-voyage/shared build && pnpm --filter @azure-voyage/api build
RUN pnpm --filter @azure-voyage/api --prod deploy /out
RUN cd /out && npx prisma generate

FROM node:22-alpine
WORKDIR /app
COPY --from=build /out .
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
