// 方块管理：生成（正方体 / 圆柱体，随机颜色与方向）、落点判定、挤压回弹、回收
import * as THREE from 'three';
import { CONFIG } from './config.js?v=20261111a';
import { rand, clamp, Ease, disposeObject } from './utils.js?v=20261111a';
import { HZT } from './Staircase.js?v=20261111a';

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIRS = { x: new THREE.Vector3(1, 0, 0), z: new THREE.Vector3(0, 0, -1) };

export class BlockManager {
  /**
   * @param {THREE.Scene} scene
   * @param {import('./SkinManager.js').SkinManager} skins
   * @param {import('./utils.js').Tweens} tweens
   */
  constructor(scene, skins, tweens) {
    this.scene = scene;
    this.skins = skins;
    this.tweens = tweens;
    this.blocks = [];
    this.currentIndex = 0;
    this.seed = null;      // 同图比赛：非空时用固定种子生成地图（所有人拿到一模一样的方块）
    this.rng = null;
    this.sizeBoostLeft = 0;  // Roguelike：接下来 N 个方块变宽（绝对防御）
    this.diamondLeft = 0;    // Roguelike：接下来 N 个方块是 2 倍积分的钻石方块
    this.nearNext = false;   // Roguelike：下一个方块用最近距离（安全气囊）
    this.stairFn = null;     // Roguelike：Game 注入 (层数) => 关卡参数（阶梯难度）；为空 = 普通难度
    this.stairFloor = 2;     // 正在生成的方块对应的层数
    this.trialRoll = null; // Game 注入：() => boolean，决定下一个方块是不是“24K 星号方块”
  }

  get current() { return this.blocks[this.currentIndex]; }
  get next() { return this.blocks[this.currentIndex + 1]; }

  /** 清空并生成开局的两个方块 */
  reset() {
    this.sizeBoostLeft = 0; this.diamondLeft = 0; this.nearNext = false;
    this.stairFloor = 2;
    this.rng = this.seed == null ? null : mulberry32(this.seed);
    this.blocks.forEach((b) => this._destroy(b));
    this.blocks = [];
    this.currentIndex = 0;
    this.blocks.push(this._create({ x: 0, z: 0, shape: 'box', size: 2.3, animate: false }));
    this.spawnNext(0, false);
  }

  /** 在当前方块前方随机生成下一个方块（沿 +X 或 -Z） */
  spawnNext(score = 0, animate = true) {
    const cur = this.blocks[this.blocks.length - 1];
    const R = this.rng ? () => this.rng() : Math.random;
    const rnd = (a, b) => a + R() * (b - a);
    if (this.rng) score = this.blocks.length - 1;      // 固定地图：按第几个方块缩小，保证大家的地图完全一致
    const dirKey = R() < 0.5 ? 'x' : 'z';
    const dir = DIRS[dirKey];
    const shape = R() < 0.55 ? 'box' : 'cylinder';
    const stair = this.stairFn && !this.rng ? this.stairFn(this.stairFloor) : null;   // Roguelike 阶梯难度
    const shrink = stair ? 0 : score * CONFIG.SIZE_SHRINK_PER_SCORE;
    const maxSize = stair ? stair.sizeMax : clamp(CONFIG.BLOCK_MAX_SIZE - shrink, 1.25, CONFIG.BLOCK_MAX_SIZE);
    const minSize = stair ? stair.sizeMin : clamp(CONFIG.BLOCK_MIN_SIZE - shrink * 0.6, 1.0, CONFIG.BLOCK_MIN_SIZE);
    let size = rnd(minSize, maxSize);
    // 机制方块：已解锁的池子里按概率抽一种（终极混沌方块同时带 2 种）
    let haz = null, chaos = false;
    if (stair && stair.pool.length && !this.nearNext && this.diamondLeft <= 0 && R() < stair.chance) {
      const pick = stair.pool[Math.floor(R() * stair.pool.length)];
      if (pick === 'chaos') {
        const others = stair.pool.filter((k) => k !== 'chaos');
        const a = others[Math.floor(R() * others.length)];
        const rest = others.filter((k) => k !== a);
        haz = [a, rest[Math.floor(R() * rest.length)]]; chaos = true;
      } else haz = [pick];
    }
    if (this.sizeBoostLeft > 0) { size = Math.min(size * 1.3, 3.4); this.sizeBoostLeft--; }
    // 保证两个方块之间至少留出一点空隙
    const minGap = Math.max(stair ? stair.gapMin : CONFIG.BLOCK_MIN_GAP, cur.size / 2 + size / 2 + 0.5);
    let gap = stair ? Math.min(rnd(minGap, Math.max(minGap + 0.3, stair.gapMax)), CONFIG.JUMP_MAX_DIST - 0.8)
                    : rnd(minGap, Math.max(minGap + 0.3, CONFIG.BLOCK_MAX_GAP));
    if (haz && haz.includes('blackhole')) gap = Math.max(cur.size / 2 + size / 2 + 0.5, Math.min(gap, (CONFIG.JUMP_MAX_DIST - 0.7) * HZT.blackhole));   // 黑洞会把跳跃吸短，间距不能超出最大跳距
    if (this.nearNext) { gap = minGap; this.nearNext = false; }
    const block = this._create({ x: cur.x + dir.x * gap, z: cur.z + dir.z * gap, shape, size, animate });
    block.dirKey = dirKey;
    if (this.trialRoll && this.trialRoll(score)) this._markTrial(block);
    if (this.diamondLeft > 0) { this.diamondLeft--; this.markDiamond(block); }
    if (haz) { block.windSign = R() < 0.5 ? -1 : 1; block.mPh = R() * 6.28; this.markHazard(block, haz, chaos); }
    this.blocks.push(block);
    return block;
  }

  /** 玩家成功跳到下一个方块后调用 */
  advance(score) {
    this.currentIndex++;
    this.spawnNext(score, true);
    this._recycle();
  }

  /** 点 (x,z) 是否在方块顶面范围内；margin>0 时放宽（用于边缘判定） */
  contains(block, x, z, margin = 0) {
    if (!block) return false;
    const dx = x - block.x, dz = z - block.z, h = block.size * (block.sc || 1) / 2 + margin;
    if (block.shape === 'box') return Math.abs(dx) <= h && Math.abs(dz) <= h;
    return dx * dx + dz * dz <= h * h;
  }

  distanceToCenter(block, x, z) { return Math.hypot(x - block.x, z - block.z); }

  /** 蓄力挤压（k: 0~1） */
  squash(block, k) { block.root.scale.y = 1 - CONFIG.BLOCK_SQUASH * k; }

  /** 松手回弹 */
  release(block) {
    const from = block.root.scale.y;
    this.tweens.add({ duration: 0.6, ease: Ease.outElastic, update: (e) => { block.root.scale.y = from + (1 - from) * e; } });
  }

  topY(block) { return CONFIG.BLOCK_HEIGHT * (block ? block.root.scale.y : 1); }

  /** 完美落点：方块顶面扩散一圈光环 */
  ripple(block) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.42, 48),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(block.x, CONFIG.BLOCK_HEIGHT + 0.02, block.z);
    this.scene.add(ring);
    this.tweens.add({
      duration: 0.7, ease: Ease.outCubic,
      update: (e) => { const s = 1 + e * 3.2; ring.scale.set(s, s, s); ring.material.opacity = 0.9 * (1 - e); },
      done: () => { this.scene.remove(ring); disposeObject(ring); },
    });
  }

  /** 把方块变成“24K 金色星号方块”：金属金色 + 顶面一颗发光的星 */
  _markTrial(block) {
    block.trial = true;
    this._goldify(block);
  }

  /** Roguelike：钻石方块（落上去 2 倍积分）——青色发光 + 顶面一颗 ◆ */
  markDiamond(block) {
    if (!block || block.diamond || block.trial) return;
    block.diamond = true;
    this._glow(block, '#5fe7ff', '#0a6a8a', '◆', '#e8fdff');
  }

  /** Roguelike：量子方块（位置偏移，命中 3 倍积分）——紫色发光 + 顶面一颗 ✦ */
  markQuantum(block) {
    if (!block || block.quantum || block.trial) return;
    block.quantum = true;
    this._glow(block, '#b08cff', '#4a2a9a', '✦', '#f3ebff');
  }

  /** 机制方块：kinds 是它带的机制（1 种，终极混沌是 2 种）；外观按第一种上色，混沌方块统一是 👑 */
  markHazard(block, kinds, chaos = false) {
    if (!block || block.trial) return;
    block.hzs = kinds; block.chaos = chaos; block.mOff = block.mOff || 0; block.sc = block.sc || 1; block.mPh = block.mPh || 0; block.windSign = block.windSign || 1;
    const S = { repulsion: ['#ff8a5c', '#7a2a00', '💥'], icy: ['#8fe6ff', '#106a8a', '🧊'], sinking: ['#c9a86b', '#5a3d10', '⏳'],
      moving: ['#ffb347', '#8a4a00', '⇄'], scaling: ['#7ad0ff', '#0a4a7a', '🔍'], teleport: ['#b08cff', '#3a1a8a', '🌀'],
      explosive: ['#ff5a5a', '#7a0a0a', '💣'], windy: ['#8fe388', '#1d6a2a', '💨'], mirrored: ['#ff7ad9', '#7a1a66', '🪞'],
      shocking: ['#ffe45c', '#7a6a00', '⚡'], blackhole: ['#5a4a8a', '#12082a', '🕳️'], stealth: ['#b8c4d8', '#3a4458', '👻'],
      fragile: ['#e6d3b0', '#6a5a3a', '🧱'], reset: ['#7af0c8', '#0a6a4a', '🔄'], lava: ['#ff7a2a', '#8a2a00', '🔥'],
      bullseye: ['#ff6f6f', '#8a1a1a', '🎯'], timedilate: ['#9ad0ff', '#2a4a8a', '⏱️'], doublecoin: ['#ffd23d', '#8a5a00', '💰'] };
    const st = chaos ? ['#ffc83d', '#6a2a8a', '👑'] : (S[kinds[0]] || S.moving);
    this._glow(block, st[0], st[1], st[2], '#ffffff');
  }

  /** 瞄准阶段的动态机制：移动 / 缩放 / 隐形闪烁（起跳瞬间由 Game 定格） */
  updateHazards(dt, active) {
    const n = this.next;
    if (!active || !n || !n.hzs || n.frozen) return;
    n.t = (n.t || 0) + dt;
    if (n.hzs.includes('moving')) {
      n.mPh += dt;
      const off = Math.sin(n.mPh * HZT.moveSpeed) * HZT.moveAmp, d = off - (n.mOff || 0);
      n.mOff = off;
      if (n.dirKey === 'x') n.z += d; else n.x += d;
      n.root.position.x = n.x; n.root.position.z = n.z;
    }
    if (n.hzs.includes('scaling')) { n.sc = 1 + 0.3 * Math.sin(n.t * 2.2); n.root.scale.x = n.sc; n.root.scale.z = n.sc; }
    if (n.hzs.includes('stealth')) n.root.visible = (n.t % 1.0) < 0.6;
  }

  /** 起跳瞬间：把动态机制方块定格（并让隐形方块现身） */
  freezeHazard(block) {
    if (!block || !block.hzs) return;
    block.frozen = true; block.root.visible = true;
  }

  /** 空间传送：开始蓄力时瞬移到旁边（每个方块只传一次） */
  teleport(block) {
    if (!block || !block.hzs || !block.hzs.includes('teleport') || block.tped) return false;
    const c = this.current, gap = Math.hypot(block.x - c.x, block.z - c.z) || 1;
    const s = (Math.random() < 0.5 ? -1 : 1) * Math.min(2.4, gap * 0.35);
    if (block.dirKey === 'x') block.z += s; else block.x += s;
    block.root.position.x = block.x; block.root.position.z = block.z; block.tped = true;
    return true;
  }

  /** 把下一个方块沿“与跳跃方向垂直”的方向偏移 frac × 间距（量子纠缠）；方向随机 */
  offsetNext(frac) {
    const n = this.next, c = this.current;
    if (!n || !c) return;
    const gap = Math.hypot(n.x - c.x, n.z - c.z);
    const s = (Math.random() < 0.5 ? -1 : 1) * frac * gap;
    if (n.dirKey === 'x') n.z += s; else n.x += s;
    n.root.position.x = n.x; n.root.position.z = n.z;
    this.markQuantum(n);
  }

  /** 踩过之后去掉钻石 / 量子外观 */
  clearMark(block) {
    if (!block || (!block.diamond && !block.quantum && !block.hzs)) return;
    block.diamond = false; block.quantum = false; block.hzs = null; block.chaos = false;
    block.sc = 1; block.root.scale.x = 1; block.root.scale.z = 1; block.root.visible = true;
    if (block.star) { block.root.remove(block.star); disposeObject(block.star); block.star = null; }
    const old = block.mesh;
    const fresh = this._buildMesh(block.shape, block.size);
    block.root.remove(old); disposeObject(old);
    block.root.add(fresh); block.mesh = fresh;
  }

  _glow(block, color, emissive, sym, symColor) {
    block.mesh.material = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.2, emissive, emissiveIntensity: 0.6 });
    if (block.star) { block.root.remove(block.star); disposeObject(block.star); }
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    g.font = '96px "Segoe UI Symbol","Apple Symbols",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = symColor; g.shadowBlur = 16; g.fillStyle = symColor; g.fillText(sym, 64, 68);
    const star = new THREE.Mesh(new THREE.PlaneGeometry(block.size * 0.7, block.size * 0.7), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    star.rotation.x = -Math.PI / 2;
    star.position.y = CONFIG.BLOCK_HEIGHT + 0.03;
    block.root.add(star);
    block.star = star;
  }

  _goldify(block) {
    const gold = new THREE.MeshStandardMaterial({ color: '#ffc83d', metalness: 0.85, roughness: 0.22, emissive: '#8a5a00', emissiveIntensity: 0.55 });
    block.mesh.material = gold;
    if (block.star) { block.root.remove(block.star); disposeObject(block.star); }
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    g.font = '104px "Segoe UI Symbol","Apple Symbols",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#fff4b0'; g.shadowBlur = 18; g.fillStyle = '#fffbe0'; g.fillText('★', 64, 68);
    const tex = new THREE.CanvasTexture(cv);
    const sz = block.size * 0.8;
    const star = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    star.rotation.x = -Math.PI / 2;
    star.position.y = CONFIG.BLOCK_HEIGHT + 0.03;
    block.root.add(star);
    block.star = star;
  }

  /** 被踩过之后恢复成普通方块外观 */
  clearTrial(block) {
    if (!block || !block.trial) return;
    block.trial = false;
    if (block.star) { block.root.remove(block.star); disposeObject(block.star); block.star = null; }
    const old = block.mesh;
    const fresh = this._buildMesh(block.shape, block.size);
    block.root.remove(old); disposeObject(old);
    block.root.add(fresh); block.mesh = fresh;
  }

  /** 方块风格切换后，重建现有方块的材质 */
  restyleAll() {
    this.blocks.forEach((b) => {
      const old = b.mesh;
      const fresh = this._buildMesh(b.shape, b.size);
      b.root.remove(old); disposeObject(old);
      b.root.add(fresh); b.mesh = fresh;
      if (b.trial) this._goldify(b);
      else if (b.diamond) { b.diamond = false; this.markDiamond(b); }
      else if (b.quantum) { b.quantum = false; this.markQuantum(b); }
      else if (b.hzs) { const k = b.hzs, c = b.chaos; b.hzs = null; this.markHazard(b, k, c); }
    });
  }

  /* ---------------- 内部 ---------------- */
  _buildMesh(shape, size) {
    const H = CONFIG.BLOCK_HEIGHT;
    const geo = shape === 'box' ? new THREE.BoxGeometry(size, H, size) : new THREE.CylinderGeometry(size / 2, size / 2, H, 48);
    geo.translate(0, H / 2, 0); // 原点放到底面，方便从底部挤压
    const style = this.skins.blockStyle;
    const { materials, accent } = style.makeMaterials(shape);
    const mesh = new THREE.Mesh(geo, materials);
    mesh.castShadow = true; mesh.receiveShadow = true;
    const deco = style.decorate(mesh, accent);
    if (deco) mesh.add(deco);
    return mesh;
  }

  _create({ x, z, shape, size, animate }) {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    const mesh = this._buildMesh(shape, size);
    root.add(mesh);
    this.scene.add(root);
    const block = { root, mesh, x, z, shape, size };
    if (animate) {
      root.position.y = 2.6;
      this.tweens.add({ duration: 0.45, ease: Ease.outCubic, update: (e) => { root.position.y = 2.6 * (1 - e); } });
    }
    return block;
  }

  _recycle() {
    while (this.blocks.length > CONFIG.BLOCK_KEEP && this.currentIndex > 1) {
      this._destroy(this.blocks.shift());
      this.currentIndex--;
    }
  }

  _destroy(b) { this.scene.remove(b.root); disposeObject(b.root); }
}
