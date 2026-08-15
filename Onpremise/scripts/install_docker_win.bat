@echo off
REM === install_docker_win.bat — Cài Docker Desktop trên Windows 10/11 Pro (on-premise) ===
REM Chạy với quyền Administrator. Docker Desktop installer đã tải ở:
REM   C:\Users\ADMIN\Documents\DockerDesktopInstaller.exe
REM Nếu chưa tải: tải tại https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe
REM
REM Yêu cầu: Windows 10 Pro/Enterprise/Education (hoặc 11 Pro+) + 8GB RAM + 2 CPU.

setlocal enabledelayedexpansion

REM --- Kiểm tra quyền admin ---
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [Loi] Vui long chay install_docker_win.bat Voi quyen Administrator (chuot phai "Run as administrator").
    pause
    exit /b 1
)

echo === [1/5] Kiem tra Windows version ===
REM Windows 10 Pro build >= 17134 (April 2018) de ho tro WSL2 + Hyper-V
ver | findstr /R "10\.0\.1[7-9][0-9][0-9][0-9]\|10\.0\2[0-9][0-9][0-9]" >nul
if %errorLevel% equ 0 (
    echo [OK] Windows 10/11 Pro detected — WSL2 + Hyper-V duoc ho tro.
) else (
    echo [Canh bao] Windows phiên ban cu, co the gap loi WSL2.
)

echo === [2/5] Kich hoat WSL2 + Hyper-V + Virtual Machine Platform ===
REM WSL2 la backend mac dinh cua Docker Desktop
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart >nul 2>&1
dism.exe /online /enable-feature /featurename:Microsoft-Hyper-V-All /all /norestart >nul 2>&1
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart >nul 2>&1
echo [OK] Cac feature da duoc bật (can khoi dong lai de chi dinh WSL2).

echo === [3/5] Cai dat WSL2 version = 2 ===
wsl --set-default-version 2 >nul 2>&1
echo [OK] WSL2 la default.

echo === [4/5] Cai Docker Desktop (silent) ===
set "INSTALLER=%USERPROFILE%\Documents\DockerDesktopInstaller.exe"
if not exist "%INSTALLER%" (
    echo [Canh bao] Khong tim thay %INSTALLER%. Tai lai tu https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe
    powershell -Command "Start-BitsTransfer -Source 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe' -Destination '%INSTALLER%' -Priority Normal"
)
if exist "%INSTALLER%" (
    echo Dang cai dat Docker Desktop (silent, cho phep WSL2 backend)...
    "%INSTALLER%" install --quiet --accept-license --always-run-docker --backend=wsl-2
    if !errorlevel! equ 0 (
        echo [OK] Docker Desktop da duoc cai dat.
    ) else (
        echo [Loi] Cai dat that bai voi ma !errorlevel!. Kiem tra logs tai %%LOCALAPPDATA%%\Docker\log
        pause
        exit /b !errorlevel!
    )
)

echo === [5/5] Khoi dong lai de hoan tat ===
echo [Buoc phai lam] Khoi dong lai may tinh (reboot) de WSL2 backend duoc kich hoat hoan toan.
echo Sau khi khoi dong:
echo   1. Mo Docker Desktop, cho phep chay.
echo   2. Mo PowerShell moi: cd Onpremise ^&^& docker compose up -d
echo   3. Chay: bash scripts/init_db.sh (1 lan dau)
echo   4. Truy cap https://localhost (self-signed cert)
echo.
echo Nhan phim bat ki de thoat...
pause >nul
endlocal
