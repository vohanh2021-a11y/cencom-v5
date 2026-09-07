@echo off
cd /d "E:\APP-LAPTOP-SYNC\cencomOS_gara_4.0_supa\Onpremise"
echo CWD=%CD% > smoke_run.log
for /f "tokens=1* delims==" %%a in (.env.onpremise.local) do set "%%a=%%b"
set SMOKE_BASE=https://127.0.0.1:18443
node -e "console.log('BASELEN='+process.env.SMOKE_BASE.length+' NODE='+process.version)" >> smoke_run.log 2>&1
node scripts/smoke_onpremise.mjs >> smoke_run.log 2>&1
echo SMOKE_EXIT=%ERRORLEVEL% >> smoke_run.log
