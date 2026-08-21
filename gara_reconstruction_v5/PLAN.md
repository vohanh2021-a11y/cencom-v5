# PLAN — CencomOS Gara v5.0 RECONSTRUCTION (GREENFIELD)

Bản v5.0 viết lại sạch, tách biệt khỏi thư mục gốc, PostgreSQL thuần (KHÔNG Supabase),
auth tự viết, role-centric. File `lib/types.ts` là contract chung cho mọi agent sau.

## T0 — Scaffold (worker hiện tại)
- Tạo package.json, tsconfig.json, next.config.js, postcss.config.js, tailwind.config.ts
- docker-compose.yml (chỉ postgres), .env.example, .gitignore
- lib/types.ts (CONTRACT), lib/db.ts (pool + q/row/run/nextId)
- app/globals.css, app/layout.tsx, app/page.tsx (redirect /login)
- README.md, PLAN.md
- KHÔNG chạy npm install / migrate / seed.

## T1 — Schema / Seed / Migrate
- db/migrate.ts: tạo bảng (xe, sc, cong_viec, kho, tk, users, config, log_audit, ...)
  - soft-delete `deleted_at TEXT DEFAULT ''`
  - id VARCHAR(12) PK, sinh qua `nextId(prefix)` (counter `FOR UPDATE`)
  - ngày tháng TEXT `YYYY-MM-DD`
- db/seed.ts: seed users (roles), xe mẫu, config counters
- db/cleanup_test.ts: xoá soft các bản ghi `is_test = 1` định kỳ

## T2 — Core logic
- packages/core (port nguyên logic nghiệp vụ từ v3.6): sc, kho, tk, xuong, scoring, report
- validation Zod (packages/contract) cho mọi đầu vào RPC
- transaction + audit log cho mọi ghi

## T3 — API / RPC
- Route `POST /api/rpc { fn, args }` (contract giữ nguyên)
- auth/session tự viết (JWT/session cookie), kiểm tra quyền trong handler
- rbac: bảng quyền per role, kiểm tra TRONG hàm xử lý

## T4 — UI per role
- /login, /xuong, /ketoan, /kho, /giamdoc, /admin
- Tailwind components dùng class .page/.card/.btn/.tbl/.input/.modal

## T5 — Cleanup + Cron + Tag
- cron cleanup is_test, backup
- version tag v5.0.0, CHANGELOG
- conformance test (parity vs v3.6 spec)
