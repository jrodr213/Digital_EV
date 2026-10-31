param([switch]$Production)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Test-Path '.venv\Scripts\python.exe')) { throw 'Run .\scripts\Setup.ps1 first.' }
$localNode = Join-Path (Get-Location) '.tools\node-v22.16.0-win-x64'
if (Test-Path $localNode) { $env:Path = $localNode + ';' + $env:Path }
if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22.16+ (with npm), or run .\scripts\Setup.ps1.' }
if ($Production -and -not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'npm is required to build the production frontend. Run .\scripts\Setup.ps1.' }
if (-not (Test-Path 'frontend\node_modules\vite')) { throw 'Frontend dependencies missing. Run .\scripts\Setup.ps1 first.' }

Push-Location frontend
try {
    if ($Production) {
        # An explicit built run always rebuilds before serving it.
        npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed; server was not started.' }
    } else {
        # Vite reads source directly; the launcher also starts the reloading API.
        & node.exe scripts/dev.mjs
        if ($LASTEXITCODE -ne 0) { throw 'Live preview failed. Check the server output above.' }
    }
} finally { Pop-Location }

if ($Production) {
    $previousMode = $env:EV_PREVIEW_MODE
    try {
        $env:EV_PREVIEW_MODE = 'built'
        Write-Host 'EV / Twin: http://127.0.0.1:8000 | API: http://127.0.0.1:8000/docs | Ctrl+C to stop'
        & '.venv\Scripts\python.exe' -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8000
        if ($LASTEXITCODE -ne 0) { throw 'EV / Twin server failed.' }
    } finally { $env:EV_PREVIEW_MODE = $previousMode }
}
