# Codex Script Starter

A tiny Minecraft Bedrock behavior pack that uses the Script API.

## What It Does

- Starts Quinn's Treasure Hunt when a player joins.
- Picks a nearby hidden treasure target for each player.
- Shows action bar clues with distance and direction.
- Gives a reward when the player reaches the hidden spot.
- Adds a fallback command function you can run with `/function hello`.

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
7. Follow the action bar until you find the hidden spot.
8. Run `/function hello` if you want a compass and night vision.

If the pack does not load, enable the Content Log in `Settings > Creator`.
