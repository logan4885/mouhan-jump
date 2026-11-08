// 多语言：中文 / English / العربية
// 静态文字写在 index.html 的 data-i18n 属性里，动态文字用 t('key', { 变量 })
import { Storage } from './Storage.js';

export const LANGS = ['zh', 'en', 'ar'];

const DICT = {
  zh: {
    page_title: '跳一跳 3D', logo: '跳一跳', back_site: '↩ 回到牟涵的小屋',
    subtitle: '按住蓄力，松开起跳。落在正中心得分翻倍！',
    start: '开始游戏', skins: '🎨 皮肤', rank: '🏆 排行榜', home: '🏠 首页',
    my_best: '我的最高分', best: '最高分',
    ctl_desktop: '电脑：按住鼠标左键或空格键', ctl_touch: '手机：按住屏幕任意位置',
    charging: '蓄力中…', combo: '连续完美 ×{n}', perfect: '完美 +{n}',
    over_title: '游戏结束', new_record: '🎉 新纪录！',
    over_line: '最高分 <b>{best}</b> · 本局完美 <b>{p}</b> 次',
    unlocked_new: '🔓 解锁新皮肤：', sep: '、',
    nick_label: '排行榜昵称', nick_ph: '给自己起个名字', restart: '再来一局',
    shop_title: '皮肤商店', tab_player: '易拉罐', tab_block: '方块',
    use: '使用', using: '使用中', locked: '未解锁', equipped: '已换上新皮肤',
    lock_score: '🔒 {n} 分', lock_code: '🔑 兑换码',
    need_score: '最高分达到 {n} 解锁（当前 {best}）', need_code: '输入兑换码，随机解锁一款新罐子',
    perk_label: '能力', perk_none: '标准手感，没有能力', perk_used: '已用', perk_ready: '可用 ×1', perk_after: '{n} 分后可用',
    perk_charged: '已充能', perk_streak: '{n}/{m}', perk_saved: '{icon} {name} 生效！',
    redeem_ph: '输入兑换码', redeem_btn: '兑换',
    redeem_ok: '🎉 抽中了：{name}', redeem_bad: '兑换码无效，请检查后再试', redeem_have: '你已经拥有：{name}',
    redeem_empty: '请先输入兑换码',
    redeem_used: '这个兑换码在本设备上已经用过了', redeem_none: '所有易拉罐都已解锁，新款即将上线，兑换码先留着吧',
    rank_title: '排行榜', loading: '加载中…', me: '我',
    rank_mock: '示例数据 · 接入后端后显示真实排名', rank_live: '实时排行',
    close: '关闭', nogl_t: '无法启动 3D 画面',
    nogl_p: '你的浏览器不支持 WebGL，或 Three.js 加载失败。请更换浏览器或检查网络后刷新。',
  },
  en: {
    page_title: 'Jump Jump 3D', logo: 'Jump Jump', back_site: "↩ Back to Mouhan's house",
    subtitle: 'Hold to charge, release to jump. Land dead center for double points!',
    start: 'Play', skins: '🎨 Skins', rank: '🏆 Ranking', home: '🏠 Home',
    my_best: 'My best', best: 'Best',
    ctl_desktop: 'Desktop: hold the left mouse button or Space', ctl_touch: 'Phone: press and hold anywhere',
    charging: 'Charging…', combo: 'Perfect streak ×{n}', perfect: 'Perfect +{n}',
    over_title: 'Game over', new_record: '🎉 New record!',
    over_line: 'Best <b>{best}</b> · Perfect landings <b>{p}</b>',
    unlocked_new: '🔓 New skin unlocked: ', sep: ', ',
    nick_label: 'Name', nick_ph: 'Your name on the ranking', restart: 'Play again',
    shop_title: 'Skin shop', tab_player: 'Cans', tab_block: 'Blocks',
    use: 'Use', using: 'In use', locked: 'Locked', equipped: 'New skin equipped',
    lock_score: '🔒 {n} pts', lock_code: '🔑 Code',
    need_score: 'Reach a best of {n} to unlock (now {best})', need_code: 'Enter a redeem code to unlock a random new can',
    perk_label: 'Ability', perk_none: 'Standard feel, no ability', perk_used: 'used', perk_ready: 'ready ×1', perk_after: 'from {n} pts',
    perk_charged: 'charged', perk_streak: '{n}/{m}', perk_saved: '{icon} {name} saved you!',
    redeem_ph: 'Enter redeem code', redeem_btn: 'Redeem',
    redeem_ok: '🎉 You got: {name}', redeem_bad: 'That code is not valid. Check it and try again.', redeem_have: 'You already have {name}',
    redeem_empty: 'Type a code first',
    redeem_used: 'This code has already been used on this device', redeem_none: 'You have every can already. New ones are coming soon, so keep your code.',
    rank_title: 'Ranking', loading: 'Loading…', me: 'Me',
    rank_mock: 'Sample data · real rankings appear once a server is connected', rank_live: 'Live ranking',
    close: 'Close', nogl_t: '3D view could not start',
    nogl_p: 'Your browser does not support WebGL, or Three.js failed to load. Try another browser or check your connection, then reload.',
  },
  ar: {
    page_title: 'قفزة قفزة 3D', logo: 'قفزة قفزة', back_site: '↩ العودة إلى بيت موهان',
    subtitle: 'اضغط مطولًا للشحن واترك للقفز. الهبوط في المنتصف تمامًا يضاعف النقاط!',
    start: 'ابدأ اللعب', skins: '🎨 الأشكال', rank: '🏆 الترتيب', home: '🏠 الرئيسية',
    my_best: 'أفضل نتيجة لي', best: 'الأفضل',
    ctl_desktop: 'الكمبيوتر: اضغط مطولًا على زر الفأرة الأيسر أو مفتاح المسافة', ctl_touch: 'الهاتف: اضغط مطولًا في أي مكان',
    charging: 'جارٍ الشحن…', combo: 'سلسلة مثالية ×{n}', perfect: 'مثالي +{n}',
    over_title: 'انتهت اللعبة', new_record: '🎉 رقم قياسي جديد!',
    over_line: 'الأفضل <b>{best}</b> · هبوط مثالي <b>{p}</b> مرة',
    unlocked_new: '🔓 تم فتح شكل جديد: ', sep: '، ',
    nick_label: 'الاسم', nick_ph: 'اسمك في الترتيب', restart: 'العب مرة أخرى',
    shop_title: 'متجر الأشكال', tab_player: 'العلب', tab_block: 'المكعبات',
    use: 'استخدم', using: 'قيد الاستخدام', locked: 'مقفل', equipped: 'تم تغيير الشكل',
    lock_score: '🔒 {n} نقطة', lock_code: '🔑 رمز',
    need_score: 'يُفتح عند الوصول إلى {n} نقطة (الآن {best})', need_code: 'أدخل رمز الاسترداد لفتح علبة جديدة عشوائية',
    perk_label: 'القدرة', perk_none: 'إحساس عادي، بلا قدرة', perk_used: 'مستخدمة', perk_ready: 'جاهزة ×1', perk_after: 'بعد {n} نقطة',
    perk_charged: 'مشحونة', perk_streak: '{n}/{m}', perk_saved: '{icon} {name} أنقذتك!',
    redeem_ph: 'أدخل رمز الاسترداد', redeem_btn: 'استرداد',
    redeem_ok: '🎉 حصلت على: {name}', redeem_bad: 'الرمز غير صالح، تحقّق منه وحاول مرة أخرى', redeem_have: 'لديك بالفعل: {name}',
    redeem_empty: 'اكتب الرمز أولًا',
    redeem_used: 'تم استخدام هذا الرمز على هذا الجهاز من قبل', redeem_none: 'لديك كل العلب بالفعل. علب جديدة قريبًا، احتفظ بالرمز.',
    rank_title: 'الترتيب', loading: 'جارٍ التحميل…', me: 'أنا',
    rank_mock: 'بيانات تجريبية · يظهر الترتيب الحقيقي بعد ربط الخادم', rank_live: 'ترتيب مباشر',
    close: 'إغلاق', nogl_t: 'تعذّر تشغيل العرض ثلاثي الأبعاد',
    nogl_p: 'متصفحك لا يدعم WebGL أو تعذّر تحميل Three.js. جرّب متصفحًا آخر أو تحقّق من الاتصال ثم أعد التحميل.',
  },
};

function detect() {
  const saved = Storage.getLang();
  if (LANGS.includes(saved)) return saved;
  const nl = (navigator.language || '').toLowerCase();
  return nl.startsWith('zh') ? 'zh' : nl.startsWith('ar') ? 'ar' : 'en';
}

let lang = detect();
const listeners = [];

export const getLang = () => lang;

export function setLang(l) {
  if (!LANGS.includes(l) || l === lang) return;
  lang = l;
  Storage.setLang(l);
  applyStatic();
  listeners.forEach((fn) => fn(l));
}
export const onLangChange = (fn) => listeners.push(fn);

/** 取一句翻译，{name} 形式的占位符会被替换 */
export function t(key, vars = {}) {
  const s = (DICT[lang] && DICT[lang][key]) ?? DICT.zh[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : ''));
}

/** 皮肤名字等三语对象 { zh, en, ar } -> 当前语言的字符串 */
export function L(obj) {
  if (obj == null || typeof obj === 'string') return obj || '';
  return obj[lang] || obj.en || obj.zh || '';
}

/** 刷新 HTML 里带 data-i18n 的静态文字，并设置 lang / dir */
export function applyStatic() {
  const root = document.documentElement;
  root.lang = lang === 'zh' ? 'zh-CN' : lang;
  root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.title = t('page_title');
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.lang === lang ? 'true' : 'false'));
}
