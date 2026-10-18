# syntax=docker/dockerfile:1.7
# One image for the self-host stack: the web app (Next.js standalone), the
# worker and the migration runner. Built from the repository root.

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1 CI=1
RUN corepack enable && corepack prepare pnpm@11.20.0 --activate
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/core/package.json packages/core/
COPY packages/ui/package.json packages/ui/
COPY packages/mcp/package.json packages/mcp/
COPY packages/agent/package.json packages/agent/
RUN --mount=type=cache,id=sintr-pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
RUN SINTR_STANDALONE=1 pnpm --filter @sintr/web build && pnpm --filter @sintr/worker build

FROM node:${NODE_VERSION}-alpine AS runtime
# Chromium prints the weekly report to PDF (through playwright-core, with
# JavaScript off and no network). The report embeds its own fonts; DejaVu
# covers the person's words in scripts those fonts do not have.
RUN apk add --no-cache chromium font-dejavu
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 \
    SINTR_MIGRATIONS_DIR=/app/migrations SINTR_CHROMIUM_PATH=/usr/bin/chromium-browser \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
# The stdio bridge for local MCP clients (/sintr-mcp.mjs), bundled by the web build.
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
COPY --from=build --chown=node:node /repo/apps/worker/dist ./worker
COPY --from=build --chown=node:node /repo/packages/core/drizzle ./migrations
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
