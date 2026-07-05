FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @azure-voyage/shared build && pnpm --filter @azure-voyage/web build

FROM node:22-alpine
RUN corepack enable
WORKDIR /repo
COPY --from=build /repo .
EXPOSE 3000
CMD ["pnpm", "--filter", "@azure-voyage/web", "start"]
