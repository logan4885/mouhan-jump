// 排行榜：默认读取本地 Mock JSON；填写 API 配置后自动切换为真实接口
//
// 预留接口约定（后端实现时按此返回即可）：
//   GET  {baseUrl}/leaderboard/top?limit=10
//        -> [{ id, nickname, avatar, avatarUrl, color, score }]
//   POST {baseUrl}/leaderboard/submit   body: { nickname, score }
//        -> { ok: true, rank: 12 }

export const LEADERBOARD_API = {
  baseUrl: '',            // 例如 'https://api.example.com'；为空则使用 Mock 数据
  topPath: '/leaderboard/top',
  submitPath: '/leaderboard/submit',
  timeoutMs: 5000,
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
export async function fetchTop(limit = 10) {
  try {
    if (LEADERBOARD_API.baseUrl) {
      return await fetchJson(`${LEADERBOARD_API.baseUrl}${LEADERBOARD_API.topPath}?limit=${limit}`);
    }
    return await fetchJson(MOCK_URL.href);
  } catch (e) {
    console.warn('[Leaderboard] 使用兜底数据：', e.message);
    return FALLBACK;
  }
}

/** 提交分数（未配置后端时直接返回成功） */
export async function submitScore(nickname, score) {
  if (!LEADERBOARD_API.baseUrl) return { ok: true, mock: true };
  try {
    return await fetchJson(LEADERBOARD_API.baseUrl + LEADERBOARD_API.submitPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, score }),
    });
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/** 把“我”的最高分并入榜单，排序后取前 limit 名；若我不在前列，额外返回我的名次 */
export function buildBoard(list, me, limit = 10) {
  const rows = list.map((r) => ({ ...r, isMe: false }));
  if (me && me.score > 0) {
    rows.push({ id: 'me', nickname: me.nickname || '我', avatar: '😎', color: '#4f86ff', score: me.score, isMe: true });
  }
  rows.sort((a, b) => b.score - a.score);
  rows.forEach((r, i) => { r.rank = i + 1; });
  const top = rows.slice(0, limit);
  const mine = rows.find((r) => r.isMe);
  return { top, mine: mine && mine.rank > limit ? mine : null };
}
