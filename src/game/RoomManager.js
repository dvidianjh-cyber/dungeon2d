/**
 * Last Modified: 2026-08-31
 * 
 * Manages the Room Data layer including boundaries and generic schema.
 */
import eventBus from '../utils/EventBus.js';

class RoomManager {
  constructor() {
    // Default room definition schema
    this.roomData = {
      version: "1.0",
      name: "Default Room",
      width: 1000,
      height: 1000,
      spawnX: 500,
      spawnY: 500,
      // Environmental obstacles { x, y, width, height }
      obstacles: [
        { x: 200, y: 200, width: 100, height: 100 },
        { x: 700, y: 200, width: 150, height: 50 },
        { x: 200, y: 700, width: 50, height: 150 },
        { x: 650, y: 650, width: 150, height: 150 }
      ],
      // Future-proofing: objects, items, etc.
      objects: []
    };
  }

  /**
   * Initialize or overwrite room data (e.g. from network)
   * @param {Object} data 
   */
  setRoomData(data) {
    if (data && typeof data === 'object') {
      this.roomData = { ...this.roomData, ...data };
      eventBus.emit('room:updated', this.roomData);
    }
  }

  /**
   * Get current room definition
   * @returns {Object}
   */
  getRoomData() {
    return this.roomData;
  }

  /**
   * Check if a given bounding box is within room bounds
   * @param {number} x - Center X
   * @param {number} y - Center Y
   * @param {number} radius - Size/radius of the object
   * @returns {Object} Clamped coordinates {x, y}
   */
  clampToRoomBounds(x, y, radius) {
    const minX = radius;
    const maxX = this.roomData.width - radius;
    const minY = radius;
    const maxY = this.roomData.height - radius;

    return {
      x: Math.max(minX, Math.min(x, maxX)),
      y: Math.max(minY, Math.min(y, maxY))
    };
  }
}

const roomManager = new RoomManager();
export default roomManager;
