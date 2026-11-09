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

  /** 镜头移动时，让还在播放的特效跟着场景一起平移（特效是屏幕坐标，镜头一动就会和罐子错开） */
  shift(dx, dy) {
    if (!this.ps.length || (!dx && !dy)) return;
    for (const p of this.ps) {
      p.x += dx; p.y += dy;
      if (p.cx !== undefined) { p.cx += dx; p.cy += dy; }
      if (p.pts) for (const q of p.pts) { q[0] += dx; q[1] += dy; }
    }
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
        const r = Math.max(0.5, p.r0 + (p.r1 - p.r0) * (1 - Math.min(1, k)));
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

// 所有特效都以“罐底与方块顶面的接触点”为中心，沿地面（压扁的椭圆）向外扩散，
// 只允许小幅弹起，不再往罐子头顶上冲。FLAT = 地面椭圆的纵横比（和冲击环一致）。
const FLAT = 0.5;
const ground = (a, s, lift = 0) => ({ vx: Math.cos(a) * s, vy: Math.sin(a) * s * FLAT - lift });
const onRim = (x, y, rx) => { const a = rnd(0, TAU), r = rnd(0.3, 1) * rx; return { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * FLAT }; };
const shock = (fx, x, y, color, r1, lw, delay = 0) => fx.add({ shape: 'ring', x, y, r0: 8, r1, color, lw, life: 0.5, delay, squash: FLAT });

const BURSTS = {
  coins(fx, x, y, { mul }) {
    shock(fx, x, y, '#ffd24a', 170, 9);
    for (let i = 0; i < n(26, mul); i++) fx.add({ shape: 'coin', x, y, ...ground(rnd(0, TAU), rnd(140, 380), rnd(120, 260)), g: 1100, drag: 0.985, life: rnd(0.5, 0.8), size: rnd(8, 13), spin: rnd(7, 13), rot: rnd(0, 6) });
    for (let i = 0; i < n(14, mul); i++) fx.add({ shape: 'star', ...onRim(x, y, 110), vx: 0, vy: 0, color: '#fff3b0', size: rnd(5, 9), life: rnd(0.4, 0.8), delay: rnd(0, 0.15), vr: 2 });
  },
  shards(fx, x, y, { mul }) {
    shock(fx, x, y, '#ffffff', 150, 6);
    for (let i = 0; i < n(18, mul); i++) fx.add({ shape: 'diamond', x, y, ...ground(rnd(0, TAU), rnd(180, 460), rnd(40, 120)), g: 600, drag: 0.97, color: pick(['#ffffff', '#dfe6f3', '#a9d6ff', '#c8c8d8']), size: rnd(7, 13), rot: rnd(0, 6), vr: rnd(-8, 8), life: rnd(0.45, 0.8) });
    for (let i = 0; i < 6; i++) fx.add({ shape: 'star', ...onRim(x, y, 90), vx: 0, vy: 0, color: '#fff', size: rnd(10, 16), life: rnd(0.3, 0.55), delay: rnd(0, 0.2), vr: 3 });
  },
  rainbow(fx, x, y, { mul }) {
    for (let i = 0; i < 4; i++) fx.add({ shape: 'ring', x, y, r0: 6, r1: 120 + i * 50, hue: i * 70, lw: 9, life: 0.65 + i * 0.1, delay: i * 0.05, squash: FLAT });
    for (let i = 0; i < n(30, mul); i++) fx.add({ shape: 'rect', x, y, ...ground(rnd(0, TAU), rnd(200, 520), rnd(60, 180)), g: 800, drag: 0.97, color: `hsl(${Math.floor(rnd(0, 360))},95%,60%)`, size: rnd(4, 8), rot: rnd(0, 6), vr: rnd(-12, 12), life: rnd(0.55, 0.9) });
  },
  neon(fx, x, y, { mul }) {
    const cols = ['#00f0ff', '#ff3df2', '#7dff4f', '#ffe600'];
    const m = n(22, mul);
    for (let i = 0; i < m; i++) { const a = (i / m) * TAU + rnd(-0.1, 0.1), s = rnd(420, 860), v = ground(a, s); fx.add({ shape: 'streak', x, y, ang: Math.atan2(v.vy, v.vx), ...v, drag: 0.92, color: pick(cols), size: rnd(30, 70), lw: rnd(2, 4), life: rnd(0.3, 0.5) }); }
    shock(fx, x, y, '#00f0ff', 180, 6);
    shock(fx, x, y, '#ff3df2', 125, 4, 0.06);
  },
  galaxy(fx, x, y, { mul }) {
    for (let i = 0; i < n(30, mul); i++) fx.add({ shape: 'star', cx: x, cy: y, x, y, ang: rnd(0, TAU), r: rnd(6, 30), rv: rnd(80, 170), orbit: rnd(2.2, 4.2), color: pick(['#ffffff', '#ff9ee6', '#b69cff', '#7ad7ff']), size: rnd(5, 10), vr: 2, life: rnd(0.8, 1.3) });
    shock(fx, x, y, '#c77dff', 200, 9);
    for (let i = 0; i < 3; i++) { const sx = rnd(0, fx.w), sy = rnd(0, fx.h * 0.4); fx.add({ shape: 'streak', x: sx, y: sy, ang: Math.PI * 0.3, vx: 700, vy: 420, color: '#ffffff', size: 120, lw: 2.5, life: 0.5, delay: i * 0.12 }); }
  },
  blaze(fx, x, y, { mul }) {
    shock(fx, x, y, '#ff7a1a', 220, 14);
    shock(fx, x, y, '#ffd23f', 150, 8, 0.04);
    // 一圈贴地的火苗：沿地面椭圆排开，只往上窜一小段
    for (let i = 0; i < n(18, mul); i++) { const a = rnd(0, TAU), r = rnd(30, 110); fx.add({ shape: 'flame', x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * FLAT, vx: Math.cos(a) * 60, vy: rnd(-120, -50), g: -40, size: rnd(18, 34), life: rnd(0.35, 0.6), delay: rnd(0, 0.08) }); }
    for (let i = 0; i < n(30, mul); i++) fx.add({ shape: 'ember', x, y, ...ground(rnd(0, TAU), rnd(160, 420), rnd(60, 200)), g: 700, drag: 0.98, size: rnd(4, 8), life: rnd(0.5, 0.9) });
  },
  frost(fx, x, y, { mul }) {
    shock(fx, x, y, '#bfeaff', 160, 8);
    for (let i = 0; i < n(22, mul); i++) fx.add({ shape: 'flake', x, y, ...ground(rnd(0, TAU), rnd(120, 340), rnd(20, 80)), g: 200, drag: 0.975, color: pick(['#ffffff', '#bfeaff', '#8fd3ff']), size: rnd(6, 12), rot: rnd(0, 3), vr: rnd(-3, 3), life: rnd(0.6, 1.0) });
    for (let i = 0; i < n(10, mul); i++) fx.add({ shape: 'diamond', ...onRim(x, y, 60), vx: rnd(-100, 100), vy: rnd(-180, -80), g: 900, color: '#d9f4ff', size: rnd(6, 10), rot: rnd(0, 6), life: rnd(0.4, 0.7) });
  },
  bubbles(fx, x, y, { mul }) {
    shock(fx, x, y, '#ff7fb0', 140, 6);
    for (let i = 0; i < n(20, mul); i++) fx.add({ shape: 'bubble', ...onRim(x, y, 110), vx: rnd(-30, 30), vy: rnd(-90, -30), g: -10, color: pick(['#ff7fb0', '#ff4f8b', '#ffb3d1']), size: rnd(6, 15), life: rnd(0.6, 1.0), delay: rnd(0, 0.12) });
  },
  pixel(fx, x, y, { mul }) {
    const cols = ['#ffe600', '#ff4f9a', '#3b2fd1', '#00e5ff', '#7dff4f'];
    for (let i = 0; i < n(36, mul); i++) fx.add({ shape: 'pixel', x, y, ...ground(rnd(0, TAU), rnd(140, 460), rnd(40, 160)), g: 900, color: pick(cols), size: pick([6, 6, 12]), life: rnd(0.45, 0.8) });
    shock(fx, x, y, '#ffe600', 120, 6);
  },
  thunder(fx, x, y, { mul }) {
    // 闪电从天上劈到落点（终点就是罐底接触点）
    const bolt = (tx, delay, lw) => {
      const pts = [[tx + rnd(-30, 30), -20]];
      const steps = 9;
      for (let i = 1; i <= steps; i++) pts.push([tx + (x - tx) * (i / steps) + rnd(-34, 34) * (1 - i / steps * 0.6), y * (i / steps)]);
      pts[pts.length - 1] = [x, y];
      fx.add({ shape: 'bolt', pts, color: '#ffe14a', lw, life: 0.36, delay });
    };
    bolt(x + rnd(-90, 90), 0, 7);
    if (mul > 0.9) { bolt(x + rnd(-140, 140), 0.07, 4); }
    if (mul > 1.5) { bolt(x + rnd(-200, 200), 0.13, 3); }
    shock(fx, x, y, '#ffe14a', 180, 10, 0.04);
    for (let i = 0; i < n(20, mul); i++) fx.add({ shape: 'spark', x, y, ...ground(rnd(0, TAU), rnd(220, 520), rnd(20, 90)), drag: 0.94, g: 400, color: pick(['#ffe14a', '#fff7b0', '#ffffff']), size: rnd(3, 6), life: rnd(0.3, 0.6), delay: 0.04 });
  },
};

export const BURST_KINDS = Object.keys(BURSTS);
