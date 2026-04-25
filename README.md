# Codex Script Starter

A tiny Minecraft Bedrock behavior pack that uses the Script API.

## What It Does

- Starts Quinn's Treasure Hunt when a player joins.
- Picks a nearby altar target for each player.
- Spawns Quinn's Enderstorm when the altar is reached.
- Rewards the winner with an overpowered Iron-Gold Stormbreaker pickaxe.
- Adds test functions you can run with `/function hello`, `/function summon_enderstorm`, and `/function reset_hunt`.

## Files

```text
codex-script-starter
├─ behavior_packs
│  └─ codex_script_starter_bp
│     ├─ manifest.json
│     ├─ functions
│     │  └─ hello.mcfunction
│     └─ scripts
│        └─ main.js
├─ scripts
│  ├─ build.ps1
│  ├─ install.ps1
│  └─ package.ps1
└─ src
   └─ main.ts
```

Minecraft loads JavaScript from `behavior_packs/codex_script_starter_bp/scripts/main.js`.
The source file in `src/main.ts` is intentionally written as TypeScript-flavored
JavaScript so the beginner build step can copy it directly without installing npm
packages. Later, this project can be upgraded to a full TypeScript compiler setup.

## Build

```powershell
.\scripts\build.ps1
```

## Pack For Sharing (Web/iPad Friendly)

```powershell
.\scripts\package.ps1
```

This creates `dist/codex-script-starter.mcpack`.

> Note: do not commit `*.mcpack` binaries to pull requests if your PR workflow
> rejects binary files. This repo ignores `dist/*.mcpack` and publishes the
> package as a GitHub Actions artifact instead.

### Get the package without running PowerShell (web/iPad)

1. Open the **Actions** tab in GitHub.
2. Run **Package Minecraft Add-on** (or open any recent run on your branch/PR).
3. Download the **codex-script-starter-mcpack** artifact.
4. Save it to Files on iPad and open it in Minecraft.

## Install For Local Testing

```powershell
.\scripts\install.ps1
```

The installer looks for the usual Minecraft Bedrock Windows folders. If Minecraft
uses a custom location, pass it explicitly:

```powershell
.\scripts\install.ps1 -MinecraftComMojangPath "C:\Path\To\com.mojang"
```

## Test In Minecraft

1. Open Minecraft Bedrock.
2. Create or edit a test world.
3. Enable cheats for the world.
4. Activate `Codex Script Starter` under Behavior Packs.
5. Enter the world.
6. You should see Quinn's treasure hunt messages and action bar clues.
7. Reach the altar or run `/function summon_enderstorm` to start the boss.
8. Defeat Quinn's Enderstorm to earn the Stormbreaker pickaxe.
9. Run `/function reset_hunt` to reset the boss and reward tags for another test.

If the pack does not load, enable the Content Log in `Settings > Creator`.
