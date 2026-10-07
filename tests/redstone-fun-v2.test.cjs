const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const bp = "behavior_packs/quinns_redstone_fun_bp";
const SOURCE = "quinns_redstone_fun:armor_power_source";
const SWORD = "quinns_redstone_fun:redstone_sword";
const DUST = "minecraft:redstone_wire";
const key = p => `${p.x},${p.y},${p.z}`;
const itemDefinition = JSON.parse(fs.readFileSync(`${bp}/items/redstone_sword.json`))["minecraft:item"].components;
assert.equal(itemDefinition["minecraft:durability"], undefined, "sword cannot wear out");
assert.equal(itemDefinition["minecraft:enchantable"].slot, "sword");
const sourceDefinition = JSON.parse(fs.readFileSync(`${bp}/blocks/armor_power_source.json`))["minecraft:block"].components;
assert.equal(sourceDefinition["minecraft:redstone_producer"].power, 15);
assert.equal(sourceDefinition["minecraft:collision_box"], false);
assert.equal(sourceDefinition["minecraft:selection_box"], false);
assert.equal(sourceDefinition["minecraft:movable"].movement_type, "popped", "sources do not block piston extension");
assert.equal(sourceDefinition["minecraft:geometry"].bone_visibility.root, false, "source geometry is hidden");
assert.ok(sourceDefinition["minecraft:material_instances"], "required material instance is present");

class ItemStack {
  constructor(typeId, amount = 1) { this.typeId = typeId; this.amount = amount; this.lore = []; this.enchants = []; }
  getLore() { return this.lore; }
  setLore(values) { this.lore = [...values]; }
  clone() { return Object.assign(new ItemStack(this.typeId, this.amount), this); }
  getComponent(id) {
    if (id === "minecraft:enchantable") return { getEnchantments: () => this.enchants, addEnchantments: values => { this.enchants = [...values]; } };
  }
}

function setup(shared = {}) {
  const blocks = shared.blocks ?? new Map();
  const properties = shared.properties ?? new Map();
  const unloaded = new Set();
  const callbacks = { interact: [], break: [], hitBlock: [], hitEntity: [] };
  const intervals = new Map();
  const runs = [], jobs = [], messages = [], items = [], entities = [];
  const equipment = {};
  const dimension = {
    id: "minecraft:overworld",
    getBlock(position) {
      if (unloaded.has(key(position))) throw Error("unloaded chunk");
      return {
        location: { ...position }, dimension,
        get typeId() { return blocks.get(key(position)) ?? "minecraft:air"; },
        get isAir() { return this.typeId === "minecraft:air"; },
        setPermutation(permutation) { blocks.set(key(position), permutation.type.id); },
        getRedstonePower() { return 0; },
      };
    },
    getEntities: () => entities,
  };
  const container = { size: 10, getItem: index => items[index], setItem: (index, item) => { items[index] = item; } };
  const player = {
    id: "quinn", typeId: "minecraft:player", dimension, location: { x: 0, y: 0, z: 0 }, selectedSlotIndex: 0, isSneaking: true,
    getComponent: id => id === "minecraft:equippable" ? { getEquipment: slot => slot === "Mainhand" ? items[player.selectedSlotIndex] : equipment[slot] } : { container },
    sendMessage: message => messages.push(message), getEffect: () => undefined, addEffect: () => {},
  };
  let players = [player];
  const subscribe = name => ({ subscribe: fn => callbacks[name].push(fn) });
  const context = vm.createContext({
    ItemStack, EquipmentSlot: { Head: "Head", Chest: "Chest", Legs: "Legs", Feet: "Feet", Mainhand: "Mainhand" },
    BlockPermutation: { resolve: id => ({ type: { id } }) }, console: { warn: () => {} },
    world: {
      beforeEvents: { playerInteractWithBlock: subscribe("interact"), playerBreakBlock: subscribe("break") },
      afterEvents: { entityHitBlock: subscribe("hitBlock"), entityHitEntity: subscribe("hitEntity") },
      getAllPlayers: () => players, getDimension: () => dimension,
      getDynamicProperty: name => properties.get(name),
      setDynamicProperty: (name, value) => value === undefined ? properties.delete(name) : properties.set(name, value),
    },
    system: { run: fn => runs.push(fn), runJob: generator => jobs.push(generator), runInterval: (fn, ticks) => intervals.set(ticks, fn) },
  });
  for (const file of ["redstone_mechanics.js", "main.js"]) {
    vm.runInContext(fs.readFileSync(`${bp}/scripts/${file}`, "utf8").replace(/^import .*;\r?\n/gm, ""), context);
  }
  return {
    blocks, properties, unloaded, player, equipment, items, entities, messages, jobs, callbacks, dimension,
    power: () => intervals.get(5)(), setPlayers: values => { players = values; },
    flushRuns: () => { while (runs.length) runs.shift()(); },
    flush: () => { while (runs.length) runs.shift()(); while (jobs.length) { const job = jobs.shift(); while (!job.next().done) {} } },
    touch: (position = { x: 0, y: 0, z: 0 }, kind = "interact", overrides = {}) => {
      const event = { player, block: dimension.getBlock(position), itemStack: items[player.selectedSlotIndex], isFirstEvent: true, ...overrides };
      for (const callback of callbacks[kind]) callback(event);
      return event;
    },
  };
}

function wireLine(state, count, start = 0) {
  for (let x = start; x < start + count; x++) {
    state.blocks.set(`${x},0,0`, DUST);
    state.blocks.set(`${x},-1,0`, "minecraft:stone");
  }
}
function mob(x, y = 0.0625, z = 0, typeId = "minecraft:zombie", health = true) {
  return { typeId, location: { x, y, z }, killed: false, getComponent: () => health ? {} : undefined,
    kill() { this.killed = true; return true; } };
}

{
  const state = setup(); wireLine(state, 1);
  state.items[0] = new ItemStack("quinns_redstone_fun:redstone_helmet");
  state.power(); assert.equal(state.blocks.get("0,1,0"), undefined, "carried armor is not contact power");
  state.equipment.Head = state.items[0];
  state.power(); assert.equal(state.blocks.get("0,1,0"), SOURCE, "wearing armor creates a contact source");
  assert.equal(state.blocks.get("0,0,0"), DUST, "dust is preserved");
  assert.equal(state.blocks.get("0,-1,0"), "minecraft:stone", "foundation is preserved");
  assert.ok(state.properties.size, "source recorded for reload recovery");
  const sourceCount = [...state.blocks.values()].filter(type => type === SOURCE).length;
  state.power(); assert.equal([...state.blocks.values()].filter(type => type === SOURCE).length, sourceCount, "sources reused");
  state.player.location.x = 50; state.power();
  assert.equal(state.blocks.get("0,1,0"), "minecraft:air", "walking away removes power");
  assert.equal(state.properties.size, 0, "clean journal after cleanup");
}
{
  const state = setup(); wireLine(state, 1); state.equipment.Head = new ItemStack("quinns_redstone_fun:redstone_helmet"); state.power();
  delete state.equipment.Head; state.power(); assert.equal(state.blocks.get("0,1,0"), "minecraft:air", "removing armor removes power");
}
{
  const state = setup(); wireLine(state, 1); state.equipment.Head = new ItemStack("quinns_redstone_fun:redstone_helmet");
  const friend = { ...state.player, id: "friend", location: { ...state.player.location } };
  state.setPlayers([state.player, friend]); state.power(); state.player.location.x = 50; state.power();
  assert.equal(state.blocks.get("0,1,0"), SOURCE, "shared source stays while another armored player touches the circuit");
  state.setPlayers([]); state.power(); assert.equal(state.blocks.get("0,1,0"), "minecraft:air", "leaving players release sources");
}
{
  const state = setup(); wireLine(state, 1); state.equipment.Head = new ItemStack("quinns_redstone_fun:redstone_helmet"); state.power();
  const restarted = setup(state); restarted.power();
  assert.equal(state.blocks.get("0,1,0"), "minecraft:air", "old source removed after restart");
}
{
  const state = setup(); wireLine(state, 1); state.equipment.Head = new ItemStack("quinns_redstone_fun:redstone_helmet"); state.power();
  state.blocks.set("0,1,0", "minecraft:stone"); state.setPlayers([]); state.power();
  assert.equal(state.blocks.get("0,1,0"), "minecraft:stone", "cleanup preserves replacement blocks");
}
{
  const state = setup(); wireLine(state, 1); state.equipment.Head = new ItemStack("quinns_redstone_fun:redstone_helmet"); state.power();
  state.unloaded.add("0,1,0"); state.setPlayers([]); state.power(); assert.ok(state.properties.size, "unloaded sources retained for retry");
  state.unloaded.clear(); state.power(); assert.equal(state.properties.size, 0, "loaded sources eventually clean up");
}
{
  const state = setup(); wireLine(state, 1); state.equipment.Head = new ItemStack("quinns_redstone_fun:redstone_helmet");
  for (const position of ["0,1,0", "1,0,0", "-1,0,0", "0,0,1", "0,0,-1"]) state.blocks.set(position, "minecraft:stone");
  state.power(); assert.equal([...state.blocks.values()].includes(SOURCE), false, "no existing blocks replaced when encased");
}

for (const count of [99, 100]) {
  const state = setup(); wireLine(state, count); state.items[0] = new ItemStack(SWORD);
  const first = mob(0.5), last = mob(count - 0.5), outsider = mob(count + 0.5), above = mob(0.5, 1.5);
  const human = mob(1.5, 0.0625, 0, "minecraft:player"), statue = mob(2.5, 0.0625, 0, "minecraft:armor_stand");
  const item = mob(3.5, 0.0625, 0, "minecraft:item", false), disconnected = mob(300.5);
  state.blocks.set("300,0,0", DUST);
  state.entities.push(first, last, outsider, above, human, statue, item, disconnected);
  assert.equal(state.touch(undefined, "break").cancel, true, "sword strikes preserve wire");
  state.touch(); state.flush();
  assert.equal(first.killed, count >= 100); assert.equal(last.killed, count >= 100, "full circuit reaches far-end mobs");
  for (const entity of [outsider, above, human, statue, item, disconnected]) assert.equal(entity.killed, false, "only mobs on this network die");
  assert.equal(state.messages.length, 1, "same-tick discharge requests deduplicated");
  assert.match(state.messages[0], count === 99 ? /99\/100/ : /100 dust; defeated 2 mobs/);
}
{
  const state = setup(); state.items[0] = new ItemStack(SWORD);
  for (let index = 0; index < 100; index++) state.blocks.set(`${index},0,${index}`, DUST);
  const target = mob(0.5); state.entities.push(target); state.touch(); state.flush();
  assert.equal(target.killed, false, "diagonal-only dust does not connect");
}
{
  const state = setup(); state.items[0] = new ItemStack(SWORD);
  for (let index = 0; index < 100; index++) { state.blocks.set(`${index},${index},0`, DUST); state.blocks.set(`${index},${index - 1},0`, "minecraft:stone"); }
  const target = mob(99.5, 99.0625); state.entities.push(target); state.touch(); state.flush();
  assert.equal(target.killed, true, "connected stair-step dust works");
}
{
  const state = setup(); wireLine(state, 100); state.items[0] = new ItemStack(SWORD);
  const target = mob(1.5); state.entities.push(target); state.touch(); state.items[0] = new ItemStack("minecraft:diamond_sword"); state.flush();
  assert.equal(target.killed, false, "changing held sword cancels pending discharge");
}
{
  const state = setup(); wireLine(state, 100); state.items[0] = new ItemStack(SWORD);
  const target = mob(99.5); state.entities.push(target); state.touch(); state.flushRuns();
  const job = state.jobs.shift();
  for (let tick = 0; tick < 100; tick++) job.next();
  state.blocks.set("50,0,0", "minecraft:air");
  while (!job.next().done) {}
  assert.equal(target.killed, false, "breaking a wire during charging aborts the blast");
  assert.match(state.messages[0], /circuit changed/);
}
{
  const state = setup(); wireLine(state, 16385); state.items[0] = new ItemStack(SWORD);
  const target = mob(1.5); state.entities.push(target); state.touch(); state.flush();
  assert.equal(target.killed, false, "oversized networks never cause partial blasts");
  assert.match(state.messages[0], /exceeds 16384/);
}
{
  const state = setup(); state.items[0] = new ItemStack(SWORD);
  const target = mob(0), human = mob(0, 0, 0, "minecraft:player");
  for (const entity of [target, human]) for (const handler of state.callbacks.hitEntity) handler({ damagingEntity: state.player, hitEntity: entity });
  assert.equal(target.killed, true, "direct sword hit instantly kills mobs"); assert.equal(human.killed, false, "players exempt from instant kill");
}
{
  const state = setup(); state.items[0] = new ItemStack("minecraft:diamond_sword"); state.items[0].nameTag = "Quinn's sword";
  state.items[0].enchants = [{ type: { id: "sharpness" }, level: 5 }]; state.items[1] = new ItemStack("minecraft:comparator", 2);
  state.blocks.set("0,0,0", "minecraft:anvil"); state.touch(); state.flush();
  assert.equal(state.items[0].typeId, SWORD); assert.equal(state.items[0].nameTag, "Quinn's sword");
  assert.equal(state.items[0].enchants[0].level, 5); assert.equal(state.items[1].amount, 1);
}
console.log("PASS: v2 sword conversion, unbreakability, contact power/cleanup/reload, 99/100 circuit threshold, stairs/diagonals, full-network kills, exclusions and overload guard");
