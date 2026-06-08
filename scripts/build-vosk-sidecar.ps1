param(
  [switch]$Force,
  [string]$PythonCommand = $env:SABBATHCUE_SIDECAR_PYTHON
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$SidecarDir = Join-Path $ProjectRoot "sidecars"
$OutputExe = Join-Path $SidecarDir "vosk_worker.exe"
$BuildRoot = Join-Path $ProjectRoot "tmp\vosk-sidecar"
$VenvDir = Join-Path $BuildRoot ".venv"
$WorkerScript = Join-Path $ProjectRoot "scripts\vosk_worker.py"

if ([string]::IsNullOrWhiteSpace($PythonCommand)) {
  $PythonCommand = "python"
}

$PythonCommandParts = $PythonCommand.Trim() -split "\s+"
$PythonExe = $PythonCommandParts[0]
$PythonBaseArgs = @()
if ($PythonCommandParts.Length -gt 1) {
  $PythonBaseArgs = $PythonCommandParts[1..($PythonCommandParts.Length - 1)]
}

if ((-not $Force) -and (Test-Path $OutputExe)) {
  Write-Host "Vosk sidecar already exists: $OutputExe"
  exit 0
}

if (-not (Test-Path $WorkerScript)) {
  throw "Vosk worker script not found: $WorkerScript"
}

New-Item -ItemType Directory -Force -Path $SidecarDir | Out-Null
New-Item -ItemType Directory -Force -Path $BuildRoot | Out-Null

if ((-not $Force) -and (Test-Path (Join-Path $VenvDir "Scripts\python.exe"))) {
  Write-Host "Using existing Vosk sidecar build venv: $VenvDir"
} else {
  Remove-Item -LiteralPath $VenvDir -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "Creating Vosk sidecar build venv: $VenvDir"
  & $PythonExe @PythonBaseArgs -m venv $VenvDir
}

$Python = Join-Path $VenvDir "Scripts\python.exe"

Write-Host "Installing Vosk sidecar build dependencies"
& $Python -m pip install --upgrade pip
& $Python -m pip install --only-binary=:all: vosk pyinstaller

$PyinstallerWork = Join-Path $BuildRoot "pyinstaller-work"
$PyinstallerSpec = Join-Path $BuildRoot "pyinstaller-spec"
Remove-Item -LiteralPath $PyinstallerWork -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $PyinstallerSpec -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Building self-contained Vosk worker sidecar"
& $Python -m PyInstaller `
  --onefile `
  --clean `
  --name vosk_worker `
  --collect-all vosk `
  --distpath $SidecarDir `
  --workpath $PyinstallerWork `
  --specpath $PyinstallerSpec `
  $WorkerScript

if (-not (Test-Path $OutputExe)) {
  throw "Vosk sidecar build did not produce expected executable: $OutputExe"
}

Write-Host "Vosk sidecar ready: $OutputExe"
