// 角色：外观、蓄力压缩、抛物线跳跃 + 空翻、落地缓冲、摔落动画
import * as THREE from 'three';
import { CONFIG } from './config.js?v=20261111b';
import { Ease, disposeObject } from './utils.js?v=20261111b';
import { PLAYER_SKINS } from './SkinManager.js?v=20261111b';
import { tickCan } from './CanModel.js?v=20261111b';
import { Particles } from './Particles.js?v=20261111b';

const UP = new THREE.Vector3(0, 1, 0);
const GRAVITY = 26;
const PIVOT_Y = 0.5; // 空翻 / 倾倒的旋转中心高度

export class Player {
  constructor(scene, skins) {
    this.scene = scene;
    this.skins = skins;
    // 层级：root(位置) -> squash(脚底缩放) -> flip(中心旋转) -> model
    this.root = new THREE.Group();
    this.squashG = new THREE.Group();
    this.flipG = new THREE.Group();
    this.flipG.position.y = PIVOT_Y;
    this.root.add(this.squashG);
    this.squashG.add(this.flipG);
    scene.add(this.root);

    // 脚下的圆形阴影贴片（比实时阴影更清晰，跳起时变小变淡）
    this.blob = new THREE.Mesh(new THREE.CircleGeometry(0.32, 32),
      new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.18, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2;
    scene.add(this.blob);

    this.particles = new Particles(scene); // 跳跃拖尾
    this._emitPos = new THREE.Vector3();
    this.time = 0;
    this.state = 'idle';
    this.setSkin(skins.playerSkin.id);
  }

  setSkin(id) {
    if (this.model) { this.flipG.remove(this.model); disposeObject(this.model); }
    const skin = PLAYER_SKINS.find((k) => k.id === id) || PLAYER_SKINS[0];
    this.model = skin.build();
    this.model.position.y = -PIVOT_Y;
    this.flipG.add(this.model);
    this.flame = this.model.getObjectByName('flame') || null;
    this.trail = this.model.userData.trail || null;
  }

  /** 放到某个位置（脚底坐标） */
  place(x, y, z) {
    this.root.position.set(x, y, z);
    this.flipG.quaternion.identity();
    this.squashG.scale.set(1, 1, 1);
    this.state = 'idle';
    this.groundY = y;
    if (this.flame) this.flame.visible = false;
    this._syncBlob();
  }

  /** 蓄力：k 从 0 到 1，角色被压扁 */
  charge(k, topY) {
    const s = 1 - CONFIG.PLAYER_SQUASH * k;
    this.squashG.scale.set(1 + 0.18 * k, s, 1 + 0.18 * k);
    this.root.position.y = topY; // 跟随被压缩的方块顶面
    this.groundY = topY;
    this._syncBlob();
  }

  /**
   * 起跳
   * @param {THREE.Vector3} target 落点（脚底，y 为方块顶面）
   * @param {object} opts { onLand(), after: 'stand'|'fall'|'tip', tipDir }
   */
  jump(target, opts) {
    this.start = this.root.position.clone();
    this.target = target.clone();
    const dist = Math.hypot(target.x - this.start.x, target.z - this.start.z);
    this.dir = new THREE.Vector3(target.x - this.start.x, 0, target.z - this.start.z).normalize();
    if (!isFinite(this.dir.x)) this.dir.set(1, 0, 0);
    this.axis = new THREE.Vector3().crossVectors(UP, this.dir).normalize();
    this.duration = (CONFIG.JUMP_BASE_TIME + dist * CONFIG.JUMP_TIME_PER_UNIT) * ((opts && opts.durMul) || 1) + ((opts && opts.durAdd) || 0);
    this.height = CONFIG.JUMP_BASE_HEIGHT + dist * CONFIG.JUMP_HEIGHT_PER_UNIT;
    this.t = 0;
    this.opts = opts;
    this.state = 'jump';
    this.squashStart = this.squashG.scale.clone();
    if (this.flame) this.flame.visible = true;
  }

  /** 摔落：直接掉到地面 */
  fall() {
    this.state = 'fall';
    this.vy = 0;
    this.spin = (Math.random() - 0.5) * 2;
  }

  /** 在方块边缘倾倒：绕边缘向外翻倒并落地 */
  tip(outDir) {
    this.state = 'tip';
    this.tipAxis = new THREE.Vector3().crossVectors(UP, outDir).normalize();
    this.tipAngle = 0;
    this.vy = 0;
    this.outDir = outDir.clone();
  }

  update(dt) {
    this.time += dt;
    const jumping = this.state === 'jump';
    tickCan(this.model, this.time, dt, { jumping });
    if (this.trail && jumping) {
      const p = this.root.position;
      this.particles.emit(this.trail, this._emitPos.set(p.x, p.y + 0.45, p.z), dt);
    }
    this.particles.update(dt);
    if (this.state === 'jump') this._updateJump(dt);
    else if (this.state === 'fall') this._updateFall(dt);
    else if (this.state === 'tip') this._updateTip(dt);
    else if (this.state === 'land') this._updateLand(dt);
    this._syncBlob();
  }

  /* ---------------- 内部动画 ---------------- */
  _updateJump(dt) {
    this.t = Math.min(1, this.t + dt / this.duration);
    const p = this.t;
    const pos = this.root.position;
    pos.x = this.start.x + (this.target.x - this.start.x) * p;
    pos.z = this.start.z + (this.target.z - this.start.z) * p;
    pos.y = this.start.y + (this.target.y - this.start.y) * p + 4 * this.height * p * (1 - p);
    // 空翻一周
    this.flipG.quaternion.setFromAxisAngle(this.axis, Math.PI * 2 * Ease.outQuad(Math.min(1, p * 1.15)));
    // 起跳瞬间迅速恢复体型，带一点拉伸
    const r = Math.min(1, p * 5);
    const sy = this.squashStart.y + (1.08 - this.squashStart.y) * r;
    const sxz = this.squashStart.x + (0.95 - this.squashStart.x) * r;
    this.squashG.scale.set(sxz, sy, sxz);
    if (p >= 1) {
      this.flipG.quaternion.identity();
      if (this.flame) this.flame.visible = false;
      const after = this.opts.after;
      this.groundY = this.target.y;
      if (after === 'stand') { this.state = 'land'; this.landT = 0; this.opts.onLand && this.opts.onLand(); }
      else if (after === 'tip') { this.tip(this.opts.tipDir); }
      else { this.fall(); }
    }
  }

  _updateLand(dt) {
    // 落地缓冲：轻微压扁后回弹
    this.landT += dt / 0.22;
    const t = Math.min(1, this.landT);
    const s = 1 - 0.18 * Math.sin(t * Math.PI);
    this.squashG.scale.set(1 + (1 - s) * 0.6, s, 1 + (1 - s) * 0.6);
    if (t >= 1) { this.squashG.scale.set(1, 1, 1); this.state = 'idle'; }
  }

  _updateFall(dt) {
    this.vy -= GRAVITY * dt;
    this.root.position.y += this.vy * dt;
    this.flipG.rotateOnWorldAxis(this.axis || new THREE.Vector3(1, 0, 0), this.spin * dt * 0.6);
    if (this.root.position.y <= 0) {
      this.root.position.y = 0;
      this.state = 'down';
      this._finishFall();
    }
  }

  _updateTip(dt) {
    // 先绕边缘翻倒到 90°，同时向外滑出并下落
    this.tipAngle = Math.min(Math.PI / 2, this.tipAngle + dt * 5);
    this.flipG.quaternion.setFromAxisAngle(this.tipAxis, this.tipAngle);
    this.root.position.addScaledVector(this.outDir, dt * 1.1);
    if (this.tipAngle > 0.6) {
      this.vy -= GRAVITY * dt;
      this.root.position.y += this.vy * dt;
    }
    // 倒地后身体中心离地约 0.3
    if (this.root.position.y <= -PIVOT_Y + 0.3) {
      this.root.position.y = -PIVOT_Y + 0.3;
      this.flipG.quaternion.setFromAxisAngle(this.tipAxis, Math.PI / 2);
      this.state = 'down';
      this._finishFall();
    }
  }

  _finishFall() {
    if (this.flame) this.flame.visible = false;
    this.opts && this.opts.onFallen && this.opts.onFallen();
  }

  /** 站立时脚下的小圆影；空中交给实时阴影 */
  _syncBlob() {
    const pos = this.root.position;
    const standing = this.state === 'idle' || this.state === 'land';
    this.blob.visible = standing;
    if (standing) this.blob.position.set(pos.x, pos.y + 0.012, pos.z);
  }
}
