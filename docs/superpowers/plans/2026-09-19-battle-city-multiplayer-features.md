# Battle City 多玩家/难度/手柄支持 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 FC 坦克大战增加独立生命池、三种游戏模式、难度选择、USB 手柄支持。

**Architecture:** PlayerInput 适配器模式 — `Input` 类管理 2 个玩家各自的输入源（手柄或键盘），每位 PlayerTank 持有 playerIndex；菜单状态机在同一屏内完成 main → difficulty 切换；难度通过乘数在 enemy 初始化和构造时应用。

**Tech Stack:** TypeScript 5.7 + Vite 6.3，原生 Canvas 2D + Gamepad API，无新依赖。

## Global Constraints

- 项目无自动化测试，每个 Task 结束时用 `npm run dev` 视觉验证
- 所有现有公开 API 保持向后兼容（必要时添加可选参数，不删除现有参数）
- 中文 UI 字符串保持不变
- 每个 Task 结束独立提交，commit message 格式：`feat: <描述>` 或 `fix: <描述>`
- 现有 PLAYER_SPAWN (8,24) 和 PLAYER_SPAWN_COOP (4,24) / ALLY_SPAWN (20,24) 保留不变
- EAGLE_POS (12,24) 不变
- 文件路径全部以 `D:\Workspace\坦克大战\` 为根

---

## File Structure

**修改文件**：
- `src/constants.ts` — 新增颜色、难度、出生点、命数常量
- `src/types.ts` — 新增 `Difficulty`、`GameMode` 类型
- `src/systems/Save.ts` — `SaveData` 加 `lastDifficulty` 字段
- `src/systems/Input.ts` — 游戏手柄监听 + 每玩家方法
- `src/entities/PlayerTank.ts` — 接收 `playerIndex` + 颜色
- `src/entities/AlliedTank.ts` — 加 `lives` 字段 + 用 `COLORS.allyBody`
- `src/entities/EnemyTank.ts` — 构造接受 `speedMult`
- `src/systems/EnemyManager.ts` — `initLevel` 接受 difficulty
- `src/scenes/MenuScene.ts` — 状态机 + 难度选择 + 手柄提示
- `src/scenes/StageIntroScene.ts` — 透传 difficulty + mode
- `src/scenes/GameScene.ts` — 2 玩家数组 + 独立生命 + 新 HUD

**未修改**：
- `src/Game.ts` — 主循环不需要改
- `src/scenes/MapEditorScene.ts` — 不支持 P2 出生点编辑
- `src/systems/BulletManager.ts` — 已有 `players: PlayerTank[]` 数组
- `src/systems/Map.ts` — 地图不变
- `src/data/levels/*.json` — 关卡数据不变

---

## Task 1: 新增颜色、生命、难度常量

**Files:**
- Modify: `src/constants.ts:79-104` (COLORS), `:21` (PLAYER_LIVES 附近)
- Test: 视觉验证（后面 Task 用）

**Interfaces:**
- Consumes: 无
- Produces: `COLORS.player1Body/player1Track/player2Body/player2Track/allyBody/allyTrack`, `ALLY_LIVES`, `DIFFICULTY`, `PLAYER1_SPAWN`, `PLAYER2_SPAWN`

- [ ] **Step 1: 修改 constants.ts**

替换 `src/constants.ts` 中的 `COLORS` 对象（line 79-104），将 `playerBody` 重命名为 `player1Body`、`playerTrack` 重命名为 `player1Track`，新增 `player2Body` / `player2Track` / `allyBody` / `allyTrack`：

```ts
  player1Body: '#FFD700',
  player1Track: '#AA8800',
  player2Body: '#FFA500',
  player2Track: '#A05800',
  allyBody: '#00BFFF',
  allyTrack: '#0070A0',
```

其他颜色行保持不变。

- [ ] **Step 2: 新增 ALLY_LIVES 常量**

在 `src/constants.ts` line 21 后（PLAYER_LIVES 之后）新增：

```ts
export const ALLY_LIVES = 3;
```

- [ ] **Step 3: 新增 PLAYER2_SPAWN 常量**

在 `src/constants.ts` line 57 后（PLAYER_SPAWN_COOP 之后，ALLY_SPAWN 之前）新增：

```ts
export const PLAYER1_SPAWN = PLAYER_SPAWN;       // 别名，便于多人语义一致
export const PLAYER2_SPAWN = { x: 16, y: 24 };
```

注意：PLAYER1_SPAWN 是别名，不是新点。原 PLAYER_SPAWN (8,24) 不变。

- [ ] **Step 4: 新增 DIFFICULTY 配置**

在 `src/constants.ts` 末尾（`}` 闭合后）新增：

```ts
import type { Difficulty } from './types';

export const DIFFICULTY: Record<Difficulty, { speedMult: number; countMult: number }> = {
  easy:   { speedMult: 0.75, countMult: 0.7 },
  medium: { speedMult: 1.0,  countMult: 1.0 },
  hard:   { speedMult: 1.25, countMult: 1.3 },
};
```

注意：types.ts 中还没定义 Difficulty 类型——本 Task 不编译，下一个 Task 添加类型后会通过。

- [ ] **Step 5: 提交**

```bash
cd "D:/Workspace/坦克大战" && git add src/constants.ts && git commit -m "feat: add player2/ally colors, ally lives, difficulty config, player2 spawn"
```

---

## Task 2: 新增 Difficulty 和 GameMode 类型

**Files:**
- Modify: `src/types.ts:24-30`
- Test: 类型检查通过

**Interfaces:**
- Produces: `type Difficulty = 'easy' | 'medium' | 'hard'`, `type GameMode = 'single' | 'coop' | 'versus'`

- [ ] **Step 1: 在 types.ts 中新增类型**

修改 `src/types.ts` line 26 后（EnemyType 之后），新增：

```ts
export type Difficulty = 'easy' | 'medium' | 'hard';

export type GameMode = 'single' | 'coop' | 'versus';
```

位置：在 `EnemyType` 定义之后、`Team` 之前。

- [ ] **Step 2: 运行类型检查验证**

```bash
cd "D:/Workspace/坦克大战" && npx tsc --noEmit
```

Expected: 0 errors（DIFFICULTY 常量在 Task 1 现在可以引用 Difficulty 类型）

- [ ] **Step 3: 提交**

```bash
cd "D:/Workspace/坦克大战" && git add src/types.ts && git commit -m "feat: add Difficulty and GameMode types"
```

---

## Task 3: Save 存档支持难度偏好

**Files:**
- Modify: `src/systems/Save.ts:4-12` (SaveData interface)
- Test: 读老存档不报错

**Interfaces:**
- Produces: `SaveData.lastDifficulty: Difficulty`

- [ ] **Step 1: 修改 SaveData 接口**

在 `src/systems/Save.ts` line 12 后（updatedAt 之后）新增：

```ts
  // 上次选择的难度（默认 medium，向后兼容老存档）
  lastDifficulty: Difficulty;
```

并在文件顶部 `import` 中新增：

```ts
import type { Difficulty } from '../types';
```

- [ ] **Step 2: 修改 Save.load() 提供默认值**

替换 `src/systems/Save.ts` line 15-27 的 `load()` 方法：

```ts
  load(): SaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      if (typeof parsed.nextLevel !== 'number' || typeof parsed.totalScore !== 'number') {
        return null;
      }
      // 向后兼容：老存档无 lastDifficulty 字段时默认为 medium
      const lastDifficulty: Difficulty =
        parsed.lastDifficulty === 'easy' || parsed.lastDifficulty === 'medium' || parsed.lastDifficulty === 'hard'
          ? parsed.lastDifficulty
          : 'medium';
      return {
        nextLevel: parsed.nextLevel,
        totalScore: parsed.totalScore,
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
        lastDifficulty,
      };
    } catch {
      return null;
    }
  },
```

- [ ] **Step 3: 修改 Save.recordLevelClear() 保留难度**

替换 `src/systems/Save.ts` line 38-46 的 `recordLevelClear()`：

```ts
  // 通关后调用：推进到下一关；保留上次难度
  recordLevelClear(currentLevelIndex: number, totalScore: number, difficulty: Difficulty = 'medium'): void {
    const nextLevel = currentLevelIndex + 1;
    const existing = Save.load();
    Save.save({
      nextLevel: Math.max(nextLevel, existing?.nextLevel ?? 0),
      totalScore,
      updatedAt: Date.now(),
      lastDifficulty: difficulty,
    });
  },
```

- [ ] **Step 4: 运行类型检查**

```bash
cd "D:/Workspace/坦克大战" && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 5: 提交**

```bash
cd "D:/Workspace/坦克大战" && git add src/systems/Save.ts && git commit -m "feat: persist last difficulty preference in save"
```

---

## Task 4: Input 增加游戏手柄支持 + 每玩家方法

**Files:**
- Modify: `src/systems/Input.ts:1-66` (entire file)
- Test: `npx tsc --noEmit` 通过 + `npm run dev` 启动后键盘仍能用

**Interfaces:**
- Produces:
  - `getPlayerDirection(playerIndex: 0|1): Direction | null`
  - `isPlayerShooting(playerIndex: 0|1): boolean`
  - `isPlayerConfirm(playerIndex: 0|1): boolean`
  - `isPause(): boolean`（保持原签名）
  - `isUp()/isDown()/isConfirm()/isQuit(): boolean`（保持原签名，用于菜单）
  - `endFrame(): void`
  - `getConnectedGamepadCount(): number`
  - `refreshGamepads(): void`（公开，进入菜单时调用）

- [ ] **Step 1: 完全重写 src/systems/Input.ts**

替换整个文件：

```ts
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
```

- [ ] **Step 2: 运行类型检查**

```bash
cd "D:/Workspace/坦克大战" && npx tsc --noEmit
```

Expected: 错误列表 — 因为 PlayerTank.update() 仍调用 `input.getDirection()` 和 `input.isShooting()`，这些旧方法已删除。这是预期的，下一个 Task 会修复。

- [ ] **Step 3: 暂不提交**（等下一个 Task 一起修编译错误）

---

## Task 5: PlayerTank 接收 playerIndex 和颜色

**Files:**
- Modify: `src/entities/PlayerTank.ts:11-90`

**Interfaces:**
- Produces:
  - `constructor(x: number, y: number, playerIndex: 0|1, bodyColor?: string, trackColor?: string)`
  - `update(dt, input, map, allTanks)` — 用 `this.playerIndex` 调 input 的每玩家方法
  - `readonly playerIndex: 0|1`

- [ ] **Step 1: 修改 PlayerTank.ts**

替换整个文件：

```ts
import {
  PLAYER_SPEED, PLAYER_BULLET_SPEED, PLAYER_MAX_BULLETS,
  PLAYER_LIVES, INVINCIBLE_DURATION, COLORS,
} from '../constants';
import { Direction } from '../types';
import { Tank } from './Tank';
import { Bullet } from './Bullet';
import { Input } from '../systems/Input';
import { GameMap } from '../systems/Map';

export class PlayerTank extends Tank {
  readonly playerIndex: 0 | 1;
  lives: number;
  private invincibleTimer = 0;
  private bullets: Bullet[] = [];
  private sliding = false;
  private slideDirection: Direction = 'up';

  constructor(
    x: number,
    y: number,
    playerIndex: 0 | 1,
    bodyColor: string = COLORS.player1Body,
    trackColor: string = COLORS.player1Track,
  ) {
    super(x, y, PLAYER_SPEED, 1, bodyColor, trackColor);
    this.playerIndex = playerIndex;
    this.lives = PLAYER_LIVES;
    this.invincibleTimer = INVINCIBLE_DURATION;
  }

  get isInvincible(): boolean {
    return this.invincibleTimer > 0;
  }

  get activeBullets(): Bullet[] {
    return this.bullets.filter(b => b.active);
  }

  update(dt: number, input: Input, map: GameMap, allTanks: Tank[]): Bullet | null {
    if (!this.active) return null;

    this.invincibleTimer = Math.max(0, this.invincibleTimer - dt);

    // Update existing bullets
    for (const bullet of this.bullets) {
      if (bullet.active) bullet.update();
    }
    this.bullets = this.bullets.filter(b => b.active);

    // Movement
    const dir = input.getPlayerDirection(this.playerIndex);
    let newBullet: Bullet | null = null;

    if (dir) {
      this.sliding = false;
      this.tryMove(dir, map, allTanks);
      if (this.isOnIce(map)) {
        this.sliding = true;
        this.slideDirection = dir;
      }
    } else if (this.sliding && this.isOnIce(map)) {
      this.tryMove(this.slideDirection, map, allTanks);
    } else {
      this.sliding = false;
    }

    // Shooting
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    if (input.isPlayerShooting(this.playerIndex) && this.shootCooldown <= 0 && this.activeBullets.length < PLAYER_MAX_BULLETS) {
      const bp = this.getBulletSpawnPoint();
      newBullet = new Bullet(bp.x, bp.y, this.direction, PLAYER_BULLET_SPEED, 'player');
      this.bullets.push(newBullet);
      this.shootCooldown = 0.2;
    }

    return newBullet;
  }

  respawn(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.direction = 'up';
    this.hp = 1;
    this.active = true;
    this.invincibleTimer = INVINCIBLE_DURATION;
    this.bullets = [];
    this.lives--;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;
    if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer * 10) % 2 === 0) {
      return;
    }
    super.render(ctx);
  }
}
```

- [ ] **Step 2: 运行类型检查**

```bash
cd "D:/Workspace/坦克大战" && npx tsc --noEmit
```

Expected: GameScene.ts 报错（仍调旧 PlayerTank 构造器，无 playerIndex 参数）。这是预期的，Task 10 修复。

- [ ] **Step 3: 暂不提交**（等 GameScene 一起）

---

## Task 6: AlliedTank 加 lives 字段 + 用 COLORS.allyBody

**Files:**
- Modify: `src/entities/AlliedTank.ts:26-31` (constructor), `:214-221` (respawn)

**Interfaces:**
- Produces:
  - `lives: number` (public field)
  - `respawn(x, y)` 现在会减 lives

- [ ] **Step 1: 修改 AlliedTank.ts 的 import 和 constructor**

修改 `src/entities/AlliedTank.ts` line 1-10 的 import，添加 `ALLY_LIVES`：

```ts
import {
  ALLY_SPEED, ALLY_BULLET_SPEED, ALLY_MAX_BULLETS, ALLY_SHOOT_COOLDOWN,
  ALLY_DIRECTION_CHANGE_MIN, ALLY_DIRECTION_CHANGE_MAX,
  ALLY_AGGRO_RANGE, ALLY_NEAR_EAGLE_DISTANCE, EAGLE_POS,
  CELL_SIZE, COLORS, ALLY_LIVES,
} from '../constants';
```

修改 line 20-31 的 class 字段和 constructor：

```ts
export class AlliedTank extends Tank {
  lives: number;
  private directionTimer = 0;
  private nextDirectionChange: number;
  private shootTimer: number;
  bullets: Bullet[] = [];

  constructor(x: number, y: number) {
    // 友军颜色用青色与敌人明显区分（亮青 #00BFFF）
    super(x, y, ALLY_SPEED, 1, COLORS.allyBody, COLORS.allyTrack);
    this.lives = ALLY_LIVES;
    this.nextDirectionChange = this.randomInterval();
    this.shootTimer = ALLY_SHOOT_COOLDOWN;
  }
```

- [ ] **Step 2: 修改 respawn 方法**

替换 line 214-221 的 respawn：

```ts
  respawn(x: number, y: number): void {
    if (this.lives <= 0) return;
    this.lives--;
    this.x = x;
    this.y = y;
    this.direction = 'up';
    this.hp = 1;
    this.active = true;
    this.bullets = [];
  }
```

- [ ] **Step 3: 运行类型检查**

```bash
cd "D:/Workspace/坦克大战" && npx tsc --noEmit
```

Expected: 仅 GameScene.ts 报错（共用生命池代码），后续 Task 修复。

- [ ] **Step 4: 暂不提交**（等 GameScene 一起）

---

## Task 7: EnemyTank + EnemyManager 支持难度

**Files:**
- Modify: `src/entities/EnemyTank.ts:30-38` (constructor)
- Modify: `src/systems/EnemyManager.ts:25-45` (initLevel)

**Interfaces:**
- Produces:
  - `EnemyTank(x, y, type, speedMult: number = 1)`
  - `EnemyManager.initLevel(enemies, difficulty: Difficulty = 'medium')`

- [ ] **Step 1: 修改 EnemyTank constructor**

修改 `src/entities/EnemyTank.ts` line 30-38：

```ts
  constructor(x: number, y: number, type: EnemyType, speedMult: number = 1) {
    const config = ENEMY_CONFIGS[type];
    super(x, y, config.speed * speedMult, config.hp, config.bodyColor, '#404040');
    this.type = type;
    this.bulletSpeed = config.bulletSpeed * speedMult;
    this.score = config.score;
    this.nextDirectionChange = this.randomInterval();
    this.shootTimer = this.randomShootCooldown();
  }
```

- [ ] **Step 2: 修改 EnemyManager.initLevel**

替换 `src/systems/EnemyManager.ts` line 25-45：

```ts
  initLevel(
    enemies: { basic: number; fast: number; power: number; armor: number },
    difficulty: import('../types').Difficulty = 'medium',
  ): void {
    this.spawnQueue = [];
    this.activeEnemies = [];
    this.spawnTimer = 0;
    this.currentSpawnIndex = 0;
    this.spawning = null;

    const countMult = DIFFICULTY[difficulty].countMult;
    const applyMult = (n: number) => Math.max(1, Math.round(n * countMult));

    const queue: EnemyConfig[] = [];
    for (let i = 0; i < applyMult(enemies.basic); i++) queue.push({ type: 'basic' });
    for (let i = 0; i < applyMult(enemies.fast); i++) queue.push({ type: 'fast' });
    for (let i = 0; i < applyMult(enemies.power); i++) queue.push({ type: 'power' });
    for (let i = 0; i < applyMult(enemies.armor); i++) queue.push({ type: 'armor' });

    // Shuffle
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }

    this.spawnQueue = queue;
  }
```

在 `src/systems/EnemyManager.ts` 顶部 import 中新增：

```ts
import { DIFFICULTY } from '../constants';
```

- [ ] **Step 3: 修改 trySpawn 传递 speedMult**

修改 `src/systems/EnemyManager.ts` line 63（EnemyTank 实例化处）：

```ts
        const enemy = new EnemyTank(point.x * CELL_SIZE, point.y * CELL_SIZE, config.type, this.currentSpeedMult);
```

在 `src/systems/EnemyManager.ts` 的 class 中新增字段（line 18 之后）：

```ts
  private currentSpeedMult = 1;
```

修改 initLevel（line 25 起），在函数体最后添加：

```ts
    this.currentSpeedMult = DIFFICULTY[difficulty].speedMult;
```

完整 initLevel 修改如下（替换之前 step 2 的代码）：

```ts
  initLevel(
    enemies: { basic: number; fast: number; power: number; armor: number },
    difficulty: import('../types').Difficulty = 'medium',
  ): void {
    this.spawnQueue = [];
    this.activeEnemies = [];
    this.spawnTimer = 0;
    this.currentSpawnIndex = 0;
    this.spawning = null;

    const diff = DIFFICULTY[difficulty];
    this.currentSpeedMult = diff.speedMult;
    const applyMult = (n: number) => Math.max(1, Math.round(n * diff.countMult));

    const queue: EnemyConfig[] = [];
    for (let i = 0; i < applyMult(enemies.basic); i++) queue.push({ type: 'basic' });
    for (let i = 0; i < applyMult(enemies.fast); i++) queue.push({ type: 'fast' });
    for (let i = 0; i < applyMult(enemies.power); i++) queue.push({ type: 'power' });
    for (let i = 0; i < applyMult(enemies.armor); i++) queue.push({ type: 'armor' });

    // Shuffle
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }

    this.spawnQueue = queue;
  }
```

- [ ] **Step 4: 运行类型检查**

```bash
cd "D:/Workspace/坦克大战" && npx tsc --noEmit
```

Expected: 仅 GameScene.ts 报错

- [ ] **Step 5: 提交**

```bash
cd "D:/Workspace/坦克大战" && git add src/entities/EnemyTank.ts src/systems/EnemyManager.ts && git commit -m "feat: apply difficulty multipliers to enemy speed and count"
```

---

## Task 8: StageIntroScene 透传 difficulty 和 mode

**Files:**
- Modify: `src/scenes/StageIntroScene.ts`

- [ ] **Step 1: 重写 StageIntroScene.ts**

替换整个文件：

```ts
import { CANVAS_WIDTH, CANVAS_HEIGHT, STAGE_INTRO_DURATION, COLORS } from '../constants';
import { Difficulty, GameMode } from '../types';
import { Scene } from './Scene';
import { Input } from '../systems/Input';
import { Game } from '../Game';

export class StageIntroScene implements Scene {
  private game: Game;
  private levelIndex = 0;
  private mode: GameMode = 'single';
  private difficulty: Difficulty = 'medium';
  private timer = 0;

  constructor(game: Game) {
    this.game = game;
  }

  enter(params?: Record<string, unknown>): void {
    this.levelIndex = (params?.levelIndex as number) ?? 0;
    this.mode = (params?.mode as GameMode) ?? 'single';
    this.difficulty = (params?.difficulty as Difficulty) ?? 'medium';
    this.timer = 0;
  }

  exit(): void {}
  handleInput(_input: Input): void {}

  update(dt: number): void {
    this.timer += dt;
    if (this.timer >= STAGE_INTRO_DURATION) {
      this.game.switchScene('game', {
        levelIndex: this.levelIndex,
        mode: this.mode,
        difficulty: this.difficulty,
      });
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const progress = Math.min(this.timer / STAGE_INTRO_DURATION, 1);
    const curtainWidth = CANVAS_WIDTH * (1 - progress);

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, curtainWidth / 2, CANVAS_HEIGHT);
    ctx.fillRect(CANVAS_WIDTH - curtainWidth / 2, 0, curtainWidth / 2, CANVAS_HEIGHT);

    const modeLabel = this.mode === 'single' ? '单人'
                     : this.mode === 'coop'   ? '合作 (1P + AI)'
                     :                          '双人';

    const diffLabel = this.difficulty === 'easy'   ? '易'
                    : this.difficulty === 'medium' ? '中'
                    :                                '难';

    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`STAGE ${this.levelIndex + 1}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);

    ctx.font = '14px monospace';
    ctx.fillText(`${modeLabel}  |  难度: ${diffLabel}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 15);
  }
}
```

- [ ] **Step 2: 提交**

```bash
cd "D:/Workspace/坦克大战" && git add src/scenes/StageIntroScene.ts && git commit -m "feat: pass game mode and difficulty through stage intro"
```

---

## Task 9: MenuScene 状态机 + 难度选择 + 手柄提示

**Files:**
- Modify: `src/scenes/MenuScene.ts`

**Interfaces:**
- Produces:
  - 状态机 `'main' | 'difficulty'`
  - 主选项: `['continue'?, 'single', 'coop', 'versus', 'editor']`
  - 进入模式后立刻显示难度选择
  - 选择后 `switchScene('stageIntro', { mode, difficulty, ... })`
  - 渲染手柄连接数

- [ ] **Step 1: 重写 MenuScene.ts**

替换整个文件：

```ts
import { CANVAS_WIDTH, COLORS } from '../constants';
import { Difficulty, GameMode } from '../types';
import { Scene } from './Scene';
import { Input } from '../systems/Input';
import { Game } from '../Game';
import { Save } from '../systems/Save';

type MenuOption = 'continue' | 'single' | 'coop' | 'versus' | 'editor';
type MenuState = 'main' | 'difficulty';

const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'medium', 'hard'];
const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

export class MenuScene implements Scene {
  private game: Game;
  private state: MenuState = 'main';
  private selectedIndex = 0;
  private difficultyIndex = 1; // default medium
  private pendingMode: GameMode | null = null;
  private options: MenuOption[] = [];

  constructor(game: Game) {
    this.game = game;
  }

  enter(): void {
    this.state = 'main';
    this.selectedIndex = 0;
    this.pendingMode = null;
    // 默认选项
    this.options = ['single', 'coop', 'versus', 'editor'];
    if (Save.hasSave()) this.options.unshift('continue');

    // 从存档恢复上次难度
    const saved = Save.load();
    if (saved) {
      const idx = DIFFICULTY_ORDER.indexOf(saved.lastDifficulty);
      if (idx >= 0) this.difficultyIndex = idx;
    }
  }

  exit(): void {}

  handleInput(input: Input): void {
    if (this.state === 'main') {
      this.handleMainInput(input);
    } else {
      this.handleDifficultyInput(input);
    }
  }

  private handleMainInput(input: Input): void {
    if (input.isUp()) {
      this.selectedIndex = (this.selectedIndex - 1 + this.options.length) % this.options.length;
    }
    if (input.isDown()) {
      this.selectedIndex = (this.selectedIndex + 1) % this.options.length;
    }
    if (input.isConfirm()) {
      const opt = this.options[this.selectedIndex];
      if (opt === 'editor') {
        this.game.switchScene('mapEditor');
        return;
      }
      if (opt === 'continue') {
        const data = Save.load();
        const levelIndex = data?.nextLevel ?? 0;
        const difficulty = data?.lastDifficulty ?? 'medium';
        // 继续游戏默认单人模式（保持原行为）
        this.game.switchScene('stageIntro', { levelIndex, mode: 'single', difficulty, keepScore: true });
        return;
      }
      // single / coop / versus → 进入难度选择
      this.pendingMode = opt === 'single' ? 'single' : opt === 'coop' ? 'coop' : 'versus';
      this.state = 'difficulty';
      this.difficultyIndex = 1;
      return;
    }
  }

  private handleDifficultyInput(input: Input): void {
    // 横向选择难度
    if (input.isKeyPressed('ArrowLeft') || input.isKeyPressed('KeyA')) {
      this.difficultyIndex = (this.difficultyIndex - 1 + DIFFICULTY_ORDER.length) % DIFFICULTY_ORDER.length;
    }
    if (input.isKeyPressed('ArrowRight') || input.isKeyPressed('KeyD')) {
      this.difficultyIndex = (this.difficultyIndex + 1) % DIFFICULTY_ORDER.length;
    }
    if (input.isConfirm()) {
      const difficulty = DIFFICULTY_ORDER[this.difficultyIndex];
      const mode = this.pendingMode!;
      this.game.switchScene('stageIntro', { levelIndex: 0, mode, difficulty });
      return;
    }
    if (input.isKeyPressed('Escape') || input.isKeyPressed('Backspace')) {
      // 返回主菜单
      this.state = 'main';
      this.pendingMode = null;
    }
  }

  update(_dt: number): void {}

  private getOptionLabel(opt: MenuOption): string {
    if (opt === 'continue') {
      const data = Save.load();
      return `继续游戏 (关卡 ${(data?.nextLevel ?? 0) + 1})`;
    }
    if (opt === 'single') return '单人模式';
    if (opt === 'coop')   return '合作模式 (1P + AI)';
    if (opt === 'versus') return '双人模式';
    return '地图编辑器';
  }

  render(ctx: CanvasRenderingContext2D): void {
    const cx = CANVAS_WIDTH / 2;

    // Title
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BATTLE CITY', cx, 100);

    ctx.font = '14px monospace';
    ctx.fillStyle = COLORS.enemyBasic;
    ctx.fillText('坦 克 大 战', cx, 130);

    // Tank decoration
    this.drawMenuTank(ctx, cx - 80, 160, COLORS.player1Body);
    this.drawMenuTank(ctx, cx + 48, 160, COLORS.enemyBasic);

    if (this.state === 'main') {
      this.renderMainOptions(ctx, cx);
    } else {
      this.renderDifficultySelect(ctx, cx);
    }

    // 手柄状态提示（底部）
    ctx.font = '11px monospace';
    ctx.fillStyle = '#808080';
    ctx.textAlign = 'center';
    // 注意: getConnectedGamepadCount 由 Game 在 enter 时调用 refreshGamepads
    // 这里直接读 input 参数, 但 MenuScene 不持有 input 引用
    // 改用 navigator.getGamepads 实时检测
    const gamepadCount = (navigator.getGamepads ? navigator.getGamepads() : []).filter(g => g !== null).length;
    ctx.fillText(`🎮 检测到 ${gamepadCount} 个手柄`, cx, 395);
  }

  private renderMainOptions(ctx: CanvasRenderingContext2D, cx: number): void {
    ctx.font = '16px monospace';
    const startY = 240;
    for (let i = 0; i < this.options.length; i++) {
      const y = startY + i * 40;
      const isSelected = i === this.selectedIndex;
      ctx.fillStyle = isSelected ? COLORS.player1Body : COLORS.hudText;
      const prefix = isSelected ? '▶ ' : '  ';
      const label = this.getOptionLabel(this.options[i]);
      ctx.textAlign = 'center';
      ctx.fillText(prefix + label, cx, y);
    }

    ctx.font = '12px monospace';
    ctx.fillStyle = '#808080';
    ctx.fillText('WASD/方向键 选择  |  Enter 确认', cx, 380);
  }

  private renderDifficultySelect(ctx: CanvasRenderingContext2D, cx: number): void {
    const modeLabel = this.pendingMode === 'single' ? '单人模式'
                    : this.pendingMode === 'coop'   ? '合作模式 (1P + AI)'
                    :                                 '双人模式';

    ctx.font = '14px monospace';
    ctx.fillStyle = COLORS.hudText;
    ctx.textAlign = 'center';
    ctx.fillText(`已选择: ${modeLabel}`, cx, 230);

    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = COLORS.player1Body;
    ctx.fillText('选择难度', cx, 265);

    // 难度选项横向排列
    ctx.font = 'bold 18px monospace';
    const boxWidth = 90;
    const totalWidth = boxWidth * DIFFICULTY_ORDER.length;
    const startX = cx - totalWidth / 2;
    for (let i = 0; i < DIFFICULTY_ORDER.length; i++) {
      const x = startX + i * boxWidth + boxWidth / 2;
      const isSelected = i === this.difficultyIndex;
      // 背景框
      ctx.fillStyle = isSelected ? COLORS.player1Body : '#606060';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(DIFFICULTY_LABEL[DIFFICULTY_ORDER[i]], x, 310);
      // 选中标记
      if (isSelected) {
        ctx.fillStyle = COLORS.player1Body;
        ctx.font = '14px monospace';
        ctx.fillText('▼', x, 285);
      }
    }

    ctx.font = '12px monospace';
    ctx.fillStyle = '#808080';
    ctx.fillText('← → 切换  |  Enter 确认  |  Esc 返回', cx, 360);
  }

  private drawMenuTank(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(x + 8, y, 16, 24);
    ctx.fillRect(x + 12, y - 8, 8, 12);
    ctx.fillStyle = '#404040';
    ctx.fillRect(x + 2, y + 4, 6, 20);
    ctx.fillRect(x + 24, y + 4, 6, 20);
  }
}
```

- [ ] **Step 2: 运行类型检查**

```bash
cd "D:/Workspace/坦克大战" && npx tsc --noEmit
```

Expected: MenuScene 自己编译通过（render 签名已匹配 Scene 接口 `(ctx)`）；可能因 GameScene 报错（共用生命池代码），MenuScene 自身应通过。

- [ ] **Step 3: 提交**

```bash
cd "D:/Workspace/坦克大战" && git add src/scenes/MenuScene.ts && git commit -m "feat: menu state machine with difficulty selection and gamepad hint"
```

---

## Task 10: GameScene 重写 — 2 玩家数组 + 独立生命 + 新 HUD

**Files:**
- Modify: `src/scenes/GameScene.ts` (整个文件)

**Interfaces:**
- Produces:
  - `enter({ levelIndex, mode, difficulty })`
  - `players: PlayerTank[]`（包含 P1、P2、友军）
  - 独立的 handlePlayerHit，每个玩家/友军单独处理
  - HUD 显示 P1/P2/ALLY 各自动态

- [ ] **Step 1: 重写 GameScene.ts**

替换整个文件：

```ts
import {
  GAME_AREA_WIDTH, CANVAS_HEIGHT, HUD_WIDTH,
  PLAYER_SPAWN, PLAYER_SPAWN_COOP, ALLY_SPAWN, PLAYER2_SPAWN,
  PLAYER1_SPAWN, CELL_SIZE, COLORS,
} from '../constants';
import { Difficulty, EnemyType, GameMode, LevelData, LevelScore } from '../types';
import { Scene } from './Scene';
import { Input } from '../systems/Input';
import { Game } from '../Game';
import { GameMap } from '../systems/Map';
import { BulletManager } from '../systems/BulletManager';
import { EnemyManager } from '../systems/EnemyManager';
import { PlayerTank } from '../entities/PlayerTank';
import { AlliedTank } from '../entities/AlliedTank';
import { Tank } from '../entities/Tank';
import { Save } from '../systems/Save';

import level01 from '../data/levels/level-01.json';
import level02 from '../data/levels/level-02.json';
import level03 from '../data/levels/level-03.json';
import level04 from '../data/levels/level-04.json';
import level05 from '../data/levels/level-05.json';

const LEVELS: LevelData[] = [level01, level02, level03, level04, level05] as unknown as LevelData[];

export class GameScene implements Scene {
  private game: Game;
  private map!: GameMap;
  private bulletManager!: BulletManager;
  private enemyManager!: EnemyManager;
  private players: PlayerTank[] = [];
  private ally: AlliedTank | null = null;
  private levelIndex = 0;
  private score = 0;
  private levelScore: LevelScore = { basic: 0, fast: 0, power: 0, armor: 0 };
  private input: Input | null = null;
  private isCustomLevel = false;
  private customLevelData: LevelData | null = null;
  private mode: GameMode = 'single';
  private difficulty: Difficulty = 'medium';
  private paused = false;
  private quitConfirm = false;

  constructor(game: Game) {
    this.game = game;
  }

  enter(params?: Record<string, unknown>): void {
    this.levelIndex = (params?.levelIndex as number) ?? 0;
    this.isCustomLevel = !!(params?.customLevel);
    this.customLevelData = (params?.customLevel as LevelData) ?? null;
    this.mode = (params?.mode as GameMode) ?? 'single';
    this.difficulty = (params?.difficulty as Difficulty) ?? 'medium';

    if (!params?.keepScore) {
      this.score = 0;
      this.players = [];
      this.ally = null;

      // 单人/合作: P1 出生在 PLAYER_SPAWN_COOP 区域, 合作时再加 ALLY
      // 双人: P1 在 PLAYER1_SPAWN (8,24), P2 在 PLAYER2_SPAWN (16,24)
      if (this.mode === 'versus') {
        this.players.push(new PlayerTank(
          PLAYER1_SPAWN.x * CELL_SIZE,
          PLAYER1_SPAWN.y * CELL_SIZE,
          0,
          COLORS.player1Body,
          COLORS.player1Track,
        ));
        this.players.push(new PlayerTank(
          PLAYER2_SPAWN.x * CELL_SIZE,
          PLAYER2_SPAWN.y * CELL_SIZE,
          1,
          COLORS.player2Body,
          COLORS.player2Track,
        ));
      } else {
        const spawn = this.mode === 'coop' ? PLAYER_SPAWN_COOP : PLAYER_SPAWN;
        this.players.push(new PlayerTank(
          spawn.x * CELL_SIZE,
          spawn.y * CELL_SIZE,
          0,
          COLORS.player1Body,
          COLORS.player1Track,
        ));
        if (this.mode === 'coop') {
          this.ally = new AlliedTank(
            ALLY_SPAWN.x * CELL_SIZE,
            ALLY_SPAWN.y * CELL_SIZE,
          );
        }
      }
    }

    this.levelScore = { basic: 0, fast: 0, power: 0, armor: 0 };
    this.map = new GameMap();
    this.bulletManager = new BulletManager();
    this.enemyManager = new EnemyManager();

    const levelData = this.isCustomLevel ? this.customLevelData! : LEVELS[this.levelIndex % LEVELS.length];
    this.map.loadLevel(levelData);
    this.enemyManager.initLevel(levelData.enemies, this.difficulty);

    // 重置玩家位置（保持 keepScore 切换关时也能复位）
    if (this.mode === 'versus') {
      const p1 = this.players[0];
      const p2 = this.players[1];
      if (p1) { p1.x = PLAYER1_SPAWN.x * CELL_SIZE; p1.y = PLAYER1_SPAWN.y * CELL_SIZE; p1.active = true; p1.hp = 1; }
      if (p2) { p2.x = PLAYER2_SPAWN.x * CELL_SIZE; p2.y = PLAYER2_SPAWN.y * CELL_SIZE; p2.active = true; p2.hp = 1; }
    } else {
      const spawn = this.mode === 'coop' ? PLAYER_SPAWN_COOP : PLAYER_SPAWN;
      const p1 = this.players[0];
      if (p1) { p1.x = spawn.x * CELL_SIZE; p1.y = spawn.y * CELL_SIZE; p1.active = true; p1.hp = 1; }
    }

    if (this.ally) {
      this.ally.x = ALLY_SPAWN.x * CELL_SIZE;
      this.ally.y = ALLY_SPAWN.y * CELL_SIZE;
      this.ally.active = true;
      this.ally.respawn(ALLY_SPAWN.x * CELL_SIZE, ALLY_SPAWN.y * CELL_SIZE);
    }
  }

  exit(): void {}

  handleInput(input: Input): void {
    this.input = input;

    if (this.paused) {
      if (input.isPause()) {
        this.paused = false;
        this.quitConfirm = false;
      } else if (!this.quitConfirm && input.isQuit()) {
        this.quitConfirm = true;
      } else if (this.quitConfirm) {
        if (input.isConfirm()) {
          this.game.switchScene('menu');
        } else if (input.isUp() || input.isDown() || input.isPause()) {
          this.quitConfirm = false;
        }
      }
      return;
    }

    if (input.isPause()) {
      this.paused = true;
      this.quitConfirm = false;
    }
  }

  update(dt: number): void {
    if (!this.input) return;
    if (this.paused) return;

    this.map.update(dt);

    // 收集所有友军单位（含 AI 友军）用于碰撞查询
    const friendlyTanks: PlayerTank[] = [...this.players];
    if (this.ally && this.ally.active) {
      friendlyTanks.push(this.ally as unknown as PlayerTank);
    }
    const allTanks: Tank[] = [
      ...this.players,
      ...(this.ally && this.ally.active ? [this.ally] : []),
      ...this.enemyManager.activeEnemies,
    ];

    // Update players
    for (const player of this.players) {
      const newBullet = player.update(dt, this.input, this.map, allTanks);
      if (newBullet) {
        this.bulletManager.addBullet(newBullet);
      }
    }

    // Update AI ally
    if (this.ally && this.ally.active) {
      const newAllyBullet = this.ally.update(
        dt, this.map, allTanks, this.enemyManager.activeEnemies,
      );
      if (newAllyBullet) {
        this.bulletManager.addBullet(newAllyBullet);
      }
    }

    // Update enemies (target P1 if alive, else P2, else null)
    const target = this.players.find(p => p.active) ?? null;
    this.enemyManager.update(dt, this.map, allTanks, target ? target.center : null);

    // Add enemy bullets
    for (const enemy of this.enemyManager.activeEnemies) {
      if (enemy.bullet && enemy.bullet.active && !this.bulletManager.hasBullet(enemy.bullet)) {
        this.bulletManager.addBullet(enemy.bullet);
      }
    }

    this.bulletManager.update(dt);

    const result = this.bulletManager.processCollisions(
      this.map, friendlyTanks, this.enemyManager.activeEnemies,
    );

    this.score += result.score;
    for (const [type, count] of Object.entries(result.enemyKills)) {
      this.levelScore[type as EnemyType] += count as number;
    }

    if (result.playerHit) {
      this.handleFriendlyHit();
    }

    if (result.eagleHit) {
      this.game.switchScene('gameOver', { score: this.score });
      return;
    }

    if (this.enemyManager.isLevelComplete()) {
      this.game.switchScene('score', {
        levelIndex: this.levelIndex,
        levelScore: this.levelScore,
        totalScore: this.score,
        isCustomLevel: this.isCustomLevel,
        difficulty: this.difficulty,
      });
    }
  }

  /**
   * 处理玩家/友军死亡：每个单位独立判断
   * - lives > 0: 重生并减 lives
   * - lives <= 0: 该单位从游戏中消失（active = false）
   * Game Over 条件：所有玩家 + 友军都死了
   */
  private handleFriendlyHit(): void {
    // 处理每位玩家
    for (const player of this.players) {
      if (player.active) continue;
      if (player.lives > 0) {
        // 找到该玩家的出生点
        const spawn = player.playerIndex === 0
          ? (this.mode === 'coop' ? PLAYER_SPAWN_COOP : (this.mode === 'versus' ? PLAYER1_SPAWN : PLAYER_SPAWN))
          : PLAYER2_SPAWN;
        player.respawn(spawn.x * CELL_SIZE, spawn.y * CELL_SIZE);
      }
      // lives <= 0 时保持 inactive
    }

    // 处理 AI 友军
    if (this.ally && !this.ally.active) {
      if (this.ally.lives > 0) {
        this.ally.respawn(ALLY_SPAWN.x * CELL_SIZE, ALLY_SPAWN.y * CELL_SIZE);
      }
      // lives <= 0: 友军本关永久消失,玩家继续单人作战
    }

    // 检查 Game Over: 所有玩家和友军都死了
    const allPlayersDead = this.players.every(p => !p.active);
    const allyGone = !this.ally || !this.ally.active;
    if (allPlayersDead && allyGone) {
      this.game.switchScene('gameOver', { score: this.score });
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.map.renderBaseLayer(ctx);
    this.bulletManager.render(ctx);

    for (const player of this.players) {
      player.render(ctx);
    }
    if (this.ally && this.ally.active) {
      this.ally.render(ctx);
    }
    for (const enemy of this.enemyManager.activeEnemies) {
      enemy.render(ctx);
    }

    this.enemyManager.renderSpawnAnimation(ctx);
    this.map.renderGrassLayer(ctx);
    this.renderHUD(ctx);

    if (this.paused) {
      this.renderPauseOverlay(ctx);
    }
  }

  private renderPauseOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, GAME_AREA_WIDTH, CANVAS_HEIGHT);

    const cx = GAME_AREA_WIDTH / 2;
    ctx.textAlign = 'center';

    ctx.fillStyle = COLORS.player1Body;
    ctx.font = 'bold 36px monospace';
    ctx.fillText('PAUSE', cx, CANVAS_HEIGHT / 2 - 40);

    ctx.fillStyle = COLORS.hudText;
    ctx.font = '14px monospace';
    ctx.fillText('P / Esc  继续游戏', cx, CANVAS_HEIGHT / 2 + 10);

    if (this.quitConfirm) {
      ctx.fillStyle = COLORS.player1Body;
      ctx.font = 'bold 20px monospace';
      ctx.fillText('返回主菜单？', cx, CANVAS_HEIGHT / 2 + 60);

      ctx.fillStyle = COLORS.hudText;
      ctx.font = '14px monospace';
      ctx.fillText('Enter 确认   /   任意其他键取消', cx, CANVAS_HEIGHT / 2 + 90);
    } else {
      ctx.fillStyle = '#A0A0A0';
      ctx.font = '14px monospace';
      ctx.fillText('Q  返回主菜单', cx, CANVAS_HEIGHT / 2 + 60);
    }
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    const hx = GAME_AREA_WIDTH;
    const cx = hx + HUD_WIDTH / 2;

    ctx.fillStyle = '#404040';
    ctx.fillRect(hx, 0, HUD_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = COLORS.hudText;
    ctx.textAlign = 'center';

    // ENEMY
    ctx.font = '12px monospace';
    ctx.fillText('ENEMY', cx, 25);
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`${this.enemyManager.remainingEnemies}`, cx, 50);

    // 玩家/友军命数 — 动态布局
    let yCursor = 80;
    const drawUnitLives = (
      label: string,
      color: string,
      lives: number,
      active: boolean,
      label2?: string,
    ) => {
      // 标识
      ctx.fillStyle = color;
      ctx.font = 'bold 12px monospace';
      ctx.fillText(label, cx, yCursor);
      yCursor += 18;
      // 命数图标（小坦克 + 数字）
      ctx.font = '10px monospace';
      if (active) {
        ctx.fillStyle = COLORS.hudText;
        ctx.fillText('♥'.repeat(Math.max(0, lives)), cx, yCursor);
      } else {
        ctx.fillStyle = '#808080';
        ctx.fillText(label2 ?? 'OUT', cx, yCursor);
      }
      yCursor += 22;
    };

    drawUnitLives('P1', COLORS.player1Body, this.players[0]?.lives ?? 0, this.players[0]?.active ?? false);
    if (this.mode === 'versus') {
      drawUnitLives('P2', COLORS.player2Body, this.players[1]?.lives ?? 0, this.players[1]?.active ?? false);
    }
    if (this.mode === 'coop' && this.ally) {
      drawUnitLives('ALLY', COLORS.allyBody, this.ally.lives, this.ally.active, 'GONE');
    }

    // STAGE
    yCursor += 10;
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '12px monospace';
    ctx.fillText('STAGE', cx, yCursor);
    yCursor += 25;
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`${this.levelIndex + 1}`, cx, yCursor);

    // 难度（小字）
    yCursor += 25;
    ctx.font = '10px monospace';
    ctx.fillStyle = '#A0A0A0';
    const diffLabel = this.difficulty === 'easy' ? '简单' : this.difficulty === 'medium' ? '中等' : '困难';
    ctx.fillText(`难度: ${diffLabel}`, cx, yCursor);

    // SCORE — 固定底部
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '12px monospace';
    ctx.fillText('SCORE', cx, 360);
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`${this.score}`, cx, 385);
  }
}
```

- [ ] **Step 2: 运行类型检查**

```bash
cd "D:/Workspace/坦克大战" && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: 提交**

```bash
cd "D:/Workspace/坦克大战" && git add src/scenes/GameScene.ts && git commit -m "feat: 2-player support with independent lives, ally death handling, new HUD"
```

---

## Task 11: Game 主循环刷新手柄状态 + ScoreScene 传 difficulty

**Files:**
- Modify: `src/Game.ts:68-75` (loop 内)
- Modify: `src/scenes/ScoreScene.ts:11-30, :40-49` (params.difficulty)

- [ ] **Step 1: 在 Game.ts 每帧调 input.refreshGamepads**

修改 `src/Game.ts` line 68-75 的 while 循环，在最前面加：

```ts
    while (this.accumulator >= TICK_RATE) {
      this.input.refreshGamepads();
      if (this.currentScene) {
        this.currentScene.handleInput(this.input);
        this.currentScene.update(TICK_RATE);
      }
      this.input.endFrame();
      this.accumulator -= TICK_RATE;
    }
```

- [ ] **Step 2: 修改 ScoreScene 接收 difficulty 并传给 Save**

替换 `src/scenes/ScoreScene.ts` line 8-31：

```ts
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS, SCORE_BASIC, SCORE_FAST, SCORE_POWER, SCORE_ARMOR } from '../constants';
import { Difficulty, LevelScore } from '../types';
import { Scene } from './Scene';
import { Input } from '../systems/Input';
import { Game } from '../Game';
import { Save } from '../systems/Save';

export class ScoreScene implements Scene {
  private game: Game;
  private levelIndex = 0;
  private levelScore: LevelScore = { basic: 0, fast: 0, power: 0, armor: 0 };
  private totalScore = 0;
  private isCustomLevel = false;
  private difficulty: Difficulty = 'medium';
  private timer = 0;

  constructor(game: Game) {
    this.game = game;
  }

  enter(params?: Record<string, unknown>): void {
    this.levelIndex = (params?.levelIndex as number) ?? 0;
    this.levelScore = (params?.levelScore as LevelScore) ?? { basic: 0, fast: 0, power: 0, armor: 0 };
    this.totalScore = (params?.totalScore as number) ?? 0;
    this.isCustomLevel = (params?.isCustomLevel as boolean) ?? false;
    this.difficulty = (params?.difficulty as Difficulty) ?? 'medium';
    this.timer = 0;

    // 通关内置关卡时存进度（保留难度偏好）
    if (!this.isCustomLevel) {
      Save.recordLevelClear(this.levelIndex, this.totalScore, this.difficulty);
    }
  }
```

替换 line 35-43 的 handleInput 和 line 45-50 的 update：

```ts
  handleInput(input: Input): void {
    if (input.isConfirm() && this.timer > 1) {
      if (this.isCustomLevel) {
        this.game.switchScene('menu');
      } else {
        this.game.switchScene('stageIntro', {
          levelIndex: this.levelIndex + 1,
          difficulty: this.difficulty,
        });
      }
    }
  }

  update(dt: number): void {
    this.timer += dt;
    if (this.timer >= 5 && !this.isCustomLevel) {
      this.game.switchScene('stageIntro', {
        levelIndex: this.levelIndex + 1,
        difficulty: this.difficulty,
      });
    }
  }
```

- [ ] **Step 3: 运行类型检查**

```bash
cd "D:/Workspace/坦克大战" && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: 提交**

```bash
cd "D:/Workspace/坦克大战" && git add src/Game.ts src/scenes/ScoreScene.ts && git commit -m "feat: refresh gamepads each frame, persist difficulty on level clear"
```

---

## Task 12: 视觉验证 — 单人模式

- [ ] **Step 1: 启动 dev 服务器**

```bash
cd "D:/Workspace/坦克大战" && npm run dev
```

Expected: 浏览器打开游戏

- [ ] **Step 2: 验证菜单**

预期：
- 标题 "BATTLE CITY / 坦 克 大 战" 显示正常
- 选项: `[单人模式, 合作模式 (1P + AI), 双人模式, 地图编辑器]`（无存档时）
- 底部 "🎮 检测到 0 个手柄"（或实际连接数）

- [ ] **Step 3: 验证难度选择**

操作：选"单人模式" → Enter
预期：同一屏内显示"选择难度"，三个选项 [简单 / 中等 / 困难] 横向排列，中间高亮

- [ ] **Step 4: 验证关卡开始**

操作：选"中等" → Enter
预期：
- Stage Intro 显示 "STAGE 1  |  单人 | 难度: 中"
- 进入游戏后 P1 金色坦克出现在 (8, 24) cell 位置
- HUD 显示: ENEMY / P1 ♥♥♥ / STAGE 1 / 难度: 中等 / SCORE

- [ ] **Step 5: 验证键盘操作**

操作：WASD 移动、Space 射击
预期：P1 坦克正常响应

- [ ] **Step 6: 提交验证记录**

```bash
cd "D:/Workspace/坦克大战" && git commit --allow-empty -m "chore: verified single-player mode visually"
```

---

## Task 13: 视觉验证 — 合作模式（独立生命池）

- [ ] **Step 1: 返回菜单 → 选合作模式**

操作：Q 退到菜单 → 选"合作模式 (1P + AI)" → Enter → 选"中等" → Enter

预期：
- P1 金色坦克在 (4, 24)
- 友军青色坦克在 (20, 24)
- HUD: ENEMY / P1 ♥♥♥ / ALLY ♥♥♥ / STAGE / 难度 / SCORE

- [ ] **Step 2: 验证友军独立生命**

操作：让友军死 3 次（站在敌人子弹路径上）
预期：
- 友军死第 1 次 → ALLY 减到 ♥♥, HUD 实时刷新
- 友军死第 2 次 → ALLY 减到 ♥
- 友军死第 3 次 → ALLY 显示 "GONE", 友军消失, 玩家继续单人作战
- P1 命数全程不变（验证独立生命池）

- [ ] **Step 3: 验证玩家独立生命**

操作：玩家死 3 次
预期：
- 玩家死第 1 次 → P1 减到 ♥♥, 重生
- 玩家死第 2 次 → P1 减到 ♥
- 玩家死第 3 次 → P1 显示 OUT, Game Over
- 友军仍存活也不影响 Game Over（因为此时所有玩家和友军都死了）

- [ ] **Step 4: 提交验证记录**

```bash
cd "D:/Workspace/坦克大战" && git commit --allow-empty -m "chore: verified coop mode with independent lives"
```

---

## Task 14: 视觉验证 — 双人模式（手柄 + 键盘回退）

- [ ] **Step 1: 进入双人模式**

操作：菜单 → 双人模式 → 选难度 → 开始
预期：
- P1 金色在 (8, 24), P2 橙色在 (16, 24)
- HUD: ENEMY / P1 ♥♥♥ / P2 ♥♥♥ / STAGE / 难度 / SCORE
- 底部显示连接的手柄数

- [ ] **Step 2: 如果有 2 个手柄**

操作：每个手柄的 D-pad 移动、A 键射击
预期：P1 和 P2 各自响应各自的手柄

- [ ] **Step 3: 验证键盘回退**

操作：不接手柄（或拔掉手柄）→ 用 WASD 控制 P1，用方向键/IJKL 控制 P2，Numpad0 / 右 Shift 射击 P2
预期：P1 和 P2 各自响应各自的键盘

- [ ] **Step 4: 验证独立生命 + Game Over**

操作：让 P1 死 3 次
预期：
- P1 显示 OUT, P2 继续正常游戏
- HUD 仍然显示 P2 的命数
- P2 击毁所有敌人 → 进入下一关（验证 P2 单独可通关）

- [ ] **Step 5: 提交验证记录**

```bash
cd "D:/Workspace/坦克大战" && git commit --allow-empty -m "chore: verified versus mode with gamepad and keyboard"
```

---

## Task 15: 视觉验证 — 难度效果

- [ ] **Step 1: 简单模式**

操作：菜单 → 单人 → 简单
预期：
- 敌人数量明显少于中等（×0.7）
- 敌人移动速度较慢（×0.75）

- [ ] **Step 2: 困难模式**

操作：菜单 → 单人 → 困难
预期：
- 敌人数量明显多于中等（×1.3）
- 敌人移动速度较快（×1.25）

- [ ] **Step 3: 验证难度持久化**

操作：选"困难"通关一关 → 死掉回菜单 → 再选"单人"
预期：菜单默认选中"困难"（如果用同一存档路径）；或者 Stage Intro 仍显示"难度: 难"

- [ ] **Step 4: 提交验证记录**

```bash
cd "D:/Workspace/坦克大战" && git commit --allow-empty -m "chore: verified difficulty multipliers and persistence"
```

---

## Task 16: 颜色冲突检查

- [ ] **Step 1: 检查所有友军/玩家/敌人颜色**

打开游戏，截图保存（或视觉确认）：
- P1 坦克 = 金色 #FFD700
- P2 坦克 = 橙色 #FFA500（仅双人）
- 友军 = 亮青 #00BFFF（仅合作）
- 敌人 basic = 银色, fast = 红, power = 深绿, armor = 黄

- [ ] **Step 2: 验证可区分**

预期：
- P1 金 vs 装甲敌人黄 — 都能识别（玩家有无敌闪烁，敌人有装甲闪光）
- P2 橙 — 与红色 fast 敌人明显不同
- 友军青 — 与所有敌人颜色都不同（包括绿色 power）

- [ ] **Step 3: 提交验证记录（如发现问题，提交修复）**

```bash
cd "D:/Workspace/坦克大战" && git commit --allow-empty -m "chore: verified color distinguishability" --allow-empty
```

---

## Task 17: 存档兼容性 + 最终构建

- [ ] **Step 1: 测试老存档读取**

操作：手动设置 localStorage（DevTools Console）：

```js
localStorage.setItem('battle-city-save-v1', JSON.stringify({nextLevel: 2, totalScore: 5000, updatedAt: 1234567890}));
location.reload();
```

预期：菜单显示"继续游戏 (关卡 3)"，没有崩溃

- [ ] **Step 2: 运行生产构建**

```bash
cd "D:/Workspace/坦克大战" && npm run build
```

Expected: 0 编译错误，dist/ 目录生成成功

- [ ] **Step 3: 最终提交（如有修改）**

```bash
cd "D:/Workspace/坦克大战" && git status
# 如果有未提交的修改:
git add . && git commit -m "chore: final cleanup for multiplayer/difficulty/gamepad release"
```

---

## 完成检查清单

- [ ] P1 / P2 / 友军各有 3 条独立生命
- [ ] 友军颜色与敌人明显区分（青色 vs 绿色敌人）
- [ ] 玩家 1 / 2 / 友军颜色不同
- [ ] 菜单有"单人/合作/双人"三种模式入口
- [ ] 难度选择（易/中/难）影响敌人数量和速度
- [ ] 双人模式支持 2 个 USB 手柄（D-pad + A 键）
- [ ] 双人模式键盘回退（P1=WASD, P2=方向键/IJKL）
- [ ] 上次选择的难度保存到 localStorage
- [ ] `npx tsc --noEmit` 无错误
- [ ] `npm run build` 成功
- [ ] 视觉验证全部通过（Task 12-16）
