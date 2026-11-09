// 易拉罐能力：兑换款罐子各有一个小能力。
// 平衡原则：
//   1. 每个能力都很小，或者每局只能用一次；
//   2. 偏强的能力都带一个代价（例如完美范围变小、连击加成变少）；
//   3. 不改变方块的大小和距离，大家玩的是同一张“地图”。
// 没写在这里的罐子（4 款基础罐）是“标准手感”，没有能力也没有代价。
//
// 可用参数（不写就是默认值）：
//   chargeMul        蓄力速度倍率（1 = 标准；<1 更好控制，>1 更快更难）
//   floatMul         空中时间倍率（只影响手感，不影响距离）
//   perfectMul       完美判定范围倍率
//   edgeGrace        落在方块边缘外一点点也算站稳（单位：格）
//   perfectBase      第一次完美得几分（标准 2）
//   streakStep       连续完美每次多加几分（标准 2）
//   streakCap        完美单次最高几分（标准 32）
//   revive           每局一次复活：'any' 任何失误 / 'tip' 只限边缘翻倒
//   reviveAfter      分数达到多少后才能复活
//   bonusEvery       分数每跨过这个数，额外 +1
//   perfectRing      在下一个方块上显示完美区域
//   thunderStreak    连续几次完美后，下一次只要落在方块上就算完美
//   timeStop         每局一次：点 ⏱ 按钮时停这么多秒（时停期间蓄力速度变为 freezeChargeMul 倍，更好控制）
//   freezeChargeMul  时停期间的蓄力速度倍率

export const DEFAULT_PERK = { chargeMul: 1, floatMul: 1, perfectMul: 1, edgeGrace: 0, perfectBase: 2, streakStep: 2, streakCap: 32 };

export const PERKS = {
  gold: {
    icon: '💰', perfectBase: 3, streakStep: 2, streakCap: 33, perfectMul: 0.8,
    name: { zh: '招财', en: 'Fortune', ar: 'الثروة' },
    desc: { zh: '完美多得 1 分；代价：完美范围小 20%', en: 'Perfect landings give +1 extra; cost: perfect zone 20% smaller', ar: 'الهبوط المثالي يمنح نقطة إضافية؛ الثمن: منطقة المثالي أصغر 20%' },
  },
  chrome: {
    icon: '🛡️', revive: 'any', streakStep: 0, streakCap: 2,
    name: { zh: '反弹护盾', en: 'Bounce Shield', ar: 'درع الارتداد' },
    desc: { zh: '每局第一次失误弹回原地；代价：连续完美不再加分（完美固定 2 分）', en: 'Your first fall each game bounces you back; cost: perfect streaks give no bonus (always 2)', ar: 'أول سقوط في كل جولة يعيدك لمكانك؛ الثمن: لا مكافأة للسلسلة المثالية (دائمًا 2)' },
  },
  holo: {
    icon: '🌈', streakStep: 3, streakCap: 17,
    name: { zh: '彩虹连击', en: 'Rainbow Streak', ar: 'سلسلة قوس قزح' },
    desc: { zh: '连续完美涨得更快（每次 +3）；代价：单次最高 17 分', en: 'Perfect streaks grow faster (+3 each); cost: capped at 17 per landing', ar: 'السلسلة المثالية تنمو أسرع (+3)؛ الثمن: الحد الأقصى 17 لكل هبوط' },
  },
  neon: {
    icon: '🎯', perfectRing: true,
    name: { zh: '夜视', en: 'Night Vision', ar: 'رؤية ليلية' },
    desc: { zh: '下一个方块上会亮出完美区域', en: 'Shows the perfect zone on the next block', ar: 'يُظهر منطقة الهبوط المثالي على المكعب التالي' },
  },
  galaxy: {
    icon: '🪐', chargeMul: 0.88, floatMul: 1.15,
    name: { zh: '低重力', en: 'Low Gravity', ar: 'جاذبية منخفضة' },
    desc: { zh: '蓄力慢 12%，更好控制；跳得更飘', en: 'Charging is 12% slower for finer control; floatier jumps', ar: 'الشحن أبطأ 12% لتحكم أدق؛ قفزات أخف' },
  },
  blaze: {
    icon: '🔥', chargeMul: 1.15, bonusEvery: 10,
    name: { zh: '爆发', en: 'Burst', ar: 'الانفجار' },
    desc: { zh: '每满 10 分额外 +1；代价：蓄力快 15%，更难控制', en: '+1 bonus every 10 points; cost: charging is 15% faster and harder to control', ar: '+1 كل 10 نقاط؛ الثمن: الشحن أسرع 15% وأصعب في التحكم' },
  },
  frost: {
    icon: '❄️', edgeGrace: 0.08, perfectMul: 0.85,
    name: { zh: '防滑', en: 'Grip', ar: 'مانع الانزلاق' },
    desc: { zh: '方块边缘多一点站稳空间；代价：完美范围小 15%', en: 'A little extra footing at block edges; cost: perfect zone 15% smaller', ar: 'مساحة إضافية صغيرة على حواف المكعبات؛ الثمن: منطقة المثالي أصغر 15%' },
  },
  crystal: {
    icon: '🫧', revive: 'tip',
    name: { zh: '气泡缓冲', en: 'Bubble Cushion', ar: 'وسادة الفقاعات' },
    desc: { zh: '每局一次：在方块边缘翻倒时弹回原地（完全跳空无效）', en: 'Once per game: tipping off a block edge bounces you back (does not save a full miss)', ar: 'مرة في كل جولة: السقوط عن حافة المكعب يعيدك (لا يُنقذ القفزة الفائتة تمامًا)' },
  },
  pixel: {
    icon: '👾', revive: 'any', reviveAfter: 30,
    name: { zh: '1UP', en: '1UP', ar: 'حياة إضافية' },
    desc: { zh: '分数到 30 后获得一次复活', en: 'Earn one extra life after reaching 30 points', ar: 'تحصل على حياة إضافية بعد الوصول إلى 30 نقطة' },
  },
  chrono: {
    icon: '⏱', timeStop: 5, freezeChargeMul: 0.4, perfectMul: 0.9,
    name: { zh: '时停', en: 'Time Stop', ar: 'إيقاف الزمن' },
    desc: {
      zh: '每局一次：点 ⏱ 时停 5 秒，期间蓄力速度只有 40%，更好控制；代价：完美范围小 10%',
      en: 'Once per game: tap ⏱ to stop time for 5 s, charging runs at 40% speed for finer control; cost: perfect zone 10% smaller',
      ar: 'مرة في كل جولة: اضغط ⏱ لإيقاف الزمن 5 ثوانٍ، يصبح الشحن بسرعة 40% لتحكم أدق؛ الثمن: منطقة المثالي أصغر 10%',
    },
  },
  thunder: {
    icon: '⚡', thunderStreak: 3,
    name: { zh: '充能', en: 'Charge Up', ar: 'الشحن' },
    desc: { zh: '连续 3 次完美后，下一跳只要落在方块上就算完美', en: 'After 3 perfects in a row, your next landing on the block counts as perfect', ar: 'بعد 3 هبوطات مثالية متتالية، الهبوط التالي على المكعب يُحسب مثاليًا' },
  },
};

export function getPerk(skinId) {
  const p = PERKS[skinId];
  return p ? { ...DEFAULT_PERK, ...p, id: skinId } : { ...DEFAULT_PERK, id: null };
}
