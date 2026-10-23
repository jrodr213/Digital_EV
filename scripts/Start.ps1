$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Test-Path '.venv\Scripts\python.exe')) { throw 'Run .\scripts\Setup.ps1 first.' }
if (-not (Test-Path 'frontend\dist\index.html')) { throw 'Frontend build missing. Run .\scripts\Setup.ps1.' }
Write-Host 'EV / Twin: http://127.0.0.1:8000 | API: http://127.0.0.1:8000/docs | Ctrl+C to stop'
& '.venv\Scripts\python.exe' -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8000
