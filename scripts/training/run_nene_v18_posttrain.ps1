[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$configNeedle = 'ayachi_nene_v18_wd14_curated.json'
$source = 'E:\code\2\lora\AI\OneTrainer\output\ayachi_nene_v18_wd14_curated.safetensors'
$destination = 'E:\code\2\lora\AI\Data\Models\Lora\ayachi_nene_v18_wd14_eval.safetensors'
$project = 'E:\code\2\lora\AI-CG-Studio'
$python = 'E:\code\2\lora\AI\OneTrainer\venv\Scripts\python.exe'
$log = 'E:\code\2\lora\AI\OneTrainer\logs\ayachi_nene_v18_posttrain.log'

function Write-Log([string]$message) {
    $line = ('{0} {1}' -f (Get-Date -Format o), $message)
    Add-Content -LiteralPath $log -Value $line -Encoding UTF8
}

Write-Log 'waiting for Nene v18 training process'
while ($true) {
    $training = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -eq 'python.exe' -and $_.CommandLine -like "*$configNeedle*" }
    if (-not $training) { break }
    Start-Sleep -Seconds 15
}

if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
    throw "training ended without output: $source"
}
if (Test-Path -LiteralPath $destination -PathType Leaf) {
    $sourceHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
    $destinationHash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash
    if ($sourceHash -ne $destinationHash) {
        throw "refusing to overwrite a different evaluated artifact: $destination"
    }
} else {
    Copy-Item -LiteralPath $source -Destination $destination
}
Write-Log "copied evaluated artifact to $destination"

$startResult = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$project\scripts\runtime\managed-webui.ps1" -Action Start
Write-Log "WebUI start: $startResult"
$deadline = (Get-Date).AddMinutes(20)
while ((Get-Date) -lt $deadline) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:7860/sdapi/v1/options' -TimeoutSec 3
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) { break }
    } catch {}
    Start-Sleep -Seconds 10
}
if ((Get-Date) -ge $deadline) {
    throw 'WebUI did not become ready within 20 minutes'
}

$env:NENE_V18_GATE_TAG = 'final'
Write-Log 'starting fixed-seed v16/v18 gate'
Push-Location $project
try {
    & $python "$project\scripts\maintenance\audit-nene-v18-wd14.py" *>> $log
    if ($LASTEXITCODE -ne 0) { throw "Nene v18 gate exited $LASTEXITCODE" }
} finally {
    Pop-Location
}
Write-Log 'Nene v18 gate complete'
