// 皮肤系统：角色外观 / 方块材质的定义、解锁规则、本地存储、预览渲染
import * as THREE from 'three';
import { Storage } from './Storage.js?v=20261110j';
import { CONFIG } from './config.js?v=20261110j';
import { pick } from './utils.js?v=20261110j';
import { CAN_SKINS } from './canSkins.js?v=20261110j';
import { buildCan, tickCan } from './CanModel.js?v=20261110j';
import { lookupCode, hashCode } from './codes.js?v=20261110j';

/* ================= 角色皮肤：易拉罐（数据在 canSkins.js） ================= */
export const PLAYER_SKINS = CAN_SKINS.map((s) => ({ ...s, build: () => buildCan(s) }));

/* ================= 方块材质风格 ================= */
const CANDY_COLORS = ['#ff9aa2', '#ffb347', '#ffe680', '#7fdc8f', '#84b6f4', '#c3a6ff', '#ffc4dd', '#8fe3df', '#f7a072'];
const NEON_COLORS = ['#00f0ff', '#ff3df2', '#7dff4f', '#ffe600', '#ff6b3d', '#8c7bff'];

function lighten(hex, amt) {
  const c = new THREE.Color(hex); const hsl = {}; c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, hsl.l + amt));
  return c;
}

export const BLOCK_STYLES = [
  {
    id: 'candy', unlockScore: 0,
    name: { zh: '糖果哑光', en: 'Candy Matte', ar: 'حلوى مطفية' },
    desc: { zh: '柔和马卡龙配色，顶面更亮', en: 'Soft macaron colors with brighter tops', ar: 'ألوان ماكرون ناعمة وأسطح أفتح' }, theme: 'theme-candy',
    shadowOpacity: 0.16,
    /** 返回 { materials, extras } materials 用于 mesh（侧面/顶面），extras 为附加物体 */
    makeMaterials(shape) {
      const color = pick(CANDY_COLORS);
      const side = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
      const top = new THREE.MeshStandardMaterial({ color: lighten(color, 0.08), roughness: 0.6 });
      return { materials: shapeMaterials(shape, side, top), accent: color };
    },
    decorate() { return null; },
  },
  {
    id: 'neon', unlockScore: 25,
    name: { zh: '霓虹夜色', en: 'Neon Night', ar: 'ليل النيون' },
    desc: { zh: '暗色方块 + 发光描边', en: 'Dark blocks with glowing edges', ar: 'مكعبات داكنة بحواف مضيئة' }, theme: 'theme-neon',
    shadowOpacity: 0.35,
    makeMaterials(shape) {
      const color = pick(NEON_COLORS);
      const side = new THREE.MeshStandardMaterial({ color: '#1e1b3d', roughness: 0.4, metalness: 0.3 });
      const top = new THREE.MeshStandardMaterial({ color: '#2b2760', roughness: 0.35, metalness: 0.2, emissive: color, emissiveIntensity: 0.12 });
      return { materials: shapeMaterials(shape, side, top), accent: color };
    },
    /** 发光描边线 */
    decorate(mesh, accent) {
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry, 30),
        new THREE.LineBasicMaterial({ color: accent }));
      return edges;
    },
  },
];

/** BoxGeometry 材质组顺序：+x,-x,+y,-y,+z,-z（+y 为顶面）；CylinderGeometry：侧面, 顶面, 底面 */
function shapeMaterials(shape, side, top) {
  return shape === 'box' ? [side, side, top, side, side, side] : [side, top, side];
}

/* ================= 管理器 ================= */
export class SkinManager {
  constructor() {
    this.state = Storage.getSkinState();
    // 旧存档里的皮肤 id 已不存在时，回到默认
    if (!PLAYER_SKINS.some((k) => k.id === this.state.player)) this.state.player = PLAYER_SKINS[0].id;
    if (!BLOCK_STYLES.some((k) => k.id === this.state.block)) this.state.block = BLOCK_STYLES[0].id;
    this.listeners = [];
  }
  get playerSkin() { return PLAYER_SKINS.find((s) => s.id === this.state.player) || PLAYER_SKINS[0]; }
  get blockStyle() { return BLOCK_STYLES.find((s) => s.id === this.state.block) || BLOCK_STYLES[0]; }

  /** 测试用：去掉所有兑换罐，换回可乐罐，并清掉已用兑换码（只影响本机；服务器上的排行榜身份不变） */
  _resetLocal() {
    this.state.unlocked = this.state.unlocked.filter((k) => !PLAYER_SKINS.some((s) => s.unlock === 'code' && k === 'player:' + s.id));
    this.state.player = 'cola';
    Storage.saveSkinState(this.state);
    Storage.clearUsedCodes();
    this.listeners.forEach((fn) => fn('player', 'cola'));
    return { status: 'reset', skins: [] };
  }

  /** 有任何一款兑换码罐子 = VIP（Official Owner） */
  get isVip() { return PLAYER_SKINS.some((k) => k.unlock === 'code' && this.isUnlocked('player', k.id)); }

  isUnlocked(kind, id) { return this.state.unlocked.includes(kind + ':' + id); }

  select(kind, id) {
    if (!this.isUnlocked(kind, id)) return false;
    this.state[kind] = id;
    Storage.saveSkinState(this.state);
    this.listeners.forEach((fn) => fn(kind, id));
    return true;
  }
  onChange(fn) { this.listeners.push(fn); }

  /** 免费皮肤直接解锁；方块风格按最高分解锁。返回本次新解锁的列表 */
  checkUnlocks(best) {
    const fresh = [];
    const add = (kind, sk) => {
      const key = kind + ':' + sk.id;
      if (!this.state.unlocked.includes(key)) { this.state.unlocked.push(key); fresh.push(sk); }
    };
    PLAYER_SKINS.forEach((sk) => { if (sk.unlock === 'free') add('player', sk); });
    BLOCK_STYLES.forEach((sk) => { if (best >= sk.unlockScore) add('block', sk); });
    if (fresh.length) Storage.saveSkinState(this.state);
    return fresh;
  }

  /**
   * 输入兑换码：默认从还没拥有的“兑换款”里随机抽一款解锁
   * @returns {{ status: 'ok'|'have'|'bad'|'empty'|'used'|'none', skins: object[] }}
   */
  redeem(code) {
    if (!String(code || '').trim()) return { status: 'empty', skins: [] };
    const target = lookupCode(code);
    if (!target) return { status: 'bad', skins: [] };
    if (target === '!reset') return this._resetLocal();
    const h = hashCode(code);
    if (Storage.getUsedCodes().includes(h)) return { status: 'used', skins: [] };
    const locked = PLAYER_SKINS.filter((k) => k.unlock === 'code' && !this.isUnlocked('player', k.id));
    let fresh;
    if (target === 'random') {
      if (!locked.length) return { status: 'none', skins: [] }; // 全部集齐时不消耗兑换码
      fresh = [locked[Math.floor(Math.random() * locked.length)]];
    } else if (target === '*') {
      if (!locked.length) return { status: 'none', skins: [] };
      fresh = locked;
    } else {
      const sk = PLAYER_SKINS.find((k) => k.id === target);
      if (!sk) return { status: 'bad', skins: [] };
      if (this.isUnlocked('player', sk.id)) return { status: 'have', skins: [sk] };
      fresh = [sk];
    }
    fresh.forEach((k) => this.state.unlocked.push('player:' + k.id));
    Storage.saveSkinState(this.state);
    Storage.addUsedCode(h);
    return { status: 'ok', skins: fresh };
  }
}

/* ================= 预览（皮肤弹窗里的小 3D 窗口） ================= */
export class SkinPreview {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#8a86a8', 1.6));
    const sun = new THREE.DirectionalLight('#ffffff', 1.6); sun.position.set(-3, 6, 4);
    this.scene.add(sun);
    this.holder = new THREE.Group();
    this.scene.add(this.holder);
    this.running = false;
    this._loop = this._loop.bind(this);
  }

  show(kind, id) {
    while (this.holder.children.length) this.holder.remove(this.holder.children[0]);
    let size = 1.4;
    if (kind === 'player') {
      const skin = PLAYER_SKINS.find((s) => s.id === id);
      const m = skin.build();
      m.position.y = -0.55;
      this.holder.add(m);
      size = 0.95;
    } else {
      const style = BLOCK_STYLES.find((s) => s.id === id);
      [['box', -0.75, 0.55], ['cylinder', 0.95, -0.65]].forEach(([shape, x, z]) => {
        const geo = shape === 'box' ? new THREE.BoxGeometry(1.3, CONFIG.BLOCK_HEIGHT, 1.3) : new THREE.CylinderGeometry(0.65, 0.65, CONFIG.BLOCK_HEIGHT, 40);
        const { materials, accent } = style.makeMaterials(shape);
        const mesh = new THREE.Mesh(geo, materials);
        mesh.position.set(x, -0.4, z);
        const d = style.decorate(mesh, accent); if (d) mesh.add(d);
        this.holder.add(mesh);
      });
      size = 1.8;
    }
    this.size = size;
    this.resize();
    if (!this.running) { this.running = true; this.last = performance.now(); requestAnimationFrame(this._loop); }
  }

  resize() {
    const w = this.canvas.clientWidth || 200, h = this.canvas.clientHeight || 160;
    this.renderer.setSize(w, h, false);
    const a = w / h, s = this.size || 1.4;
    Object.assign(this.camera, { left: -s * a, right: s * a, top: s, bottom: -s });
    this.camera.position.set(-6, 6, 7); this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  stop() { this.running = false; }

  _loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    this.holder.rotation.y += dt * 0.9;
    this.time = (this.time || 0) + dt;
    this.holder.children.forEach((m) => tickCan(m, this.time, dt, {}));
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._loop);
  }
}
