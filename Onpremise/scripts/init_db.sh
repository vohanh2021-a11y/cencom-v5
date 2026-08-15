#!/bin/bash
# === init_db.sh — Initialize database (schema + seed) ===
# Chạy 1 lần đầu sau khi docker-compose up
# Yêu cầu: Docker đang chạy, supabase-db đã healthy

set -e

echo "=== [1/5] Đợi PostgreSQL sẵn sàng ==="

# Đợi DB healthy (tối đa 60s)
for i in $(seq 1 30); do
    if docker exec -i supabase-db pg_isready -U postgres 2>/dev/null; then
        echo "PostgreSQL đã sẵn sàng!"
        break
    fi
    echo "Đang chờ PostgreSQL... ($i/30)"
    sleep 2
done

if ! docker exec -i supabase-db pg_isready -U postgres 2>/dev/null; then
    echo "ERROR: PostgreSQL không khởi động được!"
    echo "Kiểm tra: docker logs supabase-db"
    exit 1
fi

echo "=== [2/5] Tạo database (nếu chưa có) ==="
DB_NAME=${DB_NAME:-cencom_os}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-cencom_pass_2026}

# Database đã tự tạo qua POSTGRES_DB env, chỉ cần kiểm tra
docker exec -i supabase-db psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1
echo "Database $DB_NAME đã sẵn sàng"

echo "=== [3/5] Tạo Supabase roles (cho Storage/Realtime) ==="
# Storage/Realtime cần các role anon/authenticated/service_role...
docker exec -i supabase-db psql -U "$DB_USER" -d "$DB_NAME" -f /dev/stdin <<'ROLES'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='supabase_storage_admin') THEN CREATE ROLE supabase_storage_admin NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='supabase_admin') THEN CREATE ROLE supabase_admin NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='supabase_auth_admin') THEN CREATE ROLE supabase_auth_admin NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='supabase_realtime_admin') THEN CREATE ROLE supabase_realtime_admin NOLOGIN; END IF;
END
$$;
GRANT anon, authenticated, service_role, supabase_storage_admin, supabase_admin, supabase_auth_admin, supabase_realtime_admin TO postgres;
ROLES

echo "=== [4/5] Áp dụng schema ==="
docker cp ../packages/db/schema.sql supabase-db:/tmp/schema.sql
docker exec -i supabase-db psql -U "$DB_USER" -d "$DB_NAME" -f /tmp/schema.sql

echo "=== [5/5] Chạy seed (42 xe + 27 vattu + 11 users) từ host ==="
# Seed chạy trên host (có node_modules + tsx), kết nối qua port 54322 (published)
export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:54322/$DB_NAME"
cd ../packages/db && npx tsx src/seed.ts

echo ""
echo "=== Kiểm tra kết quả ==="
XE_COUNT=$(docker exec -i supabase-db psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM xe;")
VATTU_COUNT=$(docker exec -i supabase-db psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM vattu;")
USER_COUNT=$(docker exec -i supabase-db psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM users;")

echo "Số xe: $XE_COUNT (mong đợi: 42)"
echo "Số vật tư: $VATTU_COUNT (mong đợi: 27)"
echo "Số user: $USER_COUNT (mong đợi: 11)"

echo ""
echo "=== Init DB hoàn tất ==="
echo "Đăng nhập: https://cencom.lan (hoặc https://localhost)"
echo "Tài khoản admin: admin-1 / mật khẩu cencom@123 (must_change=1)"
