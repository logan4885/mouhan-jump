// 全局可调参数：手感、尺寸、相机都集中在这里，方便调试
export const CONFIG = {
  // 方块
  BLOCK_HEIGHT: 1.0,
  BLOCK_MIN_SIZE: 1.5,        // 正方体边长 / 圆柱直径 最小值
  BLOCK_MAX_SIZE: 2.6,
  BLOCK_MIN_GAP: 2.6,         // 相邻方块中心距离
  BLOCK_MAX_GAP: 5.6,
  BLOCK_KEEP: 7,              // 场景中最多保留多少个方块（旧的会被回收）
  SIZE_SHRINK_PER_SCORE: 0.008, // 分数越高方块越小（难度递增）

  // 蓄力与跳跃
  CHARGE_MAX_TIME: 1.6,       // 秒，超过不再增加
  JUMP_MIN_DIST: 0.35,        // 轻点一下的最小距离
  JUMP_SPEED: 5.4,            // 每秒蓄力增加的距离（线性部分）
  JUMP_ACCEL: 0.9,            // 二次项，蓄力越久增长略快
  JUMP_MAX_DIST: 9.5,
  JUMP_BASE_TIME: 0.42,       // 空中时间（秒）= BASE + dist * PER_UNIT
  JUMP_TIME_PER_UNIT: 0.018,
  JUMP_BASE_HEIGHT: 1.6,
  JUMP_HEIGHT_PER_UNIT: 0.16,

  // 压缩动画
  PLAYER_SQUASH: 0.45,        // 蓄力满时角色 y 缩放降低比例
  BLOCK_SQUASH: 0.32,         // 蓄力满时方块 y 缩放降低比例

  // 落点判定
  FOOT_RADIUS: 0.28,          // 角色脚底半径：中心出界但在此范围内 -> 边缘摔落
  PERFECT_RADIUS: 0.28,       // 离中心小于此距离 -> 完美

  // 计分
  SCORE_NORMAL: 1,
  SCORE_PERFECT: 2,           // 完美 = 普通的 2 倍；连续完美继续叠加（2,4,6…）
  PERFECT_COMBO_MAX: 16,

  // 相机（正交 45° 等轴测）
  CAM_OFFSET: [-11, 15, 13],  // 相机相对注视点的偏移
  VIEW_WIDTH_PORTRAIT: 11.5,  // 竖屏时可见世界宽度
  VIEW_HEIGHT_LANDSCAPE: 15,  // 横屏时可见世界高度
  CAM_LERP: 4.0,
};
