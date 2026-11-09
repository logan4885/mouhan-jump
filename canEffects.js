// 易拉罐特效：每种效果 = 罐身贴图 + 材质 + 可选动画（tick）+ 可选跳跃拖尾粒子（trail）
// 在 canSkins.js 里给某款罐子写 effect: 'gold' 等即可使用
import * as THREE from 'three';

const W = 1024, H = 512;
const FONT = '"Arial Black", "Helvetica Neue", Arial, sans-serif';

/* ---------------- 小工具 ---------------- */
function canvas(w = W, h = H) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function toTex(c, { srgb = true, nearest = false, repeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  else t.anisotropy = 4;
  if (repeat) { t.wrapS = THREE.RepeatWrapping; }
  return t;
}
function rng(seed) { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

/** 在 u≈0.39 / 0.89 两处写字（0.89 正对默认镜头） */
function writeText(g, text, sub, fill, { stroke = 'rgba(0,0,0,0.3)', glow = null, w = W, h = H, size0 = 130 } = {}) {
  [0.39, 0.89, 0.89 - 1].forEach((u) => { // 0.89-1：跨过贴图接缝的那一半再画一次
    const cx = u * w;
    g.save();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = size0 * (w / W);
    g.font = `900 italic ${size}px ${FONT}`;
    while (g.measureText(text).width > w * 0.27 && size > 20) { size -= 4; g.font = `900 italic ${size}px ${FONT}`; }
    if (glow) { g.shadowColor = glow; g.shadowBlur = 30 * (w / W); }
    if (stroke) { g.lineWidth = 10 * (w / W); g.strokeStyle = stroke; g.strokeText(text, cx, h * 0.4); }
    g.fillStyle = fill; g.fillText(text, cx, h * 0.4);
    if (sub) { g.font = `800 ${30 * (w / W)}px ${FONT}`; g.fillText(sub, cx, h * 0.6); }
    g.restore();
  });
}

/* ---------------- 环境反射（金属罐用） ---------------- */
let envCache = null;
/** 用 6 张小画布拼一个“摄影棚”环境贴图：上亮下暗，中间一条白色灯带 */
export function getEnv() {
  if (envCache) return envCache;
  const face = (kind) => {
    const [c, g] = canvas(128, 128);
    if (kind === 'top') { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128); }
    else if (kind === 'bottom') { g.fillStyle = '#3a3550'; g.fillRect(0, 0, 128, 128); }
    else {
      const gr = g.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, '#f4f8ff'); gr.addColorStop(0.45, '#9fb4d8'); gr.addColorStop(0.55, '#5d5a78'); gr.addColorStop(1, '#2a2640');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      g.fillStyle = 'rgba(255,255,255,0.95)'; g.fillRect(0, 30, 128, 14);
      if (kind === 'a') { g.fillStyle = '#fff3d6'; g.fillRect(40, 10, 30, 80); }
    }
    return c;
  };
  const tex = new THREE.CubeTexture([face('a'), face('b'), face('top'), face('bottom'), face('b'), face('a')]);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  envCache = tex;
  return tex;
}

/* ================= 10 种效果 ================= */
export const EFFECTS = {
  /* 1. 黄金：金属反光 */
  gold: {
    label(skin) {
      const [c, g] = canvas();
      const gr = g.createLinearGradient(0, 0, W, 0);
      for (let i = 0; i <= 12; i++) gr.addColorStop(i / 12, i % 2 ? '#ffe08a' : '#c9921f');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(120,70,0,0.35)'; for (let y = 60; y < H; y += 120) g.fillRect(0, y, W, 4);
      writeText(g, skin.text, skin.sub, '#5a3a00', { stroke: 'rgba(255,240,190,0.8)' });
      return { map: toTex(c) };
    },
    body: (skin, t) => new THREE.MeshStandardMaterial({ map: t.map, metalness: 1, roughness: 0.22, envMap: getEnv(), envMapIntensity: 1.2 }),
    metal: () => new THREE.MeshStandardMaterial({ color: '#f2c14e', metalness: 1, roughness: 0.25, envMap: getEnv() }),
    trail: { colors: ['#ffe27a', '#fff6c8'], rate: 30, size: 0.05, life: 0.6, gravity: -1, spread: 0.25 },
  },

  /* 2. 镜面铬：几乎全反射 */
  chrome: {
    label(skin) {
      const [c, g] = canvas();
      g.fillStyle = '#e9edf3'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#1b1d24'; g.fillRect(0, H * 0.7, W, 40);
      writeText(g, skin.text, skin.sub, '#1b1d24', { stroke: 'rgba(255,255,255,0.7)' });
      return { map: toTex(c) };
    },
    body: (skin, t) => new THREE.MeshStandardMaterial({ map: t.map, metalness: 1, roughness: 0.06, envMap: getEnv(), envMapIntensity: 1.4 }),
    metal: () => new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.08, envMap: getEnv() }),
  },

  /* 3. 镭射幻彩：彩虹贴图缓慢流动 + 虹彩 */
  holo: {
    label(skin) {
      const [c, g] = canvas();
      for (let x = 0; x < W; x += 2) {
        g.fillStyle = `hsl(${(x / W) * 720}, 90%, 72%)`;
        g.fillRect(x, 0, 2, H);
      }
      const sheen = g.createLinearGradient(0, 0, 0, H);
      sheen.addColorStop(0, 'rgba(255,255,255,0.45)'); sheen.addColorStop(0.5, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(255,255,255,0.35)');
      g.fillStyle = sheen; g.fillRect(0, 0, W, H);
      writeText(g, skin.text, skin.sub, '#ffffff', { stroke: 'rgba(60,20,90,0.55)' });
      return { map: toTex(c, { repeat: true }) };
    },
    body: (skin, t) => new THREE.MeshPhysicalMaterial({ map: t.map, metalness: 0.6, roughness: 0.18, envMap: getEnv(), iridescence: 1, iridescenceIOR: 1.4 }),
    tick(model, time, dt) { const m = model.userData.bodyMat; if (m && m.map) m.map.offset.x = (time * 0.06) % 1; },
    trail: { colors: ['#ff7ad9', '#7af0ff', '#fff27a', '#9dff7a'], rate: 40, size: 0.05, life: 0.7, gravity: 0, spread: 0.3 },
  },

  /* 4. 霓虹：暗色罐身，线条和字发光并呼吸闪烁 */
  neon: {
    label(skin) {
      const [c, g] = canvas();
      g.fillStyle = '#0d0b1a'; g.fillRect(0, 0, W, H);
      const [ec, eg] = canvas();
      eg.fillStyle = '#000'; eg.fillRect(0, 0, W, H);
      [[g, 1], [eg, 1]].forEach(([ctx]) => {
        ctx.lineWidth = 10; ctx.strokeStyle = skin.accent; ctx.shadowColor = skin.accent; ctx.shadowBlur = 24;
        ctx.beginPath(); for (let x = 0; x <= W; x += 8) ctx.lineTo(x, H * 0.74 + Math.sin(x / W * Math.PI * 6) * 18); ctx.stroke();
        ctx.strokeStyle = skin.textColor; ctx.shadowColor = skin.textColor;
        ctx.beginPath(); ctx.moveTo(0, 40); ctx.lineTo(W, 40); ctx.moveTo(0, H - 40); ctx.lineTo(W, H - 40); ctx.stroke();
        ctx.shadowBlur = 0;
        writeText(ctx, skin.text, skin.sub, skin.textColor, { stroke: null, glow: skin.textColor });
      });
      return { map: toTex(c), emissiveMap: toTex(ec) };
    },
    body: (skin, t) => new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emissiveMap, emissive: '#ffffff', emissiveIntensity: 1, roughness: 0.4 }),
    metal: () => new THREE.MeshStandardMaterial({ color: '#2a2740', metalness: 0.6, roughness: 0.3 }),
    tick(model, time) { const m = model.userData.bodyMat; m.emissiveIntensity = 0.75 + 0.45 * Math.sin(time * 4) * Math.sin(time * 1.3); },
    trail: { colors: ['#ff3df2', '#00f0ff'], rate: 36, size: 0.045, life: 0.5, gravity: 0, spread: 0.2 },
  },

  /* 5. 星空：深空星云，星星闪烁并缓慢旋转 */
  galaxy: {
    label(skin) {
      const [c, g] = canvas();
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0b0626'); bg.addColorStop(1, '#1d0b3a'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      const r = rng(11);
      [['#7b3cff', 0.5], ['#ff4fb0', 0.35], ['#2fb8ff', 0.35]].forEach(([col, a]) => {
        for (let i = 0; i < 4; i++) {
          const x = r() * W, y = r() * H, rad = 80 + r() * 160;
          const rg = g.createRadialGradient(x, y, 0, x, y, rad);
          rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)');
          g.globalAlpha = a; g.fillStyle = rg; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        }
      });
      g.globalAlpha = 1;
      const [ec, eg] = canvas(); eg.fillStyle = '#000'; eg.fillRect(0, 0, W, H);
      for (let i = 0; i < 260; i++) {
        const x = r() * W, y = r() * H, s = r() < 0.08 ? 3.5 : 1.4;
        [g, eg].forEach((ctx) => { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill(); });
      }
      writeText(g, skin.text, skin.sub, '#ffffff', { stroke: 'rgba(80,40,160,0.6)', glow: '#b58cff' });
      return { map: toTex(c, { repeat: true }), emissiveMap: toTex(ec, { repeat: true }) };
    },
    body: (skin, t) => new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emissiveMap, emissive: '#ffffff', emissiveIntensity: 0.8, roughness: 0.3, metalness: 0.2 }),
    metal: () => new THREE.MeshStandardMaterial({ color: '#4b3a7a', metalness: 0.7, roughness: 0.3, envMap: getEnv() }),
    tick(model, time) {
      const m = model.userData.bodyMat;
      m.map.offset.x = m.emissiveMap.offset.x = (time * 0.015) % 1;
      m.emissiveIntensity = 0.6 + 0.4 * Math.abs(Math.sin(time * 2.2));
    },
    trail: { colors: ['#ffffff', '#c9b6ff'], rate: 26, size: 0.035, life: 0.9, gravity: 0, spread: 0.35 },
  },

  /* 6. 烈焰：火焰罐身轻微闪烁，跳跃时喷火 */
  blaze: {
    label(skin) {
      const [c, g] = canvas();
      const bg = g.createLinearGradient(0, H, 0, 0);
      bg.addColorStop(0, '#ffd23f'); bg.addColorStop(0.35, '#ff6a1a'); bg.addColorStop(0.75, '#b3120f'); bg.addColorStop(1, '#3a0505');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      const r = rng(5);
      g.fillStyle = 'rgba(255,230,120,0.55)';
      for (let i = 0; i < 26; i++) {
        const x = r() * W, w = 30 + r() * 50, h = 120 + r() * 200;
        g.beginPath(); g.moveTo(x - w, H); g.quadraticCurveTo(x - w * 0.2, H - h * 0.5, x, H - h); g.quadraticCurveTo(x + w * 0.2, H - h * 0.5, x + w, H); g.fill();
      }
      writeText(g, skin.text, skin.sub, '#fff3c4', { stroke: 'rgba(80,0,0,0.6)', glow: '#ff9a1a' });
      return { map: toTex(c) };
    },
    body: (skin, t) => new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.map, emissive: '#ff5a1a', emissiveIntensity: 0.25, roughness: 0.45 }),
    metal: () => new THREE.MeshStandardMaterial({ color: '#3b2a26', metalness: 0.7, roughness: 0.35, envMap: getEnv() }),
    tick(model, time) { model.userData.bodyMat.emissiveIntensity = 0.25 + 0.15 * Math.random() + 0.1 * Math.sin(time * 9); },
    trail: { colors: ['#ffd23f', '#ff7a1a', '#ff3b1a'], rate: 70, size: 0.09, life: 0.45, gravity: 1.5, spread: 0.18, grow: -1 },
  },

  /* 7. 冰霜：半透明冰蓝，跳跃时飘雪 */
  frost: {
    label(skin) {
      const [c, g] = canvas();
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#e8fbff'); bg.addColorStop(1, '#7cc7ef'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      const r = rng(23);
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 3;
      for (let i = 0; i < 40; i++) {
        const x = r() * W, y = r() * H, s = 8 + r() * 18;
        for (let k = 0; k < 3; k++) {
          const a = (k * Math.PI) / 3;
          g.beginPath(); g.moveTo(x - Math.cos(a) * s, y - Math.sin(a) * s); g.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); g.stroke();
        }
      }
      writeText(g, skin.text, skin.sub, '#1d5f8f', { stroke: 'rgba(255,255,255,0.9)' });
      return { map: toTex(c) };
    },
    body: (skin, t) => new THREE.MeshPhysicalMaterial({ map: t.map, transparent: true, opacity: 0.88, roughness: 0.12, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1, envMap: getEnv() }),
    metal: () => new THREE.MeshStandardMaterial({ color: '#d9f4ff', metalness: 0.8, roughness: 0.15, envMap: getEnv() }),
    trail: { colors: ['#ffffff', '#cfefff'], rate: 30, size: 0.045, life: 1.0, gravity: -0.6, spread: 0.4 },
  },

  /* 8. 透明汽水：能看到里面的饮料和上升的气泡 */
  crystal: {
    label(skin) {
      const [c, g] = canvas();
      g.clearRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 0, W, H);
      g.fillStyle = skin.accent; g.fillRect(0, H * 0.3, W, H * 0.22);
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(0, 0, W, 8); g.fillRect(0, H - 8, W, 8);
      writeText(g, skin.text, skin.sub, '#ffffff', { stroke: 'rgba(0,0,0,0.25)' });
      return { map: toTex(c) };
    },
    body: (skin, t) => new THREE.MeshPhysicalMaterial({ map: t.map, transparent: true, roughness: 0.05, metalness: 0, clearcoat: 1, envMap: getEnv(), depthWrite: false, side: THREE.DoubleSide }),
    build(g, skin, d) {
      const liquid = new THREE.Mesh(new THREE.CylinderGeometry(d.R * 0.9, d.R * 0.9, d.BODY_H * 0.72, 32),
        new THREE.MeshStandardMaterial({ color: skin.body, transparent: true, opacity: 0.82, roughness: 0.2 }));
      liquid.position.y = d.BOTTOM_H + d.BODY_H * 0.36;
      g.add(liquid);
      const bubbles = [];
      const bmat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 });
      const bgeo = new THREE.SphereGeometry(0.018, 8, 6);
      for (let i = 0; i < 14; i++) {
        const b = new THREE.Mesh(bgeo, bmat);
        const a = Math.random() * Math.PI * 2, rr = Math.random() * d.R * 0.75;
        b.position.set(Math.cos(a) * rr, d.BOTTOM_H + Math.random() * d.BODY_H * 0.7, Math.sin(a) * rr);
        b.userData.speed = 0.15 + Math.random() * 0.25;
        bubbles.push(b); g.add(b);
      }
      g.userData.bubbles = bubbles; g.userData.liquid = liquid; g.userData.dims = d;
    },
    tick(model, time, dt, st) {
      const d = model.userData.dims, top = d.BOTTOM_H + d.BODY_H * 0.72, k = st && st.jumping ? 3 : 1;
      model.userData.bubbles.forEach((b) => {
        b.position.y += b.userData.speed * dt * k;
        if (b.position.y > top) b.position.y = d.BOTTOM_H + 0.02;
      });
      model.userData.liquid.scale.y = 1 + (st && st.jumping ? 0.04 * Math.sin(time * 30) : 0);
    },
    trail: { colors: ['#ffffff', '#ffd6ea'], rate: 24, size: 0.04, life: 0.7, gravity: -0.8, spread: 0.2 },
  },

  /* 9. 像素：8-bit 风格，贴图不做平滑 */
  pixel: {
    label(skin) {
      const w = 128, h = 64;
      const [c, g] = canvas(w, h);
      g.fillStyle = skin.body; g.fillRect(0, 0, w, h);
      const cols = ['#ffffff', skin.accent, '#000000'];
      for (let x = 0; x < w; x += 4) {
        const y = 44 + Math.round(Math.sin(x / w * Math.PI * 4) * 3) * 2;
        g.fillStyle = skin.accent; g.fillRect(x, y, 4, 6);
      }
      const r = rng(3);
      for (let i = 0; i < 40; i++) { g.fillStyle = cols[i % 2]; g.fillRect(Math.floor(r() * 32) * 4, Math.floor(r() * 8) * 4, 2, 2); }
      [0.39, 0.89, -0.11].forEach((u) => {
        g.font = '900 15px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = '#000'; g.fillText(skin.text, u * w + 1, 27);
        g.fillStyle = skin.textColor; g.fillText(skin.text, u * w, 26);
      });
      return { map: toTex(c, { nearest: true }) };
    },
    body: (skin, t) => new THREE.MeshStandardMaterial({ map: t.map, roughness: 0.7 }),
    trail: { colors: ['#ffffff', '#ffe600', '#00e5ff'], rate: 20, size: 0.06, life: 0.5, gravity: 0, spread: 0.2, cube: true },
  },

  /* 10. 闪电：黑黄罐身，闪电纹随机闪亮，跳跃时冒电火花 */
  thunder: {
    label(skin) {
      const [c, g] = canvas();
      g.fillStyle = '#16151c'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#ffd400';
      for (let x = -H; x < W + H; x += 90) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + 40, H); g.lineTo(x + 40 + 60, H - 60); g.lineTo(x + 60, H - 60); g.fill(); }
      const [ec, eg] = canvas(); eg.fillStyle = '#000'; eg.fillRect(0, 0, W, H);
      const bolt = (ctx, x) => {
        ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x - 50, 220); ctx.lineTo(x - 5, 220); ctx.lineTo(x - 60, 420); ctx.lineTo(x + 60, 180); ctx.lineTo(x + 10, 180); ctx.lineTo(x + 50, 30); ctx.closePath(); ctx.fill();
      };
      [[g, '#fff27a'], [eg, '#fff27a']].forEach(([ctx, col]) => { ctx.fillStyle = col; [0.14, 0.64].forEach((u) => bolt(ctx, u * W)); });
      writeText(g, skin.text, skin.sub, '#ffd400', { stroke: 'rgba(0,0,0,0.8)' });
      return { map: toTex(c), emissiveMap: toTex(ec) };
    },
    body: (skin, t) => new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emissiveMap, emissive: '#ffffff', emissiveIntensity: 0.3, roughness: 0.4, metalness: 0.2 }),
    metal: () => new THREE.MeshStandardMaterial({ color: '#2b2a33', metalness: 0.8, roughness: 0.3, envMap: getEnv() }),
    tick(model, time, dt) {
      const u = model.userData;
      u.flash = Math.max(0, (u.flash || 0) - dt * 4);
      if (Math.random() < dt * 0.9) u.flash = 1;
      u.bodyMat.emissiveIntensity = 0.25 + 1.6 * u.flash;
    },
    trail: { colors: ['#fff27a', '#7af6ff', '#ffffff'], rate: 50, size: 0.03, life: 0.3, gravity: 0, spread: 0.35, jitter: 3 },
  },
  /* 11. 法老罐（时停罐）：黄绿配色的埃及风格——荷鲁斯之眼、安卡、三角边饰、金字塔冠和翼饰 */
  pharaoh: {
    label(skin) {
      const [c, g] = canvas(); const [ec, eg] = canvas();
      eg.fillStyle = '#000'; eg.fillRect(0, 0, W, H);
      const YE = '#f5e60a', DK = '#1f3d00';
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#93d11e'); gr.addColorStop(1, '#5c900f');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(0,0,0,0.07)'; for (let x = 0; x < W; x += 32) g.fillRect(x, 0, 16, H);
      // 三角边饰（上下各一条，首尾相接）
      const band = (ctx, y, h, flip, col, tri) => {
        ctx.fillStyle = col; ctx.fillRect(0, y, W, h);
        ctx.fillStyle = tri;
        for (let x = 0; x < W; x += h) {
          ctx.beginPath();
          if (!flip) { ctx.moveTo(x, y); ctx.lineTo(x + h / 2, y + h); ctx.lineTo(x + h, y); }
          else { ctx.moveTo(x, y + h); ctx.lineTo(x + h / 2, y); ctx.lineTo(x + h, y + h); }
          ctx.fill();
        }
      };
      band(g, 0, 40, false, YE, DK); band(g, H - 40, 40, true, YE, DK);
      g.fillStyle = DK; g.fillRect(0, 44, W, 5); g.fillRect(0, H - 49, W, 5);
      // 尼罗河“水纹”折线带
      g.lineWidth = 9; g.lineJoin = 'round'; g.strokeStyle = DK;
      [0.76, 0.84].forEach((k, j) => {
        g.beginPath();
        for (let x = 0; x <= W; x += 32) { const y = H * k + ((x / 32) % 2 ? -14 : 14); x ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
        g.strokeStyle = YE; g.lineWidth = 4; g.stroke(); g.strokeStyle = DK; g.lineWidth = 9;
      });
      const outline = (ctx, fn, col, w) => { ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = DK; ctx.lineWidth = w + 10; fn(ctx); ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = w; fn(ctx); ctx.stroke(); ctx.restore(); };
      // 荷鲁斯之眼
      const eye = (ctx, x, y, s, glow) => {
        const body = (k) => { k.beginPath(); k.moveTo(x - 62 * s, y); k.quadraticCurveTo(x, y - 48 * s, x + 62 * s, y); k.quadraticCurveTo(x, y + 30 * s, x - 62 * s, y); };
        if (!glow) { body(ctx); ctx.fillStyle = YE; ctx.fill(); }
        outline(ctx, body, glow ? '#fff27a' : DK, glow ? 6 : 5);
        ctx.beginPath(); ctx.arc(x, y - 4 * s, 15 * s, 0, 7); ctx.fillStyle = glow ? '#fff27a' : DK; ctx.fill();
        outline(ctx, (k) => { k.beginPath(); k.moveTo(x - 68 * s, y - 26 * s); k.quadraticCurveTo(x, y - 62 * s, x + 70 * s, y - 28 * s); }, glow ? '#fff27a' : YE, 7);
        outline(ctx, (k) => { k.beginPath(); k.moveTo(x - 12 * s, y + 16 * s); k.lineTo(x - 12 * s, y + 46 * s); k.quadraticCurveTo(x - 12 * s, y + 62 * s, x + 12 * s, y + 58 * s); }, glow ? '#fff27a' : YE, 7);
        outline(ctx, (k) => { k.beginPath(); k.moveTo(x + 46 * s, y + 12 * s); k.quadraticCurveTo(x + 76 * s, y + 24 * s, x + 66 * s, y + 52 * s); }, glow ? '#fff27a' : YE, 7);
      };
      // 安卡（生命符号）
      const ankh = (ctx, x, y, s, glow) => {
        const col = glow ? '#fff27a' : YE;
        outline(ctx, (k) => { k.beginPath(); k.ellipse(x, y - 44 * s, 22 * s, 30 * s, 0, 0, 7); }, col, 11 * s);
        outline(ctx, (k) => { k.beginPath(); k.moveTo(x, y - 14 * s); k.lineTo(x, y + 78 * s); k.moveTo(x - 40 * s, y + 6 * s); k.lineTo(x + 40 * s, y + 6 * s); }, col, 11 * s);
      };
      [0.39, 0.89, 0.89 - 1].forEach((u) => { eye(g, u * W, H * 0.2, 0.9, false); eye(eg, u * W, H * 0.2, 0.9, true); });
      [0.14, 0.64].forEach((u) => { ankh(g, u * W, H * 0.38, 1.05, false); ankh(eg, u * W, H * 0.38, 1.05, true); });
      writeText(g, skin.text, skin.sub, YE, { stroke: DK });
      return { map: toTex(c), emissiveMap: toTex(ec) };
    },
    body: (skin, t) => new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emissiveMap, emissive: '#ffffff', emissiveIntensity: 0.25, metalness: 0.55, roughness: 0.34, envMap: getEnv(), envMapIntensity: 0.9 }),
    metal: () => new THREE.MeshStandardMaterial({ color: '#e9cf1f', metalness: 1, roughness: 0.28, envMap: getEnv() }),
    build(g, skin, d) {
      const gold = new THREE.MeshStandardMaterial({ color: '#f5e60a', metalness: 1, roughness: 0.26, envMap: getEnv() });
      const gem = new THREE.MeshStandardMaterial({ color: '#7cb518', emissive: '#7cb518', emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.3 });
      const topY = d.BOTTOM_H + d.BODY_H + d.NECK_H;
      // 金字塔冠
      const pyr = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.2, 4), gold);
      pyr.position.set(0, topY + 0.1, 0); pyr.rotation.y = Math.PI / 4;
      const eyeGem = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), gem);
      eyeGem.position.set(0, topY + 0.07, 0.085);
      // 左右翼饰（太阳圆盘的翅膀）
      [-1, 1].forEach((s) => {
        for (let i = 0; i < 3; i++) {
          const w = new THREE.Mesh(new THREE.BoxGeometry(0.2 - i * 0.03, 0.022, 0.07), gold);
          w.position.set(s * (0.34 + i * 0.015), d.BOTTOM_H + d.BODY_H * 0.9 - i * 0.07, 0);
          w.rotation.z = s * (0.35 - i * 0.12);
          g.add(w);
        }
      });
      // 底部金环
      const collar = new THREE.Mesh(new THREE.TorusGeometry(d.R * 0.9, 0.022, 8, 40), gold);
      collar.rotation.x = Math.PI / 2; collar.position.y = d.BOTTOM_H + 0.01;
      g.add(pyr, eyeGem, collar);
    },
    tick(model, time) { model.userData.bodyMat.emissiveIntensity = 0.22 + 0.12 * Math.sin(time * 2.4); },
    trail: { colors: ['#ffd23a', '#fff1a0', '#f5e60a', '#c9921f'], rate: 46, size: 0.05, life: 0.7, gravity: -0.4, spread: 0.28 },
  },
};
