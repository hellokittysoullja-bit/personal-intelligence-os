FROM node:22.22.2-bookworm-slim AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /srv/pios

RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build

FROM node:22.22.2-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH"
WORKDIR /srv/pios

RUN corepack enable \
  && groupadd --system --gid 10001 pios \
  && useradd --system --uid 10001 --gid pios --create-home pios

COPY --from=build --chown=pios:pios /srv/pios /srv/pios
USER pios

# Выберите target в compose: api, worker или web. Миграции запускаются отдельной one-off командой.
FROM runtime AS api
EXPOSE 3001
CMD ["pnpm", "--filter", "@pios/api", "start"]

FROM runtime AS worker
EXPOSE 3002
CMD ["pnpm", "--filter", "@pios/worker", "start"]

FROM runtime AS web
EXPOSE 3000
CMD ["pnpm", "--filter", "@pios/web", "start"]
