import { world, system, EquipmentSlot } from "@minecraft/server";

const armorEquipment = new Map([
  ["quinns_redstone_fun:redstone_helmet", EquipmentSlot.Head],
  ["quinns_redstone_fun:redstone_chestplate", EquipmentSlot.Chest],
  ["quinns_redstone_fun:redstone_leggings", EquipmentSlot.Legs],
  ["quinns_redstone_fun:redstone_boots", EquipmentSlot.Feet],
]);

function equipFromInventory(player, index, expectedId) {
  const inventory = player.getComponent("minecraft:inventory")?.container;
  const equipment = player.getComponent("minecraft:equippable");
  const armor = inventory?.getItem(index);
  if (!equipment || armor?.typeId !== expectedId || !armorEquipment.has(expectedId)) return false;
  const slot = armorEquipment.get(expectedId);
  const previous = equipment.getEquipment(slot);
  // Swap the original stacks so names, damage and enchantments survive.
  inventory.setItem(index, previous);
  try {
    if (!equipment.setEquipment(slot, armor)) throw new Error("Equipment slot rejected armor");
  } catch (error) {
    inventory.setItem(index, armor);
    throw error;
  }
  return true;
}

world.afterEvents.itemUse.subscribe(event => {
  const expectedId = event.itemStack?.typeId;
  if (!armorEquipment.has(expectedId)) return;
  const player = event.source;
  const index = player.selectedSlotIndex;
  system.run(() => {
    try {
      const equipment = player.getComponent("minecraft:equippable");
      // Native equip may already have succeeded. Do not swap it back again.
      if (equipment?.getEquipment(armorEquipment.get(expectedId))?.typeId === expectedId) return;
      if (player.selectedSlotIndex === index) equipFromInventory(player, index, expectedId);
    } catch (error) { console.warn(`[Redstone Fun] Could not equip armor: ${error}`); }
  });
});

system.afterEvents.scriptEventReceive.subscribe(event => {
  if (event.id !== "quinns_redstone_fun:wear" || event.sourceEntity?.typeId !== "minecraft:player") return;
  const player = event.sourceEntity;
  try {
    const inventory = player.getComponent("minecraft:inventory")?.container;
    const equipment = player.getComponent("minecraft:equippable");
    if (!inventory || !equipment) return;
    let equipped = 0;
    for (const [id, slot] of armorEquipment) {
      if (equipment.getEquipment(slot)?.typeId === id) continue;
      for (let index = 0; index < inventory.size; index++) {
        if (inventory.getItem(index)?.typeId === id && equipFromInventory(player, index, id)) {
          equipped++;
          break;
        }
      }
    }
    player.sendMessage(`Redstone Fun: Equipped ${equipped} armor pieces from your inventory. Previous armor was returned to the inventory.`);
  } catch (error) { console.warn(`[Redstone Fun] Could not equip armor kit: ${error}`); }
});
