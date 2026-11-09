// 专属特效层：一块盖在游戏上面的 2D 画布，负责“完美落地大特效”；再加一圈随连击变强的边缘光晕。
// 纯外观，不影响判定和分数；只在有特效时才跑动画循环，闲时零开销。
// 画质：低端机（核心数少 / 系统开启“减少动态效果”）自动减半粒子并关闭闪屏。

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class SignatureFX {
  constructor(canvas, glowEl) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.glow = glowEl;
    this.ps = [];
    this.raf = 0;
    this.last = 0;
    this.dpr = 1;
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const weak = (navigator.hardwareConcurrency || 8) <= 4;
    this.quality = reduce ? 0.35 : weak ? 0.6 : 1;
    this.allowFlash = !reduce;
    this._resize = this._resize.bind(this);
    window.addEventListener('resize', this._resize);
    this._resize();
  }

  _resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth; this.h = window.innerHeight;
    this.cv.width = Math.round(this.w * this.dpr);
    this.cv.height = Math.round(this.h * this.dpr);
    this.cv.style.width = this.w + 'px'; this.cv.style.height = this.h + 'px';
  }

  /* ---------- 对外接口 ---------- */
  /**
   * 完美落地大特效
   * @param {string} kind   SIGNATURE[x].burst
   * @param {number} x,y    屏幕坐标（px）
   * @param {object} opt    { color, mul（稀有度倍数）, flash, combo }
   */
  burst(kind, x, y, opt = {}) {
    const fn = BURSTS[kind];
    if (!fn) return;
    const mul = (opt.mul || 1) * this.quality * (1 + Math.min(opt.combo || 1, 8) * 0.06);
    fn(this, x, y, { color: opt.color || '#fff', mul, combo: opt.combo || 1 });
    if (opt.flash && this.allowFlash) this.add({ shape: 'flash', life: 0.28, max: 0.28, color: opt.color || '#fff', alpha: 0.5 });
    this._run();
  }

  /** 连击氛围：边缘光晕，连击越高越亮；combo 低于 from 就关掉 */
  ambience(combo, color, from = 2, mul = 1) {
    if (!this.glow) return;
    const on = combo >= from;
    const k = on ? Math.min(1, (combo - from + 1) / 6) * mul : 0;
    this.glow.style.setProperty('--glow', color || '#fff');
    this.glow.style.setProperty('--gk', String(Math.min(1.4, k)));
    this.glow.classList.toggle('on', on);
  }

  clear() {
    this.ps.length = 0;
    this.ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    this.ambience(0);
  }

  add(p) {
    p.life = p.life ?? 1; p.max = p.max ?? p.life;
    this.ps.push(p);
    if (this.ps.length > 900) this.ps.splice(0, this.ps.length - 900);
  }

  /* ---------- 动画循环 ---------- */
  _run() {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this._step(dt);
      if (this.ps.length) this.raf = requestAnimationFrame(loop);
      else { this.raf = 0; this.ctx.clearRect(0, 0, this.cv.width, this.cv.height); }
    };
    this.raf = requestAnimationFrame(loop);
  }

  _step(dt) {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    const ps = this.ps;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) { ps.splice(i, 1); continue; }
      if (p.delay > 0) { p.delay -= dt; p.life += dt; continue; }
      p.age = p.max - p.life;
      if (p.vx !== undefined) {
        p.vy += (p.g || 0) * dt;
        if (p.drag) { const k = Math.pow(p.drag, dt * 60); p.vx *= k; p.vy *= k; }
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      if (p.orbit) { p.ang += p.orbit * dt; p.r += (p.rv || 0) * dt; p.x = p.cx + Math.cos(p.ang) * p.r; p.y = p.cy + Math.sin(p.ang) * p.r * 0.55; }
      if (p.vr) p.rot = (p.rot || 0) + p.vr * dt;
      this._draw(c, p);
    }
    c.globalAlpha = 1;
  }

  _draw(c, p) {
    const k = p.life / p.max;               // 1 → 0
    const a = (p.alpha ?? 1) * Math.min(1, k * 2.2);
    c.globalAlpha = Math.max(0, a);
    switch (p.shape) {
      case 'flash':
        c.fillStyle = p.color; c.fillRect(0, 0, this.w, this.h); break;
      case 'ring': {
        const r = p.r0 + (p.r1 - p.r0) * (1 - k);
        c.strokeStyle = p.hue !== undefined ? `hsl(${(p.hue + p.age * 360) % 360},95%,62%)` : p.color;
        c.lineWidth = (p.lw || 6) * k + 1;
        c.beginPath(); c.ellipse(p.x, p.y, r, r * (p.squash || 0.55), 0, 0, TAU); c.stroke(); break;
      }
      case 'coin': {
        const sx = Math.abs(Math.cos(p.age * (p.spin || 9) + (p.rot || 0)));
        c.save(); c.translate(p.x, p.y); c.scale(Math.max(0.12, sx), 1);
        c.fillStyle = '#ffd24a'; c.strokeStyle = '#b8860b'; c.lineWidth = 2;
        c.beginPath(); c.arc(0, 0, p.size, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = '#ffe98a'; c.beginPath(); c.arc(0, 0, p.size * 0.55, 0, TAU); c.fill();
        c.restore(); break;
      }
      case 'diamond':
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot || 0); c.fillStyle = p.color;
        c.beginPath(); c.moveTo(0, -p.size); c.lineTo(p.size * 0.6, 0); c.lineTo(0, p.size); c.lineTo(-p.size * 0.6, 0); c.closePath(); c.fill(); c.restore(); break;
      case 'star':
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot || 0); c.fillStyle = p.color;
        c.globalAlpha *= (0.65 + 0.35 * Math.sin(p.age * 18 + p.x));
        c.beginPath();
        for (let i = 0; i < 8; i++) { const r = i % 2 ? p.size * 0.38 : p.size; c.lineTo(Math.cos(i * Math.PI / 4) * r, Math.sin(i * Math.PI / 4) * r); }
        c.closePath(); c.fill(); c.restore(); break;
      case 'rect':
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot || 0); c.fillStyle = p.color;
        c.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size); c.restore(); break;
      case 'pixel':
        c.fillStyle = p.color; c.fillRect(Math.round(p.x / 6) * 6, Math.round(p.y / 6) * 6, p.size, p.size); break;
      case 'streak': {
        const len = p.size * (0.4 + k);
        const ca = Math.cos(p.ang), sa = Math.sin(p.ang);
        c.strokeStyle = p.color; c.lineWidth = p.lw || 3; c.lineCap = 'round';
        c.shadowColor = p.color; c.shadowBlur = 10;
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - ca * len, p.y - sa * len); c.stroke();
        c.shadowBlur = 0; break;
      }
      case 'ember':
        c.fillStyle = `hsl(${12 + k * 36},100%,${48 + k * 14}%)`;
        c.beginPath(); c.arc(p.x, p.y, p.size * (0.4 + k * 0.7), 0, TAU); c.fill(); break;
      case 'flame': {
        c.fillStyle = `hsla(${14 + k * 30},100%,55%,0.9)`;
        c.beginPath(); c.ellipse(p.x, p.y, p.size * 0.55 * k + 2, p.size * (0.4 + k), 0, 0, TAU); c.fill(); break;
      }
      case 'flake': {
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot || 0);
        c.strokeStyle = p.color; c.lineWidth = 2; c.lineCap = 'round';
        for (let i = 0; i < 3; i++) { c.rotate(Math.PI / 3); c.beginPath(); c.moveTo(-p.size, 0); c.lineTo(p.size, 0); c.stroke(); }
        c.restore(); break;
      }
      case 'bubble':
        c.strokeStyle = p.color; c.lineWidth = 2.5; c.fillStyle = 'rgba(255,255,255,.22)';
        c.beginPath(); c.arc(p.x, p.y, p.size, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(p.x - p.size * 0.35, p.y - p.size * 0.35, p.size * 0.22, 0, TAU); c.fill(); break;
      case 'bolt': {
        c.strokeStyle = p.color; c.lineWidth = p.lw * (0.4 + k); c.lineJoin = 'round';
        c.shadowColor = p.color; c.shadowBlur = 16;
        c.beginPath(); p.pts.forEach((pt, i) => (i ? c.lineTo(pt[0], pt[1]) : c.moveTo(pt[0], pt[1]))); c.stroke();
        c.strokeStyle = '#fff'; c.lineWidth = Math.max(1, p.lw * 0.35 * k);
        c.beginPath(); p.pts.forEach((pt, i) => (i ? c.lineTo(pt[0], pt[1]) : c.moveTo(pt[0], pt[1]))); c.stroke();
        c.shadowBlur = 0; break;
      }
      case 'spark':
        c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.size * k + 1, 0, TAU); c.fill(); break;
      default: break;
    }
  }
}

/* ------------------------- 十种大特效 ------------------------- */
const n = (base, mul) => Math.max(3, Math.round(base * mul));

const BURSTS = {
  coins(fx, x, y, { mul }) {
    for (let i = 0; i < n(26, mul); i++) fx.add({ shape: 'coin', x: x + rnd(-14, 14), y, vx: rnd(-300, 300), vy: rnd(-760, -300), g: 1500, life: rnd(1.0, 1.6), size: rnd(9, 15), spin: rnd(7, 13), rot: rnd(0, 6) });
    fx.add({ shape: 'ring', x, y, r0: 10, r1: 150, color: '#ffd24a', lw: 8, life: 0.55 });
    for (let i = 0; i < n(14, mul); i++) fx.add({ shape: 'star', x: x + rnd(-80, 80), y: y + rnd(-90, 20), vx: 0, vy: -30, color: '#fff3b0', size: rnd(5, 9), life: rnd(0.5, 0.9), vr: 2 });
  },
  shards(fx, x, y, { mul }) {
    for (let i = 0; i < n(18, mul); i++) { const a = rnd(0, TAU), s = rnd(160, 460); fx.add({ shape: 'diamond', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, g: 500, drag: 0.985, color: pick(['#ffffff', '#dfe6f3', '#a9d6ff', '#c8c8d8']), size: rnd(7, 14), rot: rnd(0, 6), vr: rnd(-8, 8), life: rnd(0.6, 1.1) }); }
    fx.add({ shape: 'ring', x, y, r0: 8, r1: 130, color: '#ffffff', lw: 5, life: 0.45 });
    for (let i = 0; i < 6; i++) fx.add({ shape: 'star', x: x + rnd(-60, 60), y: y + rnd(-70, 30), vx: 0, vy: 0, color: '#fff', size: rnd(10, 18), life: rnd(0.3, 0.6), delay: rnd(0, 0.25), vr: 3 });
  },
  rainbow(fx, x, y, { mul }) {
    for (let i = 0; i < 4; i++) fx.add({ shape: 'ring', x, y, r0: 6, r1: 120 + i * 55, hue: i * 70, lw: 9, life: 0.7 + i * 0.1, delay: i * 0.05 });
    for (let i = 0; i < n(30, mul); i++) { const a = rnd(-Math.PI, 0), s = rnd(200, 620); fx.add({ shape: 'rect', x, y, vx: Math.cos(a) * s * 0.9, vy: Math.sin(a) * s, g: 900, drag: 0.99, color: `hsl(${Math.floor(rnd(0, 360))},95%,60%)`, size: rnd(4, 8), rot: rnd(0, 6), vr: rnd(-12, 12), life: rnd(0.9, 1.5) }); }
  },
  neon(fx, x, y, { mul, color }) {
    const cols = ['#00f0ff', '#ff3df2', '#7dff4f', '#ffe600'];
    for (let i = 0; i < n(22, mul); i++) { const a = (i / n(22, mul)) * TAU + rnd(-0.1, 0.1), s = rnd(420, 900); fx.add({ shape: 'streak', x, y, ang: a, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, drag: 0.93, color: pick(cols), size: rnd(40, 90), lw: rnd(2, 4), life: rnd(0.35, 0.6) }); }
    fx.add({ shape: 'ring', x, y, r0: 8, r1: 170, color: '#00f0ff', lw: 6, life: 0.5 });
    fx.add({ shape: 'ring', x, y, r0: 8, r1: 120, color: '#ff3df2', lw: 4, life: 0.4, delay: 0.06 });
  },
  galaxy(fx, x, y, { mul }) {
    for (let i = 0; i < n(30, mul); i++) fx.add({ shape: 'star', cx: x, cy: y, x, y, ang: rnd(0, TAU), r: rnd(6, 30), rv: rnd(80, 190), orbit: rnd(2.2, 4.2), color: pick(['#ffffff', '#ff9ee6', '#b69cff', '#7ad7ff']), size: rnd(5, 11), vr: 2, life: rnd(0.9, 1.5) });
    fx.add({ shape: 'ring', x, y, r0: 10, r1: 190, color: '#c77dff', lw: 9, life: 0.7 });
    for (let i = 0; i < 3; i++) { const sx = rnd(0, fx.w), sy = rnd(0, fx.h * 0.4); fx.add({ shape: 'streak', x: sx, y: sy, ang: Math.PI * 0.3, vx: 700, vy: 420, color: '#ffffff', size: 120, lw: 2.5, life: 0.5, delay: i * 0.12 }); }
  },
  blaze(fx, x, y, { mul }) {
    fx.add({ shape: 'ring', x, y, r0: 10, r1: 210, color: '#ff7a1a', lw: 14, life: 0.5 });
    fx.add({ shape: 'ring', x, y, r0: 6, r1: 140, color: '#ffd23f', lw: 8, life: 0.4, delay: 0.04 });
    for (let i = 0; i < n(18, mul); i++) fx.add({ shape: 'flame', x: x + rnd(-70, 70), y: y + rnd(-6, 14), vx: rnd(-40, 40), vy: rnd(-420, -180), g: -80, size: rnd(26, 52), life: rnd(0.45, 0.85) });
    for (let i = 0; i < n(30, mul); i++) fx.add({ shape: 'ember', x, y, vx: rnd(-320, 320), vy: rnd(-560, -120), g: 380, size: rnd(4, 9), life: rnd(0.7, 1.3) });
  },
  frost(fx, x, y, { mul }) {
    fx.add({ shape: 'ring', x, y, r0: 8, r1: 150, color: '#bfeaff', lw: 8, life: 0.55 });
    for (let i = 0; i < n(22, mul); i++) { const a = rnd(0, TAU), s = rnd(120, 360); fx.add({ shape: 'flake', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 100, g: 160, drag: 0.985, color: pick(['#ffffff', '#bfeaff', '#8fd3ff']), size: rnd(6, 13), rot: rnd(0, 3), vr: rnd(-3, 3), life: rnd(0.9, 1.5) }); }
    for (let i = 0; i < n(10, mul); i++) fx.add({ shape: 'diamond', x: x + rnd(-40, 40), y, vx: rnd(-120, 120), vy: rnd(-380, -160), g: 700, color: '#d9f4ff', size: rnd(6, 11), rot: rnd(0, 6), life: rnd(0.6, 1) });
  },
  bubbles(fx, x, y, { mul }) {
    for (let i = 0; i < n(20, mul); i++) fx.add({ shape: 'bubble', x: x + rnd(-60, 60), y: y + rnd(-10, 20), vx: rnd(-40, 40), vy: rnd(-260, -90), g: -30, color: pick(['#ff7fb0', '#ff4f8b', '#ffb3d1']), size: rnd(6, 17), life: rnd(0.9, 1.6) });
    fx.add({ shape: 'ring', x, y, r0: 8, r1: 120, color: '#ff7fb0', lw: 6, life: 0.45 });
  },
  pixel(fx, x, y, { mul }) {
    const cols = ['#ffe600', '#ff4f9a', '#3b2fd1', '#00e5ff', '#7dff4f'];
    for (let i = 0; i < n(36, mul); i++) { const a = rnd(0, TAU), s = rnd(140, 520); fx.add({ shape: 'pixel', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 160, g: 900, color: pick(cols), size: pick([6, 6, 12]), life: rnd(0.6, 1.2) }); }
    fx.add({ shape: 'ring', x, y, r0: 8, r1: 110, color: '#ffe600', lw: 6, life: 0.4, squash: 1 });
  },
  thunder(fx, x, y, { mul }) {
    const bolt = (tx, delay, lw) => {
      const pts = [[tx + rnd(-30, 30), -20]];
      const steps = 9;
      for (let i = 1; i <= steps; i++) pts.push([tx + (x - tx) * (i / steps) + rnd(-34, 34) * (1 - i / steps * 0.6), (y + 10) * (i / steps)]);
      pts[pts.length - 1] = [x, y + 8];
      fx.add({ shape: 'bolt', pts, color: '#ffe14a', lw, life: 0.36, delay });
    };
    bolt(x + rnd(-90, 90), 0, 7);
    if (mul > 0.9) { bolt(x + rnd(-140, 140), 0.07, 4); }
    if (mul > 1.5) { bolt(x + rnd(-200, 200), 0.13, 3); }
    fx.add({ shape: 'ring', x, y, r0: 8, r1: 170, color: '#ffe14a', lw: 10, life: 0.45, delay: 0.04 });
    for (let i = 0; i < n(20, mul); i++) { const a = rnd(0, TAU), s = rnd(200, 560); fx.add({ shape: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 0.95, g: 300, color: pick(['#ffe14a', '#fff7b0', '#ffffff']), size: rnd(3, 6), life: rnd(0.3, 0.7), delay: 0.04 }); }
  },
};

export const BURST_KINDS = Object.keys(BURSTS);
