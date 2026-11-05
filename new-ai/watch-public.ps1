# NEW AI — keeps the public link alive.
#
# Cloudflare can reclaim an account-less quick tunnel at any time ("Tunnel not
# found"). This loop checks the current address every two minutes and runs
# start-public.ps1 when it stops answering, which creates a fresh tunnel and
# republishes it to proxy.json. Two consecutive failures are required so a
# brief network blip does not rotate a healthy tunnel.

$root     = Split-Path -Parent $MyInvocation.MyCommand.Path
$launcher = Join-Path $root 'start-public.ps1'
$logFile  = Join-Path $env:LOCALAPPDATA 'newai\cloudflared.err.log'
$failures = 0

while ($true) {
  Start-Sleep -Seconds 120

  $healthy = $false
  try {
    if (Test-Path $logFile) {
      $hit = Select-String -Path $logFile -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches |
        Select-Object -First 1
      if ($hit) {
        $url = $hit.Matches[0].Value
        $res = Invoke-WebRequest -UseBasicParsing "$url/api/health" -TimeoutSec 15
        $healthy = $res.StatusCode -eq 200
      }
    }
  } catch {
    $healthy = $false
  }

  if ($healthy) {
    $failures = 0
    continue
  }

  $failures += 1
  if ($failures -lt 2) { continue }

  $failures = 0
  try {
    & powershell -NoProfile -ExecutionPolicy Bypass -File $launcher *> $null
  } catch {
    # the next round will try again
  }
}
