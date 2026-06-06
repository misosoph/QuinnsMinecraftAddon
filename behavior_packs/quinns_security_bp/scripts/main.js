import { EntityComponentTypes, system, world } from "@minecraft/server";

const TV_ID = "quinns_security:security_tv";
const TV_BOTTOM_RIGHT_ID = "quinns_security:security_tv_bottom_right";
const TV_MIDDLE_LEFT_ID = "quinns_security:security_tv_middle_left";
const TV_MIDDLE_RIGHT_ID = "quinns_security:security_tv_middle_right";
const TV_TOP_LEFT_ID = "quinns_security:security_tv_top_left";
const TV_TOP_RIGHT_ID = "quinns_security:security_tv_top_right";
const CAMERA_ID = "quinns_security:security_camera";
const ALARM_ID = "quinns_security:security_alarm";
const LASER_ID = "quinns_security:laser_emitter";
const LOCKED_DOOR_ID = "quinns_security:locked_security_door";
const HUGE_KEY_ID = "quinns_security:huge_security_key";

const TV_BLOCK_IDS = new Set([
  TV_ID,
  TV_BOTTOM_RIGHT_ID,
  TV_MIDDLE_LEFT_ID,
  TV_MIDDLE_RIGHT_ID,
  TV_TOP_LEFT_ID,
  TV_TOP_RIGHT_ID,
]);
const DEVICE_IDS = new Set([...TV_BLOCK_IDS, CAMERA_ID, ALARM_ID, LASER_ID, LOCKED_DOOR_ID]);
const CAMERA_LINK_RANGE = 10;
const CAMERA_VIEW_RANGE = 10;
const ALARM_LINK_RANGE = 10;
const LASER_RANGE = 10;
const LASER_DAMAGE = 2;
const DEVICE_SCAN_RADIUS = 16;
const DEVICE_SCAN_HEIGHT = 6;
const TV_FEED_DURATION = 200;

const previousLocations = new Map();
const movingEntityIds = new Set();
const alarmCooldowns = new Map();
const activeTvFeeds = new Map();
const welcomedPlayers = new Set();

const CARDINAL_VECTORS = {
  north: { x: 0, z: -1 },
  south: { x: 0, z: 1 },
  west: { x: -1, z: 0 },
  east: { x: 1, z: 0 },
};

const TV_PANEL_LAYOUT = [
  { right: 1, up: 0, typeId: TV_BOTTOM_RIGHT_ID },
  { right: 0, up: 1, typeId: TV_MIDDLE_LEFT_ID },
  { right: 1, up: 1, typeId: TV_MIDDLE_RIGHT_ID },
  { right: 0, up: 2, typeId: TV_TOP_LEFT_ID },
  { right: 1, up: 2, typeId: TV_TOP_RIGHT_ID },
];

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

function cardinalDirection(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;

  if (Math.abs(dx) > Math.abs(dz)) {
    return dx >= 0 ? "east" : "west";
  }

  return dz >= 0 ? "south" : "north";
}

function getBlockDirection(block) {
  try {
    return block.permutation.getState("minecraft:cardinal_direction") ?? "north";
  } catch (error) {
    return "north";
  }
}

function rightVector(direction) {
  const forward = CARDINAL_VECTORS[direction] ?? CARDINAL_VECTORS.north;
  return { x: -forward.z, z: forward.x };
}

function offsetLocation(location, right, up) {
  return {
    x: location.x + right.x,
    y: location.y + up,
    z: location.z + right.z,
  };
}

function tvPanelLocations(anchorBlock) {
  const right = rightVector(getBlockDirection(anchorBlock));

  return TV_PANEL_LAYOUT.map((panel) => ({
    location: offsetLocation(
      anchorBlock.location,
      { x: right.x * panel.right, z: right.z * panel.right },
      panel.up,
    ),
    typeId: panel.typeId,
  }));
}

function findTvAnchor(block) {
  if (block.typeId === TV_ID) {
    return block;
  }

  for (let x = block.location.x - 1; x <= block.location.x + 1; x++) {
    for (let y = block.location.y - 2; y <= block.location.y; y++) {
      for (let z = block.location.z - 1; z <= block.location.z + 1; z++) {
        const candidate = getBlockSafe(block.dimension, { x, y, z });

        if (!candidate || candidate.typeId !== TV_ID) {
          continue;
        }

        if (tvPanelLocations(candidate).some((panel) =>
          panel.location.x === block.location.x &&
          panel.location.y === block.location.y &&
          panel.location.z === block.location.z &&
          panel.typeId === block.typeId
        )) {
          return candidate;
        }
      }
    }
  }

  return undefined;
}

function buildTvStructure(player, anchorBlock) {
  const panels = tvPanelLocations(anchorBlock);

  for (const panel of panels) {
    const target = getBlockSafe(anchorBlock.dimension, panel.location);

    if (!target || target.typeId !== "minecraft:air") {
      try {
        anchorBlock.dimension.runCommand(
          `setblock ${anchorBlock.location.x} ${anchorBlock.location.y} ${anchorBlock.location.z} air`,
        );
        player.runCommand(`give @s quinns_security:security_tv_item 1`);
      } catch (error) {
        // The placement failure message still tells the player how to recover.
      }

      player.sendMessage("Security TV needs a clear area 2 blocks wide and 3 blocks high.");
      return;
    }
  }

  for (const panel of panels) {
    try {
      anchorBlock.dimension.runCommand(
        `setblock ${panel.location.x} ${panel.location.y} ${panel.location.z} ${panel.typeId}`,
      );
    } catch (error) {
      player.sendMessage("Security TV could not finish building its screen.");
      return;
    }
  }
}

function removeTvStructure(block) {
  const anchor = findTvAnchor(block);
  const center = anchor?.location ?? block.location;

  for (let x = center.x - 1; x <= center.x + 1; x++) {
    for (let y = center.y; y <= center.y + 2; y++) {
      for (let z = center.z - 1; z <= center.z + 1; z++) {
        const candidate = getBlockSafe(block.dimension, { x, y, z });

        if (!candidate || !TV_BLOCK_IDS.has(candidate.typeId)) {
          continue;
        }

        try {
          block.dimension.runCommand(`setblock ${x} ${y} ${z} air`);
        } catch (error) {
          // Best-effort cleanup for a partially broken TV.
        }
      }
    }
  }
}

function turnBlockToward(block, location) {
  const direction = cardinalDirection(blockCenter(block), location);

  try {
    const currentDirection = getBlockDirection(block);

    if (currentDirection !== direction) {
      block.setPermutation(block.permutation.withState("minecraft:cardinal_direction", direction));
    }
  } catch (error) {
    console.warn(`Could not turn security block toward ${direction}.`);
  }
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

  return getEntitiesNear(cameraBlock.dimension, center, CAMERA_VIEW_RANGE)
    .filter((entity) => movingEntityIds.has(entity.id))
    .sort((a, b) => distanceSquared(a.location, center) - distanceSquared(b.location, center));
}

function updateCameras(blocks) {
  const cameras = findBlocks(blocks, CAMERA_ID);

  for (const camera of cameras) {
    const alarm = findNearestBlock(blocks, ALARM_ID, blockCenter(camera), ALARM_LINK_RANGE);
    const target = getCameraTargets(camera)[0];

    if (target) {
      turnBlockToward(camera, target.location);

      if (alarm) {
        triggerAlarm(alarm, camera, target);
      }
    }
  }
}

function isEntityInLaserPath(entity, laserBlock) {
  const laser = blockCenter(laserBlock);
  const direction = CARDINAL_VECTORS[getBlockDirection(laserBlock)] ?? CARDINAL_VECTORS.north;
  const dx = entity.location.x - laser.x;
  const dz = entity.location.z - laser.z;
  const dy = Math.abs(entity.location.y - laser.y);

  if (dy > 2.25) {
    return false;
  }

  const forwardDistance = dx * direction.x + dz * direction.z;
  const sidewaysDistance = Math.abs(dx * direction.z - dz * direction.x);

  return forwardDistance >= 0 && forwardDistance <= LASER_RANGE && sidewaysDistance <= 0.75;
}

function drawLaser(laserBlock) {
  const location = blockCenter(laserBlock);
  const direction = CARDINAL_VECTORS[getBlockDirection(laserBlock)] ?? CARDINAL_VECTORS.north;

  for (let distance = 1; distance <= LASER_RANGE; distance++) {
    const x = location.x + direction.x * distance;
    const z = location.z + direction.z * distance;

    try {
      laserBlock.dimension.runCommand(`particle minecraft:redstone_wire_dust_particle ${x} ${location.y} ${z}`);
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

function setPlayerCameraFeed(player, cameraBlock, target) {
  const direction = CARDINAL_VECTORS[getBlockDirection(cameraBlock)] ?? CARDINAL_VECTORS.north;
  const location = blockCenter(cameraBlock);
  const cameraLocation = {
    x: location.x + direction.x * 0.65,
    y: location.y + 0.35,
    z: location.z + direction.z * 0.65,
  };
  const facingLocation = target?.location ?? {
    x: cameraLocation.x + direction.x * CAMERA_VIEW_RANGE,
    y: cameraLocation.y,
    z: cameraLocation.z + direction.z * CAMERA_VIEW_RANGE,
  };

  try {
    player.camera.setCamera("minecraft:free", {
      location: cameraLocation,
      facingLocation,
    });
  } catch (error) {
    player.sendMessage("Security TV: this Minecraft version could not open the live camera feed.");
    activeTvFeeds.delete(player.id);
  }
}

function stopTvFeed(player, message) {
  activeTvFeeds.delete(player.id);

  try {
    player.camera.clear();
  } catch (error) {
    // The player may have disconnected or changed dimensions.
  }

  if (message) {
    player.sendMessage(message);
  }
}

function showTvFeed(player, tvBlock, nearbyBlocks) {
  if (activeTvFeeds.has(player.id)) {
    stopTvFeed(player, "Security TV: camera feed closed.");
    return;
  }

  const anchor = findTvAnchor(tvBlock);

  if (!anchor) {
    player.sendMessage("Security TV: this screen is missing its base section.");
    return;
  }

  const tvCenter = blockCenter(anchor);
  const camera = findNearestBlock(nearbyBlocks, CAMERA_ID, tvCenter, CAMERA_LINK_RANGE);

  if (!camera) {
    player.sendMessage("Security TV: no camera is connected. Place a security camera within 10 blocks of the TV.");
    return;
  }

  const target = getCameraTargets(camera)[0];
  activeTvFeeds.set(player.id, {
    cameraLocation: { ...camera.location },
    dimensionId: camera.dimension.id,
    expiresAt: system.currentTick + TV_FEED_DURATION,
  });
  setPlayerCameraFeed(player, camera, target);

  if (target) {
    const targetName = target.typeId.replace("minecraft:", "");
    player.sendMessage(`Security TV: live feed sees ${targetName} at ${describeDirection(blockCenter(camera), target.location)}. Use the TV again to close.`);
  } else {
    player.sendMessage("Security TV: live feed is clear. Use the TV again to close.");
  }
}

function updateTvFeeds() {
  for (const player of world.getAllPlayers()) {
    const feed = activeTvFeeds.get(player.id);

    if (!feed) {
      continue;
    }

    if (system.currentTick >= feed.expiresAt || player.dimension.id !== feed.dimensionId) {
      stopTvFeed(player, "Security TV: camera feed ended.");
      continue;
    }

    const camera = getBlockSafe(player.dimension, feed.cameraLocation);

    if (!camera || camera.typeId !== CAMERA_ID) {
      stopTvFeed(player, "Security TV: connected camera is no longer available.");
      continue;
    }

    setPlayerCameraFeed(player, camera, getCameraTargets(camera)[0]);
  }
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

  if (TV_BLOCK_IDS.has(block.typeId)) {
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

    system.run(() => handleBlockInteraction(player, block));
  };

  world.afterEvents.playerInteractWithBlock?.subscribe(interactionHandler);
  world.beforeEvents.playerInteractWithBlock?.subscribe((event) => {
    if (event.block?.typeId === LOCKED_DOOR_ID) {
      event.cancel = true;
      system.run(() => handleBlockInteraction(event.player, event.block));
    }
  });

  world.afterEvents.playerPlaceBlock?.subscribe((event) => {
    if (event.block?.typeId === TV_ID && event.player) {
      system.run(() => buildTvStructure(event.player, event.block));
    }
  });

  world.afterEvents.playerBreakBlock?.subscribe((event) => {
    const brokenTypeId = event.brokenBlockPermutation?.type?.id;

    if (brokenTypeId && TV_BLOCK_IDS.has(brokenTypeId)) {
      system.run(() => removeTvStructure(event.block));
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
  const trackedEntities = new Map();

  for (const player of world.getAllPlayers()) {
    for (const block of getSecurityBlocksNear(player, DEVICE_SCAN_RADIUS)) {
      blocks.set(blockKey(block), block);
    }
  }

  const securityBlocks = [...blocks.values()];

  for (const camera of findBlocks(securityBlocks, CAMERA_ID)) {
    for (const entity of getEntitiesNear(camera.dimension, blockCenter(camera), CAMERA_VIEW_RANGE)) {
      trackedEntities.set(entity.id, entity);
    }
  }

  movingEntityIds.clear();

  for (const entity of trackedEntities.values()) {
    if (entityMoved(entity)) {
      movingEntityIds.add(entity.id);
    }
  }

  updateCameras(securityBlocks);
  updateLasers(securityBlocks);
  updateTvFeeds();
}

subscribeInteractionEvents();
system.runInterval(updateSecuritySystem, 20);
