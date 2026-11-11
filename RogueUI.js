// Roguelike 模式的界面：入口说明、三选一抽卡、局内 Buff 栏、先知之眼标记、各种全屏闪光
import { t, L } from './i18n.js?v=20261110zb';
import { escapeHtml } from './utils.js?v=20261110zb';
import { BUFF_BY_ID, CATS, VIP_BUFFS, rt } from './Roguelike.js?v=20261110zb';

const $ = (id) => document.getElementById(id);

export class RogueUI {
  constructor(game) {
    this.game = game;
    this.pick = null;          // 当前抽卡的回调 { fn, reroll }
    this.opts = [];
    game.rogueUI = this;
    const host = $('playerModal') ? $('playerModal').parentNode : document.body;
    host.insertAdjacentHTML('beforeend', `
      <div id="rgBar" class="rg-bar hidden" aria-live="polite"></div>
      <div id="rgSink" class="rg-sink hidden" aria-hidden="true"><i></i><b></b></div>
      <div id="rgFlash" class="rg-flash" aria-hidden="true"></div>
      <div id="rgKing" class="rg-king hidden" aria-hidden="true"></div>
      <div class="modal-wrap hidden" id="rgIntro" role="dialog" aria-modal="true">
        <div class="modal rg-intro"><button class="close" data-rgclose aria-label="Close">✕</button><div id="rgIntroBody"></div></div>
      </div>
      <div class="modal-wrap hidden" id="rgModal" role="dialog" aria-modal="true">
        <div class="modal rgpick"><h2 id="rgPickTitle"></h2><div class="rg-cards" id="rgCards"></div><button type="button" class="btn rg-reroll hidden" id="rgReroll"></button></div>
      </div>`);
    this.bar = $('rgBar'); this.sink = $('rgSink');
    const track = document.querySelector('.charge-track');
    if (track) { track.insertAdjacentHTML('beforeend', '<i class="rg-mark hidden" id="rgMark"></i>'); this.mark = $('rgMark'); }
    const btn = $('btnRogueStart');
    if (btn) btn.addEventListener('click', () => this.openIntro());
    $('rgIntro').addEventListener('click', (e) => {
      if (e.target === $('rgIntro') || e.target.closest('[data-rgclose]')) $('rgIntro').classList.add('hidden');
      else if (e.target.closest('#rgRank')) { $('rgIntro').classList.add('hidden'); this.game.ui.openRank('rogue'); }
      else if (e.target.closest('#rgGo')) { $('rgIntro').classList.add('hidden'); this.game.enterRogue(); }
    });
    $('rgCards').addEventListener('click', (e) => { const c = e.target.closest('[data-id]'); if (c) this._take(c.dataset.id); });
    $('rgReroll').addEventListener('click', () => this._reroll());
    window.addEventListener('keydown', (e) => {
      if ($('rgModal').classList.contains('hidden')) return;
      if (e.key >= '1' && e.key <= '3') { const b = $('rgCards').children[Number(e.key) - 1]; if (b) this._take(b.dataset.id); }
      e.stopPropagation();
    }, true);
  }

  /* ---------- 开始前的说明 ---------- */
  openIntro() {
    const vip = this.game._isVip();
    const vipList = VIP_BUFFS.map((b) => `<span class="rg-vipchip" title="${escapeHtml(L(b.name))}">${b.icon}</span>`).join('');
    $('rgIntroBody').innerHTML = `
      <h2>🎲 ${escapeHtml(rt('title'))}</h2>
      <p class="room-intro">${escapeHtml(rt('intro'))}</p>
      <div class="rg-vipbox ${vip ? 'on' : ''}"><div>${vipList}</div><p>${escapeHtml(vip ? rt('vipOn', { n: VIP_BUFFS.length }) : rt('vipOff'))}</p></div>
      <button type="button" class="btn primary big" id="rgGo">${escapeHtml(rt('start'))}</button>
      <button type="button" class="btn" id="rgRank">${escapeHtml(rt('rankBtn'))}</button>`;
    $('rgIntro').classList.remove('hidden');
  }

  /* ---------- 局内 Buff 栏 ---------- */
  reset(rg) {
    this.hide();
    this.bar.classList.toggle('hidden', !rg);
    if (rg) this.refresh(rg);
  }
  hide() {
    $('rgModal').classList.add('hidden'); this.pick = null;
    this.bar.classList.add('hidden'); this.setMark(null); this.setSink(null);
  }
  /** 下沉倒计时条：frac 为剩余比例 0~1，null 隐藏 */
  setSink(frac, secs, icon = '⏳') {
    if (!this.sink) return;
    if (frac == null) { this.sink.classList.add('hidden'); return; }
    this.sink.classList.remove('hidden');
    this.sink.classList.toggle('low', frac < 0.35);
    this.sink.firstChild.style.width = (frac * 100).toFixed(1) + '%';
    this.sink.lastChild.textContent = icon + ' ' + secs.toFixed(1);
  }
  refresh(rg) {
    if (!rg) return;
    this.bar.classList.remove('hidden');
    const chips = [];
    if (rg.vip) chips.push(`<span class="rg-chip vip">👑 VIP</span>`);
    chips.push(`<span class="rg-chip shield">🛡️×${rg.shield}</span>`);
    chips.push(`<span class="rg-chip">🏢 ${rg.layers}</span>`);
    if (rg.stage) chips.push(`<span class="rg-chip">${rg.zoneIcon || ''} ${rg.stage}</span>`);
    if (rg.nextHz) chips.push(`<span class="rg-chip">${escapeHtml(rt('nextHz'))} ${rg.nextHz}</span>`);
    if (rg.hazWind) chips.push(`<span class="rg-chip wind">${escapeHtml('💨 ' + (rg.hazWind > 0 ? '+' : '') + rg.hazWind.toFixed(1))}</span>`);
    if (rg.bonusBase) chips.push(`<span class="rg-chip">📈+${rg.bonusBase}</span>`);
    if (rg.has('BUFF_21')) chips.push(`<span class="rg-chip wind">${escapeHtml(rg.wind === 0 ? '💨 0' : rt(rg.wind < 0 ? 'windL' : 'windR', { n: Math.abs(rg.wind).toFixed(2) }))}</span>`);
    if (rg.vip && rg.target10 != null) chips.push(`<span class="rg-chip">${escapeHtml(rt('target', { n: rg.target10 }))}</span>`);
    const icons = Object.keys(rg.buffs).filter((id) => id !== 'BUFF_02').map((id) => {
      const b = BUFF_BY_ID[id]; const n = rg.buffs[id];
      return `<span class="rg-ic" style="border-color:${CATS[b.cat].color}" title="${escapeHtml(L(b.name))}">${b.icon}${n > 1 ? `<small>${n}</small>` : ''}</span>`;
    }).join('');
    this.bar.innerHTML = chips.join('') + (icons ? `<div class="rg-icons">${icons}</div>` : '');
  }

  /* ---------- 三选一 ---------- */
  choose(layer, opts, vip, rerollFn, pickFn) {
    this.pick = { rerollFn, pickFn };
    $('rgPickTitle').textContent = rt('pick', { n: layer });
    $('rgReroll').textContent = rt('reroll');
    $('rgReroll').classList.toggle('hidden', !vip);      // 多维背包：VIP 才有无限 Reroll
    this._cards(opts);
    $('rgModal').classList.remove('hidden');
  }
  _cards(opts) {
    this.opts = opts;
    $('rgCards').innerHTML = opts.map((b, i) => `
      <button type="button" class="rg-card" data-id="${b.id}" style="--c:${CATS[b.cat].color}">
        <span class="k">${i + 1}</span><span class="ic">${b.icon}</span>
        <span class="tx"><b>${escapeHtml(L(b.name))}</b><em>${escapeHtml(L(CATS[b.cat].name))}</em><span>${escapeHtml(L(b.desc))}</span></span>
      </button>`).join('');
  }
  _reroll() { if (this.pick) { const o = this.pick.rerollFn(); if (o.length) this._cards(o); } }
  _take(id) {
    if (!this.pick) return;
    const p = this.pick; this.pick = null;
    $('rgModal').classList.add('hidden');
    p.pickFn(id);
  }

  /* ---------- 先知之眼 / 特效 ---------- */
  setMark(k) {
    if (!this.mark) return;
    if (k == null) { this.mark.classList.add('hidden'); return; }
    this.mark.classList.remove('hidden');
    this.mark.style.left = (k * 100).toFixed(1) + '%';
  }
  _pulse(cls, ms) {
    const f = $('rgFlash'); f.className = 'rg-flash'; void f.offsetWidth; f.classList.add(cls);
    clearTimeout(this._ft); this._ft = setTimeout(() => { f.className = 'rg-flash'; }, ms);
  }
  flash() { this._pulse('gold', 900); }
  disco() { this._pulse('disco', 600); }
  king() {
    const k = $('rgKing');
    k.innerHTML = `<div>👑</div><b>${escapeHtml(rt('king'))}</b>`;
    k.classList.remove('hidden');
    setTimeout(() => k.classList.add('hidden'), 2600);
  }
}
