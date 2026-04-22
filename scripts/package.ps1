[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$packName = "codex_script_starter_bp"
$packSource = Join-Path $projectRoot "behavior_packs\$packName"
$dist = Join-Path $projectRoot "dist"
$zipPath = Join-Path $dist "codex-script-starter.zip"
$mcpackPath = Join-Path $dist "codex-script-starter.mcpack"

& (Join-Path $PSScriptRoot "build.ps1")

New-Item -ItemType Directory -Force -Path $dist | Out-Null

if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

if (Test-Path $mcpackPath) {
  Remove-Item -LiteralPath $mcpackPath -Force
}

Compress-Archive -Path (Join-Path $packSource "*") -DestinationPath $zipPath
Move-Item -LiteralPath $zipPath -Destination $mcpackPath

Write-Host "Packaged add-on:"
Write-Host "  $mcpackPath"
