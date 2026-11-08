// 简单音效（WebAudio 合成，无需音频文件）。首次用户交互后才会真正发声。
export class Sound {
  constructor() { this.ctx = null; this.chargeOsc = null; this.muted = false; }

  _ensure() {
    if (this.muted) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { this.ctx = new AC(); } catch (e) { return null; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  _blip(freq, dur, type = 'sine', vol = 0.15, slideTo = null) {
    const ctx = this._ensure(); if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  chargeStart() {
    const ctx = this._ensure(); if (!ctx) return;
    this.chargeStop();
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
    o.type = 'triangle';
    o.frequency.setValueAtTime(180, t);
    o.frequency.linearRampToValueAtTime(620, t + 1.6);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.08);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    this.chargeOsc = { o, g };
  }
  chargeStop() {
    if (!this.chargeOsc || !this.ctx) return;
    const { o, g } = this.chargeOsc, t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.stop(t + 0.06);
    this.chargeOsc = null;
  }
  jump() { this._blip(420, 0.15, 'square', 0.05, 760); }
  land() { this._blip(220, 0.12, 'sine', 0.2, 120); }
  perfect() { this._blip(880, 0.12, 'sine', 0.12); setTimeout(() => this._blip(1320, 0.2, 'sine', 0.12), 90); }
  fall() { this._blip(300, 0.45, 'sawtooth', 0.08, 60); }
}
