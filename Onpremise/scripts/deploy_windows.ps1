# === deploy_windows.ps1 — Deploy on-premise stack trên Windows (Docker Desktop) ===
# Chạy với quyền Administrator PowerShell:
#   Set-ExecutionPolicy Bypass -Scope Process -Command ".\Onpremise\scripts\deploy_windows.ps1"
# Yêu cầu: Docker Desktop đã cài + khởi động, WSL2 backend active.

param()
$ErrorActionPreference = "Stop"

# Thêm Docker bin vào PATH nếu chưa có
$dockerBin = "C:\Program Files\Docker\Docker\resources\bin"
if (Test-Path $dockerBin) {
    $env:PATH = "$dockerBin;$env:PATH"
}

# Kiểm tra Docker
$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
    Write-Host "[ERROR] Docker không tìm thấy trong PATH. Cài Docker Desktop trước."
    Write-Host "  -> Chay: Onpremise\scripts\install_docker_win.bat (Admin)"
    exit 1
}

$onpremiseDir = "E:\APP-LAPTOP-SYNC\cencomOS_gara_4.0_supa\Onpremise"
Set-Location $onpremiseDir

Write-Host "=== [1/5] Pull Docker images (nếu chưa có) ==="
@(
    "supabase/postgres:15.8.1.085",
    "supabase/realtime:latest",
    "supabase/storage-api:latest",
    "node:22-alpine",
    "nginx:1.25-alpine"
) | ForEach-Object {
    Write-Host "  Pulling $_ ..."
    docker pull $_ | Out-Null
}

Write-Host ""
Write-Host "=== [2/5] Tạo SSL certs (self-signed) nếu chưa có ==="
$certDir = Join-Path $onpremiseDir "nginx\certs"
if (-not (Test-Path (Join-Path $certDir "server.crt"))) {
    Write-Host "  Cert chưa tồn tại — chay qua WSL2 openssl hoặc init_certs_win.ps1"
    # Dùng WSL2 openssl (nếu WSL2 Ubuntu có cài)
    wsl -u root bash -c "mkdir -p /tmp/certgen && cd /tmp/certgen && openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout server.key -out server.crt -subj '/C=VN/ST=HoChiMinh/O=CencomOS/OU=IT/CN=cencom.lan' -addext 'subjectAltName=DNS:cencom.lan,DNS:localhost,IP:127.0.0.1' 2>/dev/null" 2>$null
    if ($LASTEXITCODE -eq 0) {
        wsl -u root bash -c "mkdir -p /mnt/c/APP-LAPTOP-SYNC/cencomOS_gara_4.0_supa/Onpremise/nginx/certs && cp /tmp/certgen/server.key /tmp/certgen/server.crt /mnt/c/APP-LAPTOP-SYNC/cencomOS_gara_4.0_supa/Onpremise/nginx/certs/" 2>$null
    }
    Write-Host "  Cert đã tạo."
}

Write-Host ""
Write-Host "=== [3/5] Build cencom-web image ==="
docker compose build cencom-web

Write-Host ""
Write-Host "=== [4/5] Khởi động stack ==="
docker compose up -d

Write-Host ""
Write-Host "=== [5/5] Chờ services khởi động (45s) ==="
Start-Sleep -Seconds 45

Write-Host ""
Write-Host "=== Trạng thái services ==="
docker compose ps

Write-Host ""
Write-Host "=== Truy cập ==="
Write-Host "  Next.js trực tiếp:  http://localhost:3000"
Write-Host "  Qua Nginx (HTTPS):  https://localhost"
Write-Host "  Health check:       https://localhost/api/health"
Write-Host ""
Write-Host "=== Init DB (1 lan dau, chi phí ~10s) ==="
Write-Host "  Chay:  docker compose exec supabase-db psql -U postgres -d cencom_os -f /tmp/schema.sql"
Write-Host "  Hoac:  Onpremise\scripts\init_db.sh (qua WSL2 bash)"
Write-Host ""
Write-Host "=== Hoan tat ==="
Write-Host "Neu certs la self-signed, trinh duyet se can ban (trust cert vao Trusted Root CA)."
