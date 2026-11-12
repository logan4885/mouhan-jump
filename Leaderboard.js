// 排行榜：填写 baseUrl 后读写真实后端（Node + MySQL）；为空则使用本地 Mock JSON
//
// 后端接口（见 jump3d-server/server.js）：
//   GET  {baseUrl}/api/leaderboard/top?limit=10
//        -> [{ id, nickname, avatar, color, score, equipped }]
//   POST {baseUrl}/api/sync   body: { id, secret, nickname, score, perfects, games, unlocked[], equipped }
//        -> { ok, rank, score }
//   GET  {baseUrl}/api/player/:id
//        -> { ok, player: { id, nickname, score, rank, perfects, games, equipped, unlocked[], total, avatar, color } }

import { Storage } from './Storage.js?v=20261114a';

export const LEADERBOARD_API = {
  baseUrl: 'https://mouhan-jump-api.onrender.com',            // 部署后端后填这里，例如 'https://jump3d-api.onrender.com'；为空则使用 Mock 数据
  topPath: '/api/leaderboard/top',
  syncPath: '/api/sync',
  playerPath: '/api/player/',
  timeoutMs: 15000,          // Render 免费服务器休眠后首次唤醒较慢
  syncDelayMs: 1500,
};

const MOCK_URL = new URL('./leaderboard.mock.json', import.meta.url);

// 万一 JSON 文件加载失败（例如直接双击打开 html），使用内置兜底数据
const FALLBACK = [
  { id: 'f1', nickname: '跳跳虎', avatar: '🐯', color: '#ffb347', score: 628 },
  { id: 'f2', nickname: 'Nile Runner', avatar: '🦊', color: '#ff8a65', score: 517 },
  { id: 'f3', nickname: '小方块', avatar: '🧊', color: '#84b6f4', score: 433 },
  { id: 'f4', nickname: 'Sara', avatar: '🐱', color: '#ffc4dd', score: 389 },
  { id: 'f5', nickname: '完美主义者', avatar: '🎯', color: '#ff6f61', score: 342 },
];

async function fetchJson(url, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LEADERBOARD_API.timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** 获取榜单原始数据 */
export async function fetchTop(limit = 10, offset = 0, mode = '') {
  try {
    if (LEADERBOARD_API.baseUrl) {
      return await fetchJson(`${LEADERBOARD_API.baseUrl}${LEADERBOARD_API.topPath}?limit=${limit}&offset=${offset}${mode === 'rogue' ? '&mode=rogue' : ''}`);
    }
    if (mode === 'rogue') return [];     // 本地示例模式：Roguelike 榜只有“我”
    return await fetchJson(MOCK_URL.href);
  } catch (e) {
    console.warn('[Leaderboard] 使用兜底数据：', e.message);
    return FALLBACK;
  }
}

/** 最近一次成功同步的结果（含 rogueRank 等） */
export let lastSync = null;

/** 把本机的玩家数据（昵称/最高分/皮肤/统计）同步到服务器；失败不影响游戏 */
export async function syncPlayer() {
  if (!LEADERBOARD_API.baseUrl) return { ok: true, mock: true };
  const p = Storage.getPlayer();
  const skins = Storage.getSkinState();
  const stats = Storage.getStats();
  try {
    const j = await fetchJson(LEADERBOARD_API.baseUrl + LEADERBOARD_API.syncPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: p.id, secret: p.secret, nickname: Storage.getNickname(), avatar: Storage.getAvatar(),
        week: Storage.weekId(), score: Storage.getWeekBest(), rogueBest: Storage.getWeekRogue(), perfects: stats.perfects || 0, games: stats.games || 0,
        unlocked: skins.unlocked, equipped: 'player:' + skins.player,
      }),
    });
    // 还没选过头像：先记下服务器按 ID 随机分到的那个，之后可以随时更换
    if (j && j.avatar && !Storage.getAvatar()) Storage.setAvatar(j.avatar);
    if (j && j.ok) lastSync = j;
    if (j && j.ok) Storage.setSynced({ nickname: Storage.getNickname(), avatar: Storage.getAvatar(), equipped: 'player:' + skins.player });
    return j;
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// 页面一打开就先“叫醒”后端（免费服务器闲置会休眠），等玩完一局时它已经醒了
if (typeof window !== 'undefined' && LEADERBOARD_API.baseUrl) {
  fetch(LEADERBOARD_API.baseUrl + '/api/health').catch(() => {});
}

// 数据一变就稍等片刻再同步（合并短时间内的多次改动）
let syncTimer = 0;
if (typeof window !== 'undefined') {
  Storage.onChange(() => {
    if (!LEADERBOARD_API.baseUrl) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncPlayer, LEADERBOARD_API.syncDelayMs);
  });
}

/** 取某个玩家的详情（已解锁皮肤、正在使用的皮肤等） */
export async function fetchPlayer(id) {
  if (!LEADERBOARD_API.baseUrl) return null;
  try {
    const r = await fetchJson(LEADERBOARD_API.baseUrl + LEADERBOARD_API.playerPath + encodeURIComponent(id));
    return r && r.ok ? r.player : null;
  } catch (e) {
    return null;
  }
}

/**
 * 整理榜单：真实后端时榜单里本来就有我（按 id 认出来）；Mock 时把“我”并入后排序。
 * 若我不在前 limit 名，额外返回我的名次。
 */
export function buildBoard(list, me, limit = 10) {
  const rows = list.map((r) => ({ ...r, isMe: !!me && !!me.id && r.id === me.id }));
  const inList = rows.some((r) => r.isMe);
  if (me && me.score > 0 && !inList) {
    rows.push({ id: me.id || 'me', nickname: me.nickname || '我', avatar: Storage.getAvatar() || '😎', color: '#4f86ff', score: me.score, isMe: true, local: true });
  }
  rows.sort((a, b) => b.score - a.score);
  rows.forEach((r, i) => { r.rank = i + 1; });
  const top = rows.slice(0, limit);
  const mine = rows.find((r) => r.isMe);
  return { top, mine: mine && mine.rank > limit ? mine : null };
}
