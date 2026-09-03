$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$tmp = "$env:TEMP\tauri_setup"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

# 1. rustup-init (per-user, không cần admin)
Write-Host "== [1/4] Download rustup-init =="
Invoke-WebRequest -Uri "https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe" -OutFile "$tmp\rustup-init.exe"

# 2. MinGW-w64 (winlibs) - URL trực tiếp (x86_64, posix, seh, msvcrt)
Write-Host "== [2/4] Download winlibs MinGW =="
$mingwUrl = "https://github.com/brechtsanders/winlibs_mingw/releases/download/15.3.0posix-14.0.0-msvcrt-r1/winlibs-x86_64-posix-seh-gcc-15.3.0-mingw-w64msvcrt-14.0.0-r1.zip"
Write-Host "URL: $mingwUrl"
Invoke-WebRequest -Uri $mingwUrl -OutFile "$tmp\mingw.zip"

# 3. Giải nén MinGW
Write-Host "== [3/4] Extract MinGW =="
Expand-Archive -Path "$tmp\mingw.zip" -DestinationPath "$tmp\mingw" -Force

# 4. Cài rustup (stable-gnu, per-user)
Write-Host "== [4/4] Install rustup (stable-gnu) =="
& "$tmp\rustup-init.exe" -y --default-toolchain stable-gnu --profile minimal | Out-String

# Lưu đường dẫn MinGW để dùng sau
$mingwBin = (Get-ChildItem -Path "$tmp\mingw" -Recurse -Filter "gcc.exe" | Select-Object -First 1).DirectoryName
Set-Content -Path "$tmp\mingw_bin.txt" -Value $mingwBin
Write-Host "MINGW_BIN=$mingwBin"
Write-Host "DONE_TOOLCHAIN_INSTALL"
