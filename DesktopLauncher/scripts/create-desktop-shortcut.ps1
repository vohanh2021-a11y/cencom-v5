# Tạo shortcut desktop trỏ tới exe launcher.
# Dùng: powershell -ExecutionPolicy Bypass -File create-desktop-shortcut.ps1 [-ExePath <path>]
param(
  [string]$ExePath = "$PSScriptRoot\..\src-tauri\target\release\desktop-launcher.exe",
  [string]$ShortcutName = "CencomOS Garage"
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path $ExePath)) { throw "Không tìm thấy exe: $ExePath" }
$exe = (Resolve-Path $ExePath).Path
$desktop = [Environment]::GetFolderPath('Desktop')
$lnk = Join-Path $desktop "$ShortcutName.lnk"
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($lnk)
$sc.TargetPath = $exe
$sc.WorkingDirectory = Split-Path $exe
$sc.IconLocation = "$exe,0"
$sc.Description = 'CencomOS Garage LAN launcher'
$sc.Save()
Write-Host "Đã tạo shortcut: $lnk"
