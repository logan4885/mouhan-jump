// Roguelike 模式：29 个 Buff（BUFF_28 先知之眼已移除） 数据 + 局内状态机 RunState。
// 规则（照 Excel《SodaJump_Phygital_Architecture_and_Buffs》）：
//   BUFF_01~22 进入每 5 层的【三选一抽卡池】；BUFF_23~30 是 VIP 常驻被动，绝不占三选一的格子。
//   VIP = 已经拥有任一兑换罐的玩家（沿用游戏里现有的 VIP 判断）。
import { L } from './i18n.js?v=20261112c';

const tri = (zh, en, ar) => ({ zh, en, ar });
const B = (id, cat, icon, name, desc, extra = {}) => ({ id: 'BUFF_' + String(id).padStart(2, '0'), cat, icon, name, desc, pool: id <= 22 ? 'run' : 'vip', ...extra });

export const CATS = {
  survive: { name: tri('生存流', 'Survival', 'البقاء'), color: '#3fb97b' },
  crit: { name: tri('暴击得分流', 'Crit Score', 'النقاط'), color: '#ff8a3d' },
  chaos: { name: tri('机制混沌流', 'Chaos', 'الفوضى'), color: '#9a6bff' },
  vip: { name: tri('VIP 专属流', 'VIP', 'VIP'), color: '#e0a800' },
};

export const BUFFS = [
  B(1, 'survive', '🧲', tri('强磁罐体', 'Magnet Can', 'علبة مغناطيسية'), tri('Perfect 落地判定范围扩大 25%', 'Perfect landing zone +25%', 'منطقة الهبوط المثالي +25%')),
  B(2, 'survive', '🛡️', tri('气泡护盾', 'Bubble Shield', 'درع فقاعي'), tri('获得 1 次踩空或掉落不死的护盾（消耗性，可叠加）', 'Gain 1 shield that saves you from a miss or fall (consumed; stackable)', 'درع واحد ينقذك من السقوط (يُستهلك، قابل للتكديس)'), { repeat: true }),
  B(3, 'survive', '🪶', tri('羽毛缓降', 'Feather Fall', 'هبوط الريشة'), tri('滞空时间延长 0.3 秒，并在空中把落点向方块中心微调 35%', 'Air time +0.3 s, and your landing drifts 35% toward the block centre', 'زمن الطيران +0.3 ث وتُصحَّح نقطة الهبوط 35% نحو المركز')),
  B(4, 'survive', '🛞', tri('弹性垫圈', 'Spring Washer', 'حلقة نابضة'), tri('边缘没踩稳时，有 80% 的力度把你弹回平台', 'When you only clip an edge, an 80% bounce puts you back on a platform', 'عند الهبوط على الحافة، ارتداد بنسبة 80% يعيدك إلى المنصة')),
  B(5, 'survive', '🩸', tri('吸血易拉罐', 'Vampire Can', 'علبة مصاصة'), tri('每连续 5 次 Perfect，自动恢复 1 次护盾', 'Every 5 perfects in a row restores 1 shield', 'كل 5 هبوطات مثالية متتالية تعيد درعاً واحداً')),
  B(6, 'survive', '🛟', tri('安全气囊', 'Air Bag', 'وسادة هوائية'), tri('每达到 50 分的整倍数，下一个方块重置为最近距离', 'Every time your score passes a multiple of 50, the next block spawns at the shortest distance', 'كلما تجاوزت نتيجتك مضاعفاً للعدد 50 تظهر المنصة التالية في أقرب مسافة')),
  B(7, 'survive', '🧱', tri('绝对防御', 'Iron Wall', 'دفاع مطلق'), tri('接下来的 10 个方块宽度增加 30%', 'The next 10 blocks are 30% wider', 'المنصات العشر التالية أعرض بنسبة 30%'), { repeat: true }),
  B(8, 'survive', '♻️', tri('原地复苏', 'Second Wind', 'إحياء فوري'), tri('死亡时有 30% 概率直接复活在当前方块', 'On death, 30% chance to revive right on the current block', 'عند الموت احتمال 30% للعودة فوراً على المنصة الحالية')),
  B(9, 'crit', '🔥', tri('连击火花', 'Combo Spark', 'شرارة الكومبو'), tri('连续 Perfect 时积分 1.5x → 2x → 3x 递增', 'Consecutive perfects multiply points 1.5x → 2x → 3x', 'الهبوط المثالي المتتالي يضاعف النقاط 1.5x ← 2x ← 3x')),
  B(10, 'crit', '💰', tri('金币雨', 'Coin Rain', 'مطر العملات'), tri('每次跳跃爆出金色粒子，每次落地得分翻倍', 'Gold particles on every jump; every landing scores double', 'جسيمات ذهبية مع كل قفزة وكل هبوط يعطي ضعف النقاط')),
  B(11, 'crit', '🎯', tri('靶心暴击', 'Bullseye', 'إصابة المركز'), tri('精准踩中中心得 5 倍暴击分，边缘得分减半（至少 1 分）', 'A centre hit scores 5x; edge hits score half (min 1)', 'إصابة المركز تعطي 5 أضعاف؛ والحافة نصف النقاط (1 على الأقل)')),
  B(12, 'crit', '⚡', tri('蓄力超载', 'Overcharge', 'شحن زائد'), tri('蓄力条充满速度加快 50%，考验极速反应', 'Charge bar fills 50% faster — pure reflex test', 'يمتلئ شريط الشحن أسرع بنسبة 50%')),
  B(13, 'crit', '📈', tri('滚雪球效应', 'Snowball', 'كرة الثلج'), tri('每存活 10 秒，基础得分永久 +1', 'Every 10 seconds alive, base score +1 permanently', 'كل 10 ثوانٍ من البقاء تزيد النقاط الأساسية +1 للأبد')),
  B(14, 'crit', '💎', tri('钻石罐头', 'Diamond Can', 'علبة الألماس'), tri('接下来的 5 个方块变成 2 倍积分的高亮钻石方块', 'The next 5 blocks become glowing diamond blocks worth 2x', 'المنصات الخمس التالية تصبح ألماسية تعطي ضعف النقاط'), { repeat: true }),
  B(15, 'crit', '🚀', tri('火箭推力', 'Rocket Thrust', 'دفع صاروخي'), tri('起跳时 10% 概率无视距离，直接飞到下一个方块正中心', 'Each jump has a 10% chance to ignore distance and land dead-centre', 'كل قفزة بنسبة 10% تهبط في المركز مباشرة')),
  B(16, 'chaos', '🌀', tri('量子纠缠', 'Quantum Entangle', 'التشابك الكمي'), tri('下一个方块左右偏移 20%，命中积分 x3', 'The next block shifts sideways by 20%; hitting it scores 3x', 'المنصة التالية تنزاح 20% جانباً وإصابتها تعطي 3 أضعاف'), { repeat: true }),
  B(17, 'chaos', '🔀', tri('空间扭曲', 'Space Warp', 'التواء الفضاء'), tri('相机随机旋转 15 度，持续 5 秒', 'The camera rotates 15° at random for 5 seconds', 'تدور الكاميرا 15° عشوائياً لمدة 5 ثوانٍ'), { repeat: true }),
  B(18, 'chaos', '⏳', tri('子弹时间', 'Bullet Time', 'الزمن البطيء'), tri('蓄力超过 1 秒后，世界进入 0.5x 慢动作（蓄力也变慢）', 'After 1 s of charging the world drops to 0.5x slow motion (charging slows too)', 'بعد ثانية من الشحن يتباطأ العالم إلى 0.5x')),
  B(19, 'chaos', '🃏', tri('命运硬币', 'Fate Coin', 'عملة القدر'), tri('立刻抛硬币：50% 送 50 分，50% 清空当前连击', 'Flip now: 50% +50 points, 50% your combo is wiped', 'اقلبها الآن: 50% تحصل على +50 نقطة و50% يُمسح الكومبو'), { repeat: true }),
  B(20, 'chaos', '👻', tri('隐形罐体', 'Ghost Can', 'علبة شبحية'), tri('起跳后易拉罐隐形 1 秒，盲狙落点的落地得分 x1.5', 'Your can turns invisible for 1 s after jumping; blind landings score 1.5x', 'تختفي العلبة ثانية بعد القفز، والهبوط الأعمى يعطي 1.5x')),
  B(21, 'chaos', '🌪️', tri('气流干扰', 'Crosswind', 'رياح جانبية'), tri('每次起跳前出现随机侧风，落点会被吹偏，需要自己计算', 'A random crosswind appears before every jump and pushes your landing sideways', 'رياح جانبية عشوائية قبل كل قفزة تدفع نقطة الهبوط')),
  B(22, 'chaos', '🪞', tri('镜像世界', 'Mirror World', 'عالم المرآة'), tri('整个画面左右翻转，持续到下一次抽卡', 'The whole view flips left-right until the next card draw', 'ينقلب المشهد أفقياً حتى السحب التالي'), { repeat: true }),
  B(23, 'vip', '👑', tri('VIP 黄金护甲', 'Golden Armor', 'الدرع الذهبي'), tri('进场自带 1 层护盾，复活不消耗局内道具', 'Start every run with 1 shield; revives cost no in-run items', 'تبدأ بدرع واحد وإحياؤك لا يستهلك شيئاً')),
  B(24, 'vip', '🎵', tri('共鸣', 'Resonance', 'الرنين'), tri('每连续 10 次 Perfect 触发共鸣：全屏金光清除所有负面效果，并加 100 分（原创音效）', 'Every 10 perfects in a row: golden flash clears all curses and gives +100 (original sound)', 'كل 10 هبوطات مثالية: وميض ذهبي يزيل كل التأثيرات السلبية و+100 نقطة')),
  B(25, 'vip', '🧰', tri('多维背包', 'Multiverse Bag', 'الحقيبة اللانهائية'), tri('抽卡界面开启无限制 Reroll（刷新重抽）按钮', 'Unlimited Reroll button on the card screen', 'زر إعادة السحب غير محدود')),
  B(26, 'vip', '🪩', tri('迪斯科狂欢', 'Disco Fever', 'حمى الديسكو'), tri('踩中中心自动触发金色粒子雨与灯光特效', 'Centre hits trigger a golden particle rain and light show', 'إصابة المركز تُطلق مطر جسيمات ذهبية وأضواء')),
  B(27, 'vip', '🔋', tri('能量永动机', 'Perpetual Energy', 'طاقة لا تنفد'), tri('无限重开，没有次数限制', 'Unlimited restarts, no daily cap', 'إعادة بدء بلا حدود')),
  B(29, 'vip', '👑', tri('王者降临', 'King Arrives', 'وصول الملك'), tri('破 Roguelike 纪录时全屏王者横幅；排行榜里 VIP 自带金色发光边框', 'Breaking your Roguelike record shows a full-screen crown banner; VIPs glow gold on the leaderboard', 'كسر رقمك يعرض لافتة تاج بملء الشاشة، وتتوهج كلاعب VIP في لوحة الصدارة')),
  B(30, 'vip', '🎟️', tri('降维打击', 'Dimension Strike', 'ضربة الأبعاد'), tri('本局得分永久 x2，并盯着排行榜第 10 名作为挑战目标', 'Score x2 for the whole run, with the leaderboard #10 shown as your target', 'نقاطك x2 طوال الجولة مع عرض المركز العاشر كهدف')),
];

export const BUFF_BY_ID = Object.fromEntries(BUFFS.map((b) => [b.id, b]));
export const RUN_POOL = BUFFS.filter((b) => b.pool === 'run');
export const VIP_BUFFS = BUFFS.filter((b) => b.pool === 'vip');

/** 界面 / 提示文字（三语） */
/** 19 种机制方块：图标、名称、说明（解锁时顶部播报） */
export const HZ = {
  repulsion: { icon: '💥', name: tri('击退弹簧方块', 'Repulsion Spring', 'منصة الارتداد'), desc: tri('落地后被弹向方块后缘', 'You get bounced to the back edge after landing', 'ترتدّ إلى الحافة الخلفية بعد الهبوط') },
  icy: { icon: '🧊', name: tri('冰霜滑行方块', 'Icy Slide', 'منصة الجليد'), desc: tri('落地后会多滑一段，要少蓄一点力', 'You slide further after landing, charge a bit less', 'تنزلق أبعد بعد الهبوط، اشحن أقل') },
  sinking: { icon: '⏳', name: tri('极速下沉方块', 'Fast Sinker', 'منصة الغرق السريع'), desc: tri('站上去 1.2 秒就沉没，立刻起跳', 'Sinks in 1.2s once you land — jump now', 'تغرق خلال 1.2 ثانية، اقفز فوراً') },
  moving: { icon: '↔️', name: tri('左右移动方块', 'Moving Block', 'منصة متحركة'), desc: tri('起跳前左右滑动，起跳瞬间定格', 'Slides side to side until you jump', 'تتحرك جانبياً حتى تقفز') },
  scaling: { icon: '🔍', name: tri('动态缩放方块', 'Pulsing Block', 'منصة نابضة'), desc: tri('一会儿大一会儿小，起跳瞬间定格', 'Grows and shrinks until you jump', 'تكبر وتصغر حتى تقفز') },
  teleport: { icon: '🌀', name: tri('空间传送方块', 'Teleport Block', 'منصة الانتقال'), desc: tri('你一开始蓄力它就瞬移到旁边', 'It blinks sideways the moment you start charging', 'تنتقل جانباً لحظة بدء الشحن') },
  explosive: { icon: '💣', name: tri('炸弹定时方块', 'Time Bomb', 'منصة القنبلة'), desc: tri('站上去 1.7 秒后爆炸', 'Explodes 1.7s after you land', 'تنفجر بعد 1.7 ثانية من الهبوط') },
  windy: { icon: '🌪️', name: tri('侧向强风方块', 'Gale Block', 'منصة الرياح'), desc: tri('跳向它时被强风顺推或逆拉，落点变远或变近', 'A gust pushes your jump longer or shorter', 'عاصفة تدفع قفزتك لتطول أو تقصر') },
  mirrored: { icon: '🪞', name: tri('左右颠倒方块', 'Mirrored Block', 'منصة المرآة'), desc: tri('瞄准它时画面左右翻转', 'The screen flips while you aim at it', 'تنقلب الشاشة أثناء التصويب') },
  shocking: { icon: '⚡', name: tri('高压电击方块', 'Shock Block', 'منصة الصعق'), desc: tri('落地被电：不算完美，并麻痹 1 秒', 'Landing zaps you: no perfect, stunned 1s', 'تُصعق: لا مثالي وتشلّ ثانية') },
  blackhole: { icon: '🕳️', name: tri('黑洞吸附方块', 'Black Hole', 'منصة الثقب الأسود'), desc: tri('把你的跳跃吸短，要多蓄一点力', 'Pulls your jump short — charge more', 'يسحب قفزتك لتقصر، اشحن أكثر') },
  stealth: { icon: '👻', name: tri('隐形闪烁方块', 'Phantom Block', 'منصة الشبح'), desc: tri('一闪一闪地隐形，起跳瞬间现身', 'Flickers invisible until you jump', 'تومض وتختفي حتى تقفز') },
  fragile: { icon: '🧱', name: tri('脆皮易碎方块', 'Fragile Block', 'منصة هشّة'), desc: tri('只有靠近中心才站得稳，边缘会碎', 'Only the centre holds — the edges crumble', 'المركز فقط يتحمّل، الحواف تنهار') },
  reset: { icon: '🔄', name: tri('弹道重置方块', 'Reset Block', 'منصة إعادة الشحن'), desc: tri('蓄力条满了会归零重来', 'The charge bar loops back to zero when full', 'يعود شريط الشحن إلى الصفر عند الامتلاء') },
  lava: { icon: '🔥', name: tri('熔岩灼烧方块', 'Lava Block', 'منصة الحمم'), desc: tri('站上去蓄力速度 ×2', 'Charge speed ×2 while you stand on it', 'سرعة الشحن ×2 أثناء الوقوف') },
  bullseye: { icon: '🎯', name: tri('绝对靶心方块', 'Bullseye Block', 'منصة الهدف'), desc: tri('完美范围减半，但完美得分 ×3', 'Perfect zone halved, perfect score ×3', 'منطقة المثالي النصف، ونقاطه ×3') },
  timedilate: { icon: '⏱️', name: tri('时间膨胀方块', 'Time Dilation', 'منصة تمدد الزمن'), desc: tri('蓄力变慢 ×0.55，但倒计时走得更快', 'Charging slows ×0.55 but timers run faster', 'الشحن أبطأ ×0.55 لكن المؤقتات أسرع') },
  doublecoin: { icon: '💰', name: tri('双倍金币方块', 'Double Coin', 'منصة العملة المزدوجة'), desc: tri('落地得分 ×2', 'Landing score ×2', 'نقاط الهبوط ×2') },
  chaos: { icon: '👑', name: tri('终极混沌方块', 'Chaos God', 'منصة الفوضى'), desc: tri('同时带 2 种随机机制', 'Carries 2 random mechanics at once', 'تحمل آليتين عشوائيتين معاً') },
};

const TXT = {
  pick: tri('第 {n} 层 · 选一个 Buff', 'Floor {n} · pick a buff', 'الطابق {n} · اختر ميزة'),
  reroll: tri('🧰 刷新重抽（无限）', '🧰 Reroll (unlimited)', '🧰 إعادة السحب (بلا حدود)'),
  title: tri('Roguelike 模式', 'Roguelike mode', 'وضع Roguelike'),
  intro: tri('每跳 5 层，从 3 张 Buff 里选 1 张，越玩越强。有自己的 Roguelike 排行榜，不进总榜。每一个方块都是随机的机制方块（击退、冰面、移动、传送、炸弹、黑洞……共 19 种），难度爬升极快，约 65 个方块就到最终档，第 35 个方块起还会下沉。', 'Every 5 floors pick 1 of 3 buffs and snowball your build. It has its own Roguelike leaderboard, separate from the main one. Every single block is a random mechanic block (19 kinds) and the difficulty ramps up fast — max difficulty by block ~65, platforms start to sink from block ~35.', 'كل 5 طوابق اختر ميزة من 3 وقوِّ بناءك. لها لوحة صدارة خاصة. كل كتلة هي كتلة آلية عشوائية (19 نوعاً) والصعوبة ترتفع بسرعة، وتبدأ المنصات بالغرق من الكتلة 35 تقريباً.'),
  rankBtn: tri('🏆 Roguelike 排行榜', '🏆 Roguelike leaderboard', '🏆 لوحة صدارة Roguelike'),
  start: tri('开始 Roguelike', 'Start Roguelike', 'ابدأ Roguelike'),
  vipOn: tri('👑 VIP 被动已生效：{n} 项', '👑 VIP passives active: {n}', '👑 مزايا VIP مفعّلة: {n}'),
  vipOff: tri('用兑换码解锁任意一款特效罐即成为 VIP，开局自带 7 项常驻被动。', 'Unlock any special can with a code to become VIP and start with 7 permanent passives.', 'افتح أي علبة خاصة بالرمز لتصبح VIP وتبدأ بـ 7 مزايا دائمة.'),
  over: tri('Roguelike 结算', 'Roguelike result', 'نتيجة Roguelike'),
  floors: tri('到达第 {n} 层', 'Reached floor {n}', 'وصلت إلى الطابق {n}'),
  build: tri('本局 Build：', 'Your build: ', 'بناؤك: '),
  none: tri('没有选 Buff', 'No buffs picked', 'لم تختر أي ميزة'),
  zone: tri('{icon} 进入{name}（第 {n} 阶段）', '{icon} Entering {name} (stage {n})', '{icon} دخلت {name} (المرحلة {n})'),
  zone_novice: tri('轻松上手区', 'Easy Start Zone', 'منطقة البداية السهلة'),
  zone_mid: tri('节奏进阶区', 'Rhythm Zone', 'منطقة الإيقاع'),
  zone_adv: tri('机制乱斗区', 'Mayhem Zone', 'منطقة الفوضى'),
  zone_peak: tri('混沌巅峰区', 'Chaos Peak', 'قمة الفوضى'),
  unlock: tri('⚠️ 【跳过 {skip} 个方块】解锁第 {n} 种机制：【{icon} {name}】！{desc}', '⚠️ [{skip} blocks cleared] Mechanic #{n} unlocked: [{icon} {name}]! {desc}', '⚠️ [تجاوزت {skip} كتلة] آلية #{n}: [{icon} {name}]! {desc}'),
  chaosAll: tri('⚡ 20 种特殊机制全随机乱斗中！', '⚡ All mechanics are now mixed at random!', '⚡ كل الآليات مختلطة عشوائياً الآن!'),
  startMsg: tri('🔥 地狱模式！每个方块都是机制方块，从第一跳就开始乱斗！', '🔥 Hell mode! Every block is a mechanic block — chaos from the very first jump!', '🔥 وضع الجحيم! كل كتلة بآلية خاصة منذ القفزة الأولى!'),
  nextHz: tri('下一块', 'Next', 'التالية'),
  fuse: tri('💣 爆炸了！', '💣 Boom!', '💣 انفجار!'),
  sinkNote: tri('⏳ 平台在下沉，快跳！', '⏳ The platform is sinking, jump!', '⏳ المنصة تغرق، اقفز!'),
  shieldUsed: tri('🛡️ 护盾挡下了一次失误！', '🛡️ Shield saved you!', '🛡️ أنقذك الدرع!'),
  revived: tri('♻️ 原地复苏！', '♻️ Second Wind!', '♻️ إحياء فوري!'),
  spring: tri('🛞 弹回来了！', '🛞 Bounced back!', '🛞 ارتددت!'),
  rocket: tri('🚀 火箭推力！', '🚀 Rocket thrust!', '🚀 دفع صاروخي!'),
  vamp: tri('🩸 恢复 1 层护盾', '🩸 +1 shield', '🩸 +1 درع'),
  airbag: tri('🛟 下一个方块已拉近', '🛟 Next block pulled closer', '🛟 تم تقريب المنصة التالية'),
  snow: tri('📈 基础得分 +1（现在 +{n}）', '📈 Base score +1 (now +{n})', '📈 النقاط الأساسية +1 (الآن +{n})'),
  coinWin: tri('🃏 正面！+50 分', '🃏 Heads! +50', '🃏 صورة! +50'),
  coinLose: tri('🃏 反面…连击清零', '🃏 Tails… combo lost', '🃏 كتابة… ضاع الكومبو'),
  warp: tri('🔀 空间扭曲 5 秒', '🔀 Space warp for 5 s', '🔀 التواء الفضاء 5 ث'),
  mirror: tri('🪞 画面已翻转，到下一次抽卡恢复', '🪞 View mirrored until the next draw', '🪞 المشهد معكوس حتى السحب التالي'),
  mirrorEnd: tri('🪞 画面恢复正常', '🪞 View back to normal', '🪞 عاد المشهد طبيعياً'),
  quantum: tri('🌀 下一个方块偏移了！命中 x3', '🌀 Next block shifted! Hit it for x3', '🌀 تحركت المنصة التالية! إصابتها x3'),
  diamond: tri('💎 接下来 5 个方块是钻石方块', '💎 Next 5 blocks are diamond blocks', '💎 المنصات الخمس التالية ألماسية'),
  wall: tri('🧱 接下来 10 个方块变宽', '🧱 Next 10 blocks are wider', '🧱 المنصات العشر التالية أعرض'),
  resonance: tri('🎵 共鸣！+100，负面效果清除', '🎵 Resonance! +100, curses cleared', '🎵 رنين! +100 وزالت التأثيرات السلبية'),
  king: tri('👑 王者降临！新纪录', '👑 The King Arrives! New record', '👑 وصل الملك! رقم جديد'),
  target: tri('🎯 榜 10：{n}', '🎯 Top 10: {n}', '🎯 العاشر: {n}'),
  beat: tri('🎯 已超过排行榜第 10 名！', '🎯 You passed leaderboard #10!', '🎯 تجاوزت المركز العاشر!'),
  windL: tri('💨 左 {n}', '💨 left {n}', '💨 يسار {n}'),
  windR: tri('💨 右 {n}', '💨 right {n}', '💨 يمين {n}'),
  best: tri('Roguelike 最高', 'Roguelike best', 'أفضل Roguelike'),
};
export const rt = (k, vars = {}) => L(TXT[k]).replace(/\{(\w+)\}/g, (_, v) => (v in vars ? vars[v] : ''));

/** 一局 Roguelike 的全部状态：Buff、护盾、各种倍率与计数器 */
export class RunState {
  constructor(vip) {
    this.vip = !!vip;
    this.buffs = {};          // id -> 叠加次数
    this.picks = [];          // 选过的顺序（用于结算展示）
    this.layers = 0;          // 已经成功跳上的方块数（“层”）
    this.shield = 0;
    this.bonusBase = 0;       // 滚雪球累计的基础分
    this.snowT = 0;
    this.twistT = 0; this.twistDir = 1;
    this.mirrorLeft = 0;      // 镜像剩余层数
    this.wind = 0;            // 当前这一跳的侧风（格）
    this.invis = false;
    this.target10 = null;     // 降维打击：排行榜第 10 名的分数
    this.beat10 = false;
    if (this.vip) this.shield += 1;     // BUFF_23 黄金护甲
  }

  has(id) { return !!this.buffs[id]; }
  count(id) { return this.buffs[id] || 0; }
  vipHas(n) { return this.vip && n >= 23 && n <= 30; }   // 8 个 VIP 被动开局全部生效

  /** 记录选中的 Buff；立刻生效的效果由 Game 在选完后处理 */
  take(id) {
    this.buffs[id] = (this.buffs[id] || 0) + 1;
    this.picks.push(id);
    if (id === 'BUFF_02') this.shield += 1;
  }

  /** 抽 n 张不重复的候选；已选过且不可叠加的不会再出现 */
  choices(n = 3, exclude = []) {
    const pool = RUN_POOL.filter((b) => (b.repeat || !this.buffs[b.id]) && !exclude.includes(b.id));
    const out = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return out;
  }

  /** 叠加到罐子能力表上的数值（判定范围、蓄力速度、先知之眼） */
  perkMods() {
    return {
      perfectMul: this.has('BUFF_01') ? 1.25 : 1,
      chargeMul: this.has('BUFF_12') ? 1.5 : 1,
    };
  }
  floatAdd() { return this.has('BUFF_03') ? 0.3 : 0; }

  /** 一次落地的最终得分：基础分 × 各种倍率 */
  gain(base, { perfect, combo, diamond, quantum, invisible }) {
    let g = base + this.bonusBase;
    if (this.has('BUFF_09') && perfect) g *= combo >= 4 ? 3 : combo === 3 ? 2 : combo === 2 ? 1.5 : 1;
    if (this.has('BUFF_11')) g *= perfect ? 5 : 0.5;
    if (this.has('BUFF_10')) g *= 2;
    if (diamond) g *= 2;
    if (quantum) g *= 3;
    if (invisible) g *= 1.5;
    if (this.vip) g *= 2;            // BUFF_30 降维打击
    return Math.max(1, Math.round(g));
  }

  useShield() { if (this.shield > 0) { this.shield--; return true; } return false; }
  rollRevive() { return this.has('BUFF_08') && Math.random() < 0.3; }

  /** 每次起跳前重新掷一次侧风（BUFF_21），-0.45 ~ +0.45 格，正数 = 朝跳跃方向的右边吹 */
  rollWind() {
    this.wind = this.has('BUFF_21') ? Math.round((Math.random() * 2 - 1) * 45) / 100 : 0;
    return this.wind;
  }

  /** 清除负面效果（共鸣用） */
  clearCurses() { this.wind = 0; this.twistT = 0; this.mirrorLeft = 0; this.invis = false; }
}

/** 解出蓄力到多少秒刚好落在距离 dist 上（和 Game.release 用同一条公式，供先知之眼用） */
export function chargeTimeFor(dist, CONFIG) {
  const a = CONFIG.JUMP_ACCEL, b = CONFIG.JUMP_SPEED, c = CONFIG.JUMP_MIN_DIST - dist;
  if (dist <= CONFIG.JUMP_MIN_DIST) return 0;
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}
