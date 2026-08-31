/**
 * Last Modified: 2026-08-31
 * 
 * Manages WebRTC signaling and DataChannels using PeerJS.
 */
import eventBus from '../utils/EventBus.js';
import Peer from 'peerjs';

class WebRTCEngine {
  constructor() {
    this.peer = null;
    this.connection = null;
    this.isHost = false;
    this.localHandle = '';
  }

  setLocalHandle(handle) {
    this.localHandle = this.sanitizeString(handle);
  }

  /**
   * Sanitizes string to prevent XSS.
   * @param {string} str 
   * @returns {string}
   */
  sanitizeString(str) {
    if (!str) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        "/": '&#x2F;',
    };
    const reg = /[&<>"'/]/ig;
    return str.replace(reg, (match)=>(map[match]));
  }

  initAsHost() {
    this.isHost = true;
    this.peer = new Peer(); // Uses default cloud server

    this.peer.on('open', (id) => {
      eventBus.emit('network:ready_host', id);
    });

    this.peer.on('connection', (conn) => {
      if (this.connection) {
        conn.close(); // Only allow one peer for now
        return;
      }
      this.setupConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.error(err);
      eventBus.emit('network:status', 'Error: ' + err.message);
    });
  }

  initAsClient(hostId) {
    this.isHost = false;
    this.peer = new Peer();

    this.peer.on('open', () => {
      const conn = this.peer.connect(hostId, { reliable: false }); // Unreliable is better for fast state sync
      this.setupConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.error(err);
      eventBus.emit('network:status', 'Error: ' + err.message);
    });
  }

  setupConnection(conn) {
    this.connection = conn;

    this.connection.on('open', () => {
      eventBus.emit('network:status', 'Connected!');
      eventBus.emit('network:connected');
      
      // Send INIT payload with handle
      this.connection.send({
        type: 'INIT',
        payload: {
          handle: this.localHandle
        }
      });
      
      if (this.isHost) {
        eventBus.emit('network:peer_joined');
      }
    });

    this.connection.on('data', (data) => {
      this.handleIncomingData(data);
    });

    this.connection.on('close', () => {
      console.warn('Connection closed.');
      eventBus.emit('network:peer_count', 0);
    });
  }

  handleIncomingData(rawData) {
    try {
      // Sanitize the raw data if it's a string, or parse and sanitize string fields
      let parsed;
      if (typeof rawData === 'string') {
        parsed = JSON.parse(rawData);
      } else {
        parsed = rawData;
      }
      
      if (parsed.type === 'INIT') {
        const safeHandle = this.sanitizeString(parsed.payload.handle);
        eventBus.emit('network:peer_init', { handle: safeHandle });
      } else if (parsed.type === 'STATE_SYNC') {
        // Sanitize any string fields inside STATE_SYNC just in case, though they are usually numbers
        if (parsed.payload && typeof parsed.payload.handle === 'string') {
           parsed.payload.handle = this.sanitizeString(parsed.payload.handle);
        }
        eventBus.emit('network:peer_state', parsed.payload);
      } else if (parsed.type === 'ROOM_DATA') {
        eventBus.emit('network:room_data', parsed.payload);
      }
    } catch (e) {
      console.error('Error parsing network data', e);
    }
  }

  sendState(statePayload) {
    if (this.connection && this.connection.open) {
      this.connection.send({
        type: 'STATE_SYNC',
        payload: statePayload
      });
    }
  }

  sendRoomData(roomData) {
    if (this.connection && this.connection.open) {
      this.connection.send({
        type: 'ROOM_DATA',
        payload: roomData
      });
    }
  }
}

const webrtcEngine = new WebRTCEngine();
export default webrtcEngine;
