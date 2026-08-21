# syntax=docker/dockerfile:1

# ============================================================
# BUILD STAGE — build Next.js standalone output
# ============================================================
FROM node:20-alpine AS builder
WORKDIR /app

# libc6-compat: một số native module/pg cần
RUN apk add --no-cache libc6-compat

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
# RUNTIME STAGE — slim image chạy server.js
# ============================================================
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Chạy với user non-root
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

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
