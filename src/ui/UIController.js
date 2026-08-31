/**
 * Last Modified: 2026-08-31
 * 
 * Manages UI interactions and dialogs.
 */
import eventBus from '../utils/EventBus.js';

class UIController {
  constructor() {
    this.uiLayer = null;
    this.uiHeader = null;
    this.uiStatusBar = null;
    this.btnCreate = null;
    this.btnJoin = null;
    this.inputJoinCode = null;
    this.inputPlayerHandle = null;
    this.statusMessage = null;
    this.toolbarJoinCode = null;
    this.toolbarPeerCount = null;
  }

  init() {
    this.uiLayer = document.getElementById('ui-layer');
    this.uiHeader = document.getElementById('ui-header');
    this.uiStatusBar = document.getElementById('ui-status-bar');
    
    this.btnCreate = document.getElementById('btn-create-room');
    this.btnJoin = document.getElementById('btn-join-room');
    this.inputJoinCode = document.getElementById('input-join-code');
    this.inputPlayerHandle = document.getElementById('input-player-handle');
    this.statusMessage = document.getElementById('status-message');
    
    this.toolbarJoinCode = document.getElementById('toolbar-join-code');
    this.toolbarPeerCount = document.getElementById('toolbar-peer-count');

    this.bindEvents();
    
    // Listen to network status updates
    eventBus.on('network:status', (msg) => this.setStatus(msg));
    eventBus.on('network:peer_count', (count) => this.updatePeerCount(count));
  }

  bindEvents() {
    this.btnCreate.addEventListener('click', () => {
      const handle = this.inputPlayerHandle.value.trim();
      if (!handle) {
        this.setStatus('Please enter a player handle.');
        return;
      }
      this.setStatus('Initializing Room...');
      this.btnCreate.disabled = true;
      this.btnJoin.disabled = true;
      eventBus.emit('ui:create_room', handle);
    });

    this.btnJoin.addEventListener('click', () => {
      const handle = this.inputPlayerHandle.value.trim();
      if (!handle) {
        this.setStatus('Please enter a player handle.');
        return;
      }
      
      const code = this.inputJoinCode.value.trim();
      if (!code) {
        this.setStatus('Please enter a join code.');
        return;
      }
      this.setStatus('Connecting to Room...');
      this.btnCreate.disabled = true;
      this.btnJoin.disabled = true;
      eventBus.emit('ui:join_room', { code, handle });
    });
  }

  setStatus(message) {
    this.statusMessage.textContent = message;
    this.statusMessage.classList.remove('hidden');
  }

  /**
   * Displays the persistent header and status toolbars.
   * @param {string|null} joinCode - Optional join code to display for the host.
   */
  showToolbars(joinCode = null) {
    this.uiHeader.classList.remove('hidden');
    if (joinCode) {
      this.toolbarJoinCode.textContent = joinCode;
      this.uiStatusBar.classList.remove('hidden');
    }
  }

  /**
   * Updates the peer count displayed on the status toolbar.
   * @param {number} count 
   */
  updatePeerCount(count) {
    if (this.toolbarPeerCount) {
      this.toolbarPeerCount.textContent = count;
    }
  }

  hideAll() {
    if (this.uiLayer) {
      this.uiLayer.classList.add('hidden');
    }
  }
}

const uiController = new UIController();
export default uiController;
