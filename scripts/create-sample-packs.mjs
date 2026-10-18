/** Last Modified: 2026-10-17. Regenerates the editable sample metadata. */
import { mkdirSync, writeFileSync } from 'node:fs';

const items = {
  apple: { name: 'Crisp apple', icon: 'apple', description: 'An apple from the town orchard. Restores 20 energy.', value: 4, use: { type: 'restore', amount: 20 }, consumable: true },
  coffee: { name: 'Flat white', icon: 'coffee', description: 'A very good coffee. Restores 35 energy.', value: 8, use: { type: 'restore', amount: 35 }, consumable: true },
  key: { name: 'Brass key', icon: 'key', description: 'A small brass key. A tag reads “Adelle”. Perhaps she is looking for it.', value: 0 },
  ticket: { name: 'Cinema ticket', icon: 'ticket', description: 'One seat for The Long Way Home. Use at the cinema projector.', value: 12, use: { type: 'target', tag: 'projector', message: 'The lights dim. A little film about coming home fills the screen. You leave feeling refreshed.', energy: 30 }, consumable: true },
  flower: { name: 'Wildflower', icon: 'flower', description: 'A little colour from the village green. The general store buys these.', value: 3 },
  sandwich: { name: 'Club sandwich', icon: 'sandwich', description: 'Lunch, neatly wrapped. Restores 50 energy.', value: 10, use: { type: 'restore', amount: 50 }, consumable: true },
  book: { name: 'Littleton guide', icon: 'book', description: 'A pocket guide to the town.', value: 6, use: { type: 'message', message: 'Local tip: Adelle lost a brass key near the fountain. Shops buy useful items for half the shelf price. The casino is a separate, linked dungeon pack.' } }
};
const palette = { grass: '#799668', grassDark: '#6d885e', path: '#c6c2a9', road: '#777d7b', water: '#7eafb3', wall: '#ded5ba', roof: '#946c58', floor: '#b4a58b', accent: '#d5b76e' };
const town = { format: 'dungeon2d-pack', version: 1, lastModified: '2026-10-17', id: 'littleton', title: 'Littleton', subtitle: 'A small town. A few familiar faces. Your own little adventure.', description: 'Wander quiet streets, meet the neighbours and see where the day takes you.', author: 'Dungeon2D', theme: 'town', dependencies: ['golden-hour'], startMap: 'town', palette, items, player: { gold: 50, inventory: { book: 1, apple: 2 }, colors: ['#617f78', '#ad6b58', '#7184a3', '#af955e', '#9c7290', '#7f955d'] }, maps: [] };
const map = { id: 'town', name: 'Littleton', subtitle: 'The neighbourhood', width: 1600, height: 1280, spawn: { x: 800, y: 740 }, environment: 'outdoor', surfaces: [
  { x: 0, y: 430, width: 1600, height: 110, type: 'road' }, { x: 0, y: 950, width: 1600, height: 100, type: 'road' },
  { x: 350, y: 0, width: 90, height: 1280, type: 'road' }, { x: 1180, y: 0, width: 90, height: 1280, type: 'road' },
  { x: 590, y: 560, width: 430, height: 350, type: 'path' }, { x: 720, y: 0, width: 65, height: 1280, type: 'path' },
  { x: 0, y: 1100, width: 290, height: 180, type: 'water' }
], obstacles: [{ x: 0, y: 1100, width: 290, height: 180 }], objects: [], decorations: [] };
map.hint = 'Say hello to Elliot in the square.';
town.maps.push(map);
const venues = [
  ['adelle', 'Adelles House', 100, 150, 'house', '#af786c', 'Adelle', 'I have misplaced my brass key. Last time I saw it, I was sitting near the fountain.'],
  ['jim', 'Jims House', 480, 150, 'house', '#7b8c9c', 'Jim', 'I was going to mow the lawn. But the pub opens soon. Difficult choices.'],
  ['gez', "Gez’s House", 900, 150, 'house', '#a28d6b', 'Gez', 'Welcome! Mike is always recommending films. Take a look at the cinema.'],
  ['wooly', "Wooly’s House", 1330, 150, 'house', '#7e9073', 'Wooly', 'Make yourself at home. There are apples in the square if you get hungry.'],
  ['mike', 'Mikes House', 100, 640, 'house', '#8f7b91', 'Mike', 'The Long Way Home is showing at the cinema. Buy a ticket and use it at the projector.'],
  ['store', 'General Store', 465, 640, 'store', '#788b72', 'Mabel', 'A little of everything! I also buy flowers, food and books.'],
  ['restaurant', 'Restaurant', 1040, 640, 'restaurant', '#b27961', 'Rosa', 'Good food, good company. Try our club sandwich.'],
  ['pub', 'Pub', 1330, 640, 'pub', '#718178', 'Alfie', 'A quiet pint, a warm welcome. That is all you need some days.'],
  ['cinema', 'Cinema', 465, 1080, 'cinema', '#9c7379', 'Bea', 'Our matinee is on all day. Tickets are twelve gold.'],
  ['casino', 'Casino', 900, 1080, 'casino', '#8a829a', null, null],
  ['bank', 'Bank', 1330, 1080, 'bank', '#8d968d', 'Morgan', 'You can deposit and withdraw ten gold at a time. Your balance stays with you in this session.'],
  ['office', 'Office Block', 1330, 20, 'office', '#7b8e95', 'Sam', 'The town runs on coffee and optimism. Mostly coffee.']
];
/** Add a venue and its individually authored interior metadata. */
function addVenue([id, name, x, y, style, color, npc, dialogue]) {
  const width = id === 'office' ? 170 : 180;
  const height = id === 'office' ? 95 : 145;
  const door = { x: x + width / 2, y: y + height + 20 };
  map.objects.push({ id: `venue-${id}`, kind: 'building', name, description: `${name}, a familiar landmark in Littleton. Step inside and have a look around.`, x, y, width, height, solid: true, style, color, interaction: door, actions: ['inspect', 'enter'], portal: { pack: id === 'casino' ? 'golden-hour' : 'littleton', map: id === 'casino' ? 'casino' : id } });
  map.surfaces.push({ x: door.x - 20, y: y + height, width: 40, height: 40, type: 'path' });
  if (id === 'casino') return;
  const interior = { id, name, subtitle: style === 'house' ? 'Make yourself at home' : 'Open for a little adventure', width: 720, height: 560, spawn: { x: 360, y: 460 }, environment: 'indoor', surfaces: [{ x: 230, y: 250, width: 260, height: 180, type: 'rug' }], obstacles: [], decorations: [], objects: [
    { id: 'exit', kind: 'door', name: 'Back to Littleton', x: 360, y: 515, actions: ['inspect', 'enter'], description: 'A little fresh air awaits.', portal: { pack: 'littleton', map: 'town', spawn: door } },
    { id: 'table', kind: 'furniture', style: 'table', name: style === 'house' ? 'Kitchen table' : 'Counter', description: 'Warm wood, polished by years of use.', x: 230, y: 145, width: 260, height: 70, solid: true, actions: ['inspect'] },
    { id: 'plant', kind: 'furniture', style: 'plant', name: 'Happy houseplant', description: 'Somebody remembers to water this one.', x: 90, y: 110, width: 35, height: 40, solid: true, actions: ['inspect'] }
  ] };
  const person = { id: 'resident', kind: 'npc', name: npc, x: 360, y: 260, color, actions: ['inspect', 'talk'], description: `${npc}, ${style === 'house' ? 'one of your neighbours' : 'a friendly local'}.`, dialogue: [dialogue, 'Take your time. There is always something to discover around here.'] };
  if (id === 'adelle') person.quest = { id: 'lost-key', title: 'Adelle’s missing key', item: 'key', reward: 25, text: 'Find Adelle’s brass key near the town fountain, then use it on Adelle.', completed: 'My key! You found it. Here, take 25 gold for your trouble.' };
  const stock = { store: { apple: 20, flower: 12, book: 5, coffee: 10 }, restaurant: { sandwich: 20, coffee: 20, apple: 10 }, pub: { coffee: 20, sandwich: 10 }, cinema: { ticket: 30 } }[id];
  if (stock) { person.shop = stock; person.actions.push('buy', 'sell'); }
  if (id === 'bank') { person.bank = true; person.actions.push('deposit', 'withdraw'); }
  interior.objects.push(person);
  if (id === 'cinema') interior.objects.push({ id: 'projector', kind: 'furniture', style: 'screen', name: 'Cinema projector', x: 150, y: 50, width: 420, height: 55, solid: true, tags: ['projector'], actions: ['inspect'], description: 'The Long Way Home. Select a cinema ticket in your inventory, then use it here.' });
  interior.hint = `Say hello to ${npc}.`;
  town.maps.push(interior);
}
venues.forEach(addVenue);
map.objects.push(
  { id: 'fountain', kind: 'furniture', style: 'fountain', name: 'Town fountain', description: 'The water catches the afternoon light. A good place to stop for a moment.', x: 760, y: 580, width: 100, height: 90, solid: true, actions: ['inspect', 'use'], effect: { type: 'restore', amount: 10, message: 'A cool sip of water. You feel a little brighter.' } },
  { id: 'town-sign', kind: 'sign', name: 'Welcome to Littleton', x: 710, y: 775, description: 'A little town with a lot of stories. Explore the houses, visit the shops, or meet Adelle by her kitchen table. Walk with WASD or the arrow keys; click a person or object to interact.', actions: ['inspect'] },
  { id: 'apple-1', kind: 'pickup', name: 'Crisp apple', item: 'apple', x: 850, y: 785, actions: ['inspect', 'take'] },
  { id: 'lost-key', kind: 'pickup', name: 'Brass key', item: 'key', x: 715, y: 620, actions: ['inspect', 'take'] },
  { id: 'flower-1', kind: 'pickup', name: 'Wildflower', item: 'flower', x: 980, y: 845, actions: ['inspect', 'take'] },
  { id: 'flower-2', kind: 'pickup', name: 'Wildflower', item: 'flower', x: 1020, y: 880, actions: ['inspect', 'take'] },
  { id: 'eli', kind: 'npc', name: 'Elliot', x: 900, y: 720, color: '#ac8057', description: 'Littleton’s unofficial tour guide.', actions: ['inspect', 'talk'], dialogue: ['First time here? Welcome to Littleton. Adelle has lost her key; you might find it near the fountain.', 'The General Store is just west of the square. Mabel buys wildflowers if you need a little extra gold.', 'The casino is down on the south street. Going inside takes you into another dungeon pack. Same friends, same pockets!'] }
);
for (const [x,y] of [[65,65],[295,90],[530,60],[1040,70],[1510,380],[70,370],[295,600],[540,865],[1080,390],[1120,850],[70,930],[1480,900],[1300,440],[320,1190],[1040,1020],[670,880]]) map.decorations.push({ type: 'tree', x, y });
for (const [x,y] of [[670,700],[930,590],[910,865]]) map.decorations.push({ type: 'bench', x, y });
for (const [x,y] of [[330,420],[1170,420],[330,950],[1170,950],[660,840]]) map.decorations.push({ type: 'lamp', x, y });

const casino = { format: 'dungeon2d-pack', version: 1, lastModified: '2026-10-17', id: 'golden-hour', title: 'The Golden Hour', subtitle: 'A little luck, a little luxury.', description: 'A linked casino interior with a friendly croupier and a simple dice game.', author: 'Dungeon2D', theme: 'casino', dependencies: ['littleton'], startMap: 'casino', palette: { ...palette, floor: '#735c67', accent: '#dfbb74' }, items, player: town.player, maps: [
  { id: 'casino', name: 'The Golden Hour', subtitle: 'Littleton’s casino', hint: 'Jules can explain the game. Noor serves coffee by the tables.', width: 960, height: 720, environment: 'indoor', spawn: { x: 480, y: 610 }, surfaces: [{ x: 350, y: 70, width: 260, height: 600, type: 'rug' }], obstacles: [], decorations: [{ type: 'lamp', x: 100, y: 580 }, { type: 'lamp', x: 840, y: 580 }], objects: [
    { id: 'exit', kind: 'door', name: 'Back to Littleton', description: 'Return to the town with everything in your pockets.', x: 480, y: 670, actions: ['inspect', 'enter'], portal: { pack: 'littleton', map: 'town', spawn: { x: 990, y: 1260 } } },
    { id: 'dealer', kind: 'npc', name: 'Jules', x: 480, y: 250, color: '#c29a67', actions: ['inspect', 'talk'], description: 'A croupier with a reassuring smile.', dialogue: ['Welcome to the Golden Hour. The dice table costs five gold. Roll a four, five or six to win eight gold back.', 'Just a little game with pretend coins. Keep enough for lunch!'] },
    { id: 'dice', kind: 'furniture', style: 'game-table', name: 'Lucky dice', x: 170, y: 330, width: 210, height: 110, solid: true, actions: ['inspect', 'use'], description: 'Stake 5 gold. Roll 4–6 to receive 8 gold; 1–3 returns nothing.', effect: { type: 'dice', cost: 5, payout: 8 } },
    { id: 'bar', kind: 'npc', name: 'Noor', x: 730, y: 370, color: '#839d9c', actions: ['inspect', 'talk', 'buy', 'sell'], description: 'Keeping everyone refreshed.', dialogue: ['Coffee? It is always a good bet.'], shop: { coffee: 30, sandwich: 20 } },
    { id: 'plant', kind: 'furniture', style: 'plant', name: 'Palms', description: 'A touch of the tropics.', x: 120, y: 110, width: 40, height: 50, solid: true, actions: ['inspect'] }
  ] }
] };
mkdirSync('public/packs', { recursive: true });
for (const pack of [town, casino]) writeFileSync(`public/packs/${pack.id}.json`, JSON.stringify(pack, null, 2) + '\n');
