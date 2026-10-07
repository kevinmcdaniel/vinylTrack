# syntax=docker/dockerfile:1

# ── dev: what docker-compose.yml runs (source bind-mounted, nodemon) ──────────
FROM node:24-alpine AS dev
RUN mkdir /app
WORKDIR /app
COPY be/package.json be/tsconfig.json be/prisma.config.ts be/src ./
RUN chown -R node:node /app
USER node
RUN npm install
CMD ["npm", "run", "dev"]

# ── production (#60) ─────────────────────────────────────────────────────────
# Built on Debian trixie to match the distroless runtime's glibc.

# All dependencies, Prisma client generated, TypeScript compiled.
FROM node:24-trixie-slim AS build
WORKDIR /app
COPY be/package.json be/package-lock.json ./
RUN npm ci
COPY be/tsconfig.json be/tsconfig.build.json be/prisma.config.ts ./
COPY be/src ./src
# prisma.config.ts builds its URL through config.ts, which insists on a full
# config even though `generate` never connects. Placeholders, build-only.
RUN APP_ENV=development DB_HOST=build DB_PORT_INT=5432 DB_VINYLTRACK_NAME=build \
    DB_VINYLTRACK_USER=build DB_PASSWORD=build \
    npx prisma generate
RUN npx tsc -p tsconfig.build.json

# Runtime dependencies only. The prisma CLI and typescript are @prisma/client's
# optional peers *and* our devDependencies, so the lockfile marks them
# devOptional: only omitting both dev and optional leaves them out. The sole
# purely-optional runtime package is pg-cloudflare (Workers only).
FROM node:24-trixie-slim AS prod-deps
WORKDIR /app
COPY be/package.json be/package-lock.json ./
RUN npm ci --omit=dev --omit=optional --ignore-scripts

# Migration dependencies: runtime deps plus @prisma/client's peers, which is
# exactly the prisma CLI. No test or lint tooling. Install scripts stay on:
# @prisma/engines' postinstall fetches the native schema engine that
# `migrate deploy` needs (the runtime image can't download it as non-root).
FROM node:24-trixie-slim AS migrate-deps
WORKDIR /app
COPY be/package.json be/package-lock.json ./
RUN npm ci --omit=dev

# One-shot migration runner: Prisma CLI + schema + migrations, nothing else of
# the app. Runs `prisma migrate deploy` and exits.
FROM gcr.io/distroless/nodejs24-debian13:nonroot AS migrate
WORKDIR /app
COPY --from=build /app/package.json /app/prisma.config.ts ./
COPY --from=migrate-deps /app/node_modules ./node_modules
COPY --from=build /app/src/config.ts ./src/config.ts
COPY --from=build /app/src/prisma ./src/prisma
# config.ts requires a version in production, even just to migrate.
ARG VINYLTRACK_VERSION
ENV NODE_ENV=production VINYLTRACK_VERSION=${VINYLTRACK_VERSION} CHECKPOINT_DISABLE=1
CMD ["node_modules/prisma/build/index.js", "migrate", "deploy"]

# The API: compiled JS + runtime deps on distroless Node (no shell, no
# package manager, non-root).
FROM gcr.io/distroless/nodejs24-debian13:nonroot AS prod
WORKDIR /app
COPY --from=prod-deps /app/package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
ARG VINYLTRACK_VERSION
ENV NODE_ENV=production VINYLTRACK_VERSION=${VINYLTRACK_VERSION}
EXPOSE 3000
CMD ["dist/server.js"]
