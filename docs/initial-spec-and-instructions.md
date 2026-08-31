# Coding Agent Instructions

## 1. Professional Persona

* **Role:** Senior Frontend Architect favoring robust, modular, and DRY code.


* **Focus:** Privacy-first, performant, local-web architecture.



## 2. Versioning & Change Management

* **Changelog:** After every feature completion, update `CHANGELOG.md` with version (v0.x.x), date, and changes.


* **Headers:** Every modified file must have a "Last Modified" comment at the top.



## 3. Implementation Workflow (Plan-First)

* **The 'Think' Phase:** Before writing code, provide a "Plan of Action" for user approval.


* **Verification:** Explain how you verified the code against the Technical Guardrails.



## 4. Quality Guardrails

* **No Shortcuts:** Never use hard-coded pixel offsets for UI centering. Use Flex/Grid.


* **Modularity:** Separate DOM manipulation from business logic (e.g., isolate Canvas rendering from WebRTC signaling).


* **Cleanup:** Ensure all event listeners are named functions for proper cleanup when destroying sessions.



## 5. Definition of Done (DoD)

*Before declaring a task finished, verify:*

1. [ ] No placeholder comments (e.g., `// logic here`) remain.


2. [ ] All new functions are documented with JSDoc.


3. [ ] `CHANGELOG.md` is updated.


4. [ ] The UI remains responsive and functional down to 320px width.



# Environment & Tech Stack

## 1. The Tech Stack

* **HTML/CSS/JS:** HTML5 Canvas API for 2D rendering, modern CSS3 for UI dialogs, Vanilla JS (ES6+ Modules) for logic.


* **Build Tools:** Vite (recommended for easy local dev and seamless bundling for GitHub Pages).



## 2. Persistence & Networking

* **Primary Storage:** WebRTC DataChannels for low-latency peer-to-peer game state synchronization. LocalStorage for saving recent join codes/player names.


* **Data Format:** Strict JSON for WebRTC message payloads.


* **Signaling:** Lightweight WebSocket or third-party STUN/TURN wrapper (like PeerJS) strictly for the initial "join code" handshake, passing off to serverless P2P.

## 3. Data Communication Contract

* **Protocol:** The game loop and network layer communicate via a Custom Event Bus to keep rendering decoupled from state updates.



# Dungeon 2D - Specification

## 1. Project Summary

* **Name:** Dungeon2D


* **Description:** A WebRTC 2D P2P Room Engine. A serverless, browser-based multiplayer template where users can create private peer-to-peer rooms via join codes and navigate a top-down 2D grid.


* **Key Features:**
* Seamless WebRTC P2P connections requiring no dedicated game servers.


* Fixed-center camera system traversing an infinite-style 2D grid environment.





## 2. Feature Modules

* **Module A: UI & Signaling Controller:** Handles the "Create/Join Room" dialogs and the initial WebRTC handshake via connection codes.


* **Module B: WebRTC Engine:** Manages RTCPeerConnection, DataChannels, and payload serialization/deserialization.


* **Module C: Game Loop & Input:** Captures WASD keystrokes, calculates velocity/position, and manages the animation frame loop.


* **Module D: Render & Physics Engine:** Draws the infinite 2D grid, manages the player-centric camera translation, renders icons, and computes basic wall collision.



## 3. User Stories

* **Story 1:** As a player, I want to see a simple prompt to create or join a room, so that I can easily connect without creating an account.


* **Story 2:** As a player, I want my character to remain in the dead center of the screen while the scenery moves around me, so that navigation feels intuitive.


* **Story 3:** As a player, I want to be stopped by the rectangular room walls, so that the bounds of the play area are respected.



## 4. UI/UX Design

* **Theme & Styling:** Minimalist, dark-mode preferred. Clean modal overlays for the connection screens.


* **Page Layout:** Full viewport Canvas with absolutely positioned HTML UI overlays for dialogs.


* **Component Specifics:** High-contrast, easy-to-read join codes.



## 5. Technical Specifics & Guardrails

* **Layout & Positioning:** The Canvas must dynamically resize to `window.innerWidth/innerHeight` on resize events.


* **Physics:** Implement Axis-Aligned Bounding Box (AABB) collision for the player icon against the rectangular room walls.
* **Camera Logic:** Rather than moving the player coordinates on the canvas, translate the canvas context in the opposite direction of the player's world-space movement before drawing the grid and walls.

## 6. Boundary Conditions & Edge Cases

* **Empty States:** The app must gracefully display an error if a join code is invalid or the connection times out.


* **Network Latency:** Game loop must decouple rendering (visuals) from state updates (physics) to handle varying P2P ping times.
* **Security:** Sanitize all incoming WebRTC string payloads to prevent XSS if chat or player names are introduced later.



## 7. Project-Specific Logic (Phase 2 Multiplayer Prep)

* **Tick Rate (Logic A):** Define a steady update rate for peer communication (e.g., sending positional data 20 times per second) rather than syncing on every single frame.


* **Peer Rendering:** Remote players should be drawn based on their transmitted world coordinates relative to the local player's camera translation.
* **Inter-player Collision:** Define an AABB check between the local player bounds and the most recently received peer coordinates.