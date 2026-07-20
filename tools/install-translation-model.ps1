[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$aiRoot = Join-Path (Split-Path -Parent $projectRoot) 'AI'
$pythonPath = Join-Path $aiRoot 'GPT-SoVITS-env\python.exe'
$modelPath = Join-Path $aiRoot 'Voice\models\translation\m2m100_418m'

if (-not (Test-Path -LiteralPath $pythonPath -PathType Leaf)) {
    throw "GPT-SoVITS Python environment was not found: $pythonPath"
}

& $pythonPath -c @"
from huggingface_hub import snapshot_download
snapshot_download('facebook/m2m100_418M', local_dir=r'$modelPath')
print(r'$modelPath')
"@
