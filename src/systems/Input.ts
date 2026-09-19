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
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < this.gamepads.length; i++) {
      this.gamepads[i] = list[i] ?? null;
    }
  }

  getConnectedGamepadCount(): number {
    return this.gamepads.filter(g => g !== null).length;
  }

  // ----- 原键盘方法（菜单专用，全局任意玩家触发）-----

  isKeyDown(code: string): boolean { return this.keys.has(code); }
  isKeyPressed(code: string): boolean { return this.justPressed.has(code); }

  isPause(): boolean {
    return this.justPressed.has('KeyP') || this.justPressed.has('Escape');
  }

  isQuit(): boolean {
    return this.justPressed.has('KeyQ');
  }

  isUp(): boolean {
    return this.justPressed.has('ArrowUp') || this.justPressed.has('KeyW');
  }

  isDown(): boolean {
    return this.justPressed.has('ArrowDown') || this.justPressed.has('KeyS');
  }

  isConfirm(): boolean {
    return this.justPressed.has('Enter') || this.justPressed.has('NumpadEnter');
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
      // D-pad 优先
      if (gp.buttons[12]?.pressed) return 'up';
      if (gp.buttons[13]?.pressed) return 'down';
      if (gp.buttons[14]?.pressed) return 'left';
      if (gp.buttons[15]?.pressed) return 'right';
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
  }
}
