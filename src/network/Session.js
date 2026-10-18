/** Last Modified: 2026-10-17. Reliable host-star networking and room lifecycle. */
import Peer from 'peerjs';
import { World } from '../game/World.js';

/** Transport-independent protocol controller with host-authoritative rules. */
export class Session extends EventTarget {
  /** Set up a reusable, initially disconnected session. */
  constructor() { super(); this.peers = new Map(); this.active = false; this.generation = 0; this.rates = new Map(); }
  /** Publish a typed session event without DOM dependencies. */
  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
  /** Create a solo world or expose a multiplayer room through PeerJS. */
  async host(packs, entry, name, color, online) {
    this.close(); this.active = true; this.isHost = true; this.id = 'host'; this.world = new World(packs, entry); this.world.addPlayer(this.id, name, color);
    this.emit('ready', { packs, entry, id: this.id, snapshot: this.world.snapshot() });
    this.timer = setInterval(this.tick.bind(this), 50);
    if (!online) { this.code = 'Solo adventure'; return; }
    this.code = `LT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const generation = this.generation;
    this.peer = new Peer(`dungeon2d-${this.code}`, { debug: 0 });
    this.peer.on('open', () => { if (generation === this.generation) { clearTimeout(this.timeout); this.emit('status', { text: 'Room open · invite your friends', code: this.code }); } });
    this.peer.on('connection', connection => { if (generation === this.generation) this.accept(connection); else connection.close(); });
    this.peer.on('error', error => { if (generation === this.generation) this.networkError(error); });
    this.peer.on('disconnected', () => { if (this.active && generation === this.generation) this.emit('status', { text: 'Signalling disconnected. Existing players can continue; rehost to accept new friends.' }); });
    this.timeout = setTimeout(() => this.emit('status', { text: 'Room signalling is taking longer than expected. You can keep playing solo.' }), 15000);
  }
  /** Connect to an existing room; the host supplies all pack metadata. */
  join(code, name, color) {
    this.close(); this.active = true; this.isHost = false; this.id = crypto.randomUUID(); this.code = code.trim().toUpperCase(); this.name = name; this.color = color;
    const generation = this.generation;
    this.peer = new Peer(undefined, { debug: 0 });
    this.peer.on('open', () => {
      if (!this.active || generation !== this.generation) return;
      this.connection = this.peer.connect(`dungeon2d-${this.code}`, { reliable: true, serialization: 'binary' });
      this.connection.on('open', () => this.send(this.connection, { type: 'hello', name, color }));
      this.connection.on('data', data => { if (generation === this.generation) this.receive(data); });
      this.connection.on('close', () => { if (generation === this.generation) this.hostLost(); });
      this.connection.on('error', error => { if (generation === this.generation) this.networkError(error); });
    });
    this.peer.on('error', error => { if (generation === this.generation) this.networkError(error); });
    this.timeout = setTimeout(() => { if (this.active && !this.ready) { this.close(); this.emit('error', 'Could not reach that room. Check the code and that the host is online.'); } }, 18000);
  }
  /** Attach one authenticated connection identity; payloads cannot impersonate another player. */
  accept(connection) {
    if (this.peers.size >= 7) { connection.on('open', () => { this.send(connection, { type: 'reject', text: 'This room is full (8 players).' }); setTimeout(() => connection.close(), 200); }); return; }
    const generation = this.generation, id = `guest-${connection.peer}`;
    if (this.peers.has(id)) { connection.close(); return; }
    this.peers.set(id, connection);
    const helloTimer = setTimeout(() => { if (!this.world?.players[id]) connection.close(); }, 10000);
    connection.on('data', raw => {
      try {
        if (!this.active || generation !== this.generation || typeof raw !== 'string' || raw.length > 4096) return;
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object') return;
        if (data.type === 'hello') {
          if (this.world.players[id]) return;
          clearTimeout(helloTimer); this.world.addPlayer(id, data.name, data.color);
          this.send(connection, { type: 'welcome', id, packs: this.world.packs, entry: this.world.entry, snapshot: this.world.snapshot() });
          this.broadcast({ type: 'chat', name: 'Littleton', text: `${this.world.players[id].name} joined the adventure.` });
        } else if (this.world.players[id] && this.allow(id)) {
          if (data.type === 'input') this.world.input(id, data.input);
          if (data.type === 'action') { const result = this.world.act(id, data.action); this.send(connection, { type: 'result', result }); this.sync(); }
          if (data.type === 'chat') this.chatFrom(id, data.text);
        }
      } catch { this.send(connection, { type: 'result', result: { ok: false, text: 'That request could not be processed.' } }); }
    });
    connection.on('close', () => { clearTimeout(helloTimer); if (generation !== this.generation) return; this.peers.delete(id); this.rates.delete(id); this.world?.removePlayer(id); this.sync(); });
    connection.on('error', () => connection.close());
  }
  /** Limit malformed or excessively fast clients while allowing normal movement. */
  allow(id) {
    const now = Date.now(), rate = this.rates.get(id) || { at: now, count: 0 };
    if (now - rate.at > 1000) { rate.at = now; rate.count = 0; }
    rate.count++; this.rates.set(id, rate); return rate.count <= 60;
  }
  /** Receive host-only state and results on clients. */
  receive(raw) {
    if (!this.active || typeof raw !== 'string' || raw.length > 5 * 1024 * 1024) return;
    let data; try { data = JSON.parse(raw); } catch { return; }
    if (!data || typeof data !== 'object') return;
    if (data.type === 'welcome') {
      try {
        const checked = new World(data.packs, data.entry); this.packs = checked.packs;
        this.id = data.id; this.ready = true; clearTimeout(this.timeout);
        this.emit('ready', { packs: data.packs, entry: data.entry, id: data.id, snapshot: data.snapshot });
        this.emit('status', { text: 'Connected to your friends', code: this.code });
      } catch (error) { this.close(); this.emit('error', `The host sent an invalid dungeon: ${error.message}`); }
    }
    if (data.type === 'snapshot' && this.ready) this.emit('snapshot', data.snapshot);
    if (data.type === 'result') this.emit('result', data.result);
    if (data.type === 'chat') this.emit('chat', { name: String(data.name).slice(0, 24), text: String(data.text).slice(0, 240) });
    if (data.type === 'reject') { this.close(); this.emit('error', data.text); }
  }
  /** Tick the authoritative simulation and send one snapshot every 50 ms. */
  tick() { if (this.world && this.active) { this.world.tick(.05); this.sync(); } }
  /** Publish a snapshot to the local UI and all connected clients. */
  sync() { if (!this.world || !this.active) return; const snapshot = this.world.snapshot(); this.emit('snapshot', snapshot); this.broadcast({ type: 'snapshot', snapshot }); }
  /** Send a reliable JSON message to each open client. */
  broadcast(data) { for (const c of this.peers.values()) this.send(c, data); }
  /** Encode strict JSON; PeerJS binary framing handles messages larger than its JSON-channel MTU. */
  send(connection, data) { if (connection?.open) connection.send(JSON.stringify(data)); }
  /** Forward movement direction without trusting client positions. */
  input(input) { if (this.isHost) this.world?.input(this.id, input); else this.send(this.connection, { type: 'input', input }); }
  /** Execute or request a single item/object action. */
  action(action) { if (this.isHost) { this.emit('result', this.world.act(this.id, action)); this.sync(); } else this.send(this.connection, { type: 'action', action }); }
  /** Send room chat through the same host identity boundary. */
  chat(text) { if (this.isHost) this.chatFrom(this.id, text); else this.send(this.connection, { type: 'chat', text }); }
  /** Attach the sender name on the host, not in untrusted client text. */
  chatFrom(id, value) { const text = String(value || '').trim().slice(0, 240); if (!text) return; const data = { name: this.world.players[id].name, text }; this.emit('chat', data); this.broadcast({ type: 'chat', ...data }); }
  /** Explain connection failures while allowing hosts to continue their world. */
  networkError(error) {
    const text = `Connection unavailable (${error.type || 'network error'}). Check the room code and your connection.`;
    if (this.isHost) this.emit('status', { text: `${text} Your solo adventure can continue.` });
    else { this.close(); this.emit('error', text); }
  }
  /** Stop clients cleanly when the authoritative host leaves. */
  hostLost() { if (!this.active) return; this.close(); this.emit('ended', 'The host closed the room. Create or join another adventure.'); }
  /** Dispose every connection and timer, allowing a clean new session. */
  close() {
    this.active = false; this.ready = false; this.generation++; clearInterval(this.timer); clearTimeout(this.timeout);
    for (const c of this.peers.values()) c.close(); this.peers.clear(); this.rates.clear(); this.connection?.close(); this.peer?.destroy();
    this.connection = null; this.peer = null; this.world = null; this.code = '';
  }
}
