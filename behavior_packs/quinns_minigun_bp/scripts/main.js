import { system, world } from "@minecraft/server";

const MINIGUN_ID = "quinns_minigun:minigun";
const TURRET_ID = "quinns_minigun:minigun_turret";
const PROJECTILE_ID = "minecraft:small_fireball";
const PROJECTILE_SOUND = "mob.blaze.shoot";
const SHOT_INTERVAL_TICKS = 5;
const TURRET_RANGE = 18;
const HANDHELD_SPEED = 2.9;
const TURRET_SPEED = 2.6;
const TURRET_UNCERTAINTY = 1.25;
const DIMENSION_IDS = ["overworld", "nether", "the_end"];

const activeUsers = new Map();
const lastTurretShots = new Map();
const welcomedPlayers = new Set();

function isMinigun(itemStack) {
  return itemStack?.typeId === MINIGUN_ID;
}

function getHeldItem(player) {
  try {
    const inventory = player.getComponent("minecraft:inventory")?.container;
    return inventory?.getItem(player.selectedSlotIndex);
  } catch (error) {
    return undefined;
  }
}

function vectorLength(vector) {
  return Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
}

function normalize(vector) {
  const length = vectorLength(vector);

  if (length === 0) {
    return { x: 0, y: 0, z: 1 };
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

function addVectors(a, b) {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  };
}

function multiplyVector(vector, amount) {
  return {
    x: vector.x * amount,
    y: vector.y * amount,
    z: vector.z * amount,
  };
}

function getHeadLocation(entity) {
  try {
    return entity.getHeadLocation();
  } catch (error) {
    return {
      x: entity.location.x,
      y: entity.location.y + 0.8,
      z: entity.location.z,
    };
  }
}

function fireProjectile(dimension, location, direction, speed, owner, uncertainty) {
  const normalizedDirection = normalize(direction);
  const spawnLocation = addVectors(location, multiplyVector(normalizedDirection, 0.7));

  try {
    const projectile = dimension.spawnEntity(PROJECTILE_ID, spawnLocation);
    const projectileComponent = projectile.getComponent("minecraft:projectile");

    if (projectileComponent) {
      projectileComponent.owner = owner;
      projectileComponent.shoot(multiplyVector(normalizedDirection, speed), { uncertainty });
    } else {
      projectile.applyImpulse(multiplyVector(normalizedDirection, speed));
    }

    return true;
  } catch (error) {
    return false;
  }
}

function fireHandheld(player) {
  const direction = player.getViewDirection();
  const origin = getHeadLocation(player);
  const didFire = fireProjectile(player.dimension, origin, direction, HANDHELD_SPEED, player, 1.6);

  if (!didFire) {
    return false;
  }

  try {
    player.runCommand(`playsound ${PROJECTILE_SOUND} @s`);
  } catch (error) {
    // The projectile still fires if the optional sound is unavailable.
  }

  return true;
}

function finishHandheldUse(player) {
  const state = activeUsers.get(player.id);

  if (!state) {
    return;
  }

  activeUsers.delete(player.id);

  if (state.shotsFired === 0) {
    fireHandheld(player);
  }
}

function beginHandheldUse(player) {
  activeUsers.set(player.id, {
    player,
    nextShotTick: system.currentTick + SHOT_INTERVAL_TICKS,
    shotsFired: 0,
  });
}

function updateHandheldUsers() {
  for (const [playerId, state] of activeUsers) {
    const player = state.player;

    try {
      if (!player.isValid || !isMinigun(getHeldItem(player))) {
        finishHandheldUse(player);
        continue;
      }

      if (system.currentTick < state.nextShotTick) {
        continue;
      }

      if (fireHandheld(player)) {
        state.shotsFired += 1;
      }

      state.nextShotTick += SHOT_INTERVAL_TICKS;
    } catch (error) {
      activeUsers.delete(playerId);
    }
  }
}

function isTurretTarget(entity) {
  if (!entity || entity.typeId === TURRET_ID) {
    return false;
  }

  if ([
    "minecraft:player",
    "minecraft:item",
    "minecraft:xp_orb",
    "minecraft:arrow",
    "minecraft:small_fireball",
    "minecraft:fireball",
    "minecraft:snowball",
  ].includes(entity.typeId)) {
    return false;
  }

  try {
    return Boolean(entity.getComponent("minecraft:health"));
  } catch (error) {
    return false;
  }
}

function findTurretTarget(turret) {
  try {
    const targets = turret.dimension
      .getEntities({ location: turret.location, maxDistance: TURRET_RANGE })
      .filter(isTurretTarget);
    let nearest;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const target of targets) {
      const dx = target.location.x - turret.location.x;
      const dy = target.location.y - turret.location.y;
      const dz = target.location.z - turret.location.z;
      const distance = dx * dx + dy * dy + dz * dz;

      if (distance < nearestDistance) {
        nearest = target;
        nearestDistance = distance;
      }
    }

    return nearest;
  } catch (error) {
    return undefined;
  }
}

function aimTurretAt(turret, targetLocation, origin) {
  const delta = {
    x: targetLocation.x - origin.x,
    y: targetLocation.y - origin.y,
    z: targetLocation.z - origin.z,
  };
  const horizontalDistance = Math.sqrt(delta.x * delta.x + delta.z * delta.z);
  const pitch = -Math.atan2(delta.y, horizontalDistance) * 180 / Math.PI;
  const yaw = Math.atan2(-delta.x, delta.z) * 180 / Math.PI;

  try {
    // The model's barrel cluster is its forward axis. Aim the entity first so
    // its visual barrels and the direction used for the projectile agree.
    turret.setRotation({ x: pitch, y: yaw });
    return turret.getViewDirection();
  } catch (error) {
    return normalize(delta);
  }
}

function fireTurret(turret) {
  const target = findTurretTarget(turret);

  if (!target) {
    return false;
  }

  const origin = {
    x: turret.location.x,
    y: turret.location.y + 0.65,
    z: turret.location.z,
  };
  const direction = aimTurretAt(turret, getHeadLocation(target), origin);
  const didFire = fireProjectile(turret.dimension, origin, direction, TURRET_SPEED, turret, TURRET_UNCERTAINTY);

  if (didFire) {
    try {
      turret.dimension.runCommand(
        `playsound ${PROJECTILE_SOUND} @a ${Math.floor(turret.location.x)} ${Math.floor(turret.location.y)} ${Math.floor(turret.location.z)}`,
      );
    } catch (error) {
      // The automatic turret remains functional if the optional sound fails.
    }
  }

  return didFire;
}

function updateTurrets() {
  const activeTurretIds = new Set();

  for (const dimensionId of DIMENSION_IDS) {
    let turrets;

    try {
      turrets = world.getDimension(dimensionId).getEntities({ type: TURRET_ID });
    } catch (error) {
      continue;
    }

    for (const turret of turrets) {
      activeTurretIds.add(turret.id);
      const lastShot = lastTurretShots.get(turret.id) ?? -SHOT_INTERVAL_TICKS;

      if (system.currentTick - lastShot < SHOT_INTERVAL_TICKS) {
        continue;
      }

      if (fireTurret(turret)) {
        lastTurretShots.set(turret.id, system.currentTick);
      }
    }
  }

  for (const turretId of lastTurretShots.keys()) {
    if (!activeTurretIds.has(turretId)) {
      lastTurretShots.delete(turretId);
    }
  }
}

function subscribeUseEvents() {
  world.afterEvents.itemStartUse?.subscribe((event) => {
    if (isMinigun(event.itemStack)) {
      beginHandheldUse(event.source);
    }
  });

  const release = (event) => {
    if (event.itemStack && !isMinigun(event.itemStack)) {
      return;
    }

    if (activeUsers.has(event.source.id)) {
      finishHandheldUse(event.source);
    }
  };

  world.afterEvents.itemReleaseUse?.subscribe(release);
  world.afterEvents.itemStopUse?.subscribe(release);
  world.afterEvents.playerLeave?.subscribe((event) => {
    activeUsers.delete(event.playerId);
  });
}

function welcomePlayers() {
  for (const player of world.getAllPlayers()) {
    if (welcomedPlayers.has(player.id)) {
      continue;
    }

    welcomedPlayers.add(player.id);
    player.sendMessage("Quinn's Minigun Add-On is loaded. Run /function minigun_kit for a handheld minigun.");
    player.sendMessage("Hold use and release for one shot, or keep holding for a shot every quarter second. Use it on a block to place an automatic turret.");
  }
}

subscribeUseEvents();
system.runInterval(() => {
  welcomePlayers();
  updateHandheldUsers();
  updateTurrets();
}, 1);
