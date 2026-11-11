// 游戏主控：渲染器 / 场景 / 正交相机 / 灯光、输入、状态机、计分与落点判定
import * as THREE from 'three';
import { CONFIG } from './config.js?v=20261112c';
import { Storage } from './Storage.js?v=20261112c';
import { Tweens, clamp, Ease } from './utils.js?v=20261112c';
import { SkinManager } from './SkinManager.js?v=20261112c';
import { BlockManager } from './BlockManager.js?v=20261112c';
import { Player } from './Player.js?v=20261112c';
import { UIManager } from './UIManager.js?v=20261112c';
import { Sound } from './Sound.js?v=20261112c';
import { t, L } from './i18n.js?v=20261112c';
import { getPerk } from './canPerks.js?v=20261112c';
import { getSignature, RARITY } from './canSignature.js?v=20261112c';
import { PLAYER_SKINS } from './SkinManager.js?v=20261112c';
import { Music, playSfx } from './SkinAudio.js?v=20261112c';
import { SignatureFX } from './SignatureFX.js?v=20261112c';
import { RunState, rt, chargeTimeFor, HZ } from './Roguelike.js?v=20261112c';
import { fetchTop } from './Leaderboard.js?v=20261112c';
import { stairParams, STAND_HZ, STAIR, HZT } from './Staircase.js?v=20261112c';
const hz = (b, k) => !!(b && b.hzs && b.hzs.includes(k));      // 方块是否带某个机制

// 踩中星号方块后的免费体验时长（秒）
const TRIAL_SEC = 8;

// 状态：menu 首页 | ready 等待按压 | charging 蓄力 | jumping 空中 | falling 摔落 | over 结算
export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = 'menu';
    this.score = 0;
    this.combo = 0;
    this.perfects = 0;
    this.match = null;        // 同图比赛：{ code, seed, finished }；非空时不计入最高分/总榜，且关闭罐子能力
    this.onMatchOver = null;
    this.rogueMode = false;   // Roguelike 模式：每 5 层三选一 Buff；成绩单独统计，不进总榜
    this.rogue = null;        // 当前这一局的 RunState
    this.rogueUI = null;
    this.rogueBest = Storage.getRogueBest();
    this.camTwist = 0; this._mirror = false; this._invisT = 0;
    this.best = Storage.getHighScore();
    this.chargeT = 0;
    this.tweens = new Tweens();
    this.sound = new Sound();
    this.sound.muted = Storage.getMuted();
    this.music = new Music(this.sound);
    this.fx = null;
    this.sig = null;
    this.camTarget = new THREE.Vector3();
    this.camGoal = new THREE.Vector3();
    this.shake = 0;

    this._initRenderer();
    this._initScene();

    this.skins = new SkinManager();
    this.skins.checkUnlocks(this.best);
    this.blocks = new BlockManager(this.scene, this.skins, this.tweens);
    this.player = new Player(this.scene, this.skins);
    this.trial = null;
    this._sinceTrial = 0; this._trialsThisRound = 0;
    this.blocks.trialRoll = (score) => this._rollTrial(score);
    this.ui = new UIManager({
      onStart: () => this.startRound(),
      onRestart: () => this.startRound(),
      onHome: () => this.goHome(),
      onPreviewFx: (id) => this.previewSignature(id),
      onStopFx: () => this.stopPreview(),
      onMute: () => this.setMuted(!this.sound.muted),
      onFreeze: () => this.activateFreeze(),
    }, this.skins);
    try { this.fx = new SignatureFX(document.getElementById('fxCanvas'), document.getElementById('fxGlow')); } catch (e) { this.fx = null; }
    this._syncMuteBtn();
    this._refreshSig();

    this.skins.onChange((kind, id) => {
      if (kind === 'player') { this.player.setSkin(id); this._refreshPerk(); this._refreshSig(); }
      else { this._applyTheme(); this.blocks.restyleAll(); }
    });

    this._applyTheme();
    this._bindInput();
    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', () => setTimeout(this._onResize, 200));
    this._onResize();

    this.reset();
    this.ui.setBest(this.best);
    this.ui.showStart(this.best);
  }

  /* ================= 初始化 ================= */
  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0); // 透明，背景渐变由 CSS 绘制
  }

  _initScene() {
    this.scene = new THREE.Scene();
    // 正交相机：45° 伪等轴测视角（frustum 在 _onResize 中按屏幕比例计算）
    this.camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 200);

    this.scene.add(new THREE.HemisphereLight('#ffffff', '#a9a3c9', 1.5));
    const sun = new THREE.DirectionalLight('#ffffff', 2.0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 0.5, far: 50 });
    sun.shadow.bias = -0.0005;
    this.scene.add(sun, sun.target);
    this.sun = sun;

    // 只接收阴影的透明地面
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.ShadowMaterial({ opacity: 0.16 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // “夜视”能力：完美区域光圈
    this.perfectRing = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48),
      new THREE.MeshBasicMaterial({ color: '#7af6ff', transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    this.perfectRing.rotation.x = -Math.PI / 2;
    this.perfectRing.visible = false;
    this.scene.add(this.perfectRing);

    // 时停罐：蓄力时显示落点箭头（箭杆 + 箭头 + 落点圈），沿 +Z 方向建模，再整体转向
    const aimMat = () => new THREE.MeshBasicMaterial({ color: '#d4f23a', transparent: true, opacity: 0.9, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
    this.aimArrow = new THREE.Group();
    this.aimShaft = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), aimMat());
    this.aimShaft.rotation.x = -Math.PI / 2;
    this.aimHead = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.34, 3), aimMat());
    this.aimHead.rotation.x = Math.PI / 2; this.aimHead.scale.z = 0.25;
    this.aimRing = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.26, 32), aimMat());
    this.aimRing.rotation.x = -Math.PI / 2;
    [this.aimShaft, this.aimHead, this.aimRing].forEach((m) => { m.renderOrder = 20; });
    this.aimArrow.add(this.aimShaft, this.aimHead, this.aimRing);
    this.aimArrow.visible = false;
    this.scene.add(this.aimArrow);
  }

  _applyTheme() {
    const style = this.skins.blockStyle;
    document.body.classList.remove('theme-candy', 'theme-neon');
    document.body.classList.add(style.theme);
    this.ground.material.opacity = style.shadowOpacity;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', style.id === 'neon' ? '#14122b' : '#cfe9ff');
  }

  /* ================= 跨端输入 ================= */
  _bindInput() {
    // 点在按钮 / 弹窗 / 开始界面上时，交给 UI 处理
    const isUI = (t) => t && t.closest && t.closest('button, input, a, .modal-wrap, .screen');

    // 手机：touchstart / touchend（非 passive，阻止滚动、缩放和随后的模拟鼠标事件）
    window.addEventListener('touchstart', (e) => {
      if (isUI(e.target)) return;
      e.preventDefault();
      this.press();
    }, { passive: false });
    const touchEnd = (e) => { if (this.state === 'charging') { e.preventDefault(); this.release(); } };
    window.addEventListener('touchend', touchEnd, { passive: false });
    window.addEventListener('touchcancel', touchEnd, { passive: false });

    // 电脑：鼠标左键
    window.addEventListener('mousedown', (e) => { if (e.button === 0 && !isUI(e.target)) this.press(); });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.release(); });

    // 电脑：空格键（结算界面按空格 / 回车直接再来一局）
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Space' && e.key !== ' ' && e.key !== 'Enter') return;
      if (e.target && e.target.tagName === 'INPUT') return;
      if (this.state === 'over' && !this.ui.el.over.classList.contains('hidden')) {
        if (this.ui.el.skin.classList.contains('hidden') && this.ui.el.rank.classList.contains('hidden')) { e.preventDefault(); this.startRound(); }
        return;
      }
      if (e.key === 'Enter') return;
      e.preventDefault();
      if (!e.repeat) this.press();
    });
    window.addEventListener('keyup', (e) => { if (e.code === 'Space' || e.key === ' ') this.release(); });

    // 切到后台时自动松手，防止卡在蓄力状态
    window.addEventListener('blur', () => this.release());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.release(); this.music.pause(); } else this.music.resume();
    });
    window.addEventListener('contextmenu', (e) => { if (!isUI(e.target)) e.preventDefault(); });
  }

  press() {
    if (this.state !== 'ready' || this.ui.blocking || this._stun > 0) return;
    if (this.player.state !== 'idle' && this.player.state !== 'land') return;
    this.player.state = 'idle'; // 打断落地缓冲动画，立即开始蓄力
    this.state = 'charging';
    this.chargeT = 0;
    this.sound.chargeStart();
    if (this.rogue && this.blocks.teleport(this.blocks.next)) { this.ui.toast(HZ.teleport.icon + ' ' + L(HZ.teleport.name)); playSfx(this.sound, 'tock', 1, 1.6); }
  }

  release() {
    if (this.state !== 'charging') return;
    this.sound.chargeStop();
    this.sound.jump();
    this.ui.hideCharge();

    const t = this.chargeT;
    const dist = clamp(CONFIG.JUMP_MIN_DIST + CONFIG.JUMP_SPEED * t + CONFIG.JUMP_ACCEL * t * t, CONFIG.JUMP_MIN_DIST, CONFIG.JUMP_MAX_DIST);
    const cur = this.blocks.current, next = this.blocks.next;
    this.blocks.release(cur);
    this.blocks.freezeHazard(next);                  // 移动 / 缩放 / 隐形方块：起跳瞬间定格
    if (this.rogue && cur.hzs) this.blocks.clearMark(cur);     // 离开“站着生效”的机制方块，它恢复普通外观
    this._sinkMax = 0; if (this.rogueUI) this.rogueUI.setSink(null);

    // 跳跃方向：从角色当前位置指向下一个方块中心（和原版一样会自动修正横向偏差）
    const p = this.player.root.position;
    let dx = next.x - p.x, dz = next.z - p.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    const rg = this.rogue; let rocket = false;
    const dd = rg && hz(next, 'blackhole') ? dist * HZT.blackhole : dist;      // 黑洞吸附：把跳跃吸短
    let lx = p.x + dx * dd, lz = p.z + dz * dd;
    if (rg) {
      if (rg.has('BUFF_15') && Math.random() < 0.1) { lx = next.x; lz = next.z; rocket = true; this.ui.toast(rt('rocket')); }   // 火箭推力：直达正中心
      if (!rocket) {
        const w = rg.wind || 0;
        if (w) { lx += -dz * w; lz += dx * w; }
        if (rg.hazWind) { lx += dx * rg.hazWind; lz += dz * rg.hazWind; }       // 强风方块：顺风 / 逆风，落点被推远或拉近（可以靠少蓄 / 多蓄力来补偿）
        if (hz(next, 'icy')) { lx += dx * HZT.icy; lz += dz * HZT.icy; }                                        // 冰霜滑行：落地多滑一段                                                              // 气流干扰：侧风把落点吹偏
        if (rg.has('BUFF_03')) { const ex = next.x - lx, ez = next.z - lz; if (Math.hypot(ex, ez) < 1.2) { lx += ex * 0.35; lz += ez * 0.35; } }   // 羽毛缓降：空中微调
      }
    }
    const top = CONFIG.BLOCK_HEIGHT;
    let target = new THREE.Vector3(lx, top, lz);

    // ---------- 落点判定 ----------
    const perk = this.perk;
    let result;
    if (this.blocks.contains(next, lx, lz, perk.edgeGrace)) {
      const dc = this.blocks.distanceToCenter(next, lx, lz);
      result = dc <= CONFIG.PERFECT_RADIUS * perk.perfectMul * (rg && hz(next, 'bullseye') ? 0.5 : 1) ? 'perfect' : 'hit';
      if (rg && hz(next, 'fragile') && result === 'hit' && dc > next.size * (next.sc || 1) * 0.3) result = 'tip-next';   // 脆皮方块：只有中心站得稳，边缘碎掉
      // “充能”：连续完美后，下一次只要落在方块上就算完美
      this.thunderFired = false;
      if (this.thunderReady) {
        if (result === 'hit') { result = 'perfect'; this.thunderFired = true; }
        this.thunderReady = false; this.thunderCount = 0; this._updatePerkHud();
      }
    } else if (this.blocks.contains(cur, lx, lz)) result = 'stay';
    else if (this.blocks.contains(next, lx, lz, CONFIG.FOOT_RADIUS)) result = 'tip-next';
    else if (this.blocks.contains(cur, lx, lz, CONFIG.FOOT_RADIUS)) result = 'tip-cur';
    else result = 'miss';

    // 时停保护：时停期间落空不算失败，原地弹回当前方块，可以一直跳
    if (this.freezeLeft > 0 && result !== 'perfect' && result !== 'hit' && result !== 'stay') {
      result = 'stay';
      target = new THREE.Vector3(p.x, p.y, p.z);
      this.ui.toast(this._tr('freeze_safe'));
    }
    if (rg) {
      const failing = (r) => r === 'tip-next' || r === 'tip-cur' || r === 'miss';
      if (rg.has('BUFF_04') && Math.random() < 0.8) {            // 弹性垫圈：80% 弹回平台
        if (result === 'tip-next') { result = 'hit'; target = new THREE.Vector3(next.x + (lx - next.x) * 0.6, top, next.z + (lz - next.z) * 0.6); this.ui.toast(rt('spring')); }
        else if (result === 'tip-cur') { result = 'stay'; target = new THREE.Vector3(p.x, p.y, p.z); this.ui.toast(rt('spring')); }
      }
      if (failing(result) && rg.useShield()) {                    // 气泡护盾：挡下一次失误
        result = 'stay'; target = new THREE.Vector3(p.x, p.y, p.z); this.ui.toast(rt('shieldUsed'));
        playSfx(this.sound, 'icechime', 1, 0.8);
      }
      rg.invis = rg.has('BUFF_20');                                // 隐形罐体：起跳后隐形 1 秒
      if (rg.invis) { this.player.root.visible = false; this._invisT = 1.0; }
      if (rg.has('BUFF_10') && this.fx) { const g = getSignature('gold'), sp = this._toScreen(p, 0.6); this.fx.burst(g.burst, sp.x, sp.y, { color: g.color, mul: 0.7, flash: false, combo: 1 }); }   // 金币雨
      this.rogueUI.refresh(rg);
    }
    this.state = 'jumping';
    this._updatePerkHud();
    this.lastResult = result;
    const opts = { onFallen: () => this._onFallen(), durMul: perk.floatMul, durAdd: rg ? rg.floatAdd() : 0 };
    if (result === 'perfect' || result === 'hit' || result === 'stay') {
      opts.after = 'stand';
      opts.onLand = () => this._onLand(result);
    } else if (result === 'miss') {
      opts.after = 'fall';
    } else {
      opts.after = 'tip';
      opts.tipDir = this._outDir(result === 'tip-next' ? next : cur, lx, lz);
    }
    this.player.jump(target, opts);
  }

  /** 方块中心指向落点的“向外”方向（正方体取主轴） */
  _outDir(block, x, z) {
    const dx = x - block.x, dz = z - block.z;
    if (block.shape === 'box') {
      return Math.abs(dx) > Math.abs(dz) ? new THREE.Vector3(Math.sign(dx), 0, 0) : new THREE.Vector3(0, 0, Math.sign(dz));
    }
    return new THREE.Vector3(dx, 0, dz).normalize();
  }

  _onLand(result) {
    this.sound.land();
    if (result === 'stay') { if (this.blocks.next) this.blocks.next.frozen = false; this.state = 'ready'; this._rogueReady(); this._updatePerkHud(); return; }
    const landed = this.blocks.next;
    if (landed && landed.trial) this._startTrial(landed);
    let diamond = false, quantum = false, landedHz = [];
    if (this.rogue && landed) {
      diamond = !!landed.diamond; quantum = !!landed.quantum; landedHz = landed.hzs ? landed.hzs.slice() : [];
      if (hz(landed, 'shocking')) { if (result === 'perfect') result = 'hit'; this._stun = HZT.stun; this.ui.toast(HZ.shocking.icon + ' ' + L(HZ.shocking.desc)); }   // 高压电击：不算完美 + 麻痹
      if (!landed.hzs || !landed.hzs.some((k) => STAND_HZ.includes(k))) this.blocks.clearMark(landed);       // 落地即生效的机制用完就恢复；站着生效的留到离开
    }
    let gain;
    const perfect = result === 'perfect';
    if (perfect) {
      this.combo++;
      this.perfects++;
      const pk = this.perk;
      gain = Math.min(pk.perfectBase + pk.streakStep * (this.combo - 1), pk.streakCap);
      // 充能只统计“真正的”完美，充能送的完美不算，避免无限连锁
      if (pk.thunderStreak && !this.thunderFired) {
        this.thunderCount = (this.thunderCount || 0) + 1;
        if (this.thunderCount >= pk.thunderStreak) { this.thunderReady = true; this.thunderCount = 0; this.ui.toast(`${pk.icon} ${L(pk.name)}`); }
      }
      this.blocks.ripple(this.blocks.next);
      const sp0 = this._toScreen(this.player.root.position, 0); // 落点：罐底与方块顶面的接触处
      if (this.sig) this._signatureBurst(this.sig, sp0.x, sp0.y, this.combo);
      else playSfx(this.sound, 'tock', 1, 1);
    } else {
      this.combo = 0;
      this.thunderCount = 0;
      gain = CONFIG.SCORE_NORMAL;
    }
    if (this.rogue) gain = this.rogue.gain(gain, { perfect, combo: this.combo, diamond, quantum, invisible: this.rogue.invis });
    if (this.rogue && landed) {
      if (landedHz.includes('doublecoin')) { gain *= 2; this.ui.toast('💰 ×2'); }
      if (landedHz.includes('bullseye')) gain = perfect ? gain * 3 : Math.max(1, Math.round(gain / 2));
    }
    const before = this.score;
    this.score += gain;
    // “爆发”：分数每跨过 10 的倍数额外 +1
    const every = this.perk.bonusEvery;
    let bonus = 0;
    if (every && Math.floor(this.score / every) > Math.floor(before / every)) { bonus = 1; this.score += 1; }
    this.ui.setScore(this.score);
    this.ui.setCombo(this.combo);
    this._comboFx();
    const sp = this._toScreen(this.player.root.position, 1.5);
    this.ui.popScore(perfect ? t('perfect', { n: gain }) : `+${gain}`, sp.x, sp.y, perfect);
    if (bonus) setTimeout(() => this.ui.popScore(`${this.perk.icon} +1`, sp.x + 40, sp.y + 10, true), 250);
    this._updatePerkHud();
    if (this.rogue) this._rogueAfterLand(perfect, before);

    // 最高分实时刷新并写入本地（Roguelike 单独记录，不进总榜）
    Storage[this.rogue ? 'noteWeekRogue' : 'noteWeekScore'](this.score);   // 每周榜成绩
    if (this.rogue) this._rogueBestCheck();
    else if (this.score > this.best) {
      this.best = this.score;
      Storage.saveHighScore(this.best);
      this.ui.setBest(this.best);
    }
    if (this.rogue && landed && landedHz.includes('repulsion')) {            // 击退弹簧：被弹向方块后缘（朝上一个方块的方向）
      const prev = this.blocks.current, pp = this.player.root.position;
      let bx = prev.x - landed.x, bz = prev.z - landed.z; const bl = Math.hypot(bx, bz) || 1; bx /= bl; bz /= bl;
      const k = Math.min(landed.size * 0.42, 1.0), sx = pp.x, sz = pp.z, tx = landed.x + bx * k, tz = landed.z + bz * k;
      this.tweens.add({ duration: 0.22, ease: Ease.outCubic, update: (e) => { pp.x = sx + (tx - sx) * e; pp.z = sz + (tz - sz) * e; } });
      this.ui.toast(HZ.repulsion.icon + ' ' + L(HZ.repulsion.name));
    }
    if (this.rogue) { this.blocks.stairFloor = this.rogue.layers + 2; this._sinkReset(landed); }
    this.blocks.advance(this.score);
    if (this.rogue && this.rogue.layers % 5 === 0) { this._rogueChoose(); return; }   // 每 5 层三选一
    this.state = 'ready';
    this._rogueReady();
    this._updatePerkHud();
  }

  _onFallen() {
    if (this.state === 'over') return;
    this.state = 'falling';
    this.sound.fall();
    this.shake = 0.25;
    if (this._canRevive()) { this._revive(); return; }
    if (this.rogue && this.rogue.rollRevive()) { this._revive(rt('revived')); return; }   // 原地复苏
    setTimeout(() => this._gameOver(), 650);
  }

  /* ================= 罐子能力 ================= */
  _refreshPerk() {
    this.perk = getPerk(this.skins.state.player);   // 房间比赛和 Roguelike 里都保留罐子自带能力；Roguelike 里保留罐子自带能力，Buff 叠加在上面
    if (this.rogue) {
      const m = this.rogue.perkMods();
      this.perk.perfectMul = (this.perk.perfectMul || 1) * m.perfectMul;
      this.perk.chargeMul = (this.perk.chargeMul || 1) * m.chargeMul;
    }
    this._updatePerkHud();
  }

  _canRevive() {
    const pk = this.perk;
    if (!pk.revive || this.reviveUsed) return false;
    if (pk.reviveAfter && this.score < pk.reviveAfter) return false;
    return pk.revive === 'any' || String(this.lastResult).startsWith('tip');
  }

  /** 弹回起跳的方块，连击清零，继续游戏 */
  _revive(msg) {
    this.reviveUsed = true;
    this.combo = 0; this.thunderReady = false; this.thunderCount = 0;
    this.ui.setCombo(0);
    this._comboFx();
    this.ui.toast(msg || t('perk_saved', { icon: this.perk.icon, name: L(this.perk.name) }));
    this._updatePerkHud();
    setTimeout(() => {
      if (this.state !== 'falling') return;
      const cur = this.blocks.current;
      cur.root.position.y = 0; this._sinkReset(cur);
      this.player.place(cur.x, CONFIG.BLOCK_HEIGHT, cur.z);
      const sq = this.player.squashG.scale;
      this.tweens.add({ duration: 0.35, ease: Ease.outElastic, update: (e) => sq.setScalar(0.3 + 0.7 * e) });
      this.sound.perfect();
      this.state = 'ready';
    }, 550);
  }

  /** 时停罐：每局一次，时停 N 秒。期间蓄力速度变慢（更好控制），不改变地图、方块和判定范围之外的任何东西 */
  activateFreeze() {
    const pk = this.perk;
    if (!pk || !pk.timeStop || this.freezeLeft > 0) return;
    if (this.state !== 'ready' && this.state !== 'charging') return;
    this._syncCredit();
    const cost = pk.freezeCost || 20;
    if ((this.freezeCredit || 0) < cost) return;
    this.freezeCredit -= cost;
    this.freezeLeft = pk.timeStop;
    this.ui.showFreeze(pk.timeStop);
    this.ui.setFreezeBtn(false);
    playSfx(this.sound, 'icechime', 1, 1);
    this._vibrate([20, 30, 20]);
    this._updatePerkHud();
  }

  _tr(k) { return t(k); }

  /** 积分：每得 1 分 = 1 积分（时停期间得的分也算），开一次时停花 freezeCost 积分 */
  _syncCredit() {
    const d = this.score - (this._creditScore || 0);
    if (d > 0) this.freezeCredit = (this.freezeCredit || 0) + d;
    this._creditScore = this.score;
  }

  _endFreeze(announce, force) {
    const was = force || this.freezeLeft > 0;
    this.freezeLeft = 0;
    if (this.ui) { this.ui.hideFreeze(); }
    if (was && announce) { playSfx(this.sound, 'tock', 1, 1); this._updatePerkHud(); }
  }

  /** 计分板下方的能力状态 */
  _updatePerkHud() {
    const pk = this.perk;
    if (!pk || !pk.id) { this.ui.setFreezeBtn(false); this.ui.setPerk(null); return; }
    let status = '';
    if (pk.timeStop) {
      // 按钮一直在：冷却中变灰并显示还差几分；时停中显示“时停中”
      const inPlay = ['ready', 'charging', 'jumping', 'falling'].includes(this.state);
      this._syncCredit();
      const cost = pk.freezeCost || 20, cr = this.freezeCredit || 0;
      const left = Math.max(0, cost - cr);
      const active = this.freezeLeft > 0;
      const usable = !active && left === 0 && (this.state === 'ready' || this.state === 'charging');
      const note = active ? t('perk_freeze_on') : left > 0 ? t('freeze_cd', { n: cr, m: cost }) : '';
      this.ui.setFreezeBtn(inPlay, usable, note);
      status = active ? t('perk_freeze_on') : left > 0 ? t('freeze_cd', { n: cr, m: cost }) : t('perk_ready');
    } else {
      this.ui.setFreezeBtn(false);
      if (pk.revive) {
        if (this.reviveUsed) status = t('perk_used');
        else if (pk.reviveAfter && this.score < pk.reviveAfter) status = t('perk_after', { n: pk.reviveAfter });
        else status = t('perk_ready');
      } else if (pk.thunderStreak) {
        status = this.thunderReady ? t('perk_charged') : t('perk_streak', { n: this.thunderCount || 0, m: pk.thunderStreak });
      }
    }
    this.ui.setPerk({ icon: pk.icon, name: L(pk.name), status });
  }

  _gameOver() {
    this.state = 'over';
    this._endFreeze(false);
    this.ui.setFreezeBtn(false);
    this._endTrial(false);
    this._stopMusic(0.9);
    if (this.rogue) { this._rogueOver(); return; }
    if (this.match) {                       // 同图比赛：成绩同样计入最高分、统计和总排行榜，只是不弹普通结算框
      this.match.finished = true;
      this.ui.el.hud.classList.add('hidden');
      const rec = this.score > this.bestAtStart;
      Storage.noteWeekScore(this.score);
      Storage.saveHighScore(this.score);
      this.best = Storage.getHighScore();
      const st = Storage.getStats();
      st.games = (st.games || 0) + 1;
      st.perfects = (st.perfects || 0) + this.perfects;
      Storage.saveStats(st);
      const unl = this.skins.checkUnlocks(this.best);
      this.ui.setBest(this.best);
      if (unl && unl.length) this.ui.toast(t('unlocked_new') + unl.map((s) => L(s.name)).join(t('sep')));
      if (this.onMatchOver) this.onMatchOver({ code: this.match.code, score: this.score, perfects: this.perfects, record: rec });
      return;
    }
    const record = this.score > this.bestAtStart;
    Storage.noteWeekScore(this.score);
    Storage.saveHighScore(this.score);
    this.best = Storage.getHighScore();
    const stats = Storage.getStats();
    stats.games = (stats.games || 0) + 1;
    stats.perfects = (stats.perfects || 0) + this.perfects;
    Storage.saveStats(stats);
    const unlocked = this.skins.checkUnlocks(this.best);
    this.ui.showGameOver({ score: this.score, best: this.best, record, perfects: this.perfects, unlocked });
  }

  /* ================= Roguelike 模式 ================= */
  /** VIP = 拥有任一兑换罐（沿用游戏现有的 VIP 判断） */
  _isVip() { return PLAYER_SKINS.some((k) => k.unlock === 'code' && this.skins.isUnlocked('player', k.id)); }

  _setMirror(on) {
    this._mirror = !!on;
    if (this.canvas) this.canvas.style.transform = on ? 'scaleX(-1)' : '';
  }

  _rogueBegin() {
    const rg = this.rogue;
    this._rogueReady();
    this._sinkReset();
    if (rg.vip) {            // 降维打击：把 Roguelike 榜第 10 名当作挑战目标
      fetchTop(10, 0, 'rogue').then((list) => {
        if (this.rogue !== rg || !Array.isArray(list) || !list.length) return;
        rg.target10 = (list[9] || list[list.length - 1]).score;
        this.rogueUI.refresh(rg);
      }).catch(() => {});
    }
  }

  /** 每次回到“等待起跳”：掷这一跳的侧风、刷新 Buff 栏 */
  _rogueReady() {
    const rg = this.rogue; if (!rg) return;
    rg.rollWind();
    const nx = this.blocks.next;
    rg.nextHz = nx && nx.hzs ? (nx.chaos ? '👑' : '') + nx.hzs.map((k) => HZ[k].icon).join('') : '';
    rg.hazWind = nx && hz(nx, 'windy') ? nx.windSign * HZT.wind : 0;                       // 强侧风方块：这一跳被额外吹偏
    this._setMirror(rg.mirrorLeft > 0 || !!(nx && hz(nx, 'mirrored')));                  // 镜像方块：瞄准时画面翻转
    this.player.root.visible = this._invisT <= 0;
    this.rogueUI.refresh(rg);
  }

  /** 每帧：时间类 Buff（滚雪球、空间扭曲、隐形） */
  _rogueTick(dt) {
    const rg = this.rogue;
    if (this._invisT > 0) { this._invisT -= dt; if (this._invisT <= 0) this.player.root.visible = true; }
    if (!['ready', 'charging', 'jumping'].includes(this.state)) return;
    if (rg.twistT > 0) rg.twistT = Math.max(0, rg.twistT - dt);
    this._sinkTick(dt);
    if (rg.has('BUFF_13')) {
      rg.snowT += dt;
      if (rg.snowT >= 10) { rg.snowT -= 10; rg.bonusBase += 1; this.ui.toast(rt('snow', { n: rg.bonusBase })); this.rogueUI.refresh(rg); }
    }
  }

  _rogueAfterLand(perfect, before) {
    const rg = this.rogue;
    rg.layers++;
    if (perfect && rg.has('BUFF_05') && this.combo > 0 && this.combo % 5 === 0) { rg.shield++; this.ui.toast(rt('vamp')); }   // 吸血易拉罐
    if (rg.has('BUFF_06') && Math.floor(this.score / 50) > Math.floor(before / 50)) { this.blocks.nearNext = true; this.ui.toast(rt('airbag')); }   // 安全气囊
    if (rg.vip && perfect) {
      const g = getSignature('gold'), sp = this._toScreen(this.player.root.position, 0);
      if (this.fx) this.fx.burst(g.burst, sp.x, sp.y, { color: g.color, mul: RARITY[g.rarity].burstMul * 1.3, flash: false, combo: this.combo });   // 迪斯科狂欢
      this.rogueUI.disco();
      if (this.combo > 0 && this.combo % 10 === 0) {                      // 共鸣：+100 分并清除所有负面效果
        this.score += 100; this.ui.setScore(this.score);
        rg.clearCurses(); this._setMirror(false);
        this.rogueUI.flash();
        playSfx(this.sound, 'icechime', 1, 1);
        this.ui.toast(rt('resonance'));
      }
    }
    if (rg.mirrorLeft > 0 && --rg.mirrorLeft === 0) { this._setMirror(false); this.ui.toast(rt('mirrorEnd')); }
    if (rg.vip && rg.target10 != null && !rg.beat10 && this.score > rg.target10) { rg.beat10 = true; this.ui.toast(rt('beat')); }
    this.rogueUI.refresh(rg);
  }

  /** 下沉倒计时：落到新方块上重新计时；只在等待起跳 / 蓄力时走（时停期间暂停）。
   *  blk = 你正站着的方块（下沉 / 炸弹方块会有自己的短倒计时） */
  _sinkReset(blk) {
    const rg = this.rogue; if (!rg) { this._sinkMax = 0; return; }
    blk = blk || this.blocks.current;
    const p = stairParams(rg.layers + 1);
    if (rg.stage !== p.stage) {                                        // 进入新的 20 个方块一档：播报新解锁的机制 / 新区域
      const first = rg.stage == null; const prevZone = rg.zoneIdx; rg.stage = p.stage; rg.zoneIcon = p.zone.icon; rg.zoneIdx = p.zoneIdx;
      if (first) this.ui.toast(rt('startMsg'), 3200);
      else if (p.unlockedNew) { const h = HZ[p.unlockedNew]; this.ui.toast(rt('unlock', { skip: p.k * STAIR.step, n: p.k, icon: h.icon, name: L(h.name), desc: L(h.desc) }), 3600); }
      else if (p.k === 20 && !STAIR.allUnlocked) this.ui.toast(rt('chaosAll'), 3000);
      if (!first && prevZone !== p.zoneIdx && !(p.k === 20 && !STAIR.allUnlocked) && !p.unlockedNew) this.ui.toast(rt('zone', { icon: p.zone.icon, name: rt('zone_' + p.zone.id), n: p.stage }), 2800);
    }
    let max = p.timer || 0, icon = '⏳';
    if (hz(blk, 'sinking')) { max = max ? Math.min(max, HZT.sinking) : HZT.sinking; }
    if (hz(blk, 'explosive')) { max = max ? Math.min(max, HZT.explosive) : HZT.explosive; icon = '💣'; }
    this._sinkMax = max; this._sinkT = max; this._sinkIcon = icon;
    this._sinkSpeed = hz(blk, 'timedilate') ? 1.6 : 1;
    if (this.rogueUI) this.rogueUI.setSink(null);
  }

  _sinkTick(dt) {
    if (!(this._sinkMax > 0) || !(this.state === 'ready' || this.state === 'charging') || this.freezeLeft > 0) return;
    this._sinkT -= dt * (this._sinkSpeed || 1);
    const frac = Math.max(0, this._sinkT / this._sinkMax);
    const cur = this.blocks.current;
    if (this._sinkIcon !== '💣') cur.root.position.y = -0.55 * Math.pow(1 - frac, 1.6);   // 平台一点点沉下去（炸弹方块不沉，只闪红）
    this.rogueUI.setSink(frac, Math.max(0, this._sinkT), this._sinkIcon);
    if (this._sinkT <= 0) this._sinkFail();
  }

  _sinkFail() {
    const rg = this.rogue, cur = this.blocks.current;
    if (rg.useShield()) {                                              // 护盾：把平台托回来，重新计时
      this.ui.toast(rt('shieldUsed')); playSfx(this.sound, 'icechime', 1, 0.8);
      cur.root.position.y = 0; this._sinkReset(cur); this.rogueUI.refresh(rg);
      if (this.state === 'ready') this.player.root.position.y = this.blocks.topY(cur);
      return;
    }
    if (this.state === 'charging') { this.sound.chargeStop(); this.ui.hideCharge(); this.blocks.release(cur); }
    if (this._sinkIcon === '💣') this.ui.toast(rt('fuse'));
    this._sinkMax = 0; this.rogueUI.setSink(null);
    this.state = 'jumping';
    this.player.opts = { onFallen: () => this._onFallen() };
    this.player.fall();
  }

  _rogueBestCheck() {
    Storage.noteWeekRogue(this.score);
    if (this.score > this.rogueBest) {
      this.rogueBest = this.score;
      Storage.saveRogueBest(this.score);
      this.ui.setBest(this.rogueBest);
    }
  }

  /** 每 5 层：停下来三选一 */
  _rogueChoose() {
    const rg = this.rogue;
    const opts = rg.choices(3);
    if (!opts.length) { this.state = 'ready'; this._rogueReady(); this._updatePerkHud(); return; }
    this.state = 'choosing';
    this._updatePerkHud();
    this.rogueUI.choose(rg.layers, opts, rg.vip, () => rg.choices(3), (id) => this._roguePick(id));
  }

  _roguePick(id) {
    const rg = this.rogue; if (!rg || this.state !== 'choosing') return;
    rg.take(id);
    if (id === 'BUFF_07') { this.blocks.sizeBoostLeft = 10; this.ui.toast(rt('wall')); }
    else if (id === 'BUFF_14') { this.blocks.diamondLeft = 4; this.blocks.markDiamond(this.blocks.next); this.ui.toast(rt('diamond')); }
    else if (id === 'BUFF_16') { this.blocks.offsetNext(0.2); this._updateCamGoal(); this.ui.toast(rt('quantum')); }
    else if (id === 'BUFF_17') { rg.twistT = 5; rg.twistDir = Math.random() < 0.5 ? -1 : 1; this.ui.toast(rt('warp')); }
    else if (id === 'BUFF_19') {
      if (Math.random() < 0.5) { this.score += 50; this.ui.setScore(this.score); this._rogueBestCheck(); this.ui.toast(rt('coinWin')); }
      else { this.combo = 0; this.ui.setCombo(0); this._comboFx(); this.ui.toast(rt('coinLose')); }
    } else if (id === 'BUFF_22') { rg.mirrorLeft = 10; this._setMirror(true); this.ui.toast(rt('mirror')); }
    this._refreshPerk();
    this.state = 'ready';
    this._rogueReady();
    this._updatePerkHud();
  }

  _rogueOver() {
    const rg = this.rogue;
    this.ui.setFreezeBtn(false);
    document.body.classList.remove('rg-slow');
    this._setMirror(false);
    this.player.root.visible = true;
    const record = this.score > this.rogueBestAtStart;
    this._rogueBestCheck();
    this.rogueUI.hide(); this._sinkMax = 0;
    if (rg.vip && record) this.rogueUI.king();       // 王者降临：VIP 破 Roguelike 纪录
    this.ui.showGameOver({ score: this.score, best: this.rogueBest, record, perfects: this.perfects, unlocked: [], rogue: { layers: rg.layers, picks: rg.picks, vip: rg.vip, king: rg.vip && record } });
  }

  /* ================= 专属特效 / 音乐（纯外观，不影响得分与判定） ================= */
  _refreshSig() {
    const id = (this.trial && this.trial.id) || this.skins.state.player;
    this.sig = (this.trial || this.skins.isUnlocked('player', id)) ? getSignature(id) : null;
    if (this.state === 'ready' || this.state === 'charging' || this.state === 'jumping') this._startMusic();
    this._comboFx();
  }

  _startMusic() {
    if (!this.sig) { this.music.stop(0.3); return; }
    this.music.play(this.sig.theme, { boost: RARITY[this.sig.rarity].comboMusicBoost, level: this.combo > 0 ? 1 : 0 });
    this.music.setCombo(this.combo);
  }

  _vibrate(pat) {
    try { if (!this.sound.muted && navigator.vibrate) navigator.vibrate(pat); } catch (e) { /* 部分浏览器不支持 */ }
  }

  /* ---------- “试驾体验”：踩中 24K 星号方块，免费体验 3 秒金罐 ---------- */
  /** 挑一款玩家还没有的兑换款（优先黄金罐）；全都有了就返回 null（不再出现星号方块） */
  _trialSkin() {
    const locked = PLAYER_SKINS.filter((k) => k.unlock === 'code' && !this.skins.isUnlocked('player', k.id));
    if (!locked.length) return null;
    return locked.find((k) => k.id === 'gold') || locked[Math.floor(Math.random() * locked.length)];
  }

  _rollTrial(score) {
    this._sinceTrial++;
    if (this.match || this.rogueMode || this.state === 'menu' || this.trial || this._trialsThisRound >= 3 || !this._trialSkin()) return false;
    // 网址加 #trial：第 2 个方块起必出星号方块，方便自己测试
    const force = (location.hash || '').includes('trial') && this._trialsThisRound < 3 && this._sinceTrial >= 2;
    // 正常节奏：每局第一个在 3~6 分左右出现；之后每隔 5 个方块起开始 50% 抽取，12 个方块内必出
    const due = score >= 3 && this._sinceTrial >= 5 && (Math.random() < 0.5 || this._sinceTrial >= 12);
    if (!force && !due) return false;
    this._sinceTrial = 0; this._trialsThisRound++;
    return true;
  }

  _startTrial(block) {
    this.blocks.clearTrial(block);
    const skin = this._trialSkin();
    if (!skin) return;
    this._endTrial(false);
    this.trial = { id: skin.id, timer: setTimeout(() => this._endTrial(true), TRIAL_SEC * 1000) };
    this.player.setSkin(skin.id);
    this.sig = getSignature(skin.id);
    this._startMusic();
    const sp = this._toScreen(this.player.root.position, 0);
    if (this.fx) { this.fx.burst('coins', sp.x, sp.y, { color: '#ffc83d', mul: 2.2, flash: true, combo: 3 }); this.fx.fizz(sp.x, sp.y, 2); }
    playSfx(this.sound, 'popcan', 3, 1);
    this._vibrate([30, 40, 40]);
    this.ui.showTrial(L(skin.name), TRIAL_SEC);
  }

  /** 3 秒到了（或回合结束）：金罐消失，变回原来的罐子 */
  _endTrial(announce) {
    const tr = this.trial;
    if (!tr) return;
    clearTimeout(tr.timer);
    this.trial = null;
    this.ui.hideTrial();
    this.player.setSkin(this.skins.state.player);
    this._refreshSig();
    if (announce && this.state !== 'menu' && this.state !== 'over') {
      const sp = this._toScreen(this.player.root.position, 0);
      if (this.fx) this.fx.poof(sp.x, sp.y);
      playSfx(this.sound, 'tock', 1, 1);
      this.ui.showTrialEnd(L(PLAYER_SKINS.find((k) => k.id === tr.id).name));
    }
  }

  _stopMusic(fade = 0.5) { this.music.stop(fade); }

  _comboFx() {
    const sig = this.sig;
    if (this._pv) return;
    this.music.setCombo(this.combo);
    if (!this.fx) return;
    if (!sig) { this.fx.ambience(0); return; }
    const r = RARITY[sig.rarity];
    this.fx.ambience(this.combo, sig.color, r.ambienceFrom, Math.min(1.3, 0.8 + 0.25 * r.order));
  }

  _signatureBurst(sig, x, y, combo) {
    const r = RARITY[sig.rarity];
    if (this.fx) { this.fx.burst(sig.burst, x, y, { color: sig.color, mul: r.burstMul, flash: r.flash, combo }); this.fx.fizz(x, y, r.burstMul); }
    playSfx(this.sound, 'popcan', combo, 0.9);          // Pssssht - Pop!
    playSfx(this.sound, sig.sfx, combo, 0.9, 0.34);     // 开罐之后再接专属音效
    if (!this._pv) this._vibrate([18, 40, 26]);
    this.ui.popWord(L(sig.word), x, y - 70, sig.color, sig.rarity);
  }

  /** 商店里试听：循环放音乐、依次升高连击放特效，直到 stopPreview */
  previewSignature(id) {
    this.stopPreview();
    const sig = getSignature(id);
    if (!sig) return false;
    if (this.sound.muted) this.setMuted(false);
    this._stopMusic(0.1);
    const r = RARITY[sig.rarity];
    this._pv = { n: 0, timer: 0 };
    this.music.play(sig.theme, { boost: r.comboMusicBoost, level: 1 });
    const step = () => {
      if (!this._pv) return;
      const combo = Math.min(++this._pv.n + 1, 8);
      this.music.setCombo(combo);
      this._signatureBurst(sig, window.innerWidth / 2, window.innerHeight * 0.3, combo);
      if (this.fx) this.fx.ambience(combo, sig.color, r.ambienceFrom, Math.min(1.3, 0.8 + 0.25 * r.order));
      if (this._pv.n >= 8) this._pv.n = 0;
      this._pv.timer = setTimeout(step, 1300);
    };
    step();
    return true;
  }

  stopPreview() {
    if (!this._pv) return;
    clearTimeout(this._pv.timer);
    this._pv = null;
    this.music.stop(0.3);
    if (this.fx) this.fx.clear();
  }

  setMuted(m) {
    this.sound.muted = !!m;
    Storage.setMuted(!!m);
    if (m) { this.music.stop(0.1); if (this._pv) this.stopPreview(); }
    else if (this.state === 'ready') this._startMusic();
    this._syncMuteBtn();
  }

  _syncMuteBtn() {
    const b = document.getElementById('btnMute');
    if (!b) return;
    b.textContent = this.sound.muted ? '🔇' : '🔊';
    b.setAttribute('aria-pressed', String(!this.sound.muted));
  }

  /* ================= 回合控制 ================= */
  reset() {
    this.tweens.clear();
    this.blocks.stairFn = this.rogueMode ? stairParams : null;     // Roguelike：阶梯式关卡难度
    this.blocks.reset();
    this.player.place(0, CONFIG.BLOCK_HEIGHT, 0);
    this.score = 0; this.combo = 0; this.perfects = 0; this.chargeT = 0;
    this.reviveUsed = false; this.thunderReady = false; this.thunderCount = 0; this.lastResult = null;
    this.freezeCredit = 0; this._creditScore = 0; this.freezeLeft = 0; this._endFreeze(false);
    this.rogue = this.rogueMode && this.skins ? new RunState(this._isVip()) : null;
    this.camTwist = 0; this._invisT = 0; this._stun = 0; this._setMirror(false);
    if (this.player) this.player.root.visible = true;
    if (this.rogueUI) this.rogueUI.reset(this.rogue);
    if (this.skins) this._refreshPerk();
    this.ui && (this.ui.setScore(0), this.ui.setCombo(0), this.ui.hideCharge());
    this._comboFx();
    this.fx && this.fx.clear();
    this._updateCamGoal();
    this.camTarget.copy(this.camGoal);
  }

  startRound() {
    if (this.match && this.match.finished) return;     // 同图比赛每人只玩一局
    this.ui.hideGameOver();
    this.reset();
    this.bestAtStart = this.best;
    this.stopPreview();
    this._endTrial(false);
    this._sinceTrial = 3; this._trialsThisRound = 0;
    this.rogueBestAtStart = this.rogueBest;
    this.ui.setBest(this.rogueMode ? this.rogueBest : this.best);
    this.ui.hideStart();
    this._startMusic();
    this.state = 'ready';
    if (this.rogue) this._rogueBegin();
    this._updatePerkHud();
  }

  /** 进入 Roguelike 模式（独立模式：不影响普通模式、同图比赛和总排行榜） */
  enterRogue() {
    this.match = null; this.blocks.seed = null;
    this.rogueMode = true;
    this._refreshPerk();
    this.startRound();
  }

  /** 进入同图比赛：地图由种子决定，所有人一模一样 */
  enterMatch(code, seed) {
    this.rogueMode = false;
    this.match = { code, seed, finished: false };
    this.blocks.seed = seed;
    this._refreshPerk();
    this.startRound();
  }

  leaveMatch() {
    this.match = null;
    this.blocks.seed = null;
    this._refreshPerk();
    this.goHome();
  }

  goHome() {
    this.rogueMode = false;
    if (this.rogueUI) this.rogueUI.hide();
    this._endTrial(false);
    this._stopMusic(0.6);
    this.ui.hideGameOver();
    this.reset();
    this.state = 'menu';
    this.ui.showStart(this.best);
  }

  /* ================= 相机与适配 ================= */
  _updateCamGoal() {
    const cur = this.blocks.current, next = this.blocks.next;
    this.camGoal.set((cur.x + next.x) / 2, 0, (cur.z + next.z) / 2);
  }

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    // 大屏 / 高分屏限制渲染像素总量（约 220 万），避免低端显卡卡顿
    const pr = Math.max(0.75, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(2.2e6 / (w * h))));
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    const aspect = w / h;
    let halfW, halfH;
    if (aspect < 0.8) { // 手机竖屏：固定可见宽度
      halfW = CONFIG.VIEW_WIDTH_PORTRAIT / 2; halfH = halfW / aspect;
    } else {            // 横屏 / 电脑：固定可见高度
      halfH = CONFIG.VIEW_HEIGHT_LANDSCAPE / 2; halfW = halfH * aspect;
    }
    Object.assign(this.camera, { left: -halfW, right: halfW, top: halfH, bottom: -halfH });
    this.camera.updateProjectionMatrix();
    this.viewW = w; this.viewH = h;
  }

  _toScreen(pos, lift = 0) {
    const v = new THREE.Vector3(pos.x, pos.y + lift, pos.z).project(this.camera);
    const x = (v.x + 1) / 2 * this.viewW;
    return { x: this._mirror ? this.viewW - x : x, y: (1 - v.y) / 2 * this.viewH };
  }

  /** 特效画在屏幕上，镜头平移后要同步移动，才能一直贴在落点上 */
  _followCamFx() {
    if (!this.fx) return;
    const o = this._toScreen({ x: 0, y: 0, z: 0 });
    const prev = this._fxRef;
    this._fxRef = o;
    if (!prev || !isFinite(o.x) || !isFinite(prev.x)) return;
    const dx = o.x - prev.x, dy = o.y - prev.y;
    if (Math.abs(dx) > 150 || Math.abs(dy) > 150) return;
    this.fx.shift(dx, dy);
  }

  /* ================= 主循环 ================= */
  start() {
    this.last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
      this._followCamFx();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /**
   * 演示 / 自测模式：网址末尾加 #demo 自动游玩（#demo-miss 则故意跳远，用来测试结算）
   * 根据到下一个方块中心的距离反解所需蓄力时间，并加入少量随机误差
   */
  _autoPlay(dt) {
    const mode = (location.hash || '').slice(1);
    if (mode !== 'demo' && mode !== 'demo-miss') return;
    if (this.state === 'menu' || (this.state === 'over' && mode === 'demo')) {
      this._autoT = (this._autoT || 0) + dt;
      if (this._autoT > 1.2) { this._autoT = 0; this.startRound(); }
      return;
    }
    if (this.state === 'ready' && this.player.state === 'idle') {
      this._autoT = (this._autoT || 0) + dt;
      if (this._autoT < 0.5) return;
      this._autoT = 0;
      const p = this.player.root.position, n = this.blocks.next;
      let d = Math.hypot(n.x - p.x, n.z - p.z) + (Math.random() - 0.5) * 0.5;
      if (mode === 'demo-miss' && this.score >= 3) d += 3;
      const a = CONFIG.JUMP_ACCEL, b = CONFIG.JUMP_SPEED, c = CONFIG.JUMP_MIN_DIST - d;
      this._autoHold = Math.max(0, (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a));
      this.press();
    } else if (this.state === 'charging' && this._autoHold != null && this.chargeT >= this._autoHold) {
      this._autoHold = null;
      this.release();
    }
  }

  update(dt) {
    this.tweens.update(dt);
    if (this.freezeLeft > 0) { this.freezeLeft -= dt; if (this.freezeLeft <= 0) this._endFreeze(true, true); }
    this._autoPlay(dt);
    if (this._stun > 0) this._stun -= dt;
    if (this.rogue) { this._rogueTick(dt); this.blocks.updateHazards(dt, (this.state === 'ready' || this.state === 'charging') && !(this.freezeLeft > 0)); }

    if (this.state === 'charging') {
      const slow = this.rogue && this.rogue.has('BUFF_18') && this.chargeT > 1.0 ? 0.5 : 1;     // 子弹时间：蓄力过 1 秒后进入慢动作
      document.body.classList.toggle('rg-slow', slow < 1);
      const curB = this.blocks.current;
      const hzMul = this.rogue ? (hz(curB, 'lava') ? HZT.lava : 1) * (hz(curB, 'timedilate') ? 0.55 : 1) : 1;      // 熔岩 ×1.7 / 时间膨胀 ×0.55
      let nt = this.chargeT + dt * this.perk.chargeMul * slow * hzMul * (this.freezeLeft > 0 ? this.perk.freezeChargeMul : 1);
      nt = this.rogue && hz(curB, 'reset') && nt >= CONFIG.CHARGE_MAX_TIME ? nt - CONFIG.CHARGE_MAX_TIME : Math.min(CONFIG.CHARGE_MAX_TIME, nt);   // 弹道重置：蓄力满了归零重来
      this.chargeT = nt;
      const k = this.chargeT / CONFIG.CHARGE_MAX_TIME;
      const cur = this.blocks.current;
      this.blocks.squash(cur, k);
      this.player.charge(k, this.blocks.topY(cur) + cur.root.position.y);
      this.ui.showCharge(k);
    } else if (this.state === 'ready' && this.player.state === 'idle') {
      // 方块回弹时角色跟着顶面上下
      this.player.root.position.y = this.blocks.topY(this.blocks.current) + this.blocks.current.root.position.y;
    }

    this.player.update(dt);

    // 夜视光圈：标出下一个方块的完美区域
    const ringOn = this.perk && this.perk.perfectRing && (this.state === 'ready' || this.state === 'charging') && this.blocks.next;
    this.perfectRing.visible = !!ringOn;
    if (ringOn) {
      const n = this.blocks.next, r = CONFIG.PERFECT_RADIUS * this.perk.perfectMul;
      this.perfectRing.position.set(n.x, n.root.position.y + this.blocks.topY(n) + 0.015, n.z);
      this.perfectRing.scale.setScalar(r);
      this.perfectRing.material.opacity = 0.55 + 0.3 * Math.sin(performance.now() / 250);
    }

    // 时停罐：蓄力落点箭头（和真正起跳用同一条距离公式）
    const aimOn = this.freezeLeft > 0 && (this.state === 'ready' || this.state === 'charging') && this.blocks.next;
    this.aimArrow.visible = !!aimOn;
    if (aimOn) {
      const t0 = this.chargeT || 0;
      const dist = clamp(CONFIG.JUMP_MIN_DIST + CONFIG.JUMP_SPEED * t0 + CONFIG.JUMP_ACCEL * t0 * t0, CONFIG.JUMP_MIN_DIST, CONFIG.JUMP_MAX_DIST);
      const p = this.player.root.position, nx = this.blocks.next;
      let ax = nx.x - p.x, az = nx.z - p.z; const al = Math.hypot(ax, az) || 1; ax /= al; az /= al;
      this.aimArrow.position.set(p.x, p.y + 0.05, p.z);
      this.aimArrow.rotation.y = Math.atan2(ax, az);
      const shaft = Math.max(dist - 0.45, 0.05);
      this.aimShaft.scale.set(0.12, shaft, 1); this.aimShaft.position.z = shaft / 2 + 0.1;
      this.aimHead.position.z = shaft + 0.27;
      this.aimRing.position.z = dist;
      const pulse = 0.65 + 0.3 * Math.sin(performance.now() / 120);
      this.aimShaft.material.opacity = this.aimHead.material.opacity = this.aimRing.material.opacity = pulse;
    }

    // 相机平滑跟随
    if (this.state !== 'jumping') this._updateCamGoal();
    this.camTarget.lerp(this.camGoal, 1 - Math.exp(-CONFIG.CAM_LERP * dt));
    const o = CONFIG.CAM_OFFSET;
    const tw = this.rogue && this.rogue.twistT > 0 ? this.rogue.twistDir * 15 * Math.PI / 180 : 0;   // 空间扭曲：相机绕着转 15 度
    this.camTwist += (tw - this.camTwist) * (1 - Math.exp(-6 * dt));
    const cs = Math.cos(this.camTwist), sn = Math.sin(this.camTwist);
    const ox = o[0] * cs + o[2] * sn, oz = -o[0] * sn + o[2] * cs;
    let sx = 0, sy = 0;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      sx = (Math.random() - 0.5) * this.shake * 0.8; sy = (Math.random() - 0.5) * this.shake * 0.8;
    }
    this.camera.position.set(this.camTarget.x + ox + sx, this.camTarget.y + o[1] + sy, this.camTarget.z + oz);
    this.camera.lookAt(this.camTarget.x + sx, this.camTarget.y + sy, this.camTarget.z);

    // 阴影光源与地面跟着相机走
    // 光从左后上方照来，影子落在方块右下方（朝向镜头一侧，看得见）
    this.sun.position.set(this.camTarget.x - 6, 13, this.camTarget.z - 3);
    this.sun.target.position.copy(this.camTarget);
    this.ground.position.set(this.camTarget.x, 0, this.camTarget.z);
  }
}
