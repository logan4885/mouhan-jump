// UI 层：开始界面、计分板、蓄力条、飘字、结算弹窗、皮肤商店（含兑换码）、排行榜、语言切换
import { PLAYER_SKINS, BLOCK_STYLES, SkinPreview } from './SkinManager.js';
import { fetchTop, buildBoard, LEADERBOARD_API } from './Leaderboard.js';
import { Storage } from './Storage.js';
import { escapeHtml } from './utils.js';
import { t, L, setLang, onLangChange, applyStatic } from './i18n.js';
import { PERKS } from './canPerks.js';

const $ = (id) => document.getElementById(id);

export class UIManager {
  /**
   * @param {object} handlers { onStart, onRestart, onHome }
   * @param {import('./SkinManager.js').SkinManager} skins
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
      rank: $('rankModal'), rankList: $('rankList'), rankMine: $('rankMine'), rankNote: $('rankNote'),
      toast: $('toast'),
    };
    this.skinTab = 'player';
    this.skinPick = null;
    this.preview = null;
    this.combo = 0;
    this.lastOver = null;
    applyStatic();
    this._bind();
    this.el.nick.value = Storage.getNickname();
    onLangChange(() => this._refreshLang());
  }

  _bind() {
    $('btnStart').addEventListener('click', () => this.h.onStart());
    $('btnRestart').addEventListener('click', () => { this._saveNick(); this.h.onRestart(); });
    $('btnHome').addEventListener('click', () => { this._saveNick(); this.h.onHome(); });
    ['btnSkinsStart', 'btnSkinsOver'].forEach((id) => $(id).addEventListener('click', () => { this._saveNick(); this.openSkins(); }));
    ['btnRankStart', 'btnRankOver'].forEach((id) => $(id).addEventListener('click', () => { this._saveNick(); this.openRank(); }));
    this.el.nick.addEventListener('change', () => this._saveNick());
    document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));

    // 关闭按钮 / 点击遮罩关闭
    document.querySelectorAll('.modal-wrap').forEach((wrap) => {
      wrap.addEventListener('click', (e) => {
        if (wrap.id === 'overModal') return; // 结算弹窗只能通过按钮离开
        if (e.target === wrap || e.target.closest('[data-close]')) this._closeModal(wrap);
      });
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') [this.el.skin, this.el.rank].forEach((w) => { if (!w.classList.contains('hidden')) this._closeModal(w); });
    });

    // 皮肤 tab
    this.el.skin.querySelectorAll('[data-tab]').forEach((tab) => tab.addEventListener('click', () => {
      this.skinTab = tab.dataset.tab;
      this.el.skin.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x === tab));
      this.skinPick = this.skins.state[this.skinTab];
      this._renderSkins();
    }));
    this.el.skinGrid.addEventListener('click', (e) => {
      const card = e.target.closest('[data-skin]'); if (!card) return;
      this.skinPick = card.dataset.skin;
      this._renderSkins();
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
  }

  /** 是否有弹窗 / 菜单遮挡（遮挡时不响应游戏操作） */
  get blocking() {
    return !this.el.start.classList.contains('hidden') ||
      [this.el.over, this.el.skin, this.el.rank].some((w) => !w.classList.contains('hidden'));
  }

  /** 切换语言后，刷新所有由 JS 生成的文字 */
  _refreshLang() {
    this.setCombo(this.combo);
    if (this.lastOver) this._fillGameOver(this.lastOver);
    if (!this.el.skin.classList.contains('hidden')) this._renderSkins();
    if (!this.el.rank.classList.contains('hidden')) this.openRank();
    this.el.redeemMsg.textContent = '';
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
  hideGameOver() { this._closeModal(this.el.over); this.lastOver = null; }

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
      return `<button class="${cls}" data-skin="${s.id}">${icon}<span class="skin-label">${escapeHtml(L(s.name))}</span>${badge}</button>`;
    }).join('');
    this.el.skinGrid.style.gridTemplateColumns = `repeat(${list.length <= 4 ? list.length : 3}, 1fr)`;
    const pick = list.find((s) => s.id === this.skinPick) || list[0];
    const unlocked = this.skins.isUnlocked(kind, pick.id);
    this.el.skinName.textContent = L(pick.name);
    this.el.skinDesc.textContent = unlocked ? L(pick.desc) : this._lockInfo(kind, pick).need;
    const perk = kind === 'player' ? PERKS[pick.id] : null;
    this.el.skinPerk.classList.toggle('hidden', kind !== 'player');
    this.el.skinPerk.textContent = perk ? `${perk.icon} ${t('perk_label')}：${L(perk.name)} — ${L(perk.desc)}` : t('perk_none');
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
      bad: t('redeem_bad'), empty: t('redeem_empty'), used: t('redeem_used'), none: t('redeem_none'),
    }[res.status];
    this.el.redeemMsg.textContent = msg;
    this.el.redeemMsg.className = 'redeem-msg ' + (res.status === 'ok' ? 'ok' : (res.status === 'have' || res.status === 'none') ? '' : 'err');
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
    const data = await fetchTop(10);
    const me = { nickname: Storage.getNickname() || t('me'), score: Storage.getHighScore() };
    const { top, mine } = buildBoard(Array.isArray(data) ? data : [], me, 10);
    const row = (r) => {
      const medal = r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank;
      const avatar = r.avatarUrl
        ? `<img class="avatar" src="${escapeHtml(r.avatarUrl)}" alt="">`
        : `<span class="avatar" style="background:${escapeHtml(r.color || '#ddd')}">${escapeHtml(r.avatar || '🙂')}</span>`;
      return `<li class="${r.isMe ? 'me' : ''}"><span class="rk">${medal}</span>${avatar}<span class="nm"><bdi>${escapeHtml(r.nickname)}</bdi>${r.isMe ? ` <em>(${escapeHtml(t('me'))})</em>` : ''}</span><span class="sc">${r.score}</span></li>`;
    };
    this.el.rankList.innerHTML = top.map(row).join('');
    this.el.rankMine.innerHTML = mine ? `<ol class="rank-list">${row(mine)}</ol>` : '';
    this.el.rankNote.textContent = LEADERBOARD_API.baseUrl ? t('rank_live') : t('rank_mock');
  }

  /* ---------- 通用 ---------- */
  _openModal(wrap) { wrap.classList.remove('hidden'); }
  _closeModal(wrap) {
    wrap.classList.add('hidden');
    if (wrap === this.el.skin && this.preview) this.preview.stop();
  }

  toast(msg) {
    const el = this.el.toast;
    el.textContent = msg; el.classList.add('on');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => el.classList.remove('on'), 1800);
  }
}
