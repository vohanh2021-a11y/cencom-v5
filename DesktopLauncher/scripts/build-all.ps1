$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$script:ScriptDir    = $PSScriptRoot
$script:RootDir      = Split-Path -Parent $PSScriptRoot
$script:LogFile      = Join-Path $script:ScriptDir 'build-log.txt'
$script:StepResults  = @()
$script:CurrentSw    = $null

function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $line = "[$ts][$Level] $Message"
    Write-Host $line
    Add-Content -LiteralPath $script:LogFile -Value $line -Encoding UTF8
}

function Write-Captured {
    param([string]$Text)
    $ts = Get-Date -Format 'HH:mm:ss'
    $line = "[$ts]  $Text"
    Write-Host $line
    Add-Content -LiteralPath $script:LogFile -Value $line -Encoding UTF8
}

function Start-Step {
    param([string]$Name)
    $script:CurrentSw = [System.Diagnostics.Stopwatch]::StartNew()
    Write-Log "==================== $Name ===================="
}

function Finish-Step {
    param([string]$Name, [int]$Code = 0)
    if ($script:CurrentSw) {
        $script:CurrentSw.Stop()
        $secs = $script:CurrentSw.Elapsed.TotalSeconds
    } else {
        $secs = 0
    }
    $status = if ($Code -eq 0) { 'OK' } else { 'FAIL' }
    Add-StepResult -Name $Name -Status $status -Code $Code -Seconds $secs
}

function Add-StepResult {
    param([string]$Name, [string]$Status, [int]$Code = -1, [double]$Seconds = 0)
    $script:StepResults += [PSCustomObject]@{
        Step     = $Name
        Status   = $Status
        ExitCode = $Code
        Seconds  = [math]::Round($Seconds, 1)
    }
}

function Invoke-Native {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [string[]]$Arguments = @(),
        [string]$WorkingDirectory = $script:RootDir,
        [int]$TimeoutSeconds = 1800,
        [string]$StepName = 'Lệnh con'
    )
    if ([string]::IsNullOrWhiteSpace($WorkingDirectory)) { $WorkingDirectory = $script:RootDir }
    $argStr = ($Arguments | ForEach-Object {
        if ($_ -match '[\s"]') { '"' + ($_ -replace '"', '\"') + '"' } else { $_ }
    }) -join ' '
    Write-Log "Bắt đầu: $StepName"
    Write-Log ("  Lệnh: {0} {1}" -f $FilePath, $argStr)
    Write-Log ("  Thư mục làm việc: {0}" -f $WorkingDirectory)

    # Chạy qua & + pipeline: vừa stream real-time vừa bắt exit code chính xác
    # ($LASTEXITCODE). KHÔNG dùng Start-Process -RedirectStandardOutput (trả
    # ExitCode rỗng trên PowerShell 5.1).
    Push-Location $WorkingDirectory
    try {
        & $FilePath @Arguments 2>&1 | ForEach-Object { Write-Captured $_ }
        $code = $global:LASTEXITCODE
        if ($null -eq $code) { $code = 1 }
        Write-Log ("Kết thúc: {0} => exit code {1}" -f $StepName, $code)
        return $code
    } catch {
        Write-Log ("Lỗi chạy {0}: {1}" -f $StepName, $_.Exception.Message) 'ERROR'
        return 1
    } finally {
        Pop-Location
    }
}

function Invoke-CmdLine {
    param(
        [string]$CommandLine,
        [string]$WorkingDirectory = $script:RootDir,
        [int]$TimeoutSeconds = 1800,
        [string]$StepName = 'Lệnh cmd'
    )
    if ([string]::IsNullOrWhiteSpace($WorkingDirectory)) { $WorkingDirectory = $script:RootDir }
    return Invoke-Native -FilePath $env:ComSpec -Arguments @('/d', '/s', '/c', ('"' + $CommandLine + '"')) `
        -WorkingDirectory $WorkingDirectory -TimeoutSeconds $TimeoutSeconds -StepName $StepName
}

$exitCode = 0
$started = Get-Date
$tauriSetup = Join-Path $env:TEMP 'tauri_setup'
$cargoBin   = Join-Path $env:USERPROFILE '.cargo\bin'

Write-Log '========================================================================'
Write-Log ("BUILD ALL bắt đầu: {0}" -f $started.ToString('yyyy-MM-dd HH:mm:ss'))
Write-Log ("Thư mục script  : {0}" -f $script:ScriptDir)
Write-Log ("Gốc dự án       : {0}" -f $script:RootDir)
Write-Log ("Log file        : {0}" -f $script:LogFile)
Write-Log '========================================================================'

try {
    Start-Step 'BƯỚC 1: Xác định gốc dự án'
    try {
        if (-not (Test-Path -LiteralPath (Join-Path $script:RootDir 'package.json'))) {
            throw "Không thấy package.json tại $script:RootDir"
        }
        if (-not (Test-Path -LiteralPath (Join-Path $script:RootDir 'src-tauri'))) {
            throw "Không thấy src-tauri tại $script:RootDir"
        }
        Write-Log ("RootDir = {0} (hợp lệ)" -f $script:RootDir)
        Finish-Step 'BƯỚC 1' 0
    } catch {
        Write-Log ("Lỗi BƯỚC 1: {0}" -f $_.Exception.Message) 'ERROR'
        Finish-Step 'BƯỚC 1' 1
        throw
    }

    Start-Step 'BƯỚC 2: Cấu hình PATH (MinGW, Cargo)'
    try {
        $mingwRoot = Join-Path $tauriSetup 'mingw'
        $mingwZip  = Join-Path $tauriSetup 'mingw.zip'
        $gcc = $null
        if (Test-Path -LiteralPath $mingwRoot) {
            $gcc = Get-ChildItem -LiteralPath $mingwRoot -Filter 'gcc.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        }
        if (-not $gcc -and (Test-Path -LiteralPath $mingwZip)) {
            Write-Log ("Chưa giải nén MinGW, đang Expand-Archive: {0}" -f $mingwZip)
            Expand-Archive -LiteralPath $mingwZip -DestinationPath $mingwRoot -Force
            $gcc = Get-ChildItem -LiteralPath $mingwRoot -Filter 'gcc.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        }
        if (-not $gcc) {
            throw 'Thiếu MinGW: chạy trước download-mingw.ps1 và giải nén'
        }
        $gccDir = Split-Path -Parent $gcc.FullName
        if ($env:PATH -notlike "*$gccDir*") { $env:PATH = "$gccDir;$env:PATH" }
        Write-Log ("Đã thêm MinGW vào PATH: {0} (gcc={1})" -f $gccDir, $gcc.FullName)

        if (Test-Path -LiteralPath $cargoBin) {
            if ($env:PATH -notlike "*$cargoBin*") { $env:PATH = "$cargoBin;$env:PATH" }
            Write-Log ("Đã thêm Cargo vào PATH: {0}" -f $cargoBin)
        } else {
            Write-Log ("Chưa có thư mục cargo bin: {0}" -f $cargoBin) 'WARN'
        }
        Finish-Step 'BƯỚC 2' 0
    } catch {
        Write-Log ("Lỗi BƯỚC 2: {0}" -f $_.Exception.Message) 'ERROR'
        Finish-Step 'BƯỚC 2' 1
        throw
    }

    Start-Step 'BƯỚC 3: Kiểm tra / cài Rust toolchain'
    try {
        $cargoCmd = Get-Command cargo -ErrorAction SilentlyContinue
        $rustcCmd = Get-Command rustc -ErrorAction SilentlyContinue
        if (-not ($cargoCmd -and $rustcCmd)) {
            Write-Log 'Chưa có cargo/rustc — chạy rustup-init...'
            $rustupInit = Join-Path $tauriSetup 'rustup-init.exe'
            if (-not (Test-Path -LiteralPath $rustupInit)) {
                throw ("Thiếu rustup-init.exe tại {0} — tải trước rồi chạy lại" -f $rustupInit)
            }
            $rc = Invoke-Native -FilePath $rustupInit -Arguments @('-y', '--default-toolchain', 'stable-gnu', '--profile', 'minimal') `
                -TimeoutSeconds 900 -StepName 'rustup-init (cài Rust)'
            if ($rc -ne 0) { throw ("rustup-init thất bại, exit code {0}" -f $rc) }
            if (Test-Path -LiteralPath $cargoBin) {
                if ($env:PATH -notlike "*$cargoBin*") { $env:PATH = "$cargoBin;$env:PATH" }
            }
            $cargoCmd = Get-Command cargo -ErrorAction SilentlyContinue
            $rustcCmd = Get-Command rustc -ErrorAction SilentlyContinue
            if (-not ($cargoCmd -and $rustcCmd)) {
                throw 'Đã chạy rustup-init nhưng không tìm thấy cargo/rustc trong PATH'
            }
        }
        Write-Log ("cargo : {0}" -f $cargoCmd.Source)
        Write-Log ("rustc : {0}" -f $rustcCmd.Source)
        Finish-Step 'BƯỚC 3' 0
    } catch {
        Write-Log ("Lỗi BƯỚC 3: {0}" -f $_.Exception.Message) 'ERROR'
        Finish-Step 'BƯỚC 3' 1
        throw
    }

    Start-Step 'BƯỚC 4: Kiểm tra node_modules / @tauri-apps/cli'
    try {
        $hasNodeModules = Test-Path -LiteralPath (Join-Path $script:RootDir 'node_modules')
        $hasTauriCli    = Test-Path -LiteralPath (Join-Path $script:RootDir 'node_modules\@tauri-apps\cli')
        if (-not $hasNodeModules -or -not $hasTauriCli) {
            Write-Log ("Cần cài deps: node_modules={0}, @tauri-apps/cli={1} -> chạy npm install" -f $hasNodeModules, $hasTauriCli)
            $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
            if (-not $npmCmd) { throw 'Không tìm thấy npm (Node.js) trong PATH' }
            $rc = Invoke-CmdLine -CommandLine 'npm install' -WorkingDirectory $script:RootDir -TimeoutSeconds 1800 -StepName 'npm install'
            if ($rc -ne 0) { throw ("npm install thất bại, exit code {0}" -f $rc) }
        } else {
            Write-Log 'node_modules và @tauri-apps/cli đã có sẵn — bỏ qua npm install'
        }
        Finish-Step 'BƯỚC 4' 0
    } catch {
        Write-Log ("Lỗi BƯỚC 4: {0}" -f $_.Exception.Message) 'ERROR'
        Finish-Step 'BƯỚC 4' 1
        throw
    }

    Start-Step 'BƯỚC 5: npx tauri build'
    try {
        # Sinh NSIS hooks để bộ cài copy WebView2Loader.dll cạnh exe (bắt buộc
        # cho Tauri windows-gnu — thiếu DLL app chết 0xC0000135).
        $genHook = Join-Path $script:ScriptDir 'gen-nsis-hooks.ps1'
        if (Test-Path -LiteralPath $genHook) {
            & $genHook | ForEach-Object { Write-Captured $_ }
            if ($LASTEXITCODE -ne 0) { throw 'gen-nsis-hooks.ps1 thất bại' }
        }
        if (-not (Get-Command npx -ErrorAction SilentlyContinue)) { throw 'Không tìm thấy npx trong PATH' }
        $rc = Invoke-CmdLine -CommandLine 'npx tauri build' -WorkingDirectory $script:RootDir -TimeoutSeconds 3600 -StepName 'npx tauri build'
        if ($rc -ne 0) { throw ("npx tauri build thất bại, exit code {0}" -f $rc) }
        Finish-Step 'BƯỚC 5' 0
    } catch {
        Write-Log ("Lỗi BƯỚC 5: {0}" -f $_.Exception.Message) 'ERROR'
        Finish-Step 'BƯỚC 5' 1
        throw
    }

    Start-Step 'BƯỚC 6: cargo test (src-tauri)'
    try {
        $srcTauri = Join-Path $script:RootDir 'src-tauri'
        $cargoExe = (Get-Command cargo).Source
        $rc = Invoke-Native -FilePath $cargoExe -Arguments @('test') -WorkingDirectory $srcTauri -TimeoutSeconds 1800 -StepName 'cargo test'
        if ($rc -ne 0) { throw ("cargo test thất bại, exit code {0}" -f $rc) }
        Finish-Step 'BƯỚC 6' 0
    } catch {
        Write-Log ("Lỗi BƯỚC 6: {0}" -f $_.Exception.Message) 'ERROR'
        Finish-Step 'BƯỚC 6' 1
        throw
    }

    Start-Step 'BƯỚC 7: Tìm file output (.exe)'
    try {
        $releaseDir = Join-Path $script:RootDir 'src-tauri\target\release'
        $nsisDir    = Join-Path $releaseDir 'bundle\nsis'
        $found = @()
        if (Test-Path -LiteralPath $releaseDir) {
            $found = @($found) + @(Get-ChildItem -LiteralPath $releaseDir -Filter '*.exe' -ErrorAction SilentlyContinue)
        }
        if (Test-Path -LiteralPath $nsisDir) {
            $found = @($found) + @(Get-ChildItem -LiteralPath $nsisDir -Filter '*.exe' -ErrorAction SilentlyContinue)
        }
        if ($found.Count -eq 0) {
            Write-Log 'Không tìm thấy file .exe output (build có thể chưa sinh ra)' 'WARN'
        } else {
            Write-Log ("Tìm thấy {0} file output:" -f $found.Count)
            $found | ForEach-Object { Write-Log ("  - {0}" -f $_.FullName) }
        }
        Finish-Step 'BƯỚC 7' 0
    } catch {
        Write-Log ("Lỗi BƯỚC 7: {0}" -f $_.Exception.Message) 'ERROR'
        Finish-Step 'BƯỚC 7' 1
        throw
    }
} catch {
    Write-Log ("Lỗi pipeline: {0}" -f $_.Exception.Message) 'ERROR'
    $exitCode = 1
}

Write-Log '==================== TỔNG KẾT ===================='
foreach ($r in $script:StepResults) {
    Write-Log ("  {0} | {1} | exit={2} | {3}s" -f $r.Step, $r.Status, $r.ExitCode, $r.Seconds)
}
$okCount = @($script:StepResults | Where-Object { $_.Status -eq 'OK' }).Count
Write-Log ("Thành công: {0}/{1} bước" -f $okCount, $script:StepResults.Count)
$finished = Get-Date
$elapsedTotal = ($finished - $started).TotalSeconds
Write-Log ("Thời gian tổng: {0}s" -f [math]::Round($elapsedTotal, 1))
if ($exitCode -eq 0 -and $okCount -eq $script:StepResults.Count -and $script:StepResults.Count -gt 0) {
    Write-Log 'KẾT QUẢ: THÀNH CÔNG (exit 0)'
} else {
    Write-Log 'KẾT QUẢ: THẤT BẠI (exit 1)' 'ERROR'
    $exitCode = 1
}
Write-Log '========================================================================'
exit $exitCode
