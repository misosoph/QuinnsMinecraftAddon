import { system, world } from "@minecraft/server";

const STARTED_TAG = "quinn_cayman_started";
const BUILD_TAG = "quinn_cayman_build_140";
const FORCE_REBUILD_TAG = "quinn_cayman_force_rebuild";
const ANIMAL_TAG = "quinn_cayman_animal";
const STAFF_TAG = "quinn_cayman_staff";
const DOG_TAG = "quinn_cayman_dog";
const LIZARD_ID = "quinns_cayman:lizard";
const STINGRAY_ID = "quinns_cayman:stingray";
const STINGRAY_COUNT = 48;
const CENTER = { x: 0, y: 66, z: 0 };
const HOTEL_ROOM = { x: 4.5, y: 68, z: 2.5 };
const POPULATION_RADIUS = 110;
const welcomedPlayers = new Set();
let commandQueue = [];
let resortBuilt = false;

const STAFF = [
  { name: "Front Desk Worker", x: 4.5, y: 67, z: 10.5 },
  { name: "Restaurant Chef", x: -9.5, y: 67, z: 9.5 },
  { name: "Restaurant Server", x: -5.5, y: 67, z: 12.5 },
  { name: "Hotel Cleaner", x: 11.5, y: 67, z: -3.5 },
  { name: "Beach Tour Guide", x: 22.5, y: 67, z: 18.5 },
  { name: "Bakery Clerk", x: 38.5, y: 67, z: -11.5 },
  { name: "Island Market Seller", x: 49.5, y: 67, z: -11.5 },
  { name: "Souvenir Shop Clerk", x: 60.5, y: 67, z: -11.5 },
  { name: "Hotel Staff Resident 1", x: -49.5, y: 67, z: 28.5 },
  { name: "Hotel Staff Resident 2", x: -37.5, y: 67, z: 28.5 },
  { name: "Hotel Staff Resident 3", x: 39.5, y: 67, z: 28.5 },
  { name: "Hotel Staff Resident 4", x: 51.5, y: 67, z: 28.5 },
];

const PALMS = [
  [-58, -52],
  [-55, 48],
  [55, -50],
  [58, 46],
  [-18, 48],
  [20, 47],
  [62, 8],
  [-62, 8],
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

function queueFill(x1, y1, z1, x2, y2, z2, block, mode = "") {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  const minZ = Math.min(z1, z2);
  const maxZ = Math.max(z1, z2);
  const height = maxY - minY + 1;
  const depth = maxZ - minZ + 1;
  const maxSliceWidth = Math.max(1, Math.floor(30000 / (height * depth)));
  const suffix = mode ? ` ${mode}` : "";

  for (let startX = minX; startX <= maxX; startX += maxSliceWidth) {
    const endX = Math.min(startX + maxSliceWidth - 1, maxX);
    queue(`fill ${startX} ${minY} ${minZ} ${endX} ${maxY} ${maxZ} ${block}${suffix}`);
  }
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

function buildHotel() {
  queue("fill -30 66 -22 30 78 18 smooth_quartz hollow");
  queue("fill -28 66 -20 28 66 16 birch_planks");
  queue("fill -28 72 -20 28 72 16 birch_planks");
  queue("fill -28 77 -20 28 77 16 birch_planks");
  queue("fill -28 68 -21 28 70 -21 glass");
  queue("fill -28 74 -21 28 76 -21 glass");
  queue("fill -28 68 18 28 70 18 glass");
  queue("fill -28 74 18 28 76 18 glass");
  queue("fill -30 68 -18 -30 70 14 glass");
  queue("fill 30 68 -18 30 70 14 glass");
  queue("fill -32 79 -24 32 79 20 quartz_block");
  queue("fill -27 73 -18 27 73 16 oak_planks");
  queue("fill -27 74 -18 27 74 -18 oak_fence");
  queue("fill -27 74 16 27 74 16 oak_fence");
  queue("setblock 0 66 18 oak_door [\"direction\"=0]");
  queue("setblock 0 67 18 oak_door [\"direction\"=0,\"upper_block_bit\"=true]");
  queue("setblock 0 79 18 sea_lantern");
  queue("fill -10 67 9 10 67 9 dark_oak_planks");
  queue("setblock 4 67 14 lectern");
  queue("setblock -9 67 10 smoker");
  queue("setblock -7 67 10 cauldron");
  queue("fill -9 67 12 -5 67 12 spruce_stairs [\"weirdo_direction\"=2]");
  queue("fill -8 67 14 -4 67 14 oak_fence");

  // Quinn's room sits inside the larger hotel shell at the world spawn.
  queue("fill 0 66 -6 12 70 6 smooth_quartz hollow");
  queue("fill 1 66 -5 11 66 5 birch_planks");
  queue("fill 1 67 -5 11 69 5 air");
  queue("setblock 4 66 -4 red_bed [\"direction\"=2]");
  queue("setblock 5 66 -4 red_bed [\"direction\"=2,\"head_piece_bit\"=true]");
  queue("setblock 8 66 -4 chest [\"minecraft:cardinal_direction\"=\"south\"]");
  queue("setblock 10 66 4 crafting_table");
  queue("setblock 6 67 6 oak_door [\"direction\"=0]");
  queue("setblock 6 68 6 oak_door [\"direction\"=0,\"upper_block_bit\"=true]");
}

function buildShop(x, z, wall, roof) {
  queue(`fill ${x} 66 ${z} ${x + 8} 66 ${z + 8} oak_planks`);
  queue(`fill ${x} 67 ${z} ${x + 8} 70 ${z + 8} ${wall} hollow`);
  queue(`fill ${x - 1} 71 ${z - 1} ${x + 9} 71 ${z + 9} ${roof}`);
  queue(`setblock ${x + 4} 67 ${z + 8} oak_door [\"direction\"=0]`);
  queue(`setblock ${x + 4} 68 ${z + 8} oak_door [\"direction\"=0,\"upper_block_bit\"=true]`);
  queue(`fill ${x + 1} 68 ${z + 8} ${x + 2} 69 ${z + 8} glass`);
  queue(`fill ${x + 6} 68 ${z + 8} ${x + 7} 69 ${z + 8} glass`);
  queue(`setblock ${x + 2} 67 ${z + 3} chest`);
  queue(`setblock ${x + 6} 67 ${z + 3} barrel`);
  queue(`setblock ${x + 1} 70 ${z + 1} lantern`);
}

function buildHouse(x, z, wall, roof) {
  queue(`fill ${x} 66 ${z} ${x + 8} 66 ${z + 8} oak_planks`);
  queue(`fill ${x} 67 ${z} ${x + 8} 70 ${z + 8} ${wall} hollow`);
  queue(`fill ${x - 1} 71 ${z - 1} ${x + 9} 71 ${z + 9} ${roof}`);
  queue(`setblock ${x + 4} 67 ${z + 8} oak_door [\"direction\"=0]`);
  queue(`setblock ${x + 4} 68 ${z + 8} oak_door [\"direction\"=0,\"upper_block_bit\"=true]`);
  queue(`fill ${x + 1} 68 ${z + 8} ${x + 2} 69 ${z + 8} glass`);
  queue(`fill ${x + 6} 68 ${z + 8} ${x + 7} 69 ${z + 8} glass`);
  queue(`setblock ${x + 2} 67 ${z + 2} red_bed [\"direction\"=2]`);
  queue(`setblock ${x + 3} 67 ${z + 2} red_bed [\"direction\"=2,\"head_piece_bit\"=true]`);
  queue(`setblock ${x + 6} 67 ${z + 3} chest`);
  queue(`setblock ${x + 1} 70 ${z + 1} lantern`);
}

function buildResort() {
  if (resortBuilt) {
    return;
  }

  resortBuilt = true;

  queue("gamerule mobgriefing false");
  queue("setworldspawn 4 68 2");
  queue("tickingarea add -80 0 -80 79 0 79 quinn_cayman_build true");

  // Build the sea first, then replace its center with a solid island.
  queueFill(-80, 57, -80, 79, 57, 79, "sandstone");
  queueFill(-80, 58, -80, 79, 64, 79, "water");
  queueFill(-68, 58, -68, 68, 64, 68, "sandstone");
  queueFill(-64, 65, -64, 64, 65, 64, "sand");
  queueFill(-58, 66, -58, 58, 66, 58, "grass_block");

  queue("fill -6 66 -64 6 66 64 stone_bricks");
  queue("fill -64 66 20 64 66 23 stone_bricks");
  queue("fill 30 66 -2 66 66 2 stone_bricks");
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
  queueFill(-80, 58, -80, 79, 58, 79, "seagrass", "replace water");

  buildHotel();
  buildShop(34, -20, "brick_block", "red_concrete");
  buildShop(45, -20, "oak_planks", "green_concrete");
  buildShop(56, -20, "cyan_concrete", "blue_concrete");
  buildHouse(-54, 24, "oak_planks", "dark_oak_planks");
  buildHouse(-42, 24, "birch_planks", "spruce_planks");
  buildHouse(36, 24, "spruce_planks", "red_concrete");
  buildHouse(48, 24, "acacia_planks", "orange_concrete");

  for (const [x, z] of PALMS) {
    buildPalm(x, z);
  }

  queue("tickingarea remove quinn_cayman_build");
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomBeachLocation() {
  return {
    x: randomBetween(-58, 58),
    y: 67,
    z: randomBetween(-58, 58),
  };
}

function randomShallowWaterLocation() {
  const side = Math.floor(Math.random() * 4);
  const edge = randomBetween(-58, 58);

  if (side === 0) {
    return { x: edge, y: 63, z: randomBetween(70, 78) };
  }

  if (side === 1) {
    return { x: edge, y: 63, z: randomBetween(-78, -70) };
  }

  if (side === 2) {
    return { x: randomBetween(70, 78), y: 63, z: edge };
  }

  return { x: randomBetween(-78, -70), y: 63, z: edge };
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
  refillNamedAnimals(overworld, "Sting Ray", STINGRAY_ID, STINGRAY_COUNT, randomShallowWaterLocation);
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
  if (hasTag(player, STARTED_TAG) && !hasTag(player, BUILD_TAG)) {
    tryPlayerCommand(player, `tag @s remove ${STARTED_TAG}`);
  }

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
    player.addTag(BUILD_TAG);
    player.runCommand("time set day");
    player.runCommand("weather clear");
  } catch (error) {
    player.runCommand(`tp @s ${HOTEL_ROOM.x} ${HOTEL_ROOM.y} ${HOTEL_ROOM.z}`);
    player.runCommand(`tag @s add ${STARTED_TAG}`);
    player.runCommand(`tag @s add ${BUILD_TAG}`);
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
