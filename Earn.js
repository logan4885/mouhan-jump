// 靠分数解锁皮肤（普通模式）：单局最高分每满 100 分 → 服务器发 1 款随机特效罐。
// 分数由服务器核对（开局记时间，交分时按“用时 × 每秒最多得分”检查），皮肤也由服务器发，客户端只负责显示。
import { Storage } from './Storage.js?v=20261114a';
import { LEADERBOARD_API, syncPlayer } from './Leaderboard.js?v=20261114a';
import { L } from './i18n.js?v=20261114a';
import { PLAYER_SKINS } from './SkinManager.js?v=20261114a';

const tri = (zh, en, ar) => ({ zh, en, ar });
const TX = {
  got: tri('🎉 单局 {n} 分！解锁新罐子：{name}', '🎉 {n} points in one run! New can unlocked: {name}', '🎉 {n} نقطة في جولة واحدة! علبة جديدة: {name}'),
  next: tri('🎯 单局再打到 {next} 分，解锁下一款特效罐（你的最高：{best}）', '🎯 Reach {next} points in one run to unlock the next special can (your best: {best})', '🎯 اصل إلى {next} نقطة في جولة واحدة لفتح العلبة التالية (أفضل نتيجة: {best})'),
};
const fmt = (k, v) => L(TX[k]).replace(/\{(\w+)\}/g, (_, x) => (x in v ? v[x] : ''));

export const Earn = {
  info: null,
  async _post(path, body) {
    const base = LEADERBOARD_API.baseUrl; if (!base) return null;
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const go = async () => {
        const p = Storage.getPlayer();
        const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, secret: p.secret, ...body }), signal: ctrl.signal });
        return r.json();
      };
      let j = await go();
      if (j && !j.ok && j.error === 'forbidden') { await syncPlayer(); j = await go(); }   // 新玩家还没在服务器上登记：先同步一次再试
      return j;
    } catch (e) { return null; }
    finally { clearTimeout(timer); }
  },
  /** 普通模式开一局：告诉服务器开始时间（离线 / 失败就算了，这一局不计入解锁） */
  async start() {
    const j = await this._post('/api/run/start', {});
    if (j && j.ok) this.info = j;
  },
  /** 一局结束：交分，服务器核对后发皮肤。game 用来更新本地皮肤状态和弹提示 */
  async finish(game, score) {
    const j = await this._post('/api/run/finish', { score: Math.floor(score) });
    if (!j || !j.ok) return;
    this.info = j;
    const ui = game && game.ui;
    if (j.granted && j.granted.length) {
      const st = (game.skins && game.skins.state) || (ui && ui.skins && ui.skins.state);
      const names = j.granted.map((id) => { const sk = PLAYER_SKINS.find((k) => k.id === id); return sk ? L(sk.name) : id; });
      if (st) {
        for (const id of j.granted) { const key = 'player:' + id; if (!st.unlocked.includes(key)) st.unlocked.push(key); }
        Storage.saveSkinState(st);
        if (ui && ui._renderSkins) { try { ui._renderSkins(); } catch (e) { /* 忽略 */ } }
      }
      if (ui && ui.toast) ui.toast(fmt('got', { n: Math.floor(j.earned * j.step), name: names.join(' / ') }), 5000);
    } else if (j.next != null && ui && ui.toast) {
      ui.toast(fmt('next', { next: j.next, best: j.allBest }), 3600);
    }
  },
};
