// 多语言：中文 / English / العربية
// 静态文字写在 index.html 的 data-i18n 属性里，动态文字用 t('key', { 变量 })
import { Storage } from './Storage.js?v=20261110p';

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
    rank_all: '全部玩家', av_hint: '点头像换一个动物', nick_label: '排行榜昵称', nick_ph: '给自己起个名字', restart: '再来一局',
    shop_title: '皮肤商店', tab_player: '易拉罐', tab_block: '方块',
    use: '使用', using: '使用中', locked: '未解锁', equipped: '已换上新皮肤',
    lock_score: '🔒 {n} 分', lock_code: '🔑 兑换码',
    need_score: '最高分达到 {n} 解锁（当前 {best}）', need_code: '输入兑换码，随机解锁一款新罐子',
    freeze_btn: '时停 8 秒', freeze_word: '时间，停止！', freeze_cd: '积分 {n}/{m}', freeze_safe: '时停保护：落空不算失败', perk_freeze_on: '时停中', perk_label: '能力', perk_none: '标准手感，没有能力', perk_used: '已用', perk_ready: '可用 ×1', perk_after: '{n} 分后可用',
    perk_charged: '已充能', perk_streak: '{n}/{m}', perk_saved: '{icon} {name} 生效！',
    redeem_ph: '输入兑换码', redeem_btn: '兑换',
    redeem_ok: '🎉 抽中了：{name}', redeem_bad: '兑换码无效，请检查后再试', redeem_have: '你已经拥有：{name}',
    redeem_empty: '请先输入兑换码',
    redeem_used: '这个兑换码在本设备上已经用过了', redeem_none: '所有易拉罐都已解锁，新款即将上线，兑换码先留着吧',
    rank_title: '排行榜', loading: '加载中…', me: '我',
    rank_mock: '示例数据 · 接入后端后显示真实排名', rank_live: '实时排行',
    pl_view: '查看这位玩家的皮肤', pl_tip: '点击玩家查看皮肤', pl_fail: '加载失败，请稍后再试',
    pl_stats: '第 {r} 名 · 最高分 {s}', pl_stats2: '完美落点 {p} 次 · 共玩 {g} 局',
    pl_equipped: '正在使用', pl_unlocked: '已解锁 {n}/{m}',
    trial_on: '👑 VIP 黄金形态 · {name}（限时体验）', trial_end: '体验结束 — 想永久拥有 {name} 吗？', trial_cta: '🔑 兑换码',
    owner: 'Official Owner', guest: 'Guest 游客',
    vip_warn: '⚠️ 你的最高分 <b>{score}</b> 目前排第 <b>{rank}</b> 名，但你用的是普通素色罐，名字将以灰色 <b>Guest 游客</b> 状态展示。解锁正式身份与黄金发光名牌？',
    vip_beat: '🎉 你的手感超过了 <b>{pct}%</b> 的玩家！', vip_locked: '🔒 你的 24K 黄金罐专属成就还没解锁',
    vip_code: '🔑 激活 VIP Code', vip_buy: '📦 找 Founder 拿现货', vip_left: '⏱ 现货优惠剩余 {t}',
    bk_title: '👤 账号登录 / 备份进度', bk_hint: '换手机或清除浏览器前，先复制恢复码；在新设备上粘贴，就能找回最高分和已解锁的罐子。恢复码相当于你的密码，不要发给别人。',
    bk_copy: '复制恢复码', bk_link: '复制恢复链接', bk_ph: '粘贴恢复码', bk_btn: '恢复',
    bk_copied: '已复制，请保存好（别发给别人）', bk_manual: '请手动复制上面的文字', bk_bad: '恢复码格式不对，请完整粘贴',
    bk_none: '服务器上找不到这个账号', bk_deny: '恢复码不正确', bk_net: '网络不通或服务器在唤醒，请稍后再试',
    bk_ok: '✅ 恢复成功，正在刷新…', bk_found: '检测到恢复链接，点“恢复”确认',
    ac_hint: '登录后，换手机或清除浏览器也能找回最高分、解锁的罐子和 VIP。不登录照常能玩。我们不保存你的邮箱和密码。',
    ac_fb: '用 Facebook 登录', ac_logout: '退出登录', ac_delete: '删除我的数据', ac_privacy: '隐私政策', ac_start: '👤 登录，保存进度',
    ac_in: '已登录：{name}（{p}）', ac_sync: '🔄 立即同步', ac_synced: '✅ 已同步，这台设备和账号一致', ac_sync_new: '✅ 取回了其他设备的新进度，正在刷新…', ac_ok: '✅ 登录成功，正在刷新…', ac_bad: '登录验证失败，请重试', ac_linked: '这台设备已经绑定了另一个同类账号，请先退出登录',
    ac_cfg: '登录功能暂未开通', ac_net: '网络不通或服务器在唤醒，请稍后再试',
    ac_logout_q: '退出后，这台设备上的进度会清空（进度仍保存在你的账号里，重新登录即可找回）。确定退出吗？',
    ac_delete_q: '这会永久删除你在服务器上的全部数据（最高分、解锁的罐子、绑定的账号），不能恢复。确定删除吗？',
    ac_deleted: '已删除，正在刷新…', bk_sub: '备用方式：恢复码（不用登录）',
    redeem_reset: '已清空本机的兑换罐，回到新玩家状态（测试用）',
    mute: '音乐 / 音效开关', fx_preview: '▶ 试听特效', fx_stop: '■ 停止试听', sig_label: '专属',
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
    rank_all: 'All players', av_hint: 'Tap to pick your animal', nick_label: 'Name', nick_ph: 'Your name on the ranking', restart: 'Play again',
    shop_title: 'Skin shop', tab_player: 'Cans', tab_block: 'Blocks',
    use: 'Use', using: 'In use', locked: 'Locked', equipped: 'New skin equipped',
    lock_score: '🔒 {n} pts', lock_code: '🔑 Code',
    need_score: 'Reach a best of {n} to unlock (now {best})', need_code: 'Enter a redeem code to unlock a random new can',
    freeze_btn: 'Time Stop 8s', freeze_word: 'TIME. STOP.', freeze_cd: 'Credits {n}/{m}', freeze_safe: 'Time-stop safety: no fail', perk_freeze_on: 'time stopped', perk_label: 'Ability', perk_none: 'Standard feel, no ability', perk_used: 'used', perk_ready: 'ready ×1', perk_after: 'from {n} pts',
    perk_charged: 'charged', perk_streak: '{n}/{m}', perk_saved: '{icon} {name} saved you!',
    redeem_ph: 'Enter redeem code', redeem_btn: 'Redeem',
    redeem_ok: '🎉 You got: {name}', redeem_bad: 'That code is not valid. Check it and try again.', redeem_have: 'You already have {name}',
    redeem_empty: 'Type a code first',
    redeem_used: 'This code has already been used on this device', redeem_none: 'You have every can already. New ones are coming soon, so keep your code.',
    rank_title: 'Ranking', loading: 'Loading…', me: 'Me',
    rank_mock: 'Sample data · real rankings appear once a server is connected', rank_live: 'Live ranking',
    pl_view: "View this player's skins", pl_tip: 'Tap a player to see their skins', pl_fail: 'Could not load. Please try again later.',
    pl_stats: 'Rank #{r} · Best {s}', pl_stats2: 'Perfect landings {p} · Games {g}',
    pl_equipped: 'In use', pl_unlocked: 'Unlocked {n}/{m}',
    trial_on: '👑 VIP Gold Form · {name} (limited trial)', trial_end: 'Trial over — want to keep {name} forever?', trial_cta: '🔑 Redeem',
    owner: 'Official Owner', guest: 'Guest',
    vip_warn: '⚠️ Your best <b>{score}</b> is currently <b>#{rank}</b> on the ranking, but you are using a plain can, so your name shows in grey as a <b>Guest</b>. Unlock the official badge and the golden glowing name plate?',
    vip_beat: '🎉 Your touch beats <b>{pct}%</b> of players!', vip_locked: '🔒 Your 24K Gold Can achievement is still locked',
    vip_code: '🔑 Activate VIP Code', vip_buy: '📦 Get the can from the Founder', vip_left: '⏱ Offer ends in {t}',
    bk_title: '👤 Account / back up progress', bk_hint: 'Before switching phones or clearing your browser, copy your recovery code. Paste it on the new device to get your high score and unlocked cans back. The code works like a password, so never share it.',
    bk_copy: 'Copy recovery code', bk_link: 'Copy recovery link', bk_ph: 'Paste recovery code', bk_btn: 'Restore',
    bk_copied: 'Copied. Keep it safe (don\'t share it)', bk_manual: 'Please copy the text above manually', bk_bad: 'That code looks incomplete. Paste the whole thing.',
    bk_none: 'No account found for this code', bk_deny: 'Wrong recovery code', bk_net: 'Network problem or the server is waking up. Try again shortly.',
    bk_ok: '✅ Restored. Reloading…', bk_found: 'Recovery link detected. Tap Restore to confirm.',
    ac_hint: 'Sign in to get your high score, unlocked cans and VIP back on any phone, even after clearing your browser. Playing without signing in still works. We never store your email or password.',
    ac_fb: 'Continue with Facebook', ac_logout: 'Sign out', ac_delete: 'Delete my data', ac_privacy: 'Privacy policy', ac_start: '👤 Sign in to save progress',
    ac_in: 'Signed in: {name} ({p})', ac_sync: '🔄 Sync now', ac_synced: '✅ Synced. This device matches your account', ac_sync_new: '✅ Got new progress from another device. Reloading…', ac_ok: '✅ Signed in. Reloading…', ac_bad: 'Sign-in could not be verified. Please try again.', ac_linked: 'This device is already linked to another account of this kind. Sign out first.',
    ac_cfg: 'Sign-in is not available yet', ac_net: 'Network problem or the server is waking up. Try again shortly.',
    ac_logout_q: 'Signing out clears the progress on this device (it stays in your account, sign in again to get it back). Continue?',
    ac_delete_q: 'This permanently deletes all your data on the server (high score, unlocked cans, linked accounts). It cannot be undone. Continue?',
    ac_deleted: 'Deleted. Reloading…', bk_sub: 'Backup option: recovery code (no sign-in)',
    redeem_reset: 'Redeemed cans cleared on this device — back to a new player (test)',
    mute: 'Music / sound toggle', fx_preview: '▶ Preview FX', fx_stop: '■ Stop preview', sig_label: 'Signature',
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
    rank_all: 'كل اللاعبين', av_hint: 'اضغط لاختيار حيوانك', nick_label: 'الاسم', nick_ph: 'اسمك في الترتيب', restart: 'العب مرة أخرى',
    shop_title: 'متجر الأشكال', tab_player: 'العلب', tab_block: 'المكعبات',
    use: 'استخدم', using: 'قيد الاستخدام', locked: 'مقفل', equipped: 'تم تغيير الشكل',
    lock_score: '🔒 {n} نقطة', lock_code: '🔑 رمز',
    need_score: 'يُفتح عند الوصول إلى {n} نقطة (الآن {best})', need_code: 'أدخل رمز الاسترداد لفتح علبة جديدة عشوائية',
    freeze_btn: 'إيقاف الزمن 8ث', freeze_word: 'توقّف الزمن!', freeze_cd: 'رصيد {n}/{m}', freeze_safe: 'حماية الزمن: لا فشل', perk_freeze_on: 'الزمن متوقف', perk_label: 'القدرة', perk_none: 'إحساس عادي، بلا قدرة', perk_used: 'مستخدمة', perk_ready: 'جاهزة ×1', perk_after: 'بعد {n} نقطة',
    perk_charged: 'مشحونة', perk_streak: '{n}/{m}', perk_saved: '{icon} {name} أنقذتك!',
    redeem_ph: 'أدخل رمز الاسترداد', redeem_btn: 'استرداد',
    redeem_ok: '🎉 حصلت على: {name}', redeem_bad: 'الرمز غير صالح، تحقّق منه وحاول مرة أخرى', redeem_have: 'لديك بالفعل: {name}',
    redeem_empty: 'اكتب الرمز أولًا',
    redeem_used: 'تم استخدام هذا الرمز على هذا الجهاز من قبل', redeem_none: 'لديك كل العلب بالفعل. علب جديدة قريبًا، احتفظ بالرمز.',
    rank_title: 'الترتيب', loading: 'جارٍ التحميل…', me: 'أنا',
    rank_mock: 'بيانات تجريبية · يظهر الترتيب الحقيقي بعد ربط الخادم', rank_live: 'ترتيب مباشر',
    pl_view: 'عرض أشكال هذا اللاعب', pl_tip: 'اضغط على لاعب لرؤية أشكاله', pl_fail: 'تعذّر التحميل، حاول لاحقًا',
    pl_stats: 'المركز {r} · الأفضل {s}', pl_stats2: 'هبوط مثالي {p} · الجولات {g}',
    pl_equipped: 'قيد الاستخدام', pl_unlocked: 'تم فتح {n}/{m}',
    trial_on: '👑 الشكل الذهبي VIP · {name} (تجربة محدودة)', trial_end: 'انتهت التجربة — هل تريد الاحتفاظ بـ {name} للأبد؟', trial_cta: '🔑 استبدال',
    owner: 'Official Owner', guest: 'ضيف',
    vip_warn: '⚠️ أعلى نتيجة لك <b>{score}</b> هي حاليًا المركز <b>{rank}</b>، لكنك تستخدم علبة عادية لذلك يظهر اسمك باللون الرمادي كـ <b>ضيف</b>. هل تريد فتح الشارة الرسمية واللوحة الذهبية المتوهجة؟',
    vip_beat: '🎉 مهارتك تتفوق على <b>{pct}%</b> من اللاعبين!', vip_locked: '🔒 إنجاز العلبة الذهبية 24K ما زال مقفلًا',
    vip_code: '🔑 تفعيل كود VIP', vip_buy: '📦 احصل على العلبة من المؤسس', vip_left: '⏱ ينتهي العرض بعد {t}',
    bk_title: '👤 الحساب / نسخ احتياطي للتقدّم', bk_hint: 'قبل تغيير هاتفك أو مسح بيانات المتصفح، انسخ رمز الاستعادة. الصقه على الجهاز الجديد لاسترجاع أعلى نتيجة والعلب المفتوحة. الرمز مثل كلمة المرور، لا تشاركه مع أحد.',
    bk_copy: 'نسخ رمز الاستعادة', bk_link: 'نسخ رابط الاستعادة', bk_ph: 'الصق رمز الاستعادة', bk_btn: 'استعادة',
    bk_copied: 'تم النسخ، احتفظ به بأمان (لا تشاركه)', bk_manual: 'انسخ النص أعلاه يدويًا', bk_bad: 'الرمز غير مكتمل، الصقه كاملًا',
    bk_none: 'لا يوجد حساب لهذا الرمز', bk_deny: 'رمز الاستعادة غير صحيح', bk_net: 'مشكلة في الشبكة أو الخادم يستيقظ، حاول لاحقًا',
    bk_ok: '✅ تمت الاستعادة، جارٍ إعادة التحميل…', bk_found: 'تم اكتشاف رابط استعادة. اضغط استعادة للتأكيد.',
    ac_hint: 'سجّل الدخول لاستعادة أعلى نتيجة والعلب المفتوحة وVIP على أي هاتف، حتى بعد مسح بيانات المتصفح. اللعب بدون تسجيل ما زال متاحًا. لا نحفظ بريدك الإلكتروني ولا كلمة المرور.',
    ac_fb: 'المتابعة عبر Facebook', ac_logout: 'تسجيل الخروج', ac_delete: 'حذف بياناتي', ac_privacy: 'سياسة الخصوصية', ac_start: '👤 سجّل الدخول لحفظ تقدّمك',
    ac_in: 'تم تسجيل الدخول: {name} ({p})', ac_sync: '🔄 مزامنة الآن', ac_synced: '✅ تمت المزامنة، هذا الجهاز مطابق لحسابك', ac_sync_new: '✅ تم جلب تقدّم جديد من جهاز آخر، جارٍ إعادة التحميل…', ac_ok: '✅ تم تسجيل الدخول، جارٍ إعادة التحميل…', ac_bad: 'تعذّر التحقق من تسجيل الدخول، حاول مرة أخرى', ac_linked: 'هذا الجهاز مرتبط بحساب آخر من النوع نفسه، سجّل الخروج أولًا',
    ac_cfg: 'تسجيل الدخول غير متاح بعد', ac_net: 'مشكلة في الشبكة أو الخادم يستيقظ، حاول لاحقًا',
    ac_logout_q: 'تسجيل الخروج يمسح التقدّم على هذا الجهاز (يبقى محفوظًا في حسابك ويمكنك استعادته بتسجيل الدخول). متابعة؟',
    ac_delete_q: 'سيؤدي هذا إلى حذف جميع بياناتك نهائيًا من الخادم (أعلى نتيجة والعلب المفتوحة والحسابات المرتبطة) ولا يمكن التراجع. متابعة؟',
    ac_deleted: 'تم الحذف، جارٍ إعادة التحميل…', bk_sub: 'خيار احتياطي: رمز الاستعادة (بدون تسجيل دخول)',
    redeem_reset: 'تم مسح العلب المستبدلة على هذا الجهاز (للاختبار)',
    mute: 'تشغيل / إيقاف الصوت', fx_preview: '▶ معاينة المؤثرات', fx_stop: '■ إيقاف المعاينة', sig_label: 'حصري',
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
