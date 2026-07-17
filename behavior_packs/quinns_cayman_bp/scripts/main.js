import { system, world } from "@minecraft/server";

const STARTED_TAG = "quinn_cayman_started";
const FORCE_REBUILD_TAG = "quinn_cayman_force_rebuild";
const ANIMAL_TAG = "quinn_cayman_animal";
const STAFF_TAG = "quinn_cayman_staff";
const DOG_TAG = "quinn_cayman_dog";
const LIZARD_ID = "quinns_cayman:lizard";
const STINGRAY_ID = "quinns_cayman:stingray";
const CENTER = { x: 0, y: 66, z: 0 };
const HOTEL_ROOM = { x: 4.5, y: 68, z: 2.5 };
const POPULATION_RADIUS = 72;
const welcomedPlayers = new Set();
let commandQueue = [];
let resortBuilt = false;

const STAFF = [
  { name: "Front Desk Worker", x: 4.5, y: 66, z: 10.5 },
  { name: "Restaurant Chef", x: -9.5, y: 66, z: 9.5 },
  { name: "Restaurant Server", x: -5.5, y: 66, z: 12.5 },
  { name: "Hotel Cleaner", x: 11.5, y: 67, z: -3.5 },
  { name: "Beach Tour Guide", x: 22.5, y: 65, z: 18.5 },
];

const PALMS = [
  [-28, -22],
  [-24, 25],
  [27, -24],
  [31, 19],
  [-14, 35],
  [35, -6],
];

function hasTag(entity, tag) {
  try {
    return entity.getTags().includes(tag);
  } catch (error) {
    return false;
  }
}

function runCommand(dimension, command) {
  try {
    dimension.runCommand(command);
  } catch (error) {
    console.warn(`Quinn Cayman command failed: ${command}`);
  }
}

function queue(command) {
  commandQueue.push(command);
}

function processCommandQueue() {
  if (commandQueue.length === 0) {
    return;
  }

  const overworld = world.getDimension("overworld");
  const commandsThisTick = commandQueue.splice(0, 18);

  for (const command of commandsThisTick) {
    runCommand(overworld, command);
  }
}

function buildPalm(x, z) {
  queue(`fill ${x} 65 ${z} ${x} 70 ${z} jungle_log`);
  queue(`fill ${x - 2} 71 ${z - 2} ${x + 2} 71 ${z + 2} jungle_leaves replace air`);
  queue(`fill ${x - 1} 72 ${z - 1} ${x + 1} 72 ${z + 1} jungle_leaves replace air`);
  queue(`setblock ${x} 73 ${z} jungle_leaves`);
}

function buildResort() {
  if (resortBuilt) {
    return;
  }

  resortBuilt = true;

  queue("gamerule mobgriefing false");
  queue("setworldspawn 4 68 2");
  queue("fill -76 60 -76 76 60 76 sandstone");
  queue("fill -76 61 -76 76 63 76 water");
  queue("fill -48 61 -48 48 64 48 sand");
  queue("fill -39 65 -39 39 65 39 sand");
  queue("fill -30 66 -28 30 66 28 grass_block");
  queue("fill -14 64 -12 18 78 16 air");
  queue("fill -12 65 -10 16 65 14 smooth_quartz");
  queue("fill -12 66 -10 16 72 14 smooth_quartz hollow");
  queue("fill -10 66 15 14 69 15 glass");
  queue("fill -2 66 -10 2 69 -10 glass");
  queue("fill -10 66 -8 14 66 -8 oak_planks");
  queue("fill -10 67 -8 14 67 -8 air");
  queue("setblock 4 66 14 oak_door [\"direction\"=0]");
  queue("setblock 4 67 14 oak_door [\"direction\"=0,\"upper_block_bit\"=true]");
  queue("fill 0 66 -6 12 70 6 smooth_quartz hollow");
  queue("fill 1 66 -5 11 66 5 birch_planks");
  queue("fill 1 67 -5 11 69 5 air");
  queue("setblock 4 66 -4 red_bed [\"direction\"=2]");
  queue("setblock 5 66 -4 red_bed [\"direction\"=2,\"head_piece_bit\"=true]");
  queue("setblock 8 66 -4 chest [\"minecraft:cardinal_direction\"=\"south\"]");
  queue("setblock 10 66 4 crafting_table");
  queue("setblock 6 67 6 oak_door [\"direction\"=0]");
  queue("setblock 6 68 6 oak_door [\"direction\"=0,\"upper_block_bit\"=true]");
  queue("fill -11 66 4 -3 69 13 air");
  queue("fill -11 66 4 -3 66 13 dark_oak_planks");
  queue("setblock -10 67 5 smoker");
  queue("setblock -9 67 5 cauldron");
  queue("fill -9 67 9 -5 67 9 spruce_stairs [\"weirdo_direction\"=2]");
  queue("fill -8 67 11 -4 67 11 oak_fence");
  queue("fill 19 65 6 33 65 10 oak_planks");
  queue("fill 33 64 6 43 64 10 oak_planks");
  queue("fill 20 66 7 32 66 7 oak_fence");
  queue("fill 20 66 9 32 66 9 oak_fence");
  queue("setblock 24 66 8 lantern");
  queue("setblock 28 66 8 lantern");
  queue("fill -32 65 31 -18 65 38 yellow_concrete");
  queue("fill -30 66 32 -20 66 36 white_wool");
  queue("setblock -25 67 34 bell");
  queue("fill -36 65 -8 -16 65 -6 stone_bricks");
  queue("fill -16 65 -6 20 65 -4 stone_bricks");
  queue("fill 20 65 -4 31 65 7 stone_bricks");
  queue("fill -44 64 -44 44 64 44 seagrass replace water");

  for (const [x, z] of PALMS) {
    buildPalm(x, z);
  }
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomBeachLocation() {
  return {
    x: randomBetween(-38, 38),
    y: 66,
    z: randomBetween(-38, 38),
  };
}

function randomShallowWaterLocation() {
  const side = Math.floor(Math.random() * 4);
  const edge = randomBetween(-58, 58);

  if (side === 0) {
    return { x: edge, y: 63, z: randomBetween(50, 67) };
  }

  if (side === 1) {
    return { x: edge, y: 63, z: randomBetween(-67, -50) };
  }

  if (side === 2) {
    return { x: randomBetween(50, 67), y: 63, z: edge };
  }

  return { x: randomBetween(-67, -50), y: 63, z: edge };
}

function getTaggedEntities(dimension, tag) {
  try {
    return dimension.getEntities({ tags: [tag], location: CENTER, maxDistance: POPULATION_RADIUS });
  } catch (error) {
    return [];
  }
}

function spawnNamedEntity(dimension, typeId, nameTag, location, extraTag = ANIMAL_TAG) {
  try {
    const entity = dimension.spawnEntity(typeId, location);
    entity.nameTag = nameTag;
    entity.addTag(extraTag);
    return entity;
  } catch (error) {
    console.warn(`Could not spawn ${nameTag}.`);
    return undefined;
  }
}

function tryPlayerCommand(player, command) {
  try {
    player.runCommand(command);
    return true;
  } catch (error) {
    return false;
  }
}

function refillNamedAnimals(dimension, nameTag, typeId, desiredCount, locationFactory) {
  const current = getTaggedEntities(dimension, ANIMAL_TAG).filter((entity) => entity.nameTag === nameTag).length;

  for (let i = current; i < desiredCount; i++) {
    spawnNamedEntity(dimension, typeId, nameTag, locationFactory());
  }
}

function maintainStaff(dimension) {
  const currentStaff = getTaggedEntities(dimension, STAFF_TAG);

  for (const staff of STAFF) {
    if (currentStaff.some((entity) => entity.nameTag === staff.name)) {
      continue;
    }

    spawnNamedEntity(dimension, "minecraft:villager", staff.name, { x: staff.x, y: staff.y, z: staff.z }, STAFF_TAG);
  }
}

function maintainAnimals() {
  const overworld = world.getDimension("overworld");
  refillNamedAnimals(overworld, "Green Lizard", LIZARD_ID, 18, randomBeachLocation);
  refillNamedAnimals(overworld, "Chicken", "minecraft:chicken", 12, randomBeachLocation);
  refillNamedAnimals(overworld, "Sting Ray", STINGRAY_ID, 8, randomShallowWaterLocation);
  refillNamedAnimals(overworld, "Rainbow Fish", "minecraft:tropicalfish", 14, randomShallowWaterLocation);
  maintainStaff(overworld);
}

function giveDog(player) {
  try {
    const dog = player.dimension.spawnEntity("minecraft:wolf", {
      x: HOTEL_ROOM.x + 1,
      y: HOTEL_ROOM.y,
      z: HOTEL_ROOM.z + 1,
    });
    dog.nameTag = "Quinn's Hotel Dog";
    dog.addTag(DOG_TAG);

    if (!tryPlayerCommand(player, "tame @e[type=wolf,r=5,c=1]")) {
      tryPlayerCommand(player, "event entity @e[type=wolf,r=5,c=1] minecraft:on_tame");
      player.sendMessage("Your hotel dog is here. If it is not sitting, give it a bone to finish taming.");
    }
  } catch (error) {
    player.sendMessage("The hotel dog tried to arrive, but Minecraft blocked the wolf spawn.");
  }
}

function startPlayer(player) {
  if (hasTag(player, FORCE_REBUILD_TAG)) {
    resortBuilt = false;
    tryPlayerCommand(player, `tag @s remove ${FORCE_REBUILD_TAG}`);
  }

  if (hasTag(player, STARTED_TAG)) {
    return;
  }

  buildResort();

  if (commandQueue.length > 0) {
    player.onScreenDisplay.setActionBar("Quinn's Cayman hotel is getting your room ready...");
    return;
  }

  try {
    player.teleport(HOTEL_ROOM, { dimension: world.getDimension("overworld") });
    player.addTag(STARTED_TAG);
    player.runCommand("time set day");
    player.runCommand("weather clear");
  } catch (error) {
    player.runCommand(`tp @s ${HOTEL_ROOM.x} ${HOTEL_ROOM.y} ${HOTEL_ROOM.z}`);
    player.runCommand(`tag @s add ${STARTED_TAG}`);
  }

  giveDog(player);
  player.sendMessage("Welcome to Quinn's Cayman Islands hotel. Lizards, chickens, restaurant workers, sting rays, and rainbow fish are outside.");
}

function welcomePlayer(player) {
  if (welcomedPlayers.has(player.id)) {
    return;
  }

  welcomedPlayers.add(player.id);
  player.sendMessage("Quinn's Cayman Islands Add-On is loaded. Run /function cayman_start to restart in the hotel room.");
}

function updatePlayers() {
  for (const player of world.getAllPlayers()) {
    welcomePlayer(player);
    startPlayer(player);
  }
}

system.runInterval(processCommandQueue, 1);
system.runInterval(updatePlayers, 40);
system.runInterval(maintainAnimals, 100);
