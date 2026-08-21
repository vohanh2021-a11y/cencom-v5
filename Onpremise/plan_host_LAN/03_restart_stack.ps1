# === 03_restart_stack.ps1 — Restart Docker stack để reload cert + env ===
# Chạy từ PowerShell (Admin):  .\03_restart_stack.ps1
#
# Tác vụ:
#   1. Restart tất cả containers (nginx load cert mới, web reload env)
#   2. Chờ services healthy (tối đa 60s)
#   3. Verify health endpoint
#
param(
    [switch]$DryRun     # --dry-run: chỉ preview lệnh, không thực thi
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$ProjectRoot = Resolve-Path "..\.."
$ComposeFile = Resolve-Path "..\docker-compose.yml"

Write-Host "=== [03_restart_stack] Restart Docker stack ==="
Write-Host "  Project: $ProjectRoot"
Write-Host "  Compose: $ComposeFile"
Write-Host ""

# Tìm docker binary
$DockerExe = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
if (-not (Test-Path $DockerExe)) {
    $DockerExe = (Get-Command docker -ErrorAction SilentlyContinue).Source
}
if (-not $DockerExe) {
    Write-Host "[ERROR] Docker không tìm thấy. Mở Docker Desktop trước." -ForegroundColor Red
    exit 1
}

if ($DryRun) {
    Write-Host "[DRY RUN] Sẽ chạy:" -ForegroundColor Cyan
    Write-Host "  $DockerExe compose -f `"$ComposeFile`" restart"
    Write-Host "  Chờ 30s → health check"
    exit 0
}

# ─── Restart ───
Write-Host "[1/3] Restarting containers (có downtime ~30s)..." -ForegroundColor Yellow
& $DockerExe compose -f $ComposeFile restart
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] docker compose restart thất bại!" -ForegroundColor Red
    exit 1
}

# ─── Wait for healthy ───
Write-Host "[2/3] Chờ services healthy..." -ForegroundColor Yellow
$maxWait = 60
$elapsed = 0
$healthy = $false

while ($elapsed -lt $maxWait) {
    $status = & $DockerExe ps --format "table {{.Names}}\t{{.Status}}" --filter "name=supabase-db|cencom-web|cencom-nginx" 2>$null
    if ($LASTEXITCODE -eq 0) {
        $healthyDb = $status -match "healthy.*supabase-db"
        $healthyWeb = $status -match "healthy.*cencom-web"
        $runningNginx = $status -match "Up.*cencom-nginx"
        if ($healthyDb -and $healthyWeb -and $runningNginx) {
            $healthy = $true
            break
        }
    }
    Start-Sleep -Seconds 3
    $elapsed += 3
    Write-Host "  Đang chờ... ($elapsed/${maxWait}s)" -ForegroundColor Gray
}

if (-not $healthy) {
    Write-Host "[WARN] Một số service chưa healthy sau ${maxWait}s" -ForegroundColor Yellow
    Write-Host "  → Kiểm tra: docker logs supabase-db / cencom-web" -ForegroundColor Gray
}

# ─── Verify health ───
Write-Host "[3/3] Verify health endpoint..." -ForegroundColor Yellow
& $DockerExe exec -i cencom-nginx wget -qO- "https://cencom-web:3000/api/health" 2>&1 | Out-Null
& $DockerExe exec -i cencom-web wget -qO- "http://127.0.0.1:3000/api/health" 2>&1

Write-Host ""
Write-Host "=== ✓ Stack restarted ==="
Write-Host "  Truy cập: https://192.168.0.72/api/health"
Write-Host "  Login:    https://192.168.0.72/login"
Write-Host ""
Write-Host "=== [DONE] Chạy T5: 05_verify.sh để test end-to-end ==="
