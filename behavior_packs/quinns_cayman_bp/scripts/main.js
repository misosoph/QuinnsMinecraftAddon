import { system, world } from "@minecraft/server";

const STARTED_TAG = "quinn_cayman_started";
const BUILD_TAG = "quinn_cayman_build_1140";
const FORCE_REBUILD_TAG = "quinn_cayman_force_rebuild";
const ANIMAL_TAG = "quinn_cayman_animal";
const STAFF_TAG = "quinn_cayman_staff";
const STAFF_SPAWNED_PROPERTY = "quinn_cayman:staff_spawned_1140";
const DOG_TAG = "quinn_cayman_dog";
const LIZARD_ID = "quinns_cayman:lizard";
const STINGRAY_ID = "quinns_cayman:stingray";
const STINGRAY_COUNT = 48;
const CENTER = { x: 0, y: 66, z: 0 };
const HOTEL_ROOM = { x: 5.5, y: 68, z: -19.5 };
const DOG_SPAWN = { x: 9.5, y: 67, z: -17.5 };
const HOTEL_BOUNDS = { minX: -39, maxX: 39, minZ: -31, maxZ: 30 };
const POPULATION_RADIUS = 110;
const welcomedPlayers = new Set();
let commandQueue = [];
let resortBuilt = false;
let staffSpawnedThisSession = false;

const STAFF = [
  { name: "Front Desk Worker", x: 6.5, y: 67, z: 0.5 },
  { name: "Restaurant Chef", x: -28.5, y: 67, z: -9.5 },
  { name: "Hotel Cleaner", x: 17.5, y: 67, z: -18.5 },
  { name: "Beach Tour Guide", x: 22.5, y: 67, z: 25.5 },
  { name: "Island Market Seller", x: 49.5, y: 67, z: -43.5 },
];

const PALMS = [
  [-48, -32],
  [-46, 32],
  [46, -32],
  [46, 32],
  [-18, 44],
  [18, 44],
  [48, 8],
  [-48, 8],
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
  queueFill(-38, 58, -30, 38, 65, 30, "sandstone");
  queueFill(-38, 66, -30, 38, 66, 30, "grass_block");

  // Remove the previous hotel before constructing the taller shell.
  queueFill(-35, 67, -27, 35, 95, 23, "air");
  queueFill(-36, 66, -28, 36, 66, 24, "smooth_quartz");
  queueFill(-36, 96, -28, 36, 96, 24, "quartz_block");
  queueFill(-36, 67, -28, -36, 95, 24, "smooth_quartz");
  queueFill(36, 67, -28, 36, 95, 24, "smooth_quartz");
  queueFill(-35, 67, -28, 35, 95, -28, "smooth_quartz");
  queueFill(-35, 67, 24, 35, 95, 24, "smooth_quartz");

  // Four upper floors surround a five-storey-high open lobby.
  for (const floorY of [72, 78, 84, 90]) {
    queueFill(-35, floorY, -27, 35, floorY, 23, "birch_planks");
  }

  queueFill(-21, 67, 2, 21, 95, 22, "air");
  queueFill(-22, 66, 0, 22, 66, 22, "polished_andesite");

  // Six guest rooms on each upper floor provide 24 rooms in total.
  const guestRoomDoorX = [-29, -17, -5, 7, 19, 30];

  for (const floorY of [72, 78, 84, 90]) {
    queueFill(-35, floorY + 1, -6, 35, floorY + 5, -6, "smooth_quartz");

    for (const partitionX of [-23, -11, 1, 13, 25]) {
      queueFill(partitionX, floorY + 1, -27, partitionX, floorY + 5, -6, "smooth_quartz");
    }

    for (const doorX of guestRoomDoorX) {
      queue(`fill ${doorX - 3} ${floorY + 2} -28 ${doorX + 3} ${floorY + 4} -28 glass`);
      queue(`setblock ${doorX - 3} ${floorY + 1} -23 red_bed [\"direction\"=2]`);
      queue(`setblock ${doorX - 2} ${floorY + 1} -23 red_bed [\"direction\"=2,\"head_piece_bit\"=true]`);
      queue(`setblock ${doorX + 3} ${floorY + 1} -23 chest [\"minecraft:cardinal_direction\"=\"south\"]`);
      queue(`fill ${doorX + 1} ${floorY + 1} -14 ${doorX + 4} ${floorY + 1} -14 dark_oak_planks`);
      queue(`setblock ${doorX + 2} ${floorY + 1} -16 spruce_stairs [\"weirdo_direction\"=2]`);
      queue(`setblock ${doorX - 1} ${floorY + 1} -18 spruce_stairs [\"weirdo_direction\"=1]`);
      queue(`setblock ${doorX + 4} ${floorY + 1} -20 barrel`);
      queue(`setblock ${doorX + 4} ${floorY + 2} -20 barrel`);
      queue(`setblock ${doorX} ${floorY + 6} -16 sea_lantern`);
    }
  }

  // Continuous hallways connect every guest-room door to both stair wings.
  for (const floorY of [72, 78, 84, 90]) {
    queueFill(-35, floorY, -5, 35, floorY, 1, "polished_andesite");
    queueFill(-35, floorY, 0, -22, floorY, 20, "polished_andesite");
    queueFill(22, floorY, 0, 35, floorY, 20, "polished_andesite");

    for (const torchX of [-32, -20, -8, 8, 20, 32]) {
      queue(`setblock ${torchX} ${floorY + 1} 0 torch`);
    }

    for (const torchX of [-26, -14, -2, 14, 26]) {
      queue(`setblock ${torchX} ${floorY + 1} -4 torch`);
    }

    for (const sideX of [-34, -24, 24, 34]) {
      for (const torchZ of [4, 12, 20]) {
        queue(`setblock ${sideX} ${floorY + 1} ${torchZ} torch`);
      }
    }
  }

  // Matching stair flights connect floors 2-5 from both sides of the atrium.
  for (const [floorY, stairStartZ] of [
    [72, 5],
    [78, 13],
    [84, 5],
  ]) {
    for (const [minX, maxX] of [
      [-32, -30],
      [30, 32],
    ]) {
      queueFill(minX, floorY + 1, stairStartZ, maxX, floorY + 6, stairStartZ + 5, "air");

      for (let step = 0; step < 6; step++) {
        const stairZ = stairStartZ + step;
        queueFill(minX, floorY, stairZ, maxX, floorY + step, stairZ, "smooth_quartz");
      }

      queue(`setblock ${minX} ${floorY + 1} ${stairStartZ - 1} torch`);
      queue(`setblock ${maxX} ${floorY + 1} ${stairStartZ - 1} torch`);
      queue(`setblock ${minX} ${floorY + 7} ${stairStartZ + 6} torch`);
      queue(`setblock ${maxX} ${floorY + 7} ${stairStartZ + 6} torch`);
    }
  }

  const windowLevels = [68, 74, 80, 86, 92];
  const wideWindowStarts = [-32, -19, -6, 7, 20];
  const sideWindowStarts = [-24, -13, -2, 9];

  for (const windowY of windowLevels) {
    for (const windowX of wideWindowStarts) {
      queue(`fill ${windowX} ${windowY} -28 ${windowX + 9} ${windowY + 2} -28 glass`);

      if (windowY > 68 || windowX !== -6) {
        queue(`fill ${windowX} ${windowY} 24 ${windowX + 9} ${windowY + 2} 24 glass`);
      }
    }

    for (const windowZ of sideWindowStarts) {
      queue(`fill -36 ${windowY} ${windowZ} -36 ${windowY + 2} ${windowZ + 8} glass`);
      queue(`fill 36 ${windowY} ${windowZ} 36 ${windowY + 2} ${windowZ + 8} glass`);
    }
  }

  // Atrium columns and balcony rails frame the full-height lobby.
  for (const [columnX, columnZ] of [
    [-22, 1],
    [22, 1],
    [-22, 23],
    [22, 23],
  ]) {
    queue(`fill ${columnX} 67 ${columnZ} ${columnX} 95 ${columnZ} smooth_quartz`);
  }

  for (const railingY of [73, 79, 85, 91]) {
    queue(`fill -21 ${railingY} 1 21 ${railingY} 1 dark_oak_fence`);
    queue(`fill -21 ${railingY} 23 21 ${railingY} 23 dark_oak_fence`);
    queue(`fill -22 ${railingY} 2 -22 ${railingY} 22 dark_oak_fence`);
    queue(`fill 22 ${railingY} 2 22 ${railingY} 22 dark_oak_fence`);
  }

  // A split grand staircase connects the lobby to the first balcony.
  for (let step = 0; step < 6; step++) {
    const stairY = 67 + step;
    const leftStart = -3 - step * 3;
    const rightStart = 1 + step * 3;
    queue(`fill ${leftStart - 2} ${stairY} 5 ${leftStart} ${stairY} 9 smooth_quartz`);
    queue(`fill ${rightStart} ${stairY} 5 ${rightStart + 2} ${stairY} 9 smooth_quartz`);
  }

  queue("fill -22 72 5 -16 72 9 smooth_quartz");
  queue("fill 16 72 5 22 72 9 smooth_quartz");
  queue("fill -22 73 5 -22 73 9 air");
  queue("fill 22 73 5 22 73 9 air");
  queue("fill 0 84 12 0 95 12 chain");
  queue("fill -2 82 12 2 82 12 sea_lantern");
  queue("fill 0 82 10 0 82 14 sea_lantern");
  queue("setblock 0 81 12 sea_lantern");
  queue("fill -2 67 3 2 67 20 red_carpet");

  // Reception and a separately enclosed restaurant occupy the ground-floor wings.
  queue("fill 3 67 -1 11 67 1 dark_oak_planks");
  queue("setblock 6 68 0 lectern");
  queue("fill -22 67 -16 -22 71 0 smooth_quartz");
  queue("fill -35 67 -16 -22 71 -16 smooth_quartz");
  queue("setblock -22 67 -4 dark_oak_door [\"direction\"=1]");
  queue("setblock -22 68 -4 dark_oak_door [\"direction\"=1,\"upper_block_bit\"=true]");
  queue("fill -22 68 -13 -22 70 -7 glass");
  queue("setblock -31 67 -12 smoker");
  queue("setblock -29 67 -12 cauldron");
  queue("fill -31 67 -7 -23 67 -7 spruce_stairs [\"weirdo_direction\"=2]");
  queue("fill -30 67 -3 -24 67 -3 oak_fence");

  // An eight-storey entrance tower rises above the main hotel roof.
  queue("fill -4 67 24 4 74 24 air");
  queueFill(-6, 66, 24, 6, 66, 28, "polished_andesite");
  queueFill(-7, 67, 24, -7, 114, 28, "smooth_quartz");
  queueFill(7, 67, 24, 7, 114, 28, "smooth_quartz");
  queueFill(-6, 67, 28, 6, 113, 28, "glass");
  queueFill(-6, 96, 24, 6, 114, 24, "glass");
  queueFill(-6, 115, 23, 6, 115, 29, "quartz_block");

  for (const bandY of [73, 79, 85, 91, 97, 103, 109, 114]) {
    queue(`fill -6 ${bandY} 28 6 ${bandY} 28 gold_block`);
  }

  for (const sideWindowY of [68, 74, 80, 86, 92, 98, 104, 110]) {
    queue(`fill -7 ${sideWindowY} 25 -7 ${sideWindowY + 3} 27 glass`);
    queue(`fill 7 ${sideWindowY} 25 7 ${sideWindowY + 3} 27 glass`);
  }

  queue("setblock -1 67 28 dark_oak_door [\"direction\"=0]");
  queue("setblock -1 68 28 dark_oak_door [\"direction\"=0,\"upper_block_bit\"=true]");
  queue("setblock 0 67 28 dark_oak_door [\"direction\"=0]");
  queue("setblock 0 68 28 dark_oak_door [\"direction\"=0,\"upper_block_bit\"=true]");

  // Quinn's room remains private inside the rear ground-floor wing.
  queue("fill 0 66 -26 14 72 -12 smooth_quartz hollow");
  queue("fill 1 66 -25 13 66 -13 birch_planks");
  queue("fill 1 67 -25 13 71 -13 air");
  queue("fill 3 68 -26 11 70 -26 glass");
  queue("setblock 4 67 -23 red_bed [\"direction\"=2]");
  queue("setblock 5 67 -23 red_bed [\"direction\"=2,\"head_piece_bit\"=true]");
  queue("setblock 10 67 -23 chest [\"minecraft:cardinal_direction\"=\"south\"]");
  queue("setblock 12 67 -14 crafting_table");
  queue("fill 2 67 -15 5 67 -15 dark_oak_planks");
  queue("setblock 3 67 -17 spruce_stairs [\"weirdo_direction\"=2]");
  queue("setblock 9 67 -21 spruce_stairs [\"weirdo_direction\"=1]");
  queue("setblock 11 67 -19 barrel");
  queue("setblock 11 68 -19 barrel");
  queue("setblock 7 67 -12 oak_door [\"direction\"=0]");
  queue("setblock 7 68 -12 oak_door [\"direction\"=0,\"upper_block_bit\"=true]");

  // Place guest-room doors last so later wall, hallway, and stair work cannot cover them.
  for (const floorY of [72, 78, 84, 90]) {
    for (const doorX of guestRoomDoorX) {
      queue(`setblock ${doorX} ${floorY + 1} -6 dark_oak_door [\"direction\"=0]`);
      queue(`setblock ${doorX} ${floorY + 2} -6 dark_oak_door [\"direction\"=0,\"upper_block_bit\"=true]`);
    }
  }

  queue("setblock 7 67 -12 oak_door [\"direction\"=0]");
  queue("setblock 7 68 -12 oak_door [\"direction\"=0,\"upper_block_bit\"=true]");

  for (const [torchX, torchZ] of [
    [-18, 4],
    [-18, 12],
    [-18, 20],
    [-10, 4],
    [-10, 12],
    [-10, 20],
    [10, 4],
    [10, 12],
    [10, 20],
    [18, 4],
    [18, 12],
    [18, 20],
    [-6, 22],
    [6, 22],
    [-12, 0],
    [12, 0],
    [-33, -14],
    [-24, -14],
    [-33, -2],
    [2, -24],
    [12, -24],
    [2, -13],
    [-4, 26],
    [4, 26],
  ]) {
    queue(`setblock ${torchX} 67 ${torchZ} torch`);
  }
}

function buildShop(x, z, wall, roof) {
  queueFill(x - 1, 58, z - 1, x + 9, 65, z + 9, "sandstone");
  queueFill(x - 1, 66, z - 1, x + 9, 66, z + 9, "grass_block");
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
  queueFill(x - 1, 58, z - 1, x + 9, 65, z + 9, "sandstone");
  queueFill(x - 1, 66, z - 1, x + 9, 66, z + 9, "grass_block");
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

function buildBeachStand() {
  queueFill(-32, 58, 31, -18, 65, 40, "sandstone");
  queueFill(-32, 66, 31, -18, 66, 40, "sand");
  queueFill(-30, 66, 32, -20, 66, 38, "yellow_concrete");
  queueFill(-30, 67, 32, -20, 70, 38, "white_concrete", "hollow");
  queueFill(-31, 71, 31, -19, 71, 39, "yellow_concrete");
  queue("fill -29 68 38 -27 69 38 glass");
  queue("fill -23 68 38 -21 69 38 glass");
  queue("setblock -25 67 35 chest");
  queue("setblock -29 70 33 lantern");
  queue("setblock -25 67 40 bell");
  queue("setblock -25 67 38 oak_door [\"direction\"=0]");
  queue("setblock -25 68 38 oak_door [\"direction\"=0,\"upper_block_bit\"=true]");
}

function ensureExteriorDoors() {
  for (const [doorX, doorZ] of [
    [38, -44],
    [49, -44],
    [60, -44],
    [-50, 52],
    [-38, 52],
    [40, 52],
    [52, 52],
    [-25, 38],
  ]) {
    queue(`setblock ${doorX} 67 ${doorZ} oak_door [\"direction\"=0]`);
    queue(`setblock ${doorX} 68 ${doorZ} oak_door [\"direction\"=0,\"upper_block_bit\"=true]`);
  }
}

function buildResort() {
  if (resortBuilt) {
    return;
  }

  resortBuilt = true;
  staffSpawnedThisSession = false;

  try {
    world.setDynamicProperty(STAFF_SPAWNED_PROPERTY, false);
  } catch (error) {
    console.warn("Could not reset the Cayman staff spawn marker.");
  }

  queue("gamerule mobgriefing false");
  queue("gamerule doMobSpawning false");
  queue("difficulty peaceful");
  queue("setworldspawn 5 68 -19");
  queue("kill @e[tag=quinn_cayman_staff]");
  queue("kill @e[tag=quinn_cayman_dog]");
  queue("tickingarea add -80 0 -80 79 0 79 quinn_cayman_build true");

  // Clear the prior resort so old trees and structures cannot remain on the new beach.
  queueFill(-68, 67, -68, 68, 116, 68, "air");

  // Build the sea first, then replace its center with a solid island.
  queueFill(-80, 57, -80, 79, 57, 79, "sandstone");
  queueFill(-80, 58, -80, 79, 64, 79, "water");
  queueFill(-68, 58, -68, 68, 64, 68, "sandstone");
  queueFill(-68, 64, -68, 68, 64, 68, "sand");
  queueFill(-64, 65, -64, 64, 65, 64, "sand");
  queueFill(-58, 66, -58, 58, 66, 58, "sand");
  queueFill(-50, 66, -50, 50, 66, 50, "grass_block");

  queue("fill -6 66 -64 6 66 64 stone_bricks");
  queue("fill -64 66 20 64 66 23 stone_bricks");
  queue("fill 30 66 -2 66 66 2 stone_bricks");
  queue("fill 30 66 -52 32 66 -2 stone_bricks");
  queue("fill 30 66 -43 66 66 -41 stone_bricks");
  queue("fill -64 66 54 64 66 56 stone_bricks");
  queue("fill 60 65 6 70 65 10 oak_planks");
  queue("fill 70 64 6 78 64 10 oak_planks");
  queue("fill 61 66 7 69 66 7 oak_fence");
  queue("fill 61 66 9 69 66 9 oak_fence");
  queue("setblock 64 66 8 lantern");
  queue("setblock 68 66 8 lantern");
  queue("fill -36 65 -8 -16 65 -6 stone_bricks");
  queue("fill -16 65 -6 20 65 -4 stone_bricks");
  queue("fill 20 65 -4 31 65 7 stone_bricks");
  queueFill(-80, 58, -80, 79, 58, 79, "seagrass", "replace water");

  buildHotel();
  buildShop(34, -52, "brick_block", "red_concrete");
  buildShop(45, -52, "oak_planks", "green_concrete");
  buildShop(56, -52, "cyan_concrete", "blue_concrete");
  buildHouse(-54, 44, "oak_planks", "dark_oak_planks");
  buildHouse(-42, 44, "birch_planks", "spruce_planks");
  buildHouse(36, 44, "spruce_planks", "red_concrete");
  buildHouse(48, 44, "acacia_planks", "orange_concrete");
  buildBeachStand();

  for (const [x, z] of PALMS) {
    buildPalm(x, z);
  }

  ensureExteriorDoors();
  queue("tickingarea remove quinn_cayman_build");
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function isInsideHotel(location) {
  return (
    location.x >= HOTEL_BOUNDS.minX &&
    location.x <= HOTEL_BOUNDS.maxX &&
    location.z >= HOTEL_BOUNDS.minZ &&
    location.z <= HOTEL_BOUNDS.maxZ
  );
}

function randomBeachLocation() {
  for (let attempt = 0; attempt < 24; attempt++) {
    const location = {
      x: randomBetween(-58, 58),
      y: 67,
      z: randomBetween(-58, 58),
    };

    if (!isInsideHotel(location)) {
      return location;
    }
  }

  return { x: -50, y: 67, z: -40 };
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

function spawnStaffOnce(dimension) {
  if (staffSpawnedThisSession) {
    return;
  }

  try {
    if (world.getDynamicProperty(STAFF_SPAWNED_PROPERTY) === true) {
      staffSpawnedThisSession = true;
      return;
    }
  } catch (error) {
    console.warn("Could not read the Cayman staff spawn marker.");
  }

  let existingStaff = [];

  try {
    existingStaff = dimension.getEntities({ tags: [STAFF_TAG] });
  } catch (error) {
    console.warn("Could not check existing Cayman staff.");
  }

  if (existingStaff.length === 0) {
    for (const staff of STAFF) {
      spawnNamedEntity(dimension, "minecraft:villager", staff.name, { x: staff.x, y: staff.y, z: staff.z }, STAFF_TAG);
    }
  }

  staffSpawnedThisSession = true;

  try {
    world.setDynamicProperty(STAFF_SPAWNED_PROPERTY, true);
  } catch (error) {
    console.warn("Could not save the Cayman staff spawn marker.");
  }
}

function moveAnimalsOutsideHotel(dimension) {
  for (const entity of getTaggedEntities(dimension, ANIMAL_TAG)) {
    if (!isInsideHotel(entity.location)) {
      continue;
    }

    try {
      entity.teleport(randomBeachLocation(), { dimension });
    } catch (error) {
      console.warn(`Could not move ${entity.nameTag || "Cayman animal"} out of the hotel.`);
    }
  }
}

function maintainAnimals() {
  if (commandQueue.length > 0) {
    return;
  }

  const overworld = world.getDimension("overworld");
  runCommand(overworld, "gamerule doMobSpawning false");
  runCommand(overworld, "difficulty peaceful");
  moveAnimalsOutsideHotel(overworld);
  refillNamedAnimals(overworld, "Green Lizard", LIZARD_ID, 18, randomBeachLocation);
  refillNamedAnimals(overworld, "Chicken", "minecraft:chicken", 12, randomBeachLocation);
  refillNamedAnimals(overworld, "Sting Ray", STINGRAY_ID, STINGRAY_COUNT, randomShallowWaterLocation);
  refillNamedAnimals(overworld, "Rainbow Fish", "minecraft:tropicalfish", 14, randomShallowWaterLocation);
  spawnStaffOnce(overworld);
}

function giveDog(player) {
  try {
    const dog = player.dimension.spawnEntity("minecraft:wolf", DOG_SPAWN);
    dog.nameTag = "Quinn's Hotel Dog";
    dog.addTag(DOG_TAG);

    if (!tryPlayerCommand(player, `tame @e[type=wolf,tag=${DOG_TAG},c=1]`)) {
      tryPlayerCommand(player, `event entity @e[type=wolf,tag=${DOG_TAG},c=1] minecraft:on_tame`);
      player.sendMessage("Your hotel dog is waiting inside your room. If it is not sitting, give it a bone to finish taming.");
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
