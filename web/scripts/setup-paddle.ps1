# Run Paddle sandbox catalog setup (reads .paddle-api-key.local — no quoting needed).
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "../..")

if (-not (Test-Path ".paddle-api-key.local")) {
  Write-Host "Create .paddle-api-key.local in the repo root with your full pdl_sdbx_apikey_... key on one line."
  Write-Host "See .paddle-api-key.local.example"
  exit 1
}

Remove-Item Env:PADDLE_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:PADDLE_SANDBOX_API_KEY -ErrorAction SilentlyContinue

node web/scripts/seed-paddle-sandbox-catalog.mjs
exit $LASTEXITCODE
