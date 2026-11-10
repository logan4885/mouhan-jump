// 易拉罐 3D 模型：罐身贴图（Canvas 生成或图片）+ 金属顶盖 / 拉环 / 底座
// 脚底在 y=0，总高约 1.1，和原来的角色尺寸一致
import * as THREE from 'three';
import { EFFECTS } from './canEffects.js?v=20261110q';

const R = 0.3;          // 罐身半径
const BODY_H = 0.82;    // 罐身（贴图部分）高度
const BOTTOM_H = 0.07;  // 底部收窄
const NECK_H = 0.1;     // 顶部收窄
const TOP_R = 0.25;     // 顶盖半径

const labelCache = new Map();

/** 用 Canvas 画罐身贴图：底色、波浪条、气泡、两组文字（一圈里出现两次，转到哪面都看得到） */
function drawLabel(skin) {
  const W = 1024, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');

  // 底色 + 竖向光泽
  g.fillStyle = skin.body; g.fillRect(0, 0, W, H);
  const shine = g.createLinearGradient(0, 0, W, 0);
  for (let i = 0; i <= 8; i++) shine.addColorStop(i / 8, i % 2 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)');
  g.fillStyle = shine; g.fillRect(0, 0, W, H);

  // 波浪条（横向一整圈，首尾相接）
  g.fillStyle = skin.accent;
  g.beginPath();
  g.moveTo(0, H * 0.70);
  for (let x = 0; x <= W; x += 8) g.lineTo(x, H * 0.70 + Math.sin((x / W) * Math.PI * 4) * 26);
  for (let x = W; x >= 0; x -= 8) g.lineTo(x, H * 0.80 + Math.sin((x / W) * Math.PI * 4 + 0.8) * 22);
  g.closePath(); g.fill();

  // 气泡
  if (skin.bubbles) {
    g.fillStyle = 'rgba(255,255,255,0.35)';
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 70; i++) {
      g.beginPath();
      g.arc(rnd() * W, rnd() * H * 0.62, 3 + rnd() * 9, 0, Math.PI * 2);
      g.fill();
    }
  }

  // 顶部和底部细金属边
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillRect(0, 0, W, 10); g.fillRect(0, H - 10, W, 10);

  // 文字：在 u≈0.39 和 u≈0.89 各写一次（0.89 正对默认镜头）；宽度控制在罐子正面可见范围内
  const font = '"Arial Black", "Helvetica Neue", Arial, sans-serif';
  [0.39, 0.89, -0.11].forEach((u) => { // -0.11：0.89 处文字跨过接缝的部分
    const cx = u * W;
    g.save();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = 130;
    g.font = `900 italic ${size}px ${font}`;
    while (g.measureText(skin.text).width > W * 0.27 && size > 50) { size -= 6; g.font = `900 italic ${size}px ${font}`; }
    g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.strokeText(skin.text, cx, H * 0.40);
    g.fillStyle = skin.textColor;
    g.fillText(skin.text, cx, H * 0.40);
    g.font = `800 30px ${font}`;
    g.fillStyle = skin.textColor;
    g.globalAlpha = 0.9;
    g.fillText(skin.sub || '', cx, H * 0.60);
    g.restore();
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function getLabel(skin) {
  if (labelCache.has(skin.id)) return labelCache.get(skin.id);
  let tex;
  if (skin.labelUrl) {
    tex = new THREE.TextureLoader().load(skin.labelUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
  } else {
    tex = drawLabel(skin);
  }
  labelCache.set(skin.id, tex);
  return tex;
}

const fxTexCache = new Map();

/** 生成一个易拉罐模型（skin.effect 指定特效，见 canEffects.js） */
export function buildCan(skin) {
  const g = new THREE.Group();
  const fx = skin.effect ? EFFECTS[skin.effect] : null;
  const metal = (fx && fx.metal) ? fx.metal(skin) : new THREE.MeshStandardMaterial({ color: skin.lid || '#cfd3dc', roughness: 0.3, metalness: 0.35 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: '#9aa0ad', roughness: 0.35, metalness: 0.4 });
  let labelMat;
  if (fx) {
    if (!fxTexCache.has(skin.id)) fxTexCache.set(skin.id, fx.label(skin));
    labelMat = fx.body(skin, fxTexCache.get(skin.id));
  } else {
    labelMat = new THREE.MeshStandardMaterial({ map: getLabel(skin), roughness: 0.35, metalness: 0.15 });
  }
  // 贴图不跟着罐子销毁（多个模型共用），所以材质单独标记
  labelMat.userData.keepMap = true;

  // 底部收窄
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.82, BOTTOM_H, 40), metal);
  bottom.position.y = BOTTOM_H / 2;
  // 罐身（侧面贴图，上下面不可见）
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, BODY_H, 48, 1, true), labelMat);
  body.position.y = BOTTOM_H + BODY_H / 2;
  // 顶部收窄
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(TOP_R, R, NECK_H, 40), metal);
  neck.position.y = BOTTOM_H + BODY_H + NECK_H / 2;
  // 顶盖 + 边缘
  const topY = BOTTOM_H + BODY_H + NECK_H;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(TOP_R * 0.92, TOP_R * 0.92, 0.02, 40), darkMetal);
  lid.position.y = topY - 0.005;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(TOP_R * 0.95, 0.02, 10, 40), metal);
  rim.rotation.x = Math.PI / 2; rim.position.y = topY + 0.01;
  // 拉环：一个小圆环 + 铆钉，朝向镜头一侧
  const tab = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.018, 8, 20), metal);
  tab.rotation.x = Math.PI / 2; tab.scale.set(1, 1.5, 1);
  tab.position.set(-0.06, topY + 0.02, 0.06);
  tab.rotation.z = Math.PI / 4;
  const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 12), metal);
  rivet.position.set(0, topY + 0.015, 0);
  // 饮用口
  const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 16), new THREE.MeshStandardMaterial({ color: '#4a4f5c', roughness: 0.6 }));
  mouth.scale.set(1.3, 1, 0.8);
  mouth.position.set(0.1, topY + 0.006, -0.1);

  g.add(bottom, body, neck, lid, rim, tab, rivet, mouth);
  g.userData.bodyMat = labelMat;
  g.userData.fx = fx;
  g.userData.trail = skin.trail || (fx && fx.trail) || null;
  if (fx && fx.build) fx.build(g, skin, { R, BODY_H, BOTTOM_H, NECK_H, TOP_R });
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** 每帧调用：播放罐子的特效动画 */
export function tickCan(model, time, dt, state) {
  const fx = model && model.userData.fx;
  if (fx && fx.tick) fx.tick(model, time, dt, state || {});
}
