import { system, world } from "@minecraft/server";

const seenPlayers = new Set();
const activeHunts = new Map();
const TREASURE_FOUND_TAG = "quinn_treasure_found";
const TREASURE_RADIUS = 5;

function announcePlayer(player) {
  if (seenPlayers.has(player.id)) {
    return;
  }

  seenPlayers.add(player.id);
  player.sendMessage("Quinn's Treasure Hunt has begun.");
  player.sendMessage("Follow the action bar clues to find the hidden treasure.");
}

function hasFoundTreasure(player) {
  return player.getTags().includes(TREASURE_FOUND_TAG);
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
    player.sendMessage(`Quinn hid treasure near X ${target.x}, Z ${target.z}.`);
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

function runRewardCommand(player, command) {
  try {
    player.runCommand(command);
  } catch (error) {
    console.warn(`Quinn reward command failed: ${command}`);
  }
}

function completeTreasureHunt(player) {
  player.addTag(TREASURE_FOUND_TAG);
  activeHunts.delete(player.id);
  player.sendMessage("You found Quinn's hidden treasure!");
  player.sendMessage("Reward claimed: emeralds, bread, torches, and a compass.");

  runRewardCommand(player, "give @s emerald 6");
  runRewardCommand(player, "give @s bread 8");
  runRewardCommand(player, "give @s torch 16");
  runRewardCommand(player, "give @s compass 1");
  runRewardCommand(player, "effect @s speed 8 1 true");
  runRewardCommand(player, "playsound random.levelup @s");
}

function updateTreasureHunt(player) {
  if (hasFoundTreasure(player)) {
    player.onScreenDisplay.setActionBar("Quinn's treasure found. Adventure complete!");
    return;
  }

  const target = getTreasureTarget(player);
  const distance = horizontalDistance(player.location, target);

  if (distance <= TREASURE_RADIUS) {
    completeTreasureHunt(player);
    return;
  }

  const blocksAway = Math.ceil(distance);
  const direction = directionHint(player.location, target);
  player.onScreenDisplay.setActionBar(`Quinn's treasure: ${blocksAway} blocks ${direction}`);
}

function updatePlayers() {
  for (const player of world.getAllPlayers()) {
    announcePlayer(player);
    updateTreasureHunt(player);
  }
}

system.runInterval(updatePlayers, 20);
