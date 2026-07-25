# Quinn's Minecraft Add-ons

Minecraft Bedrock add-ons for Quinn's worlds.

## Add-ons

### Quinn's Enderstorm

A Minecraft Bedrock add-on built around Quinn's Enderstorm boss fight.
A companion resource pack adds the dark red battle sky during the Enderstorm fight.

- Starts Quinn's Treasure Hunt when a player joins.
- Picks a nearby altar target for each player.
- Flattens the altar into a bedrock battle arena and darkens the sky red when the fight begins.
- Spawns Quinn's Enderstorm when the altar is reached.
- Rewards the winner with an overpowered Iron-Gold Stormbreaker pickaxe.
- Adds test functions you can run with `/function hello`, `/function summon_enderstorm`, and `/function reset_hunt`.

### Quinn's Security Add-On

A starter Minecraft Bedrock add-on scaffold for security features.
It includes a behavior pack, resource pack, custom security devices, and scripts.
Run `/function security_kit` to get the complete test kit, or
`/function security_key` to get only the Huge Security Key:

- Security TV: a 2-block-wide, 3-block-high screen. Connect it by placing a security camera within 10 blocks, then interact with the TV for a 10-second live view through that camera.
- Security Camera: a blocky security camera model that detects moving mobs within 10 blocks, turns toward the closest moving target, and sends nearby alarms when it sees one.
- Security Alarm: required for cameras and laser emitters to trigger alerts.
- Laser Beam Emitter: a giant blocky iron-ingot-shaped emitter with trident-like prongs. It points in the direction the player faced when placing it. When an alarm is within 10 blocks, its forward beam damages mobs for 1 heart every second.
- Locked Security Door: a locked trapdoor-style block with a key shape in the face. It opens only when the player has the Huge Security Key.
- Huge Security Key: an oversized golden key item used to unlock security doors.

### Quinn's Cayman Islands Add-On

A standalone Minecraft Bedrock add-on that starts the player in a Cayman Islands
hotel room with a tamed dog inside the room and builds a large resort island around spawn.
It uses renamed vanilla entities so the pack works without any other mods:

- Custom green lizards everywhere, with a low lizard body, legs, tail, and green spotted texture.
- Chickens around the hotel grounds.
- Five villagers named as front-desk, restaurant, shop, cleaning, and beach-tour workers. They spawn once after the resort is built and are never automatically replaced.
- Many custom sting rays with broad flat bodies, wide fins, and long tails, plus rainbow fish in the shallow water around the island.
- A large hotel with a capacious five-storey atrium lobby, grand staircase, balconies, chandelier, eight-storey glass entrance tower with grand double doors, restaurant, and private spawn room.
- Twenty-four upper-floor guest rooms, each with its own door, exterior window, bed, desk, drawers, chairs, chest, and ceiling light.
- Densely illuminated hallways lead from every guest-room door to lit staircases connecting all five hotel floors, with additional torches throughout the lobby, restaurant, reception, entrance, and private spawn room.
- Peaceful difficulty and disabled natural mob spawning prevent hostile mobs and animals from spawning inside the hotel. Cayman wildlife is kept outdoors.
- A wide, stepped sandy beach with no trees on the sand, plus a dock, enclosed beach stand, shops, villager houses, paths, inland palm trees, and shallow water. Every surrounding building has a solid foundation and a working door.
- Run `/function cayman_start` to rebuild the hotel-room start for the current player.
- Run `/function cayman_reset_area` to clear the Cayman animals/staff and rebuild the start.

### Quinn's Minigun Add-On

A standalone rapid-fire weapon and automatic turret.
Run `/function minigun_kit` to get the Minigun:

- Hold the use button and release for a single arrow shot. The arrow is rendered as a short stick.
- Keep holding it to fire one shot every quarter second.
- Use it on a block to place an automatic turret that targets nearby mobs.
- The handheld icon and turret model use three parallel black barrels pointing in the same direction. The placed turret's barrel cluster spins continuously.

## Files

```text
QuinnsMinecraftAddon
|-- behavior_packs
|   |-- quinns_enderstorm_bp
|   |   |-- manifest.json
|   |   |-- functions
|   |   |   `-- hello.mcfunction
|   |   `-- scripts
|   |       `-- main.js
|   `-- quinns_security_bp
|       |-- manifest.json
|       |-- blocks
|       |-- items
|       `-- functions
|           |-- hello_security.mcfunction
|           `-- security_kit.mcfunction
|   `-- quinns_cayman_bp
|       |-- manifest.json
|       |-- functions
|       |   |-- cayman_reset_area.mcfunction
|       |   `-- cayman_start.mcfunction
|       `-- scripts
|           `-- main.js
|   `-- quinns_minigun_bp
|       |-- manifest.json
|       |-- entities
|       |-- items
|       |-- functions
|       |   `-- minigun_kit.mcfunction
|       `-- scripts
|           `-- main.js
|-- resource_packs
|   |-- quinns_enderstorm_rp
|   |   |-- manifest.json
|   |   `-- fogs
|   |       `-- battle_sky.json
|   `-- quinns_security_rp
|       |-- manifest.json
|       `-- texts
|           `-- en_US.lang
|   `-- quinns_cayman_rp
|       |-- manifest.json
|       `-- texts
|           `-- en_US.lang
|   `-- quinns_minigun_rp
|       |-- manifest.json
|       |-- animations
|       |-- entity
|       |-- models
|       |-- textures
|       `-- texts
|           `-- en_US.lang
|-- scripts
|   |-- build.ps1
|   |-- install.ps1
|   `-- package.ps1
`-- src
    `-- main.ts
```

Minecraft loads JavaScript from `behavior_packs/quinns_enderstorm_bp/scripts/main.js`.
The red battle sky comes from `resource_packs/quinns_enderstorm_rp/fogs/battle_sky.json`.
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

This creates:

- `dist/quinns-enderstorm.mcaddon`
- `dist/quinns-enderstorm-bp.mcpack`
- `dist/quinns-enderstorm-rp.mcpack`
- `dist/quinns-security-addon.mcaddon`
- `dist/quinns-security-addon-bp.mcpack`
- `dist/quinns-security-addon-rp.mcpack`
- `dist/quinns-cayman-islands.mcaddon`
- `dist/quinns-cayman-islands-bp.mcpack`
- `dist/quinns-cayman-islands-rp.mcpack`
- `dist/quinns-minigun.mcaddon`
- `dist/quinns-minigun-bp.mcpack`
- `dist/quinns-minigun-rp.mcpack`

> Note: do not commit packaged binaries to pull requests if your PR workflow
> rejects binary files. This repo ignores `dist/*.mcaddon` and publishes the
> package as a GitHub Actions artifact instead.

### Get the package without running PowerShell (web/iPad)

1. Open the **Actions** tab in GitHub.
2. Run **Package Minecraft Add-on** (or open any recent run on your branch/PR).
3. Download the **quinns-cayman-islands-addon** artifact for the Cayman Islands add-on, or download one of the other add-on artifacts.
4. Extract the downloaded GitHub artifact ZIP.
5. Open the matching `.mcaddon` file from the extracted folder in Minecraft.
6. If the combined file does not install both packs, open
   the matching `-bp.mcpack` and `-rp.mcpack` files separately.

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
4. Activate `Quinn's Enderstorm Resources` under Resource Packs.
5. Activate `Quinn's Enderstorm` under Behavior Packs.
6. Enter the world.
7. You should see Quinn's treasure hunt messages and action bar clues.
8. Reach the altar or run `/function summon_enderstorm` to start the boss.
9. The arena will flatten into bedrock and the sky will turn dark red for the fight.
10. Defeat Quinn's Enderstorm to earn the Stormbreaker pickaxe.
11. Run `/function reset_hunt` to reset the boss, battle sky, and reward tags for another test.

For Quinn's Security Add-On, activate `Quinn's Security Add-On Resources`
under Resource Packs and `Quinn's Security Add-On` under Behavior Packs, then
run `/function security_kit`.

For Quinn's Cayman Islands Add-On, activate `Quinn's Cayman Islands Resources`
under Resource Packs and `Quinn's Cayman Islands Add-On` under Behavior Packs.
When you enter the world, the script moves you into a hotel room, gives you a
tamed dog, builds the Cayman resort area, and keeps the animals and workers
populated near spawn.

For Quinn's Minigun Add-On, activate `Quinn's Minigun Add-On Resources` under
Resource Packs and `Quinn's Minigun Add-On` under Behavior Packs. Run
`/function minigun_kit`, hold the Minigun's use button, and use it on a block to
place the automatic turret.

### Updating Quinn's Security Add-On

The current security pack version is `1.2.0`. Before importing an older build
again, remove both `Quinn's Security Add-On` and
`Quinn's Security Add-On Resources` from Minecraft storage. Minecraft uses the
manifest UUID and version to decide whether an imported pack replaces the
installed copy.

The generated `.mcaddon` contains the behavior and resource pack folders at its
top level. The GitHub artifact also includes standalone behavior and resource
`.mcpack` files for Bedrock clients that do not import both packs from the
combined `.mcaddon`.

If the pack does not load, enable the Content Log in `Settings > Creator`.
