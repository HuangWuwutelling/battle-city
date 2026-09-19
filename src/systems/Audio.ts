/**
 * 经典 FC 坦克大战音效系统
 * 使用 WebAudio 合成方波/锯齿/噪声 + 包络，无外部音频文件
 *
 * 浏览器策略：AudioContext 必须在用户首次交互后才能 resume/resume
 * 因此 init() 必须在用户手势回调内首次调用（MenuScene.handleInput 已处理）
 */

type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle';

interface AudioInternals {
  ctx: AudioContext | null;
  master: GainNode | null;
  enabled: boolean;
}

const state: AudioInternals = {
  ctx: null,
  master: null,
  enabled: true,
};

/**
 * 惰性初始化 AudioContext。MenuScene.handleInput 在首次按键/确认时调用本函数。
 * 幂等：重复调用不会重建 context。
 */
export function init(): void {
  if (state.ctx) {
    // 某些浏览器会把 suspended 状态传给已创建的 context（页面失焦后再回来）
    if (state.ctx.state === 'suspended') {
      void state.ctx.resume();
    }
    return;
  }
  try {
    const AudioCtxCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxCtor) return;
    const ctx = new AudioCtxCtor();
    const master = ctx.createGain();
    master.gain.value = 0.3;
    master.connect(ctx.destination);
    state.ctx = ctx;
    state.master = master;
  } catch {
    // 静默失败：没有音频能力时不抛错
    state.ctx = null;
    state.master = null;
  }
}

export function setEnabled(enabled: boolean): void {
  state.enabled = enabled;
}

export function isEnabled(): boolean {
  return state.enabled;
}

export function toggle(): boolean {
  state.enabled = !state.enabled;
  return state.enabled;
}

/**
 * 播放一个振荡器音调：快速起音 + 指数衰减
 */
function tone(
  freq: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  startOffset = 0,
): void {
  if (!state.ctx || !state.master || !state.enabled) return;
  const ctx = state.ctx;
  const now = ctx.currentTime + startOffset;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;

  // 包络：5ms 起音 → 指数衰减
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(state.master);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

/**
 * 播放频率滑动：从 fromFreq 在 duration 内滑到 toFreq
 * 用于鹰被击毁的悲伤下行、关卡通关的上行琶音等
 */
function sweep(
  fromFreq: number,
  toFreq: number,
  duration: number,
  type: OscillatorType,
  volume: number,
): void {
  if (!state.ctx || !state.master || !state.enabled) return;
  const ctx = state.ctx;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(fromFreq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, toFreq), now + duration);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(state.master);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

/**
 * 播放一段白噪声（带低通滤波 + 包络），用于爆炸/碎砖
 */
function noise(duration: number, volume: number, lowpassFreq: number): void {
  if (!state.ctx || !state.master || !state.enabled) return;
  const ctx = state.ctx;
  const now = ctx.currentTime;
  const sampleRate = ctx.sampleRate;
  const bufferSize = Math.max(1, Math.floor(sampleRate * duration));

  const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpassFreq;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(state.master);
  source.start(now);
  source.stop(now + duration + 0.02);
}

// ============================================================
// 公开音效接口
// ============================================================

/** 玩家坦克开火：清脆方波短音 */
function playShoot(): void {
  tone(880, 0.08, 'square', 0.25);
}

/** 友军 AI 开火：略高音 */
function playAllyShoot(): void {
  tone(1040, 0.08, 'square', 0.22);
}

/** 敌人坦克开火：低频沉闷 */
function playEnemyShoot(): void {
  tone(440, 0.08, 'square', 0.25);
}

/** 砖块被打碎：噪声短脉冲 */
function playBrickBreak(): void {
  noise(0.08, 0.35, 1800);
}

/** 子弹击中钢墙：短促 beep（不破） */
function playSteelHit(): void {
  tone(660, 0.05, 'square', 0.2);
}

/** 坦克爆炸：噪声 + 低频正弦余音（混合爆炸 + 沉闷感） */
function playTankExplode(): void {
  noise(0.35, 0.45, 600);
  // 低频正弦增加"重量感"
  tone(80, 0.25, 'sine', 0.3);
}

/** 鹰被摧毁：下行锯齿波，沉重感 */
function playEagleDestroyed(): void {
  sweep(440, 80, 0.9, 'sawtooth', 0.35);
  noise(0.4, 0.25, 800);
}

/** 关卡开始：经典 FC 上行 4 音（A4 E5 A5 C#6 — 经典坦克大战开场） */
function playLevelStart(): void {
  // 依次播放 4 个音，每个 120ms，相邻 100ms 错开
  const notes = [
    { freq: 440, delay: 0 },     // A4
    { freq: 659.25, delay: 0.1 }, // E5
    { freq: 880, delay: 0.2 },    // A5
    { freq: 1108.73, delay: 0.3 },// C#6
  ];
  for (const n of notes) {
    tone(n.freq, 0.12, 'square', 0.3, n.delay);
  }
}

/** 关卡完成：上行 3 音琶音（C5 E5 G5） */
function playLevelComplete(): void {
  const notes = [
    { freq: 523.25, delay: 0 },    // C5
    { freq: 659.25, delay: 0.12 }, // E5
    { freq: 783.99, delay: 0.24 }, // G5
  ];
  for (const n of notes) {
    tone(n.freq, 0.18, 'square', 0.3, n.delay);
  }
  // 结尾加一个高八度的"叮"
  tone(1567.98, 0.25, 'square', 0.25, 0.36);
}

/** 游戏结束：下行 3 音（A4 F4 D4） */
function playGameOver(): void {
  const notes = [
    { freq: 440, delay: 0 },      // A4
    { freq: 349.23, delay: 0.18 }, // F4
    { freq: 293.66, delay: 0.36 }, // D4
  ];
  for (const n of notes) {
    tone(n.freq, 0.22, 'square', 0.3, n.delay);
  }
  // 尾声：低频延长音增加沉重感
  tone(146.83, 0.6, 'sine', 0.25, 0.54);
}

/** 菜单选项切换：轻微滴答 */
function playMenuMove(): void {
  tone(1200, 0.04, 'square', 0.15);
}

/** 菜单确认：双音叮 */
function playMenuSelect(): void {
  tone(880, 0.06, 'square', 0.25);
  tone(1320, 0.08, 'square', 0.25, 0.06);
}

export const Audio = {
  init,
  setEnabled,
  isEnabled,
  toggle,

  playShoot,
  playAllyShoot,
  playEnemyShoot,
  playBrickBreak,
  playSteelHit,
  playTankExplode,
  playEagleDestroyed,
  playLevelStart,
  playLevelComplete,
  playGameOver,
  playMenuMove,
  playMenuSelect,
};
