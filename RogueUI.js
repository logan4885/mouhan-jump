// Roguelike 模式的界面：入口说明、三选一抽卡、局内 Buff 栏、先知之眼标记、各种全屏闪光
import { t, L } from './i18n.js?v=20261114a';
import { escapeHtml } from './utils.js?v=20261114a';
import { BUFF_BY_ID, CATS, VIP_BUFFS, HZ, rt } from './Roguelike.js?v=20261115r';

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
      <div id="rgHint" class="rg-hint" aria-hidden="true"></div>
      <div id="rgSink" class="rg-sink hidden" aria-hidden="true"><i></i><b></b></div>
      <div id="rgFever" class="rg-fever-tag hidden" aria-hidden="true"></div>
      <button type="button" id="rgSkill" class="rg-skill hidden" aria-label="Burst"><i></i><span>⚡</span><em></em></button>
      <div id="rgFlash" class="rg-flash" aria-hidden="true"></div>
      <div id="rgKing" class="rg-king hidden" aria-hidden="true"></div>
      <div class="modal-wrap hidden" id="rgIntro" role="dialog" aria-modal="true">
        <div class="modal rg-intro"><button class="close" data-rgclose aria-label="Close">✕</button><div id="rgIntroBody"></div></div>
      </div>
      <div class="modal-wrap hidden" id="rgModal" role="dialog" aria-modal="true">
        <div class="modal rgpick"><h2 id="rgPickTitle"></h2><div class="rg-cards" id="rgCards"></div><button type="button" class="btn rg-reroll hidden" id="rgReroll"></button></div>
      </div>`);
    this.bar = $('rgBar'); this.sink = $('rgSink'); this.hintEl = $('rgHint'); this.skill = $('rgSkill');
    this._css();
    this.skill.addEventListener('click', (e) => { e.stopPropagation(); this.game.rogueSkill(); });
    this.skill.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: true });
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

  /** 新增样式放在这里（不改 style.css）：爆发按钮、无敌边框 */
  _css() {
    const st = document.createElement('style');
    st.textContent = `
.rg-skill{position:fixed;right:14px;bottom:calc(22px + env(safe-area-inset-bottom,0px));z-index:30;width:68px;height:68px;border-radius:50%;border:3px solid #ffd23d;background:#1b1530;color:#fff;font:700 28px/1 system-ui,sans-serif;display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.45);opacity:.75}
.rg-skill i{position:absolute;left:0;right:0;bottom:0;height:0%;background:linear-gradient(0deg,#ff9f1c,#ffe45c);opacity:.85;transition:height .25s}
.rg-skill span{position:relative;z-index:1;text-shadow:0 1px 3px rgba(0,0,0,.7)}
.rg-skill em{position:absolute;z-index:1;bottom:3px;left:0;right:0;font:700 11px/1 system-ui,sans-serif;font-style:normal;text-align:center;color:#fff;text-shadow:0 1px 2px #000}
.rg-skill.ready{opacity:1;animation:rg-skill-pulse .8s ease-in-out infinite;border-color:#fff}
@keyframes rg-skill-pulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(255,210,61,.8)}50%{transform:scale(1.1);box-shadow:0 0 0 12px rgba(255,210,61,0)}}
body.rg-fever::before{content:"";position:fixed;inset:0;z-index:24;pointer-events:none;box-shadow:inset 0 0 70px 14px rgba(255,61,240,.7),inset 0 0 0 3px rgba(255,61,240,.9);animation:rg-fv .35s ease-in-out infinite alternate}
@keyframes rg-fv{from{opacity:.5}to{opacity:1}}
.rg-fever-tag{position:fixed;left:50%;top:calc(64px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:31;padding:4px 14px;border-radius:999px;background:linear-gradient(90deg,#ff3df0,#ff9f1c);color:#fff;font:800 15px/1.3 system-ui,sans-serif;letter-spacing:1px;text-shadow:0 1px 3px rgba(0,0,0,.5);box-shadow:0 0 16px rgba(255,61,240,.8);pointer-events:none}
body.rg-rush .charge-track{box-shadow:0 0 0 2px #ffb300,0 0 14px 2px rgba(255,179,0,.85)}
body.rg-invuln::after{content:"";position:fixed;inset:0;z-index:25;pointer-events:none;box-shadow:inset 0 0 60px 10px rgba(255,228,92,.75);animation:rg-inv 0.6s ease-in-out infinite alternate}
@keyframes rg-inv{from{opacity:.45}to{opacity:1}}
`;
    document.head.appendChild(st);
  }

  /** 狂暴倒计时标签：sec <= 0 隐藏 */
  setFever(sec) {
    const el = $('rgFever'); if (!el) return;
    if (!(sec > 0)) { if (!el.classList.contains('hidden')) el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const txt = '🔥 FEVER ' + sec.toFixed(1);
    if (el.textContent !== txt) el.textContent = txt;
  }

  /** 能量：按钮里的填充 + 满了就脉冲 */
  setEnergy(rg) {
    const b = this.skill; if (!b) return;
    if (!rg) { b.classList.add('hidden'); return; }
    b.classList.remove('hidden');
    const e = Math.max(0, Math.min(100, rg.energy || 0));
    b.firstChild.style.height = e + '%';
    b.lastChild.textContent = e >= 100 ? 'Q' : Math.floor(e) + '%';
    b.classList.toggle('ready', e >= 100);
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
    this.setEnergy(rg);
    if (rg) this.refresh(rg);
  }
  hide() {
    $('rgModal').classList.add('hidden'); this.pick = null;
    this.bar.classList.add('hidden'); this.setEnergy(null); this.setFever(0); this.setMark(null); this.setSink(null); this.hideHint();
  }
  /** 机制方块出现时的效果提示卡：图标 + 名称 + 一句话效果（混沌方块列出两种） */
  showHint(kinds, chaos) {
    const el = this.hintEl; if (!el || !kinds || !kinds.length) return;
    const rows = kinds.map((k) => HZ[k]).filter(Boolean).map((h) =>
      `<div class="rg-hint-row"><span class="ic">${h.icon}</span><span class="tx"><b>${escapeHtml(L(h.name))}</b><span>${escapeHtml(L(h.desc))}</span></span></div>`).join('');
    el.innerHTML = (chaos ? `<div class="rg-hint-tag">👑 ${escapeHtml(L(HZ.chaos.name))}</div>` : '') + rows;
    el.classList.add('on');
    clearTimeout(this._hintT);
    this._hintT = setTimeout(() => el.classList.remove('on'), chaos ? 4200 : 3000);
  }
  hideHint() { if (this.hintEl) { clearTimeout(this._hintT); this.hintEl.classList.remove('on'); } }
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
    if (rg.armor > 0) chips.push(`<span class="rg-chip">🔰</span>`);
    if (rg.ammo > 0) chips.push(`<span class="rg-chip">🔫×${rg.ammo}</span>`);
    if (rg.kills > 0) chips.push(`<span class="rg-chip">☠️ ${rg.kills}</span>`);
    if (rg.grazes > 0) chips.push(`<span class="rg-chip">🌀 ${rg.grazes}</span>`);
    if (rg.rushes > 0) chips.push(`<span class="rg-chip">⚡RUSH ${rg.rushes}</span>`);
    if (rg.contract) chips.push(`<span class="rg-chip" style="background:#5a0010;color:#fff">😈${rg.contract.icon}×${rg.contract.mul} · ${rg.contract.left}</span>`);
    if (rg.bonusBase) chips.push(`<span class="rg-chip">📈+${rg.bonusBase}</span>`);
    if (rg.has('BUFF_21')) chips.push(`<span class="rg-chip wind">${escapeHtml(rg.wind === 0 ? '💨 0' : rt(rg.wind < 0 ? 'windL' : 'windR', { n: Math.abs(rg.wind).toFixed(2) }))}</span>`);
    if (rg.vip && rg.target10 != null) chips.push(`<span class="rg-chip">${escapeHtml(rt('target', { n: rg.target10 }))}</span>`);
    const icons = Object.keys(rg.buffs).filter((id) => id !== 'BUFF_02').map((id) => {
      const b = BUFF_BY_ID[id]; const n = rg.buffs[id];
      return `<span class="rg-ic" style="border-color:${CATS[b.cat].color}" title="${escapeHtml(L(b.name))}">${b.icon}${n > 1 ? `<small>${n}</small>` : ''}</span>`;
    }).join('');
    this.setEnergy(rg);
    this.bar.innerHTML = chips.join('') + (icons ? `<div class="rg-icons">${icons}</div>` : '');
  }

  /* ---------- 三选一 ---------- */
  choose(layer, opts, vip, rerollFn, pickFn, title) {
    this.pick = { rerollFn, pickFn };
    $('rgPickTitle').textContent = title || rt('pick', { n: layer });
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
