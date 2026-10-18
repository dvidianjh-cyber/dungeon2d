/** Last Modified: 2026-10-17. Quiet synthesized sounds; no downloads or autoplay. */
export class Sound {
  /** Restore a user's audio preference without requiring storage access. */
  constructor() { try { this.muted = localStorage.getItem('dungeon2d-muted') === 'true'; } catch { this.muted = false; } }
  /** Unlock audio only in response to a gesture. */
  unlock() { try { this.context ||= new (window.AudioContext || window.webkitAudioContext)(); if (this.context.state === 'suspended') this.context.resume().catch(() => {}); } catch { /* Gameplay also works without Web Audio. */ } }
  /** Toggle and remember subtle interface/game sounds. */
  toggle() { this.muted = !this.muted; try { localStorage.setItem('dungeon2d-muted', this.muted); } catch {} this.unlock(); this.play('menu'); return this.muted; }
  /** Play a brief low-volume note or two-note cue. */
  play(kind = 'menu') {
    if (this.muted || !this.context || this.context.state !== 'running') return;
    const notes = { menu: [440], action: [330], pickup: [660, 880], coin: [880, 1174], talk: [330, 392], use: [440, 660], enter: [262, 392], error: [196] }[kind] || [440];
    notes.forEach((hz, index) => {
      const oscillator = this.context.createOscillator(), gain = this.context.createGain(), start = this.context.currentTime + index * .065;
      oscillator.type = 'sine'; oscillator.frequency.value = hz; gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.035, start + .008); gain.gain.exponentialRampToValueAtTime(.0001, start + .12);
      oscillator.connect(gain); gain.connect(this.context.destination); oscillator.start(start); oscillator.stop(start + .14);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  }
}
