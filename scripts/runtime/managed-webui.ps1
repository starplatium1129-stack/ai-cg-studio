[CmdletBinding()]
param(
    [ValidateSet('Start', 'Stop', 'Status')]
    [string]$Action = 'Status',
    [Parameter(Mandatory = $true)][string]$PackageRoot,
    [Parameter(Mandatory = $true)][string]$RuntimeRoot,
    [Parameter(Mandatory = $true)][string]$WebuiHost,
    [Parameter(Mandatory = $true)][string]$ImagesRoot,
    [Parameter(Mandatory = $true)][string]$ControlNetRoot
)

$ErrorActionPreference = 'Stop'
$packageRoot = [IO.Path]::GetFullPath($PackageRoot)
$runtimeRoot = [IO.Path]::GetFullPath($RuntimeRoot)
$pythonPath = Join-Path $packageRoot 'venv\Scripts\python.exe'
$launchPath = Join-Path $packageRoot 'launch.py'
$imagesPath = [IO.Path]::GetFullPath($ImagesRoot)
$controlNetPath = [IO.Path]::GetFullPath($ControlNetRoot)
$stateDir = Join-Path $runtimeRoot 'state'
$logDir = Join-Path $runtimeRoot 'logs'
$pidFile = Join-Path $stateDir 'managed-webui.pid'
$stdoutLog = Join-Path $logDir 'webui.stdout.log'
$stderrLog = Join-Path $logDir 'webui.stderr.log'
$uri = [Uri]$WebuiHost
$port = $uri.Port
if ($uri.Scheme -ne 'http' -or $uri.Host -notin @('127.0.0.1', 'localhost', '::1') -or $port -lt 1) { throw 'WebUI host must be a loopback http URL.' }

function Write-Result([bool]$ok, [string]$state, [bool]$managed, [string]$message, [int]$processId = 0) {
    [pscustomobject]@{ ok = $ok; state = $state; managed = $managed; message = $message; pid = $processId } | ConvertTo-Json -Compress
}

function Test-ManagedProcess($processInfo) {
    if (-not $processInfo -or -not $processInfo.CommandLine) { return $false }
    return $processInfo.CommandLine -match [Regex]::Escape($pythonPath) -and
        $processInfo.CommandLine -match [Regex]::Escape($launchPath) -and
        $processInfo.CommandLine -match '(?i)(?:^|\s)--(?:api|nowebui)(?:\s|$)' -and
        $processInfo.CommandLine -match ('(?i)(?:^|\s)--port\s+' + $port + '(?:\s|$)')
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
        $response = Invoke-WebRequest -UseBasicParsing -Uri ($WebuiHost.TrimEnd('/') + '/sdapi/v1/sd-models') -TimeoutSec 2
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 300
    } catch { return $false }
}
function Wait-Ready([int]$seconds = 300) {
    $deadline = (Get-Date).AddSeconds($seconds)
    do { if (Test-WebUIApi) { return $true }; Start-Sleep -Milliseconds 500 } while ((Get-Date) -lt $deadline)
    return $false
}

New-Item -ItemType Directory -Force -Path $stateDir, $logDir | Out-Null
$managedProcess = Get-ManagedProcess
if ($Action -eq 'Status') {
    if ($managedProcess) { Write-Result $true 'managed-running' $true 'Control panel manages this WebUI process.' $managedProcess.ProcessId; exit 0 }
    if (Test-WebUIApi) { Write-Result $true 'external-running' $false 'WebUI is already running outside the control panel.'; exit 0 }
    Write-Result $true 'stopped' $false 'WebUI is not running.'; exit 0
}
if ($Action -eq 'Stop') {
    if (-not $managedProcess) { Write-Result $true 'external-or-stopped' $false 'No control-panel-managed WebUI process to stop.'; exit 0 }
    & taskkill.exe /PID $managedProcess.ProcessId /T /F | Out-Null
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    Write-Result $true 'stopped' $true 'Stopped the WebUI process started by the control panel.' $managedProcess.ProcessId; exit 0
}
if (Test-WebUIApi) {
    $processId = if ($managedProcess) { $managedProcess.ProcessId } else { 0 }
    Write-Result $true 'already-running' ([bool]$managedProcess) 'WebUI is already ready.' $processId; exit 0
}
if ($managedProcess) { Write-Result $true 'starting' $true 'WebUI is still starting.' $managedProcess.ProcessId; exit 0 }
if (-not (Test-Path -LiteralPath $pythonPath -PathType Leaf) -or -not (Test-Path -LiteralPath $launchPath -PathType Leaf)) {
    Write-Result $false 'unavailable' $false 'Configured Stability Matrix reForge installation was not found.'; exit 1
}
$arguments = @('-u', ('"{0}"' -f $launchPath), '--cuda-malloc', '--cuda-stream', '--skip-install',
    '--nowebui', '--skip-load-model-at-start', '--port', $port,
    '--controlnet-dir', ('"{0}"' -f $controlNetPath), '--gradio-allowed-path', ('"{0}"' -f $imagesPath))
$process = Start-Process -FilePath $pythonPath -ArgumentList $arguments -WorkingDirectory $packageRoot -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru
Set-Content -LiteralPath $pidFile -Value $process.Id -Encoding ASCII
if (Wait-Ready) { Write-Result $true 'ready' $true 'Started Stability Matrix reForge and waited for its API.' $process.Id; exit 0 }
Write-Result $false 'timeout' $true 'WebUI did not become ready before the startup deadline.' $process.Id; exit 1
