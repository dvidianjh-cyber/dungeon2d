# Changelog

All notable changes to this project will be documented in this file.

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
