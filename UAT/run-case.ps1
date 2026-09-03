# UAT/run-case.ps1 <TC-ID> - chay 1 case: login vai -> chay -> doi ten video -> bao cao
param([string]$id)
if (-not $id) { Write-Host "Dung: powershell -File UAT/run-case.ps1 TC-ST-02"; exit 1 }

$ErrorActionPreference = 'Continue'
$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$idx = Get-Content (Join-Path $PSScriptRoot 'cases/index.json') -Raw | ConvertFrom-Json
$case = $idx.cases | Where-Object { $_.id -eq $id }
if (-not $case) { Write-Host "Khong tim thay case $id"; exit 1 }
$role = $case.role

Write-Host "== [$id] vai $role =="
Write-Host "== dam bao user UAT =="
node scripts/ensure-uat-users.mjs 2>&1 | Select-Object -Last 2

Write-Host "== dam bao dev server sach (kill port 3000) =="
$svc = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($svc) { $svc | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Start-Sleep -Seconds 2; Write-Host "  da kill server cu" } else { Write-Host "  port 3000 dang trong" }

Write-Host "== chay Playwright =="
npx playwright test --config UAT/playwright.config.ts --project=uat-$role -g "$id"
$code = $LASTEXITCODE
$status = if ($code -eq 0) { 'Dat' } else { 'Khong dat / Can bo sung tinh nang' }

Write-Host "== doi ten video =="
node UAT/rename-videos.mjs $id 2>&1 | Select-Object -Last 2

Write-Host "== bao cao =="
node UAT/write-report.mjs $id $status
