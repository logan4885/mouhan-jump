// Roguelike 模式的“5 万层阶梯式关卡”难度表（见 SodaJump_50000Floors_Staircase_Difficulty_Design.xlsx）
// 表里的间距/宽度是设计稿数值，这里按比例换算到游戏里的世界单位：
//   间距 6.25 → 17.03  对应  平均相邻方块中心距 3.2 → 8.4（最大跳距 9.5，留出余量）
//   宽度 2.80 → 1.97   对应  方块最大边长 2.6 → 1.75、最小边长 1.5 → 1.05
// 层数用连续插值（不是每 1000 层突然跳一档），同一阶段内逐层平滑过渡。

export const STAIR = {
  floorsPerStage: 1000,   // 表里每 1000 层一个阶段；想快速体验可临时改成 20
  stages: 50,
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const ZONES = [
  { id: 'novice', icon: '🌱', from: 1, to: 1 },
  { id: 'mid', icon: '⚡', from: 2, to: 10 },
  { id: 'adv', icon: '🌪️', from: 11, to: 25 },
  { id: 'peak', icon: '🔥', from: 26, to: 50 },
];

export function zoneOf(stage) { return ZONES.find((z) => stage >= z.from && stage <= z.to) || ZONES[3]; }

/** 根据层数返回这一层的关卡参数（连续插值） */
export function stairParams(floor) {
  const per = STAIR.floorsPerStage;
  const f = clamp(floor, 1, per * STAIR.stages);
  const b = Math.min(STAIR.stages - 1, (f - 1) / per);            // 连续的“阶段进度” 0 ~ 49
  const distance = Math.min(17.03, 6.25 + b * 0.22);               // 表：方块间距
  const width = Math.max(1.97, 2.80 - b * 0.017);                  // 表：平台宽度
  const timer = b >= 10 ? Math.max(2.6, 6.0 - (b - 10) * 0.088) : null;   // 表：下沉倒计时（秒），前 10 个阶段无
  const hazard = Math.min(40, b * 0.85);                           // 表：阴间机制概率（%）
  const gapMean = 3.2 + ((distance - 6.25) / (17.03 - 6.25)) * 5.2;
  const k = (2.80 - width) / (2.80 - 1.97);                        // 0 ~ 1：方块缩小的进度
  const stage = Math.floor(b) + 1;
  return {
    stage, zone: zoneOf(stage),
    distance, width, timer, hazard,
    gapMean, gapMin: gapMean * 0.85, gapMax: gapMean * 1.15,
    sizeMax: 2.6 - 0.85 * k, sizeMin: 1.5 - 0.45 * k,
  };
}
