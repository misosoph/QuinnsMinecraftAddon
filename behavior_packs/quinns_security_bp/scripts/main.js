import { EntityComponentTypes, system, world } from "@minecraft/server";

const TV_ID = "quinns_security:security_tv";
const CAMERA_ID = "quinns_security:security_camera";
const ALARM_ID = "quinns_security:security_alarm";
const LASER_ID = "quinns_security:laser_emitter";
const LOCKED_DOOR_ID = "quinns_security:locked_security_door";
const HUGE_KEY_ID = "quinns_security:huge_security_key";

const DEVICE_IDS = new Set([TV_ID, CAMERA_ID, ALARM_ID, LASER_ID, LOCKED_DOOR_ID]);
const CAMERA_LINK_RANGE = 2;
const CAMERA_VIEW_RANGE = 10;
const ALARM_LINK_RANGE = 10;
const LASER_RANGE = 10;
const LASER_DAMAGE = 2;
const DEVICE_SCAN_RADIUS = 16;
const DEVICE_SCAN_HEIGHT = 6;

const previousLocations = new Map();
const alarmCooldowns = new Map();
const welcomedPlayers = new Set();

function blockCenter(block) {
  return {
    x: block.location.x + 0.5,
    y: block.location.y + 0.5,
    z: block.location.z + 0.5,
  };
}

function blockKey(block) {
  return `${block.dimension.id}:${block.location.x},${block.location.y},${block.location.z}`;
}

function locationKey(dimension, location) {
  return `${dimension.id}:${location.x},${location.y},${location.z}`;
}

function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function isSecurityTarget(entity) {
  if (entity.typeId === "minecraft:item" || entity.typeId === "minecraft:xp_orb") {
    return false;
  }

  try {
    return Boolean(entity.getComponent(EntityComponentTypes.Health));
  } catch (error) {
    return false;
  }
}

function entityMoved(entity) {
  const previous = previousLocations.get(entity.id);
  previousLocations.set(entity.id, {
    x: entity.location.x,
    y: entity.location.y,
    z: entity.location.z,
  });

  if (!previous) {
    return false;
  }

  return distanceSquared(previous, entity.location) > 0.04;
}

function getEntitiesNear(dimension, location, range) {
  try {
    return dimension.getEntities({ location, maxDistance: range }).filter(isSecurityTarget);
  } catch (error) {
    return [];
  }
}

function getBlockSafe(dimension, location) {
  try {
    return dimension.getBlock(location);
  } catch (error) {
    return undefined;
  }
}

function getSecurityBlocksNear(player, radius) {
  const found = new Map();
  const origin = {
    x: Math.floor(player.location.x),
    y: Math.floor(player.location.y),
    z: Math.floor(player.location.z),
  };

  for (let x = origin.x - radius; x <= origin.x + radius; x++) {
    for (let y = Math.max(-64, origin.y - DEVICE_SCAN_HEIGHT); y <= Math.min(320, origin.y + DEVICE_SCAN_HEIGHT); y++) {
      for (let z = origin.z - radius; z <= origin.z + radius; z++) {
        const block = getBlockSafe(player.dimension, { x, y, z });

        if (!block || !DEVICE_IDS.has(block.typeId)) {
          continue;
        }

        found.set(blockKey(block), block);
      }
    }
  }

  return [...found.values()];
}

function findBlocks(blocks, typeId) {
  return blocks.filter((block) => block.typeId === typeId);
}

function findNearestBlock(blocks, typeId, location, range) {
  const maxDistance = range * range;
  let nearest;
  let nearestDistance = Infinity;

  for (const block of blocks) {
    if (block.typeId !== typeId) {
      continue;
    }

    const distance = distanceSquared(blockCenter(block), location);

    if (distance <= maxDistance && distance < nearestDistance) {
      nearest = block;
      nearestDistance = distance;
    }
  }

  return nearest;
}

function notifyPlayersNear(dimension, location, message) {
  for (const player of world.getAllPlayers()) {
    if (player.dimension.id !== dimension.id || distanceSquared(player.location, location) > 24 * 24) {
      continue;
    }

    player.onScreenDisplay.setActionBar(message);
    player.sendMessage(message);

    try {
      player.runCommand("playsound random.anvil_land @s");
    } catch (error) {
      // Sound is a bonus; the alarm text still works if a platform rejects this sound id.
    }
  }
}

function triggerAlarm(alarmBlock, sourceBlock, target) {
  const key = locationKey(alarmBlock.dimension, alarmBlock.location);
  const now = system.currentTick;

  if ((alarmCooldowns.get(key) ?? 0) > now) {
    return;
  }

  alarmCooldowns.set(key, now + 60);

  const sourceName = sourceBlock.typeId === CAMERA_ID ? "Security camera" : "Laser";
  const targetName = target.typeId.replace("minecraft:", "");
  notifyPlayersNear(alarmBlock.dimension, blockCenter(alarmBlock), `${sourceName} alarm: ${targetName} detected.`);
}

function getCameraTargets(cameraBlock) {
  const center = blockCenter(cameraBlock);

  return getEntitiesNear(cameraBlock.dimension, center, CAMERA_VIEW_RANGE).filter((entity) => {
    if (entity.typeId === "minecraft:player") {
      return entityMoved(entity);
    }

    return true;
  });
}

function updateCameras(blocks) {
  const cameras = findBlocks(blocks, CAMERA_ID);

  for (const camera of cameras) {
    const alarm = findNearestBlock(blocks, ALARM_ID, blockCenter(camera), ALARM_LINK_RANGE);

    if (!alarm) {
      continue;
    }

    const target = getCameraTargets(camera)[0];

    if (target) {
      triggerAlarm(alarm, camera, target);
    }
  }
}

function isEntityInLaserPath(entity, laserBlock) {
  const laser = blockCenter(laserBlock);
  const dx = entity.location.x - laser.x;
  const dz = entity.location.z - laser.z;
  const dy = Math.abs(entity.location.y - laser.y);

  if (dy > 2.25) {
    return false;
  }

  const alongX = Math.abs(dz) <= 0.75 && Math.abs(dx) <= LASER_RANGE;
  const alongZ = Math.abs(dx) <= 0.75 && Math.abs(dz) <= LASER_RANGE;

  return alongX || alongZ;
}

function drawLaser(laserBlock) {
  const location = blockCenter(laserBlock);
  const commands = [
    `particle minecraft:redstone_wire_dust_particle ${location.x + 3} ${location.y} ${location.z}`,
    `particle minecraft:redstone_wire_dust_particle ${location.x - 3} ${location.y} ${location.z}`,
    `particle minecraft:redstone_wire_dust_particle ${location.x} ${location.y} ${location.z + 3}`,
    `particle minecraft:redstone_wire_dust_particle ${location.x} ${location.y} ${location.z - 3}`,
  ];

  for (const command of commands) {
    try {
      laserBlock.dimension.runCommand(command);
    } catch (error) {
      // Particles are visual-only.
    }
  }
}

function updateLasers(blocks) {
  const lasers = findBlocks(blocks, LASER_ID);

  for (const laser of lasers) {
    const alarm = findNearestBlock(blocks, ALARM_ID, blockCenter(laser), ALARM_LINK_RANGE);

    if (!alarm) {
      continue;
    }

    drawLaser(laser);

    for (const entity of getEntitiesNear(laser.dimension, blockCenter(laser), LASER_RANGE)) {
      if (!isEntityInLaserPath(entity, laser)) {
        continue;
      }

      try {
        entity.applyDamage(LASER_DAMAGE);
        triggerAlarm(alarm, laser, entity);
      } catch (error) {
        // Some entities cannot be damaged by scripts.
      }
    }
  }
}

function describeDirection(from, to) {
  const dx = Math.round(to.x - from.x);
  const dy = Math.round(to.y - from.y);
  const dz = Math.round(to.z - from.z);
  return `X ${dx}, Y ${dy}, Z ${dz}`;
}

function showTvFeed(player, tvBlock, nearbyBlocks) {
  const tvCenter = blockCenter(tvBlock);
  const camera = findNearestBlock(nearbyBlocks, CAMERA_ID, tvCenter, CAMERA_LINK_RANGE);

  if (!camera) {
    player.sendMessage("Security TV: no camera is connected. Place a security camera within 2 blocks of the TV.");
    return;
  }

  const targets = getCameraTargets(camera);

  if (targets.length === 0) {
    player.sendMessage("Security TV: connected camera is clear for 10 blocks.");
    return;
  }

  const nearest = targets.sort((a, b) => distanceSquared(a.location, blockCenter(camera)) - distanceSquared(b.location, blockCenter(camera)))[0];
  const targetName = nearest.typeId.replace("minecraft:", "");
  player.sendMessage(`Security TV: camera sees ${targets.length} target(s). Nearest: ${targetName} at ${describeDirection(blockCenter(camera), nearest.location)}.`);
}

function playerHasHugeKey(player) {
  const inventory = player.getComponent("minecraft:inventory")?.container;

  if (!inventory) {
    return false;
  }

  for (let slot = 0; slot < inventory.size; slot++) {
    const item = inventory.getItem(slot);

    if (item?.typeId === HUGE_KEY_ID) {
      return true;
    }
  }

  return false;
}

function openLockedDoor(player, block) {
  if (!playerHasHugeKey(player)) {
    player.sendMessage("Locked security door: you need the Huge Security Key.");
    return;
  }

  try {
    block.dimension.runCommand(`setblock ${block.location.x} ${block.location.y} ${block.location.z} air`);
    player.runCommand("playsound random.door_open @s");
    player.sendMessage("The Huge Security Key unlocks the door.");
  } catch (error) {
    player.sendMessage("The lock clicks, but the door did not open.");
  }
}

function handleBlockInteraction(player, block) {
  if (!block) {
    return;
  }

  const nearbyBlocks = getSecurityBlocksNear(player, DEVICE_SCAN_RADIUS);

  if (block.typeId === TV_ID) {
    showTvFeed(player, block, nearbyBlocks);
    return;
  }

  if (block.typeId === LOCKED_DOOR_ID) {
    openLockedDoor(player, block);
  }
}

function subscribeInteractionEvents() {
  const interactionHandler = (event) => {
    const player = event.player;
    const block = event.block;

    if (!player || !block) {
      return;
    }

    handleBlockInteraction(player, block);
  };

  world.afterEvents.playerInteractWithBlock?.subscribe(interactionHandler);
  world.beforeEvents.playerInteractWithBlock?.subscribe((event) => {
    if (event.block?.typeId === LOCKED_DOOR_ID) {
      event.cancel = true;
      system.run(() => handleBlockInteraction(event.player, event.block));
    }
  });
}

function welcomePlayers() {
  for (const player of world.getAllPlayers()) {
    if (welcomedPlayers.has(player.id)) {
      continue;
    }

    welcomedPlayers.add(player.id);
    player.sendMessage("Quinn's Security Add-On is loaded. Run /function security_kit for cameras, alarms, lasers, a TV, locked doors, and the Huge Security Key.");
  }
}

function updateSecuritySystem() {
  welcomePlayers();

  const blocks = new Map();

  for (const player of world.getAllPlayers()) {
    for (const block of getSecurityBlocksNear(player, DEVICE_SCAN_RADIUS)) {
      blocks.set(blockKey(block), block);
    }
  }

  const securityBlocks = [...blocks.values()];
  updateCameras(securityBlocks);
  updateLasers(securityBlocks);
}

subscribeInteractionEvents();
system.runInterval(updateSecuritySystem, 20);
