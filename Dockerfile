# syntax=docker/dockerfile:1
# Production image: the API serving the built client (see PLAN.md, Deployment).
#   docker build -t secret-santa .
# Run it with compose.prod.yaml; SQLite lives on the /data volume.

ARG NODE_IMAGE=node:24.22.0-alpine3.24

# Toolchain for native modules (better-sqlite3) in case no prebuilt binary
# matches the platform; only the build stages carry it.
FROM ${NODE_IMAGE} AS toolchain
RUN apk add --no-cache python3 make g++
WORKDIR /app

# All workspace dependencies, for building client and server.
FROM toolchain AS deps
COPY package.json yarn.lock ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN yarn install --frozen-lockfile --network-timeout 600000

FROM deps AS client-build
COPY client client
RUN yarn workspace @secret-santa/client build

FROM deps AS server-build
COPY server server
RUN yarn workspace @secret-santa/server build

# Server runtime dependencies only (no client or dev packages).
FROM toolchain AS prod-deps
COPY package.json yarn.lock ./
COPY server/package.json server/package.json
RUN yarn install --frozen-lockfile --production --network-timeout 600000 \
  && yarn cache clean \
  && mkdir -p server/node_modules

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=8080 \
    DATABASE_PATH=/data/secret-santa.db
WORKDIR /app

COPY --from=prod-deps /app/node_modules node_modules
COPY --from=prod-deps /app/server/node_modules server/node_modules
COPY server/package.json server/package.json
COPY --from=server-build /app/server/dist server/dist
COPY --from=client-build /app/client/dist client/dist

# The node user owns /data so a fresh named volume is writable by the app.
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node

WORKDIR /app/server
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/api/health" || exit 1

# Migrations run on start (server.ts). The daily job (#18) reuses this image
# with a different command.
CMD ["node", "dist/server.js"]
