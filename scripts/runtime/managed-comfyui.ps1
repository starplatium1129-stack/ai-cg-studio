[CmdletBinding()]
param(
    [ValidateSet('Start', 'Stop', 'Status')][string]$Action = 'Status',
    [Parameter(Mandatory = $true)][string]$AIWorkspaceRoot,
    [Parameter(Mandatory = $true)][string]$RuntimeRoot,
    [Parameter(Mandatory = $true)][string]$ComfyHost
)
$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath($AIWorkspaceRoot)
$runtimeRoot = [IO.Path]::GetFullPath($RuntimeRoot)
$comfyRoot = Join-Path $workspace 'ComfyUI'
$pythonPath = Join-Path $comfyRoot 'venv\Scripts\python.exe'
$mainPath = Join-Path $comfyRoot 'main.py'
$stateDir = Join-Path $runtimeRoot 'state'
$logDir = Join-Path $runtimeRoot 'logs'
$pidFile = Join-Path $stateDir 'managed-comfyui.pid'
$stdoutLog = Join-Path $logDir 'comfyui.stdout.log'
$stderrLog = Join-Path $logDir 'comfyui.stderr.log'
$uri = [Uri]$ComfyHost
$port = $uri.Port
if ($uri.Scheme -ne 'http' -or $uri.Host -notin @('127.0.0.1', 'localhost', '::1') -or $port -lt 1) { throw 'ComfyUI host must be a loopback http URL.' }
function Write-Result([bool]$ok, [string]$state, [bool]$managed, [string]$message, [int]$processId = 0) {
    [pscustomobject]@{ ok = $ok; state = $state; managed = $managed; message = $message; pid = $processId } | ConvertTo-Json -Compress
}
function Test-ManagedProcess($processInfo) {
    if (-not $processInfo -or -not $processInfo.CommandLine) { return $false }
    return $processInfo.CommandLine -match [Regex]::Escape($pythonPath) -and
        $processInfo.CommandLine -match [Regex]::Escape($mainPath) -and
        $processInfo.CommandLine -match ('(?i)(?:^|\s)--listen\s+' + $uri.Host + '(?:\s|$)') -and
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
function Test-ComfyApi {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri ($ComfyHost.TrimEnd('/') + '/system_stats') -TimeoutSec 2
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 300
    } catch { return $false }
}
function Wait-Ready([int]$seconds = 90) {
    $deadline = (Get-Date).AddSeconds($seconds)
    do { if (Test-ComfyApi) { return $true }; Start-Sleep -Milliseconds 500 } while ((Get-Date) -lt $deadline)
    return $false
}
New-Item -ItemType Directory -Force -Path $stateDir, $logDir | Out-Null
$managedProcess = Get-ManagedProcess
if ($Action -eq 'Status') {
    if ($managedProcess) { Write-Result $true 'managed-running' $true 'Control panel manages this ComfyUI process.' $managedProcess.ProcessId; exit 0 }
    if (Test-ComfyApi) { Write-Result $true 'external-running' $false 'ComfyUI is already running outside the control panel.'; exit 0 }
    Write-Result $true 'stopped' $false 'ComfyUI is not running.'; exit 0
}
if ($Action -eq 'Stop') {
    if (-not $managedProcess) { Write-Result $true 'external-or-stopped' $false 'No control-panel-managed ComfyUI process to stop.'; exit 0 }
    & taskkill.exe /PID $managedProcess.ProcessId /T /F | Out-Null
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    Write-Result $true 'stopped' $true 'Stopped the ComfyUI process started by the control panel.' $managedProcess.ProcessId; exit 0
}
if (Test-ComfyApi) {
    $processId = if ($managedProcess) { $managedProcess.ProcessId } else { 0 }
    Write-Result $true 'already-running' ([bool]$managedProcess) 'ComfyUI is already ready.' $processId; exit 0
}
if ($managedProcess) { Write-Result $true 'starting' $true 'ComfyUI is still starting.' $managedProcess.ProcessId; exit 0 }
if (-not (Test-Path -LiteralPath $pythonPath -PathType Leaf) -or -not (Test-Path -LiteralPath $mainPath -PathType Leaf)) {
    Write-Result $false 'unavailable' $false 'Configured ComfyUI installation was not found.'; exit 1
}
$arguments = @('-u', ('"{0}"' -f $mainPath), '--listen', $uri.Host, '--port', $port, '--disable-pinned-memory')
$process = Start-Process -FilePath $pythonPath -ArgumentList $arguments -WorkingDirectory $comfyRoot -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru
Set-Content -LiteralPath $pidFile -Value $process.Id -Encoding ASCII
if (Wait-Ready) { Write-Result $true 'ready' $true 'Started ComfyUI and waited for /system_stats.' $process.Id; exit 0 }
Write-Result $false 'timeout' $true 'ComfyUI did not become ready before the startup deadline.' $process.Id; exit 1
