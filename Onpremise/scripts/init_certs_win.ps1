param()
# === init_certs_win.ps1 — Tạo self-signed SSL cert (PEM) cho on-premise bằng Windows ===
# Sinh cặp server.crt + server.key (PEM) vào Onpremise/nginx/certs để nginx container dùng.
# Ưu tiên WSL2 openssl (đồng bộ với deploy_windows.ps1); fallback qua cert store + openssl Win.
# Chạy (Admin PowerShell): .\Onpremise\scripts\init_certs_win.ps1

$ErrorActionPreference = "Stop"

$scriptDir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$onpremiseDir = Split-Path -Parent $scriptDir
$certDir      = Join-Path $onpremiseDir "nginx\certs"
if (!(Test-Path $certDir)) { New-Item -ItemType Directory -Path $certDir -Force | Out-Null }

$crt = Join-Path $certDir "server.crt"
$key = Join-Path $certDir "server.key"

if ((Test-Path $crt) -and (Test-Path $key)) {
    Write-Host "✅ Cert đã tồn tại:"
    Write-Host "  $crt"
    Write-Host "  $key"
    Write-Host "  (Xoá 2 file này nếu muốn sinh lại.)"
    exit 0
}

# --- Cách 1: WSL2 openssl (khuyên dùng) ---
$wslReady = $false
try {
    wsl -u root bash -c "command -v openssl >/dev/null 2>&1 && echo ok" 2>$null
    $wslReady = ($LASTEXITCODE -eq 0)
} catch { $wslReady = $false }

if ($wslReady) {
    # Map Windows path -> WSL path (E:\... -> /mnt/e/...)
    $wslCertDir = ($certDir -replace '^([A-Za-z]):\\', '/mnt/$1/') -replace '\\', '/'
    wsl -u root bash -c "mkdir -p '$wslCertDir' && cd '$wslCertDir' && openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout server.key -out server.crt -subj '/C=VN/ST=HoChiMinh/O=CencomOS/OU=IT/CN=cencom.lan' -addext 'subjectAltName=DNS:cencom.lan,DNS:localhost,IP:127.0.0.1' 2>/dev/null"
    if ((Test-Path $crt) -and (Test-Path $key)) {
        Write-Host "✅ Cert tạo bằng WSL openssl:"
        Write-Host "  $crt"
        Write-Host "  $key"
        exit 0
    }
}

# --- Cách 2: cert store + export PFX, rồi extract key bằng openssl Win (nếu có) ---
Write-Host "[WARN] WSL2 openssl không sẵn sàng — thử qua cert store Windows..."
$cert = New-SelfSignedCertificate -DnsName "localhost","cencom.lan" `
    -CertStoreLocation "Cert:\LocalMachine\My" `
    -KeyUsage DigitalSignature,KeyEncipherment,DataEncipherment `
    -FriendlyName "cencomOS-onpremise-local" `
    -NotAfter (Get-Date).AddYears(2)

$pfxPass = ConvertTo-SecureString -String "cencom_cert_pass_2026" -AsPlainText -Force
$pfx = Join-Path $certDir "server.pfx"
Export-PfxCertificate -Cert "Cert:\LocalMachine\My\$($cert.Thumbprint)" -FilePath $pfx -Password $pfxPass | Out-Null
Export-Certificate -Cert $cert -FilePath $crt | Out-Null

$opensslExe = Get-Command openssl -ErrorAction SilentlyContinue
if ($opensslExe) {
    & openssl pkcs12 -in $pfx -nocerts -nodes -password pass:cencom_cert_pass_2026 -out $key 2>$null
}

if (-not (Test-Path $key)) {
    Write-Host "[ERROR] Không thể sinh server.key (PEM). Cài OpenSSL Windows hoặc bật WSL2 Ubuntu để init certs. Nginx container sẽ thiếu private key."
    exit 1
}

Write-Host "✅ Cert tạo (fallback):"
Write-Host "  $crt"
Write-Host "  $key"
