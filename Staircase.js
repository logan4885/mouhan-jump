// Roguelike 模式的关卡表：前 1000 个方块，每 20 个方块一档（见 SodaJump_1000Blocks_Every20_Hazard_Progression.xlsx）
//  · 前 20 个方块是标准新手方块；之后每过 20 个方块解锁 1 种新的“机制方块”，加入随机池（共 19 种，第 400 个方块起全部混用）
//  · 方块间距 6.25 → 15.07、平台宽度 2.80 → 2.02 按档位线性变化（这里平滑插值）
//  · 第 501 个方块起出现下沉倒计时：6.0 秒逐档缩短，第 801 个方块起一口气收到 3.5 秒，最后 2.6 秒；1000 个方块之后保持最后一档
// 表里的数字是设计稿单位，这里换算成游戏世界单位：
//   间距 6.25 → 15.07  对应  平均相邻方块中心距 3.2 → 8.0（最大跳距 9.5，留出余量）
//   宽度 2.80 → 2.02   对应  方块最大边长 2.6 → 1.8、最小边长 1.5 → 1.08

export const STAIR = {
  allUnlocked: true,  // true = 一开局 19 种机制全部在随机池里（“地狱模式”）；false = 照表每档解锁一种
  step: 4 / 3,        // 每档多少个方块（表里是 20；现在 4/3：难度爬升速度是上一版 4 的 3 倍，约 65 个方块就到最终档）
  timerScale: 0.5,    // 下沉倒计时整体收紧（表里 6.0 → 现在 3.0；1.0 = 照表）
  chance: [1, 1],     // 带机制的概率：解锁期 / 全部混用之后（1 = 每个方块都是机制方块）
  gap: [4.8, 8.7],    // 平均相邻方块中心距：起步 → 最终（世界单位；最大跳距 9.5）
  sizeMax: [2.1, 1.25], sizeMin: [1.15, 0.8],   // 方块最大 / 最小边长：起步 → 最终
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

/** 19 种机制方块，按解锁顺序（第 N 档解锁第 N 种） */
export const HZ_ORDER = ['repulsion', 'icy', 'sinking', 'moving', 'scaling', 'teleport', 'explosive', 'windy', 'mirrored',
  'shocking', 'blackhole', 'stealth', 'fragile', 'reset', 'lava', 'bullseye', 'timedilate', 'doublecoin', 'chaos'];

/** 落上去之后还会持续生效的机制（离开方块才恢复普通外观） */
export const STAND_HZ = ['sinking', 'explosive', 'reset', 'lava', 'timedilate'];

export const ZONES = [
  { id: 'novice', icon: '🌱' }, { id: 'mid', icon: '⚡' }, { id: 'adv', icon: '🌪️' }, { id: 'peak', icon: '🔥' },
];

/** 第 idx 个方块（1 起）对应的关卡参数 */
export function stairParams(idx) {
  const i = Math.max(1, (idx - 1) * 20 / STAIR.step + 1);          // 折算成“每档 20 块”的位置
  const b = Math.min(49, (i - 1) / 20);                            // 连续档位 0 ~ 49
  const k = Math.min(49, Math.floor((i - 1) / 20));                // 当前所在档位（整数）
  const distance = 6.25 + 0.18 * b;
  const width = 2.80 - (0.78 / 49) * b;
  const t0 = k >= 40 ? 3.5 - (k - 40) * 0.1 : k >= 25 ? 6.0 - (k - 25) * 0.1 : null;
  const timer = t0 == null ? null : Math.max(1.2, t0 * STAIR.timerScale);
  const unlocked = STAIR.allUnlocked ? 19 : Math.min(19, k);
  const kk = (2.80 - width) / 0.78;
  const zoneIdx = i <= 200 ? 0 : i <= 500 ? 1 : i <= 800 ? 2 : 3;
  const gapMean = STAIR.gap[0] + ((distance - 6.25) / (15.07 - 6.25)) * (STAIR.gap[1] - STAIR.gap[0]);
  return {
    k, stage: k + 1, zone: ZONES[zoneIdx], zoneIdx,
    distance, width, timer,
    pool: HZ_ORDER.slice(0, unlocked), unlockedNew: !STAIR.allUnlocked && k >= 1 && k <= 19 ? HZ_ORDER[k - 1] : null,
    chance: STAIR.allUnlocked ? STAIR.chance[1] : k === 0 ? 0 : k < 20 ? STAIR.chance[0] : STAIR.chance[1],
    gapMean, gapMin: gapMean * 0.85, gapMax: gapMean * 1.15,
    sizeMax: STAIR.sizeMax[0] + (STAIR.sizeMax[1] - STAIR.sizeMax[0]) * kk, sizeMin: STAIR.sizeMin[0] + (STAIR.sizeMin[1] - STAIR.sizeMin[0]) * kk,
  };
}
