// 邀请好友：每个玩家有自己的邀请二维码/链接；朋友通过它进来、玩完 1 局才算 1 个有效邀请；
// 每满 10 个，服务器发 1 个兑换码（INV-XXXX-XXXX），在商店里输入就随机解锁 1 款特效罐。
// 自己带一个很小的二维码生成器（固定 3 号版本、纠错 M，够放 42 个字符的网址），不依赖任何外部库。
import { Storage } from './Storage.js?v=20261114a';
import { LEADERBOARD_API, syncPlayer } from './Leaderboard.js?v=20261114a';
import { L, onLangChange } from './i18n.js?v=20261114a';
import { PLAYER_SKINS } from './SkinManager.js?v=20261114a';

const SITE = 'https://jump.mouhan.dev/';
const REF_KEY = 'jump3d_ref';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ================= 迷你二维码生成器（版本 3，纠错 M，字节模式） ================= */
const QN = 29, QDATA = 44, QEC = 26;
const EXP = new Array(512), LOG = new Array(256);
(() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
const gmul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);
const MASKS = [
  (r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

export function qrMatrix(text) {
  const d = new TextEncoder().encode(text);
  if (d.length > 42) throw new Error('too long');
  let bits = '0100' + d.length.toString(2).padStart(8, '0');
  d.forEach((b) => { bits += b.toString(2).padStart(8, '0'); });
  bits += '0'.repeat(Math.min(4, QDATA * 8 - bits.length));
  bits += '0'.repeat((8 - (bits.length % 8)) % 8);
  const cw = []; for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8), 2));
  for (let p = 0; cw.length < QDATA; p++) cw.push(p % 2 === 0 ? 0xec : 0x11);
  let g = [1];
  for (let i = 0; i < QEC; i++) { const ng = new Array(g.length + 1).fill(0); g.forEach((c, j) => { ng[j] ^= c; ng[j + 1] ^= gmul(c, EXP[i]); }); g = ng; }
  const rem = cw.concat(new Array(QEC).fill(0));
  for (let i = 0; i < QDATA; i++) { const c = rem[i]; if (c) g.forEach((gc, j) => { rem[i + j] ^= gmul(gc, c); }); }
  const all = cw.concat(rem.slice(QDATA));
  const stream = all.map((b) => b.toString(2).padStart(8, '0')).join('');

  const fn = Array.from({ length: QN }, () => new Array(QN).fill(false));
  const base = () => {
    const M = Array.from({ length: QN }, () => new Array(QN).fill(0));
    const setf = (r, c, v) => { if (r >= 0 && r < QN && c >= 0 && c < QN) { M[r][c] = v; fn[r][c] = true; } };
    [[0, 0], [0, QN - 7], [QN - 7, 0]].forEach(([r0, c0]) => {
      for (let r = -1; r < 8; r++) for (let c = -1; c < 8; c++) {
        let v;
        if (r === -1 || r === 7 || c === -1 || c === 7) v = 0;
        else if (r === 0 || r === 6 || c === 0 || c === 6) v = 1;
        else v = (r >= 2 && r <= 4 && c >= 2 && c <= 4) ? 1 : 0;
        setf(r0 + r, c0 + c, v);
      }
    });
    for (let i = 8; i < QN - 8; i++) { setf(6, i, 1 - (i % 2)); setf(i, 6, 1 - (i % 2)); }
    for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) setf(22 + r, 22 + c, Math.max(Math.abs(r), Math.abs(c)) !== 1 ? 1 : 0);
    setf(QN - 8, 8, 1);
    for (let i = 0; i < 9; i++) { fn[8][i] = true; fn[i][8] = true; }
    for (let i = 0; i < 8; i++) { fn[8][QN - 1 - i] = true; fn[QN - 1 - i][8] = true; }
    return M;
  };
  const place = (M) => {
    let i = 0, up = true;
    for (let c = QN - 1; c > 0; c -= 2) {
      if (c === 6) c -= 1;
      for (let k = 0; k < QN; k++) {
        const r = up ? QN - 1 - k : k;
        for (const cc of [c, c - 1]) if (!fn[r][cc]) { M[r][cc] = i < stream.length ? Number(stream[i]) : 0; i++; }
      }
      up = !up;
    }
  };
  const fmt = (m) => { const v = m; let r = v << 10; for (let i = 14; i > 9; i--) if ((r >> i) & 1) r ^= 0x537 << (i - 10); return ((v << 10) | r) ^ 0x5412; };
  const build = (m) => {
    const M = base(); place(M);
    for (let r = 0; r < QN; r++) for (let c = 0; c < QN; c++) if (!fn[r][c] && MASKS[m](r, c)) M[r][c] ^= 1;
    const f = fmt(m);
    for (let i = 0; i < 15; i++) {
      const b = (f >> i) & 1;
      if (i <= 5) M[i][8] = b; else if (i === 6) M[7][8] = b; else if (i === 7) M[8][8] = b; else if (i === 8) M[8][7] = b; else M[8][14 - i] = b;
      if (i < 8) M[8][QN - 1 - i] = b; else M[QN - 15 + i][8] = b;
    }
    M[QN - 8][8] = 1;
    return M;
  };
  const pen = (M) => {
    let s = 0;
    const T = M[0].map((_, c) => M.map((row) => row[c]));
    [M, T].forEach((L2) => L2.forEach((row) => {
      let run = 1;
      for (let i = 1; i < QN; i++) { if (row[i] === row[i - 1]) run++; else { if (run >= 5) s += run - 2; run = 1; } }
      if (run >= 5) s += run - 2;
      const pat = '10111010000', rp = '00001011101', str = row.join('');
      for (let i = 0; i <= QN - 11; i++) { const w = str.slice(i, i + 11); if (w === pat || w === rp) s += 40; }
    }));
    for (let r = 0; r < QN - 1; r++) for (let c = 0; c < QN - 1; c++) if (M[r][c] === M[r][c + 1] && M[r][c] === M[r + 1][c] && M[r][c] === M[r + 1][c + 1]) s += 3;
    const dark = M.reduce((a, row) => a + row.reduce((x, y) => x + y, 0), 0);
    s += Math.floor(Math.abs(Math.floor((dark * 100) / (QN * QN)) - 50) / 5) * 10;
    return s;
  };
  let best = null, bp = Infinity;
  for (let m = 0; m < 8; m++) { const M = build(m); const p = pen(M); if (p < bp) { bp = p; best = M; } }
  return best;
}

export function drawQr(canvas, text, px = 8) {
  const M = qrMatrix(text), Q = 4, size = (QN + 2 * Q) * px;
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, size, size);
  g.fillStyle = '#17141f';
  for (let r = 0; r < QN; r++) for (let c = 0; c < QN; c++) if (M[r][c]) g.fillRect((c + Q) * px, (r + Q) * px, px, px);
}

/* ================= 文案（三语，放在本文件里，不动 i18n.js） ================= */
const TX = {
  btn: { zh: '📨 邀请好友，赢皮肤', en: '📨 Invite friends, win skins', ar: '📨 ادعُ أصدقاءك واربح سكنات' },
  title: { zh: '邀请好友', en: 'Invite friends', ar: 'ادعُ أصدقاءك' },
  sub: { zh: '每邀请 10 位好友，送你 1 个兑换码，随机解锁 1 款特效罐！', en: 'Every 10 friends you invite earns a redeem code that unlocks a random special can!', ar: 'كل 10 أصدقاء تدعوهم = رمز استبدال يفتح علبة خاصة عشوائية!' },
  prog: { zh: '已邀请 {n} 人 · 再邀请 {m} 人得 1 个兑换码', en: '{n} invited · {m} more for a redeem code', ar: 'تمت دعوة {n} · {m} آخرون للحصول على رمز' },
  done: { zh: '特效罐已全部集齐，太强了！', en: 'You have collected every special can!', ar: 'لقد جمعت كل العلب الخاصة!' },
  how: { zh: '朋友通过你的二维码或链接进来，玩完 1 局才算 1 位有效邀请（同一网络重复邀请只算一次）。', en: 'A friend counts once they open your QR/link and finish 1 game (the same network counts once).', ar: 'يُحتسب الصديق بعد فتح رمزك/رابطك وإنهاء جولة واحدة (الشبكة نفسها تُحتسب مرة واحدة).' },
  share: { zh: '📤 分享给朋友', en: '📤 Share with friends', ar: '📤 شارك مع الأصدقاء' },
  copy: { zh: '📋 复制链接', en: '📋 Copy link', ar: '📋 نسخ الرابط' },
  save: { zh: '💾 保存二维码', en: '💾 Save QR image', ar: '💾 حفظ الصورة' },
  copyCode: { zh: '复制', en: 'Copy', ar: 'نسخ' },
  copied: { zh: '已复制', en: 'Copied', ar: 'تم النسخ' },
  text: { zh: '来玩《跳一跳 3D》！用易拉罐跳方块，扫码或点链接就能玩：', en: 'Play Jump Jump 3D with a soda can! Scan or tap to play:', ar: 'العب قفزة قفزة 3D بعلبة صودا! امسح أو اضغط للعب:' },
  rewards: { zh: '你的兑换码', en: 'Your redeem codes', ar: 'رموز الاستبدال' },
  used: { zh: '已使用', en: 'Used', ar: 'مستخدم' },
  use: { zh: '去兑换', en: 'Redeem', ar: 'استبدل' },
  load: { zh: '加载中…（服务器可能在唤醒，请稍等）', en: 'Loading… (server may be waking up)', ar: 'جارٍ التحميل…' },
  fail: { zh: '暂时连不上服务器，请稍后再试', en: 'Cannot reach the server, try again later', ar: 'تعذر الاتصال بالخادم، حاول لاحقاً' },
  ok: { zh: '🎉 邀请奖励已解锁：{name}', en: '🎉 Invite reward unlocked: {name}', ar: '🎉 تم فتح مكافأة الدعوة: {name}' },
  bad: { zh: '兑换码不对', en: 'Invalid code', ar: 'رمز غير صالح' },
  usedMsg: { zh: '这个兑换码已经用过了', en: 'This code was already used', ar: 'تم استخدام هذا الرمز' },
  none: { zh: '你已经集齐所有特效罐啦，兑换码不会被消耗', en: 'You own every special can already; the code is kept', ar: 'تملك كل العلب؛ لن يُستهلك الرمز' },
  welcome: { zh: '你是通过好友邀请来的，玩完一局就算帮 TA 加 1 人 🎁', en: 'A friend invited you — finish 1 game to count for them 🎁', ar: 'دعاك صديق — أنهِ جولة ليُحتسب له 🎁' },
  close: { zh: '知道了', en: 'Got it', ar: 'حسناً' },
};
const tx = (k, v = {}) => L(TX[k]).replace(/\{(\w+)\}/g, (_, n) => (v[n] != null ? v[n] : ''));

const CSS = `
.inv-modal { text-align: center; max-height: 90vh; overflow-y: auto; }
.inv-sub { margin: 0 0 10px; font-size: 14px; font-weight: 800; line-height: 1.5; }
.inv-prog { margin: 8px 0; font-size: 14px; font-weight: 900; }
.inv-bar { height: 14px; border: 3px solid var(--ink); border-radius: 10px; background: #fff; overflow: hidden; margin: 0 0 6px; }
.inv-bar > i { display: block; height: 100%; width: 0; background: var(--accent, #ff6f4e); transition: width .4s; }
.inv-qr { display: block; width: min(60vw, 220px); height: auto; margin: 10px auto; border: 4px solid var(--ink); border-radius: 14px; background: #fff; image-rendering: pixelated; }
.inv-link { margin: 0 0 8px; font-size: 12px; font-weight: 700; word-break: break-all; color: var(--muted); user-select: text; -webkit-user-select: text; }
.inv-how { margin: 8px 0; font-size: 12.5px; font-weight: 700; line-height: 1.5; color: var(--muted); }
.inv-btns { display: grid; gap: 8px; margin: 8px 0; }
.inv-btns .btn { width: 100%; }
.inv-rw { margin: 10px 0 4px; text-align: start; }
.inv-rw h3 { margin: 0 0 6px; font-size: 14px; font-weight: 900; }
.inv-code { display: flex; align-items: center; gap: 8px; margin: 6px 0; padding: 8px 10px; border: 3px solid var(--ink); border-radius: 12px; background: #fff; }
.inv-code b { flex: 1; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 15px; letter-spacing: .5px; user-select: text; -webkit-user-select: text; direction: ltr; text-align: start; }
.inv-code.used { opacity: .5; }
.inv-code button { border: 3px solid var(--ink); border-radius: 10px; background: #ffe36b; font-weight: 900; padding: 4px 10px; cursor: pointer; font-family: inherit; }
.inv-msg { min-height: 18px; margin: 6px 0; font-size: 13px; font-weight: 800; color: var(--muted); }
#btnInvite { width: 100%; margin: 10px 0 2px; background: #ffe36b; }
`;

export class Invite {
  constructor(game) {
    this.game = game;
    this.status = null;
    if (!document.getElementById('inviteCss')) { const st = document.createElement('style'); st.id = 'inviteCss'; st.textContent = CSS; document.head.appendChild(st); }
    this._captureRef();
    // 入口放在“游戏结束”弹窗里（皮肤/排行榜/首页那一排的下面），主菜单不放
    const row = $('btnHome') && $('btnHome').parentNode;
    if (row) {
      row.insertAdjacentHTML('afterend', '<button class="btn" id="btnInvite" type="button"></button>');
      $('btnInvite').addEventListener('click', () => this.open());
    }
    const host = $('playerModal') ? $('playerModal').parentNode : document.body;
    host.insertAdjacentHTML('beforeend', `
      <div class="modal-wrap hidden" id="inviteModal" role="dialog" aria-modal="true">
        <div class="modal inv-modal"><button class="close" data-invclose aria-label="Close">✕</button>
          <h2 id="invTitle"></h2><p class="inv-sub" id="invSub"></p>
          <p class="inv-prog" id="invProg"></p><div class="inv-bar"><i id="invBar"></i></div>
          <canvas class="inv-qr" id="invQr" width="296" height="296"></canvas>
          <p class="inv-link" id="invLink"></p>
          <div class="inv-btns"><button class="btn primary" id="invShare" type="button"></button><button class="btn" id="invCopy" type="button"></button><button class="btn" id="invSave" type="button"></button></div>
          <p class="inv-msg" id="invMsg" aria-live="polite"></p>
          <div class="inv-rw hidden" id="invRw"><h3 id="invRwH"></h3><div id="invCodes"></div></div>
          <p class="inv-how" id="invHow"></p>
          <button class="btn big" data-invclose id="invOk" type="button"></button>
        </div></div>`);
    $('inviteModal').addEventListener('click', (e) => {
      if (e.target === $('inviteModal') || e.target.closest('[data-invclose]')) $('inviteModal').classList.add('hidden');
      const cp = e.target.closest('[data-invcopy]'); if (cp) this._copy(cp.dataset.invcopy);
      const us = e.target.closest('[data-invuse]'); if (us) this._goRedeem(us.dataset.invuse);
    });
    $('invShare').addEventListener('click', () => this._share());
    $('invCopy').addEventListener('click', () => this._copy(this._link()));
    $('invSave').addEventListener('click', () => this._saveImg());
    // 商店里输入 INV- 开头的兑换码：在原来的兑换逻辑之前截住，交给服务器处理
    document.addEventListener('submit', (e) => {
      if (!e.target || e.target.id !== 'redeemForm') return;
      const inp = $('redeemInput');
      if (!inp || !/^INV-/i.test(inp.value.trim())) return;
      e.preventDefault(); e.stopImmediatePropagation();
      this._redeemCode(inp.value.trim());
    }, true);
    this._labels();
    onLangChange(() => { this._labels(); if (this.status) this._render(); });
    this._claimLoop();
  }

  _labels() {
    const set = (id, k) => { const el = $(id); if (el) el.textContent = tx(k); };
    set('btnInvite', 'btn'); set('invTitle', 'title'); set('invSub', 'sub'); set('invShare', 'share'); set('invCopy', 'copy'); set('invSave', 'save');
    set('invHow', 'how'); set('invOk', 'close'); set('invRwH', 'rewards');
  }

  _base() { return LEADERBOARD_API.baseUrl || ''; }
  async _post(path, body) {
    const r = await fetch(this._base() + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
  }
  _id() { const p = Storage.getPlayer(); return { id: p.id, secret: p.secret }; }
  _link() { return this.status && this.status.code ? SITE + '?r=' + this.status.code : SITE; }

  /* ---------- 被邀请的一方：记下邀请码，玩完 1 局后向服务器登记 ---------- */
  _captureRef() {
    try {
      const u = new URL(location.href); const r = (u.searchParams.get('r') || '').toUpperCase();
      if (!/^[A-HJ-NP-Z2-9]{8}$/.test(r)) return;
      u.searchParams.delete('r'); history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
      const st = Storage.getStats();
      if (!localStorage.getItem(REF_KEY) && (st.games || 0) === 0 && Storage.getHighScore() === 0) {   // 只有全新的设备才算
        localStorage.setItem(REF_KEY, JSON.stringify({ ref: r, tries: 0 }));
        setTimeout(() => { if (this.game.ui && this.game.ui.toast) this.game.ui.toast(tx('welcome'), 3500); }, 1500);
      }
    } catch (e) { /* 忽略 */ }
  }
  _claimLoop() {
    const tick = async () => {
      let v; try { v = JSON.parse(localStorage.getItem(REF_KEY) || 'null'); } catch (e) { v = null; }
      if (!v || !this._base()) return;
      if ((Storage.getStats().games || 0) < 1) return;
      v.tries = (v.tries || 0) + 1;
      if (v.tries > 40) { localStorage.removeItem(REF_KEY); return; }
      localStorage.setItem(REF_KEY, JSON.stringify(v));
      try {
        await syncPlayer();
        const j = await this._post('/api/invite/claim', { ...this._id(), ref: v.ref });
        if (j && (j.done || (j.error && j.error !== 'rate'))) localStorage.removeItem(REF_KEY);   // 登记成功，或这个邀请无效/不算：不再重试
      } catch (e) { /* 网络问题：下次再试 */ }
    };
    setInterval(tick, 20000); setTimeout(tick, 5000);
  }

  /* ---------- 邀请人的弹窗 ---------- */
  async open() {
    this._labels();
    $('inviteModal').classList.remove('hidden');
    $('invMsg').textContent = tx('load');
    drawQr($('invQr'), SITE + '?r=' + (this.status ? this.status.code : 'AAAAAAAA'), 8);
    $('invLink').textContent = '';
    await this.refresh();
  }
  async refresh() {
    try {
      let j = await this._post('/api/invite/status', this._id());
      if (!j.ok && j.error === 'forbidden') { await syncPlayer(); j = await this._post('/api/invite/status', this._id()); }
      if (!j.ok) throw new Error(j.error || 'fail');
      this.status = j; this._render();
      $('invMsg').textContent = '';
    } catch (e) { $('invMsg').textContent = tx('fail'); }
  }
  _render() {
    const s = this.status;
    const into = s.count % s.step;
    $('invProg').textContent = s.allCollected ? tx('done') : tx('prog', { n: s.count, m: s.next });
    $('invBar').style.width = (s.allCollected ? 100 : (into / s.step) * 100) + '%';
    drawQr($('invQr'), this._link(), 8);
    $('invLink').textContent = this._link();
    const rw = $('invRw');
    rw.classList.toggle('hidden', !s.rewards.length);
    $('invCodes').innerHTML = s.rewards.map((r) => `<div class="inv-code${r.used ? ' used' : ''}"><b>${esc(r.code)}</b>${r.used ? `<span>${esc(tx('used'))}</span>` : `<button type="button" data-invcopy="${esc(r.code)}">${esc(tx('copyCode'))}</button><button type="button" data-invuse="${esc(r.code)}">${esc(tx('use'))}</button>`}</div>`).join('');
  }
  async _copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e2) { /* 忽略 */ } ta.remove(); }
    $('invMsg').textContent = tx('copied');
  }
  async _share() {
    const url = this._link(), text = tx('text');
    try {
      const blob = await new Promise((res) => $('invQr').toBlob(res, 'image/png'));
      const file = blob ? new File([blob], 'Jump3D-QR.png', { type: 'image/png' }) : null;
      if (navigator.canShare && file && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: text + ' ' + url }); return; }
      if (navigator.share) { await navigator.share({ text, url }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    this._copy(text + ' ' + url);
  }
  _saveImg() {
    const a = document.createElement('a'); a.download = 'Jump3D-invite-QR.png'; a.href = $('invQr').toDataURL('image/png');
    document.body.appendChild(a); a.click(); a.remove();
  }
  _goRedeem(code) {
    $('inviteModal').classList.add('hidden');
    const ui = this.game.ui; if (!ui) return;
    ui.openSkins();
    setTimeout(() => { const i = $('redeemInput'); if (i) { i.value = code; i.focus({ preventScroll: true }); } }, 100);
  }

  /* ---------- 兑换 INV- 码 ---------- */
  async _redeemCode(code) {
    const ui = this.game.ui, msg = $('redeemMsg');
    const say = (text, cls) => { if (msg) { msg.textContent = text; msg.className = 'redeem-msg ' + (cls || ''); } };
    say(tx('load'), '');
    try {
      let j = await this._post('/api/invite/redeem', { ...this._id(), code });
      if (!j.ok && j.error === 'forbidden') { await syncPlayer(); j = await this._post('/api/invite/redeem', { ...this._id(), code }); }
      if (j.ok) {
        const id = String(j.skin).replace('player:', '');
        const sk = PLAYER_SKINS.find((k) => k.id === id);
        const st = ui.skins.state;
        const key = 'player:' + id;
        if (!st.unlocked.includes(key)) st.unlocked.push(key);
        Storage.saveSkinState(st);
        const m = tx('ok', { name: sk ? L(sk.name) : id });
        say(m, 'ok');
        $('redeemInput').value = '';
        ui.skinTab = 'player'; ui.skinPick = id; ui._renderSkins(); ui.toast(m);
        return;
      }
      say(j.error === 'used' ? tx('usedMsg') : j.error === 'none' ? tx('none') : tx('bad'), 'err');
    } catch (e) { say(tx('fail'), 'err'); }
  }
}
