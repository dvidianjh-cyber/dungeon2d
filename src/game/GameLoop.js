/**
 * Last Modified: 2026-08-31
 * 
 * Handles WASD input, movement, AABB collision, and ticking network state.
 */
import eventBus from '../utils/EventBus.js';
import roomManager from './RoomManager.js';
import webrtcEngine from '../network/WebRTCEngine.js';

class GameLoop {
  constructor() {
    this.isRunning = false;
    this.lastTime = 0;
    
    // 20 ticks per second (50ms)
    this.tickRateMs = 50;
    this.lastTickTime = 0;

    // Player State
    this.player = {
      handle: '',
      x: 1000,
      y: 1000,
      radius: 20, // visual size is 40x40, radius is half
      speed: 300, // pixels per second
    };

    // Peer state cache for collisions
    this.peers = new Map();

    // Input blocking state (e.g. when chat pane has focus)
    this.isInputBlocked = false;

    // Input state
    this.keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      ArrowUp: false,
      ArrowDown: false,
      ArrowLeft: false,
      ArrowRight: false
    };

    this.bindInputs();
    this.bindNetworkEvents();
  }

  bindInputs() {
    window.addEventListener('keydown', (e) => {
      // If typing in any input element or if input is explicitly blocked by UI
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }
      if (this.isInputBlocked) {
        return;
      }

      if (this.keys.hasOwnProperty(e.key) || this.keys.hasOwnProperty(e.key.toLowerCase())) {
        this.keys[e.key] !== undefined ? this.keys[e.key] = true : this.keys[e.key.toLowerCase()] = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }

      if (this.keys.hasOwnProperty(e.key) || this.keys.hasOwnProperty(e.key.toLowerCase())) {
        this.keys[e.key] !== undefined ? this.keys[e.key] = false : this.keys[e.key.toLowerCase()] = false;
      }
    });
  }

  /**
   * Resets all movement keys to unpressed state.
   */
  resetMovementKeys() {
    for (const key in this.keys) {
      this.keys[key] = false;
    }
  }

  bindNetworkEvents() {
    // Listen for chat focus changes to pause avatar movement
    eventBus.on('ui:chat_focus', (isFocused) => {
      this.isInputBlocked = isFocused;
      if (isFocused) {
        this.resetMovementKeys();
      }
    });

    eventBus.on('network:peer_state', (state) => {
      // We only support one peer named 'peer1' for now
      const current = this.peers.get('peer1') || {};
      this.peers.set('peer1', { ...current, ...state });
    });
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    const room = roomManager.getRoomData();
    
    // Find a valid spawn point that doesn't overlap obstacles or peers
    const spawnPoint = this.findValidSpawn(room.spawnX, room.spawnY, room);
    this.player.x = spawnPoint.x;
    this.player.y = spawnPoint.y;

    this.lastTime = performance.now();
    this.lastTickTime = performance.now();
    
    requestAnimationFrame((t) => this.loop(t));
  }

  loop(currentTime) {
    if (!this.isRunning) return;

    const dt = (currentTime - this.lastTime) / 1000; // seconds
    this.lastTime = currentTime;

    this.updatePhysics(dt);

    // Network Tick
    if (currentTime - this.lastTickTime >= this.tickRateMs) {
      this.lastTickTime = currentTime;
      this.sendState();
    }

    eventBus.emit('game:frame', this.player);
    requestAnimationFrame((t) => this.loop(t));
  }

  /**
   * Helper to check Axis-Aligned Bounding Box (AABB) intersection.
   * @param {Object} r1 { x, y, width, height }
   * @param {Object} r2 { x, y, width, height }
   * @returns {boolean} True if intersecting
   */
  checkAABB(r1, r2) {
    return (
      r1.x < r2.x + r2.width &&
      r1.x + r1.width > r2.x &&
      r1.y < r2.y + r2.height &&
      r1.y + r1.height > r2.y
    );
  }

  /**
   * Generates a list of all current colliders (obstacles + peers)
   * @param {Object} room
   * @returns {Array} Array of AABB objects
   */
  getColliders(room) {
    const colliders = [];
    if (room.obstacles) {
      colliders.push(...room.obstacles);
    }
    this.peers.forEach((peer) => {
      if (peer.x !== undefined && peer.y !== undefined) {
        const r = peer.radius || 20;
        colliders.push({
          x: peer.x - r,
          y: peer.y - r,
          width: r * 2,
          height: r * 2
        });
      }
    });
    return colliders;
  }

  /**
   * Checks if a given coordinate collides with any obstacles or peers, or is out of bounds
   * @param {number} x 
   * @param {number} y 
   * @param {number} radius 
   * @param {Object} room 
   * @returns {boolean}
   */
  checkCollisionsAt(x, y, radius, room) {
    const clamped = roomManager.clampToRoomBounds(x, y, radius);
    if (clamped.x !== x || clamped.y !== y) return true;

    const testAABB = {
      x: x - radius,
      y: y - radius,
      width: radius * 2,
      height: radius * 2
    };

    const colliders = this.getColliders(room);
    for (let box of colliders) {
      if (this.checkAABB(testAABB, box)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Radially searches for a valid spawn point starting from (startX, startY)
   * @param {number} startX 
   * @param {number} startY 
   * @param {Object} room 
   * @returns {Object} { x, y }
   */
  findValidSpawn(startX, startY, room) {
    const pRadius = this.player.radius;
    
    if (!this.checkCollisionsAt(startX, startY, pRadius, room)) {
      return { x: startX, y: startY };
    }

    let maxDist = 2000;
    let step = pRadius; 
    
    for (let dist = step; dist < maxDist; dist += step) {
      // 8 directional checks per distance ring
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        let testX = startX + Math.cos(angle) * dist;
        let testY = startY + Math.sin(angle) * dist;
        
        if (!this.checkCollisionsAt(testX, testY, pRadius, room)) {
          return { x: testX, y: testY };
        }
      }
    }
    return { x: startX, y: startY };
  }

  updatePhysics(dt) {
    let dx = 0;
    let dy = 0;

    if (this.keys.w || this.keys.ArrowUp) dy -= 1;
    if (this.keys.s || this.keys.ArrowDown) dy += 1;
    if (this.keys.a || this.keys.ArrowLeft) dx -= 1;
    if (this.keys.d || this.keys.ArrowRight) dx += 1;

    if (dx !== 0 && dy !== 0) {
      const length = Math.sqrt(dx * dx + dy * dy);
      dx /= length;
      dy /= length;
    }

    const moveX = dx * this.player.speed * dt;
    const moveY = dy * this.player.speed * dt;

    const room = roomManager.getRoomData();
    const colliders = this.getColliders(room);
    const pRadius = this.player.radius;

    const originalX = this.player.x;
    const originalY = this.player.y;

    const originalAABB = {
      x: originalX - pRadius,
      y: originalY - pRadius,
      width: pRadius * 2,
      height: pRadius * 2
    };

    // --- X Axis Movement ---
    if (moveX !== 0) {
      this.player.x += moveX;
      
      const playerAABB_X = {
        x: this.player.x - pRadius,
        y: this.player.y - pRadius,
        width: pRadius * 2,
        height: pRadius * 2
      };

      for (let box of colliders) {
        // Only block movement if we weren't already overlapping (allows escaping stuck states)
        if (this.checkAABB(playerAABB_X, box) && !this.checkAABB(originalAABB, box)) {
          this.player.x -= moveX;
          break;
        }
      }
    }

    // --- Y Axis Movement ---
    if (moveY !== 0) {
      this.player.y += moveY;

      const playerAABB_Y = {
        x: this.player.x - pRadius,
        y: this.player.y - pRadius,
        width: pRadius * 2,
        height: pRadius * 2
      };

      // Need to re-evaluate original state based on new X position to prevent corner snags
      const currentAABB = {
        x: this.player.x - pRadius,
        y: originalY - pRadius,
        width: pRadius * 2,
        height: pRadius * 2
      };

      for (let box of colliders) {
        if (this.checkAABB(playerAABB_Y, box) && !this.checkAABB(currentAABB, box)) {
          this.player.y -= moveY;
          break;
        }
      }
    }

    // AABB Collision with room bounds (walls)
    const clamped = roomManager.clampToRoomBounds(this.player.x, this.player.y, this.player.radius);
    this.player.x = clamped.x;
    this.player.y = clamped.y;
  }

  sendState() {
    webrtcEngine.sendState({
      x: this.player.x,
      y: this.player.y
    });
  }

  getPlayerState() {
    return this.player;
  }

  /**
   * Set the local player's handle
   * @param {string} handle 
   */
  setPlayerHandle(handle) {
    this.player.handle = handle;
  }
}

const gameLoop = new GameLoop();
export default gameLoop;
