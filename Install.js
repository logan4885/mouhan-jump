// “下载到手机”：把游戏装到手机主屏幕（PWA）。联网时仍和服务器同步，进度不变。
// 弹窗里安卓和苹果分开讲：当前设备的那一栏排在前面并高亮，另一栏也能看到。
import { t, L, onLangChange } from './i18n.js?v=20261113a';

const $ = (id) => document.getElementById(id);
const ua = navigator.userAgent || '';
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(ua);
const inApp = /MicroMessenger|FBAN|FBAV|Instagram|Line\/|LinkedInApp|Twitter|TikTok|Snapchat|QQ\//i.test(ua);
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
let deferred = null;

const steps = (key) => '<ol>' + t(key).split('|').map((s) => '<li>' + s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])) + '</li>').join('') + '</ol>';

export function initInstall() {
  // 离线缓存 + 可安装所需的 Service Worker（失败不影响游戏）
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    const reg = () => navigator.serviceWorker.register('sw.js').catch(() => {});
    if (document.readyState === 'complete') reg(); else window.addEventListener('load', reg);
  }
  const btn = $('btnInstall'), modal = $('installModal');
  if (!btn || !modal) return;
  if (standalone()) { btn.classList.add('hidden'); return; }   // 已经是主屏幕里的 App 了

  const go = $('instAndroidGo');
  const sync = () => { go.classList.toggle('hidden', !deferred); };
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; sync(); });
  window.addEventListener('appinstalled', () => {
    deferred = null; btn.classList.add('hidden'); modal.classList.add('hidden');
    window.__game && window.__game.ui && window.__game.ui.toast(t('inst_done'));
  });

  const fill = () => {
    $('instAndroidSteps').innerHTML = steps('inst_android_steps');
    $('instIosSteps').innerHTML = steps('inst_ios_steps');
    const apk = $('instApk');
    if (apk) apk.textContent = L({ zh: '⬇️ 下载安卓安装包（APK）', en: '⬇️ Download Android app (APK)', ar: '⬇️ تنزيل تطبيق أندرويد (APK)' });
    const ah = $('instApkHint');
    if (ah) ah.textContent = L({ zh: '下载后点开文件安装；若提示“未知来源”，请按提示允许一次。', en: 'Open the file after downloading. If asked about unknown sources, allow it once.', ar: 'افتح الملف بعد التنزيل. إذا ظهر تنبيه المصادر غير المعروفة فاسمح به مرة واحدة.' });
    $('instInapp').textContent = inApp ? t('inst_inapp') : '';
    $('instInapp').classList.toggle('hidden', !inApp);
    $('installNote').textContent = t('inst_note');
    // 当前设备的那一栏排在前面并高亮
    const a = $('instAndroid'), i = $('instIos'), box = $('instCards');
    a.classList.toggle('me', isAndroid && !isIOS); i.classList.toggle('me', isIOS);
    box.insertBefore(isIOS ? i : a, box.firstChild);
    sync();
  };
  onLangChange(fill);
  btn.addEventListener('click', () => { fill(); modal.classList.remove('hidden'); });
  go.addEventListener('click', async () => {      // 安卓 Chrome：直接弹出系统的“安装”确认
    if (!deferred) return;
    const d = deferred; deferred = null; sync();
    try { await d.prompt(); await d.userChoice; } catch (e) { /* 忽略 */ }
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('[data-instclose]')) modal.classList.add('hidden');
  });
}
