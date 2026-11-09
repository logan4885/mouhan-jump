// ==================== 易拉罐角色皮肤（换皮只改这个文件） ====================
//
// 每一项就是一款罐子。新增一款：复制一段，改 id / 名字 / 颜色 / 文字即可。
//
//   id          唯一英文 id（存档和兑换码用，别和别的重复）
//   name, desc  商店里显示的名字和介绍，三种语言 { zh, en, ar }
//   unlock      'free' = 一开始就有；'code' = 只能用兑换码解锁
//               （兑换码是随机解锁：每个码从还没解锁的 'code' 款里随机抽一款）
//   body        罐身主色
//   accent      罐身上的波浪条颜色
//   text        罐身上的大字（建议 3~8 个字母）
//   textColor   大字颜色
//   sub         大字下面的小字
//   lid         顶盖 / 底座的金属颜色
//   bubbles     是否画气泡点
//   effect      （可选）特效：gold / chrome / holo / neon / galaxy / blaze / frost / crystal / pixel / thunder（见 canEffects.js）
//   trail       （可选）跳跃拖尾：{ shape: 'heart'|'star'|'petal'|'note', colors: [...], rate, size, life, gravity, spread }
//   labelUrl    （可选）直接用一张图片当罐身贴图，例如 'assets/skins/my-can.png'
//               图片建议 1024×512，横向铺满一圈；填了它就忽略上面的颜色和文字
//
export const CAN_SKINS = [
  {
    id: 'cola', unlock: 'free',
    name: { zh: '经典可乐', en: 'Classic Cola', ar: 'كولا كلاسيك' },
    desc: { zh: '红色汽水罐，白色波浪', en: 'Red soda can with a white wave', ar: 'علبة صودا حمراء بموجة بيضاء' },
    body: '#d8232a', accent: '#ffffff', text: 'COLA', textColor: '#ffffff', sub: 'CLASSIC · FIZZY',
    lid: '#cfd3dc', bubbles: false,
  },
  {
    id: 'lemon', unlock: 'free',
    name: { zh: '柠檬汽水', en: 'Lemon Soda', ar: 'صودا الليمون' },
    desc: { zh: '清爽绿罐，带气泡', en: 'Fresh green can with bubbles', ar: 'علبة خضراء منعشة بفقاعات' },
    body: '#1f9d63', accent: '#c8f06a', text: 'Lemon', textColor: '#ffffff', sub: 'SPARKLING LEMON',
    lid: '#cfd3dc', bubbles: true,
  },
  {
    id: 'blue', unlock: 'free',
    name: { zh: '蓝色汽水', en: 'Blue Soda', ar: 'الصودا الزرقاء' },
    desc: { zh: '红白蓝配色的蓝罐', en: 'Blue can in red, white and blue', ar: 'علبة زرقاء بالأحمر والأبيض والأزرق' },
    body: '#1f4fbf', accent: '#e8333c', text: 'SODA', textColor: '#ffffff', sub: 'ICE COLD',
    lid: '#cfd3dc', bubbles: false,
  },
  {
    id: 'orange', unlock: 'free',
    name: { zh: '橙汁', en: 'Orange Juice', ar: 'عصير البرتقال' },
    desc: { zh: '橙色果汁罐', en: 'Orange juice can', ar: 'علبة عصير برتقال' },
    body: '#ff8a1c', accent: '#ffd23f', text: 'Orange', textColor: '#ffffff', sub: 'JUICE · 100%',
    lid: '#cfd3dc', bubbles: true,
  },
  // ---------- 特效款（兑换码随机解锁） ----------
  {
    id: 'gold', unlock: 'code', effect: 'gold',
    name: { zh: '黄金罐', en: 'Golden Can', ar: 'العلبة الذهبية' },
    desc: { zh: '24K 金属反光，跳跃时洒金粉', en: 'Shiny 24K metal, sprinkles gold dust when jumping', ar: 'معدن لامع عيار 24، ينثر غبار الذهب عند القفز' },
    body: '#e0a92e', accent: '#fff1b8', text: 'GOLD', textColor: '#5a3a00', sub: 'LIMITED · 24K', lid: '#f2c14e',
  },
  {
    id: 'chrome', unlock: 'code', effect: 'chrome',
    name: { zh: '镜面铬', en: 'Mirror Chrome', ar: 'كروم المرآة' },
    desc: { zh: '像镜子一样反射周围', en: 'Reflects everything like a mirror', ar: 'يعكس ما حوله كالمرآة' },
    body: '#d9dee6', accent: '#1b1d24', text: 'CHROME', textColor: '#1b1d24', sub: 'MIRROR FINISH', lid: '#ffffff',
  },
  {
    id: 'holo', unlock: 'code', effect: 'holo',
    name: { zh: '镭射幻彩', en: 'Holo Rainbow', ar: 'قوس قزح هولوغرامي' },
    desc: { zh: '彩虹镭射会流动，跳跃时拖出彩光', en: 'Flowing holographic rainbow with a colorful trail', ar: 'قوس قزح متحرك مع أثر ملوّن عند القفز' },
    body: '#c58cff', accent: '#7af0ff', text: 'HOLO', textColor: '#ffffff', sub: 'PRISM FIZZ', lid: '#e6e9f2',
  },
  {
    id: 'neon', unlock: 'code', effect: 'neon',
    name: { zh: '霓虹之夜', en: 'Neon Night', ar: 'ليلة النيون' },
    desc: { zh: '发光线条会呼吸闪烁', en: 'Glowing lines that pulse and flicker', ar: 'خطوط مضيئة تنبض وتومض' },
    body: '#0d0b1a', accent: '#00f0ff', text: 'NEON', textColor: '#ff3df2', sub: 'AFTER DARK', lid: '#2a2740',
  },
  {
    id: 'galaxy', unlock: 'code', effect: 'galaxy',
    name: { zh: '星空银河', en: 'Galaxy', ar: 'المجرة' },
    desc: { zh: '星云缓缓旋转，星星会闪', en: 'Slowly turning nebula with twinkling stars', ar: 'سديم يدور ببطء ونجوم تتلألأ' },
    body: '#2a1260', accent: '#ff4fb0', text: 'GALAXY', textColor: '#ffffff', sub: 'COSMIC SODA', lid: '#4b3a7a',
  },
  {
    id: 'blaze', unlock: 'code', effect: 'blaze',
    name: { zh: '烈焰', en: 'Blaze', ar: 'اللهب' },
    desc: { zh: '火焰罐身，跳跃时喷火', en: 'Flaming can that shoots fire when jumping', ar: 'علبة مشتعلة تطلق النار عند القفز' },
    body: '#d8301a', accent: '#ffd23f', text: 'BLAZE', textColor: '#fff3c4', sub: 'HOT CHILI', lid: '#3b2a26',
  },
  {
    id: 'frost', unlock: 'code', effect: 'frost',
    name: { zh: '冰霜', en: 'Frost', ar: 'الصقيع' },
    desc: { zh: '半透明冰罐，跳跃时飘雪', en: 'See-through icy can that snows when jumping', ar: 'علبة جليدية شبه شفافة تتساقط منها الثلوج عند القفز' },
    body: '#9fdcf5', accent: '#ffffff', text: 'FROST', textColor: '#1d5f8f', sub: 'ICE MINT', lid: '#d9f4ff',
  },
  {
    id: 'crystal', unlock: 'code', effect: 'crystal',
    name: { zh: '透明樱桃汽水', en: 'Crystal Cherry', ar: 'كرز كريستالي' },
    desc: { zh: '透明罐身，看得见饮料和上升的气泡', en: 'Clear can showing the soda and rising bubbles', ar: 'علبة شفافة تظهر المشروب والفقاعات الصاعدة' },
    body: '#ff4f8b', accent: '#ff8fb8', text: 'CHERRY', textColor: '#ffffff', sub: 'CLEAR SODA', lid: '#e6e9f2',
  },
  {
    id: 'pixel', unlock: 'code', effect: 'pixel',
    name: { zh: '像素 8-bit', en: 'Pixel 8-Bit', ar: 'بكسل 8-بت' },
    desc: { zh: '复古游戏机像素风', en: 'Retro game-console pixel style', ar: 'أسلوب بكسل مثل ألعاب الفيديو القديمة' },
    body: '#3b2fd1', accent: '#ff4f9a', text: '8BIT', textColor: '#ffe600', sub: '', lid: '#cfd3dc',
  },
  {
    id: 'thunder', unlock: 'code', effect: 'thunder',
    name: { zh: '闪电', en: 'Thunder', ar: 'البرق' },
    desc: { zh: '闪电纹随机闪亮，跳跃时冒电火花', en: 'Lightning that flashes, sparks fly when jumping', ar: 'برق يومض وشرارات تتطاير عند القفز' },
    body: '#16151c', accent: '#ffd400', text: 'VOLT', textColor: '#ffd400', sub: 'ENERGY', lid: '#2b2a33',
  },
  {
    id: 'chrono', unlock: 'code',
    name: { zh: '时停罐', en: 'Chrono Can', ar: 'علبة الزمن' },
    desc: { zh: '黄绿配色的原创设计；每局一次按 ⏱ 时停 5 秒', en: 'Original yellow-green design; tap ⏱ once per game to stop time for 5 seconds', ar: 'تصميم أصلي بالأخضر الأصفر؛ اضغط ⏱ مرة في كل جولة لإيقاف الزمن 5 ثوانٍ' },
    body: '#7cb518', accent: '#f5e60a', text: 'CHRONO', textColor: '#1f3d00', sub: '5 SEC · FREEZE', lid: '#e5e5e5',
  },
];
