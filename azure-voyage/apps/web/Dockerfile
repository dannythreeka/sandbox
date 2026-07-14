# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# 先只複製套件清單（package.json + lockfile），讓 `pnpm install` 這層只在
# 依賴真的變動時才失效——原本整包原始碼複製完才 install，改一行程式碼就要
# 重新解析/下載全部依賴，是這裡最大的建置時間浪費（web 的依賴比 api 重，
# 這一步原本要 80 秒以上）。
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/tsconfig/package.json ./packages/tsconfig/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN --mount=type=cache,id=azure-voyage-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store

# 這層之後才複製原始碼；只有原始碼變動時才會重跑，上面的 install 層仍能命中
# 快取（cache mount 讓 pnpm store 也跨 build 保留，就算 lockfile 真的變了
# 也不必整批重新下載）。
COPY packages/shared ./packages/shared
COPY packages/tsconfig ./packages/tsconfig
COPY apps/web ./apps/web
RUN pnpm --filter @azure-voyage/shared build && pnpm --filter @azure-voyage/web build

FROM node:22-alpine
RUN corepack enable
WORKDIR /repo
COPY --from=build /repo .
EXPOSE 3000
CMD ["pnpm", "--filter", "@azure-voyage/web", "start"]
