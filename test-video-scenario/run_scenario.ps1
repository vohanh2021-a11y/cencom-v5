# run_scenario.ps1 — Chay toan bo quy tinh: quay video + tao voice + merge
$ErrorActionPreference = "Stop"
$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "========================================"
Write-Host "   SCENARIO VIDEO TUTORIAL - TEST RUN   "
Write-Host "========================================"

# 1. Quay video
Write-Host "`n[1/3] Quay video voi phu de..."
node "$baseDir\record_demo.cjs"
Write-Host "Video da quay xong"

# 2. Tao giong doc
Write-Host "`n[2/3] Tao giong doc tieng Viet..."
python "$baseDir\scripts\make_voice.py" "scenario_1" "scenario_1\pairs.txt"
Write-Host "Giong doc da tao xong"

# 3. Merge video + voice
Write-Host "`n[3/3] Long giong doc vao video..."
# Goi merge_voice.ps1 theo cach dinh dang thu tu mp3
$mp3list = @("intro", "step1", "step2", "step3", "hoan")
& powershell -Command "
& '$baseDir\scripts\merge_voice.ps1' -ScenarioDir 'scenario_1' -Video (Get-ChildItem \"videos\scenario_1\*.webm\" | Select-Object -First 1).FullName -Order $mp3list
"
Write-Host "Merge hoan tat"

# 4. Kiem tra
Write-Host "`n========================================"
Write-Host "   KET QUA"
Write-Host "========================================"

Write-Host "`nCac file da tao:"
Get-ChildItem "videos\scenario_1" -Filter "*.webm" | ForEach-Object {
    Write-Host "   - $($_.Name)"
}
Get-ChildItem "scenario_1" -Filter "kb_*.mp3" | ForEach-Object {
    Write-Host "   - $($_.Name)"
}

Write-Host "`nKiem tra video duoc tao thanh cong."
Write-Host "Duong dan video cuoi cung: videos\scenario_1\final_with_voice.webm"