/** Last Modified: 2026-10-17. Validated, portable, data-only dungeon bundles. */
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';

const ID = /^[a-z][a-z0-9-]{0,47}$/;
const ACTIONS = ['inspect', 'talk', 'take', 'use', 'enter', 'buy', 'sell', 'deposit', 'withdraw'];
const MAX_BYTES = 4 * 1024 * 1024;
/** Fail closed on malformed metadata. */
function assert(value, message) { if (!value) throw new Error(message); }
/** Validate a finite bounded number. */
function number(value, min, max) { return Number.isFinite(value) && value >= min && value <= max; }
/** Validate an identifier, excluding JavaScript special object keys. */
function validId(value) { return typeof value === 'string' && ID.test(value) && !['constructor', 'prototype'].includes(value); }
/** Recursively reject executable, oversized, or prototype-polluting metadata. */
function safeTree(value, depth = 0) {
  assert(depth < 24, 'Metadata is nested too deeply.');
  if (typeof value === 'string') assert(value.length <= 4000, 'Metadata text is too long.');
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    assert(!['__proto__', 'prototype', 'constructor'].includes(key), 'Unsafe metadata key.');
    safeTree(child, depth + 1);
  }
}
/** Validate each supported declarative effect. */
function effect(e) {
  if (!e) return;
  assert(['restore', 'message', 'target', 'dice'].includes(e.type), 'Unsupported item effect.');
  if (e.type === 'restore') assert(number(e.amount, 0, 100), 'Invalid restore amount.');
  if (e.type === 'target') assert(validId(e.tag) && number(e.energy ?? 0, 0, 100), 'Invalid target effect.');
  if (e.type === 'dice') assert(Number.isInteger(e.cost) && number(e.cost, 1, 10000) && Number.isInteger(e.payout) && number(e.payout, 0, 10000), 'Invalid dice payout.');
}
/** Check a pack before it reaches the world or renderer. No pack can execute code. */
export function validatePack(pack) {
  assert(pack && typeof pack === 'object', 'Pack must be an object.');
  safeTree(pack);
  assert(JSON.stringify(pack).length <= MAX_BYTES, 'Pack is too large.');
  assert(pack.format === 'dungeon2d-pack' && pack.version === 1, 'Unsupported dungeon pack format or version.');
  assert(validId(pack.id) && typeof pack.title === 'string' && pack.title.length <= 80, 'Invalid pack ID or title.');
  assert(Array.isArray(pack.dependencies) && pack.dependencies.length <= 16 && pack.dependencies.every(validId), 'Invalid dependencies.');
  assert(pack.palette && Object.values(pack.palette).every(c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)), 'Palette colors must be six-digit hex colors.');
  assert(pack.items && typeof pack.items === 'object' && Object.keys(pack.items).length <= 200, 'Invalid items.');
  for (const [id, item] of Object.entries(pack.items)) {
    assert(validId(id) && typeof item.name === 'string' && Number.isInteger(item.value) && number(item.value, 0, 10000), 'Invalid item definition.');
    effect(item.use);
    if (item.use) assert(item.use.type !== 'dice', 'Dice effects belong to world objects.');
    if (item.pixels) assert(Array.isArray(item.pixels) && item.pixels.length <= 32 && item.pixels.every(row => typeof row === 'string' && row.length <= 32) && item.palette && Object.values(item.palette).every(c => /^#[0-9a-f]{6}$/i.test(c)), 'Invalid pixel sprite.');
  }
  assert(pack.player && Number.isInteger(pack.player.gold) && number(pack.player.gold, 0, 100000), 'Invalid starting gold.');
  if (pack.player.colors) assert(Array.isArray(pack.player.colors) && pack.player.colors.length > 0 && pack.player.colors.length <= 12 && pack.player.colors.every(c => /^#[0-9a-f]{6}$/i.test(c)), 'Invalid player colors.');
  for (const [id, qty] of Object.entries(pack.player.inventory || {})) assert(pack.items[id] && Number.isInteger(qty) && number(qty, 1, 99), 'Invalid starting inventory.');
  assert(Array.isArray(pack.maps) && pack.maps.length > 0 && pack.maps.length <= 32, 'A pack needs 1–32 maps.');
  const ids = new Set();
  for (const map of pack.maps) {
    assert(validId(map.id) && !ids.has(map.id), 'Duplicate or invalid map ID.'); ids.add(map.id);
    assert(typeof map.name === 'string' && number(map.width, 320, 4096) && number(map.height, 320, 4096), 'Invalid map dimensions.');
    assert(map.spawn && number(map.spawn.x, 16, map.width - 16) && number(map.spawn.y, 16, map.height - 16), 'Invalid map spawn.');
    assert(['indoor', 'outdoor'].includes(map.environment), 'Invalid map environment.');
    for (const field of ['objects', 'obstacles', 'surfaces', 'decorations']) assert(Array.isArray(map[field]) && map[field].length <= 500, `Invalid map ${field}.`);
    for (const rect of [...map.obstacles, ...map.surfaces]) assert(number(rect.x, 0, map.width) && number(rect.y, 0, map.height) && number(rect.width, 1, map.width) && number(rect.height, 1, map.height), 'Invalid map rectangle.');
    for (const decoration of map.decorations) assert(['tree', 'bench', 'lamp'].includes(decoration.type) && number(decoration.x, 0, map.width) && number(decoration.y, 0, map.height), 'Invalid decoration.');
    const objects = new Set();
    for (const obj of map.objects) {
      assert(validId(obj.id) && !objects.has(obj.id), 'Duplicate or invalid object ID.'); objects.add(obj.id);
      assert(typeof obj.name === 'string' && ['building', 'npc', 'pickup', 'furniture', 'sign', 'door'].includes(obj.kind), 'Invalid object kind.');
      assert(number(obj.x, 0, map.width) && number(obj.y, 0, map.height), 'Invalid object position.');
      if (obj.solid || obj.kind === 'building') assert(number(obj.width, 1, map.width) && number(obj.height, 1, map.height), 'Invalid collider.');
      assert(Array.isArray(obj.actions) && obj.actions.every(a => ACTIONS.includes(a)), 'Invalid object actions.');
      if (obj.actions.includes('take')) assert(obj.kind === 'pickup' && pack.items[obj.item], 'Take requires a defined pickup item.');
      if (obj.actions.includes('enter')) assert(obj.portal, 'Enter requires a portal.');
      if (obj.actions.includes('use')) assert(obj.effect, 'Use requires an effect.');
      if (obj.actions.includes('buy') || obj.actions.includes('sell')) assert(obj.shop && typeof obj.shop === 'object', 'Trading requires shop stock.');
      if (obj.actions.includes('deposit') || obj.actions.includes('withdraw')) assert(obj.bank === true, 'Bank actions require a bank.');
      if (obj.tags) assert(Array.isArray(obj.tags) && obj.tags.every(validId), 'Invalid object tags.');
      if (obj.interaction) assert(number(obj.interaction.x, 0, map.width) && number(obj.interaction.y, 0, map.height), 'Invalid interaction point.');
      if (obj.item) assert(pack.items[obj.item], 'Unknown pickup item.');
      if (obj.dialogue) assert(Array.isArray(obj.dialogue) && obj.dialogue.length <= 30 && obj.dialogue.every(t => typeof t === 'string'), 'Invalid dialogue.');
      if (obj.shop) for (const [id, qty] of Object.entries(obj.shop)) assert(pack.items[id] && Number.isInteger(qty) && number(qty, 0, 999), 'Invalid shop stock.');
      if (obj.quest) assert(validId(obj.quest.id) && pack.items[obj.quest.item] && Number.isInteger(obj.quest.reward) && number(obj.quest.reward, 0, 10000), 'Invalid quest.');
      if (obj.portal) {
        assert(validId(obj.portal.pack) && validId(obj.portal.map), 'Invalid portal.');
        assert(obj.portal.pack === pack.id || pack.dependencies.includes(obj.portal.pack), 'Portal pack must be a declared dependency.');
        if (obj.portal.spawn) assert(number(obj.portal.spawn.x, 16, 4080) && number(obj.portal.spawn.y, 16, 4080), 'Invalid arrival point.');
      }
      effect(obj.effect);
    }
  }
  assert(ids.has(pack.startMap), 'Starting map is missing.');
  return pack;
}

/** Manage available packs independently of running sessions. */
export class PackManager {
  /** Create an empty pack library. */
  constructor() { this.packs = new Map(); this.imported = new Set(); }
  /** Load bundled metadata and previously imported local packs. */
  async load() {
    for (const id of ['littleton', 'golden-hour']) {
      const response = await fetch(`${import.meta.env.BASE_URL}packs/${id}.json`);
      if (!response.ok) throw new Error('Could not load the bundled dungeon packs.');
      const pack = validatePack(await response.json()); this.packs.set(pack.id, pack);
    }
    try {
      for (const pack of JSON.parse(localStorage.getItem('dungeon2d-packs') || '[]')) {
        validatePack(pack); if (!this.packs.has(pack.id)) { this.packs.set(pack.id, pack); this.imported.add(pack.id); }
      }
    } catch { /* A corrupt browser cache must not prevent bundled adventures loading. */ }
  }
  /** Resolve a complete dependency graph, including intentional cyclic exits. */
  bundle(entry) {
    const found = new Map();
    const visit = id => {
      if (found.has(id)) return;
      const pack = this.packs.get(id); if (!pack) throw new Error(`Missing linked pack: ${id}. Import it first.`);
      found.set(id, pack); pack.dependencies.forEach(visit);
    };
    visit(entry); const packs = [...found.values()]; validateBundle(packs, entry); return packs;
  }
  /** Decode a custom-extension ZIP atomically and retain it across reloads. */
  async importFile(file) {
    assert(file.name.toLowerCase().endsWith('.dungeon'), 'Choose a .dungeon metadata pack.');
    assert(file.size <= MAX_BYTES, 'Dungeon files must be smaller than 4 MB.');
    const { packs, entry } = decodeBundle(new Uint8Array(await file.arrayBuffer()));
    for (const pack of packs) if (this.packs.has(pack.id)) assert(JSON.stringify(this.packs.get(pack.id)) === JSON.stringify(pack), `Pack ID “${pack.id}” is already installed with different content. Give your edited pack a new ID.`);
    for (const pack of packs) if (!this.packs.has(pack.id)) { this.packs.set(pack.id, pack); this.imported.add(pack.id); }
    let persisted = true;
    try { localStorage.setItem('dungeon2d-packs', JSON.stringify([...this.imported].map(id => this.packs.get(id)))); } catch { persisted = false; }
    return { entry, persisted };
  }
  /** Encode the selected pack and every dependency into an interoperable ZIP. */
  export(entry) { return encodeBundle(this.bundle(entry), entry); }
}

/** Validate references across a complete pack bundle. */
export function validateBundle(packs, entry) {
  assert(Array.isArray(packs) && packs.length > 0 && packs.length <= 16, 'Invalid bundle size.');
  assert(JSON.stringify(packs).length <= MAX_BYTES, 'Bundle metadata exceeds 4 MB.');
  const lookup = new Map();
  for (const pack of packs) { validatePack(pack); assert(!lookup.has(pack.id), 'Duplicate pack ID.'); lookup.set(pack.id, pack); }
  assert(lookup.has(entry), 'Entry pack is missing.');
  for (const pack of packs) {
    for (const dep of pack.dependencies) assert(lookup.has(dep), `Missing dependency: ${dep}.`);
    for (const map of pack.maps) for (const obj of map.objects) if (obj.portal) {
      const target = lookup.get(obj.portal.pack)?.maps.find(m => m.id === obj.portal.map);
      assert(target, `Broken portal: ${obj.name}.`);
      if (obj.portal.spawn) assert(number(obj.portal.spawn.x, 16, target.width - 16) && number(obj.portal.spawn.y, 16, target.height - 16), 'Portal arrival is out of bounds.');
    }
  }
  return packs;
}
/** Serialize a complete portable archive. */
export function encodeBundle(packs, entry) {
  validateBundle(packs, entry);
  const files = { 'manifest.json': strToU8(JSON.stringify({ format: 'dungeon2d-bundle', version: 1, entry, packs: packs.map(p => `packs/${p.id}.json`) }, null, 2)) };
  for (const pack of packs) files[`packs/${pack.id}.json`] = strToU8(JSON.stringify(pack, null, 2));
  return zipSync(files, { level: 6 });
}
/** Decode archives with limits checked before decompression. */
export function decodeBundle(bytes) {
  assert(bytes.length <= MAX_BYTES, 'Archive is too large.');
  let total = 0, count = 0;
  const files = unzipSync(bytes, { filter: file => {
    total += file.originalSize; count++;
    assert(count <= 17 && total <= MAX_BYTES, 'Archive expands beyond the 4 MB limit.');
    assert(/^(manifest\.json|packs\/[a-z][a-z0-9-]{0,47}\.json)$/.test(file.name), 'Archive contains an unsupported file path.'); return true;
  } });
  assert(files['manifest.json'], 'Missing manifest.json.');
  const manifest = JSON.parse(strFromU8(files['manifest.json'])); safeTree(manifest);
  assert(manifest.format === 'dungeon2d-bundle' && manifest.version === 1 && Array.isArray(manifest.packs) && manifest.packs.length <= 16, 'Invalid bundle manifest.');
  const packs = manifest.packs.map(path => { assert(files[path], `Missing file: ${path}.`); return JSON.parse(strFromU8(files[path])); });
  validateBundle(packs, manifest.entry); return { packs, entry: manifest.entry };
}
