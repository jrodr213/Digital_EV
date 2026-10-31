$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
Write-Output 'EV / Twin: checking local server'

# Only reuse a source-backed preview from this workspace, never an old build.
$ready = $false
try {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 3
    $page = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/' -UseBasicParsing -TimeoutSec 3
    $ready = $health.status -eq 'ok' -and $health.fastsim -and
        $health.preview_mode -eq 'live' -and
        $health.workspace -eq (Get-Location).Path -and
        $page.StatusCode -eq 200 -and $page.Content.Contains('/@vite/client')
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
