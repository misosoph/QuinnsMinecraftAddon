[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$source = Join-Path $projectRoot "src\main.ts"
$target = Join-Path $projectRoot "behavior_packs\quinns_enderstorm_bp\scripts\main.js"

if (-not (Test-Path $source)) {
  throw "Source file not found: $source"
}

New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
Copy-Item -LiteralPath $source -Destination $target -Force

Write-Host "Built script:"
Write-Host "  $target"
