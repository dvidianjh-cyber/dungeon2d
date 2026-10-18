/** Last Modified: 2026-10-17. Original canvas pixel art and animated sprite renderer. */
import { anchor, distance, itemKey } from '../game/World.js';

/** Draw a solid, pixel-aligned rectangle. */
function rect(c, x, y, w, h, color) { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h); }
/** Draw an outlined pixel label. */
function label(c, text, x, y, color = '#f6f0db', size = 11) {
  c.font = `600 ${size}px "Segoe UI", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  const width = c.measureText(text).width + 16; rect(c, x - width / 2, y - 10, width, 20, '#35483bd9'); c.fillStyle = color; c.fillText(text, x, y);
}
/** Build a directional, four-frame pixel character, with a subtle idle animation. */
export function drawSprite(c, x, y, color, direction = 'down', moving = false, time = 0, scale = 1) {
  c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(scale, scale);
  const step = moving ? Math.sin(time / 95) * 3 : 0, bob = moving ? Math.abs(Math.sin(time / 95)) * 2 : Math.sin(time / 550) * .45;
  c.fillStyle = '#233b3730'; c.beginPath(); c.ellipse(0, 2, 12, 5, 0, 0, Math.PI * 2); c.fill();
  c.translate(0, -bob);
  rect(c, -7, -7, 5, 10 + step, '#394b54'); rect(c, 2, -7, 5, 10 - step, '#394b54');
  rect(c, -8, 1 + step, 6, 3, '#333b3b'); rect(c, 2, 1 - step, 6, 3, '#333b3b');
  rect(c, -9, -21, 18, 16, color); rect(c, -7, -21, 3, 16, '#ffffff20');
  rect(c, -12, -19 - step, 4, 11, color); rect(c, 8, -19 + step, 4, 11, color);
  rect(c, -12, -8 - step, 4, 4, '#d9ac86'); rect(c, 8, -8 + step, 4, 4, '#d9ac86');
  rect(c, -7, -34, 14, 14, '#ddb590'); rect(c, -9, -35, 18, 7, '#4a403b'); rect(c, -9, -29, 3, 7, '#4a403b');
  if (direction === 'up') rect(c, -7, -30, 14, 9, '#4a403b');
  else { rect(c, direction === 'left' ? -7 : -4, -27, 2, 2, '#3d3934'); if (direction !== 'left') rect(c, direction === 'right' ? 6 : 4, -27, 2, 2, '#3d3934'); }
  if (direction === 'up') { rect(c, -6, -19, 12, 10, '#b69b6d'); rect(c, -5, -19, 10, 2, '#cbb184'); }
  c.restore();
}

/** Render built-in icons or arbitrary metadata pixel grids. */
export function drawItem(c, item, x, y, scale = 1) {
  c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(scale, scale);
  if (item?.pixels) {
    item.pixels.forEach((row, yy) => [...row].forEach((pixel, xx) => { if (item.palette[pixel]) rect(c, xx - row.length / 2, yy - item.pixels.length / 2, 1, 1, item.palette[pixel]); }));
  } else {
    const icon = item?.icon;
    if (icon === 'apple') { rect(c, -7, -4, 14, 10, '#bf6350'); rect(c, -5, -6, 10, 14, '#c97357'); rect(c, -4, -4, 3, 3, '#e8a17c'); rect(c, 0, -10, 2, 5, '#6a5942'); rect(c, 2, -9, 5, 3, '#7e985f'); }
    else if (icon === 'key') { rect(c, -8, -5, 7, 9, '#d8b45d'); rect(c, -6, -3, 3, 5, '#887348'); rect(c, -1, -2, 11, 3, '#dfbf71'); rect(c, 5, 0, 3, 4, '#dfbf71'); rect(c, 9, 0, 2, 3, '#dfbf71'); }
    else if (icon === 'coffee') { rect(c, -7, -6, 13, 14, '#e7dfc8'); rect(c, -9, -8, 17, 4, '#6d7468'); rect(c, -7, -1, 13, 5, '#a98865'); rect(c, -4, 8, 7, 2, '#b3a58b'); }
    else if (icon === 'flower') { rect(c, -1, -1, 2, 12, '#5b7f54'); rect(c, 1, 4, 6, 3, '#7d9c62'); rect(c, -7, -7, 14, 4, '#e2b4a8'); rect(c, -4, -10, 8, 11, '#e9c3ad'); rect(c, -2, -7, 4, 4, '#d7af64'); }
    else if (icon === 'sandwich') { rect(c, -9, -6, 18, 13, '#c79558'); rect(c, -7, -8, 14, 17, '#e6c48b'); rect(c, -9, -1, 18, 4, '#81a05f'); rect(c, -9, 2, 18, 2, '#bd7962'); }
    else if (icon === 'ticket') { rect(c, -11, -6, 22, 13, '#d9b574'); rect(c, 4, -6, 1, 13, '#9c7c4a'); rect(c, -7, -2, 8, 2, '#8b6f4d'); }
    else { rect(c, -8, -10, 16, 21, '#73948c'); rect(c, -6, -9, 2, 19, '#a7c1ab'); rect(c, -2, -4, 7, 2, '#e3d8ad'); rect(c, -2, 0, 5, 2, '#e3d8ad'); rect(c, -7, 8, 14, 2, '#e9dfc5'); }
  }
  c.restore();
}

/** Render the scene without owning gameplay state or DOM interactions. */
export class TownRenderer {
  /** Create a responsive canvas camera. */
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.zoom = 1.25; this.camera = { x: 800, y: 700 }; this.visualPlayers = new Map(); this.backgrounds = new Map();
    this.observer = new ResizeObserver(this.resize.bind(this)); this.observer.observe(canvas); this.resize();
  }
  /** Match the canvas backing buffer to its CSS size and display density. */
  resize() { const box = this.canvas.getBoundingClientRect(); this.width = box.width; this.height = box.height; this.dpr = Math.min(devicePixelRatio || 1, 2); this.canvas.width = Math.round(box.width * this.dpr); this.canvas.height = Math.round(box.height * this.dpr); }
  /** Release observers and any cached canvas textures. */
  destroy() { this.observer.disconnect(); this.backgrounds.clear(); }
  /** Convert a mouse/touch location to the active map’s coordinates. */
  worldPoint(clientX, clientY) { const b = this.canvas.getBoundingClientRect(); return { x: (clientX - b.left - this.width / 2) / this.scale + this.camera.x, y: (clientY - b.top - this.height / 2) / this.scale + this.camera.y }; }
  /** Pick the nearest visible entity beneath a pointer. */
  pick(point, objects, players) {
    const hit = [...objects, ...players.map(p => ({ ...p, kind: 'player' }))].filter(o => o.width ? point.x >= o.x && point.x <= o.x + o.width && point.y >= o.y && point.y <= o.y + o.height : Math.abs(point.x - o.x) < 22 && point.y > o.y - 40 && point.y < o.y + 15);
    return hit.sort((a, b) => distance(point, anchor(a)) - distance(point, anchor(b)))[0];
  }
  /** Cache terrain pixels so map detail costs no per-frame drawing work. */
  terrain(map, palette) {
    if (this.backgrounds.has(map)) return this.backgrounds.get(map);
    const canvas = document.createElement('canvas'); canvas.width = map.width; canvas.height = map.height; const c = canvas.getContext('2d');
    const indoor = map.environment === 'indoor'; rect(c, 0, 0, map.width, map.height, indoor ? palette.floor : palette.grass);
    if (indoor) {
      for (let y = 0; y < map.height; y += 24) for (let x = 0; x < map.width; x += 70) { rect(c, x + (y % 48 ? 35 : 0), y, 68, 1, '#0000000d'); rect(c, x + (y % 48 ? 35 : 0), y, 1, 24, '#0000000b'); }
      rect(c, 0, 0, map.width, 28, '#403e3c'); rect(c, 12, 28, map.width - 24, 18, palette.wall); rect(c, 0, 0, 12, map.height, '#4c4b42'); rect(c, map.width - 12, 0, 12, map.height, '#4c4b42');
    } else {
      for (let i = 0; i < 9500; i++) { const x = (i * 317 + 19) % map.width, y = (i * 541 + 71) % map.height; rect(c, x, y, i % 5 === 0 ? 3 : 2, 2, i % 2 ? '#ffffff0c' : '#283c2610'); }
    }
    for (const s of map.surfaces) {
      if (s.type === 'road') { rect(c, s.x - 12, s.y - 12, s.width + 24, s.height + 24, '#b7b6a0'); rect(c, s.x - 2, s.y - 2, s.width + 4, s.height + 4, '#647069'); }
      rect(c, s.x, s.y, s.width, s.height, palette[s.type] || (s.type === 'rug' ? '#925b56' : palette.path));
      if (s.type === 'road') {
        if (s.width > s.height) for (let x = s.x + 25; x < s.x + s.width; x += 55) rect(c, x, s.y + s.height / 2, 24, 3, '#c6c4aa');
        else for (let y = s.y + 25; y < s.y + s.height; y += 55) rect(c, s.x + s.width / 2, y, 3, 24, '#c6c4aa');
      }
      if (s.type === 'path') { c.strokeStyle = '#9a9d8325'; c.lineWidth = 1; for (let x = s.x; x < s.x + s.width; x += 24) { c.beginPath(); c.moveTo(x, s.y); c.lineTo(x, s.y + s.height); c.stroke(); } for (let y = s.y; y < s.y + s.height; y += 24) { c.beginPath(); c.moveTo(s.x, y); c.lineTo(s.x + s.width, y); c.stroke(); } }
      if (s.type === 'rug') { c.strokeStyle = '#c9ab7455'; c.lineWidth = 3; c.strokeRect(s.x + 8, s.y + 8, s.width - 16, s.height - 16); }
      if (s.type === 'water') for (let i = 0; i < 60; i++) rect(c, s.x + (i * 43) % (s.width - 20), s.y + (i * 37) % s.height, 16, 2, '#c3dbd54a');
    }
    this.backgrounds.set(map, canvas); return canvas;
  }
  /** Paint one building using metadata shape, color and architectural style. */
  building(c, o) {
    const { x, y, width: w, height: h } = o, roof = o.color || '#9e7c65';
    rect(c, x + 9, y + 14, w, h + 5, '#2e46342c'); rect(c, x - 3, y + 5, w + 6, h - 5, '#5a6150'); rect(c, x, y + 10, w, h - 10, '#ded3b4');
    rect(c, x - 7, y, w + 14, h - 45, '#5f5c50'); rect(c, x - 5, y - 3, w + 10, h - 48, roof);
    for (let yy = y + 4; yy < y + h - 48; yy += 10) { rect(c, x - 3, yy, w + 6, 1, '#332c2a27'); for (let xx = x + ((yy % 20) ? 6 : 15); xx < x + w; xx += 23) rect(c, xx, yy, 1, 9, '#332c2a18'); }
    rect(c, x - 4, y - 3, w + 8, 4, '#ffffff22'); rect(c, x - 6, y + h - 49, w + 12, 5, '#555a4b');
    for (const wx of [x + 22, x + w - 51]) { rect(c, wx - 3, y + h - 34, 33, 26, '#a59470'); rect(c, wx, y + h - 32, 27, 20, '#7eaaad'); rect(c, wx, y + h - 32, 27, 3, '#c8e0d4'); rect(c, wx + 12, y + h - 32, 3, 20, '#ede0ba'); rect(c, wx, y + h - 23, 27, 2, '#ede0ba'); }
    rect(c, x + w / 2 - 13, y + h - 35, 26, 35, '#695a48'); rect(c, x + w / 2 - 10, y + h - 32, 20, 30, '#8e7960'); rect(c, x + w / 2 + 5, y + h - 16, 3, 3, '#dcc68b');
    rect(c, x + w / 2 - 19, y + h, 38, 6, '#c7bda1');
    if (o.style === 'house') { rect(c, x + 24, y - 13, 18, 25, '#8b7863'); rect(c, x + 21, y - 15, 24, 5, '#b2a18b'); rect(c, x + w - 57, y + h - 7, 39, 7, '#7e9564'); rect(c, x + w - 51, y + h - 11, 4, 6, '#d4ac8e'); }
    else { rect(c, x + 8, y + h - 48, w - 16, 13, roof); for (let xx = x + 8; xx < x + w - 8; xx += 20) rect(c, xx, y + h - 48, 10, 13, '#efe2b8'); }
    label(c, o.name, x + w / 2, y + h + 27, '#f5eed7', 11);
  }
  /** Paint furniture and scenery from reusable visual primitives. */
  furniture(c, o, time) {
    const { x, y } = o, w = o.width || 50, h = o.height || 30;
    if (o.style === 'fountain') {
      rect(c, x - 3, y + 4, w + 6, h, '#445b4530'); rect(c, x + 5, y, w - 10, h, '#a8afa0'); rect(c, x, y + 10, w, h - 20, '#b9bfad'); rect(c, x + 10, y + 13, w - 20, h - 26, '#79aeb0');
      rect(c, x + w / 2 - 8, y + 20, 16, 38, '#d0d3bb'); rect(c, x + w / 2 - 17, y + 15, 34, 8, '#dbe0ca');
      for (let i = 0; i < 5; i++) rect(c, x + 19 + i * 14, y + 35 + Math.sin(time / 500 + i) * 8, 9, 2, '#d5e4cc');
    } else if (o.style === 'plant') { rect(c, x + 5, y + h - 15, w - 10, 18, '#ad7b59'); rect(c, x + w / 2 - 2, y + 7, 4, h - 15, '#56734a'); rect(c, x, y + 4, w, 14, '#5c8556'); rect(c, x + 8, y - 5, w - 16, 29, '#769b65'); }
    else if (o.style === 'screen') { rect(c, x, y, w, h, '#333f40'); rect(c, x + 8, y + 5, w - 16, h - 10, '#c4d4cb'); label(c, 'THE LONG WAY HOME', x + w / 2, y + h / 2, '#faf4dc', 12); }
    else { rect(c, x + 5, y + h, 10, 8, '#5b5145'); rect(c, x + w - 15, y + h, 10, 8, '#5b5145'); rect(c, x, y, w, h, o.style === 'game-table' ? '#426f62' : '#b18b60'); rect(c, x + 4, y + 4, w - 8, h - 8, o.style === 'game-table' ? '#527d6b' : '#c39a6b'); if (o.style === 'game-table') { label(c, 'LUCKY DICE · 5G', x + w / 2, y + h / 2); } }
  }
  /** Paint trees, lamps and benches from metadata decorations. */
  decoration(c, o) {
    const { x, y } = o;
    if (o.type === 'tree') { rect(c, x - 18, y + 2, 60, 14, '#344d3222'); rect(c, x - 5, y - 24, 10, 36, '#826c4f'); rect(c, x - 31, y - 65, 62, 39, '#486a47'); rect(c, x - 22, y - 80, 44, 64, '#587e50'); rect(c, x - 29, y - 61, 50, 29, '#658c57'); rect(c, x - 19, y - 75, 32, 20, '#769962'); rect(c, x - 26, y - 54, 9, 6, '#82a56b'); rect(c, x + 11, y - 40, 12, 5, '#50754a'); }
    else if (o.type === 'bench') { rect(c, x - 24, y - 11, 48, 8, '#ac8a5f'); rect(c, x - 24, y, 48, 7, '#c1a071'); rect(c, x - 20, y + 7, 4, 6, '#606c5b'); rect(c, x + 16, y + 7, 4, 6, '#606c5b'); }
    else { rect(c, x - 2, y - 44, 4, 50, '#546557'); rect(c, x - 7, y - 48, 14, 11, '#e9d7a1'); rect(c, x - 9, y - 51, 18, 4, '#536154'); }
  }
  /** Draw one scene with camera tracking, animated avatars and interaction markers. */
  draw({ map, pack, objects, players = [], local, selected, time, overview = false }) {
    if (!map || !this.width) return;
    const c = this.ctx; c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.imageSmoothingEnabled = false; c.clearRect(0, 0, this.width, this.height); rect(c, 0, 0, this.width, this.height, '#4d6555');
    this.scale = overview ? Math.max(this.width / map.width, this.height / map.height) * 1.05 : this.zoom;
    if (overview) this.camera = { x: map.width / 2, y: map.height / 2 }; else if (local) { this.camera.x += (local.x - this.camera.x) * .12; this.camera.y += (local.y - this.camera.y) * .12; }
    c.save(); c.translate(this.width / 2, this.height / 2); c.scale(this.scale, this.scale); c.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));
    c.drawImage(this.terrain(map, pack.palette || {}), 0, 0);
    const drawables = [...map.decorations.map(o => ({ ...o, decoration: true })), ...objects, ...players.map(p => ({ ...p, kind: 'player' }))];
    drawables.sort((a, b) => a.y + (a.height || 0) - b.y - (b.height || 0));
    for (const o of drawables) {
      if (o.decoration) { this.decoration(c, o); continue; }
      const chosen = selected?.id === o.id;
      if (chosen) { c.strokeStyle = '#f8e6ac'; c.lineWidth = 2; const a = anchor(o); c.beginPath(); c.ellipse(a.x, a.y + 3, o.width ? 24 : 20, 9, 0, 0, Math.PI * 2); c.stroke(); }
      if (o.kind === 'building') this.building(c, o);
      if (o.kind === 'furniture') this.furniture(c, o, time);
      if (o.kind === 'npc' || o.kind === 'player') {
        let p = o;
        if (o.kind === 'player') { const previous = this.visualPlayers.get(o.id); if (previous && previous.map === o.map) { p = { ...o, x: previous.x + (o.x - previous.x) * .3, y: previous.y + (o.y - previous.y) * .3 }; } this.visualPlayers.set(o.id, p); }
        drawSprite(c, p.x, p.y, o.color, o.direction || 'down', o.moving, time);
        if (!overview) label(c, o.id === local?.id ? `${o.name} · you` : o.name, p.x, p.y + 22, o.kind === 'npc' ? '#e8d3a2' : '#f9f4e2', 10);
        if (o.kind === 'npc') { rect(c, o.x - 6, o.y - 52 + Math.sin(time / 500) * 2, 12, 10, '#f3e5be'); rect(c, o.x - 3, o.y - 42 + Math.sin(time / 500) * 2, 3, 3, '#f3e5be'); }
      }
      if (o.kind === 'pickup') { const item = o.itemKey ? this.items?.[o.itemKey] : pack.items[o.item]; drawItem(c, item, o.x, o.y + Math.sin(time / 400) * 2); if (!overview) { c.fillStyle = '#fff0bb'; c.fillRect(o.x + 12, o.y - 13, 2, 5); c.fillRect(o.x + 10, o.y - 11, 6, 1); } }
      if (o.kind === 'sign') { rect(c, o.x - 2, o.y - 6, 4, 20, '#7e6d4b'); rect(c, o.x - 18, o.y - 29, 36, 24, '#d4bc84'); rect(c, o.x - 12, o.y - 21, 24, 2, '#8a7852'); rect(c, o.x - 8, o.y - 15, 16, 2, '#8a7852'); }
      if (o.kind === 'door') { rect(c, o.x - 25, o.y - 12, 50, 25, '#d1bb8b'); label(c, '↑ EXIT', o.x, o.y - 25, '#f5e9c7', 11); }
    }
    c.restore();
  }
  /** Create an item image shared by the inventory and shop UI. */
  icon(item) { const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64; drawItem(canvas.getContext('2d'), item, 32, 32, 2); return canvas.toDataURL(); }
}
