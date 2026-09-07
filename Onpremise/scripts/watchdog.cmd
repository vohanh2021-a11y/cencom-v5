@echo off
rem ============================================================
rem C3 - Watchdog toi thieu (Windows dev / HUB khong co cron):
rem chay healthcheck moi 5 phut, ghi log + dat file UNHEALTHY_STREAK
rem khi hong >=3 lan lien tiep (Task Scheduler: lap 5 phut).
rem Ubuntu dung cron + scripts/healthcheck.sh + mail/log tuong tu.
rem ============================================================
cd /d "E:\APP-LAPTOP-SYNC\cencomOS_gara_4.0_supa\Onpremise"
set "LOG=%CD%\backup\watchdog.log"
if not exist "%CD%\backup" mkdir "%CD%\backup"
set "ALERT=%CD%\backup\UNHEALTHY_STREAK"
set "STREAK=0"
if exist "%ALERT%" set /p STREAK=<"%ALERT%"

set "HEALTH_URL=https://127.0.0.1:18443/api/health"
"C:\Program Files\Git\bin\bash.exe" -c "export HEALTH_URL='https://127.0.0.1:18443/api/health'; cd '/e/APP-LAPTOP-SYNC/cencomOS_gara_4.0_supa/Onpremise' && bash scripts/healthcheck.sh" > "%TEMP%\hc_out.txt" 2>&1
if errorlevel 1 goto unhealthy

:healthy
echo [%date% %time%] HEALTHY >> "%LOG%"
if exist "%ALERT%" del "%ALERT%"
exit /b 0

:unhealthy
set /a STREAK=STREAK+1
echo %STREAK%> "%ALERT%"
echo [%date% %time%] UNHEALTHY (streak=%STREAK%) >> "%LOG%"
if %STREAK% GEQ 3 echo [%date% %time%] !!! ALERT: app Unhealthy %STREAK% lan lien tiep - canh bao nguoi truc >> "%LOG%"
rem TODO khi co SMTP/webhook: gui alert tai day (vd curl toi Telegram bridge)
exit /b 1
