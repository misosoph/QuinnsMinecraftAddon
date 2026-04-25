[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$behaviorPackName = "quinns_enderstorm_bp"
$resourcePackName = "quinns_enderstorm_rp"
$behaviorPackSource = Join-Path $projectRoot "behavior_packs\$behaviorPackName"
$resourcePackSource = Join-Path $projectRoot "resource_packs\$resourcePackName"
$dist = Join-Path $projectRoot "dist"
$stagingRoot = Join-Path $dist "quinns-enderstorm-addon"
$zipPath = Join-Path $dist "quinns-enderstorm.zip"
$mcaddonPath = Join-Path $dist "quinns-enderstorm.mcaddon"

& (Join-Path $PSScriptRoot "build.ps1")

New-Item -ItemType Directory -Force -Path $dist | Out-Null

if (Test-Path $stagingRoot) {
  Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}

if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

if (Test-Path $mcaddonPath) {
  Remove-Item -LiteralPath $mcaddonPath -Force
}

New-Item -ItemType Directory -Force -Path (Join-Path $stagingRoot "behavior_packs\$behaviorPackName") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $stagingRoot "resource_packs\$resourcePackName") | Out-Null
Copy-Item -Path (Join-Path $behaviorPackSource "*") -Destination (Join-Path $stagingRoot "behavior_packs\$behaviorPackName") -Recurse -Force
Copy-Item -Path (Join-Path $resourcePackSource "*") -Destination (Join-Path $stagingRoot "resource_packs\$resourcePackName") -Recurse -Force

Compress-Archive -Path (Join-Path $stagingRoot "*") -DestinationPath $zipPath
Move-Item -LiteralPath $zipPath -Destination $mcaddonPath
Remove-Item -LiteralPath $stagingRoot -Recurse -Force

Write-Host "Packaged add-on:"
Write-Host "  $mcaddonPath"
