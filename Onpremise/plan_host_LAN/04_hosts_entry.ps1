# === 04_hosts_entry.ps1 — Thêm hosts entry cho cencom.lan ===
# Chạy từ PowerShell (Admin):  .\04_hosts_entry.ps1
#
# Thêm dòng:  192.168.0.72  cencom.lan  vào hosts file
# để truy cập qua hostname thay vì IP.
#
param(
    [string]$LanIP = "192.168.0.72",
    [string]$Domain = "cencom.lan",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$HostsFile = "$env:SystemRoot\System32\drivers\etc\hosts"

Write-Host "=== [04_hosts_entry] Cấu hình hosts file ==="
Write-Host "  IP:     $LanIP"
Write-Host "  Domain: $Domain"
Write-Host "  File:   $HostsFile"
Write-Host ""

if ($DryRun) {
    $entry = "$LanIP`t$Domain"
    $existing = Get-Content $HostsFile | Select-String $Domain
    if ($existing) {
        Write-Host "[DRY RUN] Entry đã tồn tại:" -ForegroundColor Green
        Write-Host "  $existing"
    } else {
        Write-Host "[DRY RUN] Sẽ thêm:" -ForegroundColor Cyan
        Write-Host "`t$entry"
    }
    exit 0
}

# Đọc hosts file
$hostsContent = Get-Content $HostsFile -ErrorAction SilentlyContinue
if (-not $hostsContent) {
    Write-Host "[ERROR] Không thể đọc hosts file." -ForegroundColor Red
    exit 1
}

# Kiểm tra entry đã tồn tại chưa
$entryLine = "$LanIP`t$Domain"
$found = $hostsContent | Select-String "^[^#]*\s+\Q$Domain\E\s*$"

if ($found) {
    Write-Host "[OK] Entry đã tồn tại trong hosts file:" -ForegroundColor Green
    Write-Host "  $($found.Line)"
} else {
    Write-Host "[ADDING] Thêm entry mới..." -ForegroundColor Cyan
    Add-Content -Path $HostsFile -Value $entryLine
    Write-Host "[OK] Đã thêm: $entryLine" -ForegroundColor Green
}

# Verify
Write-Host ""
Write-Host "=== Verify ==="
& ping -n 1 $Domain 2>&1 | Select-String "Pinging|Ping request|bytes="

Write-Host ""
Write-Host "=== [DONE] Truy cập https://$Domain đã hoạt động ==="
