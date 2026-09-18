# syntax=docker/dockerfile:1.7
# Daily Plate application image. Build for the Pi's verified architecture, e.g.
#   docker buildx build --platform linux/arm64 -t daily-plate:<version> .
# better-sqlite3 loads its prebuilt Node-API binary for the image platform
# (pnpm-workspace.yaml keeps pnpm from compiling it); node_modules are installed
# inside the image for that platform, never copied from an x86 host into an ARM64 image.

FROM node:24.21.0-bookworm-slim AS build
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 CI=1
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate
WORKDIR /src
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY packages/domain/package.json packages/domain/
COPY packages/contracts/package.json packages/contracts/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile
COPY packages ./packages
COPY apps ./apps
ARG DP_VERSION=0.1.0
ENV DP_VERSION=${DP_VERSION}
RUN pnpm --filter @daily-plate/domain run build \
  && pnpm --filter @daily-plate/contracts run build \
  && pnpm --filter @daily-plate/server run build \
  && pnpm --filter @daily-plate/web run build
RUN pnpm --filter @daily-plate/server --prod deploy --legacy /out/server

FROM node:24.21.0-bookworm-slim AS runtime
ARG DP_VERSION=0.1.0
ENV NODE_ENV=production \
    DP_VERSION=${DP_VERSION} \
    DP_DATA_DIR=/data \
    DP_WEB_DIST=/app/web \
    DP_HOST=127.0.0.1 \
    DP_PORT=8787
RUN groupadd -r plate && useradd -r -g plate -d /app -s /usr/sbin/nologin plate \
  && mkdir -p /data && chown plate:plate /data
WORKDIR /app
COPY --from=build --chown=plate:plate /out/server /app
COPY --from=build --chown=plate:plate /src/apps/web/dist /app/web
USER plate
VOLUME ["/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
