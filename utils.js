// 通用小工具
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const Ease = {
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inQuad: (t) => t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  // 弹簧回弹（方块松手后弹回）
  outElastic: (t) => {
    if (t === 0 || t === 1) return t;
    const c = (2 * Math.PI) / 3.2;
    return Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * c) + 1;
  },
};

/** 极简补间：每帧在 update(dt) 里推进，结束后自动移除 */
export class Tweens {
  constructor() { this.list = []; }
  add({ duration, update, ease = (t) => t, done }) {
    const tw = { t: 0, duration, update, ease, done };
    this.list.push(tw);
    return tw;
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const tw = this.list[i];
      tw.t = Math.min(1, tw.t + dt / tw.duration);
      tw.update(tw.ease(tw.t), tw.t);
      if (tw.t >= 1) { this.list.splice(i, 1); tw.done && tw.done(); }
    }
  }
  clear() { this.list.length = 0; }
}

/** 递归释放几何体与材质，避免长时间游玩内存上涨 */
export function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => { if (m.map && !(m.userData && m.userData.keepMap)) m.map.dispose(); m.dispose(); });
    }
  });
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
