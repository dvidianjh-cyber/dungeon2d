/** Last Modified: 2026-10-17. Gameplay invariants and real sample-world journeys. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World, blocked, anchor, safeSpawn } from '../src/game/World.js';

const packs = ['littleton', 'golden-hour'].map(id => JSON.parse(readFileSync(new URL(`../public/packs/${id}.json`, import.meta.url))));
/** Make an isolated world for a test. */
function setup(random) { const world = new World(structuredClone(packs), 'littleton', random); world.addPlayer('alice', 'Alice'); world.addPlayer('bob', 'Bob', 1); return world; }
/** Place a player near an entity to exercise actions independently of travel time. */
function beside(world, id, map, target) { const p = world.players[id]; p.map = map; const obj = world.objects(map).find(o => o.id === target); Object.assign(p, safeSpawn(world.maps[map], anchor(obj))); return obj; }

test('the town has every requested venue, valid spawns and enterable/returnable interiors', () => {
  const w = setup(), town = w.maps['littleton/town'];
  assert.equal(town.objects.filter(o => o.kind === 'building').length, 12); assert.equal(Object.keys(w.maps).length, 13);
  for (const building of town.objects.filter(o => o.kind === 'building')) {
    beside(w, 'alice', 'littleton/town', building.id);
    assert.equal(w.act('alice', { verb: 'enter', target: building.id }).ok, true, building.name);
    const p = w.players.alice; assert.equal(blocked(w.maps[p.map], p.x, p.y), false);
    beside(w, 'alice', p.map, 'exit'); assert.equal(w.act('alice', { verb: 'enter', target: 'exit' }).ok, true); assert.equal(p.map, 'littleton/town');
  }
});

test('movement clamps speed, survives giant frame gaps, slides against solids and expires stale input', () => {
  const w = setup(), p = w.players.alice, original = { x: p.x, y: p.y };
  w.input('alice', { x: 1000, y: 1000 }); w.tick(30); assert.ok(Math.hypot(p.x - original.x, p.y - original.y) <= 17.01);
  p.x = 90; p.y = 200; w.input('alice', { x: 1, y: 0 }); for (let i = 0; i < 10; i++) w.tick(.05); assert.ok(p.x < 100);
  const x = p.x; w.input('alice', { x: Infinity, y: NaN }); assert.ok(Number.isFinite(p.x));
  w.inputs.alice.at = Date.now() - 1000; w.tick(.05); assert.equal(p.x, x);
});

test('two players cannot take the same world item, but can transfer a dropped item', () => {
  const w = setup(); beside(w, 'alice', 'littleton/town', 'apple-1'); beside(w, 'bob', 'littleton/town', 'apple-1');
  assert.equal(w.act('alice', { verb: 'take', target: 'apple-1' }).ok, true);
  assert.equal(w.act('bob', { verb: 'take', target: 'apple-1' }).ok, false);
  assert.equal(w.players.alice.inventory['littleton/apple'], 3); assert.equal(w.players.bob.inventory['littleton/apple'], 2);
  w.act('alice', { verb: 'drop', item: 'littleton/apple' }); const drop = w.state['littleton/town'].drops[0];
  assert.equal(w.act('bob', { verb: 'take', target: drop.id }).ok, true); assert.equal(w.players.bob.inventory['littleton/apple'], 3);
  assert.equal(w.state['littleton/town'].drops.length, 0);
});

test('range and map boundaries prevent remote actions', () => {
  const w = setup(); assert.equal(w.act('alice', { verb: 'enter', target: 'venue-casino' }).ok, false);
  assert.equal(w.act('alice', { verb: 'talk', target: 'resident' }).ok, false);
  assert.equal(w.act('alice', { verb: 'inspect', target: 'venue-casino' }).ok, true);
  for (const item of ['__proto__', 'constructor', 'toString']) for (const verb of ['drop', 'use-item', 'inspect-item']) assert.equal(w.act('alice', { verb, item }).ok, false);
});

test('buy/sell conserve gold at posted prices and cannot overspend or duplicate stock', () => {
  const w = setup(); beside(w, 'alice', 'littleton/store', 'resident'); beside(w, 'bob', 'littleton/store', 'resident');
  w.state['littleton/store'].shops.resident.apple = 1;
  assert.equal(w.act('alice', { verb: 'buy', target: 'resident', item: 'littleton/apple' }).ok, true);
  assert.equal(w.players.alice.gold, 46); assert.equal(w.act('bob', { verb: 'buy', target: 'resident', item: 'littleton/apple' }).ok, false);
  assert.equal(w.act('alice', { verb: 'sell', target: 'resident', item: 'littleton/apple' }).ok, true); assert.equal(w.players.alice.gold, 48);
  w.players.alice.gold = 0; assert.equal(w.act('alice', { verb: 'buy', target: 'resident', item: 'littleton/apple' }).ok, false);
  assert.equal(w.act('alice', { verb: 'sell', target: 'resident', item: 'littleton/key' }).ok, false);
});

test('the lost-key quest grants its reward once and consumes the key', () => {
  const w = setup(); beside(w, 'alice', 'littleton/adelle', 'resident'); w.act('alice', { verb: 'talk', target: 'resident' });
  assert.equal(w.players.alice.quests['littleton/adelle/lost-key'], 'active');
  beside(w, 'alice', 'littleton/town', 'lost-key'); w.act('alice', { verb: 'take', target: 'lost-key' });
  beside(w, 'alice', 'littleton/adelle', 'resident'); assert.equal(w.act('alice', { verb: 'use-item', target: 'resident', item: 'littleton/key' }).ok, true);
  assert.equal(w.players.alice.gold, 75); assert.equal(w.players.alice.inventory['littleton/key'], 0);
  assert.equal(w.act('alice', { verb: 'use-item', target: 'resident', item: 'littleton/key' }).ok, false); assert.equal(w.players.alice.gold, 75);
});

test('consumables, readables and targeted cinema tickets behave differently', () => {
  const w = setup(), p = w.players.alice;
  w.act('alice', { verb: 'use-item', item: 'littleton/apple' }); assert.equal(p.energy, 100); assert.equal(p.inventory['littleton/apple'], 1);
  w.act('alice', { verb: 'use-item', item: 'littleton/book' }); assert.equal(p.inventory['littleton/book'], 1);
  beside(w, 'alice', 'littleton/cinema', 'resident'); w.act('alice', { verb: 'buy', target: 'resident', item: 'littleton/ticket' });
  assert.equal(w.act('alice', { verb: 'use-item', target: 'resident', item: 'littleton/ticket' }).ok, false); assert.equal(p.inventory['littleton/ticket'], 1);
  beside(w, 'alice', 'littleton/cinema', 'projector'); assert.equal(w.act('alice', { verb: 'use-item', target: 'projector', item: 'littleton/ticket' }).ok, true); assert.equal(p.inventory['littleton/ticket'], 0);
});

test('cross-pack travel keeps personal state and separates player maps', () => {
  const w = setup(); beside(w, 'alice', 'littleton/town', 'venue-casino'); const inv = structuredClone(w.players.alice.inventory);
  w.act('alice', { verb: 'enter', target: 'venue-casino' }); assert.equal(w.players.alice.map, 'golden-hour/casino'); assert.equal(w.players.bob.map, 'littleton/town'); assert.deepEqual(w.players.alice.inventory, inv);
  beside(w, 'alice', 'golden-hour/casino', 'bar'); w.act('alice', { verb: 'buy', target: 'bar', item: 'golden-hour/coffee' });
  beside(w, 'alice', 'golden-hour/casino', 'exit'); w.act('alice', { verb: 'enter', target: 'exit' });
  assert.equal(w.players.alice.inventory['golden-hour/coffee'], 1); assert.equal(w.act('alice', { verb: 'use-item', item: 'golden-hour/coffee' }).ok, true);
});

test('bank and casino never permit negative balances', () => {
  const w = setup(() => .9), p = w.players.alice; beside(w, 'alice', 'littleton/bank', 'resident');
  w.act('alice', { verb: 'deposit', target: 'resident' }); assert.equal(p.gold, 40); assert.equal(p.bank, 10);
  w.act('alice', { verb: 'withdraw', target: 'resident' }); assert.equal(p.gold, 50); assert.equal(p.bank, 0);
  assert.equal(w.act('alice', { verb: 'withdraw', target: 'resident' }).ok, false);
  beside(w, 'alice', 'golden-hour/casino', 'dice'); w.act('alice', { verb: 'use', target: 'dice' }); assert.equal(p.gold, 53);
  w.random = () => 0; w.act('alice', { verb: 'use', target: 'dice' }); assert.equal(p.gold, 48);
  p.gold = 4; assert.equal(w.act('alice', { verb: 'use', target: 'dice' }).ok, false); assert.equal(p.gold, 4);
});

test('new arrivals receive current stock and removed objects; disconnect releases identity', () => {
  const w = setup(); beside(w, 'alice', 'littleton/town', 'lost-key'); w.act('alice', { verb: 'take', target: 'lost-key' }); w.addPlayer('charlie', 'Charlie');
  assert.ok(w.snapshot().state['littleton/town'].removed.includes('lost-key'));
  w.input('bob', { x: 1, y: 0 }); w.removePlayer('bob'); assert.equal(w.players.bob, undefined); assert.equal(w.inputs.bob, undefined);
  for (let i = 0; i < 6; i++) w.addPlayer(`p${i}`, 'Neighbour'); assert.throws(() => w.addPlayer('overflow', 'Overflow'), /full/);
});

test('every interior can be traversed from spawn to its interaction points', () => {
  const w = setup();
  for (const [key, map] of Object.entries(w.maps).filter(([, map]) => map.environment === 'indoor')) {
    const cell = 10, queue = [safeSpawn(map, map.spawn)], seen = new Set();
    while (queue.length) { const p = queue.shift(), id = `${Math.round(p.x / cell)},${Math.round(p.y / cell)}`; if (seen.has(id) || blocked(map, p.x, p.y)) continue; seen.add(id); for (const [dx, dy] of [[cell,0],[-cell,0],[0,cell],[0,-cell]]) queue.push({x:p.x+dx,y:p.y+dy}); }
    for (const obj of map.objects) assert.ok([...seen].some(s => { const [x,y] = s.split(',').map(Number), a = anchor(obj); return Math.hypot(x*cell-a.x,y*cell-a.y) < 95; }), `${key}/${obj.id} is unreachable`);
  }
});
