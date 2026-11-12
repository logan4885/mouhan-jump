// 成绩里程碑：打到一定分数 / Roguelike 分数，自动送 1 款还没拥有的随机特效罐。
// 纯客户端：皮肤写进 skins 存档，同步到服务器时会自动合并保存（服务端不用改）。
// 想调难度只改下面的 TIERS 数字。
import { Storage } from './Storage.js?v=20261114a';
import { L, onLangChange } from './i18n.js?v=20261114a';
import { PLAYER_SKINS } from './SkinManager.js?v=20261114a';

const $ = (id) => document.getElementById(id);
const tri = (zh, en, ar) => ({ zh, en, ar });

// mode: 'normal' = 普通模式最高分；'rogue' = Roguelike 模式最高分
export const TIERS = [
  { id: 'n1', mode: 'normal', need: 100 },
  { id: 'n2', mode: 'normal', need: 200 },
  { id: 'n3', mode: 'normal', need: 350 },
  { id: 'r1', mode: 'rogue', need: 500 },
  { id: 'r2', mode: 'rogue', need: 1500 },
  { id: 'r3', mode: 'rogue', need: 3000 },
];

const TX = {
  btn: tri('🏆 成绩挑战', '🏆 Challenges', '🏆 التحديات'),
  title: tri('🏆 成绩挑战', '🏆 Score challenges', '🏆 تحديات النتائج'),
  sub: tri('打到目标分数，自动送你 1 款随机特效罐。越往后越难！', 'Hit a target score to win 1 random special can. It gets harder!', 'حقق النتيجة المطلوبة لتربح علبة خاصة عشوائية. وتزداد صعوبة!'),
  normal: tri('普通模式最高分', 'Classic best score', 'أعلى نتيجة في الوضع العادي'),
  rogue: tri('Roguelike 最高分', 'Roguelike best score', 'أعلى نتيجة في الرُّوغ لايك'),
  done: tri('已达成', 'Done', 'تم'),
  won: tri('🎉 挑战达成！获得【{name}】', '🎉 Challenge complete! Won [{name}]', '🎉 اكتمل التحدي! ربحت [{name}]'),
  wonAll: tri('🎉 挑战达成！你已集齐全部特效罐', '🎉 Challenge complete! You own every special can', '🎉 اكتمل التحدي! لديك كل العلب الخاصة'),
  close: tri('关闭', 'Close', 'إغلاق'),
};
const tx = (k, v = {}) => L(TX[k]).replace(/\{(\w+)\}/g, (_, n) => (v[n] != null ? v[n] : ''));

const CSS = `
#btnMs { color: var(--accent); font-weight: 900; }
.ms-modal { width: min(100%, 400px); }
.ms-list { display: grid; gap: 10px; text-align: start; margin: 4px 0 12px; }
.ms-item { border: 3px solid var(--ink); border-radius: 14px; padding: 9px 12px; background: #fff; }
.ms-item.done { background: #e9f9ee; }
.ms-row { display: flex; justify-content: space-between; gap: 8px; font-size: 14px; font-weight: 800; color: var(--ink); }
.ms-bar { height: 10px; margin-top: 7px; border: 2px solid var(--ink); border-radius: 8px; background: #eee; overflow: hidden; }
.ms-bar > i { display: block; height: 100%; background: var(--accent); }
.ms-item.done .ms-bar > i { background: #1f9d55; }
`;

export class Milestones {
  constructor(game) {
    this.game = game;
    this.key = null;
    if (!$('msCss')) { const st = document.createElement('style'); st.id = 'msCss'; st.textContent = CSS; document.head.appendChild(st); }
    const anchor = $('btnWa') || $('btnInstall') || $('btnAcctStart');
    if (anchor) {
      anchor.insertAdjacentHTML('beforebegin', '<button class="link-btn" id="btnMs" type="button"></button>');
      $('btnMs').addEventListener('click', () => this.open());
    }
    const host = $('playerModal') ? $('playerModal').parentNode : document.body;
    host.insertAdjacentHTML('beforeend', `
      <div class="modal-wrap hidden" id="msModal" role="dialog" aria-modal="true">
        <div class="modal ms-modal"><button class="close" data-msclose aria-label="Close">✕</button>
          <h2 id="msTitle"></h2><p class="wa-sub" id="msSub"></p>
          <div class="ms-list" id="msList"></div>
          <button class="btn big" data-msclose type="button" id="msOk"></button>
        </div></div>`);
    $('msModal').addEventListener('click', (e) => { if (e.target === $('msModal') || e.target.closest('[data-msclose]')) this.close(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('msModal').classList.contains('hidden')) this.close(); });
    this._labels();
    onLangChange(() => { this._labels(); this._render(); });
    this._check();
    setInterval(() => this._check(), 2000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this._check(); });
  }

  _labels() {
    const set = (id, k) => { const el = $(id); if (el) el.textContent = tx(k); };
    set('btnMs', 'btn'); set('msTitle', 'title'); set('msSub', 'sub'); set('msOk', 'close');
  }

  _stor() {
    const id = Storage.getPlayer().id;
    const k = 'jump3d_ms_' + id;
    let v = null;
    try { v = JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { /* 忽略 */ }
    return { k, got: Array.isArray(v) ? v : [] };
  }
  _score(mode) { return mode === 'rogue' ? Storage.getRogueBest() : Storage.getHighScore(); }

  /** 检查有没有新达成的档位；每达成一档送一款随机皮肤 */
  _check() {
    let s; try { s = this._stor(); } catch (e) { return; }
    const ui = this.game && this.game.ui; const st = ui && ui.skins && ui.skins.state;
    if (!st) return;
    let changed = false;
    for (const t of TIERS) {
      if (s.got.includes(t.id) || this._score(t.mode) < t.need) continue;
      s.got.push(t.id); changed = true;
      const pool = PLAYER_SKINS.filter((k) => k.unlock === 'code' && !st.unlocked.includes('player:' + k.id));
      let text;
      if (pool.length) {
        const a = new Uint32Array(1); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : (a[0] = Math.random() * 4294967296);
        const sk = pool[a[0] % pool.length];
        st.unlocked.push('player:' + sk.id);
        Storage.saveSkinState(st);
        if (ui._renderSkins) { try { ui._renderSkins(); } catch (e) { /* 忽略 */ } }
        text = tx('won', { name: L(sk.name) });
      } else text = tx('wonAll');
      if (ui.toast) ui.toast(text, 4000);
    }
    if (changed) { try { localStorage.setItem(s.k, JSON.stringify(s.got)); } catch (e) { /* 忽略 */ } this._render(); }
  }

  open() { this._check(); this._render(); $('msModal').classList.remove('hidden'); }
  close() { $('msModal').classList.add('hidden'); }

  _render() {
    const box = $('msList'); if (!box) return;
    let s; try { s = this._stor(); } catch (e) { s = { got: [] }; }
    box.innerHTML = TIERS.map((t) => {
      const cur = Math.min(this._score(t.mode), t.need);
      const done = s.got.includes(t.id) || cur >= t.need;
      return `<div class="ms-item${done ? ' done' : ''}"><div class="ms-row"><span>${done ? '✅ ' : '🎯 '}${tx(t.mode)} ≥ ${t.need}</span><span>${done ? tx('done') : cur + ' / ' + t.need}</span></div><div class="ms-bar"><i style="width:${Math.round((cur / t.need) * 100)}%"></i></div></div>`;
    }).join('');
  }
}
