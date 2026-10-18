<!-- Last Modified: 2026-10-17 -->
# Changelog

All notable changes to this project will be documented in this file.

## [v0.3.0] - 2026-10-17
### Added
- Littleton, a modern town with twelve enterable venues, eleven local interiors and a separate linked casino pack.
- Metadata-defined maps, items, NPCs, conversations, shops, fetch quests, effects, palettes and custom item pixel grids.
- Original pixel scenery, animated directional characters, camera zoom, minimap and full destination map.
- Inspect/talk/take/use/drop/buy/sell/enter actions, inventory, gold, bank balances, cinema ticket interaction and a fictional-gold dice game.
- Solo mode and up to eight players through a host-authoritative PeerJS room, shared object/stock state, late-join metadata, map-independent party members and room chat.
- Validated `.dungeon` ZIP import/export with complete dependency graphs, browser persistence for imported packs and a command-line pack builder.
- Responsive adventure UI, touch movement, journal, outfit selection and subtle gesture-gated synthesized sound.
- Automated gameplay, archive and multiplayer-protocol tests, plus an authoring guide.
### Changed
- Replaced the proof-of-concept single-room runtime with separate world, pack, network, rendering, audio and UI modules.
- Large JSON protocol messages now use PeerJS binary framing for automatic chunking.
- Updated the affected source-map build dependency to the patched release.

## [v0.2.1] - 2026-09-05
### Added
- Tabbed connection modal interface on welcome screen separating "Create Room" and "Join Room" workflows.
- Dynamic conditional Join Code field exclusively displayed when the "Join Room" tab is active.
- Unified dynamic action button updating its text ("Create Room (Host)" vs "Join Room") and dispatch target based on active tab.
- State retention for player handle input across tab transitions.
- Configurable `enabledRange` system for peer modal action buttons:
  - "Talk" action button is dynamically enabled only when the player avatar is within 1 grid square (100px) of the peer.
  - Clicking a distant peer shows the modal with a disabled, grayed-out Talk button (`💬 Talk (Out of Range)`).
  - Moving into 1-grid-square range automatically and immediately lights up the button (`.in-range`, vibrant blue glow, clickable).
### Changed
- Streamlined welcome dialog from vertically stacked form to horizontal flexbox tabs.
- Aligned the top of the chat flyout with the bottom of the persistent app title bar (60px) and reduced height to `calc(100vh - 60px)`.
### Fixed
- Resolved `Uncaught TypeError: Failed to resolve module specifier "peerjs"` on GitHub Pages by replacing bare module import with a local vendor wrapper and bundling `peerjs.min.js`.
- Resolved `404 Not Found (vite.svg)` by providing a themed dungeon emblem SVG asset at `./vite.svg` and `public/vite.svg`.

## [v0.2.0] - 2026-09-05
### Added
- Floating Controls Legend permanently anchored to the bottom-left of the viewport displaying WASD movement keys and avatar color legend.
- Screen-to-world coordinate transformation in RenderEngine accounting for camera translation, zoom scale, and viewport dimensions.
- Mouse-picking and intersection detection against 40x40 pixel AABB bounds of remote peers.
- Transient hover tooltip and persistent click-locked glassmorphic modal displaying peer information and "Talk" button.
- 1-on-1 private Direct Chat sliding flyout pane with real-time WebRTC DataChannel message delivery.
- Strict XSS sanitization on incoming direct chat payloads via `sanitizeString()` and DOM text node handling.
- Keyboard focus management between chat pane and avatar movement:
  - Initiating chat grants exclusive keyboard focus to the chat input and halts avatar WASD movement.
  - Receiving incoming chat opens the flyout in a non-keyboard-focused, higher transparency state without interrupting avatar movement.
  - Clicking outside the chat pane shifts keyboard focus back to avatar movement and increases flyout transparency.
  - Clicking inside the chat pane restores full opacity and re-focuses the chat input.
  - Sending a message (via Enter key or clicking 'Send') automatically shifts keyboard focus back to the avatar and dims the chat pane.
### Changed
- Decoupled Canvas rendering and user interaction through Event Bus events (`input:peer_hover`, `input:peer_unhover`, `input:peer_click`, `input:canvas_click`, `network:direct_chat`, `ui:chat_focus`).

## [v0.1.2] - 2026-08-31
### Added
- Inter-player AABB collision. Player characters physically block each other and allow sliding.
- Environmental obstacle definitions in the RoomManager.
- Collision checks against static obstacles for the local player.
- Obstacle rendering in RenderEngine using dark gray fills and borders.
### Fixed
- Fixed bug where spawning on top of a peer or obstacle permanently stuck players. Added dynamic spawn-point generation and escape-logic for overlapping AABBs.

## [v0.1.1] - 2026-08-31
### Added
- Persistent Header and Status toolbars over the canvas.
- Immediate host entry to canvas (no waiting screen).
- Player Handle system: Users must input a handle, which is sanitized and displayed below their avatar.
- Mouse wheel zooming centered on the player in the RenderEngine.
### Changed
- Reduced default room bounds to 1000x1000 (from 2000x2000).

## [v0.1.0] - 2026-08-31
### Added
- Project Scaffolding with Vite and Vanilla JS.
- UI overlay for Host Room Creation and Joining Room by Code.
- WebRTCEngine using PeerJS for signaling and DataChannels for P2P connection.
- GameLoop running at 20 ticks per second syncing player movement.
- RenderEngine with fixed-center camera translating around a 2D Canvas.
- RoomManager handling data-driven room bounding boxes and schemas.
- EventBus handling module decoupling.
