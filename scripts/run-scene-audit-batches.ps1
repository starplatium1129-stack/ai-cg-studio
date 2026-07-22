param(
    [string]$Output = 'E:\code\2\lora\AI\SceneAudits\2026-07-22_v14_final',
    [int]$BatchSize = 25,
    [int]$Attempt = 1,
    [switch]$Review
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$python = 'E:\code\2\lora\AI\OneTrainer\venv\Scripts\python.exe'
$audit = Join-Path $PSScriptRoot 'audit-scenes.py'
$manager = Join-Path $PSScriptRoot 'managed-webui.ps1'
$total = [int](& node -e "console.log(require('./data/scenes.json').length)" -- $repo)

function Wait-WebUI {
    for ($index = 0; $index -lt 36; $index += 1) {
        try {
            Invoke-RestMethod -Uri 'http://127.0.0.1:7860/sdapi/v1/options' -TimeoutSec 5 | Out-Null
            Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:7860/sdapi/v1/refresh-loras' -TimeoutSec 30 | Out-Null
            return
        } catch {
            Start-Sleep -Seconds 5
        }
    }
    throw 'WebUI did not become ready in time.'
}

for ($offset = 0; $offset -lt $total; $offset += $BatchSize) {
    & $manager -Action Start | Out-Host
    Wait-WebUI
    Write-Host "[batch] offset=$offset limit=$BatchSize total=$total"
    & $python $audit generate --output $Output --offset $offset --limit $BatchSize --attempt $Attempt
    if ($LASTEXITCODE -ne 0) { throw "Scene generation failed at offset $offset." }
    & $manager -Action Stop | Out-Host
    Start-Sleep -Seconds 5
}

if ($Review) {
    & $python $audit review --output $Output --attempt $Attempt --vision-workers 2
    if ($LASTEXITCODE -ne 0) { throw 'Scene review failed.' }
}
