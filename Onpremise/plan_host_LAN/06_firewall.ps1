# === 06_firewall.ps1 — Cấu hình Windows Firewall cho LAN inbound ===
# Chạy từ PowerShell (Admin):  .\06_firewall.ps1
#
# Mở inbound ports 80, 443, 54322, 54324, 54325 cho subnet LAN
# (Docker Desktop đã tạo rule "Docker Desktop Backend" nhưng chưa chắc cho phép LAN)
#
param(
    [string]$LanSubnet = "192.168.0.0/16",
    [switch]$DryRun,
    [switch]$Remove   # Xóa rules thay vì tạo
)

$ErrorActionPreference = "Stop"

$Rules = @(
    @{ Name = "CencomOS HTTP (LAN)";  Port = 80;     Dir = "Inbound"; Protocol = "TCP" }
    @{ Name = "CencomOS HTTPS (LAN)"; Port = 443;    Dir = "Inbound"; Protocol = "TCP" }
    @{ Name = "CencomOS PG (LAN)";    Port = 54322;  Dir = "Inbound"; Protocol = "TCP" }
    @{ Name = "CencomOS RT (LAN)";    Port = 54324;  Dir = "Inbound"; Protocol = "TCP" }
    @{ Name = "CencomOS ST (LAN)";    Port = 54325;  Dir = "Inbound"; Protocol = "TCP" }
)

Write-Host "=== [06_firewall] Windows Firewall LAN rules ==="
Write-Host "  Subnet: $LanSubnet"
Write-Host ""

if ($Remove) {
    Write-Host "[REMOVE] Xóa tất cả CencomOS firewall rules..." -ForegroundColor Yellow
    $Rules | ForEach-Object {
        $existing = Get-NetFirewallRule -DisplayName $_.Name -ErrorAction SilentlyContinue
        if ($existing) {
            Remove-NetFirewallRule -DisplayName $_.Name
            Write-Host "  [X] Đã xóa: $($_.Name)" -ForegroundColor Gray
        }
    }
    Write-Host "[DONE] Đã xóa toàn bộ rules"
    exit 0
}

if ($DryRun) {
    Write-Host "[DRY RUN] Sẽ tạo các rules:" -ForegroundColor Cyan
    $Rules | ForEach-Object {
        Write-Host "  - $($_.Name) : Port $($_.Port)/$($_.Protocol) cho $LanSubnet"
    }
    exit 0
}

# Kiểm tra Docker Desktop Backend rule đã tồn tại
$dockerRule = Get-NetFirewallRule -DisplayName "Docker Desktop Backend" -ErrorAction SilentlyContinue
if ($dockerRule) {
    Write-Host "[INFO] Docker Desktop Backend rule đã tồn tại — có thể không cần thêm" -ForegroundColor Gray
}

# Tạo / cập nhật rules
foreach ($rule in $Rules) {
    # Kiểm tra rule đã tồn tại
    $existing = Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue

    if ($existing) {
        Write-Host "  [SKIP] $($rule.Name) — đã tồn tại" -ForegroundColor Gray
    } else {
        Write-Host "  [ADD] $($rule.Name) : Port $($rule.Port)/$($rule.Protocol)" -ForegroundColor Cyan
        New-NetFirewallRule -DisplayName $rule.Name `
            -Direction $rule.Dir `
            -Protocol $rule.Protocol `
            -LocalPort $rule.Port `
            -RemoteAddress $LanSubnet `
            -Action Allow `
            -Profile Domain,Private `
            -ErrorAction Stop | Out-Null
        Write-Host "    ✓ OK" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "=== [DONE] Firewall rules đã được cấu hình ==="
Write-Host "  Các máy trong $LanSubnet có thể truy cập ports 80, 443, 54322, 54324, 54325"
Write-Host ""
Write-Host "=== Kiểm tra ==="
Get-NetFirewallRule -DisplayName "CencomOS*" | Format-Table -Auto DisplayName, Direction, Protocol, LocalPort, Action -Property DisplayName, Direction, Protocol, LocalPort, Action
