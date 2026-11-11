// “下载到手机”：把游戏装到手机主屏幕（PWA）。联网时仍和服务器同步，进度不变。
import { t, onLangChange } from './i18n.js?v=20261111f';

const $ = (id) => document.getElementById(id);
const ua = navigator.userAgent || '';
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const inApp = /MicroMessenger|FBAN|FBAV|Instagram|Line\/|LinkedInApp|Twitter|TikTok|Snapchat|QQ\//i.test(ua);
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
let deferred = null;

export function initInstall() {
  // 离线缓存 + 可安装所需的 Service Worker（失败不影响游戏）
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    const reg = () => navigator.serviceWorker.register('sw.js').catch(() => {});
    if (document.readyState === 'complete') reg(); else window.addEventListener('load', reg);
  }
  const btn = $('btnInstall'), modal = $('installModal');
  if (!btn || !modal) return;
  if (standalone()) { btn.classList.add('hidden'); return; }   // 已经是主屏幕里的 App 了

  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });
  window.addEventListener('appinstalled', () => {
    deferred = null; btn.classList.add('hidden'); modal.classList.add('hidden');
    window.__game && window.__game.ui && window.__game.ui.toast(t('inst_done'));
  });

  const fill = () => {
    $('installBody').textContent = inApp ? t('inst_inapp') : isIOS ? t('inst_ios') : t('inst_android');
    $('installNote').textContent = t('inst_note') + (isIOS ? ' ' + t('inst_note_ios') : '');
  };
  onLangChange(fill);
  btn.addEventListener('click', async () => {
    if (deferred) {                      // 安卓 Chrome 等：直接弹出系统的“安装”确认
      const d = deferred; deferred = null;
      try { await d.prompt(); await d.userChoice; } catch (e) { /* 忽略 */ }
      return;
    }
    fill(); modal.classList.remove('hidden');   // 苹果 / 其他浏览器：给出手动步骤
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('[data-instclose]')) modal.classList.add('hidden');
  });
}
