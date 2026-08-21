# CencomOS Gara v5.0 (RECONSTRUCTION — GREENFIELD)

Bản v5.0 viết lại hoàn toàn từ đầu, **tách biệt** khỏi thư mục gốc `cencomOS_gara_4.0_supa`.
**KHÔNG dùng Supabase** — chỉ Next.js (App Router) + PostgreSQL thuần + session/JWT auth tự viết, role-centric.

## Stack

- Next.js 14 (App Router) + React 18 + TypeScript 5 (strict)
- Tailwind CSS 3
- PostgreSQL 16 (qua `pg`, Docker Compose)
- Zod 3 cho validate input
- Auth: tự viết (session/JWT), không依赖 framework auth ngoài

## Cấu trúc (sẽ được bổ sung bởi các agent sau)

```
gara_reconstruction_v5/
├── app/            # App Router (layout, globals, page redirect)
├── lib/            # types.ts (CONTRACT), db.ts (pool + helpers)
├── db/             # migrate.ts, seed.ts, cleanup_test.ts (THÊM SAU)
├── docker-compose.yml
├── .env.example
├── package.json
├── tsconfig.json
├── next.config.js
├── postcss.config.js
├── tailwind.config.ts
└── PLAN.md
```

## Cài đặt & chạy

```bash
# 1. Khởi động PostgreSQL (Docker)
docker compose up -d

# 2. Cài dependencies
npm i

# 3. Tạo schema (chưa có DB chạy, bỏ qua nếu chưa sẵn sàng)
npm run migrate

# 4. Seed dữ liệu mẫu
npm run seed

# 5. Chạy dev
npm run dev
```

Truy cập: `http://localhost:3000` → tự động redirect `/login`.

## Lưu ý quan trọng

- **KHÔNG dùng Supabase.** Toàn bộ persistence qua `lib/db.ts` (pg Pool) + `DATABASE_URL`.
- `lib/types.ts` là CONTRACT CHUNG — mọi agent sau import từ đây, không tự định nghĩa lại kiểu.
- Id sinh tự động qua `nextId(prefix)` dùng bảng `config` (counter `FOR UPDATE`), format `PREFIX-000001`.
- Chưa có UI role (xuong/ketoan/kho/giamdoc/admin) — để các agent sau bổ sung.
- Chưa chạy `npm install` (để user/agent sau thực hiện).
