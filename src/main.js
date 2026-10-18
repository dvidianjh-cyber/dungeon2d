/** Last Modified: 2026-10-17. Application orchestration. */
import { PackManager } from './game/PackManager.js';
import { Session } from './network/Session.js';
import { TownRenderer } from './render/TownRenderer.js';
import { AdventureUI } from './ui/AdventureUI.js';
import { Sound } from './audio/Sound.js';
const library = new PackManager();
const session = new Session();
const renderer = new TownRenderer(document.getElementById('gameCanvas'));
const app = new AdventureUI(library, session, renderer, new Sound());
app.init();
