$ErrorActionPreference = 'Continue'
$bin = 'C:\Users\Admin\AppData\Local\Temp\opencode\pg\pgsql\bin'
$data = 'C:\Users\Admin\AppData\Local\Temp\opencode\pgdata'
$project = 'E:\APP-LAPTOP-SYNC\cencomOS_gara_4.0_supa'

# 1. Đảm bảo Postgres sống
if (-not (Test-NetConnection -ComputerName 127.0.0.1 -Port 5432 -WarningAction SilentlyContinue).TcpTestSucceeded) {
  Get-Process -Name "postgres*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Process -FilePath "$bin\postgres.exe" -ArgumentList "-D",$data -WindowStyle Hidden
  for ($i=0;$i -lt 30;$i++){ if ((Test-NetConnection -ComputerName 127.0.0.1 -Port 5432 -WarningAction SilentlyContinue).TcpTestSucceeded){break}; Start-Sleep 1 }
}
Write-Host "Postgres: $((Test-NetConnection -ComputerName 127.0.0.1 -Port 5432 -WarningAction SilentlyContinue).TcpTestSucceeded)"

# 2. Khởi động dev server (background)
$devLog = "$project\scripts\dev.log"
if (-not (Test-NetConnection -ComputerName 127.0.0.1 -Port 3000 -WarningAction SilentlyContinue).TcpTestSucceeded) {
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c","cd /d `"$project\apps\web`" && npm run dev > `"$devLog`" 2>&1" -WindowStyle Hidden
}
# 3. Poll port 3000
$ready = $false
for ($i=0;$i -lt 60;$i++){
  if ((Test-NetConnection -ComputerName 127.0.0.1 -Port 3000 -WarningAction SilentlyContinue).TcpTestSucceeded){ $ready=$true; break }
  Start-Sleep 2
}
Write-Host "Dev server ready: $ready"
if (-not $ready) { Write-Host "=== DEV LOG ==="; Get-Content $devLog -Tail 25; exit 1 }

# 4. Quay video
Set-Location $project
node scripts/record-ux.mjs

# 5. Dọn dev server
Get-CimInstance Win32_Process -Filter "Name='node.exe' AND CommandLine LIKE '%next%'" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Write-Host "=== DONE ==="
