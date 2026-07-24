# Push Production env vars to Vercel via CLI (non-interactive).
# Prerequisite: logged into the team that owns project "sabbath-cue" (bongandlovus-projects).
#
#   npx vercel logout
#   npx vercel login
#   npx vercel link          # pick bongandlovus-projects → sabbath-cue
#   powershell -File web/scripts/set-vercel-production-env.ps1
#
# Edit vercel.production.env first (replace REPLACE_WITH_YOUR_live_TOKEN).

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$envFile = Join-Path $repoRoot "vercel.production.env"

if (-not (Test-Path $envFile)) {
  Write-Error "Missing $envFile - copy vercel.production.import.env to vercel.production.env and edit your live_ token."
}

function Add-VercelEnv($Name, $Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) {
    Write-Host "Skip $Name (empty)"
    return
  }
  Write-Host "Setting $Name ..."
  npx vercel env add $Name production --value $Value --yes --force 2>&1 | Out-Host
}

Get-Content $envFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#")) { return }
  $eq = $line.IndexOf("=")
  if ($eq -lt 1) { return }
  $name = $line.Substring(0, $eq).Trim()
  $value = $line.Substring($eq + 1).Trim()
  if ($value.StartsWith('"') -and $value.EndsWith('"')) {
    $value = $value.Substring(1, $value.Length - 2)
  }
  if ($value -eq "REPLACE_WITH_YOUR_live_TOKEN") {
    Write-Error "Replace REPLACE_WITH_YOUR_live_TOKEN in vercel.production.env before running."
  }
  Add-VercelEnv $name $value
}

Write-Host ""
Write-Host "Done. Redeploy: npx vercel --prod"
