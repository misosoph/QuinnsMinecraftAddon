import {
  EnchantmentType,
  EntityComponentTypes,
  EquipmentSlot,
  ItemComponentTypes,
  ItemStack,
  system,
  world,
} from "@minecraft/server";

const seenPlayers = new Set();
const activeHunts = new Map();
const stormBattleState = new Map();
const TREASURE_RADIUS = 5;
const ARENA_RADIUS = 36;
const ARENA_CLEAR_HEIGHT = 44;
const STORM_SUPPORT_RADIUS = 140;
const STORM_MINION_RADIUS = 96;
const ENDERMITE_SUMMON_INTERVAL = 120;
const HELPER_VOLLEY_INTERVAL = 40;
const PHASE_ONE_TENTACLE_STRIKE_INTERVAL = 80;
const PHASE_TWO_TENTACLE_STRIKE_INTERVAL = 45;
const PHASE_TWO_LIGHTNING_INTERVAL = 30;
const MAX_ENDERMITES = 16;
const PHASE_ONE_VIRTUAL_HEALTH = 7000;
const PHASE_TWO_VIRTUAL_HEALTH = 12000;
const TARGET_RAID_SIZE = 5;
const ENDERESTORM_BOSS_ID = "quinns_enderstorm:boss";
const FORCE_ENDERSTORM_TAG = "quinn_force_enderstorm";
const ENDERESTORM_ENTITY_TAG = "quinn_enderstorm";
const ENDERESTORM_SUMMONED_TAG = "quinn_enderstorm_summoned";
const ENDERESTORM_DEFEATED_TAG = "quinn_enderstorm_defeated";
const ENDERESTORM_MINION_TAG = "quinn_enderstorm_minion";
const ENDERESTORM_HELPER_TAG = "quinn_enderstorm_helper";
const ENDERESTORM_ARCHER_TAG = "quinn_enderstorm_archer";
const PREP_LOADOUT_TAG = "quinn_prep_loadout";
const PICKAXE_REWARD_TAG = "quinn_pickaxe_rewarded";
const BATTLE_FOG_ID = "quinns_enderstorm:battle_sky";
const BATTLE_FOG_STACK_ID = "quinns_enderstorm_battle";

function hasTag(entity, tag) {
  return entity.getTags().includes(tag);
}

function announcePlayer(player) {
  if (seenPlayers.has(player.id)) {
    return;
  }

  seenPlayers.add(player.id);
  player.sendMessage("Quinn's Enderstorm raid has changed.");
  player.sendMessage("Find the altar, claim the raid gear, and survive a five-player purple storm battle.");
  player.sendMessage("Quick test: /function summon_enderstorm");
}

function hashText(value) {
  let hash = 0;

  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }

  return hash;
}

function createTreasureTarget(player) {
  const location = player.location;
  const hash = hashText(player.id);
  const angle = (hash % 360) * (Math.PI / 180);
  const distance = 45 + (hash % 36);

  return {
    x: Math.floor(location.x + Math.cos(angle) * distance),
    y: Math.floor(location.y),
    z: Math.floor(location.z + Math.sin(angle) * distance),
  };
}

function getTreasureTarget(player) {
  if (!activeHunts.has(player.id)) {
    const target = createTreasureTarget(player);
    activeHunts.set(player.id, target);
    player.sendMessage(`Quinn marked the storm altar near X ${target.x}, Z ${target.z}.`);
  }

  return activeHunts.get(player.id);
}

function horizontalDistance(from, to) {
  const dx = from.x - to.x;
  const dz = from.z - to.z;

  return Math.sqrt(dx * dx + dz * dz);
}

function directionHint(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;

  if (Math.abs(dx) > Math.abs(dz)) {
    return dx > 0 ? "east" : "west";
  }

  return dz > 0 ? "south" : "north";
}

function runPlayerCommand(player, command) {
  try {
    player.runCommand(command);
  } catch (error) {
    console.warn(`Quinn command failed: ${command}`);
  }
}

function toBlockLocation(location) {
  return {
    x: Math.floor(location.x),
    y: Math.floor(location.y),
    z: Math.floor(location.z),
  };
}

function getNearbyPlayers(location, radius, dimension) {
  const nearbyPlayers = [];

  for (const player of world.getAllPlayers()) {
    if (player.dimension.id !== dimension.id) {
      continue;
    }

    if (horizontalDistance(player.location, location) <= radius) {
      nearbyPlayers.push(player);
    }
  }

  return nearbyPlayers;
}

function getRaidPlayers(location, radius, dimension) {
  return getNearbyPlayers(location, radius, dimension).filter((player) => !hasTag(player, ENDERESTORM_DEFEATED_TAG));
}

function getInventoryContainer(player) {
  const inventory = player.getComponent("minecraft:inventory");
  return inventory?.container;
}

function getEquippable(player) {
  return player.getComponent("minecraft:equippable");
}

function giveItemToPlayer(player, item) {
  const container = getInventoryContainer(player);

  if (container) {
    const leftover = container.addItem(item);

    if (leftover) {
      player.dimension.spawnItem(leftover, player.location);
    }

    return;
  }

  const leftover = player.addItem(item);

  if (leftover) {
    player.dimension.spawnItem(leftover, player.location);
  }
}

function placeHotbarItem(player, slot, item) {
  const container = getInventoryContainer(player);

  if (!container) {
    giveItemToPlayer(player, item);
    return;
  }

  const existing = container.getItem(slot);

  if (existing) {
    const leftover = container.addItem(existing);

    if (leftover) {
      player.dimension.spawnItem(leftover, player.location);
    }
  }

  container.setItem(slot, item);
}

function equipArmorItem(player, slot, item) {
  const equippable = getEquippable(player);

  if (!equippable) {
    giveItemToPlayer(player, item);
    return;
  }

  const existing = equippable.getEquipment(slot);

  if (existing) {
    giveItemToPlayer(player, existing);
  }

  equippable.setEquipment(slot, item);
}

function applyBattleSky(player) {
  runPlayerCommand(player, `fog @s remove ${BATTLE_FOG_STACK_ID}`);
  runPlayerCommand(player, `fog @s push ${BATTLE_FOG_ID} ${BATTLE_FOG_STACK_ID}`);
}

function clearBattleSky(player) {
  runPlayerCommand(player, `fog @s remove ${BATTLE_FOG_STACK_ID}`);
}

function setBattleSkyForNearbyPlayers(location, dimension) {
  for (const player of getNearbyPlayers(location, 128, dimension)) {
    applyBattleSky(player);
  }
}

function clearBattleSkyForNearbyPlayers(location, dimension) {
  for (const player of getNearbyPlayers(location, 160, dimension)) {
    clearBattleSky(player);
  }
}

function earthquakeFlattenArena(player, center) {
  const blockCenter = toBlockLocation(center);
  const minX = blockCenter.x - ARENA_RADIUS;
  const maxX = blockCenter.x + ARENA_RADIUS;
  const minZ = blockCenter.z - ARENA_RADIUS;
  const maxZ = blockCenter.z + ARENA_RADIUS;
  const stoneFloorY = blockCenter.y - 8;
  const dirtFloorY = blockCenter.y - 3;
  const surfaceY = blockCenter.y - 1;
  const clearTopY = blockCenter.y + ARENA_CLEAR_HEIGHT;

  runPlayerCommand(
    player,
    "playsound random.explode @a[r=96]",
  );
  runPlayerCommand(
    player,
    "playsound ambient.weather.thunder @a[r=96]",
  );
  runPlayerCommand(
    player,
    `fill ${minX} ${surfaceY + 1} ${minZ} ${maxX} ${clearTopY} ${maxZ} air replace`,
  );
  runPlayerCommand(
    player,
    `fill ${minX} ${stoneFloorY} ${minZ} ${maxX} ${dirtFloorY - 1} ${maxZ} stone replace air`,
  );
  runPlayerCommand(
    player,
    `fill ${minX} ${dirtFloorY} ${minZ} ${maxX} ${surfaceY - 1} ${maxZ} dirt replace air`,
  );
  runPlayerCommand(
    player,
    `fill ${minX} ${surfaceY} ${minZ} ${maxX} ${surfaceY} ${maxZ} grass_block replace`,
  );
}

function getStorms(dimension) {
  return dimension.getEntities({ tags: [ENDERESTORM_ENTITY_TAG] });
}

function getNearestStorm(player) {
  let nearestStorm;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const storm of getStorms(player.dimension)) {
    const distance = horizontalDistance(player.location, storm.location);

    if (distance < nearestDistance) {
      nearestStorm = storm;
      nearestDistance = distance;
    }
  }

  return nearestStorm;
}

function getTaggedEntitiesNear(dimension, tag, location, radius) {
  const nearby = [];

  for (const entity of dimension.getEntities({ tags: [tag] })) {
    if (horizontalDistance(entity.location, location) <= radius) {
      nearby.push(entity);
    }
  }

  return nearby;
}

function getStormHealth(storm) {
  return storm.getComponent(EntityComponentTypes.Health);
}

function getStormState(storm) {
  if (!stormBattleState.has(storm.id)) {
    const health = getStormHealth(storm);
    const visibleHealth = health ? health.effectiveMax : 300;

    stormBattleState.set(storm.id, {
      arenaCenter: { ...storm.location },
      lastEndermiteTick: 0,
      lastHelperVolleyTick: 0,
      lastTentacleTick: 0,
      lastLightningTick: 0,
      phase: 1,
      transitioningPhase: false,
      maxVirtualHealth: PHASE_ONE_VIRTUAL_HEALTH,
      virtualHealth: PHASE_ONE_VIRTUAL_HEALTH,
      lastVisibleHealth: visibleHealth,
    });
  }

  return stormBattleState.get(storm.id);
}

function initializeStormHealth(storm) {
  const health = getStormHealth(storm);

  if (!health) {
    return;
  }

  health.resetToMaxValue();
  const state = getStormState(storm);
  state.lastVisibleHealth = health.currentValue;
}

function syncStormHealth(storm) {
  const health = getStormHealth(storm);

  if (!health) {
    return;
  }

  const state = getStormState(storm);
  const visibleDamage = Math.max(0, state.lastVisibleHealth - health.currentValue);

  if (visibleDamage > 0) {
    state.virtualHealth = Math.max(0, state.virtualHealth - visibleDamage);
  }

  if (state.virtualHealth <= 0) {
    if (state.phase === 1 && !state.transitioningPhase) {
      startPhaseTwo(storm);
      return;
    }

    storm.kill();
    return;
  }

  const desiredVisibleHealth = Math.max(
    1,
    Math.ceil((state.virtualHealth / state.maxVirtualHealth) * health.effectiveMax),
  );

  if (Math.ceil(health.currentValue) !== desiredVisibleHealth) {
    health.setCurrentValue(desiredVisibleHealth);
  }

  state.lastVisibleHealth = desiredVisibleHealth;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampLocationToArena(location, center, radius) {
  return {
    x: clamp(location.x, center.x - radius, center.x + radius),
    y: location.y,
    z: clamp(location.z, center.z - radius, center.z + radius),
  };
}

function moveStormWithinArena(storm) {
  const state = getStormState(storm);
  const center = state.arenaCenter ?? storm.location;
  const raiders = getRaidPlayers(center, STORM_SUPPORT_RADIUS, storm.dimension);

  if (raiders.length === 0) {
    const homeY = center.y + (state.phase === 1 ? 18 : 34);
    const current = storm.location;
    const dx = center.x - current.x;
    const dz = center.z - current.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance > 2 || Math.abs(current.y - homeY) > 3) {
      const step = Math.min(1.4, distance || 0);
      storm.teleport({
        x: distance > 0 ? current.x + (dx / distance) * step : center.x,
        y: current.y + Math.sign(homeY - current.y) * Math.min(1.2, Math.abs(homeY - current.y)),
        z: distance > 0 ? current.z + (dz / distance) * step : center.z,
      });
    }

    return;
  }

  let targetPlayer = raiders[0];
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const player of raiders) {
    const distance = horizontalDistance(player.location, storm.location);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      targetPlayer = player;
    }
  }

  const desiredY = center.y + (state.phase === 1 ? 18 : 34);
  const desiredTarget = clampLocationToArena(targetPlayer.location, center, ARENA_RADIUS - 4);
  const current = storm.location;
  const dx = desiredTarget.x - current.x;
  const dz = desiredTarget.z - current.z;
  const distance = Math.sqrt(dx * dx + dz * dz);
  const maxStep = state.phase === 1 ? 1.1 : 1.5;
  const step = Math.min(maxStep, distance || 0);
  const nextX = distance > 0 ? current.x + (dx / distance) * step : current.x;
  const nextZ = distance > 0 ? current.z + (dz / distance) * step : current.z;
  const nextLocation = clampLocationToArena(
    {
      x: nextX,
      y: current.y + Math.sign(desiredY - current.y) * Math.min(1.3, Math.abs(desiredY - current.y)),
      z: nextZ,
    },
    center,
    ARENA_RADIUS - 2,
  );

  storm.teleport(nextLocation);
}

function buffEnderstorm(storm) {
  const state = getStormState(storm);

  if (state.phase === 1) {
    storm.nameTag = "Quinn's Giant Purple Enderstorm";
    storm.addEffect("resistance", 120, { amplifier: 1, showParticles: false });
    storm.addEffect("regeneration", 120, { amplifier: 1, showParticles: false });
    storm.addEffect("speed", 120, { amplifier: 1, showParticles: false });
    return;
  }

  storm.nameTag = "Quinn's Ascended Giant Enderstorm";
  storm.addEffect("resistance", 120, { amplifier: 2, showParticles: false });
  storm.addEffect("regeneration", 120, { amplifier: 2, showParticles: false });
  storm.addEffect("speed", 120, { amplifier: 2, showParticles: false });
  storm.addEffect("strength", 120, { amplifier: 1, showParticles: false });
}

function summonEndermiteWave(storm) {
  const state = getStormState(storm);

  if (system.currentTick - state.lastEndermiteTick < ENDERMITE_SUMMON_INTERVAL) {
    return;
  }

  state.lastEndermiteTick = system.currentTick;

  const nearbyMites = getTaggedEntitiesNear(
    storm.dimension,
    ENDERESTORM_MINION_TAG,
    storm.location,
    STORM_MINION_RADIUS,
  );
  const mitesToSpawn = Math.max(1, Math.min(state.phase === 1 ? 3 : 5, MAX_ENDERMITES - nearbyMites.length));

  for (let index = 0; index < mitesToSpawn; index++) {
    const angle = (system.currentTick / 9) + index * ((Math.PI * 2) / 3);
    const mite = storm.dimension.spawnEntity("minecraft:endermite", {
      x: storm.location.x + Math.cos(angle) * (state.phase === 1 ? 10 : 18),
      y: storm.location.y - (state.phase === 1 ? 10 : 16),
      z: storm.location.z + Math.sin(angle) * (state.phase === 1 ? 10 : 18),
    });

    mite.nameTag = "Enderstorm Tentacle";
    mite.addTag(ENDERESTORM_MINION_TAG);
    mite.addEffect("speed", 60, { amplifier: state.phase === 1 ? 1 : 2, showParticles: false });
    mite.addEffect("strength", 60, { amplifier: state.phase === 1 ? 0 : 1, showParticles: false });
  }
}

function strikePlayersWithTentacles(storm) {
  const state = getStormState(storm);

  const interval = state.phase === 1 ? PHASE_ONE_TENTACLE_STRIKE_INTERVAL : PHASE_TWO_TENTACLE_STRIKE_INTERVAL;

  if (system.currentTick - state.lastTentacleTick < interval) {
    return;
  }

  state.lastTentacleTick = system.currentTick;

  const raiders = getRaidPlayers(storm.location, STORM_SUPPORT_RADIUS, storm.dimension).slice(0, state.phase === 1 ? 3 : 5);

  for (const player of raiders) {
    const distance = horizontalDistance(player.location, storm.location);

    if (distance > (state.phase === 1 ? 24 : 36)) {
      continue;
    }

    player.applyDamage(state.phase === 1 ? 8 : 12);
    runPlayerCommand(player, `effect @s slowness ${state.phase === 1 ? 2 : 3} 1 true`);
    runPlayerCommand(player, `effect @s weakness ${state.phase === 1 ? 2 : 3} 0 true`);
    player.sendMessage(state.phase === 1 ? "A giant purple tentacle whips into you." : "An ascended tentacle crushes through the storm and slams you.");
  }
}

function summonLightningNearPlayer(player) {
  const location = toBlockLocation(player.location);
  const x = location.x + ((system.currentTick % 7) - 3);
  const z = location.z + (((system.currentTick + 3) % 7) - 3);
  runPlayerCommand(player, `summon lightning_bolt ${x} ${location.y} ${z}`);
}

function triggerPhaseTwoLightning(storm) {
  const state = getStormState(storm);

  if (state.phase !== 2) {
    return;
  }

  if (system.currentTick - state.lastLightningTick < PHASE_TWO_LIGHTNING_INTERVAL) {
    return;
  }

  state.lastLightningTick = system.currentTick;

  for (const player of getRaidPlayers(storm.location, STORM_SUPPORT_RADIUS, storm.dimension).slice(0, 3)) {
    summonLightningNearPlayer(player);
  }
}

function startPhaseTwo(storm) {
  const state = getStormState(storm);
  const health = getStormHealth(storm);

  state.transitioningPhase = true;
  state.phase = 2;
  state.maxVirtualHealth = PHASE_TWO_VIRTUAL_HEALTH;
  state.virtualHealth = PHASE_TWO_VIRTUAL_HEALTH;
  state.lastEndermiteTick = 0;
  state.lastHelperVolleyTick = 0;
  state.lastTentacleTick = 0;
  state.lastLightningTick = 0;

  if (health) {
    health.resetToMaxValue();
    state.lastVisibleHealth = health.effectiveMax;
  }

  storm.teleport({
    x: storm.location.x,
    y: storm.location.y + 28,
    z: storm.location.z,
  });

  for (const player of getRaidPlayers(storm.location, STORM_SUPPORT_RADIUS, storm.dimension)) {
    player.sendMessage("The Enderstorm rises into an ascended second phase. Lightning tears across the sky.");
    runPlayerCommand(player, "playsound ambient.weather.thunder @s");
  }

  state.transitioningPhase = false;
}

function spawnHelperArcher(storm, index) {
  const angle = index * ((Math.PI * 2) / TARGET_RAID_SIZE);
  const archer = storm.dimension.spawnEntity("minecraft:wandering_trader", {
    x: storm.location.x + Math.cos(angle) * (ARENA_RADIUS - 4),
    y: storm.location.y - 18,
    z: storm.location.z + Math.sin(angle) * (ARENA_RADIUS - 4),
  });

  archer.nameTag = `Diamond Archer NPC ${index + 1}`;
  archer.addTag(ENDERESTORM_HELPER_TAG);
  archer.addTag(ENDERESTORM_ARCHER_TAG);
  archer.addEffect("resistance", 120, { amplifier: 4, showParticles: false });
  archer.addEffect("fire_resistance", 120, { amplifier: 0, showParticles: false });
  archer.addEffect("speed", 120, { amplifier: 0, showParticles: false });
}

function ensureHelperArchers(storm) {
  const raiders = getRaidPlayers(storm.location, STORM_SUPPORT_RADIUS, storm.dimension);
  const desiredHelpers = Math.max(0, TARGET_RAID_SIZE - raiders.length);
  const archers = getTaggedEntitiesNear(
    storm.dimension,
    ENDERESTORM_ARCHER_TAG,
    storm.location,
    STORM_MINION_RADIUS,
  );

  while (archers.length < desiredHelpers) {
    spawnHelperArcher(storm, archers.length);
    archers.push(
      ...getTaggedEntitiesNear(storm.dimension, ENDERESTORM_ARCHER_TAG, storm.location, STORM_MINION_RADIUS).slice(
        archers.length,
      ),
    );
  }

  while (archers.length > desiredHelpers) {
    const extra = archers.pop();

    if (extra) {
      extra.kill();
    }
  }

  archers.forEach((archer, index) => {
    const angle = (system.currentTick / 40) + index * ((Math.PI * 2) / Math.max(1, desiredHelpers));
    archer.teleport({
      x: storm.location.x + Math.cos(angle) * (ARENA_RADIUS - 4),
      y: storm.location.y - 18,
      z: storm.location.z + Math.sin(angle) * (ARENA_RADIUS - 4),
    });
    archer.addEffect("resistance", 20, { amplifier: 4, showParticles: false });
  });

  return archers.length;
}

function fireHelperVolleys(storm, helperCount) {
  const state = getStormState(storm);

  if (helperCount <= 0) {
    return;
  }

  if (system.currentTick - state.lastHelperVolleyTick < HELPER_VOLLEY_INTERVAL) {
    return;
  }

  state.lastHelperVolleyTick = system.currentTick;
  state.virtualHealth = Math.max(0, state.virtualHealth - helperCount * (state.phase === 1 ? 2 : 3));

  for (const player of getRaidPlayers(storm.location, STORM_SUPPORT_RADIUS, storm.dimension)) {
    runPlayerCommand(player, "playsound random.bow @s");
  }
}

function cleanupStormMinions(location, dimension) {
  for (const minion of dimension.getEntities({ tags: [ENDERESTORM_MINION_TAG] })) {
    if (horizontalDistance(minion.location, location) > STORM_MINION_RADIUS + 24) {
      continue;
    }

    minion.kill();
  }
}

function cleanupStormHelpers(location, dimension) {
  for (const helper of dimension.getEntities({ tags: [ENDERESTORM_HELPER_TAG] })) {
    if (horizontalDistance(helper.location, location) > STORM_MINION_RADIUS + 24) {
      continue;
    }

    helper.kill();
  }
}

function updateStormBattle(storm) {
  buffEnderstorm(storm);
  syncStormHealth(storm);
  moveStormWithinArena(storm);
  summonEndermiteWave(storm);
  strikePlayersWithTentacles(storm);
  triggerPhaseTwoLightning(storm);
  const helperCount = ensureHelperArchers(storm);
  fireHelperVolleys(storm, helperCount);
}

function spawnEnderstorm(player, spawnLocation) {
  earthquakeFlattenArena(player, spawnLocation);
  setBattleSkyForNearbyPlayers(spawnLocation, player.dimension);

  const existingStorm = getNearestStorm(player);

  if (existingStorm && horizontalDistance(existingStorm.location, spawnLocation) <= 36) {
    updateStormBattle(existingStorm);
    player.addTag(ENDERESTORM_SUMMONED_TAG);
    player.removeTag(FORCE_ENDERSTORM_TAG);
    player.sendMessage("Quinn's Giant Purple Enderstorm is already raging nearby.");
    return existingStorm;
  }

  const storm = player.dimension.spawnEntity(ENDERESTORM_BOSS_ID, {
    x: spawnLocation.x,
    y: spawnLocation.y + 18,
    z: spawnLocation.z,
  });

  storm.addTag(ENDERESTORM_ENTITY_TAG);
  initializeStormHealth(storm);
  getStormState(storm).arenaCenter = { ...spawnLocation };
  updateStormBattle(storm);

  player.addTag(ENDERESTORM_SUMMONED_TAG);
  player.removeTag(FORCE_ENDERSTORM_TAG);
  player.sendMessage("The ground cracks, the earthquake flattens the land, and Quinn's Enderstorm rises from the storm!");
  runPlayerCommand(player, "playsound mob.ghast.scream @s");

  return storm;
}

function createRewardPickaxe() {
  const pickaxe = new ItemStack("minecraft:netherite_pickaxe", 1);
  pickaxe.nameTag = "Quinn's Iron-Gold Stormbreaker";
  pickaxe.keepOnDeath = true;
  pickaxe.setLore([
    "Golden speed. Iron grit. Enderstorm finish.",
    "Reward for defeating Quinn's Enderstorm.",
    "Packed with the strongest legal enchantments.",
  ]);

  const enchantable = pickaxe.getComponent(ItemComponentTypes.Enchantable);

  if (enchantable) {
    enchantable.addEnchantments([
      { type: new EnchantmentType("minecraft:efficiency"), level: 5 },
      { type: new EnchantmentType("minecraft:unbreaking"), level: 3 },
      { type: new EnchantmentType("minecraft:fortune"), level: 3 },
      { type: new EnchantmentType("minecraft:mending"), level: 1 },
    ]);
  }

  return pickaxe;
}

function createEnchantedItem(typeId, nameTag, lore, enchantments, amount = 1) {
  const item = new ItemStack(typeId, amount);
  item.nameTag = nameTag;
  item.keepOnDeath = true;
  item.setLore(lore);

  const enchantable = item.getComponent(ItemComponentTypes.Enchantable);

  if (enchantable) {
    enchantable.addEnchantments(enchantments);
  }

  return item;
}

function createArrowStack() {
  const arrows = new ItemStack("minecraft:arrow", 64);
  arrows.nameTag = "Quinn's Diamond Arrows";
  arrows.keepOnDeath = true;
  arrows.setLore(["A custom storm quiver built to hit the purple core."]);
  return arrows;
}

function createPreFightLoadout() {
  return {
    helmet: createEnchantedItem(
      "minecraft:diamond_helmet",
      "Quinn's Storm Helm",
      ["Built for the altar trial.", "Fully enchanted for the Enderstorm fight."],
      [
        { type: new EnchantmentType("minecraft:protection"), level: 4 },
        { type: new EnchantmentType("minecraft:unbreaking"), level: 3 },
        { type: new EnchantmentType("minecraft:mending"), level: 1 },
        { type: new EnchantmentType("minecraft:respiration"), level: 3 },
        { type: new EnchantmentType("minecraft:aqua_affinity"), level: 1 },
      ],
    ),
    chestplate: createEnchantedItem(
      "minecraft:diamond_chestplate",
      "Quinn's Storm Chestplate",
      ["Built for the altar trial.", "Fully enchanted for the Enderstorm fight."],
      [
        { type: new EnchantmentType("minecraft:protection"), level: 4 },
        { type: new EnchantmentType("minecraft:unbreaking"), level: 3 },
        { type: new EnchantmentType("minecraft:mending"), level: 1 },
        { type: new EnchantmentType("minecraft:thorns"), level: 3 },
      ],
    ),
    leggings: createEnchantedItem(
      "minecraft:diamond_leggings",
      "Quinn's Storm Leggings",
      ["Built for the altar trial.", "Fully enchanted for the Enderstorm fight."],
      [
        { type: new EnchantmentType("minecraft:protection"), level: 4 },
        { type: new EnchantmentType("minecraft:unbreaking"), level: 3 },
        { type: new EnchantmentType("minecraft:mending"), level: 1 },
        { type: new EnchantmentType("minecraft:thorns"), level: 3 },
      ],
    ),
    boots: createEnchantedItem(
      "minecraft:diamond_boots",
      "Quinn's Storm Boots",
      ["Built for the altar trial.", "Fully enchanted for the Enderstorm fight."],
      [
        { type: new EnchantmentType("minecraft:protection"), level: 4 },
        { type: new EnchantmentType("minecraft:unbreaking"), level: 3 },
        { type: new EnchantmentType("minecraft:mending"), level: 1 },
        { type: new EnchantmentType("minecraft:feather_falling"), level: 4 },
        { type: new EnchantmentType("minecraft:depth_strider"), level: 3 },
      ],
    ),
    sword: createEnchantedItem(
      "minecraft:diamond_sword",
      "Quinn's Stormblade",
      ["Forged for the altar battle.", "Stacked with maximum combat enchantments."],
      [
        { type: new EnchantmentType("minecraft:sharpness"), level: 5 },
        { type: new EnchantmentType("minecraft:unbreaking"), level: 3 },
        { type: new EnchantmentType("minecraft:mending"), level: 1 },
        { type: new EnchantmentType("minecraft:fire_aspect"), level: 2 },
        { type: new EnchantmentType("minecraft:looting"), level: 3 },
        { type: new EnchantmentType("minecraft:knockback"), level: 2 },
      ],
    ),
    bow: createEnchantedItem(
      "minecraft:bow",
      "Quinn's Enderstorm Bow",
      ["Built to punch through the storm core.", "Loaded with every compatible bow enchantment."],
      [
        { type: new EnchantmentType("minecraft:power"), level: 5 },
        { type: new EnchantmentType("minecraft:punch"), level: 2 },
        { type: new EnchantmentType("minecraft:flame"), level: 1 },
        { type: new EnchantmentType("minecraft:infinity"), level: 1 },
        { type: new EnchantmentType("minecraft:unbreaking"), level: 3 },
      ],
    ),
    arrows: createArrowStack(),
  };
}

function grantPreFightLoadout(player) {
  if (hasTag(player, PREP_LOADOUT_TAG)) {
    return;
  }

  player.addTag(PREP_LOADOUT_TAG);

  const loadout = createPreFightLoadout();

  equipArmorItem(player, EquipmentSlot.Head, loadout.helmet);
  equipArmorItem(player, EquipmentSlot.Chest, loadout.chestplate);
  equipArmorItem(player, EquipmentSlot.Legs, loadout.leggings);
  equipArmorItem(player, EquipmentSlot.Feet, loadout.boots);
  placeHotbarItem(player, 0, loadout.sword);
  placeHotbarItem(player, 1, loadout.bow);
  placeHotbarItem(player, 2, loadout.arrows);

  runPlayerCommand(player, "effect @s strength 90 1 true");
  runPlayerCommand(player, "effect @s resistance 90 0 true");
  runPlayerCommand(player, "playsound random.totem @s");
  player.sendMessage("The altar equips you with enchanted diamond armor, Quinn's Stormblade, the Enderstorm Bow, and Diamond Arrows.");
  player.sendMessage("Sword, bow, and arrows are placed in your hotbar before the fight starts.");
}

function grantStormReward(player) {
  if (hasTag(player, PICKAXE_REWARD_TAG)) {
    return;
  }

  player.addTag(PICKAXE_REWARD_TAG);
  player.addTag(ENDERESTORM_DEFEATED_TAG);
  player.removeTag(ENDERESTORM_SUMMONED_TAG);

  giveItemToPlayer(player, createRewardPickaxe());

  player.sendMessage("Quinn hands you the Iron-Gold Stormbreaker.");
  player.sendMessage("It mines with gold speed and iron stubbornness.");
  runPlayerCommand(player, "give @s emerald 12");
  runPlayerCommand(player, "effect @s haste 12 1 true");
  runPlayerCommand(player, "playsound random.levelup @s");
}

function onTreasureReached(player) {
  if (hasTag(player, ENDERESTORM_SUMMONED_TAG)) {
    return;
  }

  const target = getTreasureTarget(player);

  grantPreFightLoadout(player);
  spawnEnderstorm(player, target);
  player.sendMessage("The earthquake has started. If fewer than five raiders arrive, Diamond Archer NPCs will help shoot the boss.");
}

function updateTreasureHunt(player) {
  if (hasTag(player, ENDERESTORM_DEFEATED_TAG)) {
    clearBattleSky(player);
    player.onScreenDisplay.setActionBar("Quinn's Enderstorm is defeated. Stormbreaker secured.");
    return;
  }

  if (hasTag(player, FORCE_ENDERSTORM_TAG)) {
    const location = player.location;
    grantPreFightLoadout(player);
    spawnEnderstorm(player, location);
  }

  if (hasTag(player, ENDERESTORM_SUMMONED_TAG)) {
    const storm = getNearestStorm(player);

    if (!storm) {
      player.removeTag(ENDERESTORM_SUMMONED_TAG);
      clearBattleSkyForNearbyPlayers(player.location, player.dimension);
      cleanupStormMinions(player.location, player.dimension);
      cleanupStormHelpers(player.location, player.dimension);
      player.sendMessage("Quinn's Enderstorm slipped away. Reach the altar or summon it again.");
      return;
    }

    updateStormBattle(storm);
    applyBattleSky(player);

    const state = getStormState(storm);
    const raidPlayers = getRaidPlayers(storm.location, STORM_SUPPORT_RADIUS, storm.dimension).length;
    const endermites = getTaggedEntitiesNear(storm.dimension, ENDERESTORM_MINION_TAG, storm.location, STORM_MINION_RADIUS).length;
    const helpers = getTaggedEntitiesNear(storm.dimension, ENDERESTORM_ARCHER_TAG, storm.location, STORM_MINION_RADIUS).length;
    const stormPercent = Math.max(1, Math.ceil((state.virtualHealth / state.maxVirtualHealth) * 100));

    player.onScreenDisplay.setActionBar(
      `Phase ${state.phase} Enderstorm: ${stormPercent}% | Raiders ${raidPlayers} | NPCs ${helpers} | Endermites ${endermites}`,
    );
    return;
  }

  const target = getTreasureTarget(player);
  const distance = horizontalDistance(player.location, target);

  if (distance <= TREASURE_RADIUS) {
    onTreasureReached(player);
    return;
  }

  const blocksAway = Math.ceil(distance);
  const direction = directionHint(player.location, target);
  player.onScreenDisplay.setActionBar(`Quinn's altar: ${blocksAway} blocks ${direction}`);
}

function updatePlayers() {
  for (const player of world.getAllPlayers()) {
    announcePlayer(player);
    updateTreasureHunt(player);
  }
}

world.afterEvents.entityDie.subscribe((event) => {
  const storm = event.deadEntity;

  if (!storm.hasTag(ENDERESTORM_ENTITY_TAG)) {
    return;
  }

  stormBattleState.delete(storm.id);
  clearBattleSkyForNearbyPlayers(storm.location, storm.dimension);
  cleanupStormMinions(storm.location, storm.dimension);
  cleanupStormHelpers(storm.location, storm.dimension);

  for (const player of world.getAllPlayers()) {
    if (player.dimension.id !== storm.dimension.id) {
      continue;
    }

    if (horizontalDistance(player.location, storm.location) > STORM_SUPPORT_RADIUS) {
      continue;
    }

    grantStormReward(player);
  }
});

system.runInterval(updatePlayers, 20);
