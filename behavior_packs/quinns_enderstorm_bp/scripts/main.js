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
const ARENA_RADIUS = 22;
const ARENA_CLEAR_HEIGHT = 18;
const STORM_SUPPORT_RADIUS = 96;
const STORM_HELPER_RADIUS = 54;
const ENDERMITE_SUMMON_INTERVAL = 140;
const HELPER_VOLLEY_INTERVAL = 40;
const TENTACLE_STRIKE_INTERVAL = 90;
const MAX_ENDERMITES = 10;
const TARGET_RAID_SIZE = 5;
const STORM_MAX_VIRTUAL_HEALTH = 2200;
const FORCE_ENDERSTORM_TAG = "quinn_force_enderstorm";
const ENDERESTORM_ENTITY_TAG = "quinn_enderstorm";
const ENDERESTORM_SUMMONED_TAG = "quinn_enderstorm_summoned";
const ENDERESTORM_DEFEATED_TAG = "quinn_enderstorm_defeated";
const ENDERESTORM_HEAD_TAG = "quinn_enderstorm_head";
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

function flattenBattleArena(player, center) {
  const blockCenter = toBlockLocation(center);
  const minX = blockCenter.x - ARENA_RADIUS;
  const maxX = blockCenter.x + ARENA_RADIUS;
  const minZ = blockCenter.z - ARENA_RADIUS;
  const maxZ = blockCenter.z + ARENA_RADIUS;
  const floorY = blockCenter.y - 1;
  const clearTopY = blockCenter.y + ARENA_CLEAR_HEIGHT;

  runPlayerCommand(
    player,
    `fill ${minX} ${floorY} ${minZ} ${maxX} ${floorY} ${maxZ} bedrock replace`,
  );
  runPlayerCommand(
    player,
    `fill ${minX} ${blockCenter.y} ${minZ} ${maxX} ${clearTopY} ${maxZ} air replace`,
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
      lastEndermiteTick: 0,
      lastHelperVolleyTick: 0,
      lastTentacleTick: 0,
      maxVirtualHealth: STORM_MAX_VIRTUAL_HEALTH,
      virtualHealth: STORM_MAX_VIRTUAL_HEALTH,
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

function buffEnderstorm(storm) {
  storm.nameTag = "Quinn's Purple Enderstorm";
  storm.addEffect("resistance", 120, { amplifier: 1, showParticles: false });
  storm.addEffect("regeneration", 120, { amplifier: 1, showParticles: false });
  storm.addEffect("speed", 120, { amplifier: 1, showParticles: false });
}

function spawnStormHeads(storm) {
  const existingHeads = getTaggedEntitiesNear(
    storm.dimension,
    ENDERESTORM_HEAD_TAG,
    storm.location,
    STORM_HELPER_RADIUS,
  );

  for (let index = existingHeads.length; index < 3; index++) {
    const angle = index * ((Math.PI * 2) / 3);
    const head = storm.dimension.spawnEntity("minecraft:enderman", {
      x: storm.location.x + Math.cos(angle) * 5,
      y: storm.location.y + 3 + index,
      z: storm.location.z + Math.sin(angle) * 5,
    });

    head.nameTag = `Enderstorm Head ${index + 1}`;
    head.addTag(ENDERESTORM_HEAD_TAG);
    head.addTag(ENDERESTORM_HELPER_TAG);
    head.addEffect("resistance", 120, { amplifier: 1, showParticles: false });
    head.addEffect("speed", 120, { amplifier: 1, showParticles: false });
  }
}

function updateStormHeads(storm) {
  const heads = getTaggedEntitiesNear(
    storm.dimension,
    ENDERESTORM_HEAD_TAG,
    storm.location,
    STORM_HELPER_RADIUS,
  ).slice(0, 3);

  const baseAngle = system.currentTick / 14;

  heads.forEach((head, index) => {
    const angle = baseAngle + index * ((Math.PI * 2) / 3);
    const radius = 5 + index * 1.5;
    head.teleport({
      x: storm.location.x + Math.cos(angle) * radius,
      y: storm.location.y + 3 + index * 2,
      z: storm.location.z + Math.sin(angle) * radius,
    });
  });
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
    STORM_HELPER_RADIUS,
  );
  const mitesToSpawn = Math.max(1, Math.min(3, MAX_ENDERMITES - nearbyMites.length));

  for (let index = 0; index < mitesToSpawn; index++) {
    const angle = (system.currentTick / 9) + index * ((Math.PI * 2) / 3);
    const mite = storm.dimension.spawnEntity("minecraft:endermite", {
      x: storm.location.x + Math.cos(angle) * 7,
      y: storm.location.y - 7,
      z: storm.location.z + Math.sin(angle) * 7,
    });

    mite.nameTag = "Enderstorm Tentacle";
    mite.addTag(ENDERESTORM_MINION_TAG);
    mite.addTag(ENDERESTORM_HELPER_TAG);
    mite.addEffect("speed", 60, { amplifier: 1, showParticles: false });
    mite.addEffect("strength", 60, { amplifier: 0, showParticles: false });
  }
}

function strikePlayersWithTentacles(storm) {
  const state = getStormState(storm);

  if (system.currentTick - state.lastTentacleTick < TENTACLE_STRIKE_INTERVAL) {
    return;
  }

  state.lastTentacleTick = system.currentTick;

  const raiders = getRaidPlayers(storm.location, STORM_SUPPORT_RADIUS, storm.dimension).slice(0, 3);

  for (const player of raiders) {
    if (horizontalDistance(player.location, storm.location) < 10) {
      player.applyDamage(6);
      runPlayerCommand(player, "effect @s slowness 2 1 true");
      player.sendMessage("A purple tentacle slams into you.");
    }
  }
}

function spawnHelperArcher(storm, index) {
  const angle = index * ((Math.PI * 2) / TARGET_RAID_SIZE);
  const archer = storm.dimension.spawnEntity("minecraft:wandering_trader", {
    x: storm.location.x + Math.cos(angle) * (ARENA_RADIUS - 3),
    y: storm.location.y - 8,
    z: storm.location.z + Math.sin(angle) * (ARENA_RADIUS - 3),
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
    STORM_HELPER_RADIUS,
  );

  while (archers.length < desiredHelpers) {
    spawnHelperArcher(storm, archers.length);
    archers.push(
      ...getTaggedEntitiesNear(storm.dimension, ENDERESTORM_ARCHER_TAG, storm.location, STORM_HELPER_RADIUS).slice(
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
      x: storm.location.x + Math.cos(angle) * (ARENA_RADIUS - 3),
      y: storm.location.y - 8,
      z: storm.location.z + Math.sin(angle) * (ARENA_RADIUS - 3),
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
  state.virtualHealth = Math.max(0, state.virtualHealth - helperCount * 3);

  for (const player of getRaidPlayers(storm.location, STORM_SUPPORT_RADIUS, storm.dimension)) {
    runPlayerCommand(player, "playsound random.bow @s");
  }
}

function cleanupStormHelpers(location, dimension) {
  for (const helper of dimension.getEntities({ tags: [ENDERESTORM_HELPER_TAG] })) {
    if (horizontalDistance(helper.location, location) > STORM_HELPER_RADIUS + 24) {
      continue;
    }

    helper.kill();
  }
}

function updateStormBattle(storm) {
  buffEnderstorm(storm);
  syncStormHealth(storm);
  spawnStormHeads(storm);
  updateStormHeads(storm);
  summonEndermiteWave(storm);
  strikePlayersWithTentacles(storm);
  const helperCount = ensureHelperArchers(storm);
  fireHelperVolleys(storm, helperCount);
}

function spawnEnderstorm(player, spawnLocation) {
  flattenBattleArena(player, spawnLocation);
  setBattleSkyForNearbyPlayers(spawnLocation, player.dimension);

  const existingStorm = getNearestStorm(player);

  if (existingStorm && horizontalDistance(existingStorm.location, spawnLocation) <= 36) {
    updateStormBattle(existingStorm);
    player.addTag(ENDERESTORM_SUMMONED_TAG);
    player.removeTag(FORCE_ENDERSTORM_TAG);
    player.sendMessage("Quinn's Purple Enderstorm is already raging nearby.");
    return existingStorm;
  }

  const storm = player.dimension.spawnEntity("minecraft:wither", {
    x: spawnLocation.x,
    y: spawnLocation.y + 10,
    z: spawnLocation.z,
  });

  storm.addTag(ENDERESTORM_ENTITY_TAG);
  initializeStormHealth(storm);
  updateStormBattle(storm);

  player.addTag(ENDERESTORM_SUMMONED_TAG);
  player.removeTag(FORCE_ENDERSTORM_TAG);
  player.sendMessage("The purple tornado opens above the altar. Quinn's Enderstorm has awakened!");
  runPlayerCommand(player, "playsound mob.wither.spawn @s");

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
  player.sendMessage("If fewer than five players arrive, Diamond Archer NPCs will join the raid.");
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
      cleanupStormHelpers(player.location, player.dimension);
      player.sendMessage("Quinn's Enderstorm slipped away. Reach the altar or summon it again.");
      return;
    }

    updateStormBattle(storm);
    applyBattleSky(player);

    const state = getStormState(storm);
    const raidPlayers = getRaidPlayers(storm.location, STORM_SUPPORT_RADIUS, storm.dimension).length;
    const archers = getTaggedEntitiesNear(
      storm.dimension,
      ENDERESTORM_ARCHER_TAG,
      storm.location,
      STORM_HELPER_RADIUS,
    ).length;
    const stormPercent = Math.max(1, Math.ceil((state.virtualHealth / state.maxVirtualHealth) * 100));

    player.onScreenDisplay.setActionBar(
      `Purple Enderstorm: ${stormPercent}% | Raiders ${raidPlayers} | NPC Archers ${archers}`,
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
