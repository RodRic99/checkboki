$ErrorActionPreference = 'Stop'

# OneDrive 작업 폴더에서는 electron-builder의 원자적 rename이 실패할 수 있으므로
# 실제 패키징은 사용자 임시 폴더에서 수행하고 완성된 EXE만 프로젝트로 복사한다.
$projectRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $projectRoot
$output = Join-Path $env:TEMP 'checkboki-electron-builder'
$destination = Join-Path $workspaceRoot 'distribution'

New-Item -ItemType Directory -Force -Path $output, $destination | Out-Null
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'

& (Join-Path $projectRoot 'node_modules\.bin\electron-builder.cmd') `
  --win portable `
  "--config.directories.output=$output"

if ($LASTEXITCODE -ne 0) { throw "electron-builder failed with exit code $LASTEXITCODE" }

$artifact = Join-Path $output 'Checkboki-0.1.3-x64.exe'
Copy-Item -LiteralPath $artifact -Destination (Join-Path $destination 'Checkboki-0.1.3-x64.exe') -Force
Write-Host "Created: $(Join-Path $destination 'Checkboki-0.1.3-x64.exe')"
