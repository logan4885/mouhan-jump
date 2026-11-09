// 方块管理：生成（正方体 / 圆柱体，随机颜色与方向）、落点判定、挤压回弹、回收
import * as THREE from 'three';
import { CONFIG } from './config.js?v=20261109e';
import { rand, clamp, Ease, disposeObject } from './utils.js?v=20261109e';

const DIRS = { x: new THREE.Vector3(1, 0, 0), z: new THREE.Vector3(0, 0, -1) };

export class BlockManager {
  /**
   * @param {THREE.Scene} scene
   * @param {import('./SkinManager.js?v=20261109e').SkinManager} skins
   * @param {import('./utils.js?v=20261109e').Tweens} tweens
   */
  constructor(scene, skins, tweens) {
    this.scene = scene;
    this.skins = skins;
    this.tweens = tweens;
    this.blocks = [];
    this.currentIndex = 0;
    this.trialRoll = null; // Game 注入：() => boolean，决定下一个方块是不是“24K 星号方块”
  }

  get current() { return this.blocks[this.currentIndex]; }
  get next() { return this.blocks[this.currentIndex + 1]; }

  /** 清空并生成开局的两个方块 */
  reset() {
    this.blocks.forEach((b) => this._destroy(b));
    this.blocks = [];
    this.currentIndex = 0;
    this.blocks.push(this._create({ x: 0, z: 0, shape: 'box', size: 2.3, animate: false }));
    this.spawnNext(0, false);
  }

  /** 在当前方块前方随机生成下一个方块（沿 +X 或 -Z） */
  spawnNext(score = 0, animate = true) {
    const cur = this.blocks[this.blocks.length - 1];
    const dirKey = Math.random() < 0.5 ? 'x' : 'z';
    const dir = DIRS[dirKey];
    const shape = Math.random() < 0.55 ? 'box' : 'cylinder';
    const shrink = score * CONFIG.SIZE_SHRINK_PER_SCORE;
    const maxSize = clamp(CONFIG.BLOCK_MAX_SIZE - shrink, 1.25, CONFIG.BLOCK_MAX_SIZE);
    const minSize = clamp(CONFIG.BLOCK_MIN_SIZE - shrink * 0.6, 1.0, CONFIG.BLOCK_MIN_SIZE);
    const size = rand(minSize, maxSize);
    // 保证两个方块之间至少留出一点空隙
    const minGap = Math.max(CONFIG.BLOCK_MIN_GAP, cur.size / 2 + size / 2 + 0.5);
    const gap = rand(minGap, Math.max(minGap + 0.3, CONFIG.BLOCK_MAX_GAP));
    const block = this._create({ x: cur.x + dir.x * gap, z: cur.z + dir.z * gap, shape, size, animate });
    block.dirKey = dirKey;
    if (this.trialRoll && this.trialRoll(score)) this._markTrial(block);
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
    const dx = x - block.x, dz = z - block.z, h = block.size / 2 + margin;
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
