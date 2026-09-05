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

    // Track last known local player position for coordinate transformations
    this.lastPlayerState = { x: 1000, y: 1000, radius: 20 };

    // Currently hovered peer identifier
    this.hoveredPeerId = null;
  }

  init() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
    
    // Zoom listener (named function for memory management)
    this.handleZoom = this.handleZoom.bind(this);
    window.addEventListener('wheel', this.handleZoom, { passive: false });

    // Mouse picking listeners
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleMouseLeave = this.handleMouseLeave.bind(this);

    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('click', this.handleClick);
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave);

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
   * Transforms screen (canvas) coordinates to world coordinates by reversing camera translation and zoom.
   * @param {number} screenX - X coordinate relative to canvas
   * @param {number} screenY - Y coordinate relative to canvas
   * @returns {{x: number, y: number}} World coordinates
   */
  screenToWorld(screenX, screenY) {
    const px = this.lastPlayerState.x;
    const py = this.lastPlayerState.y;
    return {
      x: px + (screenX - this.width / 2) / this.zoomScale,
      y: py + (screenY - this.height / 2) / this.zoomScale
    };
  }

  /**
   * Transforms world coordinates to screen (canvas) coordinates.
   * @param {number} worldX - X coordinate in world space
   * @param {number} worldY - Y coordinate in world space
   * @returns {{x: number, y: number}} Screen coordinates
   */
  worldToScreen(worldX, worldY) {
    const px = this.lastPlayerState.x;
    const py = this.lastPlayerState.y;
    return {
      x: (worldX - px) * this.zoomScale + this.width / 2,
      y: (worldY - py) * this.zoomScale + this.height / 2
    };
  }

  /**
   * Checks if world coordinates intersect with any peer's 40x40 pixel AABB bounds.
   * @param {number} worldX 
   * @param {number} worldY 
   * @returns {{peerId: string, peer: Object}|null} Matching peer data or null
   */
  findPeerAt(worldX, worldY) {
    for (const [peerId, peer] of this.peers.entries()) {
      if (peer.x === undefined || peer.y === undefined) continue;
      const radius = peer.radius || 20;
      // 40x40 AABB bounding box check
      if (
        worldX >= peer.x - radius &&
        worldX <= peer.x + radius &&
        worldY >= peer.y - radius &&
        worldY <= peer.y + radius
      ) {
        return { peerId, peer };
      }
    }
    return null;
  }

  /**
   * Handles mouse movement over the canvas for peer hover detection.
   * @param {MouseEvent} e 
   */
  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = this.screenToWorld(screenX, screenY);
    const hit = this.findPeerAt(worldPos.x, worldPos.y);

    if (hit) {
      this.canvas.style.cursor = 'pointer';
      if (this.hoveredPeerId !== hit.peerId) {
        this.hoveredPeerId = hit.peerId;
        eventBus.emit('input:peer_hover', {
          peerId: hit.peerId,
          peer: hit.peer,
          screenX: e.clientX,
          screenY: e.clientY,
          worldX: worldPos.x,
          worldY: worldPos.y
        });
      } else {
        eventBus.emit('input:peer_hover_move', {
          peerId: hit.peerId,
          peer: hit.peer,
          screenX: e.clientX,
          screenY: e.clientY
        });
      }
    } else {
      if (this.hoveredPeerId !== null) {
        const prevId = this.hoveredPeerId;
        this.hoveredPeerId = null;
        this.canvas.style.cursor = 'default';
        eventBus.emit('input:peer_unhover', { previousPeerId: prevId });
      }
    }
  }

  /**
   * Handles canvas clicks for peer selection and modal locking.
   * @param {MouseEvent} e 
   */
  handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = this.screenToWorld(screenX, screenY);
    const hit = this.findPeerAt(worldPos.x, worldPos.y);

    if (hit) {
      const distance = Math.hypot(
        this.lastPlayerState.x - hit.peer.x,
        this.lastPlayerState.y - hit.peer.y
      );
      eventBus.emit('input:peer_click', {
        peerId: hit.peerId,
        peer: hit.peer,
        screenX: e.clientX,
        screenY: e.clientY,
        worldX: worldPos.x,
        worldY: worldPos.y,
        distance
      });
    } else {
      eventBus.emit('input:canvas_click', {
        screenX: e.clientX,
        screenY: e.clientY,
        worldX: worldPos.x,
        worldY: worldPos.y
      });
    }
  }

  /**
   * Handles mouse leave to ensure hover state is reset.
   */
  handleMouseLeave() {
    if (this.hoveredPeerId !== null) {
      const prevId = this.hoveredPeerId;
      this.hoveredPeerId = null;
      this.canvas.style.cursor = 'default';
      eventBus.emit('input:peer_unhover', { previousPeerId: prevId });
    }
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
    this.lastPlayerState = playerState;

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

    // Emit screen positions and distance data for active peers to support UI tracking & action ranges
    if (this.peers.size > 0) {
      const positions = {};
      const peerData = {};
      for (const [peerId, peer] of this.peers.entries()) {
        if (peer.x !== undefined && peer.y !== undefined) {
          const screenPos = this.worldToScreen(peer.x, peer.y);
          positions[peerId] = screenPos;
          const dist = Math.hypot(playerState.x - peer.x, playerState.y - peer.y);
          peerData[peerId] = {
            screenX: screenPos.x,
            screenY: screenPos.y,
            worldX: peer.x,
            worldY: peer.y,
            distance: dist
          };
        }
      }
      eventBus.emit('render:peer_screen_positions', positions);
      eventBus.emit('render:peer_data', peerData);
    }
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
