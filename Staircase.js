// Roguelike 模式的关卡表：前 1000 个方块，每 20 个方块一档（见 SodaJump_1000Blocks_Every20_Hazard_Progression.xlsx）
//  · 前 20 个方块是标准新手方块；之后每过 20 个方块解锁 1 种新的“机制方块”，加入随机池（共 19 种，第 400 个方块起全部混用）
//  · 方块间距 6.25 → 15.07、平台宽度 2.80 → 2.02 按档位线性变化（这里平滑插值）
//  · 第 501 个方块起出现下沉倒计时：6.0 秒逐档缩短，第 801 个方块起一口气收到 3.5 秒，最后 2.6 秒；1000 个方块之后保持最后一档
// 表里的数字是设计稿单位，这里换算成游戏世界单位：
//   间距 6.25 → 15.07  对应  平均相邻方块中心距 3.2 → 8.0（最大跳距 9.5，留出余量）
//   宽度 2.80 → 2.02   对应  方块最大边长 2.6 → 1.8、最小边长 1.5 → 1.08

export const STAIR = {
  step: 20,        // 每档多少个方块（表里是 20；想快速体验把它改小，比如 5，解锁节奏会按比例加快）
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
  const timer = k >= 40 ? 3.5 - (k - 40) * 0.1 : k >= 25 ? 6.0 - (k - 25) * 0.1 : null;
  const unlocked = Math.min(19, k);
  const kk = (2.80 - width) / 0.78;
  const zoneIdx = i <= 200 ? 0 : i <= 500 ? 1 : i <= 800 ? 2 : 3;
  const gapMean = 3.2 + ((distance - 6.25) / (15.07 - 6.25)) * 4.8;
  return {
    k, stage: k + 1, zone: ZONES[zoneIdx], zoneIdx,
    distance, width, timer,
    pool: HZ_ORDER.slice(0, unlocked), unlockedNew: k >= 1 && k <= 19 ? HZ_ORDER[k - 1] : null,
    chance: k === 0 ? 0 : k < 20 ? 0.35 : 0.45,
    gapMean, gapMin: gapMean * 0.85, gapMax: gapMean * 1.15,
    sizeMax: 2.6 - 0.8 * kk, sizeMin: 1.5 - 0.42 * kk,
  };
}
