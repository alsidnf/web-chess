$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$webPort = 5173
$coachPort = 8787
$webUrl = "http://127.0.0.1:$webPort/web-chess/"
$logDir = Join-Path $repoRoot "logs"
$outLog = Join-Path $logDir "local-coach.out.log"
$errLog = Join-Path $logDir "local-coach.err.log"
$stockfishPath = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages\Stockfish.Stockfish_Microsoft.Winget.Source_8wekyb3d8bbwe\stockfish\stockfish-windows-x86-64-avx2.exe"

function Stop-ProcessTree {
  param([int]$ProcessId)

  $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue
  foreach ($child in $children) {
    Stop-ProcessTree -ProcessId $child.ProcessId
  }

  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

function Get-PortProcessIds {
  param([int[]]$Ports)

  Get-NetTCPConnection -LocalPort $Ports -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
}

function Wait-ForUrl {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 30
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 | Out-Null
      return $true
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  return $false
}

Set-Location $repoRoot
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

Write-Host ""
Write-Host "Starting Web Chess + Stockfish Coach."
Write-Host "Project: $repoRoot"

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js/npm was not found. Please install Node.js first."
  Read-Host "Press Enter to close"
  exit 1
}

if (Test-Path $stockfishPath) {
  $env:STOCKFISH_PATH = $stockfishPath
  Write-Host "Stockfish: $stockfishPath"
} else {
  Write-Host "Stockfish was not found at the known WinGet path. The app will also check PATH and STOCKFISH_PATH."
}

$existingProcessIds = Get-PortProcessIds -Ports @($webPort, $coachPort)
if ($existingProcessIds) {
  Write-Host ""
  Write-Host "These ports are already in use by process id(s): $($existingProcessIds -join ', ')"
  $answer = Read-Host "Stop existing Web Chess/Coach processes and restart? (Y/N)"
  if ($answer -notin @("Y", "y")) {
    Write-Host "Startup cancelled."
    Read-Host "Press Enter to close"
    exit 0
  }

  foreach ($processId in $existingProcessIds) {
    Stop-ProcessTree -ProcessId $processId
  }
  Start-Sleep -Seconds 1
}

$process = Start-Process -FilePath "npm.cmd" `
  -ArgumentList @("run", "coach-ui") `
  -WorkingDirectory $repoRoot `
  -PassThru `
  -WindowStyle Hidden `
  -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog

Write-Host ""
Write-Host "Starting the app..."
Write-Host "Log: $outLog"

$webReady = Wait-ForUrl -Url $webUrl -TimeoutSeconds 45
$apiReady = Wait-ForUrl -Url "http://127.0.0.1:$coachPort/api/health" -TimeoutSeconds 20

if ($webReady) {
  Start-Process $webUrl
  Write-Host "Opened web app: $webUrl"
} else {
  Write-Host "Timed out while waiting for the web app. Please check the log."
}

if ($apiReady) {
  Write-Host "Stockfish coach server is ready."
} else {
  Write-Host "Timed out while waiting for the coach server. Please check Stockfish and the log."
}

Write-Host ""
Write-Host "Press Enter in this window to stop everything."
Read-Host | Out-Null

Write-Host "Stopping the web app and coach server..."
Stop-ProcessTree -ProcessId $process.Id
foreach ($processId in (Get-PortProcessIds -Ports @($webPort, $coachPort))) {
  Stop-ProcessTree -ProcessId $processId
}
Write-Host "Stopped."
Start-Sleep -Seconds 1
