-- 00-roles.sql — Tạo các role Supabase cần thiết cho Storage/Realtime/Avuth
-- Chạy tự động khi volume PostgreSQL được init lần đầu (docker-entrypoint-initdb.d)
-- Idempotent: bỏ qua nếu role đã tồn tại.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='supabase_admin') THEN
    CREATE ROLE supabase_admin NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='supabase_realtime_admin') THEN
    CREATE ROLE supabase_realtime_admin NOLOGIN;
  END IF;
END
$$;

GRANT anon, authenticated, service_role,
      supabase_storage_admin, supabase_admin,
      supabase_auth_admin, supabase_realtime_admin TO postgres;
