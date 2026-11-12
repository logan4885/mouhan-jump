// Roguelike 专用：20 种敌人（空中 / 红圈砸落 / 地面滚动 / 追踪）+ 自动反击（冲击波、连击炮、炮塔、护盾反弹、赏金）
// 只在 Roguelike 里生效（game.rogue 非空）；普通模式、同图比赛完全不会创建任何敌人。
// 敌人全部是冲着“站在地上的你”来的：出现时先在你脚下亮预警（红圈 / 红带 / 屏幕边缘 ⚠️），你站着不动就会被打中，起跳离开或跳到空中就躲掉。
// 5 类行为（每一类下面有若干种敌人，外观 / 速度 / 范围不同）：
//   cross  贴地横着飞向你站的位置   红带 + 屏幕边缘 ⚠️ 预警
//   float  慢慢飘向你站的位置       红带预警
//   drop   先亮红圈，随后砸下        圈里的人会中
//   roll   沿红带从侧面滚过方块      在空中就躲掉
//   home   追着你飞                  站着、空中都会撞，要靠反击打掉
//   被打中：先扣「硬化罐壳」，再扣护盾，都没有就掉下去（和踩空一样，可以被复苏 / 复活挡住）
// 难度分档：前 5 层纯教学；第 6 层起出现最温和的 3 种；之后每 10 层一档，每档多解锁几种敌人，刷怪更快、同屏更多、预警更短。
// 主动玩法：险险躲过敌人 = 擦弹（得分 + 能量）；能量满了点「⚡爆发」清场 + 无敌；每 10 层来一波敌潮，撑过去有奖励。
import * as THREE from 'three';
import { CONFIG } from './config.js?v=20261114a';
import { L } from './i18n.js?v=20261114a';
import { rt } from './Roguelike.js?v=20261117r';
import { playSfx } from './SkinAudio.js?v=20261114a';

const tri = (zh, en, ar) => ({ zh, en, ar });

/** 20 种敌人。from = 从第几层开始可能出现，w = 出现权重；其余是这一类行为的参数。想调难度改这里。 */
export const KINDS = {
  // ---- cross：横着飞过 ----
  bird:      { t: 'cross', icon: '🐦', from: 6,  w: 5, r: 0.62, speed: [4.6, 6.4], alt: [0.15, 0.7], warn: 1.0,
    name: tri('鸟', 'Bird', 'طائر'), desc: tri('横着飞过，贴地冲你来，起跳躲开', 'Flies across — skims the ground at you, jump to dodge', 'يعبر أفقياً نحوك على مستوى الأرض، اقفز لتتفاداه') },
  bat:       { t: 'cross', icon: '🦇', from: 10,  w: 4, r: 0.5,  speed: [5.5, 7.5], alt: [0.15, 0.7], warn: 0.9, wobY: 0.25, wobF: 9,
    name: tri('蝙蝠', 'Bat', 'خفاش'), desc: tri('忽高忽低地快速飞过，贴地冲你来，起跳躲开', 'Darts across, bobbing up and down — skims the ground at you, jump to dodge', 'يعبر بسرعة صعوداً وهبوطاً — نحوك على مستوى الأرض، اقفز لتتفاداه') },
  bee:       { t: 'cross', icon: '🐝', from: 20,  w: 3, r: 0.42, speed: [4.0, 5.5], alt: [0.15, 0.7], warn: 0.9, zig: 1.0, zigF: 6,
    name: tri('蜜蜂', 'Bee', 'نحلة'), desc: tri('蛇形来回飞过，贴地冲你来，起跳躲开', 'Zig-zags across — skims the ground at you, jump to dodge', 'يعبر بشكل متعرج — نحوك على مستوى الأرض، اقفز لتتفاداه') },
  eagle:     { t: 'cross', icon: '🦅', from: 30, w: 3, r: 0.85, speed: [8, 10], alt: [0.2, 0.8], warn: 0.8, size: 2.3,
    name: tri('老鹰', 'Eagle', 'نسر'), desc: tri('又快又大，掠过高空，贴地冲你来，起跳躲开', 'Big and fast — skims the ground at you, jump to dodge', 'كبير وسريع — نحوك على مستوى الأرض، اقفز لتتفاداه') },
  plane:     { t: 'cross', icon: '✈️', from: 60, w: 2, r: 0.8,  speed: [11, 13], alt: [0.2, 0.8], warn: 0.7, size: 2.2,
    name: tri('飞机', 'Plane', 'طائرة'), desc: tri('极快地横扫而过，贴地冲你来，起跳躲开', 'Sweeps past at top speed — skims the ground at you, jump to dodge', 'يمرّ بسرعة قصوى — نحوك على مستوى الأرض، اقفز لتتفاداه') },
  ufo:       { t: 'cross', icon: '🛸', from: 40, w: 3, r: 0.75, speed: [3.6, 4.8], alt: [0.3, 0.9], warn: 1.1, wobY: 0.2, wobF: 3, size: 2.0,
    name: tri('飞碟', 'UFO', 'طبق طائر'), desc: tri('慢悠悠地上下飘着飞过，贴地冲你来，起跳躲开', 'Bobs slowly across — skims the ground at you, jump to dodge', 'يعبر ببطء صعوداً وهبوطاً — نحوك على مستوى الأرض، اقفز لتتفاداه') },
  // ---- float：飘进跳跃线 ----
  balloon:   { t: 'float', icon: '🎈', from: 6,  w: 4, r: 0.7, rise: 0.15, drift: 0.9, life: 8, warn: 0.7,
    name: tri('气球', 'Balloon', 'بالون'), desc: tri('慢慢飘向你站的位置，起跳躲开', 'Drifts into your path — skims the ground at you, jump to dodge', 'يطفو إلى مسارك — نحوك على مستوى الأرض، اقفز لتتفاداه') },
  ghost:     { t: 'float', icon: '👻', from: 10,  w: 3, r: 0.6, rise: 0.1, drift: 0.8, life: 8, warn: 0.7, sway: 1.1, swayF: 2.2,
    name: tri('幽灵', 'Ghost', 'شبح'), desc: tri('左右摇摆地飘，贴地冲你来，起跳躲开', 'Weaves side to side — skims the ground at you, jump to dodge', 'يتمايل يمنة ويسرة — نحوك على مستوى الأرض، اقفز لتتفاداه') },
  cloud:     { t: 'float', icon: '⛈️', from: 30, w: 2, r: 1.0, rise: 0.05, drift: 0.6, life: 10, warn: 0.9, size: 2.6,
    name: tri('雷云', 'Storm cloud', 'سحابة رعدية'), desc: tri('又大又慢，久久不散，贴地冲你来，起跳躲开', 'Huge and slow, lingers — skims the ground at you, jump to dodge', 'ضخمة وبطيئة وتبقى طويلاً — نحوك على مستوى الأرض، اقفز لتتفاداه') },
  kite:      { t: 'float', icon: '🪁', from: 20,  w: 3, r: 0.55, rise: 0.12, drift: 1.3, life: 7, warn: 0.7, sway: 0.5, swayF: 3,
    name: tri('风筝', 'Kite', 'طائرة ورقية'), desc: tri('顺着风斜着飘过，贴地冲你来，起跳躲开', 'Rides the wind across — skims the ground at you, jump to dodge', 'يعبر مع الريح — نحوك على مستوى الأرض، اقفز لتتفاداه') },
  // ---- drop：红圈后砸落 ----
  dart:      { t: 'drop', icon: '🎯', from: 6,  w: 4, hitR: 0.85, warn: 1.2, fall: 26, h: 9, size: 1.2,
    name: tri('飞镖', 'Dart', 'سهم'), desc: tri('先亮红圈，1.2 秒后砸下；站着不动会中', 'A red ring, then it drops — don\'t stand still', 'دائرة حمراء ثم يسقط — لا تقف ساكناً') },
  rock:      { t: 'drop', icon: '🪨', from: 10,  w: 3, hitR: 0.95, warn: 1.2, fall: 22, h: 9, size: 1.5,
    name: tri('落石', 'Falling rock', 'حجر ساقط'), desc: tri('红圈里的人会被砸', 'Whoever stands in the ring gets crushed', 'من يقف في الدائرة يُسحق') },
  bomb:      { t: 'drop', icon: '💣', from: 30,  w: 3, hitR: 1.5,  warn: 1.7, fall: 14, h: 8, size: 1.5,
    name: tri('炸弹', 'Bomb', 'قنبلة'), desc: tri('落地就爆炸，范围很大', 'Explodes on landing with a big radius', 'ينفجر عند الارتطام بنطاق كبير') },
  lightning: { t: 'drop', icon: '⚡', from: 40, w: 3, hitR: 0.9,  warn: 0.9, fall: 80, h: 12, size: 2.6,
    name: tri('闪电', 'Lightning', 'صاعقة'), desc: tri('红圈亮得很快，马上劈下', 'The ring flashes fast — a strike follows', 'الدائرة تومض بسرعة ثم تضرب الصاعقة') },
  ice:       { t: 'drop', icon: '🧊', from: 50, w: 3, hitR: 0.7,  warn: 0.9, fall: 30, h: 9, size: 1.1,
    name: tri('冰锥', 'Icicle', 'جليد'), desc: tri('小范围的快速砸落', 'A small, fast drop', 'سقوط سريع بنطاق صغير') },
  meteor:    { t: 'drop', icon: '☄️', from: 60, w: 2, hitR: 1.35, warn: 1.6, fall: 34, h: 11, size: 2.1,
    name: tri('流星', 'Meteor', 'نيزك'), desc: tri('超大红圈，砸得更狠', 'A huge ring and a harder hit', 'دائرة ضخمة وضربة أقوى') },
  // ---- roll：地面滚过方块 ----
  bowling:   { t: 'roll', icon: '🎳', from: 20, w: 3, r: 0.5,  speed: 6.5, warn: 1.1, size: 1.2,
    name: tri('保龄球', 'Bowling ball', 'كرة بولينغ'), desc: tri('沿红带从侧面滚过方块；跳到空中就躲开', 'Rolls along the red lane — get airborne to dodge', 'تتدحرج على المسار الأحمر — اقفز لتتفاداها') },
  snowball:  { t: 'roll', icon: '⛄', from: 40, w: 3, r: 0.75, speed: 4.0, warn: 1.3, size: 1.8,
    name: tri('雪球', 'Snowball', 'كرة ثلج'), desc: tri('又大又慢地滚过方块，起跳躲开', 'Big and slow — jump to dodge', 'كبيرة وبطيئة — اقفز لتتفاداها') },
  // ---- home：追踪 ----
  mosquito:  { t: 'home', icon: '🦟', from: 50, w: 3, r: 0.32, speed: 4.3, warn: 0.9, life: 6, turn: 3.5, jitter: 0.04, size: 0.9,
    name: tri('蚊子', 'Mosquito', 'بعوضة'), desc: tri('又小又快地追着你', 'Small, fast and chasing you', 'صغيرة وسريعة وتطاردك') },
  missile:   { t: 'home', icon: '🚀', from: 70, w: 2, r: 0.5,  speed: 3.4, warn: 1.0, life: 7, turn: 2.2, size: 1.3,
    name: tri('追踪导弹', 'Homing missile', 'صاروخ موجّه'), desc: tri('追着你飞，站着、在空中都会撞', 'Chases you — hits you standing or airborne', 'يطاردك — يصيبك واقفاً أو في الهواء') },
};
export const KIND_LIST = Object.keys(KINDS);

/** 调参面板：想更简单 / 更难，只改这里 */
export const ENEMY = {
  startLayer: 6,                                                   // 第 6 层起出现第一批最温和的敌人（鸟 / 气球 / 飞镖），前 5 层纯教学
  tierSize: 10,                                                    // 每多少层一档（要和 Staircase 的 STAIR.tierSize 一致）
  firstDelay: 3,                                                   // 第 1 档开始后第一只出现的时间（秒）
  tier: (layers) => Math.floor(layers / 10),
  interval: (layers) => Math.max(1.4, 3.6 - 0.3 * Math.floor(layers / 10)),   // 两次刷怪的间隔（秒）：6 层起 3.6 秒 → 逐档缩短到 1.4 秒
  maxAlive: (layers) => { const t = Math.floor(layers / 10); return t < 1 ? 1 : t < 3 ? 2 : t < 6 ? 3 : t < 9 ? 4 : 5; },   // 同时最多几只
  warnScale: (layers) => Math.max(0.7, 1 - 0.03 * (Math.floor(layers / 10) - 1)),                  // 预警时间随档位缩短（最短 70%）
  killScore: (layers) => 5 + Math.floor(layers / 10),              // 击落一只得分
  turretEvery: 4,                                                  // 自动炮塔：每几秒一发
  cannonEvery: 3,                                                  // 连击炮：每几个连续完美攒 1 发
  cannonMax: 3,
  wave: [3.5, 5.5],                                                // 落地冲击波半径：普通 / 完美
};

const TOP = CONFIG.BLOCK_HEIGHT;
const MAT = {}, GEO = {};
const geo = (k, f) => GEO[k] || (GEO[k] = f());
const rnd = (a) => a[0] + Math.random() * (a[1] - a[0]);

/** 用 emoji 画一张贴图做成广告牌精灵（20 种敌人共用这一套，不需要任何图片文件） */
function spriteFor(kind, size) {
  const K = KINDS[kind];
  let m = MAT[kind];
  if (!m) {
    let map = null;
    try {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d'); x.font = '92px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(K.icon, 64, 70);
      map = new THREE.CanvasTexture(c); if (THREE.SRGBColorSpace) map.colorSpace = THREE.SRGBColorSpace;
    } catch (e) { map = null; }
    m = new THREE.SpriteMaterial(map ? { map, transparent: true, depthTest: false } : { color: 0xff5a5a, depthTest: false });
    MAT[kind] = m;
  }
  const s = new THREE.Sprite(m); s.scale.set(size, size, 1); s.renderOrder = 22; return s;
}

export class Enemies {
  constructor(game) {
    this.g = game;
    this.list = [];       // 活着的敌人
    this.missiles = [];   // 我方导弹
    this.fx = [];         // 小特效（冲击圈 / 爆点）
    this.t = 0; this.next = ENEMY.firstDelay;
    this.pending = [];    // 敌潮里还没刷出来的敌人
    const host = (typeof document !== 'undefined' && (document.getElementById('playerModal') ? document.getElementById('playerModal').parentNode : document.body)) || null;
    this.warnHost = null;
    if (host && host.insertAdjacentHTML) {
      host.insertAdjacentHTML('beforeend', '<div id="enWarn" class="en-warn-host" aria-hidden="true"></div>');
      this.warnHost = document.getElementById('enWarn');
    }
  }

  /* ---------------- 对外接口 ---------------- */
  clear() {
    for (const e of this.list) this._remove(e);
    for (const m of this.missiles) this.g.scene.remove(m.mesh);
    for (const f of this.fx) this.g.scene.remove(f.mesh);
    this.list.length = 0; this.missiles.length = 0; this.fx.length = 0;
    this.t = 0; this.next = ENEMY.firstDelay; this.pending.length = 0;
    if (this.g.rogue) { this.g.rogue.waveLeft = 0; this.g.rogue.waveActive = false; }
    if (this.warnHost) { this.warnHost.innerHTML = ''; this.warnHost._h = null; }
  }

  /** 落地冲击波（BUFF_32）：半径内所有敌人一次性炸掉 */
  shockwave(radius) {
    const p = this.g.player.root.position;
    this._ring(p.x, p.y + 0.1, p.z, radius, 0xffd24a);
    let n = 0;
    for (const e of this.list.slice()) {
      if (Math.hypot(e.pos.x - p.x, e.pos.z - p.z) <= radius + e.r) { this._kill(e, true); n++; }
    }
    if (n) this.g.ui.toast(rt('waveKill', { n }));
    return n;
  }

  /* ---------------- 每帧 ---------------- */
  update(dt) {
    const g = this.g, rg = g.rogue;
    if (!rg) { if (this.list.length) this.clear(); return; }
    if (!['ready', 'charging', 'jumping'].includes(g.state) || g.freezeLeft > 0) return;   // 抽卡 / 摔落 / 时停：全部暂停

    this._spawnTick(dt, rg);
    this._pendingTick(dt, rg);
    for (const e of this.list.slice()) this._step(e, dt);
    this._missiles(dt);
    this._fx(dt);
    this._autoFire(dt, rg);
    this._warnUI();
  }

  /* ---------------- 刷怪 ---------------- */
  _spawnTick(dt, rg) {
    const g = this.g, n = rg.layers;
    if (n < ENEMY.startLayer) return;
    if (!(g.state === 'ready' || g.state === 'charging')) return;      // 空中不刷（不公平）
    this.t += dt;
    if (this.t < this.next || this.list.length >= ENEMY.maxAlive(n)) return;
    this.t = 0; this.next = ENEMY.interval(n) * (0.8 + Math.random() * 0.4);
    this._spawn(this._pickKind(rg));
  }

  _pickKind(rg) {
    const pool = KIND_LIST.filter((k) => rg.layers >= KINDS[k].from);
    // 没见过的新种类权重 ×2，让玩家尽快见到全部 20 种
    const wt = (k) => KINDS[k].w * (rg.seenEnemies[k] ? 1 : 2);
    let r = Math.random() * pool.reduce((s, k) => s + wt(k), 0), kind = pool[0];
    for (const k of pool) { if ((r -= wt(k)) <= 0) { kind = k; break; } }
    return kind;
  }

  /* ---------------- 敌潮：一次来好几只，全部结束且你还活着 → 奖励 ---------------- */
  waveSize(layers) { return Math.min(6, 2 + Math.floor(layers / 10)); }
  spawnWave(n) {
    const rg = this.g.rogue; if (!rg || n <= 0) return;
    rg.waveLeft = n; rg.waveActive = true;
    for (let i = 0; i < n; i++) this.pending.push({ t: 0.5 + i * 0.9 });
    this.g.ui.toast(rt('waveWarn', { n }), 3000);
  }
  _pendingTick(dt, rg) {
    if (!this.pending.length || !(this.g.state === 'ready' || this.g.state === 'charging')) return;
    for (const q of this.pending.slice()) {
      q.t -= dt;
      if (q.t > 0) continue;
      this.pending.splice(this.pending.indexOf(q), 1);
      const e = this._spawn(this._pickKind(rg));
      if (e) e.wave = true; else { rg.waveLeft--; this._waveCheck(); }
    }
  }
  _waveCheck() {
    const g = this.g, rg = g.rogue; if (!rg || !rg.waveActive) return;
    if (rg.waveLeft > 0) return;
    rg.waveActive = false;
    if (rg.waveLeft < 0) return;                                           // 你已经被打下去了
    rg.waves++;
    const pts = 30 + 10 * ENEMY.tier(rg.layers);
    g.score += pts; g.ui.setScore(g.score); g.addEnergy(50);
    g.ui.toast(rt('waveWin', { n: pts }), 2600); g.rogueUI.flash(); g._rogueBestCheck();
  }

  /** 爆发技能：清掉场上（以及还没刷出来的）所有敌人，每只照常得分 */
  nukeAll() {
    const rg = this.g.rogue; let n = 0;
    const pend = this.pending.length; this.pending.length = 0; if (rg.waveActive) rg.waveLeft -= pend;
    for (const e of this.list.slice()) { this._kill(e, true); n++; }
    this._waveCheck();
    const p = this.g.player.root.position; this._ring(p.x, p.y + 0.1, p.z, 9, 0xfff07a);
    return n;
  }

  /** 擦弹：敌人从你身边险险掠过（没打中）→ 得分 + 充能。每只敌人只算一次 */
  _graze(e) {
    if (e.grazed) return;
    e.grazed = true;
    const g = this.g, rg = g.rogue; rg.grazes++;
    const pts = 2 + Math.floor(rg.layers / 10);
    g.score += pts; g.ui.setScore(g.score);
    const sp = g._toScreen(g.player.root.position, 2.0); g.ui.popScore(rt('graze', { n: pts }), sp.x, sp.y, true);
    g.addEnergy(25); playSfx(g.sound, 'tock', 1, 1.8); g._rogueBestCheck();
  }
  /** 跟踪与你的最近距离；过了最近点、没打中、且最近距离在擦弹范围内 → 擦弹 */
  _trackGraze(e, d) {
    const live = this.g.player.state !== 'fall' && this.g.player.state !== 'down' && this.g.player.state !== 'tip';
    if (e.minD === undefined || d < e.minD) e.minD = d;
    else if (live && d > e.minD + 0.12 && e.minD < e.r + 1.25) this._graze(e);
  }

  /** 当前这一跳的“跳跃走廊”：起点 → 终点，中点，方向，垂直方向 */
  _corridor() {
    const b = this.g.blocks, c = b.current, n = b.next;
    if (!c || !n) return null;
    let dx = n.x - c.x, dz = n.z - c.z; const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
    return { c, n, dx, dz, px: -dz, pz: dx, len, mx: (c.x + n.x) / 2, mz: (c.z + n.z) / 2 };
  }

  _spawn(kind) {
    const k = this._corridor(); if (!k) return null;
    const g = this.g, K = KINDS[kind], rg = g.rogue;
    const rr = K.r || K.hitR;
    const e = { kind, K, t: K.t, phase: 'warn', life: 0, locked: false, r: rr, size: K.size || rr * 2.6, vel: new THREE.Vector3(), base: new THREE.Vector3(), side: Math.random() < 0.5 ? -1 : 1, warnT: K.warn };
    e.mesh = spriteFor(kind, e.size);
    e.pos = e.mesh.position;
    e.warnT = K.warn * ENEMY.warnScale(rg.layers);
    if (K.t === 'cross') { e.speed = rnd(K.speed); e.alt = rnd(K.alt); }
    if (K.t !== 'home') {
      const p = g.player.root.position; e.tx = p.x; e.tz = p.z;                              // 瞄准你现在站的地方
      const ty = TOP + ((k.c.root && k.c.root.position.y) || 0) + 0.04;
      if (K.t === 'drop') e.tele = this._ringMesh(0xff3b3b, K.hitR * 0.78, K.hitR);
      else { e.tele = new THREE.Mesh(new THREE.PlaneGeometry(K.t === 'float' ? 7 : 14, K.r * 1.8), new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthTest: false })); e.tele.rotation.x = -Math.PI / 2; e.tele.renderOrder = 21; }
      e.tele.position.set(e.tx, ty, e.tz); g.scene.add(e.tele);
    }
    if (K.t !== 'drop' && K.t !== 'roll') {                                              // 空中的敌人：地上投一个小影子，方便判断位置
      e.shadow = new THREE.Mesh(geo('shadow', () => new THREE.CircleGeometry(0.5, 16)), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
      e.shadow.rotation.x = -Math.PI / 2; e.shadow.scale.setScalar(rr * 1.2); g.scene.add(e.shadow);
    }
    this._place(e, k);
    e.mesh.visible = K.t === 'drop' || K.t === 'roll' || K.t === 'float';                // 鸟类 / 追踪类预警期还在屏幕外，只亮提示
    if (K.t === 'float') e.mesh.scale.setScalar(0.05 * e.size);
    g.scene.add(e.mesh);
    this.list.push(e);
    if (!rg.seenEnemies[kind]) {                                                          // 第一次见到这种敌人：说明一下
      rg.seenEnemies[kind] = 1;
      g.ui.toast(rt('enemyNew', { icon: K.icon, name: L(K.name), desc: L(K.desc) }), 3400);
    }
    return e;
  }

  /** 预警期间每帧重新对准当前的跳跃走廊（你落地后走廊会变） */
  _place(e, k) {
    const K = e.K, b = e.base;
    e.lane = { x: e.tx !== undefined ? e.tx : k.mx, z: e.tz !== undefined ? e.tz : k.mz, px: k.px, pz: k.pz, dx: k.dx, dz: k.dz };
    const { x, z } = e.lane;
    if (K.t === 'cross') {                                                                // 贴地横着飞向你站的位置
      b.set(x + k.px * e.side * 9, TOP + e.alt, z + k.pz * e.side * 9);
      e.vel.set(-k.px * e.side * e.speed, 0, -k.pz * e.side * e.speed);
      e.tele.rotation.z = Math.atan2(-k.pz, k.px);
    } else if (K.t === 'float') {                                                         // 慢慢飘向你站的位置
      b.set(x + k.px * e.side * 2.5, TOP + 0.5, z + k.pz * e.side * 2.5);
      e.vel.set(-k.px * e.side * K.drift, K.rise, -k.pz * e.side * K.drift);
      e.tele.rotation.z = Math.atan2(-k.pz, k.px);
    } else if (K.t === 'drop') {
      b.set(e.tx, TOP + K.h, e.tz); e.vel.set(0, -K.fall, 0);
    } else if (K.t === 'roll') {
      b.set(e.tx + k.px * e.side * 7, TOP + K.r * 0.9, e.tz + k.pz * e.side * 7);
      e.vel.set(-k.px * e.side * K.speed, 0, -k.pz * e.side * K.speed);
      e.tele.rotation.z = Math.atan2(-k.pz, k.px);
    } else {                                                                              // home：从屏幕外高处斜着出现
      const p = this.g.player.root.position;
      b.set(p.x + k.px * e.side * 7, TOP + 3, p.z + k.pz * e.side * 7); e.vel.set(0, 0, 0);
    }
    e.pos.copy(b);
    if (e.shadow) e.shadow.position.set(b.x, TOP + 0.03, b.z);
  }

  /* ---------------- 单个敌人的一帧 ---------------- */
  _step(e, dt) {
    const g = this.g, K = e.K, pl = g.player, p = pl.root.position;
    e.life += dt;
    if (e.phase === 'warn') {
      e.warnT -= dt;
      if (e.tele) e.tele.material.opacity = 0.3 + 0.35 * Math.sin(e.life * 14);
      if (K.t === 'float') e.mesh.scale.setScalar(e.size * Math.max(0.05, Math.min(1, 1 - e.warnT / K.warn)));
      if (e.warnT <= 0) { e.phase = 'fly'; e.mesh.visible = true; e.life = 0; if (K.t === 'float') e.mesh.scale.setScalar(e.size); }
      return;
    }
    const b = e.base;
    if (K.t === 'cross' || K.t === 'float') {
      b.addScaledVector(e.vel, dt); e.pos.copy(b);
      if (K.wobY) e.pos.y += Math.sin(e.life * K.wobF) * K.wobY;
      const w = K.zig ? Math.sin(e.life * K.zigF) * K.zig : K.sway ? Math.sin(e.life * K.swayF) * K.sway : 0;
      if (w) { e.pos.x += e.lane.dx * w; e.pos.z += e.lane.dz * w; }
      if (e.shadow) e.shadow.position.set(e.pos.x, TOP + 0.03, e.pos.z);
      if (K.t === 'cross') { if (Math.hypot(b.x - e.lane.x, b.z - e.lane.z) > 11 || e.life > 9) return this._remove(e, true); }
      else if (e.life > K.life || Math.hypot(b.x - e.lane.x, b.z - e.lane.z) > 6) return this._remove(e, true);
      const d3 = Math.hypot(e.pos.x - p.x, e.pos.y - (p.y + 0.5), e.pos.z - p.z);
      if (pl.state !== 'fall' && pl.state !== 'down' && pl.state !== 'tip' && d3 < e.r + 0.4) this._hit(e);   // 站着、刚起跳的你都会撞；跳高了就躲掉
      else this._trackGraze(e, d3);
    } else if (K.t === 'drop') {
      b.addScaledVector(e.vel, dt); e.pos.copy(b);
      if (e.pos.y <= TOP + 0.45) {                                                       // 落到脚下那一刻判定
        const hit = Math.hypot(p.x - e.tx, p.z - e.tz) < K.hitR && p.y < TOP + 1.6 && pl.state !== 'fall';
        this._boom(e.tx, TOP + 0.3, e.tz, K.hitR > 1.2 ? 0xff8a3d : 0xff3b3b, K.hitR);
        if (hit) this._hit(e);
        else { if (pl.state !== 'fall' && Math.hypot(p.x - e.tx, p.z - e.tz) < K.hitR + 0.9) this._graze(e); this._remove(e, true); }
      }
    } else if (K.t === 'roll') {
      b.addScaledVector(e.vel, dt); e.pos.copy(b);
      e.mesh.scale.set(e.size, e.size * (1 + 0.08 * Math.sin(e.life * 20)), 1);
      if (Math.hypot(b.x - e.tx, b.z - e.tz) > 9 || e.life > 6) return this._remove(e, true);
      const grounded = pl.state !== 'jump' && pl.state !== 'fall' && pl.state !== 'tip' && pl.state !== 'down';   // 只撞站在方块上的你
      if (grounded && p.y < TOP + 0.9 && Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < e.r + 0.3) this._hit(e);
      else this._trackGraze(e, Math.hypot(e.pos.x - p.x, e.pos.y - (p.y + 0.5), e.pos.z - p.z));
    } else {                                                                              // home：追踪
      const tx = p.x - b.x, ty = p.y + 0.5 - b.y, tz = p.z - b.z, d = Math.hypot(tx, ty, tz) || 1;
      const k = 1 - Math.exp(-K.turn * dt);
      e.vel.x += (tx / d * K.speed - e.vel.x) * k; e.vel.y += (ty / d * K.speed - e.vel.y) * k; e.vel.z += (tz / d * K.speed - e.vel.z) * k;
      b.addScaledVector(e.vel, dt); e.pos.copy(b);
      if (K.jitter) { e.pos.x += Math.sin(e.life * 23) * K.jitter * 6; e.pos.y += Math.cos(e.life * 19) * K.jitter * 6; }
      if (e.shadow) e.shadow.position.set(e.pos.x, TOP + 0.03, e.pos.z);
      if (e.life > K.life) { this._boom(e.pos.x, e.pos.y, e.pos.z, 0xbbbbbb); return this._remove(e, true); }
      if (pl.state !== 'fall' && pl.state !== 'down' && pl.state !== 'tip' && Math.hypot(e.pos.x - p.x, e.pos.y - (p.y + 0.5), e.pos.z - p.z) < e.r + 0.4) this._hit(e);
    }
  }

  /* ---------------- 被撞 / 被击落 ---------------- */
  _hit(e) {
    const g = this.g, rg = g.rogue;
    if (g._invulnT > 0 || g._feverT > 0) {                               // 爆发无敌 / 狂暴：直接穿过去并击落
      this._kill(e, true); return;
    }
    if (rg.armor > 0) {                                                  // 硬化罐壳：免疫一次
      rg.armor = 0; g.ui.toast(rt('armorUsed')); playSfx(g.sound, 'icechime', 1, 0.8);
      this._boom(e.pos.x, e.pos.y, e.pos.z, 0x9ad0ff); this._remove(e, true); g.rogueUI.refresh(rg); return;
    }
    if (rg.useShield()) {                                                // 护盾
      let reflect = false;
      if (rg.has('BUFF_31') && Math.random() < 0.5) { rg.shield++; reflect = true; }   // 反弹护盾：50% 不消耗，还把它打回去
      g.ui.toast(rt(reflect ? 'reflect' : 'shieldHit')); playSfx(g.sound, 'icechime', 1, 0.8);
      if (reflect) this._kill(e, false); else { this._boom(e.pos.x, e.pos.y, e.pos.z, 0x7be0ff); this._remove(e, true); }
      g.rogueUI.refresh(rg); return;
    }
    this._boom(e.pos.x, e.pos.y, e.pos.z, 0xff5a5a);
    const kind = e.kind;
    if (rg.waveActive) { rg.waveActive = false; rg.waveLeft = -99; this.pending.length = 0; }   // 被打下去了：敌潮奖励作废
    this._remove(e, true);
    g._enemyKill(kind);                                                  // 没有任何防护：掉下去
  }

  /** 击落：加分、赏金 */
  _kill(e, byWave) {
    if (!this.list.includes(e)) return;
    const g = this.g, rg = g.rogue;
    const pts = ENEMY.killScore(rg.layers) * (rg.has('BUFF_36') ? (rg.syn('hunter') ? 5 : 3) : 1);
    g.score += pts; g.ui.setScore(g.score);
    const sp = g._toScreen(e.pos, 0.4); g.ui.popScore(`${e.K.icon} +${pts}`, sp.x, sp.y, true);
    this._boom(e.pos.x, e.pos.y, e.pos.z, 0xffd24a);
    playSfx(g.sound, 'tock', 1, 1.5);
    rg.kills++; g.addEnergy(rg.syn('warmachine') ? 25 : 10);
    if (rg.has('BUFF_36') && rg.kills % 5 === 0) { rg.shield++; g.ui.toast(rt('bounty')); }
    this._remove(e, true);
    g._rogueBestCheck();
    g.rogueUI.refresh(rg);
  }

  /* ---------------- 自动反击 ---------------- */
  _nearest() {
    const p = this.g.player.root.position; let best = null, bd = 1e9;
    for (const e of this.list) {
      if (e.locked) continue;
      const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  _autoFire(dt, rg) {
    if (rg.has('BUFF_34')) {                                             // 自动炮塔：每 4 秒一发
      const te = rg.syn('barrage') ? 2 : ENEMY.turretEvery;
      rg.turretT = Math.min(te, rg.turretT + dt);
      if (rg.turretT >= te) { const e = this._nearest(); if (e) { rg.turretT = 0; this._fire(e); } }
    }
    if (rg.ammo > 0) { const e = this._nearest(); if (e) { rg.ammo--; this._fire(e); this.g.rogueUI.refresh(rg); } }   // 连击炮：有弹药就打
  }
  _fire(e) {
    e.locked = true;
    const p = this.g.player.root.position;
    const mesh = new THREE.Mesh(geo('missile', () => new THREE.SphereGeometry(0.16, 8, 6)), MAT.missile || (MAT.missile = new THREE.MeshBasicMaterial({ color: 0xffa51f })));
    mesh.position.set(p.x, p.y + 0.9, p.z);
    this.g.scene.add(mesh);
    this.missiles.push({ mesh, e, t: 0, from: mesh.position.clone() });
    playSfx(this.g.sound, 'tock', 1, 1.2);
  }
  _missiles(dt) {
    for (const m of this.missiles.slice()) {
      m.t += dt / 0.3;
      if (!this.list.includes(m.e)) { this.g.scene.remove(m.mesh); this.missiles.splice(this.missiles.indexOf(m), 1); continue; }
      const k = Math.min(1, m.t);
      m.mesh.position.lerpVectors(m.from, m.e.pos, k);
      m.mesh.position.y += Math.sin(k * Math.PI) * 0.6;
      if (m.t >= 1) { this.g.scene.remove(m.mesh); this.missiles.splice(this.missiles.indexOf(m), 1); this._kill(m.e, false); }
    }
  }

  /* ---------------- 移除 / 提示 / 特效 ---------------- */
  _remove(e, fromList) {
    const sc = this.g.scene;
    sc.remove(e.mesh);
    if (e.shadow) { sc.remove(e.shadow); e.shadow.material.dispose && e.shadow.material.dispose(); }
    if (e.tele) { sc.remove(e.tele); e.tele.geometry.dispose && e.tele.geometry.dispose(); e.tele.material.dispose && e.tele.material.dispose(); }
    if (fromList) { const i = this.list.indexOf(e); if (i >= 0) this.list.splice(i, 1); if (e.wave && !e.waveDone) { e.waveDone = true; const rg = this.g.rogue; if (rg && rg.waveActive) { rg.waveLeft--; this._waveCheck(); } } }
  }

  /** 横着飞来 / 追踪类敌人的预警：在屏幕边缘亮 ⚠️ + 图标（砸落 / 滚动类自带红圈 / 红带） */
  _warnUI() {
    const host = this.warnHost; if (!host) return;
    const g = this.g; let html = '';
    for (const e of this.list) {
      if (e.phase !== 'warn' || (e.t !== 'cross' && e.t !== 'home')) continue;
      const at = e.t === 'cross' ? { x: e.lane.x + e.lane.px * e.side * 5.2, y: TOP + e.alt, z: e.lane.z + e.lane.pz * e.side * 5.2 } : e.base;
      const sp = g._toScreen(at, 0);
      const x = Math.min(Math.max(sp.x, 28), g.viewW - 28), y = Math.min(Math.max(sp.y, 96), g.viewH - 40);
      html += `<div class="en-warn" style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px">⚠️${e.K.icon}</div>`;
    }
    if (host._h !== html) { host.innerHTML = html; host._h = html; }
  }

  _boom(x, y, z, color, radius = 0.4) {
    const m = new THREE.Mesh(geo('boom', () => new THREE.SphereGeometry(1, 10, 8)), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }));
    m.position.set(x, y, z); m.scale.setScalar(radius); this.g.scene.add(m); this.fx.push({ mesh: m, t: 0, dur: 0.3, from: radius, to: radius * 1.6 });
  }
  _ringMesh(color, inner, outer) {
    const m = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthTest: false }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = 21; return m;
  }
  _ring(x, y, z, radius, color) {
    const m = this._ringMesh(color, 0.9, 1.0); m.position.set(x, y, z); m.scale.setScalar(0.2);
    this.g.scene.add(m); this.fx.push({ mesh: m, t: 0, dur: 0.45, from: 0.2, to: radius, ring: true });
  }
  _fx(dt) {
    for (const f of this.fx.slice()) {
      f.t += dt / f.dur; const k = Math.min(1, f.t);
      f.mesh.scale.setScalar(f.from + (f.to - f.from) * (f.ring ? 1 - Math.pow(1 - k, 3) : k));
      f.mesh.material.opacity = (f.ring ? 0.85 : 0.8) * (1 - k);
      if (k >= 1) { this.g.scene.remove(f.mesh); f.mesh.material.dispose && f.mesh.material.dispose(); this.fx.splice(this.fx.indexOf(f), 1); }
    }
  }
}
