$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
Write-Output 'EV / Twin: checking local server'

# Reuse the running app instead of starting another process on its port.
$ready = $false
try {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 3
    $page = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/' -UseBasicParsing -TimeoutSec 3
    $ready = $health.status -eq 'ok' -and $health.fastsim -and $page.StatusCode -eq 200
} catch {
    # Start.ps1 reports missing dependencies and server startup failures.
}
if ($ready) {
    # VS Code's output-based port detection also handles an existing server.
    Write-Output 'EV / Twin ready: http://127.0.0.1:8000'
    return
}

& (Join-Path $PSScriptRoot 'Start.ps1')
if ($LASTEXITCODE -ne 0) { throw 'EV / Twin server failed to start. Check the preview task output.' }
