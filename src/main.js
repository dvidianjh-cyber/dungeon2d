/**
 * Last Modified: 2026-08-31
 * 
 * Main entry point for Dungeon2D
 */
import eventBus from './utils/EventBus.js';
import uiController from './ui/UIController.js';
import webrtcEngine from './network/WebRTCEngine.js';
import gameLoop from './game/GameLoop.js';
import renderEngine from './render/RenderEngine.js';
import roomManager from './game/RoomManager.js';

class Dungeon2D {
  constructor() {
    this.localPeerId = null;
    this.isHost = false;
    this.peerCount = 0;
    
    this.init();
  }

  init() {
    // 1. Initialize UI
    uiController.init();
    
    // 2. Initialize Render Engine
    renderEngine.init();

    // 3. Setup global event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    // User requested to create a room
    eventBus.on('ui:create_room', (handle) => {
      this.isHost = true;
      webrtcEngine.setLocalHandle(handle);
      webrtcEngine.initAsHost();
      
      // Update GameLoop local player handle
      gameLoop.setPlayerHandle(handle);
    });

    // User requested to join a room
    eventBus.on('ui:join_room', ({ code, handle }) => {
      this.isHost = false;
      webrtcEngine.setLocalHandle(handle);
      webrtcEngine.initAsClient(code);
      
      // Update GameLoop local player handle
      gameLoop.setPlayerHandle(handle);
    });

    // Host is ready (has connection code)
    eventBus.on('network:ready_host', (peerId) => {
      uiController.hideAll();
      uiController.showToolbars(peerId);
      gameLoop.start();
    });

    // WebRTC connection established
    eventBus.on('network:connected', () => {
      if (!this.isHost) {
        // Client connects
        uiController.hideAll();
        uiController.showToolbars();
        gameLoop.start();
      }
      
      this.peerCount = 1; // Only 1 peer supported right now
      eventBus.emit('network:peer_count', this.peerCount);
    });

    // We received updated room data (mostly as client)
    eventBus.on('network:room_data', (roomData) => {
      roomManager.setRoomData(roomData);
    });

    // If host, when someone connects, send them the room schema
    eventBus.on('network:peer_joined', () => {
      if (this.isHost) {
        webrtcEngine.sendRoomData(roomManager.getRoomData());
      }
    });

    // User sent a direct chat message from the UI
    eventBus.on('ui:send_direct_chat', ({ targetPeerId, text }) => {
      webrtcEngine.sendDirectChat(targetPeerId, text);
    });
  }
}

// Start the app
window.addEventListener('DOMContentLoaded', () => {
  new Dungeon2D();
});
