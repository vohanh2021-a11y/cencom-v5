# syntax=docker/dockerfile:1

# ============================================================
# BUILD STAGE — build Next.js standalone output
# ============================================================
FROM node:20-slim AS builder
WORKDIR /app

# Debian native glibc — không cần libc6-compat (chỉ Alpine musl mới cần)

# Copy manifest trước để tận dụng layer cache
COPY package.json package-lock.json ./
RUN npm ci

# Copy toàn bộ source (node_modules/.next bị loại bởi .dockerignore)
COPY . .

# Build ra .next/standalone (next.config.js đã bật output:'standalone')
RUN npm run build

# Đảm bảo thư mục public tồn tại (Next sẽ copy vào standalone nếu có)
RUN mkdir -p /app/public

# ============================================================
# MCP STAGE — server AI (mcp-server/http.ts) cho Onpremise/docker-compose.yml
# Standalone trace KHÔNG gom source .ts → phải COPY lib/ + mcp-server/ +
# full node_modules builder (MCP SDK là devDep của app — runner prod-slim thiếu).
# ============================================================
FROM node:20-slim AS mcp
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g tsx@4 && npm cache clean --force
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/mcp-server ./mcp-server
COPY --from=builder /app/lib ./lib
RUN groupadd -r nodejs && useradd -r -g nodejs mcprun
RUN chown -R mcprun:nodejs /app
USER mcprun
EXPOSE 3001
CMD ["npx", "tsx", "mcp-server/http.ts"]

# ============================================================
# RUNTIME STAGE — slim image chạy server.js
# ============================================================
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Chạy với user non-root
RUN groupadd -r nodejs && useradd -r -g nodejs nextjs

# 1) Standalone server output (chứa server.js, node_modules, .next nội bộ)
COPY --from=builder /app/.next/standalone ./

# 2) Static assets (copy riêng vì không nằm trong standalone)
COPY --from=builder /app/.next/static ./.next/static

# 3) Public assets (có thể rỗng)
COPY --from=builder /app/public ./public

# Quyền cho user non-root
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

# Next standalone entrypoint
CMD ["node", "server.js"]
