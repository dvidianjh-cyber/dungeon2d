/** Last Modified: 2026-10-17. DOM presentation and user intent, independent of world rules. */
import { anchor, distance, itemKey, mapKey, REACH } from '../game/World.js';
import { drawSprite } from '../render/TownRenderer.js';

/** Find a stable application element. */
const $ = id => document.getElementById(id);
/** Escape all metadata and network text before HTML templating. */
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
/** Set visibility without changing layout contracts. */
const show = (id, visible) => $(id).classList.toggle('hidden', !visible);
/** Build a declarative action button with safe attribute values. */
const button = (verb, text, disabled = false, item = '') => `<button data-verb="${esc(verb)}" ${item ? `data-buy="${esc(item)}"` : ''} ${disabled ? 'disabled' : ''}>${esc(text)}</button>`;

export class AdventureUI {
  /** Connect the reusable collaborators and initialize view-only state. */
  constructor(library, session, renderer, sound) {
    Object.assign(this, { library, session, renderer, sound }); this.mode = 'solo'; this.color = 0; this.playing = false; this.keys = new Set(); this.icons = new Map(); this.journal = []; this.abort = new AbortController(); this.lastInput = 0; this.lastPaint = 0;
  }
  /** Install named, disposable handlers and load the pack library. */
  async init() {
    const options = { signal: this.abort.signal };
    document.addEventListener('click', this.click.bind(this), options);
    document.addEventListener('change', this.change.bind(this), options);
    document.addEventListener('submit', this.submit.bind(this), options);
    window.addEventListener('keydown', this.keyDown.bind(this), options);
    window.addEventListener('keyup', this.keyUp.bind(this), options);
    window.addEventListener('blur', this.resetKeys.bind(this), options);
    document.addEventListener('visibilitychange', this.resetKeys.bind(this), options);
    document.addEventListener('focusin', this.focusIn.bind(this), options);
    document.addEventListener('pointerdown', this.pointerDown.bind(this), options);
    document.addEventListener('pointerup', this.resetTouch.bind(this), options);
    document.addEventListener('pointercancel', this.resetTouch.bind(this), options);
    $('gameCanvas').addEventListener('wheel', this.wheel.bind(this), { ...options, passive: false });
    window.addEventListener('pagehide', this.destroy.bind(this), { ...options, once: true });
    for (const type of ['ready', 'snapshot', 'result', 'status', 'chat', 'error', 'ended']) this.session.addEventListener(type, this.sessionEvent.bind(this), options);
    try { $('player-name').value = localStorage.getItem('dungeon2d-name') || 'Traveller'; this.color = Number(localStorage.getItem('dungeon2d-color') || 0); } catch {}
    this.soundButton(); this.avatar(); this.frameBound = this.frame.bind(this); this.frameId = requestAnimationFrame(this.frameBound);
    try { await this.library.load(); this.packOptions(); $('start-button').disabled = false; this.menuStatus('Your adventure starts whenever you’re ready.'); }
    catch (error) { this.menuStatus(error.message, true); }
  }
  /** Unsubscribe listeners and close network/audio resources when the page leaves. */
  destroy() { this.abort.abort(); this.session.close(); this.renderer.destroy(); cancelAnimationFrame(this.frameId); clearTimeout(this.toastTimer); this.sound.context?.close().catch(() => {}); }
  /** Rebuild the installed-pack selector without relying on filenames. */
  packOptions(selected = 'littleton') { $('pack-select').innerHTML = [...this.library.packs.values()].map(p => `<option value="${esc(p.id)}">${esc(p.title)}</option>`).join(''); $('pack-select').value = selected; this.packChanged(); }
  /** Update menu copy and preview from the selected pack. */
  packChanged() { const p = this.library.packs.get($('pack-select').value); if (!p) return; $('pack-description').textContent = p.description; $('start-button').firstElementChild.textContent = this.mode === 'join' ? 'Join the adventure' : `Step into ${p.title}`; this.avatar(); }
  /** Show actionable menu feedback. */
  menuStatus(text, error = false) { $('menu-status').textContent = text; $('menu-status').classList.toggle('error', error); }
  /** Draw the chosen outfit on the menu and in-game player card. */
  avatar() { const colors = this.library.packs.get($('pack-select').value)?.player.colors || ['#617f78', '#ad6b58', '#7184a3', '#af955e', '#9c7290', '#7f955d']; for (const id of ['avatar-preview', 'hud-avatar']) { const canvas = $(id), c = canvas.getContext('2d'); c.clearRect(0, 0, canvas.width, canvas.height); drawSprite(c, canvas.width / 2, canvas.height - 8, this.player?.color || colors[this.color % colors.length], 'down', false, 0, 1.2); } }
  /** Reflect the audio preference with an accessible toggle label. */
  soundButton() { $('sound-toggle').textContent = this.sound.muted ? '♪̸' : '♫'; $('sound-toggle').setAttribute('aria-label', this.sound.muted ? 'Unmute sound' : 'Mute sound'); $('sound-toggle').title = this.sound.muted ? 'Sound off' : 'Sound on'; }
  /** Central action delegation keeps dynamic panels free of listener leaks. */
  async click(event) {
    const b = event.target.closest('button');
    if (b) { this.sound.unlock(); this.sound.play('menu'); }
    if (event.target.closest('.brand') && this.playing) { event.preventDefault(); this.openLeave(); return; }
    if (event.target === $('gameCanvas') && this.playing) {
      this.resetKeys(); const picked = this.renderer.pick(this.renderer.worldPoint(event.clientX, event.clientY), this.objects(), Object.values(this.snapshot.players).filter(p => p.id !== this.session.id && p.map === this.player.map));
      if (picked) this.select(picked); else { this.selected = null; $('side-panel').classList.remove('mobile-open'); this.viewFingerprint = ''; } return;
    }
    if (!b) return;
    if (b.dataset.close) { $(b.dataset.close).close(); this.resetKeys(); return; }
    if (b.dataset.mode) { this.mode = b.dataset.mode; document.querySelectorAll('[data-mode]').forEach(el => el.classList.toggle('active', el === b)); show('join-label', this.mode === 'join'); $('join-code').required = this.mode === 'join'; this.packChanged(); return; }
    if (b.dataset.tab) { this.tab(b.dataset.tab); return; }
    if (b.dataset.item) { this.selectedItem = b.dataset.item; this.viewFingerprint = ''; return; }
    if (b.dataset.verb) { this.verb(b.dataset.verb, b.dataset.buy); return; }
    if (b.dataset.track) { const obj = this.objects().find(o => o.id === b.dataset.track); if (obj) { this.select(obj); $('map-dialog').close(); this.toast(`Head to ${obj.name}. Its entrance is marked on your map.`); } return; }
    switch (b.id) {
      case 'avatar-button': this.color = (this.color + 1) % 6; this.avatar(); break;
      case 'sound-toggle': this.sound.toggle(); this.soundButton(); break;
      case 'help-button': this.resetKeys(); $('help-dialog').showModal(); break;
      case 'menu-button': this.openLeave(); break;
      case 'confirm-leave': $('leave-dialog').close(); this.leave(); break;
      case 'map-button': this.openMap(); break;
      case 'zoom-in': this.renderer.zoom = Math.min(2.2, this.renderer.zoom + .15); break;
      case 'zoom-out': this.renderer.zoom = Math.max(.55, this.renderer.zoom - .15); break;
      case 'mobile-panel-button': $('side-panel').classList.toggle('mobile-open'); break;
      case 'import-button': $('pack-file').click(); break;
      case 'export-button': this.download(); break;
      case 'copy-code': try { await navigator.clipboard.writeText(this.session.code); this.toast('Room code copied. Send it to a friend.'); } catch { this.toast(`Your room code is ${this.session.code}.`); } break;
    }
  }
  /** Handle pack selection and local archive import. */
  async change(event) {
    if (event.target.id === 'pack-select') this.packChanged();
    if (event.target.id === 'pack-file' && event.target.files[0]) {
      try { const result = await this.library.importFile(event.target.files[0]); this.packOptions(result.entry); this.menuStatus(result.persisted ? 'Dungeon installed. Ready for a new adventure.' : 'Dungeon loaded for this visit; browser storage is full.'); }
      catch (error) { this.menuStatus(`Could not import: ${error.message}`, true); }
      event.target.value = '';
    }
  }
  /** Create a real ZIP download with the custom dungeon extension. */
  download() {
    try { const id = $('pack-select').value, data = this.library.export(id), url = URL.createObjectURL(new Blob([data], { type: 'application/zip' })), link = document.createElement('a'); link.href = url; link.download = `${id}.dungeon`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); this.menuStatus('Pack downloaded with all its linked worlds.'); }
    catch (error) { this.menuStatus(error.message, true); }
  }
  /** Submit a room setup or room chat message. */
  async submit(event) {
    event.preventDefault(); this.sound.unlock();
    if (event.target.id === 'chat-form') { const text = $('chat-input').value.trim(); if (text) { this.session.chat(text); $('chat-input').value = ''; } return; }
    if (event.target.id !== 'start-form') return;
    const name = $('player-name').value.trim(); if (!name) { this.menuStatus('Tell us your name first.', true); return; }
    try { localStorage.setItem('dungeon2d-name', name); localStorage.setItem('dungeon2d-color', this.color); } catch {}
    $('start-button').disabled = true;
    try {
      if (this.mode === 'join') { const code = $('join-code').value.trim().toUpperCase(); if (!/^LT-[A-Z0-9]{8}$/.test(code)) throw new Error('Enter a room code in the form LT-XXXXXXXX.'); this.menuStatus('Finding your friends…'); this.session.join(code, name, this.color); }
      else { const id = $('pack-select').value; await this.session.host(this.library.bundle(id), id, name, this.color, this.mode === 'host'); }
    } catch (error) { this.menuStatus(error.message, true); $('start-button').disabled = false; }
  }
  /** Update the view in response to transport-neutral session events. */
  sessionEvent(event) {
    const data = event.detail;
    if (event.type === 'ready') {
      this.packs = new Map(data.packs.map(p => [p.id, p])); this.maps = {}; this.items = {}; this.icons.clear(); this.renderer.backgrounds.clear(); this.renderer.visualPlayers.clear();
      for (const p of data.packs) { for (const m of p.maps) this.maps[mapKey(p.id, m.id)] = m; for (const [id, item] of Object.entries(p.items)) this.items[itemKey(p.id, id)] = item; }
      this.renderer.items = this.items; this.snapshot = data.snapshot; this.player = data.snapshot.players[data.id]; this.playing = true; this.selected = null; this.selectedItem = null; this.journal = []; this.viewFingerprint = '';
      this.renderer.camera = { x: this.player.x, y: this.player.y }; this.lastMap = this.player.map; document.body.classList.add('playing');
      for (const id of ['welcome', 'preview-caption', 'preview-badge']) show(id, false);
      for (const id of ['play-location', 'menu-button', 'game-hud', 'side-panel', 'game-controls']) show(id, true);
      $('side-panel').classList.remove('mobile-open'); $('chat-messages').replaceChildren(); this.tab('inventory', false); $('start-button').disabled = false;
      $('session-status').textContent = this.mode === 'solo' ? 'Your own little adventure' : 'Connecting the neighbourhood…'; show('copy-code', false);
      this.avatar(); this.log('Welcome. Walk around, meet a neighbour, and make yourself at home.'); this.toast('Welcome! Move with WASD. Click something interesting, or press E nearby.'); this.sound.play('enter'); $('gameCanvas').focus();
    }
    if (event.type === 'snapshot') {
      this.snapshot = data; this.player = data.players[this.session.id];
      if (this.player && this.player.map !== this.lastMap) { this.selected = null; this.shopping = false; this.lastMap = this.player.map; this.viewFingerprint = ''; this.renderer.camera = { x: this.player.x, y: this.player.y }; this.resetKeys(); }
    }
    if (event.type === 'result') { this.toast(data.text, !data.ok); this.sound.play(data.ok ? data.sound : 'error'); if (data.ok) this.log(data.text); this.viewFingerprint = ''; }
    if (event.type === 'chat') { const div = document.createElement('div'); div.className = 'chat-message'; const name = document.createElement('b'); name.textContent = data.name; div.append(name, document.createTextNode(data.text)); $('chat-messages').append(div); while ($('chat-messages').children.length > 100) $('chat-messages').firstChild.remove(); $('chat-messages').scrollTop = $('chat-messages').scrollHeight; }
    if (event.type === 'status') { $('session-status').textContent = data.text; if (data.code) { $('copy-code').textContent = `${data.code}  ⧉`; show('copy-code', true); } if (data.text.length > 80) this.toast(data.text); }
    if (event.type === 'error' || event.type === 'ended') { if (this.playing) this.leave(); this.menuStatus(data, true); $('start-button').disabled = false; }
  }
  /** Ask before deliberately ending a live adventure. */
  openLeave() { this.resetKeys(); $('leave-description').textContent = this.session.isHost && Object.keys(this.snapshot.players).length > 1 ? 'You are the host. Leaving will close the room for everyone and end this session’s progress.' : 'This session’s progress will end. Your installed dungeon packs will stay here.'; $('leave-dialog').showModal(); }
  /** Return to the main menu and tear down the current session. */
  leave() { this.session.close(); this.playing = false; this.player = null; this.selected = null; this.keys.clear(); this.touch = null; clearTimeout(this.toastTimer); show('toast', false); document.body.classList.remove('playing'); for (const id of ['welcome', 'preview-caption', 'preview-badge']) show(id, true); for (const id of ['play-location', 'menu-button', 'game-hud', 'side-panel', 'game-controls', 'copy-code']) show(id, false); this.menuStatus('There is always another little adventure.'); this.avatar(); }
  /** Clear held keys on focus changes to prevent runaway avatars. */
  resetKeys() { this.keys.clear(); this.touch = null; if (this.playing) this.session.input({ x: 0, y: 0 }); }
  /** Stop walking when a text input gains focus. */
  focusIn(event) { if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) this.resetKeys(); }
  /** Map keyboard input to movement and accessible adventure shortcuts. */
  keyDown(event) {
    if (!this.playing || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || document.querySelector('dialog[open]')) return;
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) { event.preventDefault(); this.keys.add(key); }
    if (event.repeat) return;
    if (key === 'e') { event.preventDefault(); const obj = this.nearest(); if (obj) this.select(obj); }
    if (key === 'i') this.tab('inventory');
    if (key === 'm') this.openMap();
    if (key === 'escape') { $('side-panel').classList.remove('mobile-open'); this.selected = null; this.viewFingerprint = ''; }
  }
  /** Release movement keys regardless of where focus has moved. */
  keyUp(event) { this.keys.delete(event.key.toLowerCase()); }
  /** Capture touch directional input and unlock gesture-gated sounds. */
  pointerDown(event) { this.sound.unlock(); const b = event.target.closest('[data-direction]'); if (b) { event.preventDefault(); this.touch = b.dataset.direction; b.setPointerCapture(event.pointerId); } }
  /** Release touch movement even if the finger leaves the button. */
  resetTouch() { this.touch = null; }
  /** Zoom the scene around the player while suppressing page scroll. */
  wheel(event) { if (!this.playing) return; event.preventDefault(); this.renderer.zoom = Math.max(.55, Math.min(2.2, this.renderer.zoom - Math.sign(event.deltaY) * .1)); }
  /** Return live objects for the player’s map. */
  objects() { if (!this.player) return []; const state = this.snapshot.state[this.player.map]; return [...this.maps[this.player.map].objects.filter(o => !state.removed.includes(o.id)), ...state.drops]; }
  /** Find the nearest entity for keyboard interaction. */
  nearest() { return this.objects().filter(o => distance(anchor(o), this.player) <= REACH).sort((a, b) => distance(anchor(a), this.player) - distance(anchor(b), this.player))[0]; }
  /** Inspect a selected entity and expose its supported verbs. */
  select(obj) { this.selected = obj; this.shopping = false; this.viewFingerprint = ''; $('side-panel').classList.add('mobile-open'); this.sound.play('menu'); }
  /** Switch the persistent panel to a named view. */
  tab(name, open = true) { for (const tab of ['inventory', 'journal', 'chat']) show(`${tab}-panel`, tab === name); document.querySelectorAll('[data-tab]').forEach(el => el.classList.toggle('active', el.dataset.tab === name)); if (open) $('side-panel').classList.add('mobile-open'); }
  /** Send a verb without directly changing world or inventory state. */
  verb(verb, buyItem) {
    if (verb === 'buy' && !buyItem) { this.shopping = !this.shopping; this.viewFingerprint = ''; return; }
    if (verb === 'sell' && !this.selectedItem) { this.tab('inventory'); this.toast('Choose an item in your inventory, then press Sell.'); return; }
    if (this.selected?.kind === 'player') { if (verb === 'talk') { this.tab('chat'); $('chat-input').focus(); } else this.toast(`${this.selected.name} is exploring with you. Messages in Friends are shared with the room.`); return; }
    this.session.action({ verb, target: this.selected?.id, item: buyItem || this.selectedItem });
  }
  /** Show transient feedback and retain longer messages in the journal. */
  toast(text, error = false) { $('toast').textContent = text; $('toast').classList.toggle('error', error); show('toast', true); clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => show('toast', false), Math.min(14000, Math.max(4500, text.length * 60))); }
  /** Append a bounded event journal, rendering text safely. */
  log(text) { this.journal.unshift(text); this.journal = this.journal.slice(0, 50); $('journal-list').innerHTML = this.journal.map(t => `<li>${esc(t)}</li>`).join(''); }
  /** Cache generated pixel icons by globally qualified item ID. */
  icon(key) { if (!this.icons.has(key)) this.icons.set(key, this.renderer.icon(this.items[key])); return this.icons.get(key); }
  /** Render context actions, stock and pockets only when their state changes. */
  panels() {
    const p = this.player; if (!p) return;
    if (this.selected) this.selected = this.selected.kind === 'player' ? this.snapshot.players[this.selected.id] && { ...this.snapshot.players[this.selected.id], kind: 'player' } : this.objects().find(o => o.id === this.selected.id);
    if (this.selected?.kind === 'player' && this.selected.map !== p.map) this.selected = null;
    if (this.selectedItem && !p.inventory[this.selectedItem]) this.selectedItem = null;
    const o = this.selected, near = o && distance(p, anchor(o)) <= REACH, state = this.snapshot.state[p.map];
    const fingerprint = JSON.stringify([p.map, p.inventory, p.gold, p.bank, p.quests, o?.id, near, this.shopping, this.selectedItem, state.shops, Object.values(this.snapshot.players).map(p => [p.id, p.name, p.map])]);
    if (fingerprint === this.viewFingerprint) return; this.viewFingerprint = fingerprint;
    if (o) {
      const actions = o.kind === 'player' ? ['inspect', 'talk'] : o.actions;
      $('selection-panel').innerHTML = `<div class="section-label">${esc(o.kind === 'npc' ? 'A FAMILIAR FACE' : o.kind === 'building' ? 'AROUND THE NEIGHBOURHOOD' : o.kind === 'player' ? 'A FELLOW ADVENTURER' : 'SOMETHING TO DISCOVER')}<span>✧</span></div><h2>${esc(o.name)}</h2><p>${esc(o.description || this.items[o.itemKey || itemKey(p.map.split('/')[0], o.item)]?.description || 'An adventure is better with company.')}</p><div class="object-actions">${actions.map(a => button(a, ({ inspect: 'Inspect', talk: 'Talk', enter: 'Enter ↗', take: 'Take', use: o.effect?.type === 'dice' ? `Play · ${o.effect.cost} gold` : 'Use', buy: 'Buy', sell: 'Sell', deposit: 'Deposit 10', withdraw: 'Withdraw 10' })[a], a !== 'inspect' && !near)).join('')}</div><div class="range-note">${near ? '◦ Within reach' : '↗ Walk closer to interact'}${o.bank ? ` · Bank: ${p.bank} gold` : ''}</div>${o.shop && this.shopping ? `<div class="shop-items">${Object.entries(state.shops[o.id]).map(([id, qty]) => { const key = itemKey(p.map.split('/')[0], id), item = this.items[key]; return `<div class="shop-row"><img src="${this.icon(key)}" alt=""><span>${esc(item.name)}<small>${qty} in stock</small></span>${button('buy', `${item.value} G`, !near || !qty || p.gold < item.value, key)}</div>`; }).join('')}</div>` : ''}`;
    } else $('selection-panel').innerHTML = '<div class="section-label">A WORLD TO DISCOVER <span>✧</span></div><h2>Follow your curiosity.</h2><p>Click a person, building or object to see what you can do. Press E to select something nearby.</p>';
    const inventory = Object.entries(p.inventory).filter(([, qty]) => qty > 0);
    $('item-count').textContent = `${inventory.reduce((sum, [, qty]) => sum + qty, 0)} items`;
    $('inventory-grid').innerHTML = inventory.map(([key, qty]) => `<button class="inventory-slot ${key === this.selectedItem ? 'selected' : ''}" data-item="${esc(key)}" title="${esc(this.items[key].name)}" aria-label="${esc(this.items[key].name)}, ${qty}"><img src="${this.icon(key)}" alt=""><span class="quantity">${qty}</span></button>`).join('') + Array.from({ length: Math.max(0, 12 - inventory.length) }, () => '<div class="inventory-slot empty" aria-hidden="true"></div>').join('');
    const item = this.items[this.selectedItem];
    $('item-detail').innerHTML = item ? `<h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><div class="item-value">◈ ${item.value} gold value · sells for ${Math.floor(item.value / 2)}</div><div class="item-actions">${button('inspect-item', 'Inspect')}${button('use-item', o && (!item.use || item.use.type === 'target') ? `Use on ${o.name}` : 'Use')}${button('drop', 'Drop')}${o?.shop ? button('sell', `Sell · ${Math.floor(item.value / 2)} G`, !near || item.value < 2) : ''}</div>` : '<p>A little room for the things you find along the way. Select an item to use, drop or sell it.</p>';
    $('player-count').textContent = Object.keys(this.snapshot.players).length;
    $('roster').innerHTML = `<strong>IN THIS ADVENTURE</strong>${Object.values(this.snapshot.players).map(peer => `<div>${esc(peer.name)}${peer.id === p.id ? ' (you)' : ''} · ${esc(this.maps[peer.map]?.name)}</div>`).join('')}`;
    const quests = Object.entries(p.quests).map(([id, status]) => { const parts = id.split('/'); return { status, quest: this.maps[`${parts[0]}/${parts[1]}`]?.objects.find(o => o.quest?.id === parts[2])?.quest }; });
    $('quest-list').innerHTML = quests.map(({ status, quest }) => `<div class="quest-card">${status === 'complete' ? '✓' : '✧'} ${esc(quest?.title || 'A little favour')}<p>${esc(status === 'complete' ? quest?.completed : quest?.text)}</p></div>`).join('');
    $('quest-hint').querySelector('p').textContent = quests.find(q => q.status === 'active')?.quest?.text || this.maps[p.map].hint || 'Look around, meet someone, and see where the day takes you.';
  }
  /** Draw a readable map with party members and selected destination. */
  paintMap(canvas, large = false) {
    const map = this.maps[this.player.map], pack = this.packs.get(this.player.map.split('/')[0]), c = canvas.getContext('2d'); const sx = canvas.width / map.width, sy = canvas.height / map.height;
    c.clearRect(0, 0, canvas.width, canvas.height); c.drawImage(this.renderer.terrain(map, pack.palette), 0, 0, canvas.width, canvas.height);
    for (const obj of this.objects()) {
      if (obj.kind === 'building' || obj.solid) { c.fillStyle = obj.color || '#777f6c'; c.fillRect(obj.x * sx, obj.y * sy, obj.width * sx, obj.height * sy); if (large) { c.font = '11px Segoe UI'; c.textAlign = 'center'; c.fillStyle = '#f9f1d9'; c.fillText(obj.name, (obj.x + obj.width / 2) * sx, (obj.y + obj.height / 2) * sy); } }
    }
    if (this.selected) { const a = anchor(this.selected); c.strokeStyle = '#fff1a8'; c.lineWidth = 2; c.strokeRect(a.x * sx - 5, a.y * sy - 5, 10, 10); }
    for (const p of Object.values(this.snapshot.players).filter(p => p.map === this.player.map)) { c.beginPath(); c.arc(p.x * sx, p.y * sy, large ? 5 : 3, 0, Math.PI * 2); c.fillStyle = p.id === this.player.id ? '#f6d176' : '#84c6e0'; c.fill(); c.strokeStyle = '#4c6248'; c.lineWidth = 1; c.stroke(); }
  }
  /** Open a full map and selectable destination directory. */
  openMap() { if (!this.playing) return; this.resetKeys(); $('map-title').textContent = this.maps[this.player.map].name; this.paintMap($('large-map'), true); $('map-places').innerHTML = this.objects().filter(o => o.kind === 'building' || o.kind === 'door').map(o => `<button data-track="${esc(o.id)}">${esc(o.name)} ↗</button>`).join(''); $('map-dialog').showModal(); }
  /** Animate sprites continuously, with input/network and DOM updates at bounded rates. */
  frame(time) {
    if (this.playing && this.player) {
      if (time - this.lastInput >= 50) {
        const blocked = document.querySelector('dialog[open]') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.hidden;
        const x = blocked ? 0 : Number(this.keys.has('d') || this.keys.has('arrowright') || this.touch === 'right') - Number(this.keys.has('a') || this.keys.has('arrowleft') || this.touch === 'left');
        const y = blocked ? 0 : Number(this.keys.has('s') || this.keys.has('arrowdown') || this.touch === 'down') - Number(this.keys.has('w') || this.keys.has('arrowup') || this.touch === 'up');
        this.session.input({ x, y }); this.lastInput = time;
      }
      const p = this.player, map = this.maps[p.map], pack = this.packs.get(p.map.split('/')[0]);
      this.renderer.draw({ map, pack, objects: this.objects(), players: Object.values(this.snapshot.players).filter(p2 => p2.map === p.map), local: p, selected: this.selected, time });
      if (time - this.lastPaint > 100) {
        this.panels(); $('gold-count').textContent = p.gold; $('hud-name').textContent = p.name; $('energy-bar').style.width = `${p.energy}%`; $('energy-label').textContent = `Energy ${p.energy}/100`; $('location-name').textContent = map.name; $('location-type').textContent = map.subtitle || '';
        const near = this.nearest(); $('nearby-prompt').querySelector('span').textContent = near ? near.name : 'Explore the neighbourhood'; this.paintMap($('minimap')); this.lastPaint = time;
      }
    } else if (this.library.packs.size) {
      const pack = this.library.packs.get($('pack-select').value);
      if (pack) { const map = pack.maps.find(m => m.id === pack.startMap); this.renderer.draw({ map, pack, objects: map.objects, overview: true, time }); }
    }
    this.frameId = requestAnimationFrame(this.frameBound);
  }
}
