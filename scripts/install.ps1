[CmdletBinding()]
param(
  [string]$MinecraftComMojangPath = $env:MINECRAFT_COM_MOJANG_PATH
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$behaviorPackName = "quinns_enderstorm_bp"
$resourcePackName = "quinns_enderstorm_rp"
$behaviorPackSource = Join-Path $projectRoot "behavior_packs\$behaviorPackName"
$resourcePackSource = Join-Path $projectRoot "resource_packs\$resourcePackName"

if (-not (Test-Path (Join-Path $behaviorPackSource "manifest.json"))) {
  throw "Behavior pack manifest not found: $behaviorPackSource"
}

if (-not (Test-Path (Join-Path $resourcePackSource "manifest.json"))) {
  throw "Resource pack manifest not found: $resourcePackSource"
}

& (Join-Path $PSScriptRoot "build.ps1")

if ([string]::IsNullOrWhiteSpace($MinecraftComMojangPath)) {
  $candidates = @(
    (Join-Path $env:APPDATA "Minecraft Bedrock\users\shared\games\com.mojang"),
    (Join-Path $env:APPDATA "Minecraft Bedrock\Users\Shared\games\com.mojang"),
    (Join-Path $env:LOCALAPPDATA "Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang")
  )

  $MinecraftComMojangPath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1

  if ([string]::IsNullOrWhiteSpace($MinecraftComMojangPath)) {
    $MinecraftComMojangPath = $candidates[0]
    Write-Warning "No existing Minecraft Bedrock com.mojang folder was found. Creating the current default path."
  }
}

$developmentPacks = Join-Path $MinecraftComMojangPath "development_behavior_packs"
$developmentResources = Join-Path $MinecraftComMojangPath "development_resource_packs"
$behaviorPackTarget = Join-Path $developmentPacks $behaviorPackName
$resourcePackTarget = Join-Path $developmentResources $resourcePackName

New-Item -ItemType Directory -Force -Path $behaviorPackTarget | Out-Null
New-Item -ItemType Directory -Force -Path $resourcePackTarget | Out-Null
Copy-Item -Path (Join-Path $behaviorPackSource "*") -Destination $behaviorPackTarget -Recurse -Force
Copy-Item -Path (Join-Path $resourcePackSource "*") -Destination $resourcePackTarget -Recurse -Force

Write-Host "Installed behavior pack:"
Write-Host "  $behaviorPackTarget"
Write-Host "Installed resource pack:"
Write-Host "  $resourcePackTarget"
Write-Host ""
Write-Host "Activate 'Quinn''s Enderstorm Resources' under Resource Packs and 'Quinn''s Enderstorm' under Behavior Packs."
