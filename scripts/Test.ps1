$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
& '.venv\Scripts\python.exe' -m pytest backend/tests -q --basetemp=.test-tmp
if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed.' }
$localNode = Join-Path (Get-Location) '.tools\node-v22.16.0-win-x64'
if (Test-Path $localNode) { $env:Path = $localNode + ';' + $env:Path }
Push-Location frontend
try {
    npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'Frontend tests failed.' }
    npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
} finally { Pop-Location }
