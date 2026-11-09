// 专属表现：稀有度 + 每款罐子的“完美落地大特效 / 连击氛围 / 专属音乐 / 专属音效”。
// 平衡原则：这里的一切都是【纯外观】——不改变得分、判定、难度。稀有度越高，视觉和音乐越华丽，用来激发收集欲。
//
// 字段说明：
//   rarity   传说 legendary / 史诗 epic / 稀有 rare（4 款基础罐没有专属表现，是“标准”）
//   burst    完美落地的特效种类（SignatureFX.js 里实现）
//   color    主色（飘字、光晕、粒子用）
//   word     完美落地时弹出的专属飘字（三语）
//   theme    专属音乐的 id（SkinAudio.js 里的 THEMES）
//   sfx      专属完美音效的 id（SkinAudio.js 里的 SFX）
//   desc     商店里显示的一句话介绍（三语）

export const RARITY = {
  legendary: {
    order: 3, color: '#ffb300', burstMul: 2.2, flash: true, ambienceFrom: 2, comboMusicBoost: 1,
    name: { zh: '传说', en: 'Legendary', ar: 'أسطوري' },
  },
  epic: {
    order: 2, color: '#a855f7', burstMul: 1.5, flash: false, ambienceFrom: 2, comboMusicBoost: 0,
    name: { zh: '史诗', en: 'Epic', ar: 'ملحمي' },
  },
  rare: {
    order: 1, color: '#38a3ff', burstMul: 1, flash: false, ambienceFrom: 3, comboMusicBoost: 0,
    name: { zh: '稀有', en: 'Rare', ar: 'نادر' },
  },
};

export const SIGNATURE = {
  gold: {
    rarity: 'legendary', burst: 'coins', color: '#ffc83d', theme: 'gold', sfx: 'coin',
    word: { zh: '财源滚滚！', en: 'JACKPOT!', ar: 'جاكبوت!' },
    desc: {
      zh: '🎵 爵士摇摆 · ✨ 完美落地金币雨', en: '🎵 Swing jazz · ✨ Gold coin shower on perfects', ar: '🎵 جاز سوينغ · ✨ مطر العملات الذهبية',
    },
  },
  galaxy: {
    rarity: 'legendary', burst: 'galaxy', color: '#c77dff', theme: 'galaxy', sfx: 'chime',
    word: { zh: '星河璀璨！', en: 'COSMIC!', ar: 'كوني!' },
    desc: {
      zh: '🎵 太空氛围 · ✨ 星云旋涡与流星', en: '🎵 Spacey ambient · ✨ Nebula swirl and shooting stars', ar: '🎵 أجواء فضائية · ✨ دوامة سديم ونيازك',
    },
  },
  holo: {
    rarity: 'legendary', burst: 'rainbow', color: '#7af0ff', theme: 'holo', sfx: 'rainbow',
    word: { zh: '彩虹爆发！', en: 'PRISM!', ar: 'قوس قزح!' },
    desc: {
      zh: '🎵 闪耀未来流行 · ✨ 彩虹冲击环与彩带', en: '🎵 Shimmering future pop · ✨ Rainbow rings and confetti', ar: '🎵 بوب مستقبلي لامع · ✨ حلقات قوس قزح وقصاصات',
    },
  },
  blaze: {
    rarity: 'epic', burst: 'blaze', color: '#ff7a1a', theme: 'blaze', sfx: 'whoosh',
    word: { zh: '烈焰冲击！', en: 'BLAZING!', ar: 'ملتهب!' },
    desc: {
      zh: '🎵 热血摇滚芯片曲 · ✨ 火焰冲击波', en: '🎵 Driving chip-rock · ✨ Fire shockwave', ar: '🎵 روك رقمي حماسي · ✨ موجة نار',
    },
  },
  thunder: {
    rarity: 'epic', burst: 'thunder', color: '#ffe14a', theme: 'thunder', sfx: 'crack',
    word: { zh: '雷霆万钧！', en: 'THUNDER!', ar: 'رعد!' },
    desc: {
      zh: '🎵 重低音电子 · ✨ 闪电劈落', en: '🎵 Heavy electro bass · ✨ Lightning strike', ar: '🎵 إلكترو باس ثقيل · ✨ صاعقة',
    },
  },
  neon: {
    rarity: 'epic', burst: 'neon', color: '#00f0ff', theme: 'neon', sfx: 'zap',
    word: { zh: '霓虹爆闪！', en: 'NEON!', ar: 'نيون!' },
    desc: {
      zh: '🎵 复古合成波 · ✨ 霓虹光线冲击', en: '🎵 Retro synthwave · ✨ Neon light streaks', ar: '🎵 سينثويف كلاسيكي · ✨ خطوط نيون',
    },
  },
  pixel: {
    rarity: 'epic', burst: 'pixel', color: '#ffe600', theme: 'pixel', sfx: 'powerup',
    word: { zh: '升级啦！', en: 'LEVEL UP!', ar: 'ارتقاء!' },
    desc: {
      zh: '🎵 8-bit 芯片音乐 · ✨ 像素方块爆裂', en: '🎵 8-bit chiptune · ✨ Pixel burst', ar: '🎵 موسيقى 8-بت · ✨ انفجار بكسلات',
    },
  },
  chrono: {
    rarity: 'epic', burst: 'pharaoh', color: '#ffd23a', theme: 'egypt', sfx: 'ping',
    word: { zh: '定格！', en: 'FREEZE!', ar: 'تجمّد!' },
    desc: {
      zh: '🎵 埃及风格音乐 · ✨ 荷鲁斯之眼与安卡金光', en: '🎵 Egyptian-style music · ✨ Eye of Horus & golden ankhs', ar: '🎵 موسيقى بطابع مصري · ✨ عين حورس وعلامات عنخ ذهبية',
    },
  },
  chrome: {
    rarity: 'rare', burst: 'shards', color: '#dfe6f3', theme: 'chrome', sfx: 'ping',
    word: { zh: '镜面闪耀！', en: 'SHINY!', ar: 'لامع!' },
    desc: {
      zh: '🎵 清爽浩室 · ✨ 镜面碎片闪光', en: '🎵 Clean house groove · ✨ Mirror shard glints', ar: '🎵 هاوس منعش · ✨ شظايا مرآة',
    },
  },
  frost: {
    rarity: 'rare', burst: 'frost', color: '#9fdcf5', theme: 'frost', sfx: 'icechime',
    word: { zh: '冰晶绽放！', en: 'FROZEN!', ar: 'متجمد!' },
    desc: {
      zh: '🎵 水晶八音盒 · ✨ 冰晶雪花', en: '🎵 Crystal music box · ✨ Ice crystals and snow', ar: '🎵 صندوق موسيقى بلوري · ✨ بلورات جليد وثلج',
    },
  },
  crystal: {
    rarity: 'rare', burst: 'bubbles', color: '#ff7fb0', theme: 'crystal', sfx: 'bubble',
    word: { zh: '气泡派对！', en: 'FIZZY!', ar: 'فوّار!' },
    desc: {
      zh: '🎵 轻快气泡 Lo-fi · ✨ 樱桃气泡升腾', en: '🎵 Bubbly lo-fi · ✨ Cherry bubbles rising', ar: '🎵 لو-فاي فقاعي · ✨ فقاعات كرز صاعدة',
    },
  },
};

export const getSignature = (skinId) => SIGNATURE[skinId] || null;
export const rarityOf = (skinId) => (SIGNATURE[skinId] ? RARITY[SIGNATURE[skinId].rarity] : null);
