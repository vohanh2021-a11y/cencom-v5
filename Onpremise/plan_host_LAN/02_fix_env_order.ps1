# === 02_fix_env_order.ps1 — Fix env_file order trong docker-compose.yml ===
# Chạy từ PowerShell (Admin):  .\02_fix_env_order.ps1
#
# Vấn đề: .env.onpremise (template, chứa placeholder) được load SAU .env.onpremise.local
# → override giá trị thật → SESSION_SECRET sai, DB_PASSWORD sai
#
# Fix: Đảo thứ tự — load .env.onpremise trước, .env.onpremise.local sau (override cuối)
#
param(
    [string]$ComposeFile = "..\docker-compose.yml",
    [switch]$DryRun     # --dry-run: chỉ preview, không thay đổi
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$fullPath = Resolve-Path $ComposeFile -ErrorAction SilentlyContinue
if (-not $fullPath) {
    Write-Host "[ERROR] Không tìm thấy $ComposeFile" -ForegroundColor Red
    exit 1
}

Write-Host "=== [02_fix_env_order] Fix env_file order in docker-compose.yml ==="
Write-Host "  File: $fullPath"
Write-Host ""

$content = Get-Content $fullPath -Raw

# ─── Kiểm tra trạng thái hiện tại ───
if ($content -match 'env_file:\s*\n\s*- \.env\.onpremise\.local\s*\n\s*- \.env\.onpremise\b') {
    Write-Host "[CURRENT] env_file order SAI (local trước, template sau):" -ForegroundColor Yellow
    Write-Host "  1. .env.onpremise.local   ← real secrets (bị override)"
    Write-Host "  2. .env.onpremise         ← template (override!)"
    Write-Host ""
    $needsFix = $true
}
elseif ($content -match 'env_file:\s*\n\s*- \.env\.onpremise\s*\n\s*- \.env\.onpremise\.local') {
    Write-Host "[OK] env_file order đã đúng (template trước, local sau):" -ForegroundColor Green
    Write-Host "  1. .env.onpremise         ← template (base)"
    Write-Host "  2. .env.onpremise.local   ← real secrets (override final)"
    Write-Host ""
    $needsFix = $false
}
else {
    Write-Host "[WARN] Không tìm thấy pattern env_file trong docker-compose.yml" -ForegroundColor Yellow
    $needsFix = $false
}

# ─── Thực hiện fix nếu cần ───
if ($needsFix -and -not $DryRun) {
    Write-Host "[FIXING] Đảo thứ tự env_file..." -ForegroundColor Cyan

    # Regex thay thế: .env.onpremise.local → .env.onpremise (đảo vị trí)
    $oldBlock = @"
    env_file:
      - .env.onpremise.local
      - .env.onpremise
"@

    $newBlock = @"
    env_file:
      - .env.onpremise
      - .env.onpremise.local
"@

    $content = $content -replace [regex]::Escape($oldBlock), $newBlock

    # Thêm comment cảnh báo
    $warning = @"
    # WARNING: Order matters — .env.onpremise (template) MUST come FIRST,
    # .env.onpremise.local (real secrets) MUST come LAST to override.
    # Swapping these will leak placeholder secrets into production!
"@
    $content = $content -replace [regex]::Escape("    env_file:"), "$warning`n    env_file:"

    Set-Content -Path $fullPath -Value $content -Encoding UTF8
    Write-Host "[OK] Đã sửa env_file order" -ForegroundColor Green
    Write-Host ""
    Write-Host "=== [DONE] Chạy T3: 03_restart_stack.ps1 để reload cencom-web ==="
}
elseif ($needsFix -and $DryRun) {
    Write-Host "[DRY RUN] Sẽ thay đổi:" -ForegroundColor Cyan
    Write-Host "  env_file: [.env.onpremise.local, .env.onpremise]"
    Write-Host "  →"
    Write-Host "  env_file: [.env.onpremise, .env.onpremise.local]"
}
else {
    Write-Host "[SKIP] Không cần fix" -ForegroundColor Gray
}
