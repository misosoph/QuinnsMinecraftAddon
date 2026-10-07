import { world, system, ItemStack, EquipmentSlot } from "@minecraft/server";

const PREFIX = "quinns_redstone_fun:redstone_";
const ANVILS = new Set(["minecraft:anvil", "minecraft:chipped_anvil", "minecraft:damaged_anvil"]);
const PIECES = new Set(["helmet", "chestplate", "leggings", "boots"]);
const ARMOR_SLOTS = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet];
const pendingConversions = new Set();
const RANGE = 4;
const offsets = [];
for (let x = -RANGE; x <= RANGE; x++) {
  for (let y = -RANGE; y <= RANGE; y++) {
    for (let z = -RANGE; z <= RANGE; z++) {
      if (x * x + y * y + z * z <= RANGE * RANGE) offsets.push({ x, y, z });
    }
  }
}
offsets.sort((a, b) => a.x * a.x + a.y * a.y + a.z * a.z - b.x * b.x - b.y * b.y - b.z * b.z);

function diamondPiece(typeId) {
  const piece = typeId?.replace("minecraft:diamond_", "");
  return typeId?.startsWith("minecraft:diamond_") && PIECES.has(piece) ? piece : undefined;
}

function convertArmor(player, slot, piece, dimension, location) {
  // Read live inputs on the next tick; a moved item or removed anvil cancels safely.
  if (!ANVILS.has(dimension.getBlock(location)?.typeId)) return;
  if (!player.isSneaking || player.selectedSlotIndex !== slot) return;
  const inventory = player.getComponent("minecraft:inventory")?.container;
  const source = inventory?.getItem(slot);
  if (!source || diamondPiece(source.typeId) !== piece) return;
  let comparatorSlot = -1;
  for (let index = 0; index < inventory.size; index++) {
    if (inventory.getItem(index)?.typeId === "minecraft:comparator") {
      comparatorSlot = index;
      break;
    }
  }
  if (comparatorSlot < 0) {
    player.sendMessage("Redstone Fun: Carry a redstone comparator to upgrade this armor.");
    return;
  }

  // Finish preparing the result before consuming either ingredient.
  const result = new ItemStack(PREFIX + piece, 1);
  if (source.nameTag) result.nameTag = source.nameTag;
  result.setLore(source.getLore());
  const enchants = source.getComponent("minecraft:enchantable")?.getEnchantments() ?? [];
  if (enchants.length) result.getComponent("minecraft:enchantable").addEnchantments(enchants);
  const oldDurability = source.getComponent("minecraft:durability");
  const newDurability = result.getComponent("minecraft:durability");
  if (oldDurability && newDurability) {
    newDurability.damage = Math.min(8999, Math.floor(oldDurability.damage / oldDurability.maxDurability * 9000));
  }
  const comparator = inventory.getItem(comparatorSlot);
  const remainder = comparator.amount > 1 ? comparator.clone() : undefined;
  if (remainder) remainder.amount -= 1;
  inventory.setItem(comparatorSlot, remainder);
  try {
    inventory.setItem(slot, result);
  } catch (error) {
    inventory.setItem(comparatorSlot, comparator);
    throw error;
  }
  player.sendMessage(`Redstone Fun: Upgraded your diamond ${piece} using one comparator!`);
}

world.beforeEvents.playerInteractWithBlock.subscribe(event => {
  if (!event.player.isSneaking || !ANVILS.has(event.block.typeId)) return;
  const piece = diamondPiece(event.itemStack?.typeId);
  if (!piece) return;
  event.cancel = true;
  if (!event.isFirstEvent || pendingConversions.has(event.player.id)) return;
  const player = event.player;
  const slot = player.selectedSlotIndex;
  const dimension = event.block.dimension;
  const location = { ...event.block.location };
  pendingConversions.add(player.id);
  system.run(() => {
    try {
      convertArmor(player, slot, piece, dimension, location);
    } catch (error) {
      console.warn(`[Redstone Fun] Armor conversion failed: ${error}`);
    } finally {
      pendingConversions.delete(player.id);
    }
  });
});

function nearPoweredRedstone(player) {
  // A four-block sphere centered on the block containing the player's torso.
  const origin = { x: Math.floor(player.location.x), y: Math.floor(player.location.y + 1), z: Math.floor(player.location.z) };
  for (const offset of offsets) {
    try {
      const block = player.dimension.getBlock({ x: origin.x + offset.x, y: origin.y + offset.y, z: origin.z + offset.z });
      if ((block?.getRedstonePower() ?? 0) > 0) return true;
    } catch {
      // World-height boundaries and unloaded chunks aren't powered blocks.
    }
  }
  return false;
}

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      const equipment = player.getComponent("minecraft:equippable");
      const wearingArmor = equipment && ARMOR_SLOTS.some(slot => {
        const item = equipment.getEquipment(slot);
        return item?.typeId.startsWith(PREFIX) && PIECES.has(item.typeId.slice(PREFIX.length));
      });
      if (!wearingArmor || !nearPoweredRedstone(player)) continue;
      const effect = player.getEffect("speed");
      // Leave stronger effects and long-lasting Speed II potions intact.
      if (effect && (effect.amplifier > 1 || (effect.amplifier === 1 && effect.duration > 20))) continue;
      player.addEffect("speed", 20, { amplifier: 1, showParticles: false });
    } catch (error) {
      console.warn(`[Redstone Fun] Speed scan failed: ${error}`);
    }
  }
}, 10);
