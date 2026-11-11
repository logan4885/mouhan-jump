// 账号：用 Google / Facebook 登录，把本机进度绑定到账号；换设备登录就能找回最高分、罐子和 VIP。
// 服务器只保存服务商给的用户标识，不保存邮箱和密码。登录是可选的，不登录照常能玩。
import { Storage } from './Storage.js?v=20261113b';
import { LEADERBOARD_API, syncPlayer, fetchPlayer } from './Leaderboard.js?v=20261113b';
import { AUTH } from './authConfig.js?v=20261113b';
import { mergeServerPlayer } from './Recovery.js?v=20261113b';

export const accountAvailable = () => !!LEADERBOARD_API.baseUrl && (!!AUTH.googleClientId || !!AUTH.facebookAppId);
export const PROVIDER_NAME = { google: 'Google', facebook: 'Facebook' };

const loaded = {};
function loadScript(src) {
  if (!loaded[src]) {
    loaded[src] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true; s.onload = resolve; s.onerror = () => { delete loaded[src]; reject(new Error('load')); };
      document.head.appendChild(s);
    });
  }
  return loaded[src];
}

/** 把第三方给的凭证交给服务器验证；成功后本机绑定（或切换到）该账号。返回 { status } */
export async function completeLogin(provider, token) {
  const base = LEADERBOARD_API.baseUrl;
  await syncPlayer();                               // 先确保服务器上已有本机这个玩家
  const p = Storage.getPlayer();
  let r, j;
  try {
    r = await fetch(base + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, token, id: p.id, secret: p.secret }),
    });
    j = await r.json().catch(() => ({}));
  } catch (e) { return { status: 'net' }; }
  if (!r.ok) {
    const map = { bad_token: 'bad', already_linked: 'linked', not_configured: 'cfg' };
    return { status: map[j.error] || 'net' };
  }
  if (j.switched) {
    const sp = await fetchPlayer(j.id);             // 先取到账号的进度，取不到就不切换，避免丢数据
    if (!sp) return { status: 'net' };
    Storage.setPlayer(j.id, j.secret);
    mergeServerPlayer(sp);
  }
  Storage.setAccount({ provider, name: j.name || '' });
  return { status: 'ok' };
}

/**
 * 从服务器拉取账号的最新进度并并入本机（别的设备上赢的分、解锁的罐子、换的头像昵称）。
 * 返回 { status: 'none'|'net'|'ok', changed }；changed 为 true 时调用方应刷新页面让界面用上新数据。
 */
export async function pullProgress() {
  if (!Storage.getAccount() || !LEADERBOARD_API.baseUrl) return { status: 'none', changed: false };
  const sp = await fetchPlayer(Storage.getPlayer().id);
  if (!sp) return { status: 'net', changed: false };
  const snap = () => JSON.stringify([Storage.getHighScore(), Storage.getSkinState(), Storage.getAvatar(), Storage.getNickname(), Storage.getStats()]);
  const before = snap();
  const hadRecord = !!Storage.getSynced();
  mergeServerPlayer(sp, true);
  if (!hadRecord) await syncPlayer();               // 第一次：把保留下来的本机昵称 / 头像 / 罐子推上去，并建立对齐记录
  return { status: 'ok', changed: snap() !== before };
}

/** 渲染 Google 官方登录按钮 */
export async function renderGoogleButton(el, lang, onToken) {
  await loadScript('https://accounts.google.com/gsi/client');
  /* global google */
  google.accounts.id.initialize({ client_id: AUTH.googleClientId, callback: (r) => r && r.credential && onToken(r.credential), ux_mode: 'popup' });
  google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', width: 240, locale: { zh: 'zh_CN', en: 'en', ar: 'ar' }[lang] || 'en' });
}

/** 预加载 Facebook SDK（必须提前加载，点击时才能同步弹出登录窗口而不被拦截） */
export function prepareFacebook() {
  if (window.FB) return Promise.resolve();
  return new Promise((resolve, reject) => {
    window.fbAsyncInit = () => { window.FB.init({ appId: AUTH.facebookAppId, cookie: false, xfbml: false, version: 'v21.0' }); resolve(); };
    loadScript('https://connect.facebook.net/en_US/sdk.js').catch(reject);
  });
}
export function facebookLogin(onToken) {
  if (!window.FB) return false;
  window.FB.login((resp) => { if (resp && resp.authResponse && resp.authResponse.accessToken) onToken(resp.authResponse.accessToken); }, { scope: 'public_profile' });
  return true;
}

/** 退出登录：清空本机进度（进度仍保存在账号里，登录即可找回） */
export function logout() { Storage.clearLocalProgress(); }

/** 删除我在服务器上的全部数据（玩家 + 绑定的账号），并清空本机 */
export async function deleteMyData() {
  const p = Storage.getPlayer();
  try {
    const r = await fetch(LEADERBOARD_API.baseUrl + '/api/account/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, secret: p.secret }),
    });
    if (!r.ok) return { status: 'net' };
  } catch (e) { return { status: 'net' }; }
  Storage.clearLocalProgress();
  return { status: 'ok' };
}
