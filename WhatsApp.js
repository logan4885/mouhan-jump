// 填 WhatsApp 号码领随机皮肤：必须登录账号 + 勾选同意联系；每个账号 / 每个号码只能领一次。
// 号码只做格式检查（没有验证码），名单存在服务器（wa_leads 表），管理页可查看和导出。
import { Storage } from './Storage.js?v=20261112c';
import { LEADERBOARD_API, syncPlayer } from './Leaderboard.js?v=20261112c';
import { L, onLangChange, getLang } from './i18n.js?v=20261112c';
import { PLAYER_SKINS } from './SkinManager.js?v=20261112c';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tri = (zh, en, ar) => ({ zh, en, ar });
const DONE_KEY = 'jump3d_wa_done';

const TX = {
  btn: tri('🎁 填 WhatsApp，领随机皮肤', '🎁 Add WhatsApp, get a free skin', '🎁 أضف واتساب واحصل على سكن مجاني'),
  title: tri('🎁 领取随机皮肤', '🎁 Get a random skin', '🎁 احصل على سكن عشوائي'),
  sub: tri('留下你的 WhatsApp 号码，立刻解锁 1 款随机特效罐。每个账号可领 1 次。', 'Share your WhatsApp number to unlock 1 random special can instantly. One per account.', 'شارك رقم واتساب لفتح علبة خاصة عشوائية فوراً. مرة واحدة لكل حساب.'),
  ph: tri('+20 1xx xxx xxxx', '+20 1xx xxx xxxx', '+20 1xx xxx xxxx'),
  hint: tri('请带国家区号，例如 埃及 +20、中国 +86、沙特 +966。', 'Include the country code, e.g. Egypt +20, China +86, Saudi +966.', 'أدخل رمز الدولة، مثل مصر ‎+20 والسعودية ‎+966.'),
  consent: tri('我同意通过 WhatsApp 收到活动、新皮肤和游戏更新的消息。可随时回复 STOP 退订，也可联系我们删除号码。', 'I agree to receive WhatsApp messages about events, new skins and game updates. Reply STOP anytime to opt out, or contact us to delete my number.', 'أوافق على تلقي رسائل واتساب عن الفعاليات والسكنات الجديدة وتحديثات اللعبة. أرسل STOP في أي وقت لإلغاء الاشتراك، أو تواصل معنا لحذف رقمي.'),
  privacy: tri('隐私政策', 'Privacy Policy', 'سياسة الخصوصية'),
  go: tri('领取皮肤', 'Claim my skin', 'احصل على السكن'),
  loginNote: tri('先登录账号才能领取（每个账号限 1 次，防止刷号）。', 'Sign in first to claim (one per account).', 'سجّل الدخول أولاً للحصول عليه (مرة لكل حساب).'),
  loginBtn: tri('👤 去登录', '👤 Sign in', '👤 تسجيل الدخول'),
  close: tri('关闭', 'Close', 'إغلاق'),
  loading: tri('提交中…', 'Submitting…', 'جارٍ الإرسال…'),
  ok: tri('🎉 恭喜！已解锁【{name}】。我们会在 WhatsApp 上联系你。', '🎉 Unlocked [{name}]! We will contact you on WhatsApp.', '🎉 تم فتح [{name}]! سنتواصل معك عبر واتساب.'),
  doneNote: tri('✅ 你已经领取过了，谢谢！', '✅ You have already claimed it — thank you!', '✅ لقد حصلت عليه بالفعل — شكراً!'),
  e_login_required: tri('请先登录账号。', 'Please sign in first.', 'سجّل الدخول أولاً.'),
  e_no_consent: tri('请先勾选同意。', 'Please tick the consent box.', 'يرجى تحديد خانة الموافقة.'),
  e_bad_phone: tri('号码格式不对，请检查区号和位数。', 'That number looks wrong — check the country code and length.', 'الرقم غير صحيح — تحقق من رمز الدولة والطول.'),
  e_need_cc: tri('请带上国家区号（不要以 0 开头），例如 +20 1xx…', 'Please start with the country code (not 0), e.g. +20 1xx…', 'ابدأ برمز الدولة (وليس 0)، مثل ‎+20 1xx…'),
  e_fake: tri('这个号码看起来不像真实号码，请填你自己的 WhatsApp 号码。', 'That looks like a fake number — please enter your own WhatsApp number.', 'يبدو هذا رقماً غير حقيقي — أدخل رقم واتساب الخاص بك.'),
  e_already: tri('这个账号已经领取过了。', 'This account has already claimed it.', 'هذا الحساب حصل عليه بالفعل.'),
  e_phone_used: tri('这个号码已经被使用过了。', 'This number has already been used.', 'هذا الرقم مستخدم بالفعل.'),
  e_none: tri('你已经集齐全部特效罐啦，不需要再领了！', 'You already own every special can!', 'لديك كل العلب الخاصة بالفعل!'),
  e_too_many: tri('今天这个网络领取的人太多了，明天再试。', 'Too many claims from this network today — try tomorrow.', 'عدد كبير من الطلبات من هذه الشبكة اليوم — حاول غداً.'),
  e_too_many_requests: tri('操作太频繁，请稍后再试。', 'Too many requests — try again shortly.', 'طلبات كثيرة — حاول لاحقاً.'),
  e_forbidden: tri('身份验证失败，请刷新页面。', 'Identity check failed — refresh the page.', 'فشل التحقق — أعد تحميل الصفحة.'),
  offline: tri('连不上服务器，稍后再试。', "Can't reach the server. Try again shortly.", 'تعذّر الاتصال بالخادم. حاول لاحقاً.'),
};
const tx = (k, v = {}) => L(TX[k]).replace(/\{(\w+)\}/g, (_, n) => (v[n] != null ? v[n] : ''));
const PRIVACY = { zh: 'privacy.html#zh', en: 'privacy.html#en', ar: 'privacy.html#ar' };

const CSS = `
#btnWa { color: var(--accent); font-weight: 900; }
#btnWa.hidden { display: none; }
.wa-modal { width: min(100%, 400px); }
.wa-sub { margin: 0 0 12px; font-size: 14px; font-weight: 700; color: var(--muted); line-height: 1.45; }
.wa-form { display: grid; gap: 10px; text-align: start; }
.wa-form input[type=tel] { width: 100%; font: 800 17px var(--font); color: var(--ink); padding: 12px; border: 3px solid var(--ink); border-radius: 14px; background: #fff; -webkit-user-select: text; user-select: text; direction: ltr; text-align: start; }
.wa-form input[type=tel]:focus { outline: 3px solid var(--accent-2); outline-offset: 1px; }
.wa-hint { margin: -4px 0 0; font-size: 12px; font-weight: 700; color: var(--muted); }
.wa-consent { display: flex; gap: 10px; align-items: flex-start; font-size: 12.5px; font-weight: 700; line-height: 1.45; color: var(--ink); cursor: pointer; }
.wa-consent input { flex: none; width: 20px; height: 20px; margin-top: 1px; accent-color: var(--accent); }
.wa-consent a { color: var(--accent); }
.wa-msg { min-height: 20px; margin: 8px 0 0; font-size: 13.5px; font-weight: 800; color: var(--accent); }
.wa-msg.ok { color: #1f9d55; }
.wa-note { margin: 6px 0 10px; font-size: 14px; font-weight: 800; color: var(--muted); }
`;

export class WhatsApp {
  constructor(game) {
    this.game = game;
    this.busy = false;
    if (!$('waCss')) { const st = document.createElement('style'); st.id = 'waCss'; st.textContent = CSS; document.head.appendChild(st); }
    const anchor = $('btnInstall') || $('btnAcctStart');
    if (anchor) {
      anchor.insertAdjacentHTML('beforebegin', '<button class="link-btn" id="btnWa" type="button"></button>');
      $('btnWa').addEventListener('click', () => this.open());
    }
    const host = $('playerModal') ? $('playerModal').parentNode : document.body;
    host.insertAdjacentHTML('beforeend', `
      <div class="modal-wrap hidden" id="waModal" role="dialog" aria-modal="true">
        <div class="modal wa-modal"><button class="close" data-waclose aria-label="Close">✕</button>
          <h2 id="waTitle"></h2><p class="wa-sub" id="waSub"></p>
          <form class="wa-form hidden" id="waForm" autocomplete="off" novalidate>
            <input id="waPhone" type="tel" inputmode="tel" maxlength="24" />
            <p class="wa-hint" id="waHint"></p>
            <label class="wa-consent"><input type="checkbox" id="waConsent" /><span><span id="waConsentTx"></span> <a id="waPriv" href="privacy.html" target="_blank" rel="noopener"></a></span></label>
            <button class="btn primary big" id="waGo" type="submit" disabled></button>
          </form>
          <div class="hidden" id="waLogin"><p class="wa-note" id="waLoginNote"></p><button class="btn big" id="waLoginBtn" type="button"></button></div>
          <div class="hidden" id="waDone"><p class="wa-note" id="waDoneNote"></p><button class="btn big" data-waclose type="button" id="waOk"></button></div>
          <p class="wa-msg" id="waMsg" role="status" aria-live="polite"></p>
        </div></div>`);
    $('waModal').addEventListener('click', (e) => { if (e.target === $('waModal') || e.target.closest('[data-waclose]')) this.close(); });
    $('waForm').addEventListener('submit', (e) => { e.preventDefault(); this._claim(); });
    const upd = () => { $('waGo').disabled = this.busy || !$('waConsent').checked || $('waPhone').value.replace(/\D/g, '').length < 8; };
    $('waPhone').addEventListener('input', upd); $('waConsent').addEventListener('change', upd); this._upd = upd;
    $('waLoginBtn').addEventListener('click', () => { this.close(); const b = $('btnAcctStart'); if (b) b.click(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('waModal').classList.contains('hidden')) this.close(); });
    this._labels();
    onLangChange(() => this._labels());
    try { if (localStorage.getItem(DONE_KEY) === Storage.getPlayer().id) $('btnWa').classList.add('hidden'); } catch (e) { /* 忽略 */ }
  }

  _labels() {
    const set = (id, k) => { const el = $(id); if (el) el.textContent = tx(k); };
    set('btnWa', 'btn'); set('waTitle', 'title'); set('waSub', 'sub'); set('waHint', 'hint'); set('waConsentTx', 'consent'); set('waPriv', 'privacy');
    set('waGo', 'go'); set('waLoginNote', 'loginNote'); set('waLoginBtn', 'loginBtn'); set('waDoneNote', 'doneNote'); set('waOk', 'close');
    const p = $('waPhone'); if (p) p.placeholder = tx('ph');
    const a = $('waPriv'); if (a) a.href = PRIVACY[getLang()] || PRIVACY.en;
  }

  _base() { return LEADERBOARD_API.baseUrl || ''; }
  _id() { const p = Storage.getPlayer(); return { id: p.id, secret: p.secret }; }
  async _post(path, body) {
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const r = await fetch(this._base() + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...this._id(), ...body }), signal: ctrl.signal });
      return await r.json();
    } finally { clearTimeout(timer); }
  }
  _msg(text, cls) { const m = $('waMsg'); m.textContent = text || ''; m.className = 'wa-msg ' + (cls || ''); }

  async open() {
    this._msg('');
    const acc = !!Storage.getAccount();
    $('waForm').classList.toggle('hidden', !acc); $('waLogin').classList.toggle('hidden', acc); $('waDone').classList.add('hidden');
    $('waModal').classList.remove('hidden');
    this._upd();
    if (!acc) return;
    try {                                   // 已经领过：直接显示“已领取”
      let j = await this._post('/api/wa/status', {});
      if (!j.ok && j.error === 'forbidden') { await syncPlayer(); j = await this._post('/api/wa/status', {}); }
      if (j.ok && j.claimed) this._showDone();
    } catch (e) { /* 离线：照常显示表单，提交时再报错 */ }
  }

  close() { $('waModal').classList.add('hidden'); }

  _showDone() {
    $('waForm').classList.add('hidden'); $('waDone').classList.remove('hidden');
    try { localStorage.setItem(DONE_KEY, Storage.getPlayer().id); } catch (e) { /* 忽略 */ }
    $('btnWa').classList.add('hidden');
  }

  async _claim() {
    if (this.busy) return;
    this.busy = true; this._upd(); this._msg(tx('loading'), '');
    const body = { phone: $('waPhone').value.trim(), consent: $('waConsent').checked, lang: getLang() };
    try {
      let j = await this._post('/api/wa/claim', body);
      if (!j.ok && j.error === 'forbidden') { await syncPlayer(); j = await this._post('/api/wa/claim', body); }
      if (j.ok) {
        const id = String(j.skin).replace('player:', '');
        const sk = PLAYER_SKINS.find((k) => k.id === id);
        const ui = this.game.ui; const st = ui && ui.skins && ui.skins.state;
        if (st) {
          const key = 'player:' + id; if (!st.unlocked.includes(key)) st.unlocked.push(key);
          Storage.saveSkinState(st);
          ui.skinTab = 'player'; ui.skinPick = id; if (ui._renderSkins) ui._renderSkins();
        }
        const text = tx('ok', { name: sk ? L(sk.name) : id });
        this._msg(text, 'ok'); if (ui && ui.toast) ui.toast(text, 3500);
        this._showDone();
      } else if (j.error === 'already') { this._showDone(); this._msg('', ''); }
      else this._msg(TX['e_' + j.error] ? tx('e_' + j.error) : tx('offline'), '');
    } catch (e) { this._msg(tx('offline'), ''); }
    finally { this.busy = false; this._upd(); }
  }
}
