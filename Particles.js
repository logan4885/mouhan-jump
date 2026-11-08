// 轻量粒子：用于易拉罐跳跃时的拖尾（火焰、雪花、星光、电火花……）
import * as THREE from 'three';

const MAX = 120;
const SPHERE = new THREE.SphereGeometry(1, 6, 4);
const CUBE = new THREE.BoxGeometry(1.6, 1.6, 1.6);

/* 形状粒子（爱心、星星、花瓣、音符）用 Sprite + 小贴图 */
const shapeTex = {};
function shapeTexture(kind) {
  if (shapeTex[kind]) return shapeTex[kind];
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.translate(32, 32);
  g.beginPath();
  if (kind === 'heart') {
    g.moveTo(0, 18); g.bezierCurveTo(-30, -6, -16, -28, 0, -12); g.bezierCurveTo(16, -28, 30, -6, 0, 18);
  } else if (kind === 'star') {
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 11 : 27, a = (i / 10) * Math.PI * 2 - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  } else if (kind === 'petal') {
    g.ellipse(0, 0, 14, 26, 0.4, 0, Math.PI * 2);
  } else if (kind === 'note') {
    g.ellipse(-6, 14, 12, 9, -0.4, 0, Math.PI * 2); g.fill(); g.fillRect(3, -24, 5, 38); g.fillRect(3, -24, 18, 6);
  }
  g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  shapeTex[kind] = t;
  return t;
}

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.live = [];
    this.acc = 0;
  }

  _get(cube, shape) {
    if (shape) {
      this.spritePool = this.spritePool || {};
      const list = this.spritePool[shape] || (this.spritePool[shape] = []);
      let sp = list.pop();
      if (!sp) {
        sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: shapeTexture(shape), transparent: true, depthWrite: false }));
        sp.userData.v = new THREE.Vector3(); sp.userData.shape = shape;
      }
      this.scene.add(sp);
      return sp;
    }
    let p = this.pool.pop();
    if (!p) {
      p = new THREE.Mesh(SPHERE, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
      p.userData.v = new THREE.Vector3();
    }
    p.geometry = cube ? CUBE : SPHERE;
    this.scene.add(p);
    return p;
  }

  /** 按 trail 配置，在 pos 附近持续发射粒子（每帧调用，内部按 rate 控制数量） */
  emit(trail, pos, dt) {
    this.acc += trail.rate * dt;
    while (this.acc >= 1 && this.live.length < MAX) {
      this.acc -= 1;
      const p = this._get(trail.cube, trail.shape);
      const s = trail.spread || 0.2;
      p.position.set(pos.x + (Math.random() - 0.5) * s, pos.y + (Math.random() - 0.5) * s, pos.z + (Math.random() - 0.5) * s);
      p.userData.v.set((Math.random() - 0.5) * 0.6, (Math.random() - 0.2) * 0.6, (Math.random() - 0.5) * 0.6);
      p.material.color.set(trail.colors[Math.floor(Math.random() * trail.colors.length)]);
      p.material.opacity = 1;
      p.userData.size = trail.size * (0.7 + Math.random() * 0.6) * (trail.shape ? 2.4 : 1);
      if (trail.shape) p.material.rotation = Math.random() * Math.PI * 2;
      p.userData.spin = trail.shape ? (Math.random() - 0.5) * 4 : 0;
      p.userData.life = p.userData.max = trail.life * (0.7 + Math.random() * 0.6);
      p.userData.g = trail.gravity || 0;
      p.userData.grow = trail.grow || 0;
      p.userData.jitter = trail.jitter || 0;
      p.scale.setScalar(p.userData.size);
      this.live.push(p);
    }
    if (this.acc > 1) this.acc = 1;
  }

  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i], u = p.userData;
      u.life -= dt;
      if (u.life <= 0) { this.scene.remove(p); this.live.splice(i, 1); this._recycle(p); continue; }
      if (u.spin) p.material.rotation += u.spin * dt;
      u.v.y += u.g * dt;
      if (u.jitter) u.v.set(u.v.x + (Math.random() - 0.5) * u.jitter * dt * 10, u.v.y, u.v.z + (Math.random() - 0.5) * u.jitter * dt * 10);
      p.position.addScaledVector(u.v, dt);
      const k = u.life / u.max;
      p.material.opacity = k;
      p.scale.setScalar(u.size * (u.grow < 0 ? k : 0.4 + 0.6 * k));
    }
  }

  _recycle(p) {
    if (p.userData.shape) this.spritePool[p.userData.shape].push(p);
    else this.pool.push(p);
  }

  clear() {
    this.live.forEach((p) => { this.scene.remove(p); this._recycle(p); });
    this.live.length = 0;
  }
}
