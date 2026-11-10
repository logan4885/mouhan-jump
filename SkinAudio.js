// 专属音乐与音效：全部用 WebAudio 现场合成的【原创】小曲，没有任何音频文件，也没有版权问题。
//
// 每首曲子是一个 2 小节（32 个 16 分音符）的循环，分 4 层，连击越高层数越多、越热闹：
//   L0 鼓点底 + 贝斯   → 一直有
//   L1 踩镲 / 军鼓 / 和弦垫音 → 连击 1+
//   L2 主旋律          → 连击 3+（传说款 2+）
//   L3 高八度琶音 + 撞镲 → 连击 5+
//
// 旋律写法：用空格分隔的“音级”，1 = 主音，后缀 + / - 表示升 / 降一个八度，. 表示休止。
// 例：'1 . 3 5+ . 2-'

const STEPS = 32;

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phryg: [0, 1, 4, 5, 7, 8, 10],       // 弗里几亚属音阶（热血 / 火焰）
  pent: [0, 2, 4, 7, 9],               // 大调五声
  pentm: [0, 3, 5, 7, 10],             // 小调五声
};

// 每首曲：bpm / swing(摇摆) / root(主音 MIDI) / scale / 各声部
export const THEMES = {
  gold: { // 爵士摇摆
    bpm: 108, swing: 0.22, root: 60, scale: 'major', bassShift: -2,
    kick: 'x.....x...x.....', snare: '....x.......x...', hat: 'x..xx..xx..xx..x',
    bass: '1 . . . 5 . . . 4 . . . 5 . 3 .  6 . . . 2 . . . 5 . . . 1 . 5 .',
    lead: '5 . 6 5 3 . 1 . 2 . 3 5 . . . .  6 . 5 3 5 . . . 1+ . 7 6 5 . . .',
    arp: '1+ . 5 . 3+ . 5 . 6 . 2+ . 5 . 3 .  2+ . 6 . 1+ . 5 . 7 . 5 . 3 . 1 .',
    chords: [[1, 3, 5], [4, 6, 8]], leadWave: 'triangle', bassWave: 'sine', padWave: 'triangle', leadVol: 0.1, decay: 0.28,
  },
  chrome: { // 清爽浩室
    bpm: 122, swing: 0, root: 57, scale: 'pentm', bassShift: -2,
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.',
    bass: '1 . 1 . . 1 . 1 . . 1 . . 3 . .  1 . 1 . . 1 . 1 . . 5- . . 3 . .',
    lead: '1 . . 3 . 2 . . 5 . . 3 . . 2 .  3 . . 5 . 4 . . 3 . 2 . 1 . . .',
    arp: '5 . 3 . 1+ . 3 . 5 . 3 . 2 . 5- .  1 . 3 . 5 . 3 . 1+ . 5 . 3 . 2 .',
    chords: [[1, 3, 5], [4, 6, 8]], leadWave: 'square', bassWave: 'sawtooth', padWave: 'triangle', leadVol: 0.05, decay: 0.16,
  },
  holo: { // 闪耀未来流行
    bpm: 128, swing: 0, root: 60, scale: 'major', bassShift: -2,
    kick: 'x...x...x...x...', snare: '....x.......x..x', hat: 'x.x.x.x.x.x.x.xx',
    bass: '1 . 1 . 1 . 1 . 6- . 6- . 6- . 6- .  4- . 4- . 4- . 4- . 5- . 5- . 5- . 5- .',
    lead: '5 7 1+ 7 5 7 1+ 3+ 2+ . 1+ . 7 . 5 .  6 1+ 3+ 1+ 6 1+ 3+ 5+ 4+ . 3+ . 2+ . 1+ .',
    arp: '1+ 3+ 5+ 3+ 1+ 3+ 5+ 7+ 1++ 7+ 5+ 3+ 1+ 3+ 5+ 3+  1+ 4+ 6+ 4+ 1+ 4+ 6+ 4+ 2+ 5+ 7+ 5+ 2+ 5+ 7+ 5+',
    chords: [[1, 3, 5], [4, 6, 8]], leadWave: 'sawtooth', bassWave: 'sawtooth', padWave: 'sawtooth', leadVol: 0.045, decay: 0.2,
  },
  neon: { // 复古合成波
    bpm: 110, swing: 0, root: 57, scale: 'minor', bassShift: -2,
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
    bass: '1 . 1 . 1 . 1 . 1 . 1 . 1 . 1 .  6- . 6- . 6- . 6- . 7- . 7- . 7- . 7- .',
    lead: '5 . . 3 . 5 . 6 . 5 . 3 . 2 . .  1 . 3 . 5 . . 7 . 6 . 5 . . . .',
    arp: '1+ . 3+ . 5+ . 3+ . 1+ . 3+ . 5+ . 3+ .  7 . 2+ . 4+ . 2+ . 7 . 2+ . 4+ . 2+ .',
    chords: [[1, 3, 5], [6, 8, 10]], leadWave: 'sawtooth', bassWave: 'sawtooth', padWave: 'sawtooth', leadVol: 0.05, decay: 0.22,
  },
  galaxy: { // 太空氛围
    bpm: 88, swing: 0, root: 55, scale: 'dorian', bassShift: -2,
    kick: 'x...............', snare: '................', hat: '..x...x...x...x.',
    bass: '1 . . . . . . . . . . . . . . .  4- . . . . . . . . . . . . . . .',
    lead: '1+ . . . 5 . . . 3+ . . . 2+ . 1+ .  5+ . . . 3+ . . . 2+ . . . 1+ . . .',
    arp: '1+ 3+ 5+ 3+ 7+ 5+ 3+ 5+ 2+ 4+ 6+ 4+ 1++ 6+ 4+ 6+  1+ 3+ 5+ 3+ 7+ 5+ 3+ 5+ 2+ 4+ 6+ 4+ 5+ 3+ 2+ 1+',
    chords: [[1, 5, 10], [4, 8, 12]], leadWave: 'sine', bassWave: 'sine', padWave: 'sine', leadVol: 0.085, decay: 0.9, padVol: 0.05,
  },
  blaze: { // 热血芯片摇滚
    bpm: 142, swing: 0, root: 52, scale: 'phryg', bassShift: -2,
    kick: 'x..xx..xx..xx.x.', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx',
    bass: '1 1 . 1 1 . 1 1 . 1 1 . 2 . 1 .  1 1 . 1 1 . 1 1 . 6- 6- . 5- . 1 .',
    lead: '1+ . 2+ 1+ . 7 . 5 . 6 . 5 . 4 . .  1+ . 2+ 1+ . 3+ . 2+ . 1+ . 7 . 5 . .',
    arp: '1+ 5+ 1++ 5+ 1+ 5+ 1++ 5+ 7 4+ 7+ 4+ 7 4+ 7+ 4+  1+ 5+ 1++ 5+ 1+ 5+ 1++ 5+ 6 3+ 6+ 3+ 5 2+ 5+ 2+',
    chords: [[1, 5, 8], [6, 8, 10]], leadWave: 'sawtooth', bassWave: 'square', padWave: 'square', leadVol: 0.05, decay: 0.15,
  },
  frost: { // 水晶八音盒
    bpm: 94, swing: 0, root: 72, scale: 'pent', bassShift: -3,
    kick: 'x.......x.......', snare: '................', hat: '....x.......x...',
    bass: '1 . . . . . . . 3 . . . . . . .  1 . . . . . . . 5- . . . . . . .',
    lead: '1 3 5 3 6 5 3 5 2 4 5 4 3 . . .  1 3 5 3 6 5 3 5 4 3 2 3 1 . . .',
    arp: '5 . 6 . 7 . 6 . 5 . 3 . 2 . 3 .  6 . 7 . 8 . 7 . 6 . 5 . 3 . 5 .',
    chords: [[1, 3, 5], [2, 4, 6]], leadWave: 'sine', bassWave: 'sine', padWave: 'sine', leadVol: 0.1, decay: 0.7, padVol: 0.04,
  },
  crystal: { // 气泡 Lo-fi
    bpm: 102, swing: 0.16, root: 64, scale: 'major', bassShift: -2,
    kick: 'x.....x...x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
    bass: '1 . . 1 . . 5- . 4- . . 4- . . 5- .  6- . . 6- . . 3- . 4- . . 5- . . 1 .',
    lead: '3 . 5 . 1+ . 5 . 4 . 6 . 2+ . 6 .  5 . 3 . 5 . 1+ . 7 . 5 . 3 . . .',
    arp: '1+ . 3+ . 5+ . 3+ . 6 . 1+ . 3+ . 1+ .  7 . 2+ . 4+ . 2+ . 5 . 7 . 2+ . 7 .',
    chords: [[1, 3, 5, 7], [4, 6, 8, 10]], leadWave: 'sine', bassWave: 'triangle', padWave: 'triangle', leadVol: 0.1, decay: 0.32,
  },
  pixel: { // 8-bit 芯片音乐
    bpm: 150, swing: 0, root: 60, scale: 'major', bassShift: -2,
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
    bass: '1 . 1 . 5- . 5- . 6- . 6- . 4- . 4- .  1 . 1 . 5- . 5- . 4- . 4- . 5- . 5- .',
    lead: '1 3 5 3 1+ . 5 . 6 . 4 . 5 . . .  1 3 5 3 1+ . 3+ . 2+ 1+ 7 5 . . . .',
    arp: '1+ 3+ 5+ 3+ 1+ 3+ 5+ 3+ 6 1+ 3+ 1+ 6 1+ 3+ 1+  5 7 2+ 7 5 7 2+ 7 1 3 5 3 1 3 5 3',
    chords: [[1, 3, 5], [4, 6, 8]], leadWave: 'square', bassWave: 'triangle', padWave: 'square', leadVol: 0.045, decay: 0.12, noiseDrums: true,
  },
  egypt: { // 埃及风：弗里几亚属音阶（带增二度）+ 手鼓节奏 + 双簧管式旋律
    bpm: 104, swing: 0, root: 57, scale: 'phryg', bassShift: -2,
    kick: 'x..x..x.x..x....', snare: '....x.......x.x.', hat: 'x.x.x.x.x.x.x.xx',
    bass: '1 . . . 1 . 2 . 1 . . . 5- . 4- .  1 . . . 1 . 2 . 1 . . . 5- . 4- .',
    lead: '5 . 4 3 . 2 3 . 2 1 . 7- 1 . . .  5 . 6 5 4 . 3 . 4 3 2 . 1 . . .',
    arp: '1+ . 3+ . 5+ . 3+ . 2+ . 3+ . 1+ . 7 .  1+ . 4+ . 6+ . 4+ . 3+ . 2+ . 1+ . 5 .',
    chords: [[1, 5, 8], [2, 5, 7]], leadWave: 'sawtooth', bassWave: 'triangle', padWave: 'triangle', leadVol: 0.045, decay: 0.22, padVol: 0.03,
  },
  thunder: { // 重低音电子
    bpm: 132, swing: 0, root: 55, scale: 'minor', bassShift: -3,
    kick: 'x.....x..x..x...', snare: '........x.......', hat: 'xxxxxxxxxxxxxxxx',
    bass: '1 . . . . . 1 . . 1 . . 3 . . .  1 . . . . . 1 . . 7- . . 5- . . .',
    lead: '5 . . . 3 . . 5 . . 6 . 5 . . .  5 . . . 7 . . 5 . . 3 . 2 . . .',
    arp: '1+ . . 3+ . . 5+ . 3+ . . 1+ . . 7 .  1+ . . 3+ . . 5+ . 7+ . . 5+ . . 3+ .',
    chords: [[1, 3, 5], [7, 9, 11]], leadWave: 'sawtooth', bassWave: 'sine', padWave: 'sawtooth', leadVol: 0.05, decay: 0.12, padVol: 0.025,
  },
};

/* ------------------------- 工具 ------------------------- */
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function parseSeq(str, len = STEPS) {
  const toks = str.trim().split(/\s+/);
  const out = [];
  for (let i = 0; i < len; i++) {
    const tk = toks[i % toks.length];
    if (!tk || tk === '.') { out.push(null); continue; }
    const m = tk.match(/^(\d+)(\+*|-*)$/);
    if (!m) { out.push(null); continue; }
    out.push({ d: Number(m[1]), o: m[2].includes('+') ? m[2].length : -m[2].length });
  }
  return out;
}
function parsePerc(str) { return str.split('').map((c) => (c === 'x' ? 1 : c === 'X' ? 2 : 0)); }

function degreeMidi(theme, note, octShift = 0) {
  const sc = SCALES[theme.scale];
  const idx = note.d - 1;
  const oct = Math.floor(idx / sc.length) + note.o + octShift;
  return theme.root + 12 * oct + sc[((idx % sc.length) + sc.length) % sc.length];
}

/* ------------------------- 合成小零件 ------------------------- */
let noiseBuf = null;
function getNoise(ctx) {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noiseBuf = b;
  return b;
}

function tone(ctx, out, { type = 'sine', f0, f1 = null, t, dur = 0.2, vol = 0.1, attack = 0.005, detune = 0 }) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (detune) o.detune.value = detune;
  if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t); o.stop(t + dur + 0.03);
}

function noise(ctx, out, { t, dur = 0.1, vol = 0.1, type = 'highpass', f0 = 6000, f1 = null, q = 0.7 }) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = getNoise(ctx); s.loop = true;
  f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t);
  if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(out);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
}

/* ------------------------- 专属完美音效 ------------------------- */
// rate：连击越高音越高（最多升约 7 个半音），越打越爽
export const SFX = {
  // 冰镇易拉罐开罐：Pssssht（气体喷出）+ Pop!（拉环脆响）
  popcan(ctx, out, t, rate) {
    noise(ctx, out, { t, dur: 0.34, vol: 0.2, f0: 6500 });
    noise(ctx, out, { t: t + 0.04, dur: 0.22, vol: 0.12, f0: 3800 });
    tone(ctx, out, { type: 'sine', f0: 1250 * rate, f1: 260, t: t + 0.3, dur: 0.1, vol: 0.5 });
    noise(ctx, out, { t: t + 0.3, dur: 0.05, vol: 0.28, f0: 2400 });
  },
  // 普通罐：沉闷的木头 tock
  tock(ctx, out, t) {
    tone(ctx, out, { type: 'triangle', f0: 230, f1: 120, t, dur: 0.07, vol: 0.45 });
    noise(ctx, out, { t, dur: 0.02, vol: 0.12, f0: 900 });
  },
  coin(c, o, t, r) {
    tone(c, o, { type: 'square', f0: 988 * r, t, dur: 0.09, vol: 0.07 });
    tone(c, o, { type: 'square', f0: 1319 * r, t: t + 0.08, dur: 0.4, vol: 0.07 });
    for (let i = 0; i < 4; i++) tone(c, o, { type: 'sine', f0: (2200 + Math.random() * 1800) * r, t: t + 0.12 + i * 0.05, dur: 0.12, vol: 0.04 });
  },
  chime(c, o, t, r) {
    [523, 784, 1047].forEach((f, i) => {
      for (let k = 0; k < 3; k++) tone(c, o, { type: 'sine', f0: f * r * (k ? 1.003 : 1), t: t + i * 0.07 + k * 0.17, dur: 0.9, vol: 0.09 / (1 + k * 0.9) });
    });
  },
  rainbow(c, o, t, r) {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(c, o, { type: 'triangle', f0: f * r, t: t + i * 0.05, dur: 0.22, vol: 0.09 }));
    noise(c, o, { t: t + 0.25, dur: 0.3, vol: 0.05, f0: 7000 });
  },
  whoosh(c, o, t, r) {
    noise(c, o, { t, dur: 0.55, vol: 0.2, type: 'bandpass', f0: 300, f1: 3000, q: 1.2 });
    tone(c, o, { type: 'sine', f0: 110 * r, f1: 45, t, dur: 0.45, vol: 0.25 });
    tone(c, o, { type: 'sawtooth', f0: 440 * r, f1: 880 * r, t: t + 0.05, dur: 0.25, vol: 0.05 });
  },
  crack(c, o, t, r) {
    noise(c, o, { t, dur: 0.5, vol: 0.3, type: 'lowpass', f0: 5000, f1: 200 });
    tone(c, o, { type: 'sine', f0: 100, f1: 38, t, dur: 0.45, vol: 0.3 });
    tone(c, o, { type: 'sawtooth', f0: 1400 * r, f1: 120, t, dur: 0.18, vol: 0.07 });
  },
  zap(c, o, t, r) {
    tone(c, o, { type: 'sawtooth', f0: 220 * r, f1: 1760 * r, t, dur: 0.22, vol: 0.07 });
    tone(c, o, { type: 'square', f0: 1760 * r, f1: 440 * r, t: t + 0.2, dur: 0.18, vol: 0.05 });
    noise(c, o, { t, dur: 0.2, vol: 0.06, f0: 5000 });
  },
  powerup(c, o, t, r) {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(c, o, { type: 'square', f0: f * r, t: t + i * 0.045, dur: 0.07, vol: 0.06 }));
  },
  ping(c, o, t, r) {
    tone(c, o, { type: 'sine', f0: 1568 * r, t, dur: 0.6, vol: 0.1 });
    tone(c, o, { type: 'sine', f0: 1568 * r * 2.76, t, dur: 0.35, vol: 0.05 });
    tone(c, o, { type: 'sine', f0: 2093 * r, t: t + 0.09, dur: 0.6, vol: 0.08 });
  },
  icechime(c, o, t, r) {
    [2093, 2637, 3136, 4186].forEach((f, i) => tone(c, o, { type: 'sine', f0: f * r, t: t + i * 0.06, dur: 0.5, vol: 0.06 }));
  },
  bubble(c, o, t, r) {
    for (let i = 0; i < 5; i++) {
      const f = (320 + Math.random() * 300) * r;
      tone(c, o, { type: 'sine', f0: f, f1: f * 2.6, t: t + i * 0.055, dur: 0.09, vol: 0.12 });
    }
  },
};

/* ------------------------- 循环音乐 ------------------------- */
export class Music {
  /** @param {import('./Sound.js?v=20261110s').Sound} sound 借用它的 AudioContext 和静音状态 */
  constructor(sound) {
    this.sound = sound;
    this.theme = null; this.id = null;
    this.timer = 0; this.step = 0; this.nextT = 0;
    this.level = 0; this.boost = 0;
    this.out = null; this.layers = null;
    this.playing = false;
    this.vol = 0.9;
  }

  _build(ctx) {
    if (this.out && this.out.ctx === ctx) return;
    const master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    master.ctx = ctx;
    this.out = master;
    this.layers = {};
    ['rhythm', 'groove', 'lead', 'top'].forEach((k) => {
      const g = ctx.createGain(); g.gain.value = 0; g.connect(master); this.layers[k] = g;
    });
  }

  /** 开始放某一首；boost>0 让层数更早进入（传说款） */
  play(id, { boost = 0, level = 0, fade = 0.4 } = {}) {
    const theme = THEMES[id];
    if (!theme) return;
    const ctx = this.sound._ensure();
    if (!ctx) return;
    this._build(ctx);
    this.stop(0, true);
    this.theme = theme; this.id = id; this.boost = boost;
    this.seq = {
      bass: parseSeq(theme.bass), lead: parseSeq(theme.lead), arp: parseSeq(theme.arp),
      kick: parsePerc(theme.kick), snare: parsePerc(theme.snare), hat: parsePerc(theme.hat),
    };
    this.step = 0; this.nextT = ctx.currentTime + 0.08;
    this.playing = true;
    const t = ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(this.vol * 0.55, t + fade);
    this.setLevel(level, true);
    this.timer = setInterval(() => this._tick(), 30);
  }

  /** 根据连击数改变层数 */
  setCombo(combo) {
    const b = this.boost;
    const lvl = combo >= 5 - b ? 3 : combo >= 3 - b ? 2 : combo >= 1 ? 1 : 0;
    this.setLevel(lvl);
  }

  setLevel(lvl, instant = false) {
    this.level = lvl;
    if (!this.layers || !this.sound.ctx) return;
    const t = this.sound.ctx.currentTime;
    const target = { rhythm: 1, groove: lvl >= 1 ? 1 : 0, lead: lvl >= 2 ? 1 : 0, top: lvl >= 3 ? 1 : 0 };
    Object.keys(target).forEach((k) => {
      const g = this.layers[k].gain;
      g.cancelScheduledValues(t);
      if (instant) g.setValueAtTime(target[k], t); else g.setTargetAtTime(target[k], t, 0.12);
    });
  }

  stop(fade = 0.5, silent = false) {
    clearInterval(this.timer); this.timer = 0;
    this.playing = false;
    if (this.out && this.sound.ctx && !silent) {
      const t = this.sound.ctx.currentTime;
      this.out.gain.cancelScheduledValues(t);
      this.out.gain.setValueAtTime(this.out.gain.value, t);
      this.out.gain.linearRampToValueAtTime(0, t + Math.max(0.05, fade));
    }
  }

  /** 页面切走时暂停整个音频，回来再继续 */
  pause() { if (this.sound.ctx && this.playing) this.sound.ctx.suspend(); }
  resume() { if (this.sound.ctx && this.playing && !this.sound.muted) this.sound.ctx.resume(); }

  _tick() {
    const ctx = this.sound.ctx;
    if (!ctx || !this.playing) return;
    const th = this.theme;
    const stepDur = 60 / th.bpm / 4;
    // 页面被挂起太久，重新对时，避免一口气补一大串音符
    if (this.nextT < ctx.currentTime - 0.5) this.nextT = ctx.currentTime + 0.05;
    while (this.nextT < ctx.currentTime + 0.14) {
      const s = this.step % STEPS;
      const swing = (s % 2 === 1) ? th.swing * stepDur : 0;
      this._playStep(s, this.nextT + swing, stepDur);
      this.nextT += stepDur;
      this.step++;
    }
  }

  _playStep(s, t, stepDur) {
    const ctx = this.sound.ctx, th = this.theme, L = this.layers, q = this.seq;
    const bar = Math.floor(s / 16), p = s % 16;

    // ---- L0：底鼓 + 贝斯 ----
    if (q.kick[p]) {
      tone(ctx, L.rhythm, { type: 'sine', f0: 150, f1: 42, t, dur: 0.2, vol: th.id === 'galaxy' ? 0.22 : 0.4 });
    }
    const bn = q.bass[s];
    if (bn) {
      const f = mtof(degreeMidi(th, bn, th.bassShift));
      const long = th.bassWave === 'sine';
      tone(ctx, L.rhythm, { type: th.bassWave, f0: f, t, dur: long ? stepDur * 6 : stepDur * 1.7, vol: long ? 0.22 : 0.14, attack: 0.01 });
    }

    // ---- L1：军鼓 / 踩镲 / 和弦垫音 ----
    if (q.snare[p]) {
      noise(ctx, L.groove, { t, dur: th.noiseDrums ? 0.09 : 0.14, vol: 0.16, type: 'bandpass', f0: 1900, q: 0.8 });
      tone(ctx, L.groove, { type: th.noiseDrums ? 'square' : 'triangle', f0: 200, f1: 120, t, dur: 0.09, vol: 0.12 });
    }
    if (q.hat[p]) noise(ctx, L.groove, { t, dur: 0.045, vol: p % 4 === 2 ? 0.08 : 0.055, f0: 7500 });
    if (p === 0) {
      const chord = th.chords[bar % th.chords.length];
      const pv = th.padVol || 0.035;
      chord.forEach((d) => {
        tone(ctx, L.groove, { type: th.padWave, f0: mtof(degreeMidi(th, { d, o: 0 }, -1)), t, dur: stepDur * 15.5, vol: pv, attack: 0.08 });
      });
    }

    // ---- L2：主旋律 ----
    const ln = q.lead[s];
    if (ln) {
      const f = mtof(degreeMidi(th, ln, 0));
      tone(ctx, L.lead, { type: th.leadWave, f0: f, t, dur: Math.max(stepDur * 1.8, th.decay), vol: th.leadVol, attack: 0.006 });
      if (th.leadWave === 'sawtooth') tone(ctx, L.lead, { type: 'sawtooth', f0: f, t, dur: Math.max(stepDur * 1.8, th.decay), vol: th.leadVol * 0.6, detune: 9 });
    }

    // ---- L3：高八度琶音 + 撞镲 ----
    const an = q.arp[s];
    if (an) {
      tone(ctx, L.top, { type: th.leadWave === 'sawtooth' ? 'square' : th.leadWave, f0: mtof(degreeMidi(th, an, 1)), t, dur: stepDur * 1.2, vol: th.leadVol * 0.55 });
    }
    if (s === 0) noise(ctx, L.top, { t, dur: 0.7, vol: 0.09, f0: 5500 });
  }
}

/** 试听专属音效（不依赖 Game） */
export function playSfx(sound, id, combo = 1, volume = 1, delay = 0) {
  const fn = SFX[id];
  const ctx = sound._ensure();
  if (!fn || !ctx) return;
  const rate = Math.pow(2, Math.min(Math.max(combo - 1, 0), 7) / 12);
  const g = ctx.createGain();
  g.gain.value = volume;
  g.connect(ctx.destination);
  fn(ctx, g, ctx.currentTime + 0.01 + delay, rate);
}

// 让主题带上自己的 id，方便内部判断
Object.keys(THEMES).forEach((k) => { THEMES[k].id = k; });
