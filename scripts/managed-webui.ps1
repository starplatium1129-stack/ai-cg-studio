[CmdletBinding()]
param(
    [ValidateSet('Start', 'Stop', 'Status')]
    [string]$Action = 'Status'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$aiRoot = Split-Path -Parent $projectRoot
$packageRoot = Join-Path $aiRoot 'AI\Data\Packages\Stable Diffusion WebUI reForge'
$pythonPath = Join-Path $packageRoot 'venv\Scripts\python.exe'
$launchPath = Join-Path $packageRoot 'launch.py'
$imagesPath = Join-Path $aiRoot 'AI\Data\Images'
$stateDir = Join-Path $projectRoot 'runtime\state'
$logDir = Join-Path $projectRoot 'runtime\logs'
$pidFile = Join-Path $stateDir 'managed-webui.pid'
$stdoutLog = Join-Path $logDir 'webui.stdout.log'
$stderrLog = Join-Path $logDir 'webui.stderr.log'

function Write-Result([bool]$ok, [string]$state, [bool]$managed, [string]$message, [int]$processId = 0) {
    [pscustomobject]@{ ok = $ok; state = $state; managed = $managed; message = $message; pid = $processId } |
        ConvertTo-Json -Compress
}

function Test-ManagedProcess($processInfo) {
    if (-not $processInfo -or -not $processInfo.CommandLine) { return $false }
    return $processInfo.CommandLine -match [Regex]::Escape($pythonPath) -and
        $processInfo.CommandLine -match [Regex]::Escape($launchPath) -and
        $processInfo.CommandLine -match '(?i)(?:^|\s)--api(?:\s|$)' -and
        $processInfo.CommandLine -match '(?i)(?:^|\s)--port\s+7860(?:\s|$)'
}

function Get-ManagedProcess {
    if (-not (Test-Path -LiteralPath $pidFile -PathType Leaf)) { return $null }
    $savedPid = (Get-Content -LiteralPath $pidFile -Raw).Trim()
    if ($savedPid -notmatch '^\d+$') { return $null }
    $candidate = Get-CimInstance Win32_Process -Filter "ProcessId = $savedPid" -ErrorAction SilentlyContinue
    if (Test-ManagedProcess $candidate) { return $candidate }
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    return $null
}

function Test-WebUIApi {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:7860/sdapi/v1/sd-models' -TimeoutSec 2
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 300
    } catch {
        return $false
    }
}

New-Item -ItemType Directory -Force -Path $stateDir, $logDir | Out-Null
$managedProcess = Get-ManagedProcess

if ($Action -eq 'Status') {
    if ($managedProcess) { Write-Result $true 'managed-running' $true 'Control panel manages this WebUI process.' $managedProcess.ProcessId; exit 0 }
    if (Test-WebUIApi) { Write-Result $true 'external-running' $false 'WebUI is already running outside the control panel.'; exit 0 }
    Write-Result $true 'stopped' $false 'WebUI is not running.'; exit 0
}

if ($Action -eq 'Stop') {
    if (-not $managedProcess) {
        Write-Result $true 'external-or-stopped' $false 'No control-panel-managed WebUI process to stop.'
        exit 0
    }
    & taskkill.exe /PID $managedProcess.ProcessId /T /F | Out-Null
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    Write-Result $true 'stopped' $true 'Stopped the WebUI process started by the control panel.' $managedProcess.ProcessId
    exit 0
}

if (Test-WebUIApi) {
    $message = if ($managedProcess) { 'Control-panel-managed WebUI is already ready.' } else { 'WebUI is already running outside the control panel.' }
    $processId = if ($managedProcess) { $managedProcess.ProcessId } else { 0 }
    Write-Result $true 'already-running' ([bool]$managedProcess) $message $processId
    exit 0
}
if ($managedProcess) {
    Write-Result $true 'starting' $true 'WebUI is still starting.' $managedProcess.ProcessId
    exit 0
}
if (-not (Test-Path -LiteralPath $pythonPath -PathType Leaf) -or -not (Test-Path -LiteralPath $launchPath -PathType Leaf)) {
    Write-Result $false 'unavailable' $false 'Configured Stability Matrix reForge installation was not found.'
    exit 1
}

$arguments = @(
    '-u', ('"{0}"' -f $launchPath),
    '--pin-shared-memory', '--cuda-malloc', '--cuda-stream', '--skip-install',
    '--api', '--port', '7860', '--gradio-allowed-path', $imagesPath
)
$process = Start-Process -FilePath $pythonPath -ArgumentList $arguments -WorkingDirectory $packageRoot -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru
Set-Content -LiteralPath $pidFile -Value $process.Id -Encoding ASCII
Write-Result $true 'starting' $true 'Started Stability Matrix reForge with the saved API arguments.' $process.Id
