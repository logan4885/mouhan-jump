// Roguelike 模式的关卡表（2026-11-12 起改为分档难度）：前 10 个方块是新手教学（普通方块、间距短、方块大、没有敌人），之后每 10 个方块难度提升一档：
//   机制方块解锁更多种且概率更高、方块更小间距更远、下沉倒计时（第 4 档起）逐档缩短、敌人更多更密。第 12 档（约第 120 个方块）后保持最难。
// 旧版（每 20 个方块一档，见 SodaJump_1000Blocks_Every20_Hazard_Progression.xlsx）的说明如下，仅供参考：
//  · 前 20 个方块是标准新手方块；之后每过 20 个方块解锁 1 种新的“机制方块”，加入随机池（共 19 种，第 400 个方块起全部混用）
//  · 方块间距 6.25 → 15.07、平台宽度 2.80 → 2.02 按档位线性变化（这里平滑插值）
//  · 第 501 个方块起出现下沉倒计时：6.0 秒逐档缩短，第 801 个方块起一口气收到 3.5 秒，最后 2.6 秒；1000 个方块之后保持最后一档
// 表里的数字是设计稿单位，这里换算成游戏世界单位：
//   间距 6.25 → 15.07  对应  平均相邻方块中心距 3.2 → 8.0（最大跳距 9.5，留出余量）
//   宽度 2.80 → 2.02   对应  方块最大边长 2.6 → 1.8、最小边长 1.5 → 1.08

export const STAIR = {
  // ---- 分档难度（现行）：前 10 个方块是新手教学，之后每 10 个方块难度提升一档 ----
  tierSize: 10,         // 每多少个方块升一档
  easyTiers: 1,         // 前几档完全没有机制方块、没有下沉、没有敌人（1 = 前 10 个方块）
  maxTier: 12,          // 升到第几档时达到最难（第 130 个方块之后保持最难）
  perTierUnlock: 2,     // 每升一档多解锁几种机制方块（共 19 种，按 HZ_ORDER 由易到难）
  chance: [0.3, 1],     // 带机制的概率：第 1 档 → 最难档（线性）
  timerFrom: 4,         // 下沉倒计时从第几档开始
  timerStart: 5.5, timerStep: 0.4, timerMin: 1.6,   // 起始秒数 / 每档缩短 / 最短
  gap: [3.4, 8.7],      // 平均相邻方块中心距：最容易 → 最难（世界单位；最大跳距 9.5）
  sizeMax: [2.4, 1.25], sizeMin: [1.6, 0.8],        // 方块最大 / 最小边长：最容易 → 最难
  allUnlocked: false, step: 10,                      // 旧版兼容字段，不再使用
};

/** 各机制的强度（地狱模式下比原设计更狠） */
export const HZT = {
  wind: 1.2,          // 强风：这一跳额外吹偏（格）
  icy: 1.3,           // 冰面：多滑（格）
  blackhole: 0.82,    // 黑洞：跳跃被吸短到 82%
  stun: 1.0,          // 电击：麻痹（秒）
  lava: 2.0,          // 熔岩：蓄力速度倍数
  sinking: 1.2,       // 极速下沉：站上去多久沉没（秒）
  explosive: 1.7,     // 炸弹：站上去多久爆炸（秒）
  moveAmp: 1.6, moveSpeed: 3.2,   // 移动方块：幅度 / 速度
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** 19 种机制方块，按解锁顺序（每升一档多解锁 STAIR.perTierUnlock 种） */
export const HZ_ORDER = ['repulsion', 'icy', 'doublecoin', 'moving', 'scaling', 'windy', 'teleport', 'mirrored', 'bullseye', 'blackhole',
  'fragile', 'stealth', 'shocking', 'lava', 'reset', 'timedilate', 'sinking', 'explosive', 'chaos'];   // 由易到难：越往后越晚解锁

/** 落上去之后还会持续生效的机制（离开方块才恢复普通外观） */
export const STAND_HZ = ['sinking', 'explosive', 'reset', 'lava', 'timedilate'];

export const ZONES = [
  { id: 'novice', icon: '🌱' }, { id: 'mid', icon: '⚡' }, { id: 'adv', icon: '🌪️' }, { id: 'peak', icon: '🔥' },
];

/** 第 idx 个方块（1 起）对应的关卡参数：tier = 第几档（0 = 新手教学，每 10 个方块 +1） */
export function stairParams(idx) {
  const t = Math.max(0, Math.floor((Math.max(1, idx) - 1) / STAIR.tierSize));
  const f = Math.min(1, t / STAIR.maxTier);                         // 0 ~ 1：越大越难
  const easy = t < STAIR.easyTiers;
  const unlockedAt = (tt) => (tt < STAIR.easyTiers ? 0 : Math.min(19, (tt - STAIR.easyTiers + 1) * STAIR.perTierUnlock));
  const unlocked = unlockedAt(t);
  const timer = t >= STAIR.timerFrom ? Math.max(STAIR.timerMin, STAIR.timerStart - (t - STAIR.timerFrom) * STAIR.timerStep) : null;
  const gapMean = STAIR.gap[0] + (STAIR.gap[1] - STAIR.gap[0]) * f;
  const zoneIdx = t <= 2 ? 0 : t <= 5 ? 1 : t <= 8 ? 2 : 3;
  const span = Math.max(1, STAIR.maxTier - STAIR.easyTiers);
  return {
    k: t, tier: t, stage: t + 1, zone: ZONES[zoneIdx], zoneIdx,
    timer,
    pool: HZ_ORDER.slice(0, unlocked), unlockedNew: HZ_ORDER.slice(unlockedAt(t - 1), unlocked),   // 这一档新解锁的机制（数组）
    chance: easy ? 0 : STAIR.chance[0] + (STAIR.chance[1] - STAIR.chance[0]) * Math.min(1, (t - STAIR.easyTiers) / span),
    gapMean, gapMin: gapMean * 0.85, gapMax: gapMean * 1.15,
    sizeMax: STAIR.sizeMax[0] + (STAIR.sizeMax[1] - STAIR.sizeMax[0]) * f, sizeMin: STAIR.sizeMin[0] + (STAIR.sizeMin[1] - STAIR.sizeMin[0]) * f,
  };
}
