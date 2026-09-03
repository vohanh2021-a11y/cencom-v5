# Tải MinGW-w64 (winlibs) nền — chạy nền, ghi marker khi xong.
# Chạy: Start-Process powershell -File download-mingw.ps1
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$tmp = "$env:TEMP\tauri_setup"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$zip = "$tmp\mingw.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
$url = "https://github.com/brechtsanders/winlibs_mingw/releases/download/15.3.0posix-14.0.0-msvcrt-r1/winlibs-x86_64-posix-seh-gcc-15.3.0-mingw-w64msvcrt-14.0.0-r1.zip"
Write-Host "Downloading mingw.zip (256MB)..."
Invoke-WebRequest -Uri $url -OutFile $zip
Set-Content "$tmp\mingw.done" "OK"
Write-Host "DONE mingw.zip"
