import { world, system, EquipmentSlot, BlockPermutation } from "@minecraft/server";

const SWORD_ID = "quinns_redstone_fun:redstone_sword";
const SOURCE_ID = "quinns_redstone_fun:armor_power_source";
const JOURNAL_KEY = "quinns_redstone_fun:temporary_power";
const DUST_ID = "minecraft:redstone_wire";
const MIN_CIRCUIT = 100;
const MAX_CIRCUIT = 16384;
const MAX_SOURCES = 128;
const armorIds = new Set(["helmet", "chestplate", "leggings", "boots"].map(piece => "quinns_redstone_fun:redstone_" + piece));
const armorSlots = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet];
const faces = [{ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }, { x: 0, y: -1, z: 0 }];
const horizontal = faces.filter(face => face.y === 0);
const activeSources = new Map();
const pendingDischarges = new Set();
let journalLoaded = false;

function positionKey(position) { return `${position.x},${position.y},${position.z}`; }
function sourceKey(dimension, position) { return `${dimension}:${positionKey(position)}`; }
function addPosition(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function safeBlock(dimension, position) {
  try { return dimension.getBlock(position); } catch { return undefined; }
}
function heldSword(player) {
  return player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand)?.typeId === SWORD_ID;
}
function wearingRedstone(player) {
  const equipment = player.getComponent("minecraft:equippable");
  return equipment && armorSlots.some(slot => armorIds.has(equipment.getEquipment(slot)?.typeId));
}
function redstoneDevice(block) {
  return block && /^(redstone_wire|redstone_block|(?:lit_)?redstone_lamp|(?:unpowered_|powered_)?(?:repeater|comparator)|(?:sticky_)?piston|piston_arm_collision|dispenser|dropper|observer|(?:golden_|powered_|detector_|activator_)?rail|lever|(?:inverted_)?daylight_detector|(?:\w+_)?(?:button|pressure_plate|door|trapdoor)|noteblock)$/.test(block.typeId.replace("minecraft:", ""));
}

function saveJournal() {
  world.setDynamicProperty(JOURNAL_KEY, activeSources.size ? JSON.stringify([...activeSources.values()]) : undefined);
}
function loadJournal() {
  if (journalLoaded) return;
  const saved = world.getDynamicProperty(JOURNAL_KEY);
  if (typeof saved === "string") {
    const entries = JSON.parse(saved);
    for (const entry of entries) {
      if (typeof entry.dimension === "string" && [entry.x, entry.y, entry.z].every(Number.isInteger)) {
        activeSources.set(sourceKey(entry.dimension, entry), entry);
      }
    }
  }
  journalLoaded = true;
}

function powerTouchingDevices(player, wanted) {
  if (!wearingRedstone(player)) return;
  const feet = { x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z) };
  const contacts = [feet, addPosition(feet, { x: 0, y: -1, z: 0 }), addPosition(feet, { x: 0, y: 1, z: 0 })];
  for (const height of [0, 1]) {
    for (const face of horizontal) contacts.push(addPosition(addPosition(feet, face), { x: 0, y: height, z: 0 }));
  }
  const devices = new Map();
  for (const position of contacts) {
    if (!redstoneDevice(safeBlock(player.dimension, position))) continue;
    devices.set(positionKey(position), position);
    // Energize input wire beside directional devices such as repeaters too.
    for (const face of horizontal) {
      const adjacent = addPosition(position, face);
      if (safeBlock(player.dimension, adjacent)?.typeId === DUST_ID) devices.set(positionKey(adjacent), adjacent);
    }
  }
  for (const position of devices.values()) {
    // Supply all available faces so directional devices receive input power.
    // Only air may be replaced. The source has no collision or visible geometry.
    for (const face of faces) {
      const candidate = addPosition(position, face);
      const block = safeBlock(player.dimension, candidate);
      const key = sourceKey(player.dimension.id, candidate);
      if (block?.typeId === SOURCE_ID && activeSources.has(key)) {
        wanted.add(key);
        continue;
      }
      if (block?.typeId !== "minecraft:air" || activeSources.size >= MAX_SOURCES) continue;
      const entry = { dimension: player.dimension.id, ...candidate };
      activeSources.set(key, entry);
      // Persist before changing the world so interrupted sessions can clean up.
      try {
        saveJournal();
        block.setPermutation(BlockPermutation.resolve(SOURCE_ID));
      } catch (error) {
        activeSources.delete(key);
        saveJournal();
        throw error;
      }
      wanted.add(key);
    }
  }
}

function cleanSources(wanted) {
  let changed = false;
  for (const [key, entry] of activeSources) {
    if (wanted.has(key)) continue;
    const block = safeBlock(world.getDimension(entry.dimension), entry);
    if (!block) continue; // Retain unloaded locations and retry after they load.
    if (block.typeId === SOURCE_ID) block.setPermutation(BlockPermutation.resolve("minecraft:air"));
    // A newly placed block belongs to the player and must never be overwritten.
    activeSources.delete(key);
    changed = true;
  }
  if (changed) saveJournal();
}

system.runInterval(() => {
  try {
    loadJournal();
    const wanted = new Set();
    for (const player of world.getAllPlayers()) {
      try { powerTouchingDevices(player, wanted); } catch (error) { console.warn(`[Redstone Fun] Contact power failed: ${error}`); }
    }
    cleanSources(wanted);
  } catch (error) {
    console.warn(`[Redstone Fun] Power cleanup failed: ${error}`);
  }
}, 5);

function wireSpace(block) { return block?.isAir || block?.typeId === SOURCE_ID; }
function connectedDust(dimension, position) {
  const result = [];
  for (const face of horizontal) {
    const beside = addPosition(position, face);
    for (const height of [0, 1, -1]) {
      const candidate = addPosition(beside, { x: 0, y: height, z: 0 });
      if (safeBlock(dimension, candidate)?.typeId !== DUST_ID) continue;
      if (height === 1 && !wireSpace(safeBlock(dimension, addPosition(position, { x: 0, y: 1, z: 0 })))) continue;
      if (height === -1 && !wireSpace(safeBlock(dimension, beside))) continue;
      result.push(candidate);
    }
  }
  return result;
}

function isMob(entity) {
  return entity.typeId !== "minecraft:player" && entity.typeId !== "minecraft:armor_stand" && Boolean(entity.getComponent("minecraft:health"));
}
function mobOnDust(entity, dimension, circuit) {
  const { x, y, z } = entity.location;
  // Feet can be at wire height (1/16 of a block) or exactly at the next block edge.
  for (const height of [Math.floor(y), Math.floor(y - 0.1)]) {
    const position = { x: Math.floor(x), y: height, z: Math.floor(z) };
    if (circuit.has(positionKey(position)) && safeBlock(dimension, position)?.typeId === DUST_ID) return true;
  }
  return false;
}

function* discharge(player, dimension, start) {
  try {
    if (!heldSword(player) || safeBlock(dimension, start)?.typeId !== DUST_ID) return;
    const queue = [start];
    const circuit = new Set([positionKey(start)]);
    for (let index = 0; index < queue.length; index++) {
      for (const next of connectedDust(dimension, queue[index])) {
        const key = positionKey(next);
        if (circuit.has(key)) continue;
        if (circuit.size >= MAX_CIRCUIT) {
          player.sendMessage(`Redstone sword: This circuit exceeds ${MAX_CIRCUIT} loaded dust. Split it before discharging.`);
          return; // No partial blast on an oversized network.
        }
        circuit.add(key);
        queue.push(next);
      }
      yield;
    }
    if (circuit.size < MIN_CIRCUIT) {
      player.sendMessage(`Redstone sword: ${circuit.size}/${MIN_CIRCUIT} connected dust. Add more dust to discharge!`);
      return;
    }
    // Large jobs may span ticks. A broken wire cancels the whole blast safely.
    for (const position of queue) {
      if (safeBlock(dimension, position)?.typeId !== DUST_ID) {
        player.sendMessage("Redstone sword: The circuit changed during charging. Strike the dust again.");
        return;
      }
      yield;
    }
    let killed = 0;
    for (const entity of dimension.getEntities()) {
      try {
        if (isMob(entity) && mobOnDust(entity, dimension, circuit) && entity.kill()) killed++;
      } catch { /* An entity may despawn while the job is running. */ }
      yield;
    }
    player.sendMessage(`Redstone sword: Discharged through ${circuit.size} dust; defeated ${killed} mobs!`);
  } catch (error) {
    console.warn(`[Redstone Fun] Circuit discharge failed: ${error}`);
  } finally {
    pendingDischarges.delete(player.id);
  }
}

function startDischarge(event) {
  if (event.block.typeId !== DUST_ID || event.itemStack?.typeId !== SWORD_ID) return;
  event.cancel = true; // Preserve the wire when the player strikes it.
  if (event.isFirstEvent === false || pendingDischarges.has(event.player.id)) return;
  const player = event.player;
  const dimension = event.block.dimension;
  const location = { ...event.block.location };
  pendingDischarges.add(player.id);
  system.run(() => {
    try { system.runJob(discharge(player, dimension, location)); }
    catch (error) { pendingDischarges.delete(player.id); console.warn(`[Redstone Fun] Could not schedule discharge: ${error}`); }
  });
}

world.beforeEvents.playerInteractWithBlock.subscribe(startDischarge);
world.beforeEvents.playerBreakBlock.subscribe(startDischarge);
world.afterEvents.entityHitBlock.subscribe(event => {
  if (event.damagingEntity.typeId !== "minecraft:player" || !heldSword(event.damagingEntity)) return;
  startDischarge({ player: event.damagingEntity, block: event.hitBlock, itemStack: { typeId: SWORD_ID } });
});
world.afterEvents.entityHitEntity.subscribe(event => {
  try {
    if (event.damagingEntity.typeId === "minecraft:player" && heldSword(event.damagingEntity) && isMob(event.hitEntity)) event.hitEntity.kill();
  } catch (error) { console.warn(`[Redstone Fun] Sword strike failed: ${error}`); }
});
