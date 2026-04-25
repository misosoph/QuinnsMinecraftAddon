import {
  EnchantmentType,
  EntityComponentTypes,
  ItemComponentTypes,
  ItemStack,
  system,
  world,
} from "@minecraft/server";

const seenPlayers = new Set();
const activeHunts = new Map();
const TREASURE_RADIUS = 5;
const ARENA_RADIUS = 18;
const ARENA_CLEAR_HEIGHT = 8;
const FORCE_ENDERSTORM_TAG = "quinn_force_enderstorm";
const ENDERESTORM_ENTITY_TAG = "quinn_enderstorm";
const ENDERESTORM_SUMMONED_TAG = "quinn_enderstorm_summoned";
const ENDERESTORM_DEFEATED_TAG = "quinn_enderstorm_defeated";
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
  player.sendMessage("Quinn's Treasure Hunt has changed.");
  player.sendMessage("Find the treasure, wake the Enderstorm, then defeat it for the pickaxe.");
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

function buffEnderstorm(storm) {
  storm.nameTag = "Quinn's Enderstorm";
  storm.addEffect("strength", 120, { amplifier: 3, showParticles: false });
  storm.addEffect("resistance", 120, { amplifier: 2, showParticles: false });
  storm.addEffect("speed", 120, { amplifier: 2, showParticles: false });
  storm.addEffect("regeneration", 120, { amplifier: 2, showParticles: false });
  storm.addEffect("jump_boost", 120, { amplifier: 1, showParticles: false });
}

function spawnEnderstorm(player, spawnLocation) {
  flattenBattleArena(player, spawnLocation);
  setBattleSkyForNearbyPlayers(spawnLocation, player.dimension);

  const existingStorm = getNearestStorm(player);

  if (existingStorm && horizontalDistance(existingStorm.location, spawnLocation) <= 24) {
    buffEnderstorm(existingStorm);
    player.addTag(ENDERESTORM_SUMMONED_TAG);
    player.removeTag(FORCE_ENDERSTORM_TAG);
    player.sendMessage("Quinn's Enderstorm is already nearby.");
    return existingStorm;
  }

  const storm = player.dimension.spawnEntity("minecraft:enderman", {
    x: spawnLocation.x,
    y: spawnLocation.y + 1,
    z: spawnLocation.z,
  });

  storm.addTag(ENDERESTORM_ENTITY_TAG);
  buffEnderstorm(storm);

  player.addTag(ENDERESTORM_SUMMONED_TAG);
  player.removeTag(FORCE_ENDERSTORM_TAG);
  player.sendMessage("The air cracks open. Quinn's Enderstorm has awakened!");
  runPlayerCommand(player, "playsound mob.endermen.portal @s");

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

function createEnchantedItem(typeId, nameTag, lore, enchantments) {
  const item = new ItemStack(typeId, 1);
  item.nameTag = nameTag;
  item.keepOnDeath = true;
  item.setLore(lore);

  const enchantable = item.getComponent(ItemComponentTypes.Enchantable);

  if (enchantable) {
    enchantable.addEnchantments(enchantments);
  }

  return item;
}

function createPreFightLoadout() {
  return [
    createEnchantedItem(
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
    createEnchantedItem(
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
    createEnchantedItem(
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
    createEnchantedItem(
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
    createEnchantedItem(
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
  ];
}

function grantPreFightLoadout(player) {
  if (hasTag(player, PREP_LOADOUT_TAG)) {
    return;
  }

  player.addTag(PREP_LOADOUT_TAG);

  for (const item of createPreFightLoadout()) {
    const leftover = player.addItem(item);

    if (leftover) {
      player.dimension.spawnItem(leftover, player.location);
    }
  }

  runPlayerCommand(player, "effect @s strength 90 1 true");
  runPlayerCommand(player, "effect @s resistance 90 0 true");
  runPlayerCommand(player, "playsound random.totem @s");
  player.sendMessage("The altar arms you with a full enchanted diamond battle set.");
  player.sendMessage("Quinn's Stormblade is at full power for the Enderstorm fight.");
}

function grantStormReward(player) {
  if (hasTag(player, PICKAXE_REWARD_TAG)) {
    return;
  }

  player.addTag(PICKAXE_REWARD_TAG);
  player.addTag(ENDERESTORM_DEFEATED_TAG);
  player.removeTag(ENDERESTORM_SUMMONED_TAG);

  const reward = createRewardPickaxe();
  const leftover = player.addItem(reward);

  if (leftover) {
    player.dimension.spawnItem(leftover, player.location);
  }

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
  player.sendMessage("The altar loadout is yours. Defeat the Enderstorm to claim Quinn's ultimate pickaxe.");
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
      player.sendMessage("Quinn's Enderstorm slipped away. Reach the altar or summon it again.");
      return;
    }

    buffEnderstorm(storm);
    applyBattleSky(player);

    const distance = Math.ceil(horizontalDistance(player.location, storm.location));
    const health = storm.getComponent(EntityComponentTypes.Health);
    const healthText = health ? Math.ceil(health.currentValue) : "?";

    player.onScreenDisplay.setActionBar(`Enderstorm: ${distance} blocks away | HP ${healthText}`);
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

  clearBattleSkyForNearbyPlayers(storm.location, storm.dimension);

  for (const player of world.getAllPlayers()) {
    if (horizontalDistance(player.location, storm.location) > 96) {
      continue;
    }

    grantStormReward(player);
  }
});

system.runInterval(updatePlayers, 20);
