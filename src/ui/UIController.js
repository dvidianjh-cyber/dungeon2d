/**
 * Last Modified: 2026-09-05
 * 
 * Manages UI interactions, dialogs, controls legend, peer modals, and direct chat flyout.
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

    // v0.2.1 Tabbed Connection Modal Elements
    this.tabCreate = null;
    this.tabJoin = null;
    this.groupJoinCode = null;
    this.btnSubmitAction = null;
    this.activeTab = 'create'; // 'create' | 'join'

    // v0.2.0 Components
    this.controlsLegend = null;
    this.peerModal = null;
    this.peerModalClose = null;
    this.peerModalHandle = null;
    this.peerModalRole = null;
    this.peerModalActions = null;
    this.btnPeerTalk = null;

    // Chat Flyout Elements
    this.chatFlyout = null;
    this.chatPeerHandle = null;
    this.btnCloseChat = null;
    this.chatMessages = null;
    this.chatForm = null;
    this.chatInput = null;
    this.btnSendChat = null;

    // State Tracking
    this.isModalLocked = false;
    this.activePeerId = null;
    this.activePeerHandle = '';
    this.isChatOpen = false;
    this.isChatFocused = false;

    // Configurable peer action registry with enabledRange (in world pixels; 1 grid square = 100)
    this.peerActions = {
      talk: {
        id: 'btn-peer-talk',
        baseLabel: '💬 Talk',
        enabledRange: 100 // 1 grid square distance
      }
    };
  }

  init() {
    this.uiLayer = document.getElementById('ui-layer');
    this.uiHeader = document.getElementById('ui-header');
    this.uiStatusBar = document.getElementById('ui-status-bar');
    
    // v0.2.1 Tabbed Connection Modal
    this.tabCreate = document.getElementById('tab-create');
    this.tabJoin = document.getElementById('tab-join');
    this.groupJoinCode = document.getElementById('group-join-code');
    this.btnSubmitAction = document.getElementById('btn-submit-action');

    this.inputJoinCode = document.getElementById('input-join-code');
    this.inputPlayerHandle = document.getElementById('input-player-handle');
    this.statusMessage = document.getElementById('status-message');
    
    this.toolbarJoinCode = document.getElementById('toolbar-join-code');
    this.toolbarPeerCount = document.getElementById('toolbar-peer-count');

    // Controls Legend
    this.controlsLegend = document.getElementById('controls-legend');

    // Peer Modal Elements
    this.peerModal = document.getElementById('peer-modal');
    this.peerModalClose = document.getElementById('peer-modal-close');
    this.peerModalHandle = document.getElementById('peer-modal-handle');
    this.peerModalRole = document.getElementById('peer-modal-role');
    this.peerModalActions = document.getElementById('peer-modal-actions');
    this.btnPeerTalk = document.getElementById('btn-peer-talk');

    // Chat Flyout Elements
    this.chatFlyout = document.getElementById('chat-flyout');
    this.chatPeerHandle = document.getElementById('chat-peer-handle');
    this.btnCloseChat = document.getElementById('btn-close-chat');
    this.chatMessages = document.getElementById('chat-messages');
    this.chatForm = document.getElementById('chat-form');
    this.chatInput = document.getElementById('chat-input');
    this.btnSendChat = document.getElementById('btn-send-chat');

    this.setActiveTab('create');
    this.bindEvents();
    this.bindInteractionEvents();
    
    // Listen to network status updates
    eventBus.on('network:status', (msg) => this.setStatus(msg));
    eventBus.on('network:peer_count', (count) => this.updatePeerCount(count));
  }

  /**
   * Switches the active tab in the welcome dialog between 'create' and 'join'.
   * Preserves any existing player handle input.
   * @param {'create'|'join'} tabName - Target tab identifier
   */
  setActiveTab(tabName) {
    this.activeTab = tabName;

    if (tabName === 'create') {
      if (this.tabCreate) this.tabCreate.classList.add('active');
      if (this.tabJoin) this.tabJoin.classList.remove('active');
      if (this.groupJoinCode) this.groupJoinCode.classList.add('hidden');
      if (this.btnSubmitAction) this.btnSubmitAction.textContent = 'Create Room (Host)';
    } else if (tabName === 'join') {
      if (this.tabJoin) this.tabJoin.classList.add('active');
      if (this.tabCreate) this.tabCreate.classList.remove('active');
      if (this.groupJoinCode) this.groupJoinCode.classList.remove('hidden');
      if (this.btnSubmitAction) this.btnSubmitAction.textContent = 'Join Room';
    }
  }

  bindEvents() {
    if (this.tabCreate) {
      this.tabCreate.addEventListener('click', () => this.setActiveTab('create'));
    }

    if (this.tabJoin) {
      this.tabJoin.addEventListener('click', () => this.setActiveTab('join'));
    }

    if (this.btnSubmitAction) {
      this.btnSubmitAction.addEventListener('click', () => {
        const handle = this.inputPlayerHandle.value.trim();
        if (!handle) {
          this.setStatus('Please enter a player handle.');
          return;
        }

        if (this.activeTab === 'create') {
          this.setStatus('Initializing Room...');
          this.btnSubmitAction.disabled = true;
          eventBus.emit('ui:create_room', handle);
        } else if (this.activeTab === 'join') {
          const code = this.inputJoinCode.value.trim();
          if (!code) {
            this.setStatus('Please enter a join code.');
            return;
          }
          this.setStatus('Connecting to Room...');
          this.btnSubmitAction.disabled = true;
          eventBus.emit('ui:join_room', { code, handle });
        }
      });
    }
  }

  /**
   * Binds interaction events for peer modals, controls legend, and chat flyout.
   */
  bindInteractionEvents() {
    // Close locked peer modal via button
    this.peerModalClose.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closePeerModal();
    });

    // Talk action button clicked inside peer modal -> initiates chat only if within enabled range
    this.btnPeerTalk.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.btnPeerTalk.disabled) return;
      this.openChat(this.activePeerId, this.activePeerHandle, true);
    });

    // Close chat flyout button
    this.btnCloseChat.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeChat();
    });

    // Click inside chat flyout restores exclusive keyboard focus (unless clicking close or send button)
    this.chatFlyout.addEventListener('mousedown', (e) => {
      if (e.target !== this.btnCloseChat && e.target !== this.btnSendChat && !this.isChatFocused) {
        this.setChatFocus(true);
      }
    });

    // Click anywhere outside chat flyout drops keyboard focus back to avatar
    document.addEventListener('mousedown', (e) => {
      if (!this.isChatOpen) return;
      if (!this.chatFlyout.contains(e.target) && e.target !== this.btnPeerTalk) {
        if (this.isChatFocused) {
          this.setChatFocus(false);
        }
      }
    });

    // Direct input focus event
    this.chatInput.addEventListener('focus', () => {
      if (!this.isChatFocused) {
        this.setChatFocus(true);
      }
    });

    // Chat message form submission (Enter key or Send button click)
    this.chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const message = this.chatInput.value.trim();
      if (message) {
        const targetPeer = this.activePeerId || 'peer1';
        eventBus.emit('ui:send_direct_chat', {
          targetPeerId: targetPeer,
          text: message
        });

        this.appendMessage('You', message, true, Date.now());
        this.chatInput.value = '';
      }

      // Automatically switch keyboard focus away from chat pane and back to avatar
      this.setChatFocus(false);
    });

    // Event Bus: Peer hover
    eventBus.on('input:peer_hover', ({ peerId, peer, screenX, screenY }) => {
      if (this.isModalLocked) return;
      this.showPeerTooltip(peerId, peer, screenX, screenY);
    });

    // Event Bus: Peer hover move
    eventBus.on('input:peer_hover_move', ({ screenX, screenY }) => {
      if (this.isModalLocked) return;
      this.positionModal(screenX, screenY);
    });

    // Event Bus: Peer unhover
    eventBus.on('input:peer_unhover', () => {
      if (this.isModalLocked) return;
      this.hidePeerModal();
    });

    // Event Bus: Peer clicked -> lock modal open
    eventBus.on('input:peer_click', ({ peerId, peer, screenX, screenY, distance }) => {
      this.lockPeerModal(peerId, peer, screenX, screenY, distance);
    });

    // Event Bus: Canvas clicked elsewhere -> unlock/close modal
    eventBus.on('input:canvas_click', () => {
      if (this.isModalLocked) {
        this.closePeerModal();
      }
    });

    // Event Bus: Track peer positions & distance continuously during render for sticky locked modal and range updates
    eventBus.on('render:peer_data', (peerData) => {
      if (this.isModalLocked && this.activePeerId && peerData[this.activePeerId]) {
        const data = peerData[this.activePeerId];
        this.positionModal(data.screenX, data.screenY);
        this.updateActionRanges(data.distance);
      }
    });

    // Event Bus: Track peer positions during render for sticky locked modal (fallback)
    eventBus.on('render:peer_screen_positions', (positions) => {
      if (this.isModalLocked && this.activePeerId && positions[this.activePeerId]) {
        const pos = positions[this.activePeerId];
        this.positionModal(pos.x, pos.y);
      }
    });

    // Event Bus: Incoming direct chat message -> opens in non-keyboard-focused mode (more transparent)
    eventBus.on('network:direct_chat', ({ from, text, timestamp, peerId }) => {
      this.appendMessage(from, text, false, timestamp);
      if (!this.isChatOpen) {
        this.openChat(peerId, from, false);
      }
    });
  }

  /**
   * Shows the peer modal as a transient hover tooltip.
   * @param {string} peerId 
   * @param {Object} peer 
   * @param {number} screenX 
   * @param {number} screenY 
   */
  showPeerTooltip(peerId, peer, screenX, screenY) {
    this.activePeerId = peerId;
    this.activePeerHandle = peer.handle || 'Peer';

    this.peerModalHandle.textContent = this.activePeerHandle;
    this.peerModalRole.textContent = 'Remote Player';

    this.peerModal.classList.remove('locked-mode');
    this.peerModal.classList.add('tooltip-mode');
    this.peerModalActions.classList.add('hidden');
    this.peerModalClose.classList.add('hidden');

    this.positionModal(screenX, screenY);
    this.peerModal.classList.remove('hidden');
  }

  /**
   * Checks whether a distance is within the specified action's enabled range.
   * @param {number} distance - Distance in world units between player and peer
   * @param {number} enabledRange - Maximum enabled distance
   * @returns {boolean} True if within range
   */
  isActionInRange(distance, enabledRange) {
    return distance <= enabledRange;
  }

  /**
   * Updates all registered peer modal action buttons based on distance to the active peer.
   * Dynamically enables or disables the buttons and provides immediate visual feedback.
   * @param {number} distance - Current distance between local player and active peer
   */
  updateActionRanges(distance) {
    if (!this.activePeerId || !this.isModalLocked) return;

    for (const [actionKey, config] of Object.entries(this.peerActions)) {
      const btn = document.getElementById(config.id);
      if (!btn) continue;

      const inRange = this.isActionInRange(distance, config.enabledRange);
      btn.disabled = !inRange;

      if (inRange) {
        btn.classList.remove('out-of-range');
        btn.classList.add('in-range');
        btn.textContent = config.baseLabel;
        btn.title = `${config.baseLabel} (In Range)`;
      } else {
        btn.classList.remove('in-range');
        btn.classList.add('out-of-range');
        btn.textContent = `${config.baseLabel} (Out of Range)`;
        btn.title = `Must be within 1 grid square to talk`;
      }
    }
  }

  /**
   * Locks the peer modal open as a persistent window with action buttons.
   * @param {string} peerId 
   * @param {Object} peer 
   * @param {number} screenX 
   * @param {number} screenY 
   * @param {number} [distance=Infinity]
   */
  lockPeerModal(peerId, peer, screenX, screenY, distance = Infinity) {
    this.isModalLocked = true;
    this.activePeerId = peerId;
    this.activePeerHandle = peer.handle || 'Peer';

    this.peerModalHandle.textContent = this.activePeerHandle;
    this.peerModalRole.textContent = 'Remote Player';

    this.peerModal.classList.remove('tooltip-mode');
    this.peerModal.classList.add('locked-mode');
    this.peerModalActions.classList.remove('hidden');
    this.peerModalClose.classList.remove('hidden');

    this.positionModal(screenX, screenY);
    this.peerModal.classList.remove('hidden');

    this.updateActionRanges(distance);
  }

  /**
   * Positions the peer modal at the given viewport coordinates.
   * @param {number} x - Viewport X coordinate
   * @param {number} y - Viewport Y coordinate
   */
  positionModal(x, y) {
    if (!this.peerModal) return;
    this.peerModal.style.left = `${Math.round(x)}px`;
    this.peerModal.style.top = `${Math.round(y)}px`;
  }

  /**
   * Closes and unlocks the peer modal.
   */
  closePeerModal() {
    this.isModalLocked = false;
    this.activePeerId = null;
    this.hidePeerModal();
  }

  /**
   * Hides the peer modal from view.
   */
  hidePeerModal() {
    if (this.peerModal) {
      this.peerModal.classList.add('hidden');
    }
  }

  /**
   * Sets the keyboard focus state of the chat flyout.
   * Updates visual transparency and focuses/blurs the input element.
   * @param {boolean} focused - Whether the chat pane should have exclusive keyboard focus
   */
  setChatFocus(focused) {
    this.isChatFocused = focused;

    if (this.chatFlyout) {
      if (focused) {
        this.chatFlyout.classList.remove('unfocused');
        this.chatFlyout.classList.add('focused');
        if (this.chatInput) {
          this.chatInput.placeholder = 'Type a message...';
          if (document.activeElement !== this.chatInput) {
            this.chatInput.focus();
          }
        }
      } else {
        this.chatFlyout.classList.remove('focused');
        this.chatFlyout.classList.add('unfocused');
        if (this.chatInput) {
          this.chatInput.placeholder = 'Click here to chat (WASD moves avatar)...';
          if (document.activeElement === this.chatInput) {
            this.chatInput.blur();
          }
        }
      }
    }

    eventBus.emit('ui:chat_focus', focused);
  }

  /**
   * Opens the direct chat flyout for the specified peer.
   * @param {string} peerId - Target peer identifier
   * @param {string} [peerHandle='Peer'] - Target peer handle name
   * @param {boolean} [shouldFocus=true] - Whether to grant immediate keyboard focus
   */
  openChat(peerId, peerHandle = 'Peer', shouldFocus = true) {
    this.isChatOpen = true;
    this.activePeerId = peerId;
    this.activePeerHandle = peerHandle;

    if (this.chatPeerHandle) {
      this.chatPeerHandle.textContent = peerHandle;
    }

    if (this.chatFlyout) {
      this.chatFlyout.classList.add('open');
    }

    this.setChatFocus(shouldFocus);
  }

  /**
   * Closes the direct chat flyout.
   */
  closeChat() {
    this.isChatOpen = false;
    this.setChatFocus(false);
    if (this.chatFlyout) {
      this.chatFlyout.classList.remove('open');
    }
  }

  /**
   * Toggles the visibility of the chat flyout.
   */
  toggleChat() {
    if (this.isChatOpen) {
      this.closeChat();
    } else {
      this.openChat(this.activePeerId || 'peer1', this.activePeerHandle || 'Peer', true);
    }
  }

  /**
   * Appends a message to the chat message container.
   * Uses textContent to guarantee protection against XSS vulnerabilities.
   * @param {string} sender - Message sender handle
   * @param {string} text - Message text
   * @param {boolean} isLocal - True if sent by local player
   * @param {number} [timestamp=Date.now()] - Timestamp in milliseconds
   */
  appendMessage(sender, text, isLocal, timestamp = Date.now()) {
    if (!this.chatMessages) return;

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${isLocal ? 'outgoing' : 'incoming'}`;

    const senderEl = document.createElement('span');
    senderEl.className = 'chat-bubble-sender';
    senderEl.textContent = sender;

    const textEl = document.createElement('div');
    textEl.className = 'chat-bubble-text';
    textEl.textContent = text;

    const timeEl = document.createElement('span');
    timeEl.className = 'chat-bubble-time';
    const date = new Date(timestamp);
    timeEl.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    bubble.appendChild(senderEl);
    bubble.appendChild(textEl);
    bubble.appendChild(timeEl);

    this.chatMessages.appendChild(bubble);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  setStatus(message) {
    this.statusMessage.textContent = message;
    this.statusMessage.classList.remove('hidden');
  }

  /**
   * Displays the persistent header, status toolbars, and controls legend.
   * @param {string|null} joinCode - Optional join code to display for the host.
   */
  showToolbars(joinCode = null) {
    this.uiHeader.classList.remove('hidden');
    if (this.controlsLegend) {
      this.controlsLegend.classList.remove('hidden');
    }
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

