param(
    [string]$LogPath
)

$c = Get-Content $LogPath -ErrorAction SilentlyContinue
if (-not $c) { Write-Host "LOG_NOT_FOUND"; exit }

$m = $c | Select-String -Pattern 'https://\S+trycloudflare\.com' | Select-Object -First 1
if ($m) {
    $m.Matches[0].Value
} else {
    Write-Host "URL_NOT_FOUND"
}
