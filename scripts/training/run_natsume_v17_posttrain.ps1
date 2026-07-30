[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$aiRoot = Split-Path -Parent $projectRoot
$configPath = Join-Path $aiRoot 'AI\OneTrainer\training_configs\shiki_natsume_v17_wd14_curated.json'
$outputPath = Join-Path $aiRoot 'AI\OneTrainer\output\shiki_natsume_v17_wd14_curated.safetensors'
$evalPath = Join-Path $aiRoot 'AI\Data\Models\Lora\shiki_natsume_v17_wd14_eval.safetensors'
$pythonPath = Join-Path $aiRoot 'AI\OneTrainer\venv\Scripts\python.exe'
$auditPath = Join-Path $projectRoot 'scripts\maintenance\audit-natsume-v17-wd14.py'
$webuiScript = Join-Path $projectRoot 'scripts\runtime\managed-webui.ps1'
$logPath = Join-Path $aiRoot 'AI\OneTrainer\logs\shiki_natsume_v17_posttrain.log'

function Write-PosttrainLog([string]$message) {
    Add-Content -LiteralPath $logPath -Encoding utf8 -Value ("{0} {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $message)
}

Write-PosttrainLog 'watcher started'
while (Get-CimInstance Win32_Process | Where-Object {
    $_.Name -match '^python(?:\.exe)?$' -and $_.CommandLine -like "*$configPath*"
}) {
    Start-Sleep -Seconds 30
}

if (-not (Test-Path -LiteralPath $outputPath -PathType Leaf)) {
    Write-PosttrainLog "training exited without artifact: $outputPath"
    exit 1
}
Copy-Item -LiteralPath $outputPath -Destination $evalPath -Force
$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $evalPath).Hash
Write-PosttrainLog "evaluation artifact copied sha256=$hash"

$webui = & powershell -ExecutionPolicy Bypass -File $webuiScript -Action Start
Write-PosttrainLog "webui start: $webui"
$ready = $false
for ($attempt = 0; $attempt -lt 120; $attempt += 1) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:7860/sdapi/v1/sd-models' -TimeoutSec 3
        if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Start-Sleep -Seconds 5
}
if (-not $ready) {
    Write-PosttrainLog 'webui API did not become ready'
    exit 2
}

Write-PosttrainLog 'blind evaluation generation started'
& $pythonPath $auditPath *>> $logPath
$exitCode = $LASTEXITCODE
Write-PosttrainLog "blind evaluation generation exited code=$exitCode"
exit $exitCode
