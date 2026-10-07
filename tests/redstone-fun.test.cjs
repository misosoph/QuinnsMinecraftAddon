const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const bp = "behavior_packs/quinns_redstone_fun_bp";
const rp = "resource_packs/quinns_redstone_fun_rp";
const pieces = ["helmet", "chestplate", "leggings", "boots"];
const prefix = "quinns_redstone_fun:redstone_";
const definitions = Object.fromEntries(pieces.map(piece => [prefix + piece,
  JSON.parse(fs.readFileSync(`${bp}/items/redstone_${piece}.json`))["minecraft:item"].components]));

class ItemStack {
  constructor(typeId, amount = 1) {
    this.typeId = typeId;
    this.amount = amount;
    this.lore = [];
    this.enchantments = [];
    this.durability = { damage: 0, maxDurability: definitions[typeId]?.["minecraft:durability"].max_durability ?? 400 };
  }
  getLore() { return this.lore; }
  setLore(lore) { this.lore = [...lore]; }
  clone() { return Object.assign(new ItemStack(this.typeId, this.amount), this); }
  getComponent(id) {
    if (id === "minecraft:durability") return this.durability;
    if (id === "minecraft:enchantable") return {
      getEnchantments: () => this.enchantments,
      addEnchantments: values => { this.enchantments = [...values]; },
    };
  }
}

function setup() {
  let interaction, interval;
  const queue = [];
  const items = Array(10);
  const inventory = { size: items.length, getItem: slot => items[slot], setItem: (slot, item) => { items[slot] = item; } };
  const equipment = {};
  const effects = [];
  let existingEffect;
  let powered = true;
  let poweredX = 4;
  let anvilPresent = true;
  const dimension = { getBlock: location => {
    if (location.x === 99) return { typeId: anvilPresent ? "minecraft:anvil" : "minecraft:air" };
    return { getRedstonePower: () => powered && location.x === poweredX && location.y === 1 && location.z === 0 ? 15 : 0 };
  } };
  const player = {
    id: "quinn", isSneaking: true, selectedSlotIndex: 0, location: { x: 0, y: 0, z: 0 }, dimension,
    getComponent: id => id === "minecraft:inventory" ? { container: inventory } : { getEquipment: slot => equipment[slot] },
    sendMessage: () => {}, getEffect: () => existingEffect, addEffect: (...args) => effects.push(args),
  };
  vm.runInNewContext(fs.readFileSync(`${bp}/scripts/main.js`, "utf8").replace(/^import .*;\r?\n/gm, ""), {
    ItemStack, EquipmentSlot: { Head: "Head", Chest: "Chest", Legs: "Legs", Feet: "Feet" }, console: { warn: () => {} },
    world: { beforeEvents: { playerInteractWithBlock: { subscribe: fn => { interaction = fn; } } }, getAllPlayers: () => [player] },
    system: { run: fn => queue.push(fn), runInterval: (fn, ticks) => { interval = fn; assert.equal(ticks, 10); } },
  });
  return { items, inventory, player, equipment, effects, interval: () => interval(), setPowered: value => { powered = value; },
    setEffect: value => { existingEffect = value; }, setPoweredX: value => { poweredX = value; }, removeAnvil: () => { anvilPresent = false; },
    interact: (overrides = {}) => {
      const event = { player, itemStack: items[0], isFirstEvent: true, block: { typeId: "minecraft:anvil", dimension, location: { x: 99, y: 0, z: 0 } }, ...overrides };
      interaction(event);
      return event;
    }, flush: () => { while (queue.length) queue.shift()(); },
  };
}

for (const piece of pieces) {
  const components = definitions[prefix + piece];
  assert.equal(components["minecraft:wearable"].protection, 5);
  assert.equal(components["minecraft:durability"].max_durability, 9000);
  const attachable = JSON.parse(fs.readFileSync(`${rp}/attachables/redstone_${piece}.json`))["minecraft:attachable"].description;
  assert.equal(attachable.identifier, prefix + piece);
  assert.equal(attachable.geometry.default, `geometry.humanoid.armor.${piece}`);

  const state = setup();
  const source = new ItemStack("minecraft:diamond_" + piece);
  source.durability.damage = 100;
  source.nameTag = "Quinn's armor";
  source.setLore(["Treasure"]);
  source.enchantments = [{ type: { id: "protection" }, level: 4 }];
  state.items[0] = source;
  state.items[1] = new ItemStack("minecraft:comparator", 2);
  assert.equal(state.interact().cancel, true);
  state.interact(); // Two same-tick interactions must consume just one comparator.
  state.flush();
  assert.equal(state.items[0].typeId, prefix + piece);
  assert.equal(state.items[0].durability.damage, 2250);
  assert.equal(state.items[0].nameTag, source.nameTag);
  assert.deepEqual(state.items[0].lore, source.lore);
  assert.deepEqual(state.items[0].enchantments, source.enchantments);
  assert.equal(state.items[1].amount, 1);
}

for (const reason of ["no comparator", "changed selection", "removed anvil", "button repeat", "not sneaking"]) {
  const state = setup();
  state.items[0] = new ItemStack("minecraft:diamond_helmet");
  if (reason !== "no comparator") state.items[1] = new ItemStack("minecraft:comparator");
  if (reason === "not sneaking") state.player.isSneaking = false;
  state.interact(reason === "button repeat" ? { isFirstEvent: false } : {});
  if (reason === "changed selection") state.player.selectedSlotIndex = 2;
  if (reason === "removed anvil") state.removeAnvil();
  state.flush();
  assert.equal(state.items[0].typeId, "minecraft:diamond_helmet", reason);
  if (reason !== "no comparator") assert.equal(state.items[1].amount, 1, reason);
}

{
  const state = setup();
  state.items[0] = new ItemStack("minecraft:diamond_boots");
  state.items[1] = new ItemStack("minecraft:comparator");
  const setItem = state.inventory.setItem;
  state.inventory.setItem = (slot, item) => { if (slot === 0) throw Error("simulate failed output write"); setItem(slot, item); };
  state.interact(); state.flush();
  assert.equal(state.items[1].amount, 1, "failed output restores comparator");
  assert.equal(state.items[0].typeId, "minecraft:diamond_boots");
}

{
  const state = setup();
  state.interval(); assert.equal(state.effects.length, 0, "inventory armor does not grant speed");
  state.equipment.Head = new ItemStack(prefix + "helmet");
  state.interval(); assert.equal(state.effects.length, 1, "powered block at radius 4 grants speed");
  assert.equal(state.effects[0][0], "speed"); assert.equal(state.effects[0][1], 20); assert.equal(state.effects[0][2].amplifier, 1);
  state.setPowered(false); state.interval(); assert.equal(state.effects.length, 1, "unpowered circuit does not refresh speed");
  state.setPowered(true); state.setPoweredX(5); state.interval(); assert.equal(state.effects.length, 1, "powered block outside radius does not grant speed");
  state.setPoweredX(4); state.setEffect({ amplifier: 3, duration: 500 });
  state.interval(); assert.equal(state.effects.length, 1, "stronger potion remains intact");
  state.setEffect({ amplifier: 1, duration: 500 }); state.interval(); assert.equal(state.effects.length, 1, "long Speed II remains intact");
}

const manifests = [bp, rp].map(pack => JSON.parse(fs.readFileSync(`${pack}/manifest.json`)));
assert.deepEqual(manifests[0].header.version, [2, 0, 0]);
assert.equal(manifests[0].dependencies[1].uuid, manifests[1].header.uuid);
const atlas = JSON.parse(fs.readFileSync(`${rp}/textures/item_texture.json`));
for (const icon of Object.values(atlas.texture_data)) assert.ok(fs.existsSync(path.join(rp, icon.textures + ".png")), "inventory icon exists");
console.log("PASS: armor stats/resources, all four conversions, preserved metadata/durability, race guards, rollback, powered speed and potion protection");
