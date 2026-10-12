const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const bp = "behavior_packs/quinns_redstone_fun_bp";
const rp = "resource_packs/quinns_redstone_fun_rp";
const pieces = { helmet: "Head", chestplate: "Chest", leggings: "Legs", boots: "Feet" };
const geometry = JSON.parse(fs.readFileSync(`${rp}/models/entity/redstone_player_armor.json`));
const animations = JSON.parse(fs.readFileSync(`${rp}/animations/redstone_armor.animation.json`)).animations;
function resolveGeometry(id) {
  const name = Object.keys(geometry).find(key => key.split(":")[0] === id);
  assert.ok(name, `bundled geometry resolves: ${id}`);
  const parent = name.split(":")[1];
  return parent ? [...resolveGeometry(parent), ...(geometry[name].bones ?? [])] : (geometry[name].bones ?? []);
}
for (const piece of Object.keys(pieces)) {
  const id = `quinns_redstone_fun:redstone_${piece}`;
  const item = JSON.parse(fs.readFileSync(`${bp}/items/redstone_${piece}.json`))["minecraft:item"].components;
  assert.equal(item["minecraft:max_stack_size"], undefined, "wearable handles the stack size without conflicting overrides");
  assert.equal(item["minecraft:wearable"].dispensable, true);
  const attachable = JSON.parse(fs.readFileSync(`${rp}/attachables/redstone_${piece}.player.json`))["minecraft:attachable"].description;
  assert.equal(attachable.item[id], "query.owner_identifier == 'minecraft:player'");
  assert.equal(attachable.geometry.default, `geometry.quinns_redstone_fun.player.armor.${piece}`);
  assert.ok(resolveGeometry(attachable.geometry.default).some(bone => bone.cubes?.length), "armor has visible geometry");
  assert.ok(animations[attachable.animations.offset], "player alignment animation is bundled");
  assert.ok(attachable.scripts.animate.includes("offset"));
  assert.ok(fs.existsSync(`${rp}/${attachable.textures.default}.png`), "worn texture is bundled");
  const generic = JSON.parse(fs.readFileSync(`${rp}/attachables/redstone_${piece}.json`))["minecraft:attachable"].description;
  assert.equal(generic.item[id], "query.owner_identifier != 'minecraft:player'", "generic model cannot hide player model");
}

function setup() {
  const inventory = Array(10), equipped = {}, queued = [];
  let use, command, reject = false;
  const equipment = { getEquipment: slot => equipped[slot], setEquipment: (slot, item) => { if (reject) return false; equipped[slot] = item; return true; } };
  const container = { size: inventory.length, getItem: slot => inventory[slot], setItem: (slot, item) => { inventory[slot] = item; } };
  const player = { typeId: "minecraft:player", selectedSlotIndex: 0,
    getComponent: id => id === "minecraft:inventory" ? { container } : equipment, sendMessage: () => {} };
  vm.runInNewContext(fs.readFileSync(`${bp}/scripts/equip_armor.js`, "utf8").replace(/^import .*;\r?\n/gm, ""), {
    EquipmentSlot: { Head: "Head", Chest: "Chest", Legs: "Legs", Feet: "Feet" }, console: { warn: () => {} },
    world: { afterEvents: { itemUse: { subscribe: fn => { use = fn; } } } },
    system: { run: fn => queued.push(fn), afterEvents: { scriptEventReceive: { subscribe: fn => { command = fn; } } } },
  });
  return { inventory, equipped, player, reject: () => { reject = true; },
    use: item => use({ source: player, itemStack: item }),
    wear: () => command({ id: "quinns_redstone_fun:wear", sourceEntity: player }),
    flush: () => { while (queued.length) queued.shift()(); } };
}
for (const [piece, slot] of Object.entries(pieces)) {
  const state = setup();
  const armor = { typeId: `quinns_redstone_fun:redstone_${piece}`, nameTag: "Quinn", damage: 123, enchantments: ["protection"] };
  const previous = { typeId: `minecraft:diamond_${piece}` };
  state.inventory[0] = armor; state.equipped[slot] = previous;
  state.use(armor); state.flush();
  assert.equal(state.equipped[slot], armor, `use equips ${piece} with all data preserved`);
  assert.equal(state.inventory[0], previous, "old armor returns to the hand");
}
{
  const state = setup();
  for (const [index, piece] of Object.keys(pieces).entries()) state.inventory[index] = { typeId: `quinns_redstone_fun:redstone_${piece}` };
  state.wear();
  for (const [index, [piece, slot]] of Object.entries(pieces).entries()) {
    assert.equal(state.equipped[slot].typeId, `quinns_redstone_fun:redstone_${piece}`);
    assert.equal(state.inventory[index], undefined, "inventory armor is moved, never duplicated");
  }
}
{
  const state = setup(); const armor = { typeId: "quinns_redstone_fun:redstone_helmet" };
  state.inventory[0] = armor; state.use(armor); state.player.selectedSlotIndex = 1; state.flush();
  assert.equal(state.equipped.Head, undefined, "hotbar changes cancel stale use");
  assert.equal(state.inventory[0], armor);
}
{
  const state = setup(); const armor = { typeId: "quinns_redstone_fun:redstone_helmet" };
  const nativeEquipped = { ...armor, nameTag: "Native equip succeeded" };
  state.inventory[0] = armor; state.equipped.Head = nativeEquipped; state.use(armor); state.flush();
  assert.equal(state.equipped.Head, nativeEquipped, "native equip is not undone by fallback");
}
{
  const state = setup(); const armor = { typeId: "quinns_redstone_fun:redstone_boots" };
  state.inventory[0] = armor; state.reject(); state.use(armor); state.flush();
  assert.equal(state.inventory[0], armor, "failed equip restores inventory"); assert.equal(state.equipped.Feet, undefined);
}
console.log("PASS: four player models/textures/animations, wearable settings, use-to-equip, inventory swaps, command equip, race/duplication/failure guards");
