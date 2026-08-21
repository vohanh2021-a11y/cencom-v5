$ErrorActionPreference = 'Stop'
$DB_NAME = 'cencom_os'
$DB_USER = 'postgres'
$DB_PASSWORD = 'ddde4d82ad6ac86e2bbf5cca557d0feea9a2a1902df2631f53f37d46bc72434a'

Write-Host '=== [1/5] Wait PostgreSQL ready ==='
for ($i=1; $i -le 30; $i++) {
    $ready = docker exec -i supabase-db pg_isready -U postgres 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Host 'PostgreSQL ready!'; break }
    Write-Host "Waiting... ($i/30)"
    Start-Sleep -Seconds 2
}
if (-not (docker exec -i supabase-db pg_isready -U postgres 2>$null)) { Write-Host 'ERROR: PostgreSQL not ready'; exit 1 }

Write-Host '=== [2/5] Check database ==='
docker exec -i supabase-db psql -U $DB_USER -d $DB_NAME -c "SELECT 1;" > $null 2>$null
Write-Host "Database $DB_NAME ready"

Write-Host '=== [3/5] Create Supabase roles ==='
$rolesSql = @'
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
'@
docker exec -i supabase-db psql -U $DB_USER -d $DB_NAME -c $rolesSql
Write-Host 'Supabase roles created'

Write-Host '=== [4/5] Apply schema ==='
docker cp E:\APP-LAPTOP-SYNC\cencomOS_gara_4.0_supa\packages\db\schema.sql supabase-db:/tmp/schema.sql
docker exec -i supabase-db psql -U $DB_USER -d $DB_NAME -f /tmp/schema.sql
Write-Host 'Schema applied'

Write-Host '=== [5/5] Run seed (host node) ==='
$connStr = "postgresql://${DB_USER}:${DB_PASSWORD}@localhost:54322/${DB_NAME}"
$env:DATABASE_URL = $connStr
Set-Location E:\APP-LAPTOP-SYNC\cencomOS_gara_4.0_supa\packages\db
npx tsx src/seed.ts

Write-Host ''
Write-Host '=== Verify counts ==='
$XE = docker exec -i supabase-db psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM xe;"
$VT = docker exec -i supabase-db psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM vattu;"
$US = docker exec -i supabase-db psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM users;"
Write-Host "Xe: $XE (expected: 42)"
Write-Host "Vat tu: $VT (expected: 27)"
Write-Host "Users: $US (expected: 11)"