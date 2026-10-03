import { world, system, ItemTypes, ItemStack, EnchantmentTypes } from "@minecraft/server";

const DIRT_BLOCKS = new Set(["minecraft:dirt", "minecraft:grass_block", "minecraft:grass", "minecraft:coarse_dirt", "minecraft:rooted_dirt", "minecraft:dirt_with_roots"]);
let itemTypes;
let enchantmentTypes;

function pick(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function randomItem() {
  // Read the installed game's registry instead of maintaining a small prize list.
  // Air has no collectible item. Some internal entries cannot form ItemStacks.
  itemTypes ??= ItemTypes.getAll().filter(type => type.id.startsWith("minecraft:") && type.id !== "minecraft:air").filter(type => {
    try { return new ItemStack(type, 1).typeId === type.id; } catch { return false; }
  });
  const item = new ItemStack(pick(itemTypes), 1);
  const enchantable = item.getComponent("minecraft:enchantable");
  if (enchantable && Math.random() < 0.5) {
    enchantmentTypes ??= EnchantmentTypes.getAll();
    const compatible = enchantmentTypes.filter(type => enchantable.canAddEnchantment({ type, level: 1 }));
    if (compatible.length) {
      const type = pick(compatible);
      enchantable.addEnchantment({ type, level: 1 + Math.floor(Math.random() * type.maxLevel) });
    }
  }
  return item;
}

world.afterEvents.playerBreakBlock.subscribe(event => {
  if (!DIRT_BLOCKS.has(event.brokenBlockPermutation.type.id)) return;
  const dimension = event.dimension;
  const { x, y, z } = event.block.location;
  const location = { x: x + 0.5, y: y + 0.5, z: z + 0.5 };
  system.run(() => {
    try {
      const roll = Math.random();
      if (roll < 0.2) {
        const table = roll < 0.1 ? "potions" : "enchanted";
        dimension.runCommand(`loot spawn ${location.x} ${location.y} ${location.z} loot "quinns/mine_some_dirt_${table}"`);
      } else {
        dimension.spawnItem(randomItem(), location);
      }
    } catch (error) {
      console.warn(`[Mine Some Dirt] Could not create random loot: ${error}`);
      // Never leave a broken dirt block without its bonus prize on an API failure.
      dimension.spawnItem(new ItemStack("minecraft:diamond", 1), location);
    }
  });
});
