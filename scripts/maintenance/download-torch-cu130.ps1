# Download torch/torchvision/torchaudio cu130 wheels from Aliyun mirror
# with parallel ranged curl streams, then print local paths for pip install.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/maintenance/download-torch-cu130.ps1 [-OutDir <dir>]
param(
  [string]$OutDir = 'E:\code\2\lora\AI-CG-Studio\runtime\downloads'
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$base = 'https://mirrors.aliyun.com/pytorch-wheels/cu130/'
$files = @(
  @{ name = 'torch-2.9.1+cu130-cp311-cp311-win_amd64.whl'; url = $base + 'torch-2.9.1%2Bcu130-cp311-cp311-win_amd64.whl'; streams = 8 },
  @{ name = 'torchvision-0.24.1+cu130-cp311-cp311-win_amd64.whl'; url = $base + 'torchvision-0.24.1%2Bcu130-cp311-cp311-win_amd64.whl'; streams = 2 },
  @{ name = 'torchaudio-2.9.1+cu130-cp311-cp311-win_amd64.whl'; url = $base + 'torchaudio-2.9.1%2Bcu130-cp311-cp311-win_amd64.whl'; streams = 2 }
)

foreach ($f in $files) {
  $target = Join-Path $OutDir $f.name
  if ((Test-Path $target) -and (Get-Item $target).Length -gt 10MB) {
    Write-Host "SKIP $($f.name) (exists)"
    continue
  }
  Write-Host "PROBE $($f.name)"
  $head = & curl.exe -sIL --max-time 20 $f.url 2>$null
  $len = 0
  foreach ($line in $head) {
    if ($line -match '^content-length:\s*(\d+)') { $len = [int64]$Matches[1] }
  }
  if ($len -le 0) { throw "HEAD failed for $($f.name)" }
  Write-Host ("SIZE {0:N2} GB" -f ($len / 1GB))

  # parallel ranged streams into part files
  $parts = @()
  $n = $f.streams
  $chunk = [math]::Ceiling($len / $n)
  $jobs = @()
  for ($i = 0; $i -lt $n; $i++) {
    $start = $i * $chunk
    $end = if ($i -eq $n - 1) { $len - 1 } else { [Math]::Min($len - 1, $start + $chunk - 1) }
    $part = "$target.part$i"
    $parts += $part
    $jobs += Start-Job -ArgumentList $f.url, $start, $end, $part -ScriptBlock {
      param($url, $s, $e, $out)
      & curl.exe -sL --retry 8 --retry-all-errors --retry-delay 3 --max-time 1800 -r "${s}-${e}" -o $out $url
      exit $LASTEXITCODE
    }
  }
  foreach ($j in $jobs) { Wait-Job $j | Out-Null; if ((Receive-Job $j) -ne 0) { throw "stream failed for $($f.name)" } }
  # concat parts
  $fs = [System.IO.File]::Open($target, [System.IO.FileMode]::Create)
  foreach ($part in $parts) {
    $data = [System.IO.File]::ReadAllBytes($part)
    $fs.Write($data, 0, $data.Length)
    Remove-Item $part -Force
  }
  $fs.Close()
  $final = (Get-Item $target).Length
  if ($final -ne $len) { throw "size mismatch for $($f.name): $final != $len" }
  Write-Host "OK $($f.name) $([math]::Round($final / 1GB, 2)) GB"
}
Write-Host 'ALL WHEELS READY'
