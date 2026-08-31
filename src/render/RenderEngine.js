/**
 * Last Modified: 2026-08-31
 * 
 * Handles Canvas rendering, dynamic resizing, and the fixed-center camera.
 */
import eventBus from '../utils/EventBus.js';
import roomManager from '../game/RoomManager.js';

class RenderEngine {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
    
    // Zoom control
    this.zoomScale = 1.0;
    
    // Peer state
    this.peers = new Map();
  }

  init() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
    
    // Zoom listener (named function for memory management)
    this.handleZoom = this.handleZoom.bind(this);
    window.addEventListener('wheel', this.handleZoom, { passive: false });

    // Listen for peer initialization
    eventBus.on('network:peer_init', ({ handle }) => {
      const current = this.peers.get('peer1') || {};
      this.peers.set('peer1', { ...current, handle });
    });

    // Listen for peer state updates
    eventBus.on('network:peer_state', (state) => {
      // Assuming only one peer for now, using a fixed key 'peer1'
      const current = this.peers.get('peer1') || {};
      this.peers.set('peer1', { ...current, ...state });
    });

    // We hook into the game loop's requestAnimationFrame
    eventBus.on('game:frame', (localPlayerState) => {
      this.render(localPlayerState);
    });
  }

  /**
   * Get the current map of peer states for physics collision.
   * @returns {Map} Map of peer states
   */
  getPeers() {
    return this.peers;
  }

  /**
   * Adjusts the global zoom scale based on mouse wheel input.
   * @param {WheelEvent} e 
   */
  handleZoom(e) {
    e.preventDefault();
    const zoomAmount = e.deltaY * -0.001;
    this.zoomScale = Math.min(Math.max(0.5, this.zoomScale + zoomAmount), 3.0);
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  render(playerState) {
    // 1. Clear screen
    this.ctx.fillStyle = '#050505'; // Background outside the room
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.ctx.save();

    // 2. Camera Translation & Zoom
    // Translate to center, apply scale, translate by -playerPos
    this.ctx.translate(this.width / 2, this.height / 2);
    this.ctx.scale(this.zoomScale, this.zoomScale);
    this.ctx.translate(-playerState.x, -playerState.y);

    // 3. Draw Room / Game Space
    this.drawRoom();

    // 4. Draw Peers
    this.peers.forEach((peerState) => {
      this.drawFace(peerState.x, peerState.y, '#2196F3', peerState.radius || 20, peerState.handle);
    });

    // 5. Draw Local Player
    this.drawFace(playerState.x, playerState.y, '#4CAF50', playerState.radius || 20, playerState.handle);

    this.ctx.restore();
  }

  drawRoom() {
    const room = roomManager.getRoomData();
    
    // Draw Room Floor (Black Grid Game-Space)
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, room.width, room.height);

    // Draw Grid Lines
    this.ctx.strokeStyle = '#1a1a1a';
    this.ctx.lineWidth = 2;
    const gridSize = 100;
    
    this.ctx.beginPath();
    for (let x = 0; x <= room.width; x += gridSize) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, room.height);
    }
    for (let y = 0; y <= room.height; y += gridSize) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(room.width, y);
    }
    this.ctx.stroke();

    // Draw Room Walls (Border)
    this.ctx.strokeStyle = '#444';
    this.ctx.lineWidth = 10;
    this.ctx.strokeRect(0, 0, room.width, room.height);

    // Draw Obstacles
    if (room.obstacles && room.obstacles.length > 0) {
      room.obstacles.forEach(obs => {
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        this.ctx.strokeStyle = '#555';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
      });
    }
  }

  drawFace(x, y, color, radius, handle = '') {
    if (x === undefined || y === undefined) return;
    
    // Face Circle
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Eyes
    this.ctx.fillStyle = '#000';
    const eyeRadius = radius * 0.2;
    const eyeOffsetX = radius * 0.35;
    const eyeOffsetY = radius * 0.25;

    // Left Eye
    this.ctx.beginPath();
    this.ctx.arc(x - eyeOffsetX, y - eyeOffsetY, eyeRadius, 0, Math.PI * 2);
    this.ctx.fill();

    // Right Eye
    this.ctx.beginPath();
    this.ctx.arc(x + eyeOffsetX, y - eyeOffsetY, eyeRadius, 0, Math.PI * 2);
    this.ctx.fill();

    // Mouth
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = radius * 0.1;
    this.ctx.beginPath();
    this.ctx.arc(x, y + radius * 0.1, radius * 0.5, 0, Math.PI, false);
    this.ctx.stroke();

    // Handle Text
    if (handle) {
      this.ctx.font = '14px sans-serif';
      this.ctx.fillStyle = '#fff';
      this.ctx.textAlign = 'center';
      // Add text shadow for legibility over grid
      this.ctx.shadowColor = '#000';
      this.ctx.shadowBlur = 4;
      this.ctx.fillText(handle, x, y + radius + 20);
      // Reset shadow
      this.ctx.shadowBlur = 0;
    }
  }
}

const renderEngine = new RenderEngine();
export default renderEngine;
