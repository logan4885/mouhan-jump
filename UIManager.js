// UI 层：开始界面、计分板、蓄力条、飘字、结算弹窗、皮肤商店（含兑换码）、排行榜、语言切换
import { PLAYER_SKINS, BLOCK_STYLES, SkinPreview } from './SkinManager.js?v=20261110c';
import { fetchTop, fetchPlayer, syncPlayer, buildBoard, LEADERBOARD_API } from './Leaderboard.js?v=20261110c';
import { Storage } from './Storage.js?v=20261110c';
import { escapeHtml } from './utils.js?v=20261110c';
import { t, L, setLang, getLang, onLangChange, applyStatic } from './i18n.js?v=20261110c';
import { PERKS } from './canPerks.js?v=20261110c';
import { SIGNATURE, RARITY, getSignature } from './canSignature.js?v=20261110c';
import { SHOP } from './shop.js?v=20261110c';
import { recoveryAvailable, makeCode, makeLink, restore } from './Recovery.js?v=20261110c';
import { accountAvailable, PROVIDER_NAME, completeLogin, renderGoogleButton, prepareFacebook, facebookLogin, logout } from './Account.js?v=20261110c';
import { AUTH } from './authConfig.js?v=20261110c';

const $ = (id) => document.getElementById(id);

export class UIManager {
  /**
   * @param {object} handlers { onStart, onRestart, onHome }
   * @param {import('./SkinManager.js?v=20261110c').SkinManager} skins
   */
  constructor(handlers, skins) {
    this.h = handlers;
    this.skins = skins;
    this.el = {
      hud: $('hud'), score: $('score'), best: $('best'), combo: $('combo'),
      charge: $('charge'), chargeFill: $('chargeFill'), popups: $('popups'),
      start: $('start'), startBest: $('startBest'),
      over: $('overModal'), overScore: $('overScore'), overLine: $('overLine'), overRecord: $('overRecord'),
      overUnlocked: $('overUnlocked'), nick: $('nickInput'),
      skin: $('skinModal'), skinGrid: $('skinGrid'), skinName: $('skinName'), skinDesc: $('skinDesc'), skinPerk: $('skinPerk'), perk: $('perk'), useSkin: $('btnUseSkin'),
      redeemForm: $('redeemForm'), redeemInput: $('redeemInput'), redeemMsg: $('redeemMsg'),
      player: $('playerModal'), playerBody: $('playerBody'),
      rank: $('rankModal'), rankList: $('rankList'), rankMine: $('rankMine'), rankNote: $('rankNote'),
      toast: $('toast'), sig: $('skinSig'), trial: $('trialBar'), trialText: $('trialText'), trialCta: $('trialCta'),
      overVip: $('overVip'), overVipText: $('overVipText'), overVipLeft: $('overVipLeft'), vipCode: $('btnVipCode'), vipBuy: $('btnVipBuy'), fxBtn: $('btnFxPreview'), mute: $('btnMute'),
    };
    this.fxOn = false;
    this.skinTab = 'player';
    this.skinPick = null;
    this.preview = null;
    this.combo = 0;
    this.lastOver = null;
    applyStatic();
    this._bind();
    this.el.nick.value = Storage.getNickname();
    this._initAvatar();
    onLangChange(() => this._refreshLang());
  }

  _bind() {
    $('btnStart').addEventListener('click', () => this.h.onStart());
    $('btnRestart').addEventListener('click', () => { this._saveNick(); this.h.onRestart(); });
    $('btnHome').addEventListener('click', () => { this._saveNick(); this.h.onHome(); });
    ['btnSkinsStart', 'btnSkinsOver'].forEach((id) => $(id).addEventListener('click', () => { this._saveNick(); this.openSkins(); }));
    ['btnRankStart', 'btnRankOver'].forEach((id) => $(id).addEventListener('click', () => { this._saveNick(); this.openRank(); }));
    this.el.nick.addEventListener('change', () => this._saveNick());
    // 点击排行榜里的头像 / 名字，查看这位玩家解锁的皮肤
    const onRow = (e) => {
      const li = e.target.closest('li[data-rid]');
      if (li && this._rankRows && this._rankRows[li.dataset.rid]) this.openPlayer(this._rankRows[li.dataset.rid]);
    };
    [this.el.rankList, this.el.rankMine].forEach((ol) => {
      ol.addEventListener('click', onRow);
      ol.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRow(e); } });
    });
    document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));

    // 关闭按钮 / 点击遮罩关闭
    document.querySelectorAll('.modal-wrap').forEach((wrap) => {
      wrap.addEventListener('click', (e) => {
        if (wrap.id === 'overModal') return; // 结算弹窗只能通过按钮离开
        if (e.target === wrap || e.target.closest('[data-close]')) this._closeModal(wrap);
      });
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // 玩家详情盖在排行榜上面：先只关详情
        if (!this.el.player.classList.contains('hidden')) { this._closeModal(this.el.player); return; }
        [this.el.skin, this.el.rank].forEach((w) => { if (!w.classList.contains('hidden')) this._closeModal(w); });
      }
    });

    // 皮肤 tab
    this.el.skin.querySelectorAll('[data-tab]').forEach((tab) => tab.addEventListener('click', () => {
      this.skinTab = tab.dataset.tab;
      this.el.skin.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x === tab));
      this.skinPick = this.skins.state[this.skinTab];
      this._stopFx();
      this._renderSkins();
    }));
    this.el.skinGrid.addEventListener('click', (e) => {
      const card = e.target.closest('[data-skin]'); if (!card) return;
      this.skinPick = card.dataset.skin;
      this._stopFx();
      this._renderSkins();
    });
    this.el.mute.addEventListener('click', () => this.h.onMute && this.h.onMute());
    // 结算页 / 体验结束的“激活 VIP Code”：直接打开商店并聚焦兑换码输入框
    const goCode = () => { this._saveNick(); this.openSkins(); setTimeout(() => this.el.redeemInput.focus({ preventScroll: true }), 80); };
    this.el.vipCode.addEventListener('click', goCode);
    this.el.trialCta.addEventListener('click', () => { this.hideTrial(); goCode(); });
    this.el.fxBtn.addEventListener('click', () => {
      if (this.fxOn) { this._stopFx(); return; }
      if (this.h.onPreviewFx && this.h.onPreviewFx(this.skinPick)) { this.fxOn = true; this._syncFxBtn(); }
    });
    this.el.useSkin.addEventListener('click', () => {
      if (this.skins.select(this.skinTab, this.skinPick)) { this.toast(t('equipped')); this._renderSkins(); }
    });

    // 兑换码
    this.el.redeemForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this._redeem(this.el.redeemInput.value);
    });
    window.addEventListener('resize', () => { if (this.preview && !this.el.skin.classList.contains('hidden')) this.preview.resize(); });
    this._initBackup();
  }

  /* ---------- 账号登录（Google / Facebook，可选） ---------- */
  _initAccount(box) {
    const wrap = $('acctBox');
    if (!accountAvailable()) { wrap.classList.add('hidden'); return; }
    const msg = $('acctMsg');
    const say = (text, cls = '') => { msg.textContent = text; msg.className = 'redeem-msg ' + cls; };
    const finish = async (provider, token) => {
      say('…');
      const r = await completeLogin(provider, token);
      if (r.status === 'ok') { say(t('ac_ok'), 'ok'); setTimeout(() => location.reload(), 900); return; }
      say(t('ac_' + r.status), 'err');
    };
    this._renderAccount = () => {
      const acc = Storage.getAccount();
      $('acctOut').classList.toggle('hidden', !!acc);
      $('acctIn').classList.toggle('hidden', !acc);
      if (acc) $('acctName').textContent = t('ac_in', { name: acc.name || '—', p: PROVIDER_NAME[acc.provider] || acc.provider });
    };
    this._renderAccount();
    $('authFb').classList.toggle('hidden', !AUTH.facebookAppId);
    let prepared = false;
    box.addEventListener('toggle', () => {       // 展开时才加载第三方脚本，不拖慢游戏启动
      if (!box.open || prepared || Storage.getAccount()) return;
      prepared = true;
      if (AUTH.googleClientId) renderGoogleButton($('authGoogle'), getLang(), (tok) => finish('google', tok)).catch(() => say(t('ac_net'), 'err'));
      if (AUTH.facebookAppId) prepareFacebook().catch(() => { /* 点击时再提示 */ });
    });
    $('authFb').addEventListener('click', () => { if (!facebookLogin((tok) => finish('facebook', tok))) say(t('ac_net'), 'err'); });
    $('acctLogout').addEventListener('click', () => { if (window.confirm(t('ac_logout_q'))) { logout(); location.reload(); } });
  }

  /* ---------- 备份 / 恢复进度 ---------- */
  _initBackup() {
    const box = $('backupBox');
    $('btnAcctStart').addEventListener('click', () => { this._saveNick(); box.open = true; this.openSkins(); setTimeout(() => box.scrollIntoView({ block: 'center' }), 120); });
    if (!recoveryAvailable()) { box.classList.add('hidden'); $('btnAcctStart').classList.add('hidden'); return; }
    this._initAccount(box);
    const input = $('bkInput'), msg = $('bkMsg');
    const say = (text, cls = '') => { msg.textContent = text; msg.className = 'redeem-msg ' + cls; };
    const copy = async (text) => {
      try { await navigator.clipboard.writeText(text); say(t('bk_copied'), 'ok'); }
      catch (e) { input.value = text; input.focus(); input.select(); say(t('bk_manual')); }
    };
    $('bkCopy').addEventListener('click', () => copy(makeCode()));
    $('bkLink').addEventListener('click', () => copy(makeLink()));
    $('bkForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button'); btn.disabled = true;
      const r = await restore(input.value);
      btn.disabled = false;
      if (r.status === 'ok') { say(t('bk_ok'), 'ok'); setTimeout(() => location.reload(), 900); return; }
      say(t('bk_' + r.status), 'err');
    });
    // 通过“恢复链接”打开：自动展开并填好，让玩家点一下确认（不会自动覆盖本机进度）
    const m = location.hash.match(/^#restore=(.+)$/i);
    if (m) {
      input.value = m[1];
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* 忽略 */ }
      setTimeout(() => { box.open = true; this.openSkins(); say(t('bk_found')); }, 400);
    }
  }

  /** 是否有弹窗 / 菜单遮挡（遮挡时不响应游戏操作） */
  get blocking() {
    return !this.el.start.classList.contains('hidden') ||
      [this.el.over, this.el.skin, this.el.rank, this.el.player].some((w) => !w.classList.contains('hidden'));
  }

  /** 切换语言后，刷新所有由 JS 生成的文字 */
  _refreshLang() {
    this.setCombo(this.combo);
    if (this.lastOver) this._fillGameOver(this.lastOver);
    if (!this.el.skin.classList.contains('hidden')) this._renderSkins();
    if (!this.el.rank.classList.contains('hidden')) this.openRank();
    if (!this.el.player.classList.contains('hidden')) this._closeModal(this.el.player);
    this.el.redeemMsg.textContent = '';
    if (this._renderAccount) this._renderAccount();
  }

  /* ---------- 开始 / HUD ---------- */
  showStart(best) {
    this.el.startBest.textContent = best;
    this.el.start.classList.remove('hidden');
    this.el.hud.classList.add('hidden');
  }
  hideStart() { this.el.start.classList.add('hidden'); this.el.hud.classList.remove('hidden'); }

  setScore(score) {
    this.el.score.textContent = score;
    this.el.score.classList.remove('bump'); void this.el.score.offsetWidth; this.el.score.classList.add('bump');
  }
  setBest(best) { this.el.best.textContent = best; }
  setCombo(n) {
    this.combo = n;
    this.el.combo.classList.toggle('hidden', n < 2);
    if (n >= 2) this.el.combo.textContent = t('combo', { n });
  }

  /** 计分板下的能力徽章：{ icon, name, status }；null 表示隐藏 */
  setPerk(p) {
    this.el.perk.classList.toggle('hidden', !p);
    if (p) this.el.perk.textContent = `${p.icon} ${p.name}${p.status ? ' · ' + p.status : ''}`;
  }

  /* ---------- 蓄力条 ---------- */
  showCharge(k) {
    this.el.charge.classList.remove('hidden');
    this.el.chargeFill.style.transform = `scaleX(${k.toFixed(3)})`;
    this.el.chargeFill.style.background = k < 0.95 ? '' : '#ff4d5e';
  }
  hideCharge() { this.el.charge.classList.add('hidden'); this.el.chargeFill.style.transform = 'scaleX(0)'; }

  /* ---------- 试驾体验条（踩中 24K 星号方块） ---------- */
  showTrial(name, sec) {
    clearTimeout(this._trialT);
    const b = this.el.trial;
    this.el.trialText.textContent = t('trial_on', { name });
    this.el.trialCta.classList.add('hidden');
    b.classList.remove('hidden', 'ended');
    b.style.setProperty('--sec', sec + 's');
    b.classList.remove('run'); void b.offsetWidth; b.classList.add('run');
  }
  hideTrial() { clearTimeout(this._trialT); this.el.trial.classList.add('hidden'); this.el.trial.classList.remove('run', 'ended'); }
  /** 体验结束：给一个“落差”提示和直达兑换码的按钮 */
  showTrialEnd(name) {
    clearTimeout(this._trialT);
    const b = this.el.trial;
    this.el.trialText.textContent = t('trial_end', { name });
    this.el.trialCta.textContent = t('trial_cta');
    this.el.trialCta.classList.remove('hidden');
    b.classList.remove('hidden', 'run'); b.classList.add('ended');
    this._trialT = setTimeout(() => this.hideTrial(), 4500);
  }

  /* ---------- 结算页：高分时的身份提示（只用真实名次，不编造数据） ---------- */
  _hideVipHint() {
    clearInterval(this._offerT);
    this.el.overVip.classList.add('hidden');
  }

  async _vipHint(score) {
    this._hideVipHint();
    if (this.skins.isVip || !LEADERBOARD_API.baseUrl || Storage.getHighScore() <= 0) return; // 看的是历史最高分的名次，这一局得 0 分也照样提示
    const token = (this._vipTok = (this._vipTok || 0) + 1);
    await syncPlayer();
    const p = await fetchPlayer(Storage.getPlayer().id);
    if (token !== this._vipTok || !p || this.el.over.classList.contains('hidden')) return;
    const total = p.totalPlayers || 0;
    const pct = total >= 20 ? Math.floor(((total - p.rank) / total) * 100) : 0;
    let html = '';
    if (p.rank <= 10) html = t('vip_warn', { score: Number(p.score), rank: Number(p.rank) });
    else if (pct >= 80) html = t('vip_beat', { pct }) + '<br>' + escapeHtml(t('vip_locked'));
    else return;
    this.el.overVipText.innerHTML = html;
    this.el.vipCode.textContent = t('vip_code');
    this.el.vipBuy.textContent = t('vip_buy');
    this.el.vipBuy.href = SHOP.buyUrl;
    // 只有填写了真实截止时间才显示倒计时
    const end = SHOP.offerEndsAt ? Date.parse(SHOP.offerEndsAt) : NaN;
    const left = this.el.overVipLeft;
    if (isFinite(end) && end > Date.now()) {
      const fmt = () => {
        const ms = Math.max(0, end - Date.now()), d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, sec = Math.floor(ms / 1e3) % 60;
        const pad = (n) => String(n).padStart(2, '0');
        left.textContent = t('vip_left', { t: (d ? d + 'd ' : '') + `${pad(h)}:${pad(m)}:${pad(sec)}` });
        if (ms <= 0) { clearInterval(this._offerT); left.classList.add('hidden'); }
      };
      fmt(); left.classList.remove('hidden');
      this._offerT = setInterval(fmt, 1000);
    } else left.classList.add('hidden');
    this.el.overVip.classList.remove('hidden');
  }

  /** 专属飘字（稀有度越高越大） */
  popWord(text, x, y, color, rarity) {
    const d = document.createElement('div');
    d.className = 'pop word ' + (rarity || '');
    d.textContent = text;
    d.style.left = x + 'px'; d.style.top = y + 'px';
    if (color) d.style.setProperty('--wc', color);
    this.el.popups.appendChild(d);
    setTimeout(() => d.remove(), 1100);
  }

  _stopFx() {
    if (!this.fxOn) return;
    this.fxOn = false;
    this.h.onStopFx && this.h.onStopFx();
    this._syncFxBtn();
  }
  _syncFxBtn() { this.el.fxBtn.textContent = t(this.fxOn ? 'fx_stop' : 'fx_preview'); this.el.fxBtn.classList.toggle('playing', this.fxOn); }

  /** 得分飘字（屏幕坐标） */
  popScore(text, x, y, perfect) {
    const d = document.createElement('div');
    d.className = 'pop' + (perfect ? ' perfect' : '');
    d.textContent = text;
    d.style.left = x + 'px'; d.style.top = y + 'px';
    this.el.popups.appendChild(d);
    setTimeout(() => d.remove(), 1000);
  }

  /* ---------- 结算 ---------- */
  showGameOver(data) {
    this.lastOver = data;
    this._fillGameOver(data);
    this._vipHint(data.score);
    this.el.hud.classList.add('hidden');
    this._openModal(this.el.over);
    setTimeout(() => $('btnRestart').focus({ preventScroll: true }), 50);
  }
  _fillGameOver({ score, best, record, perfects, unlocked }) {
    this.el.overScore.textContent = score;
    this.el.overLine.innerHTML = t('over_line', { best: Number(best), p: Number(perfects) });
    this.el.overRecord.classList.toggle('hidden', !record);
    if (unlocked && unlocked.length) {
      this.el.overUnlocked.innerHTML = escapeHtml(t('unlocked_new')) + unlocked.map((s) => `<b>${escapeHtml(L(s.name))}</b>`).join(escapeHtml(t('sep')));
      this.el.overUnlocked.classList.remove('hidden');
    } else this.el.overUnlocked.classList.add('hidden');
  }
  hideGameOver() { this._hideVipHint(); this._vipTok = (this._vipTok || 0) + 1; this._closeModal(this.el.over); this.lastOver = null; }

  /** 动物头像：点一下展开，选一个就存（会自动同步到服务器，排行榜每行都显示它） */
  _initAvatar() {
    const AV = ['🐯', '🦊', '🐱', '🐼', '🐸', '🐵', '🐰', '🐻', '🦁', '🐨', '🐙', '🦄', '🐧', '🐶', '🦒', '🐘', '🐢', '🦉', '🐬', '🐳', '🦋', '🐝', '🐞', '🦖',
      '🐷', '🐮', '🐹', '🐭', '🐔', '🐤', '🦆', '🦅', '🦇', '🐺', '🐗', '🐴', '🐍', '🦎', '🐊', '🐟', '🐠', '🦈', '🦀', '🦞', '🐌', '🦓', '🦘', '🦔', '🦜', '🦚'];
    const cur = $('avatarCur'); const grid = $('avatarGrid');
    grid.innerHTML = AV.map((a) => `<button type="button" role="option" data-a="${a}">${a}</button>`).join('');
    const paint = () => {
      const a = Storage.getAvatar();
      cur.textContent = a || '🙂';
      grid.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.a === a));
    };
    cur.addEventListener('click', () => { const open = grid.classList.toggle('hidden') === false; cur.setAttribute('aria-expanded', String(open)); });
    grid.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-a]');
      if (!b) return;
      Storage.setAvatar(b.dataset.a);
      grid.classList.add('hidden'); cur.setAttribute('aria-expanded', 'false');
      paint();
    });
    Storage.onChange((k) => { if (k === 'avatar') paint(); });
    paint();
    this._paintAvatar = paint;
  }

  _saveNick() { Storage.setNickname(this.el.nick.value.trim()); }

  /* ---------- 皮肤商店 ---------- */
  openSkins() {
    this.skinPick = this.skins.state[this.skinTab];
    this.el.redeemMsg.textContent = '';
    this.el.redeemMsg.className = 'redeem-msg';
    this._openModal(this.el.skin);
    if (!this.preview) {
      try { this.preview = new SkinPreview($('skinPreview')); } catch (e) { this.preview = null; }
    }
    this._renderSkins();
  }

  _lockInfo(kind, s) {
    if (kind === 'player') return s.unlock === 'code' ? { badge: t('lock_code'), need: t('need_code') } : { badge: '', need: '' };
    return { badge: t('lock_score', { n: s.unlockScore }), need: t('need_score', { n: s.unlockScore, best: Storage.getHighScore() }) };
  }

  _renderSkins() {
    const kind = this.skinTab;
    const list = kind === 'player' ? PLAYER_SKINS : BLOCK_STYLES;
    const current = this.skins.state[kind];
    this.el.skinGrid.innerHTML = list.map((s) => {
      const unlocked = this.skins.isUnlocked(kind, s.id);
      const cls = ['skin-card', s.id === this.skinPick ? 'picked' : '', unlocked ? '' : 'locked'].join(' ');
      const badge = s.id === current ? `<i class="tag-on">${escapeHtml(t('using'))}</i>`
        : unlocked ? '' : `<i class="tag-lock">${escapeHtml(this._lockInfo(kind, s).badge)}</i>`;
      const icon = kind === 'player'
        ? `<span class="can-icon${s.effect ? ' fx' : ''}" style="--c:${escapeHtml(s.body)};--a:${escapeHtml(s.accent)};--l:${escapeHtml(s.lid || '#cfd3dc')}"></span>`
        : `<span class="skin-icon ${kind}-${s.id}"></span>`;
      const sg = kind === 'player' ? SIGNATURE[s.id] : null;
      const dot = sg ? `<i class="rar-dot rar-${sg.rarity}"></i>` : '';
      return `<button class="${cls}" data-skin="${s.id}">${dot}${icon}<span class="skin-label">${escapeHtml(L(s.name))}</span>${badge}</button>`;
    }).join('');
    this.el.skinGrid.style.gridTemplateColumns = `repeat(${list.length <= 4 ? list.length : 3}, 1fr)`;
    const pick = list.find((s) => s.id === this.skinPick) || list[0];
    const unlocked = this.skins.isUnlocked(kind, pick.id);
    this.el.skinName.textContent = L(pick.name);
    this.el.skinDesc.textContent = unlocked ? L(pick.desc) : this._lockInfo(kind, pick).need;
    const perk = kind === 'player' ? PERKS[pick.id] : null;
    this.el.skinPerk.classList.toggle('hidden', kind !== 'player');
    this.el.skinPerk.textContent = perk ? `${perk.icon} ${t('perk_label')}：${L(perk.name)} — ${L(perk.desc)}` : t('perk_none');
    const sg = kind === 'player' ? getSignature(pick.id) : null;
    this.el.sig.classList.toggle('hidden', !sg);
    this.el.fxBtn.classList.toggle('hidden', !sg);
    if (sg) {
      const r = RARITY[sg.rarity];
      this.el.sig.innerHTML = `<b class="rar-chip rar-${sg.rarity}">${escapeHtml(L(r.name))}</b> ${escapeHtml(t('sig_label'))}：${escapeHtml(L(sg.desc))}`;
    }
    this._syncFxBtn();
    const using = pick.id === current;
    this.el.useSkin.disabled = !unlocked || using;
    this.el.useSkin.textContent = using ? t('using') : unlocked ? t('use') : t('locked');
    // 兑换码只用于易拉罐
    this.el.redeemForm.classList.toggle('hidden', kind !== 'player');
    this.el.redeemMsg.classList.toggle('hidden', kind !== 'player');
    if (this.preview) this.preview.show(kind, pick.id);
  }

  _redeem(code) {
    const res = this.skins.redeem(code);
    const names = res.skins.map((s) => L(s.name)).join(t('sep'));
    const msg = {
      ok: t('redeem_ok', { name: names }), have: t('redeem_have', { name: names }),
      bad: t('redeem_bad'), empty: t('redeem_empty'), used: t('redeem_used'), none: t('redeem_none'), reset: t('redeem_reset'),
    }[res.status];
    this.el.redeemMsg.textContent = msg;
    this.el.redeemMsg.className = 'redeem-msg ' + (res.status === 'ok' ? 'ok' : (res.status === 'have' || res.status === 'none' || res.status === 'reset') ? '' : 'err');
    if (res.status === 'reset') { this.el.redeemInput.value = ''; this.skinTab = 'player'; this.skinPick = this.skins.state.player; this._renderSkins(); this.toast(msg); }
    if (res.status === 'ok') {
      this.el.redeemInput.value = '';
      this.skinTab = 'player';
      this.skinPick = res.skins[0].id;
      this._renderSkins();
      this.toast(msg);
    }
  }

  /* ---------- 排行榜 ---------- */
  async openRank() {
    this._openModal(this.el.rank);
    this.el.rankList.innerHTML = `<li class="loading">${escapeHtml(t('loading'))}</li>`;
    this.el.rankMine.innerHTML = '';
    const live = !!LEADERBOARD_API.baseUrl;
    if (live) await syncPlayer(); // 先把我最新的数据传上去，榜单里才有最新的我
    const data = await fetchTop(10);
    const meId = Storage.getPlayer().id;
    const me = { id: meId, nickname: Storage.getNickname() || t('me'), score: Storage.getHighScore() };
    const { top, mine } = buildBoard(Array.isArray(data) ? data : [], me, 10);
    let mineRow = mine;
    if (live && !mineRow && me.score > 0 && !top.some((r) => r.isMe)) {
      const p = await fetchPlayer(meId); // 我不在前 10：向服务器问我的真实名次
      if (p) mineRow = { id: p.id, nickname: p.nickname, avatar: p.avatar, color: p.color, score: p.score, rank: p.rank, isMe: true };
    }
    this._rankRows = {};
    const row = (r) => {
      // Mock 数据里的别人没有皮肤信息，不可点击；真实后端的每一行、以及“我”都可点击
      const clickable = r.isMe || live;
      if (clickable) this._rankRows[r.id] = r;
      const medal = r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank;
      const avatar = r.avatarUrl
        ? `<img class="avatar" src="${escapeHtml(r.avatarUrl)}" alt="">`
        : `<span class="avatar" style="background:${escapeHtml(r.color || '#ddd')}">${escapeHtml(r.avatar || '🙂')}</span>`;
      const attrs = clickable ? ` data-rid="${escapeHtml(r.id)}" tabindex="0" role="button" aria-label="${escapeHtml(t('pl_view'))}"` : '';
      const vip = r.isMe ? this.skins.isVip : !!r.vip;
      const tag = vip ? `<b class="owner-badge">${escapeHtml(t('owner'))}</b>` : `<i class="guest-tag">${escapeHtml(t('guest'))}</i>`;
      return `<li class="${r.isMe ? 'me' : ''}${vip ? ' vip' : ' guest'}${clickable ? ' clickable' : ''}"${attrs}><span class="rk">${medal}</span>${avatar}<span class="nm"><bdi>${escapeHtml(r.nickname)}</bdi>${r.isMe ? ` <em>(${escapeHtml(t('me'))})</em>` : ''}<br>${tag}</span><span class="sc">${r.score}</span>${clickable ? '<span class="chev" aria-hidden="true">›</span>' : ''}</li>`;
    };
    this.el.rankList.innerHTML = top.map(row).join('');
    this.el.rankMine.innerHTML = mineRow ? `<ol class="rank-list">${row(mineRow)}</ol>` : '';
    this.el.rankNote.textContent = live ? t('rank_live') + ' · ' + t('pl_tip') : t('rank_mock');
  }

  /** 点开某位玩家：展示头像、名次、已解锁皮肤和正在使用的皮肤 */
  async openPlayer(r) {
    this._openModal(this.el.player);
    this.el.playerBody.innerHTML = `<p class="loading-line">${escapeHtml(t('loading'))}</p>`;
    let info;
    if (r.isMe) {
      const sk = Storage.getSkinState();
      const st = Storage.getStats();
      info = { nickname: Storage.getNickname() || t('me'), avatar: r.avatar, color: r.color, score: Storage.getHighScore(), rank: r.rank,
        perfects: st.perfects || 0, games: st.games || 0, unlocked: sk.unlocked, equipped: 'player:' + sk.player };
    } else {
      info = await fetchPlayer(r.id);
    }
    if (this.el.player.classList.contains('hidden')) return; // 加载期间已关闭
    if (!info) { this.el.playerBody.innerHTML = `<p class="loading-line">${escapeHtml(t('pl_fail'))}</p>`; return; }

    const have = new Set(info.unlocked || []);
    const cans = PLAYER_SKINS;
    const owned = cans.filter((s) => have.has('player:' + s.id)).length;
    const eq = cans.find((s) => 'player:' + s.id === info.equipped) || cans[0];
    const perk = PERKS[eq.id];
    const avatar = info.avatarUrl
      ? `<img class="avatar big" src="${escapeHtml(info.avatarUrl)}" alt="">`
      : `<span class="avatar big" style="background:${escapeHtml(info.color || '#ddd')}">${escapeHtml(info.avatar || '🙂')}</span>`;
    const cell = (s) => {
      const on = have.has('player:' + s.id);
      const isEq = s.id === eq.id;
      return `<li class="pcan${on ? '' : ' off'}${isEq ? ' eq' : ''}" title="${escapeHtml(L(s.name))}">
        <span class="can-sw" style="--b:${escapeHtml(s.body)};--a:${escapeHtml(s.accent)}"></span>
        <span class="pn">${on ? escapeHtml(L(s.name)) : '🔒'}</span>${isEq ? `<em class="tag-on">${escapeHtml(t('using'))}</em>` : ''}</li>`;
    };
    this.el.playerBody.innerHTML = `
      <div class="pl-head">${avatar}
        <div class="pl-name"><bdi>${escapeHtml(info.nickname)}</bdi>${r.isMe ? ` <em>(${escapeHtml(t('me'))})</em>` : ''}</div>
        <div class="pl-stats">${escapeHtml(t('pl_stats', { r: info.rank || '-', s: info.score }))}</div>
        <div class="pl-stats">${escapeHtml(t('pl_stats2', { p: info.perfects || 0, g: info.games || 0 }))}</div>
      </div>
      <div class="pl-eq"><span class="can-sw lg" style="--b:${escapeHtml(eq.body)};--a:${escapeHtml(eq.accent)}"></span>
        <div><div class="pl-eq-t">${escapeHtml(t('pl_equipped'))}</div><b>${escapeHtml(L(eq.name))}</b>
        <div class="pl-perk">${perk ? escapeHtml(perk.icon + ' ' + L(perk.name)) : escapeHtml(t('perk_none'))}</div></div></div>
      <h3 class="pl-sub">${escapeHtml(t('pl_unlocked', { n: owned, m: cans.length }))}</h3>
      <ul class="pcan-grid">${cans.map(cell).join('')}</ul>`;
  }

  /* ---------- 通用 ---------- */
  _openModal(wrap) { wrap.classList.remove('hidden'); }
  _closeModal(wrap) {
    wrap.classList.add('hidden');
    if (wrap === this.el.skin) this._stopFx();
    if (wrap === this.el.skin && this.preview) this.preview.stop();
  }

  toast(msg) {
    const el = this.el.toast;
    el.textContent = msg; el.classList.add('on');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => el.classList.remove('on'), 1800);
  }
}
