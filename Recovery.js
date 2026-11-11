// 备份 / 恢复进度：不需要注册登录。
// 恢复码 = 本机的玩家 ID + 密钥（等于“密码”，不要发给别人）。在新设备上粘贴恢复码，
// 就会从服务器取回最高分、已解锁的罐子和 VIP 身份，并把这台设备绑定到同一个账号。
import { Storage } from './Storage.js?v=20261111b';
import { LEADERBOARD_API } from './Leaderboard.js?v=20261111b';

export const recoveryAvailable = () => !!LEADERBOARD_API.baseUrl;

export function makeCode() {
  const p = Storage.getPlayer();
  return 'RC1-' + (p.id + p.secret).toUpperCase().match(/.{1,8}/g).join('-');
}

export function makeLink() {
  return location.origin + location.pathname + '#restore=' + makeCode();
}

/** 从用户粘贴的文字（恢复码或恢复链接）里取出 id 和 secret；格式不对返回 null */
export function parseCode(input) {
  let s = String(input || '').trim();
  const m = s.match(/restore=([^&\s]+)/i);
  if (m) { try { s = decodeURIComponent(m[1]); } catch (e) { s = m[1]; } }
  s = s.replace(/^\s*RC1/i, '').replace(/[^0-9a-f]/gi, '').toLowerCase();
  if (s.length < 64 || s.length > 96) return null;
  return { id: s.slice(0, 32), secret: s.slice(32) };
}

async function req(url, opt) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000); // 免费服务器可能正在唤醒，给足时间
  try { return await fetch(url, { ...opt, signal: ctrl.signal }); } finally { clearTimeout(timer); }
}

/**
 * 用恢复码恢复。返回 { status }：ok | bad（格式不对）| none（服务器没有这个账号）
 * | deny（密钥不对）| net（网络问题）。成功后调用方应刷新页面。
 */
export async function restore(input) {
  const c = parseCode(input);
  if (!c) return { status: 'bad' };
  const base = LEADERBOARD_API.baseUrl;
  let sp;
  try {
    const r = await req(base + LEADERBOARD_API.playerPath + c.id);
    if (r.status === 404) return { status: 'none' };
    if (!r.ok) return { status: 'net' };
    const j = await r.json();
    if (!j || !j.ok) return { status: 'net' };
    sp = j.player;
    // 先用服务器自己的数据“验证密钥”（只增不减，不会改坏任何东西）
    const v = await req(base + LEADERBOARD_API.syncPath, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: c.id, secret: c.secret, nickname: sp.nickname, score: sp.score, perfects: sp.perfects || 0,
        games: sp.games || 0, unlocked: sp.unlocked, equipped: sp.equipped,
      }),
    });
    if (v.status === 403) return { status: 'deny' };
    if (!v.ok) return { status: 'net' };
  } catch (e) {
    return { status: 'net' };
  }
  // 验证通过：换身份，再把服务器的进度并入本机
  Storage.setPlayer(c.id, c.secret);
  mergeServerPlayer(sp);
  return { status: 'ok' };
}

/** 把服务器上的玩家进度并入本机（分数取较大值，罐子取并集） */
export function mergeServerPlayer(sp, live = false) {
  Storage.saveHighScore(sp.score || 0);
  Storage.noteWeekScore(sp.score || 0);
  const st = Storage.getStats();
  Storage.saveStats({ ...st, games: Math.max(st.games || 0, sp.games || 0), perfects: Math.max(st.perfects || 0, sp.perfects || 0) });
  const sk = Storage.getSkinState();
  const unlocked = [...new Set([...(sk.unlocked || []), ...(sp.unlocked || [])])];
  const eq = String(sp.equipped || '');
  const real = (n) => n && !/^Player[0-9A-F]{4}$/.test(n);
  if (!live) {
    // 登录 / 恢复：沿用旧规则（罐子以服务器为准，昵称头像只补空缺）
    Storage.saveSkinState({ ...sk, unlocked, player: eq.startsWith('player:') && unlocked.includes(eq) ? eq.slice(7) : sk.player });
    if (!Storage.getAvatar() && sp.avatar) Storage.setAvatar(sp.avatar);
    if (!Storage.getNickname() && real(sp.nickname)) Storage.setNickname(sp.nickname);
    Storage.setSynced({ nickname: Storage.getNickname(), avatar: Storage.getAvatar(), equipped: 'player:' + Storage.getSkinState().player });
    return;
  }
  // 日常同步（三方对比）：这一项我在本机没改过（等于上次对齐的值）→ 采用服务器上别的设备改的；改过 → 保留本机，稍后推送上去
  const last = Storage.getSynced() || {};
  // 没有对齐记录（升级后的第一次）：本机已有值就保留本机的（并在拉取后推上去），本机为空才采用服务器的
  const untouched = (cur, was) => (was === undefined ? !cur : cur === was);
  const next = { ...last };            // 本机改过、还没推上去的项，保持“上次对齐值”不变，下次拉取时仍判定为“改过”
  let player = sk.player;
  if (untouched('player:' + sk.player, last.equipped)) {
    if (eq.startsWith('player:') && unlocked.includes(eq)) player = eq.slice(7);
    next.equipped = 'player:' + player;
  }
  Storage.saveSkinState({ ...sk, unlocked, player });
  if (untouched(Storage.getAvatar() || '', last.avatar === undefined ? undefined : last.avatar || '')) {
    if (sp.avatar) Storage.setAvatar(sp.avatar);
    next.avatar = Storage.getAvatar();
  }
  if (untouched(Storage.getNickname() || '', last.nickname === undefined ? undefined : last.nickname || '')) {
    if (real(sp.nickname)) Storage.setNickname(sp.nickname);
    next.nickname = Storage.getNickname();
  }
  Storage.setSynced(next);
}
