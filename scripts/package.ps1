[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$dist = Join-Path $projectRoot "dist"
$addons = @(
  @{
    PackageName = "quinns-enderstorm"
    StagingName = "quinns-enderstorm-addon"
    BehaviorPackName = "quinns_enderstorm_bp"
    ResourcePackName = "quinns_enderstorm_rp"
  },
  @{
    PackageName = "quinns-security-addon"
    StagingName = "quinns-security-addon"
    BehaviorPackName = "quinns_security_bp"
    ResourcePackName = "quinns_security_rp"
  }
)

& (Join-Path $PSScriptRoot "build.ps1")

New-Item -ItemType Directory -Force -Path $dist | Out-Null

foreach ($addon in $addons) {
  $behaviorPackName = $addon.BehaviorPackName
  $resourcePackName = $addon.ResourcePackName
  $behaviorPackSource = Join-Path $projectRoot "behavior_packs\$behaviorPackName"
  $resourcePackSource = Join-Path $projectRoot "resource_packs\$resourcePackName"
  $stagingRoot = Join-Path $dist $addon.StagingName
  $zipPath = Join-Path $dist "$($addon.PackageName).zip"
  $mcaddonPath = Join-Path $dist "$($addon.PackageName).mcaddon"

  if (-not (Test-Path (Join-Path $behaviorPackSource "manifest.json"))) {
    throw "Behavior pack manifest not found: $behaviorPackSource"
  }

  if (-not (Test-Path (Join-Path $resourcePackSource "manifest.json"))) {
    throw "Resource pack manifest not found: $resourcePackSource"
  }

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
}
