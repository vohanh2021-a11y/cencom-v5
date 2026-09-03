# Chạy UAT Playwright từng vai, xuất video từng vai (QC206)
# Yêu cầu: web dev đang chạy tại http://localhost:3000 (hoặc set $env:E2E_BASE_URL)
#          đã cài browser: npx playwright install chromium
#          DB có user UAT:  node scripts/ensure-uat-users.mjs

$ErrorActionPreference = 'Continue'

Write-Host "== Cài browser (nếu thiếu) =="
npx playwright install chromium

Write-Host "== Chạy UAT từng vai (ghi video vào tests/uat/videos) =="
npx playwright test --config tests/uat/playwright.config.ts --project=uat-admin --project=uat-giamdoc --project=uat-xuong --project=uat-khovattu --project=uat-ketoan --project=uat-pttb --project=uat-laixe

Write-Host "== Video nằm tại tests/uat/videos/<vaitro>/ =="
Get-ChildItem tests/uat/videos -Recurse -Filter *.webm | Select-Object FullName
