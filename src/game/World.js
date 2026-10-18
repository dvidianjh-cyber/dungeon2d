/** Last Modified: 2026-10-17. Deterministic host-owned world and adventure rules. */
import { validateBundle } from './PackManager.js';

export const REACH = 100;
/** Stable key for a map in a pack. */
export function mapKey(pack, map) { return `${pack}/${map}`; }
/** Stable key preserves item identity while travelling between packs. */
export function itemKey(pack, item) { return `${pack}/${item}`; }
/** Return a usable interaction anchor for any object shape. */
export function anchor(obj) { return obj.interaction || { x: obj.x + (obj.width || 0) / 2, y: obj.y + (obj.height || 0) / 2 }; }
/** Distance between world points. */
export function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
/** Resolve a player-sized AABB against metadata colliders. */
export function blocked(map, x, y) {
  if (x < 16 || y < 16 || x > map.width - 16 || y > map.height - 16) return true;
  return [...map.obstacles, ...map.objects.filter(o => o.solid)].some(o => x + 11 > o.x && x - 11 < o.x + o.width && y + 9 > o.y && y - 9 < o.y + o.height);
}
/** Find a safe arrival close to the metadata spawn. */
export function safeSpawn(map, desired) {
  for (let r = 0; r < Math.max(map.width, map.height); r += 20) for (let a = 0; a < 8; a++) {
    const point = { x: desired.x + Math.cos(a * Math.PI / 4) * r, y: desired.y + Math.sin(a * Math.PI / 4) * r };
    if (!blocked(map, point.x, point.y)) return point;
  }
  throw new Error(`No walkable spawn in ${map.name}.`);
}

/** All irreversible gameplay changes run here, on the host only. */
export class World {
  /** Build the shared world and mutable object state from validated definitions. */
  constructor(packs, entry, random = Math.random) {
    validateBundle(packs, entry); this.packs = packs; this.entry = entry; this.random = random;
    this.maps = Object.create(null); this.items = Object.create(null); this.players = Object.create(null); this.inputs = Object.create(null); this.state = Object.create(null); this.sequence = 0;
    for (const pack of packs) {
      for (const [id, item] of Object.entries(pack.items)) this.items[itemKey(pack.id, id)] = item;
      for (const map of pack.maps) {
        const key = mapKey(pack.id, map.id); this.maps[key] = map;
        safeSpawn(map, map.spawn);
        this.state[key] = { removed: [], drops: [], shops: Object.fromEntries(map.objects.filter(o => o.shop).map(o => [o.id, { ...o.shop }])) };
      }
    }
  }
  /** Add a participant with server-assigned pockets and a valid starting position. */
  addPlayer(id, name, colorIndex = 0) {
    if (this.players[id]) return this.players[id];
    if (Object.keys(this.players).length >= 8) throw new Error('This room is full (8 players).');
    const pack = this.packs.find(p => p.id === this.entry), key = mapKey(pack.id, pack.startMap), map = this.maps[key];
    const spawn = safeSpawn(map, { x: map.spawn.x + Object.keys(this.players).length * 26, y: map.spawn.y });
    this.players[id] = { id, name: String(name || 'Traveller').slice(0, 24), color: pack.player.colors?.[Math.abs(colorIndex | 0) % pack.player.colors.length] || '#6b8b82', ...spawn, map: key, direction: 'down', moving: false, gold: pack.player.gold, bank: 0, energy: 80, inventory: Object.fromEntries(Object.entries(pack.player.inventory || {}).map(([item, qty]) => [itemKey(pack.id, item), qty])), quests: {}, dialogue: {} };
    return this.players[id];
  }
  /** Remove disconnected participants and their last movement intent. */
  removePlayer(id) { delete this.players[id]; delete this.inputs[id]; }
  /** Accept direction only, never client coordinates or economy state. */
  input(id, input) {
    if (!this.players[id] || !input || !Number.isFinite(input.x) || !Number.isFinite(input.y)) return;
    const length = Math.hypot(input.x, input.y) || 1;
    this.inputs[id] = { x: input.x / Math.max(1, length), y: input.y / Math.max(1, length), at: Date.now() };
  }
  /** Advance fixed-size collision steps; stale inputs expire after 350 ms. */
  tick(dt) {
    dt = Math.min(Math.max(dt, 0), 0.1);
    for (const p of Object.values(this.players)) {
      const input = this.inputs[p.id]; p.moving = false;
      if (!input || Date.now() - input.at > 350) continue;
      const map = this.maps[p.map], steps = Math.max(1, Math.ceil(dt / .016)), speed = 170;
      const startX = p.x, startY = p.y;
      for (let i = 0; i < steps; i++) {
        const x = p.x + input.x * speed * dt / steps, y = p.y + input.y * speed * dt / steps;
        if (!blocked(map, x, p.y)) p.x = x;
        if (!blocked(map, p.x, y)) p.y = y;
      }
      p.moving = distance(p, { x: startX, y: startY }) > .1;
      if (input.x || input.y) p.direction = Math.abs(input.x) > Math.abs(input.y) ? (input.x > 0 ? 'right' : 'left') : (input.y > 0 ? 'down' : 'up');
    }
    this.sequence++;
  }
  /** Read visible objects, including shared dropped items. */
  objects(key) { return [...this.maps[key].objects.filter(o => !this.state[key].removed.includes(o.id)), ...this.state[key].drops]; }
  /** Apply an adventure verb atomically and return feedback for the initiating player. */
  act(id, request) {
    const p = this.players[id]; if (!p || !request || typeof request !== 'object') return { ok: false, text: 'Invalid action.' };
    const { verb, target, item: key } = request, pack = p.map.split('/')[0], state = this.state[p.map];
    const obj = this.objects(p.map).find(o => o.id === target);
    const item = this.items[key];
    const fail = text => ({ ok: false, text });
    const done = (text, sound = 'action') => ({ ok: true, text, sound });
    if (verb === 'inspect-item') return item && p.inventory[key] ? done(item.description || item.name, 'menu') : fail('You do not have that item.');
    if (verb === 'drop') {
      if (!item || !p.inventory[key]) return fail('You do not have that item.');
      if (state.drops.length >= 200) return fail('There are too many loose items here.');
      p.inventory[key]--; state.drops.push({ id: `drop-${++this.sequence}`, kind: 'pickup', name: item.name, itemKey: key, x: p.x + 15, y: p.y, actions: ['inspect', 'take'] });
      return done(`Dropped ${item.name}.`);
    }
    if (verb === 'use-item') {
      if (!item || !p.inventory[key]) return fail('You do not have that item.');
      if (obj?.quest && key === itemKey(pack, obj.quest.item)) {
        if (distance(p, anchor(obj)) > REACH) return fail('Move closer to hand that over.');
        const questKey = `${p.map}/${obj.quest.id}`;
        if (p.quests[questKey] === 'complete') return fail('You have already helped here.');
        p.inventory[key]--; p.gold += obj.quest.reward; p.quests[questKey] = 'complete'; return done(obj.quest.completed, 'coin');
      }
      if (!item.use) return fail('This needs the right person or object. Select a target, then use the item.');
      if (item.use.type === 'target' && (!obj || !obj.tags?.includes(item.use.tag) || distance(p, anchor(obj)) > REACH)) return fail('Move near the right object and select it first.');
      if (item.use.type === 'restore') p.energy = Math.min(100, p.energy + item.use.amount);
      if (item.use.type === 'target') p.energy = Math.min(100, p.energy + (item.use.energy || 0));
      if (item.consumable) p.inventory[key]--;
      return done(item.use.message || `Used ${item.name}. Energy is now ${p.energy}.`, 'use');
    }
    if (!obj) return fail('That object is no longer here.');
    if (verb === 'inspect') return done(obj.description || this.items[obj.itemKey || itemKey(pack, obj.item)]?.description || obj.name, 'menu');
    if (distance(p, anchor(obj)) > REACH) return fail('A little closer… walk up to it first.');
    if (!obj.actions.includes(verb)) return fail('That action is not available here.');
    if (verb === 'talk') {
      const index = p.dialogue[`${p.map}/${obj.id}`] || 0; p.dialogue[`${p.map}/${obj.id}`] = index + 1;
      if (obj.quest && !p.quests[`${p.map}/${obj.quest.id}`]) p.quests[`${p.map}/${obj.quest.id}`] = 'active';
      return done(`${obj.name}: ${obj.dialogue?.[index % obj.dialogue.length] || 'Lovely day, isn’t it?'}`, 'talk');
    }
    if (verb === 'take') {
      const taken = obj.itemKey || itemKey(pack, obj.item);
      if ((p.inventory[taken] || 0) >= 99) return fail('That inventory stack is full.');
      p.inventory[taken] = (p.inventory[taken] || 0) + 1;
      if (obj.itemKey) state.drops = state.drops.filter(o => o.id !== obj.id); else state.removed.push(obj.id);
      return done(`Picked up ${obj.name}.`, 'pickup');
    }
    if (verb === 'enter') {
      const destination = mapKey(obj.portal.pack, obj.portal.map), map = this.maps[destination];
      if (!map) return fail('The linked dungeon pack is not installed.');
      Object.assign(p, safeSpawn(map, obj.portal.spawn || map.spawn), { map: destination, moving: false }); delete this.inputs[id];
      return done(`Entered ${map.name}.`, 'enter');
    }
    if (verb === 'buy') {
      const localItem = typeof key === 'string' ? key.split('/')[1] : '', shop = state.shops[obj.id];
      if (!item || key !== itemKey(pack, localItem) || !shop?.[localItem]) return fail('That item is out of stock.');
      if (p.gold < item.value) return fail('You need a little more gold.');
      if ((p.inventory[key] || 0) >= 99) return fail('That inventory stack is full.');
      p.gold -= item.value; shop[localItem]--; p.inventory[key] = (p.inventory[key] || 0) + 1; return done(`Bought ${item.name} for ${item.value} gold.`, 'coin');
    }
    if (verb === 'sell') {
      if (!obj.shop || !item || !p.inventory[key] || item.value < 2) return fail('The shop cannot buy that item.');
      const price = Math.floor(item.value / 2); p.inventory[key]--; p.gold += price;
      const local = key.split('/'); if (local[0] === pack && Object.hasOwn(state.shops[obj.id], local[1])) state.shops[obj.id][local[1]]++;
      return done(`Sold ${item.name} for ${price} gold.`, 'coin');
    }
    if (verb === 'deposit' || verb === 'withdraw') {
      if (!obj.bank) return fail('This is not a bank.');
      const from = verb === 'deposit' ? 'gold' : 'bank', to = verb === 'deposit' ? 'bank' : 'gold';
      if (p[from] < 10) return fail(`You need at least 10 gold in your ${from === 'gold' ? 'pocket' : 'bank account'}.`);
      p[from] -= 10; p[to] += 10; return done(`${verb === 'deposit' ? 'Deposited' : 'Withdrew'} 10 gold. Bank balance: ${p.bank}.`, 'coin');
    }
    if (verb === 'use' && obj.effect) {
      const effect = obj.effect;
      if (effect.type === 'dice') {
        if (p.gold < effect.cost) return fail(`You need ${effect.cost} gold to play.`);
        p.gold -= effect.cost; const roll = 1 + Math.floor(this.random() * 6); if (roll >= 4) p.gold += effect.payout;
        return done(`You rolled ${roll}. ${roll >= 4 ? `You receive ${effect.payout} gold!` : 'No win this time.'}`, 'coin');
      }
      if (effect.type === 'restore') p.energy = Math.min(100, p.energy + effect.amount);
      return done(effect.message || 'You take a moment to rest.', 'use');
    }
    return fail('There is nothing to do with that yet.');
  }
  /** Return a serializable world snapshot for joining and connected peers. */
  snapshot() { return { sequence: this.sequence, players: this.players, state: this.state }; }
}
