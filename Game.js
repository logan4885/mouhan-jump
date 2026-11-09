// 游戏主控：渲染器 / 场景 / 正交相机 / 灯光、输入、状态机、计分与落点判定
import * as THREE from 'three';
import { CONFIG } from './config.js?v=20261110c';
import { Storage } from './Storage.js?v=20261110c';
import { Tweens, clamp, Ease } from './utils.js?v=20261110c';
import { SkinManager } from './SkinManager.js?v=20261110c';
import { BlockManager } from './BlockManager.js?v=20261110c';
import { Player } from './Player.js?v=20261110c';
import { UIManager } from './UIManager.js?v=20261110c';
import { Sound } from './Sound.js?v=20261110c';
import { t, L } from './i18n.js?v=20261110c';
import { getPerk } from './canPerks.js?v=20261110c';
import { getSignature, RARITY } from './canSignature.js?v=20261110c';
import { PLAYER_SKINS } from './SkinManager.js?v=20261110c';
import { Music, playSfx } from './SkinAudio.js?v=20261110c';
import { SignatureFX } from './SignatureFX.js?v=20261110c';

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
    if (this.state !== 'ready' || this.ui.blocking) return;
    if (this.player.state !== 'idle' && this.player.state !== 'land') return;
    this.player.state = 'idle'; // 打断落地缓冲动画，立即开始蓄力
    this.state = 'charging';
    this.chargeT = 0;
    this.sound.chargeStart();
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

    // 跳跃方向：从角色当前位置指向下一个方块中心（和原版一样会自动修正横向偏差）
    const p = this.player.root.position;
    let dx = next.x - p.x, dz = next.z - p.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    const lx = p.x + dx * dist, lz = p.z + dz * dist;
    const top = CONFIG.BLOCK_HEIGHT;
    const target = new THREE.Vector3(lx, top, lz);

    // ---------- 落点判定 ----------
    const perk = this.perk;
    let result;
    if (this.blocks.contains(next, lx, lz, perk.edgeGrace)) {
      result = this.blocks.distanceToCenter(next, lx, lz) <= CONFIG.PERFECT_RADIUS * perk.perfectMul ? 'perfect' : 'hit';
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

    this.state = 'jumping';
    this.lastResult = result;
    const opts = { onFallen: () => this._onFallen(), durMul: perk.floatMul };
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
    if (result === 'stay') { this.state = 'ready'; return; }
    const landed = this.blocks.next;
    if (landed && landed.trial) this._startTrial(landed);
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

    // 最高分实时刷新并写入本地
    if (this.score > this.best) {
      this.best = this.score;
      Storage.saveHighScore(this.best);
      this.ui.setBest(this.best);
    }
    this.blocks.advance(this.score);
    this.state = 'ready';
  }

  _onFallen() {
    if (this.state === 'over') return;
    this.state = 'falling';
    this.sound.fall();
    this.shake = 0.25;
    if (this._canRevive()) { this._revive(); return; }
    setTimeout(() => this._gameOver(), 650);
  }

  /* ================= 罐子能力 ================= */
  _refreshPerk() {
    this.perk = getPerk(this.skins.state.player);
    this._updatePerkHud();
  }

  _canRevive() {
    const pk = this.perk;
    if (!pk.revive || this.reviveUsed) return false;
    if (pk.reviveAfter && this.score < pk.reviveAfter) return false;
    return pk.revive === 'any' || String(this.lastResult).startsWith('tip');
  }

  /** 弹回起跳的方块，连击清零，继续游戏 */
  _revive() {
    this.reviveUsed = true;
    this.combo = 0; this.thunderReady = false; this.thunderCount = 0;
    this.ui.setCombo(0);
    this._comboFx();
    this.ui.toast(t('perk_saved', { icon: this.perk.icon, name: L(this.perk.name) }));
    this._updatePerkHud();
    setTimeout(() => {
      if (this.state !== 'falling') return;
      const cur = this.blocks.current;
      this.player.place(cur.x, CONFIG.BLOCK_HEIGHT, cur.z);
      const sq = this.player.squashG.scale;
      this.tweens.add({ duration: 0.35, ease: Ease.outElastic, update: (e) => sq.setScalar(0.3 + 0.7 * e) });
      this.sound.perfect();
      this.state = 'ready';
    }, 550);
  }

  /** 计分板下方的能力状态 */
  _updatePerkHud() {
    const pk = this.perk;
    if (!pk || !pk.id) { this.ui.setPerk(null); return; }
    let status = '';
    if (pk.revive) {
      if (this.reviveUsed) status = t('perk_used');
      else if (pk.reviveAfter && this.score < pk.reviveAfter) status = t('perk_after', { n: pk.reviveAfter });
      else status = t('perk_ready');
    } else if (pk.thunderStreak) {
      status = this.thunderReady ? t('perk_charged') : t('perk_streak', { n: this.thunderCount || 0, m: pk.thunderStreak });
    }
    this.ui.setPerk({ icon: pk.icon, name: L(pk.name), status });
  }

  _gameOver() {
    this.state = 'over';
    this._endTrial(false);
    this._stopMusic(0.9);
    const record = this.score > this.bestAtStart;
    Storage.saveHighScore(this.score);
    this.best = Storage.getHighScore();
    const stats = Storage.getStats();
    stats.games = (stats.games || 0) + 1;
    stats.perfects = (stats.perfects || 0) + this.perfects;
    Storage.saveStats(stats);
    const unlocked = this.skins.checkUnlocks(this.best);
    this.ui.showGameOver({ score: this.score, best: this.best, record, perfects: this.perfects, unlocked });
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
    if (this.state === 'menu' || this.trial || this._trialsThisRound >= 3 || !this._trialSkin()) return false;
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
    this.blocks.reset();
    this.player.place(0, CONFIG.BLOCK_HEIGHT, 0);
    this.score = 0; this.combo = 0; this.perfects = 0; this.chargeT = 0;
    this.reviveUsed = false; this.thunderReady = false; this.thunderCount = 0; this.lastResult = null;
    if (this.skins) this._refreshPerk();
    this.ui && (this.ui.setScore(0), this.ui.setCombo(0), this.ui.hideCharge());
    this._comboFx();
    this.fx && this.fx.clear();
    this._updateCamGoal();
    this.camTarget.copy(this.camGoal);
  }

  startRound() {
    this.ui.hideGameOver();
    this.reset();
    this.bestAtStart = this.best;
    this.stopPreview();
    this._endTrial(false);
    this._sinceTrial = 3; this._trialsThisRound = 0;
    this.ui.setBest(this.best);
    this.ui.hideStart();
    this._startMusic();
    this.state = 'ready';
  }

  goHome() {
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
    return { x: (v.x + 1) / 2 * this.viewW, y: (1 - v.y) / 2 * this.viewH };
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
    this._autoPlay(dt);

    if (this.state === 'charging') {
      this.chargeT = Math.min(CONFIG.CHARGE_MAX_TIME, this.chargeT + dt * this.perk.chargeMul);
      const k = this.chargeT / CONFIG.CHARGE_MAX_TIME;
      const cur = this.blocks.current;
      this.blocks.squash(cur, k);
      this.player.charge(k, this.blocks.topY(cur));
      this.ui.showCharge(k);
    } else if (this.state === 'ready' && this.player.state === 'idle') {
      // 方块回弹时角色跟着顶面上下
      this.player.root.position.y = this.blocks.topY(this.blocks.current);
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

    // 相机平滑跟随
    if (this.state !== 'jumping') this._updateCamGoal();
    this.camTarget.lerp(this.camGoal, 1 - Math.exp(-CONFIG.CAM_LERP * dt));
    const o = CONFIG.CAM_OFFSET;
    let sx = 0, sy = 0;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      sx = (Math.random() - 0.5) * this.shake * 0.8; sy = (Math.random() - 0.5) * this.shake * 0.8;
    }
    this.camera.position.set(this.camTarget.x + o[0] + sx, this.camTarget.y + o[1] + sy, this.camTarget.z + o[2]);
    this.camera.lookAt(this.camTarget.x + sx, this.camTarget.y + sy, this.camTarget.z);

    // 阴影光源与地面跟着相机走
    // 光从左后上方照来，影子落在方块右下方（朝向镜头一侧，看得见）
    this.sun.position.set(this.camTarget.x - 6, 13, this.camTarget.z - 3);
    this.sun.target.position.copy(this.camTarget);
    this.ground.position.set(this.camTarget.x, 0, this.camTarget.z);
  }
}
