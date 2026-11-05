# NEW AI — public tunnel launcher
#
# Starts the proxy on port 8788 (token protected) plus a Cloudflare quick
# tunnel, then republishes the current tunnel address into the published
# GitHub Pages copy as new-ai/proxy.json. The page reads that file on load, so
#   https://aminbaloch984-design.github.io/nabeel-ameen/new-ai/
# keeps working after a reboot without editing any code.
#
# Run manually:  powershell -ExecutionPolicy Bypass -File start-public.ps1
# Protect mode:  ... start-public.ps1 -Protect   (adds AUTH_TOKEN; visitors must
#                paste the token in Settings first)
#
# Auto start:    the startup shortcut runs it without -Protect, so the public
#                link opens and answers immediately.

param([switch]$Protect)

$ErrorActionPreference = 'Stop'

$root      = Split-Path -Parent $MyInvocation.MyCommand.Path
$stateDir  = Join-Path $env:LOCALAPPDATA 'newai'
$tokenFile = Join-Path $stateDir 'public-token.txt'
$cfExe     = Join-Path $stateDir 'cloudflared.exe'
$cfOut     = Join-Path $stateDir 'cloudflared.out.log'
$cfErr     = Join-Path $stateDir 'cloudflared.err.log'
$port      = 8788
$allowed   = 'https://aminbaloch984-design.github.io,http://127.0.0.1:8787'
$repoDir   = 'C:\Users\hp\AppData\Local\Temp\opencode\nabeel-ameen'
$proxyFile = Join-Path $repoDir 'new-ai\proxy.json'

New-Item -ItemType Directory -Force -Path $stateDir | Out-Null

# --- shared access token (created once, reused for every restart) -----------
if (-not (Test-Path $tokenFile)) {
  $new = -join ((1..40) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
  Set-Content -Path $tokenFile -Value $new -Encoding ASCII
}
$token = (Get-Content $tokenFile -Raw).Trim()

# --- local proxy ------------------------------------------------------------
function Test-Port {
  param([int]$Port)
  return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

if (-not (Test-Port -Port $port)) {
  $launcher = Join-Path $stateDir 'start-server.cmd'
  $nodeExe = Join-Path $env:ProgramFiles 'nodejs\node.exe'
  $serverJs = Join-Path $root 'server\server.js'
  $launchLine = '"{0}" "{1}"' -f $nodeExe, $serverJs
  $authLine = if ($Protect) { "set AUTH_TOKEN=$token" } else { 'set AUTH_TOKEN=' }
  $lines = @(
    '@echo off',
    "set PORT=$port",
    'set HOST=127.0.0.1',
    $authLine,
    "set ALLOWED_ORIGIN=$allowed",
    $launchLine
  )
  Set-Content -Path $launcher -Value $lines -Encoding ASCII
  Start-Process -FilePath $launcher -WindowStyle Hidden
  for ($i = 0; $i -lt 40; $i++) {
    if (Test-Port -Port $port) { break }
    Start-Sleep -Milliseconds 500
  }
  if (-not (Test-Port -Port $port)) { throw "proxy did not start on port $port" }
}

# --- cloudflare quick tunnel ------------------------------------------------
if (-not (Test-Path $cfExe)) {
  Invoke-WebRequest -UseBasicParsing `
    'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' `
    -OutFile $cfExe -TimeoutSec 300
}

function Get-TunnelUrl {
  foreach ($file in @($cfOut, $cfErr)) {
    if (-not (Test-Path $file)) { continue }
    $hit = Select-String -Path $file -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches |
      Select-Object -First 1
    if ($hit) { return $hit.Matches[0].Value }
  }
  return $null
}

function Test-Tunnel {
  param([string]$TunnelUrl)
  if (-not $TunnelUrl) { return $false }
  try {
    $r = Invoke-WebRequest -UseBasicParsing "$TunnelUrl/api/health" -TimeoutSec 12
    return $r.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Start-Tunnel {
  Remove-Item $cfOut, $cfErr -ErrorAction SilentlyContinue
  Start-Process -FilePath $cfExe -WindowStyle Hidden -RedirectStandardOutput $cfOut -RedirectStandardError $cfErr `
    -ArgumentList 'tunnel', '--url', "http://127.0.0.1:$port", '--no-autoupdate'
}

# A quick tunnel can be reclaimed by Cloudflare mid-day ("Tunnel not found"),
# so reuse the current one only while it actually answers.
$url = $null
if (Get-Process cloudflared -ErrorAction SilentlyContinue) {
  $url = Get-TunnelUrl
  if (-not (Test-Tunnel $url)) {
    Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
    $url = $null
  }
}

if (-not $url) {
  Start-Tunnel
  for ($i = 0; $i -lt 60 -and -not $url; $i++) {
    Start-Sleep -Milliseconds 1000
    $url = Get-TunnelUrl
  }
}

# The log may show the address before the edge accepts traffic.
for ($i = 0; $i -lt 12 -and $url -and -not (Test-Tunnel $url); $i++) {
  Start-Sleep -Seconds 2
}

if (-not $url) { throw 'cloudflared did not report a public URL' }
$proxy = "$url/api/chat"

# --- publish the address for the static page -------------------------------
$json = '{' + "`n" + '  "url": "' + $proxy + '",' + "`n" +
        '  "updated": "' + (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ') + '"' + "`n" + '}' + "`n"
[System.IO.File]::WriteAllText($proxyFile, $json, (New-Object System.Text.UTF8Encoding($false)))

$git = 'C:\Program Files\Git\cmd\git.exe'
if ((Test-Path (Join-Path $repoDir '.git')) -and (Test-Path $git)) {
  Push-Location $repoDir
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & $git add new-ai/proxy.json 2>&1 | Out-Null
    & $git commit -m "Point the published page at $url" --quiet 2>&1 | Out-Null
    & $git push origin main --quiet 2>&1 | Out-Null
  } finally {
    $ErrorActionPreference = $previous
    Pop-Location
  }
}

"NEW AI public link ready"
"  app   : $url"
"  proxy : $proxy"
"  token : $token"
