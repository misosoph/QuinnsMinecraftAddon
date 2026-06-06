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
  $behaviorZipPath = Join-Path $dist "$($addon.PackageName)-bp.zip"
  $behaviorMcpackPath = Join-Path $dist "$($addon.PackageName)-bp.mcpack"
  $resourceZipPath = Join-Path $dist "$($addon.PackageName)-rp.zip"
  $resourceMcpackPath = Join-Path $dist "$($addon.PackageName)-rp.mcpack"

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

  foreach ($packPath in @($behaviorZipPath, $behaviorMcpackPath, $resourceZipPath, $resourceMcpackPath)) {
    if (Test-Path $packPath) {
      Remove-Item -LiteralPath $packPath -Force
    }
  }

  New-Item -ItemType Directory -Force -Path $stagingRoot | Out-Null

  # Standalone packs are published for Bedrock clients that import them more
  # reliably than a combined .mcaddon.
  Compress-Archive -Path (Join-Path $behaviorPackSource "*") -DestinationPath $behaviorZipPath
  Move-Item -LiteralPath $behaviorZipPath -Destination $behaviorMcpackPath

  Compress-Archive -Path (Join-Path $resourcePackSource "*") -DestinationPath $resourceZipPath
  Move-Item -LiteralPath $resourceZipPath -Destination $resourceMcpackPath

  # Keep each pack as a first-level folder in the combined .mcaddon. Its
  # manifest.json is therefore one directory below the archive root.
  $behaviorStagingPath = Join-Path $stagingRoot $behaviorPackName
  $resourceStagingPath = Join-Path $stagingRoot $resourcePackName
  New-Item -ItemType Directory -Force -Path $behaviorStagingPath | Out-Null
  New-Item -ItemType Directory -Force -Path $resourceStagingPath | Out-Null
  Copy-Item -Path (Join-Path $behaviorPackSource "*") -Destination $behaviorStagingPath -Recurse -Force
  Copy-Item -Path (Join-Path $resourcePackSource "*") -Destination $resourceStagingPath -Recurse -Force

  Compress-Archive -Path (Join-Path $stagingRoot "*") -DestinationPath $zipPath
  Move-Item -LiteralPath $zipPath -Destination $mcaddonPath
  Remove-Item -LiteralPath $stagingRoot -Recurse -Force

  Write-Host "Packaged add-on:"
  Write-Host "  $mcaddonPath"
  Write-Host "Standalone behavior pack:"
  Write-Host "  $behaviorMcpackPath"
  Write-Host "Standalone resource pack:"
  Write-Host "  $resourceMcpackPath"
}
