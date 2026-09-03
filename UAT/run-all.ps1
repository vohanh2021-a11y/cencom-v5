# UAT/run-all.ps1 - chay toan bo 15 case (server sach 1 lan o dau), tong hop SUMMARY
$ErrorActionPreference = 'Continue'
$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "== cai browser (neu thieu) =="
npx playwright install chromium 2>&1 | Select-Object -Last 2

Write-Host "== dam bao dev server sach (kill port 3000) =="
$svc = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($svc) { $svc | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Start-Sleep -Seconds 2 }

$idx = Get-Content (Join-Path $PSScriptRoot 'cases/index.json') -Raw | ConvertFrom-Json
foreach ($c in $idx.cases) {
  $id = $c.id; $role = $c.role
  Write-Host "`n===== CASE $id ($role) ====="
  node scripts/ensure-uat-users.mjs 2>&1 | Select-Object -Last 1
  npx playwright test --config UAT/playwright.config.ts --project=uat-$role -g "$id"
  $code = $LASTEXITCODE
  $status = if ($code -eq 0) { 'Dat' } else { 'Khong dat / Can bo sung tinh nang' }
  node UAT/rename-videos.mjs $id 2>&1 | Select-Object -Last 1
  node UAT/write-report.mjs $id $status
}
Write-Host "`n✅ Xong. Xem UAT/reports/SUMMARY.md"
