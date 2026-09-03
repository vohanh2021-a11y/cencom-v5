# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/*/package*.json ./packages/
RUN npm ci
COPY . .
RUN npm run build --workspace=@cencom/web

# Stage 2: Runner (standalone)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Copy standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./.next/static
COPY --from=builder /app/apps/web/public ./public
# Copy db migration/seed scripts
COPY --from=builder /app/packages/db ./db
COPY --from=builder /app/scripts ./scripts
EXPOSE 3000
CMD ["node", "server.js"]