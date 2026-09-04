param([string]$Dest = "$PSScriptRoot\..\pg-portable", [string]$Url = "https://get.enterprisedb.com/postgresql/postgresql-16.6-1-windows-x64-binaries.zip")
$ErrorActionPreference="Stop"
$pgCtl=Join-Path $Dest "bin\pg_ctl.exe"
if(Test-Path $pgCtl){Write-Host "PG already exists";exit 0}
$tmp=Join-Path $env:TEMP "pg-portable.zip"
Write-Host "Downloading PG..."
Invoke-WebRequest -Uri $Url -OutFile $tmp -UseBasicParsing
Write-Host "Extracting..."
$tmpDir=Join-Path $Dest "tmp"
Expand-Archive -Path $tmp -DestinationPath $tmpDir -Force
$inner=Get-ChildItem $tmpDir -Directory | Select-Object -First 1
if($inner){Copy-Item "$($inner.FullName)\*" $Dest -Recurse -Force;Remove-Item $tmpDir -Recurse -Force}
Remove-Item $tmp -Force -ErrorAction SilentlyContinue
Write-Host "Done"