[CmdletBinding()]
param(
  [string]$MinecraftComMojangPath = $env:MINECRAFT_COM_MOJANG_PATH
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$packName = "quinns_enderstorm_bp"
$packSource = Join-Path $projectRoot "behavior_packs\$packName"

if (-not (Test-Path (Join-Path $packSource "manifest.json"))) {
  throw "Behavior pack manifest not found: $packSource"
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
$packTarget = Join-Path $developmentPacks $packName

New-Item -ItemType Directory -Force -Path $packTarget | Out-Null
Copy-Item -Path (Join-Path $packSource "*") -Destination $packTarget -Recurse -Force

Write-Host "Installed behavior pack:"
Write-Host "  $packTarget"
Write-Host ""
Write-Host "Activate 'Quinn''s Enderstorm' in a Minecraft Bedrock test world's Behavior Packs list."
