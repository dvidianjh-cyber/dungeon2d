/**
 * Last Modified: 2026-09-05
 * 
 * Vendor wrapper for PeerJS.
 * Resolves Peer from the global window object (loaded via script tag)
 * allowing native unbundled browser execution without bare module specifier errors.
 */
const Peer = (typeof window !== 'undefined' && (window.Peer || (window.peerjs && window.peerjs.Peer))) || null;

export default Peer;
