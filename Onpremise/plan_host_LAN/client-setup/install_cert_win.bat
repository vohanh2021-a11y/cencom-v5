@echo off
REM === install_cert_win.bat — Cài đặt SSL cert vào Trusted Root CA (Windows) ===
REM Chạy với quyền Administrator
REM
REM Cert: server.crt (self-signed từ on-premise server)
REM Chức năng: Thêm cert vào "Trusted Root Certification Authorities" của Local Machine
REM
REM Yêu cau: Chạy cmd với quyền Admin
REM

setlocal EnableDelayedExpansion

echo === CencomOS-Gara Client Setup (Windows) ===
echo.

REM Kiểm tra quyền Admin
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Vui long chay voi quyen Administrator!
    echo         Right-click → "Run as administrator"
    pause
    exit /b 1
)

REM Xác định đường dẫn cert
set "CERT_DIR=%~dp0"
set "CERT_FILE=%CERT_DIR%server.crt"

if not exist "%CERT_FILE%" (
    echo [ERROR] Khong tim thay server.crt trong %CERT_DIR%
    echo         Sao chép cert tu server vao day truoc khi chay.
    pause
    exit /b 1
)

echo [INFO] Cert tim thay: %CERT_FILE%
echo [INFO] Dang cai dat vao Trusted Root Certification Authorities...
echo.

REM Sử dụng PowerShell để import cert (PowerShell 5.1+ có sẵn trên Win10)
powershell -Command ^
    "$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('%CERT_FILE%');" ^
    "$store = New-Object System.Security.Cryptography.X509Certificates.X509Store('Root', 'LocalMachine');" ^
    "$store.Open('ReadWrite');" ^
    "$store.Add($cert);" ^
    "$store.Close();" ^
    "Write-Host '[OK] Da cai dat cert vao Trusted Root CA'"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [WARN] Tu Dong tac - dung certutil:
    certutil -addstore -f "Root" "%CERT_FILE%"
)

echo.
echo === Hoan tat ===
echo - Truy cap: https://192.168.0.72 hoac https://cencom.lan
echo - Neu dung hostname, them vao hosts file:
echo     192.168.0.72    cencom.lan
echo   vao C:\Windows\System32\drivers\etc\hosts
echo.
pause
