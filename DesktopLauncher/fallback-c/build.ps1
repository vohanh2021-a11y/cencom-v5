<#
.SYNOPSIS
  Build fallback C launcher cho CencomOS Garage (Win32 + WebView2).
  Can MinGW gcc (tu dong tim trong $env:TEMP\tauri_setup\mingw hoac PATH).
  Tu dong tai WebView2Loader.dll + WebView2.h tu NuGet (khoang 1-2MB) neu thieu.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\build.ps1
#>
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$OutDir    = Join-Path $ScriptDir "bin"
$Tmp       = Join-Path $env:TEMP "webview2_nuget"

Write-Host "== [1/5] Kiem tra MinGW gcc ==" -ForegroundColor Cyan
$gcc = $null
$mingwRoot = Join-Path $env:TEMP "tauri_setup\mingw"
if (Test-Path -LiteralPath $mingwRoot) {
    $gcc = Get-ChildItem -LiteralPath $mingwRoot -Recurse -Filter "gcc.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
}
if (-not $gcc) { $gcc = Get-Command "gcc" -ErrorAction SilentlyContinue }
if (-not $gcc) {
    Write-Host "[LOI] Thieu gcc, can tai MinGW." -ForegroundColor Red
    Write-Host "      Tai MinGW-w64 (vd https://github.com/niXman/mingw-builds-binaries/releases) " -ForegroundColor Yellow
    Write-Host "      roi giai nen vao $mingwRoot hoac them bin/ vao PATH." -ForegroundColor Yellow
    exit 1
}
$gccPath = $null
if ($gcc -is [System.IO.FileInfo]) { $gccPath = $gcc.FullName }
elseif ($gcc.Source) { $gccPath = $gcc.Source }
elseif ($gcc.Path)   { $gccPath = $gcc.Path }
if (-not $gccPath) {
    Write-Host "[LOI] Khong xac dinh duoc duong dan gcc." -ForegroundColor Red
    exit 1
}
Write-Host "  gcc: $gccPath" -ForegroundColor Green

Write-Host "== [2/5] Dam bao WebView2Loader.dll + WebView2.h ==" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
New-Item -ItemType Directory -Force -Path $Tmp | Out-Null

$loaderOut  = Join-Path $OutDir "WebView2Loader.dll"
$includeDir = Join-Path $Tmp "build\native\include"
$headerPath = Join-Path $includeDir "WebView2.h"

$needNupkg = (-not (Test-Path -LiteralPath $loaderOut)) -or (-not (Test-Path -LiteralPath $headerPath))
if ($needNupkg) {
    Write-Host "  Tai Microsoft.Web.WebView2 tu NuGet (WebView2Loader.dll + header)..." -ForegroundColor Yellow
    $nupkg      = Join-Path $Tmp "webview2.nupkg"
    $zip        = Join-Path $Tmp "webview2.zip"
    $extractDir = Join-Path $Tmp "extract"
    Invoke-WebRequest -Uri "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2" -OutFile $nupkg
    Copy-Item -LiteralPath $nupkg -Destination $zip -Force   # nupkg thuc chat la zip
    if (Test-Path -LiteralPath $extractDir) { Remove-Item -LiteralPath $extractDir -Recurse -Force }
    Expand-Archive -LiteralPath $zip -DestinationPath $extractDir -Force
    Copy-Item -LiteralPath (Join-Path $extractDir "build\native\x64\WebView2Loader.dll") -Destination $OutDir -Force
    Write-Host "  OK: WebView2Loader.dll ($((Get-Item $loaderOut).Length) bytes)" -ForegroundColor Green
} else {
    Write-Host "  WebView2Loader.dll va WebView2.h da co, bo qua buoc tai." -ForegroundColor Green
}

# WebView2.h moi require #include "EventToken.h" (header WinRT) NHUNG package
# NuGet khong ship file nay. Tao fallback voi dinh nghia chuan EventRegistrationToken.
$eventTokenPath = Join-Path $includeDir "EventToken.h"
if (-not (Test-Path -LiteralPath $eventTokenPath)) {
    $eventTokenContent = @'
#pragma once
#ifndef __eventtoken_h__
#define __eventtoken_h__
#ifndef __EventRegistrationToken_defined
typedef struct EventRegistrationToken {
    LONGLONG value;
} EventRegistrationToken;
#define __EventRegistrationToken_defined 1
#endif
#endif
'@
    Set-Content -LiteralPath $eventTokenPath -Value $eventTokenContent -Encoding Ascii
    Write-Host "  Tao EventToken.h fallback (can cho WebView2.h)" -ForegroundColor Yellow
}

Write-Host "== [3/5] Bien dich cencom-launcher.exe (WebView2) ==" -ForegroundColor Cyan
Push-Location $ScriptDir
try {
    & $gccPath "main.c" -o (Join-Path $OutDir "cencom-launcher.exe") `
        -mwindows -static -O2 -I $includeDir `
        -Wno-incompatible-pointer-types `
        -lole32 -loleaut32 -luser32 -lws2_32 -ladvapi32 -lshell32
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[LOI] Bien dich cencom-launcher.exe that bai (gcc exit $LASTEXITCODE)." -ForegroundColor Red
        exit $LASTEXITCODE
    }
    Write-Host "  OK: cencom-launcher.exe" -ForegroundColor Green
} finally { Pop-Location }

Write-Host "== [4/5] Bien dich cencom-launcher-simple.exe (Edge app mode) ==" -ForegroundColor Cyan
Push-Location $ScriptDir
try {
    & $gccPath "main-simple.c" -o (Join-Path $OutDir "cencom-launcher-simple.exe") `
        -mwindows -static -O2 -lshell32
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[LOI] Bien dich cencom-launcher-simple.exe that bai (gcc exit $LASTEXITCODE)." -ForegroundColor Red
        exit $LASTEXITCODE
    }
    Write-Host "  OK: cencom-launcher-simple.exe" -ForegroundColor Green
} finally { Pop-Location }

Write-Host "== [5/5] Copy WebView2Loader.dll canh cencom-launcher.exe ==" -ForegroundColor Cyan
Copy-Item -LiteralPath $loaderOut -Destination $OutDir -Force
Write-Host "  OK: $(Join-Path $OutDir 'WebView2Loader.dll')" -ForegroundColor Green

Write-Host ""
Write-Host "HOAN TAT. Output: $OutDir" -ForegroundColor Green
Get-ChildItem -LiteralPath $OutDir | Select-Object Name, Length
exit 0
