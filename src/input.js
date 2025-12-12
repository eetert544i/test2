export class Input {
  constructor() {
    this.state = new Set();
    this.listeners = new Set();
    window.addEventListener('keydown', (e) => this.handle(e, true));
    window.addEventListener('keyup', (e) => this.handle(e, false));
  }

  handle(e, down) {
    const keys = ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space', 'KeyR'];
    if (!keys.includes(e.code)) return;
    if (down) this.state.add(e.code); else this.state.delete(e.code);
    this.listeners.forEach((fn) => fn(this.state));
    e.preventDefault();
  }

  onChange(fn) { this.listeners.add(fn); }
  offChange(fn) { this.listeners.delete(fn); }

  get throttle() { return this.state.has('ArrowRight') ? 1 : 0; }
  get brake() { return this.state.has('ArrowLeft') ? 1 : 0; }
  get leanLeft() { return this.state.has('KeyA'); }
  get leanRight() { return this.state.has('KeyD'); }
  get reset() { return this.state.has('Space') || this.state.has('KeyR'); }
}
