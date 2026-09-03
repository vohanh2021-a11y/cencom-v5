# Sinh file NSIS hooks (src-tauri/nsis-hooks.generated.nsh) để bộ cài copy
# WebView2Loader.dll cạnh exe sau khi cài — bắt buộc cho Tauri build với
# toolchain windows-gnu (bundler của @tauri-apps/cli 2.11 chưa tự thêm DLL này
# vào NSIS; nếu thiếu, app chết ngay với lỗi 0xC0000135 STATUS_DLL_NOT_FOUND).
param(
  [string]$LoaderDll = (Join-Path $PSScriptRoot '..\src-tauri\target\release\WebView2Loader.dll'),
  [string]$OutputNsh = (Join-Path $PSScriptRoot '..\src-tauri\nsis-hooks.generated.nsh')
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path $LoaderDll)) { throw "Khong tim thay WebView2Loader.dll: $LoaderDll (chay build 1 lan truoc)" }
$abs = (Resolve-Path $LoaderDll).Path
$content = @"
; NSIS hooks (tu dong sinh boi scripts/gen-nsis-hooks.ps1) - KHONG sua tay.
; Copy WebView2Loader.dll canh exe sau khi cai de app chay duoc.
; Ten macro PHẢI dung chinh xac "NSIS_HOOK_POSTINSTALL" (template Tauri 2.11
; dung !ifmacrodef NSIS_HOOK_POSTINSTALL + !insertmacro NSIS_HOOK_POSTINSTALL).
!macro NSIS_HOOK_POSTINSTALL
  SetOutPath "`$INSTDIR"
  File "$abs"
!macroend
"@
Set-Content -Path $OutputNsh -Value $content -Encoding UTF8
Write-Host "Da sinh: $OutputNsh"
Write-Host "DLL: $abs"
