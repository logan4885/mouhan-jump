// 同图比赛：开房间 / 加入 / 大厅 / 结果。服务器只发地图种子和收最终成绩，没有实时通信。
import { Storage } from './Storage.js?v=20261113a';
import { syncPlayer, LEADERBOARD_API } from './Leaderboard.js?v=20261113a';
import { t } from './i18n.js?v=20261113a';
import { escapeHtml } from './utils.js?v=20261113a';

const MAX = 8;
const ALPHA = /[^A-HJ-NP-Z2-9]/g;
const $ = (id) => document.getElementById(id);

async function api(path, body) {
  const base = LEADERBOARD_API.baseUrl;
  if (!base) throw Object.assign(new Error('offline'), { code: 'offline' });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    let opt = { signal: ctrl.signal };
    if (body) {
      const p = Storage.getPlayer();
      opt = { ...opt, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, secret: p.secret, ...body }) };
    }
    const r = await fetch(base + path, opt);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw Object.assign(new Error(j.error || 'HTTP ' + r.status), { code: j.error || 'offline' });
    return j;
  } catch (e) {
    if (e.code) throw e;
    throw Object.assign(new Error(e.message), { code: 'offline' });
  } finally { clearTimeout(timer); }
}

export class Room {
  constructor(game) {
    this.game = game;
    this.room = null;        // 最近一次服务器返回的房间
    this.phase = 'idle';     // idle | join | lobby | playing | result
    this.pollTimer = null;
    this.myScore = null;
    this.pending = null;     // 待交的成绩（交失败时保留，可重试）
    this.round = 1;          // 我正在玩 / 刚玩完的是第几局
    this.newer = null;       // 别人在同一房间开了更新的一局时，存放那一局的房间信息
    this._build();
    game.onMatchOver = (r) => this._finished(r);
    window.addEventListener('hashchange', () => this._checkLink());
    this._checkLink(1500);
  }

  /* ---------- 界面骨架 ---------- */
  _build() {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap hidden'; wrap.id = 'roomModal';
    wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
    wrap.innerHTML = '<div class="modal room"><button class="close" data-rclose aria-label="Close">✕</button><div id="roomBody"></div></div>';
    const host = $('playerModal') ? $('playerModal').parentNode : document.body;
    host.appendChild(wrap);
    this.wrap = wrap; this.body = $('roomBody');
    const chip = document.createElement('div');
    chip.id = 'roomChip'; chip.className = 'room-chip hidden';
    host.appendChild(chip);
    this.chip = chip;
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap || e.target.closest('[data-rclose]')) { if (this.phase !== 'result') this.close(); }
    });
    this.body.addEventListener('click', (e) => this._onClick(e));
    this.body.addEventListener('input', (e) => { if (e.target.id === 'roomCode') e.target.value = e.target.value.toUpperCase().replace(ALPHA, '').slice(0, 4); });
    this.body.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'roomCode') this._join(e.target.value); e.stopPropagation(); });
    const btn = $('btnRoomStart');
    if (btn) btn.addEventListener('click', () => this.open());
  }

  _show() { this.wrap.classList.remove('hidden'); }
  _hide() { this.wrap.classList.add('hidden'); }
  _msg(text) { const m = $('roomMsg'); if (m) m.textContent = text || ''; }
  _err(e) { return t(e.code === 'no_room' ? 'rm_err_no_room' : e.code === 'full' ? 'rm_err_full' : e.code === 'bad_code' ? 'rm_err_code' : 'rm_err_offline'); }
  _link(code) { return location.origin + location.pathname + '#room=' + code; }

  _checkLink(delay = 0) {
    const m = (location.hash || '').match(/room=([A-Za-z0-9]{4})/);
    if (!m) return;
    const code = m[1].toUpperCase().replace(ALPHA, '');
    history.replaceState(null, '', location.pathname + location.search);
    if (code.length !== 4) return;
    setTimeout(() => { if (this.game.state === 'menu' && !this.game.match) this._invite(code); }, delay);
  }

  /* ---------- 入口：创建 / 输入房间码 ---------- */
  open() {
    this._stopPoll();
    if (this.room && this.phase === 'lobby') { this._lobby(); return; }
    this.phase = 'join';
    this.body.innerHTML = `
      <h2>${escapeHtml(t('rm_title'))}</h2>
      <p class="room-intro">${escapeHtml(t('rm_intro'))}</p>
      <button type="button" class="btn primary big" data-act="create">${escapeHtml(t('rm_create'))}</button>
      <p class="room-or">${escapeHtml(t('rm_or'))}</p>
      <div class="room-join"><input id="roomCode" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${escapeHtml(t('rm_code_ph'))}">
      <button type="button" class="btn" data-act="join">${escapeHtml(t('rm_join'))}</button></div>
      <p class="room-msg" id="roomMsg" role="status" aria-live="polite"></p>
      <p class="room-note">${escapeHtml(t('rm_note'))}</p>`;
    this._show();
  }

  _invite(code) {
    this.phase = 'join';
    this.body.innerHTML = `
      <h2>${escapeHtml(t('rm_title'))}</h2>
      <p class="room-intro">${escapeHtml(t('rm_invite', { code }))}</p>
      <div class="room-code">${code}</div>
      <button type="button" class="btn primary big" data-act="join-code" data-code="${code}">${escapeHtml(t('rm_join'))}</button>
      <button type="button" class="link-btn" data-act="close">${escapeHtml(t('rm_leave'))}</button>
      <p class="room-msg" id="roomMsg" role="status" aria-live="polite"></p>
      <p class="room-note">${escapeHtml(t('rm_note'))}</p>`;
    this._show();
  }

  close() { this._stopPoll(); this._hide(); if (this.phase !== 'playing') { this.phase = this.room ? 'lobby' : 'idle'; } }

  async _prep() {
    const s = await syncPlayer();            // 保证服务器上有我这个玩家（昵称、头像才显示得出来）
    if (!s || s.ok === false) throw Object.assign(new Error('offline'), { code: 'offline' });
  }

  async _create() {
    this._msg(t('rm_loading'));
    try { await this._prep(); const j = await api('/api/room/create', {}); this.room = j.room; this._lobby(); }
    catch (e) { this._msg(this._err(e)); }
  }

  async _join(raw) {
    const code = String(raw || '').toUpperCase().replace(ALPHA, '');
    if (code.length !== 4) return this._msg(t('rm_err_code'));
    this._msg(t('rm_loading'));
    try { await this._prep(); const j = await api('/api/room/join', { code }); this.room = j.room; this._lobby(); }
    catch (e) { this._msg(this._err(e)); }
  }

  /* ---------- 大厅 ---------- */
  _playersHtml(room, mode) {
    const me = Storage.getPlayer().id;
    let list = room.players.slice();
    if (mode === 'result') list.sort((a, b) => (b.score === null) - (a.score === null) || (b.score ?? 0) - (a.score ?? 0));
    let rank = 0, prev = null;
    return '<ul class="room-list">' + list.map((p, i) => {
      let right;
      if (mode === 'result') {
        if (p.score !== null && p.score !== prev) { rank = i + 1; prev = p.score; }
        right = p.score === null ? `<em>${escapeHtml(t('rm_waiting'))}</em>` : `<b>${p.score}</b>`;
      } else right = p.score === null ? '' : `<b>${p.score}</b>`;
      const lead = mode === 'result' ? `<span class="rk">${p.score === null ? '–' : rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}</span>` : '';
      return `<li class="${p.id === me ? 'me' : ''}">${lead}<span class="av" style="background:${escapeHtml(p.color)}">${escapeHtml(p.avatar)}</span><span class="nm">${escapeHtml(p.nickname)}${p.id === me ? ' <small>(' + escapeHtml(t('rm_you')) + ')</small>' : ''}</span>${right}</li>`;
    }).join('') + '</ul>';
  }

  _lobby() {
    this.phase = 'lobby';
    const r = this.room;
    this.body.innerHTML = `
      <h2>${escapeHtml(t('rm_title'))}</h2>
      <p class="room-label">${escapeHtml(t('rm_code_label'))}</p>
      <div class="room-code">${r.code}</div>
      <div class="btn-row"><button type="button" class="btn" data-act="copy">${escapeHtml(t('rm_copy_link'))}</button>${navigator.share ? `<button type="button" class="btn" data-act="share">${escapeHtml(t('rm_share'))}</button>` : ''}</div>
      <p class="room-hint">${escapeHtml(t('rm_lobby_hint'))}</p>
      <p class="room-label" id="roomCount"></p>
      <div id="roomPlayers"></div>
      <button type="button" class="btn primary big" data-act="start">${escapeHtml(t('rm_start_me'))}</button>
      <button type="button" class="link-btn" data-act="leave">${escapeHtml(t('rm_leave'))}</button>
      <p class="room-msg" id="roomMsg" role="status" aria-live="polite"></p>`;
    this._paintLobby();
    this._show();
    this._poll(() => this._paintLobby());
  }

  _paintLobby() {
    if (this.phase !== 'lobby' || !$('roomPlayers')) return;
    $('roomCount').textContent = t('rm_players', { n: this.room.players.length, m: MAX });
    $('roomPlayers').innerHTML = this._playersHtml(this.room, 'lobby');
  }

  _poll(paint) {
    this._stopPoll();
    const code = this.room.code; const t0 = Date.now();
    this.pollTimer = setInterval(async () => {
      if (Date.now() - t0 > 20 * 60 * 1000) return this._stopPoll();
      try {
        if (this.phase === 'result' && this.pending) await this._send();
        const j = await api('/api/room/' + code);
        if (this.phase === 'result' && j.room.round > this.round) { this.newer = j.room; paint(); return; }   // 结果页继续显示我打的那一局
        this.room = j.room; paint();
      } catch (e) { /* 网络抖动，下次再试 */ }
    }, 3000);
  }
  _stopPoll() { if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; } }

  _start() {
    this._stopPoll();
    this._hide();
    this.phase = 'playing'; this.myScore = null; this.pending = null; this.newer = null;
    this.round = this.room.round;
    this.chip.textContent = t('rm_chip', { code: this.room.code }) + ' · ' + t('rm_round', { n: this.round });
    this.chip.classList.remove('hidden');
    this.game.enterMatch(this.room.code, this.room.seed);
  }

  /* ---------- 结果 ---------- */
  async _finished({ code, score, record }) {
    this.phase = 'result'; this.myScore = score; this.record = !!record; this.pending = { code, score, round: this.round };
    this.chip.classList.add('hidden');
    this._result();
    await this._submit();
  }

  /** 交成绩；失败也继续轮询，并在每次轮询时自动重交，不会卡在“还在玩…” */
  async _submit() {
    const ok = await this._send();
    this._paintResult(!ok);
    if (!this.pollTimer && this.phase === 'result') this._poll(() => this._paintResult(!!this.pending));
  }

  async _send() {
    if (!this.pending) return true;
    try {
      const j = await api('/api/room/score', { code: this.pending.code, score: this.pending.score, round: this.pending.round });
      this.pending = null; this._msg('');
      if (!(j.room.round > this.round)) this.room = j.room;
      return true;
    } catch (e) {
      if (e.code === 'stale') { this.pending = null; this._msg(''); return true; }
      this._msg(t('rm_submit_fail'));
      return false;
    }
  }

  _result() {
    this.body.innerHTML = `
      <h2>${escapeHtml(t('rm_result'))} <small>${escapeHtml(t('rm_round', { n: this.round }))}</small></h2>
      <p class="room-label">${escapeHtml(t('rm_code_label'))} <b>${escapeHtml(this.room.code)}</b></p>
      ${this.record ? `<div class="record">${escapeHtml(t('new_record'))}</div>` : ''}
      <div class="over-score">${this.myScore}</div>
      <p class="room-verdict" id="roomVerdict"></p>
      <div id="roomPlayers"></div>
      <div class="btn-row"><button type="button" class="btn" data-act="retry-submit" id="roomRetry" hidden>${escapeHtml(t('rm_retry'))}</button><button type="button" class="btn" data-act="copy">${escapeHtml(t('rm_copy_link'))}</button></div>
      <button type="button" class="btn primary big" data-act="again" id="roomAgain">${escapeHtml(t('rm_again'))}</button>
      <button type="button" class="link-btn" data-act="home">${escapeHtml(t('rm_home'))}</button>
      <p class="room-msg" id="roomMsg" role="status" aria-live="polite"></p>`;
    this._paintResult(false);
    this._show();
  }

  _paintResult(failed) {
    if (this.phase !== 'result' || !$('roomPlayers')) return;
    const me = Storage.getPlayer().id;
    // 我的成绩如果还没交上去，先在本地补上，列表里也能看到自己
    const players = this.room.players.map((p) => (p.id === me && p.score === null && this.myScore !== null ? { ...p, score: this.myScore } : p));
    const room = { ...this.room, players };
    $('roomPlayers').innerHTML = this._playersHtml(room, 'result');
    $('roomRetry').hidden = !failed;
    const again = $('roomAgain');
    if (again) { again.textContent = this.newer ? t('rm_join_next', { n: this.newer.round }) : t('rm_again'); again.classList.toggle('pulse', !!this.newer); }
    const done = players.filter((p) => p.score !== null);
    const best = Math.max(...done.map((p) => p.score));
    const ahead = done.filter((p) => p.score > this.myScore).length;
    const tied = done.filter((p) => p.id !== me && p.score === this.myScore).length;
    const v = $('roomVerdict');
    if (players.length < 2) v.textContent = '';
    else if (done.length < players.length) v.textContent = ahead === 0 && this.myScore === best ? t('rm_waiting') : '';
    else v.textContent = ahead === 0 ? (tied ? t('rm_tie') : t('rm_win')) : t('rm_lose', { n: ahead + 1 });
  }

  /* ---------- 同一个房间再来一局 ---------- */
  async _rematch() {
    this._msg(t('rm_loading'));
    try {
      let room = this.newer;                                            // 别人已经开了新的一局：直接加入
      if (!room) room = (await api('/api/room/rematch', { code: this.room.code, round: this.round })).room;
      this._stopPoll();
      this.room = room; this._start();
    } catch (e) { this._msg(this._err(e)); }
  }

  /* ---------- 点击事件 ---------- */
  async _onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const a = b.dataset.act;
    if (a === 'create') this._create();
    else if (a === 'join') this._join($('roomCode').value);
    else if (a === 'join-code') this._join(b.dataset.code);
    else if (a === 'close') this.close();
    else if (a === 'start') this._start();
    else if (a === 'leave') { this._stopPoll(); this.room = null; this.phase = 'idle'; this._hide(); }
    else if (a === 'retry-submit') this._submit();
    else if (a === 'again') this._rematch();
    else if (a === 'home') { this._stopPoll(); this.game.leaveMatch(); this.room = null; this.phase = 'idle'; this._hide(); }
    else if (a === 'copy' || a === 'share') {
      const link = this._link(this.room.code);
      if (a === 'share' && navigator.share) { try { await navigator.share({ title: t('rm_title'), text: t('rm_share_text', { code: this.room.code }), url: link }); } catch (er) { /* 取消分享 */ } return; }
      try { await navigator.clipboard.writeText(link); }
      catch (er) { const ta = document.createElement('textarea'); ta.value = link; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e2) { /* 忽略 */ } ta.remove(); }
      this._msg(t('rm_copied'));
    }
  }
}
