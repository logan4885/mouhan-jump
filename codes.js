// 兑换码（只存哈希，看源码也看不出原始兑换码）
// 原始兑换码清单在《兑换码.txt》里，不要上传到网上。
// 想新增兑换码：用 tools/code-generator.html 生成一行，粘贴到下面的 REDEEM_CODES 里。
//   值一般写 'random'（随机解锁一款还没拥有的罐子）；也可以写某款皮肤的 id 指定解锁，'*' 表示一次解锁全部。
//   同一台设备上，一个兑换码只能用一次。

const SALT = 'jump3d-can:';

export const REDEEM_CODES = {
  'f6ac43b49f0c6d22': 'random',
  '25fcf710ec039f3a': 'random',
  'f8d48ec479605412': 'random',
  '4eb6069532faf91d': 'random',
  '09f120c6b70b91b0': 'random',
  '0b1740e0b8f57166': 'random',
  '429e99d0e59bb8fa': 'random',
  '976f5939e412d65d': 'random',
  'd92dd78e6dba1820': 'random',
  '85890c0c9c45903e': 'random',
  '6117c0992859ca2d': 'random',
  '13eeacb74d074a37': 'random',
  'c7bfe40c63a18316': 'random',
  'dabe0479806ff609': 'random',
  'c76251caff62709c': 'random',
  'f9d66483cbf30cdb': 'random',
  '92c2c163f1e1febb': 'random',
  'a9a142d07bffefca': 'random',
  '92b38c4f1a4c1ea7': 'random',
  '27df22a717d02cd7': 'random',
  '3152c0de48e9e3c4': 'random',
  'bbb1b2db9e6f16bb': 'random',
  '0707059fea4c5def': 'random',
  'bd64e1b96b35a439': 'random',
  '8002c2a8dae48cee': 'random',
  '2eeed84e8cfec7c8': 'random',
  '0ebf7c853bba1d4d': 'random',
  '85ec8e2acd337548': 'random',
  'd0001694db1f4f5e': 'random',
  '230470ec4fe02926': 'random',
  '21b4bf01c117cc79': 'random',
  '788b67afafddb6cf': 'random',
  'e46a364c552609ca': 'random',
  '9b433c0e98fa4704': 'random',
  'b50fb2e31a42a18b': 'random',
  'e13ae78d59e9e405': 'random',
  '8fb15900836cbb9a': 'random',
  '418ce068ce4dbb0a': 'random',
  'e17b8389d05eb71d': 'random',
  '19525a6df82c89ed': 'random',
  '08b7a698826f3366': 'random',
  '3a4d5f7a04de1e00': 'random',
  '168162dcf65c1f8e': 'random',
  '7316a89c2219e35e': 'random',
  '7e6946ece43f700a': 'random',
  '84f65ee00533dca2': 'random',
  '44560a5933be9611': 'random',
  '98d014957e144dcd': 'random',
  '1ca78838506ccf62': 'random',
  'd376b39ae5d312b0': 'random',
};

/** 统一格式：转大写，去掉空格、横线等符号 */
export function normalizeCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function fnv1a(str, basis) {
  let h = basis >>> 0;
  const bytes = new TextEncoder().encode(str);
  for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

export function hashCode(code) {
  const n = SALT + normalizeCode(code);
  const rev = n.split('').reverse().join('');
  return fnv1a(n, 0x811c9dc5).toString(16).padStart(8, '0') + fnv1a(rev, 0x2a5f1c3d).toString(16).padStart(8, '0');
}

/** 查兑换码，返回 'random'、皮肤 id、'*'（全部）或 null */
export function lookupCode(code) {
  if (!normalizeCode(code)) return null;
  return REDEEM_CODES[hashCode(code)] || null;
}
