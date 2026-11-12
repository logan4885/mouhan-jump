// 留言板（聊天大厅）：所有玩家共用一个房间，打开时每 3 秒自动刷新。
// 登录账号才能发言（未登录只能看）；服务器限频 + 敏感词过滤，玩家可举报，管理员可删帖 / 禁言。
import { Storage } from './Storage.js?v=20261114a';
import { LEADERBOARD_API } from './Leaderboard.js?v=20261114a';
import { L, onLangChange } from './i18n.js?v=20261114a';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tri = (zh, en, ar) => ({ zh, en, ar });
const POLL_MS = 3000;
const MAX_ROWS = 200;

const TX = {
  btn: tri('💬 留言板', '💬 Chat lobby', '💬 لوحة الدردشة'),
  title: tri('💬 留言板', '💬 Chat lobby', '💬 لوحة الدردشة'),
  sub: tri('和所有玩家聊聊天吧，请友善发言。', 'Chat with everyone — please be kind.', 'تحدّث مع جميع اللاعبين — كن لطيفاً.'),
  empty: tri('还没有人说话，来当第一个吧！', 'No messages yet — be the first!', 'لا رسائل بعد — كن الأول!'),
  loading: tri('加载中…', 'Loading…', 'جارٍ التحميل…'),
  ph: tri('说点什么…', 'Say something…', 'اكتب شيئاً…'),
  send: tri('发送', 'Send', 'إرسال'),
  you: tri('我', 'You', 'أنت'),
  loginNote: tri('登录账号后才能发言（现在可以围观）。', 'Sign in to chat (you can still read along).', 'سجّل الدخول للمشاركة (يمكنك القراءة الآن).'),
  loginBtn: tri('👤 去登录', '👤 Sign in', '👤 تسجيل الدخول'),
  report: tri('举报', 'Report', 'إبلاغ'),
  reportSure: tri('确认举报？', 'Report this?', 'تأكيد الإبلاغ؟'),
  reported: tri('已举报，谢谢！', 'Reported, thank you!', 'تم الإبلاغ، شكراً!'),
  close: tri('关闭', 'Close', 'إغلاق'),
  offline: tri('连不上服务器，稍后再试。', "Can't reach the server. Try again shortly.", 'تعذّر الاتصال بالخادم. حاول لاحقاً.'),
  e_login_required: tri('请先登录账号再发言。', 'Please sign in first.', 'سجّل الدخول أولاً.'),
  e_banned: tri('你已被禁言。', 'You are muted.', 'تم كتم حسابك.'),
  e_slow_down: tri('说得太快啦，歇几秒再发。', 'Slow down — wait a few seconds.', 'على مهلك — انتظر بضع ثوانٍ.'),
  e_duplicate: tri('这句刚发过啦。', 'You just said that.', 'لقد أرسلت هذا للتو.'),
  e_link: tri('不能发网址链接。', 'Links are not allowed.', 'الروابط غير مسموحة.'),
  e_contact: tri('不能留联系方式或长数字。', 'No contact info or long numbers.', 'ممنوع معلومات الاتصال والأرقام الطويلة.'),
  e_bad_word: tri('消息里有不文明用语，请修改。', 'Please keep it friendly — message not sent.', 'يرجى استخدام لغة لائقة — لم تُرسل الرسالة.'),
  e_empty: tri('先写点内容吧。', 'Write something first.', 'اكتب شيئاً أولاً.'),
  e_too_many_requests: tri('操作太频繁，请稍后再试。', 'Too many requests — try again shortly.', 'طلبات كثيرة — حاول لاحقاً.'),
  e_forbidden: tri('身份验证失败，请刷新页面。', 'Identity check failed — refresh the page.', 'فشل التحقق — أعد تحميل الصفحة.'),
};
const tx = (k) => L(TX[k]);

const CSS = `
.chat-modal { width: min(100%, 420px); }
.chat-modal h2 { margin-bottom: 4px; }
.chat-sub { margin: 0 0 10px; font-size: 13px; font-weight: 700; color: var(--muted); }
.chat-list { height: min(52vh, 380px); overflow-y: auto; overscroll-behavior: contain; text-align: start; padding: 8px; border: 3px solid var(--ink); border-radius: 16px; background: #fff;
  -webkit-user-select: text; user-select: text; touch-action: pan-y; display: flex; flex-direction: column; gap: 8px; }
.chat-empty { margin: auto; font-size: 14px; font-weight: 800; color: var(--muted); text-align: center; }
.chat-row { display: flex; gap: 8px; align-items: flex-start; }
.chat-av { flex: none; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; font-size: 19px; border: 2.5px solid var(--ink); }
.chat-bub { min-width: 0; max-width: calc(100% - 48px); }
.chat-meta { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 800; color: var(--muted); }
.chat-meta b { color: var(--ink); max-width: 9em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chat-meta .vip { color: #b07a00; }
.chat-meta time { font-weight: 700; opacity: .8; }
.chat-rep { margin-inline-start: auto; background: none; border: 0; padding: 2px 4px; font: inherit; font-size: 11px; font-weight: 800; color: var(--muted); opacity: .55; cursor: pointer; }
.chat-rep:hover, .chat-rep.sure { opacity: 1; color: var(--accent); }
.chat-txt { margin-top: 2px; padding: 7px 11px; border-radius: 4px 14px 14px 14px; background: #f1edfb; font-size: 14.5px; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; word-break: break-word; }
.chat-row.me { flex-direction: row-reverse; }
.chat-row.me .chat-meta { flex-direction: row-reverse; }
.chat-row.me .chat-txt { background: #ffe8b8; border-radius: 14px 4px 14px 14px; }
.chat-row.me .chat-rep { display: none; }
.chat-form { display: flex; gap: 8px; margin-top: 10px; }
.chat-form input { flex: 1; min-width: 0; font: 700 15px var(--font); color: var(--ink); padding: 11px 12px; border: 3px solid var(--ink); border-radius: 14px; background: #fff; -webkit-user-select: text; user-select: text; }
.chat-form input:focus { outline: 3px solid var(--accent-2); outline-offset: 1px; }
.chat-form .btn { padding: 11px 16px; }
.chat-note { margin: 10px 0 0; font-size: 13px; font-weight: 800; color: var(--muted); }
.chat-login { margin-top: 10px; display: grid; gap: 8px; }
.chat-msg { min-height: 18px; margin: 6px 0 0; font-size: 13px; font-weight: 800; color: var(--accent); }
`;

export class Chat {
  constructor(game) {
    this.game = game;
    this.lastId = 0;
    this.seen = new Set();
    this.timer = null;
    this.busy = false;
    this.opened = false;
    if (!$('chatCss')) { const st = document.createElement('style'); st.id = 'chatCss'; st.textContent = CSS; document.head.appendChild(st); }
    const anchor = $('btnRogueStart') || $('btnRoomStart');
    if (anchor) {
      anchor.insertAdjacentHTML('afterend', '<button class="btn" id="btnChat" type="button"></button>');
      $('btnChat').addEventListener('click', () => this.open());
    }
    const host = $('playerModal') ? $('playerModal').parentNode : document.body;
    host.insertAdjacentHTML('beforeend', `
      <div class="modal-wrap hidden" id="chatModal" role="dialog" aria-modal="true">
        <div class="modal chat-modal"><button class="close" data-chatclose aria-label="Close">✕</button>
          <h2 id="chatTitle"></h2><p class="chat-sub" id="chatSub"></p>
          <div class="chat-list" id="chatList" aria-live="polite"></div>
          <p class="chat-msg" id="chatMsg" role="status"></p>
          <form class="chat-form hidden" id="chatForm" autocomplete="off"><input id="chatInput" type="text" maxlength="120" enterkeyhint="send" /><button class="btn primary" id="chatSend" type="submit"></button></form>
          <div class="chat-login hidden" id="chatLogin"><p class="chat-note" id="chatLoginNote"></p><button class="btn" id="chatLoginBtn" type="button"></button></div>
        </div></div>`);
    $('chatModal').addEventListener('click', (e) => {
      if (e.target === $('chatModal') || e.target.closest('[data-chatclose]')) return this.close();
      const rp = e.target.closest('[data-rep]'); if (rp) this._report(rp);
    });
    $('chatForm').addEventListener('submit', (e) => { e.preventDefault(); this._send(); });
    $('chatLoginBtn').addEventListener('click', () => { this.close(); const b = $('btnAcctStart'); if (b) b.click(); });
    window.addEventListener('keydown', (e) => { if (this.opened && e.key === 'Escape') this.close(); });
    document.addEventListener('visibilitychange', () => { if (this.opened && !document.hidden) this._poll(); });
    this._labels();
    onLangChange(() => { this._labels(); this._renderAll(); });
  }

  _labels() {
    const set = (id, k) => { const el = $(id); if (el) el.textContent = tx(k); };
    set('btnChat', 'btn'); set('chatTitle', 'title'); set('chatSub', 'sub'); set('chatSend', 'send'); set('chatLoginNote', 'loginNote'); set('chatLoginBtn', 'loginBtn');
    const i = $('chatInput'); if (i) i.placeholder = tx('ph');
  }

  _base() { return LEADERBOARD_API.baseUrl || ''; }
  _me() { return Storage.getPlayer().id; }
  _setMsg(text) { $('chatMsg').textContent = text || ''; }
  _err(code) { return TX['e_' + code] ? tx('e_' + code) : tx('offline'); }

  async _api(path, body) {
    const base = this._base();
    if (!base) throw Object.assign(new Error('offline'), { code: 'offline' });
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      let opt = { signal: ctrl.signal, cache: 'no-store' };
      if (body) { const p = Storage.getPlayer(); opt = { ...opt, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, secret: p.secret, ...body }) }; }
      const r = await fetch(base + path, opt);
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw Object.assign(new Error(j.error || 'HTTP ' + r.status), { code: j.error || 'offline' });
      return j;
    } catch (e) {
      throw e.code ? e : Object.assign(new Error(e.message), { code: 'offline' });
    } finally { clearTimeout(timer); }
  }

  /* ---------- 打开 / 关闭 ---------- */
  open() {
    this.opened = true;
    this.lastId = 0; this.seen = new Set(); this.rows = [];
    $('chatList').innerHTML = `<p class="chat-empty">${esc(tx('loading'))}</p>`;
    this._setMsg('');
    const acc = !!Storage.getAccount();
    $('chatForm').classList.toggle('hidden', !acc);
    $('chatLogin').classList.toggle('hidden', acc);
    $('chatModal').classList.remove('hidden');
    this._poll();
    clearInterval(this.timer);
    this.timer = setInterval(() => { if (!document.hidden) this._poll(); }, POLL_MS);
    if (acc) setTimeout(() => { try { $('chatInput').focus({ preventScroll: true }); } catch (e) { /* 忽略 */ } }, 250);
  }

  close() {
    this.opened = false; clearInterval(this.timer); this.timer = null;
    $('chatModal').classList.add('hidden');
  }

  /* ---------- 拉取 / 渲染 ---------- */
  async _poll() {
    if (this.busy || !this.opened) return;
    this.busy = true;
    try {
      const j = await this._api('/api/chat' + (this.lastId ? '?after=' + this.lastId : ''));
      if (!this.opened) return;
      if ($('chatMsg').textContent === tx('offline')) this._setMsg('');
      if (j.gone && j.gone.length) this._remove(j.gone);
      this._append(j.msgs || [], !this.lastId);
    } catch (e) {
      if (this.opened && !this.lastId) $('chatList').innerHTML = `<p class="chat-empty">${esc(tx('offline'))}</p>`;
      else if (this.opened) this._setMsg(tx('offline'));
    } finally { this.busy = false; }
  }

  _rowHtml(m) {
    const me = m.pid === this._me();
    const d = new Date(m.ts * 1000); const hh = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return `<div class="chat-row${me ? ' me' : ''}" data-mid="${m.id}">
      <span class="chat-av" style="background:${esc(m.color)}">${esc(m.avatar)}</span>
      <div class="chat-bub"><div class="chat-meta"><b class="${m.vip ? 'vip' : ''}">${m.vip ? '👑 ' : ''}${esc(me ? m.nick + ' · ' + tx('you') : m.nick)}</b><time>${hh}</time>
        <button type="button" class="chat-rep" data-rep="${m.id}">⚑ ${esc(tx('report'))}</button></div>
        <div class="chat-txt">${esc(m.text)}</div></div></div>`;
  }

  _append(msgs, first) {
    const list = $('chatList');
    const fresh = msgs.filter((m) => !this.seen.has(m.id));
    if (first) list.innerHTML = '';
    if (!fresh.length) { if (first) list.innerHTML = `<p class="chat-empty">${esc(tx('empty'))}</p>`; return; }
    const stick = first || list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    const empty = list.querySelector('.chat-empty'); if (empty) empty.remove();
    fresh.forEach((m) => { this.seen.add(m.id); this.rows.push(m); this.lastId = Math.max(this.lastId, m.id); });
    list.insertAdjacentHTML('beforeend', fresh.map((m) => this._rowHtml(m)).join(''));
    while (list.children.length > MAX_ROWS) list.firstElementChild.remove();
    if (stick) list.scrollTop = list.scrollHeight;
  }

  _remove(ids) {
    ids.forEach((id) => { const el = $('chatList').querySelector(`[data-mid="${id}"]`); if (el) el.remove(); });
    this.rows = (this.rows || []).filter((m) => !ids.includes(m.id));
  }

  _renderAll() {   // 切换语言后重绘
    if (!this.opened || !this.rows || !this.rows.length) return;
    const list = $('chatList'); list.innerHTML = this.rows.map((m) => this._rowHtml(m)).join(''); list.scrollTop = list.scrollHeight;
  }

  /* ---------- 发言 / 举报 ---------- */
  async _send() {
    const inp = $('chatInput'); const text = inp.value.trim();
    if (!text || this.sending) return;
    this.sending = true; $('chatSend').disabled = true; this._setMsg('');
    try {
      const j = await this._api('/api/chat/send', { text });
      inp.value = '';
      this._append([j.msg], false);
      $('chatList').scrollTop = $('chatList').scrollHeight;
    } catch (e) { this._setMsg(this._err(e.code)); }
    finally { this.sending = false; $('chatSend').disabled = false; try { inp.focus({ preventScroll: true }); } catch (e) { /* 忽略 */ } }
  }

  async _report(btn) {
    if (!btn.classList.contains('sure')) {      // 第一次点：变成“确认举报？”，3 秒内再点才真的举报
      btn.classList.add('sure'); btn.textContent = '⚑ ' + tx('reportSure');
      setTimeout(() => { if (btn.isConnected && btn.classList.contains('sure')) { btn.classList.remove('sure'); btn.textContent = '⚑ ' + tx('report'); } }, 3000);
      return;
    }
    btn.disabled = true;
    try {
      await this._api('/api/chat/report', { msg: Number(btn.dataset.rep) });
      btn.textContent = '✓'; btn.classList.remove('sure');
      if (this.game && this.game.ui && this.game.ui.toast) this.game.ui.toast(tx('reported'));
    } catch (e) { btn.disabled = false; btn.classList.remove('sure'); btn.textContent = '⚑ ' + tx('report'); this._setMsg(this._err(e.code)); }
  }
}
