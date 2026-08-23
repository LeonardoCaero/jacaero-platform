# build context: repo root

FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
RUN npm ci

FROM deps AS build
COPY apps/backend apps/backend
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5433/placeholder"
RUN npm run build --workspace=apps/backend
RUN npm exec --workspace=apps/backend -- prisma generate

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=build /app/apps/backend/prisma.config.ts ./apps/backend/prisma.config.ts
COPY --from=build /app/apps/backend/package.json ./apps/backend/package.json
COPY apps/backend/docker-entrypoint.sh ./apps/backend/docker-entrypoint.sh
RUN chmod +x /app/apps/backend/docker-entrypoint.sh
WORKDIR /app/apps/backend
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
