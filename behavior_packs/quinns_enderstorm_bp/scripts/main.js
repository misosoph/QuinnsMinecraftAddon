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
const FORCE_ENDERSTORM_TAG = "quinn_force_enderstorm";
const ENDERESTORM_ENTITY_TAG = "quinn_enderstorm";
const ENDERESTORM_SUMMONED_TAG = "quinn_enderstorm_summoned";
const ENDERESTORM_DEFEATED_TAG = "quinn_enderstorm_defeated";
const PICKAXE_REWARD_TAG = "quinn_pickaxe_rewarded";

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

  spawnEnderstorm(player, target);
  player.sendMessage("Defeat the Enderstorm to claim Quinn's ultimate pickaxe.");
}

function updateTreasureHunt(player) {
  if (hasTag(player, ENDERESTORM_DEFEATED_TAG)) {
    player.onScreenDisplay.setActionBar("Quinn's Enderstorm is defeated. Stormbreaker secured.");
    return;
  }

  if (hasTag(player, FORCE_ENDERSTORM_TAG)) {
    const location = player.location;
    spawnEnderstorm(player, location);
  }

  if (hasTag(player, ENDERESTORM_SUMMONED_TAG)) {
    const storm = getNearestStorm(player);

    if (!storm) {
      player.removeTag(ENDERESTORM_SUMMONED_TAG);
      player.sendMessage("Quinn's Enderstorm slipped away. Reach the altar or summon it again.");
      return;
    }

    buffEnderstorm(storm);

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

  for (const player of world.getAllPlayers()) {
    if (horizontalDistance(player.location, storm.location) > 96) {
      continue;
    }

    grantStormReward(player);
  }
});

system.runInterval(updatePlayers, 20);
