// 本地存储封装：所有读写都带 try/catch（隐私模式 / 禁用存储时游戏照样能玩）
const PREFIX = 'jump3d:';
const memory = {}; // localStorage 不可用时的内存兜底

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return key in memory ? memory[key] : fallback;
    return JSON.parse(raw);
  } catch (e) {
    return key in memory ? memory[key] : fallback;
  }
}

const SYNC_KEYS = new Set(['highScore', 'skins:v2', 'nickname', 'stats']);
const changeListeners = [];

function write(key, value) {
  memory[key] = value;
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* 忽略 */ }
  if (SYNC_KEYS.has(key)) changeListeners.forEach((fn) => { try { fn(key); } catch (e) { /* 忽略 */ } });
}

function randomHex(bytes) {
  const a = new Uint8Array(bytes);
  if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
  else for (let i = 0; i < bytes; i++) a[i] = Math.floor(Math.random() * 256);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const Storage = {
  // ---- 玩家身份：首次打开自动生成（id 公开，secret 只留在本机，服务器只存它的哈希）----
  getPlayer() {
    let p = read('player', null);
    if (!p || !/^[0-9a-f]{32}$/.test(p.id || '') || !/^[0-9a-f]{32,64}$/.test(p.secret || '')) {
      p = { id: randomHex(16), secret: randomHex(24) };
      write('player', p);
    }
    return p;
  },
  /** 数据变化时的回调（最高分 / 皮肤 / 昵称 / 统计），用于同步到服务器 */
  onChange(fn) { changeListeners.push(fn); },

  // ---- 最高分 ----
  getHighScore() { return Number(read('highScore', 0)) || 0; },
  /** 若 score 更高则写入，返回是否刷新纪录 */
  saveHighScore(score) {
    if (score > this.getHighScore()) { write('highScore', score); return true; }
    return false;
  },

  // ---- 皮肤 ----
  getSkinState() {
    const s = read('skins:v2', null) || {};
    return {
      unlocked: Array.isArray(s.unlocked) ? s.unlocked : ['player:cola', 'block:candy'],
      player: s.player || 'cola',
      block: s.block || 'candy',
    };
  },
  saveSkinState(state) { write('skins:v2', state); },

  // ---- 昵称（用于排行榜）----
  getNickname() { return read('nickname', '') || ''; },
  setNickname(name) { write('nickname', String(name || '').slice(0, 12)); },

  // ---- 已用过的兑换码（只存哈希）----
  getUsedCodes() { const v = read('usedCodes', []); return Array.isArray(v) ? v : []; },
  addUsedCode(h) { const v = this.getUsedCodes(); if (!v.includes(h)) { v.push(h); write('usedCodes', v); } },

  // ---- 语言 ----
  getLang() { return read('lang', '') || ''; },
  setLang(l) { write('lang', l); },

  // ---- 游戏次数等统计 ----
  getStats() { return read('stats', { games: 0, perfects: 0 }); },
  saveStats(stats) { write('stats', stats); },
};
