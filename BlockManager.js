// 方块管理：生成（正方体 / 圆柱体，随机颜色与方向）、落点判定、挤压回弹、回收
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { rand, clamp, Ease, disposeObject } from './utils.js';

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

  /** 方块风格切换后，重建现有方块的材质 */
  restyleAll() {
    this.blocks.forEach((b) => {
      const old = b.mesh;
      const fresh = this._buildMesh(b.shape, b.size);
      b.root.remove(old); disposeObject(old);
      b.root.add(fresh); b.mesh = fresh;
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
