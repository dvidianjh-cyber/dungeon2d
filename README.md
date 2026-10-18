<!-- Last Modified: 2026-10-18 -->
# Dungeon2D · Littleton

A playable, metadata-driven multiplayer adventure. Explore a modern town with animated pixel characters, residents, inventory, gold, shops, a bank, a small quest and a linked casino world.

```powershell
npm install
npm run dev -- --host 0.0.0.0
```

Open the URL Vite prints (normally `http://localhost:5173`). Use **On my own** for immediate offline gameplay after the app has loaded, **Host friends** to create an online room, or **Join friends** with the host's `LT-XXXXXXXX` code. Up to eight players share one host-owned world. Hosting automatically sends the complete pack bundle to joining players.

## Playing

- Move: **WASD / arrow keys**, or the on-screen arrows on small screens.
- Interact: click an entity, or **E** near one; choose Inspect, Talk, Take, Use or Enter.
- Inventory: **I**. Select an item to inspect, use or drop it. Dropped items can be picked up by other players.
- Shop: approach a merchant, click Buy, then a price. Select a carried item to Sell for half its value.
- Map: **M**. Select a destination to highlight its entrance. This does not teleport you.
- Chat: Friends tab; messages are shared with the entire room.
- Sound: the music-note button toggles quiet synthesized interaction sounds.

Littleton includes **Adelles House, Jims House, Gez’s House, Wooly’s House, Mikes House, Restaurant, Pub, Cinema, Casino, General Store, Bank and Office Block**. Every building is enterable. The casino is a separate linked pack. Find Adelle’s key by the fountain, talk to Adelle at home, select her, and use the key from your inventory. Buy a cinema ticket and use it on the projector. The bank deposits/withdraws ten gold; the casino uses fictional in-game gold only.

## Dungeon packs

Use **Download pack** to export the selected adventure and every dependency as a `.dungeon` ZIP. Use **Import a dungeon** to validate and install one. Imported packs persist in browser local storage. Packs are data only; they cannot run scripts or fetch external assets. Imports are atomic and capped at 4 MB compressed and expanded. A changed pack must have a new ID instead of silently replacing an installed world.

Editable built-ins live in `public/packs/littleton.json` and `public/packs/golden-hour.json`. All maps, item definitions, NPC conversations, shops, portals, palettes and starting player state live there. The renderer provides reusable pixel-art primitives and supports custom item pixel grids.

See [the pack format and authoring guide](docs/dungeon-pack-format.md). To package edited or new JSON files:

```powershell
node scripts/pack.mjs littleton.dungeon littleton public/packs/littleton.json public/packs/golden-hour.json
```

`scripts/create-sample-packs.mjs` regenerates bundled JSON and will overwrite manual edits to those two sample files.

## Verification and production

```powershell
npm test
npm run build
npm run preview
```

Deploy the `dist/` directory to any static web host. Relative asset URLs support GitHub Pages subpaths. Use HTTPS for public multiplayer. The app has no required game server: PeerJS cloud signalling introduces peers, then the host validates all movement and actions over reliable WebRTC data channels. Messages remain JSON; PeerJS binary framing chunks larger metadata transfers. There is a seven-guest room limit, request-size/rate limits, stale-input expiry, collision-safe arrivals, late-join snapshots and explicit host-disconnect handling.

For GitHub Pages, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. The workflow in `.github/workflows/pages.yml` installs dependencies, runs tests, builds the app and publishes only `dist/` on every push to `main`. Publishing the repository root directly serves unbundled npm imports (`fflate`, `peerjs`) and omits the public assets at their expected URLs, leaving the menu stuck on “Loading adventures…”. The build regression test checks the bundled module graph, favicon and adventure packs under a project subpath.

PeerJS cloud availability and peer-to-peer network connectivity are external requirements. Some firewalls or symmetric NATs require a TURN relay; configure your deployment's short-lived TURN credentials through the PeerJS `config.iceServers` options in `src/network/Session.js`. Do not embed permanent TURN credentials in a public bundle. There is no automatic host migration or reconnect/resume. Leaving ends the session's progress; names, outfit, mute preference and imported packs are saved, but inventories/world progress are session-scoped. Font loading is optional and falls back to installed fonts.

## Code layout

| Module | Responsibility |
| --- | --- |
| `src/game/World.js` | Authoritative rules, collision, inventory, economy, quests, portals |
| `src/game/PackManager.js` | Data validation, dependency graphs, ZIP import/export |
| `src/network/Session.js` | Multiplayer protocol, signalling and lifecycle |
| `src/render/TownRenderer.js` | Terrain, pixel graphics, animated sprites, camera |
| `src/ui/AdventureUI.js` | DOM UI, keyboard/touch intent, map, journal and chat |
| `src/audio/Sound.js` | Gesture-gated, low-volume Web Audio cues |

The host is trusted to run the shared simulation. Joining players cannot set their gold, inventory, position or another participant's identity. This is a small cooperative adventure, not an adversarial competitive server.
