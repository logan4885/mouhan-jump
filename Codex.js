// 图鉴：记录“见过 / 拿过”的 Buff 与“觉醒过”的联动。存在浏览器本地（独立的 key，不动 Storage）。
const KEY = 'jump3d_codex_v1';
let cache = null;
function load() {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { cache = {}; }
  cache.buffs = cache.buffs || {}; cache.syns = cache.syns || {}; cache.seen = cache.seen || {};
  return cache;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* 忽略 */ } }
export const Codex = {
  get() { return load(); },
  seen(id) { load().seen[id] = (cache.seen[id] || 0) + 1; save(); },       // 在抽卡里出现过
  took(id) { const c = load(); c.buffs[id] = (c.buffs[id] || 0) + 1; c.seen[id] = c.seen[id] || 1; save(); },   // 选过
  awaken(id) { const c = load(); const first = !c.syns[id]; c.syns[id] = (c.syns[id] || 0) + 1; save(); return first; },
  hasBuff(id) { return !!load().seen[id] || !!load().buffs[id]; },
  hasSyn(id) { return !!load().syns[id]; },
};
