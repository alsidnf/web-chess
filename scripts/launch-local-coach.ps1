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
Write-Host "웹 체스 + Stockfish 코치를 시작합니다."
Write-Host "프로젝트: $repoRoot"

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js/npm을 찾지 못했습니다. Node.js를 먼저 설치해 주세요."
  Read-Host "Enter를 누르면 닫습니다"
  exit 1
}

if (Test-Path $stockfishPath) {
  $env:STOCKFISH_PATH = $stockfishPath
  Write-Host "Stockfish: $stockfishPath"
} else {
  Write-Host "Stockfish 자동 경로를 찾지 못했습니다. 앱이 PATH 또는 STOCKFISH_PATH를 다시 확인합니다."
}

$existingProcessIds = Get-PortProcessIds -Ports @($webPort, $coachPort)
if ($existingProcessIds) {
  Write-Host ""
  Write-Host "이미 사용 중인 포트가 있습니다: $($existingProcessIds -join ', ')"
  $answer = Read-Host "기존 웹 체스/코치 프로세스를 종료하고 새로 시작할까요? (Y/N)"
  if ($answer -notin @("Y", "y")) {
    Write-Host "시작을 취소했습니다."
    Read-Host "Enter를 누르면 닫습니다"
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
Write-Host "앱을 켜는 중입니다..."
Write-Host "로그: $outLog"

$webReady = Wait-ForUrl -Url $webUrl -TimeoutSeconds 45
$apiReady = Wait-ForUrl -Url "http://127.0.0.1:$coachPort/api/health" -TimeoutSeconds 20

if ($webReady) {
  Start-Process $webUrl
  Write-Host "웹앱을 열었습니다: $webUrl"
} else {
  Write-Host "웹앱 준비 시간이 초과되었습니다. 로그를 확인해 주세요."
}

if ($apiReady) {
  Write-Host "Stockfish 코치 서버가 준비되었습니다."
} else {
  Write-Host "코치 서버 준비 시간이 초과되었습니다. Stockfish 설치와 로그를 확인해 주세요."
}

Write-Host ""
Write-Host "종료하려면 이 창에서 Enter를 누르세요."
Read-Host | Out-Null

Write-Host "웹앱과 코치 서버를 종료합니다..."
Stop-ProcessTree -ProcessId $process.Id
foreach ($processId in (Get-PortProcessIds -Ports @($webPort, $coachPort))) {
  Stop-ProcessTree -ProcessId $processId
}
Write-Host "종료 완료."
Start-Sleep -Seconds 1
