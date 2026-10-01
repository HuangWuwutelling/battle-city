import { Direction } from '../types';

interface PlayerKeys {
  up: string[];
  down: string[];
  left: string[];
  right: string[];
  shoot: string[];
  confirm: string[];
}

const P1_KEYS: PlayerKeys = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  shoot: ['Space'],
  confirm: ['Enter'],
};

const P2_KEYS: PlayerKeys = {
  up: ['Numpad8', 'KeyI'],
  down: ['Numpad5', 'KeyK'],
  left: ['Numpad4', 'KeyJ'],
  right: ['Numpad6', 'KeyL'],
  shoot: ['Numpad0', 'ShiftRight'],
  confirm: ['NumpadEnter', 'Slash'],
};

// 标准手柄 (XInput) 按钮索引:
//   0 = A (Cross)        - shoot
//   1 = B (Circle)        - reserved
//   2 = X (Square)        - reserved
//   3 = Y (Triangle)      - reserved
//   9 = Start             - pause / confirm
//   12 = DPadUp
//   13 = DPadDown
//   14 = DPadLeft
//   15 = DPadRight
const STICK_THRESHOLD = 0.5;

export class Input {
  private keys: Set<string> = new Set();
  private justPressed: Set<string> = new Set();
  private gamepads: (Gamepad | null)[] = [null, null, null, null];
  // 上一帧每个手柄槽位的按钮按下状态，用于在 refreshGamepads() 里计算「本帧
  // 刚刚按下」的边沿。Slot 为 null 表示该槽位之前没接设备（或刚断开）。首帧
  // 只播种 prev，不触发事件 —— 避免 reconnect 时所有当前按下按钮被误判成
  // 「刚刚按下」。
  private prevButtonStates: (boolean[] | null)[] = [null, null, null, null];
  // 本帧手柄产生的离散事件（菜单导航 / 暂停等需要边沿触发的场景使用），
  // 在 endFrame() 里与键盘 justPressed 一起清空。
  private gamepadEvents: Set<string> = new Set();

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) {
        this.justPressed.add(e.code);
      }
      this.keys.add(e.code);
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('gamepadconnected', () => { this.refreshGamepads(); });
    window.addEventListener('gamepaddisconnected', () => { this.refreshGamepads(); });
    this.refreshGamepads();
  }

  /** 轮询 navigator.getGamepads()，更新内部缓存。每帧由 Game 主循环调用（见 Task 11）。 */
  refreshGamepads(): void {
    if (!navigator.getGamepads) return;
    const raw = Array.from(navigator.getGamepads()).filter((g): g is Gamepad => g !== null);
    // 按 id 去重，保留最后一次出现 —— antimicro 虚拟包装层通常先注册，
    // 真实 HID 设备晚到；只保留 last 可让真实设备「胜出」。
    // 用户的 Betop BFM 之前因这套去重缺失，浏览器同一 id 注册到 slot 0/1
    // 两个槽位，而游戏永远读 slot 0，恰好是冻结的 phantom。
    const seen = new Map<string, Gamepad>();
    for (const g of raw) seen.set(g.id, g);
    const unique = [...seen.values()];
    this.gamepads = [unique[0] ?? null, unique[1] ?? null, unique[2] ?? null, unique[3] ?? null];

    // 计算本帧手柄离散事件（菜单导航 / 暂停），供 isUp/isDown/isConfirm/isPause 使用。
    // 用与 getPlayerDirection 一致的 Betop/XInput 双范围 D-pad 检测 —— 一次刷新
    // 复用同一份设备探测逻辑，避免两处范围表漂移。
    this.gamepadEvents.clear();
    for (let slot = 0; slot < this.gamepads.length; slot++) {
      const gp = this.gamepads[slot];
      if (!gp) {
        this.prevButtonStates[slot] = null;
        continue;
      }
      const buttons = gp.buttons.map((b) => b.pressed);
      const prev = this.prevButtonStates[slot];
      this.prevButtonStates[slot] = buttons;
      // 首帧只播种，不触发事件（reconnect 时按钮若已处于按下态，不应产生伪边沿）。
      if (!prev || prev.length !== buttons.length) continue;
      const justPressed = (i: number) => buttons[i] && !prev[i];

      const isBetop = gp.id.toLowerCase().includes('betop');
      const ranges = isBetop ? [11, 12] : [12, 11];
      for (const base of ranges) {
        if (justPressed(base))     this.gamepadEvents.add('gpad:up');
        if (justPressed(base + 1)) this.gamepadEvents.add('gpad:down');
        if (justPressed(base + 2)) this.gamepadEvents.add('gpad:left');
        if (justPressed(base + 3)) this.gamepadEvents.add('gpad:right');
      }
      // A（button 0）→ 菜单 / 结算画面确认
      if (justPressed(0)) this.gamepadEvents.add('gpad:confirm');
      // Start（button 9）→ 菜单 / 结算画面确认 + 游戏中暂停
      if (justPressed(9)) this.gamepadEvents.add('gpad:start');
    }
  }

  getConnectedGamepadCount(): number {
    return this.gamepads.filter(g => g !== null).length;
  }

  // ----- 原键盘方法（菜单专用，全局任意玩家触发）-----

  isKeyDown(code: string): boolean { return this.keys.has(code); }
  isKeyPressed(code: string): boolean { return this.justPressed.has(code); }

  isPause(): boolean {
    return this.justPressed.has('KeyP')
      || this.justPressed.has('Escape')
      || this.gamepadEvents.has('gpad:start');
  }

  isQuit(): boolean {
    return this.justPressed.has('KeyQ');
  }

  isUp(): boolean {
    return this.justPressed.has('ArrowUp')
      || this.justPressed.has('KeyW')
      || this.gamepadEvents.has('gpad:up');
  }

  isDown(): boolean {
    return this.justPressed.has('ArrowDown')
      || this.justPressed.has('KeyS')
      || this.gamepadEvents.has('gpad:down');
  }

  isConfirm(): boolean {
    return this.justPressed.has('Enter')
      || this.justPressed.has('NumpadEnter')
      || this.gamepadEvents.has('gpad:confirm')
      || this.gamepadEvents.has('gpad:start');
  }

  // ----- 每玩家方法 -----

  /** 玩家输入源：手柄 #playerIndex（若连接）→ 否则键盘 */
  private playerInputSource(playerIndex: 0 | 1): 'gamepad' | 'keyboard' {
    if (this.gamepads[playerIndex]) return 'gamepad';
    return 'keyboard';
  }

  getPlayerDirection(playerIndex: 0 | 1): Direction | null {
    if (this.playerInputSource(playerIndex) === 'gamepad') {
      const gp = this.gamepads[playerIndex]!;
      // D-pad：标准 XInput 在 12-15；Betop BFM 在 11-14。设备 id 决定优先范围，
      // 另一个范围作为 fallback。同一范围内方向顺序 (up, down, left, right) 与
      // XInput 标准保持一致；Betop 的具体旋转待实测后调整。
      const isBetop = gp.id.toLowerCase().includes('betop');
      const ranges = isBetop ? [11, 12] : [12, 11];
      for (const base of ranges) {
        if (gp.buttons[base]?.pressed) return 'up';
        if (gp.buttons[base + 1]?.pressed) return 'down';
        if (gp.buttons[base + 2]?.pressed) return 'left';
        if (gp.buttons[base + 3]?.pressed) return 'right';
      }
      // 左摇杆
      const x = gp.axes[0] ?? 0;
      const y = gp.axes[1] ?? 0;
      if (y < -STICK_THRESHOLD) return 'up';
      if (y > STICK_THRESHOLD) return 'down';
      if (x < -STICK_THRESHOLD) return 'left';
      if (x > STICK_THRESHOLD) return 'right';
      return null;
    }
    const keys = playerIndex === 0 ? P1_KEYS : P2_KEYS;
    if (keys.up.some(k => this.keys.has(k))) return 'up';
    if (keys.down.some(k => this.keys.has(k))) return 'down';
    if (keys.left.some(k => this.keys.has(k))) return 'left';
    if (keys.right.some(k => this.keys.has(k))) return 'right';
    return null;
  }

  isPlayerShooting(playerIndex: 0 | 1): boolean {
    if (this.playerInputSource(playerIndex) === 'gamepad') {
      const gp = this.gamepads[playerIndex]!;
      return !!gp.buttons[0]?.pressed;
    }
    const keys = playerIndex === 0 ? P1_KEYS : P2_KEYS;
    return keys.shoot.some(k => this.keys.has(k));
  }

  isPlayerConfirm(playerIndex: 0 | 1): boolean {
    if (this.playerInputSource(playerIndex) === 'gamepad') {
      const gp = this.gamepads[playerIndex]!;
      return !!gp.buttons[9]?.pressed;
    }
    const keys = playerIndex === 0 ? P1_KEYS : P2_KEYS;
    return keys.confirm.some(k => this.justPressed.has(k));
  }

  endFrame(): void {
    this.justPressed.clear();
    this.gamepadEvents.clear();
  }
}
