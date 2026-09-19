# Battle City — 多玩家、难度、手柄支持 设计

**日期**: 2026-09-19
**范围**: 单文件实现，包含约 12 个源文件改动 + 1 个新文件
**目标**: 在已有合作模式基础上扩展为完整多玩家游戏

---

## 1. 目标 & 背景

经典 FC 坦克大战目前只支持：
- 单人模式（1 玩家）
- 合作模式（1 玩家 + AI 友军，**共用生命池**——友军死扣玩家命）

需要增加：
1. **独立生命池**：主机玩家、AI 友军各 3 条命，互不影响
2. **三种游戏模式**：单人 / 合作 / 双人，独立菜单入口
3. **难度选择**：易、中、难三档，影响敌兵速度和数量
4. **USB 手柄支持**：双人对战模式，玩家 1 / 玩家 2 可各自接一个手柄

约束：保持现有游戏循环、场景系统、渲染管线、关卡数据格式不变。向后兼容现有存档（菜单中的 Continue 入口）。

---

## 2. 用户故事

### US-1：独立生命
> 作为合作模式玩家，我希望我和 AI 友军各有 3 条命，友军死不会扣我的命。

**验收**：
- 玩家和友军各有 3 条命，各自独立计数
- 任一方生命为 0 才从游戏中消失
- HUD 分别显示双方剩余命数

### US-2：三人颜色可分
> 作为玩家，我希望友军、玩家 1、玩家 2 的颜色不同且与敌人明显区分。

**验收**：
- P1 = 金色 `#FFD700`
- P2 = 橙色 `#FFA500`
- 友军 = 亮青 `#00BFFF`（与所有敌人颜色都不同）
- 敌人颜色保持不变

### US-3：难度选择
> 作为玩家，我希望在进入游戏前选择难度（易/中/难）。

**验收**：
- 菜单中选完模式后，同一屏内可横向选择难度
- 难度影响敌兵速度倍率（0.75 / 1.0 / 1.25）和数量倍率（0.7 / 1.0 / 1.3）
- 难度不影响玩家速度、AI 追击概率、命数、分数
- 上次选择的难度保存到 localStorage，下次进入菜单默认选中

### US-4：双人模式
> 作为玩家，我想和朋友用两个 USB 手柄一起玩。

**验收**：
- 菜单新增"双人模式"入口
- 玩家 1 和玩家 2 各自接一个手柄，D-pad 移动、A 键射击
- 玩家 1 死后玩家 2 继续，玩家 2 死后玩家 1 继续（独立生命池）
- 一方死亡时仅该方无法移动，另一方正常游戏
- 进入游戏时显示"检测到 N 个手柄"
- 不接手柄时退化为键盘（P2=方向键 + Enter/右Shift）

### US-5：独立 AI 友军生命
> 作为合作模式玩家，我希望友军命用完后本关不再复活，但不影响我继续游戏。

**验收**：
- 友军 3 命用完 → 本关永久消失，玩家继续单人作战
- 进入下一关时友军生命重置为 3

---

## 3. 架构

### 3.1 整体设计

```
┌────────────────────────────────────────────────────────────┐
│ Game (主循环 + 场景注册)                                     │
│   ↓                                                         │
│ MenuScene (状态机: main → difficulty)                        │
│   ↓ 模式 + 难度参数                                          │
│ StageIntroScene (透传)                                       │
│   ↓                                                         │
│ GameScene                                                   │
│   ├── player1: PlayerTank  (playerIndex=0)                  │
│   ├── player2: PlayerTank  (playerIndex=1, 仅双人模式)        │
│   ├── ally: AlliedTank    (仅合作模式)                       │
│   ├── enemyManager (受 difficulty 影响)                     │
│   ├── bulletManager                                         │
│   └── input: Input (管理 2 个 PlayerInput)                   │
└────────────────────────────────────────────────────────────┘
```

### 3.2 PlayerInput 适配器

`Input` 类为每位玩家提供一个逻辑输入源：

```ts
// Input 公共方法
getPlayerDirection(playerIndex: 0|1): Direction | null
isPlayerShooting(playerIndex: 0|1): boolean
isPlayerConfirm(playerIndex: 0|1): boolean
isMenuUp(playerIndex): boolean
isMenuDown(playerIndex): boolean
getConnectedGamepadCount(): number
```

每位玩家的输入源由 `Input` 内部管理：
- **P1 输入源**：手柄 #0（若连接）→ 否则键盘 WASD/Space
- **P2 输入源**：手柄 #1（若连接）→ 否则键盘方向键/Enter

手柄检测时机：
- 启动时（监听 `gamepadconnected`/`gamepaddisconnected` 事件记录状态）
- 进入菜单时（轮询 `navigator.getGamepads()` 刷新内部状态）
- 游戏中不检测热插拔（避免战斗中突然换源）

标准手柄映射（DInput / XInput 兼容）：
- 方向：D-pad (buttons 12-15) 或 左摇杆 (axes 0/1，阈值 0.5)
- 射击：button 0 (A / Cross)
- 暂停 / 确认：button 9 (Start)

### 3.3 难度系统

```ts
// types.ts
export type Difficulty = 'easy' | 'medium' | 'hard';

// constants.ts
export const DIFFICULTY = {
  easy:   { speedMult: 0.75, countMult: 0.7 },
  medium: { speedMult: 1.0,  countMult: 1.0 },
  hard:   { speedMult: 1.25, countMult: 1.3 },
} as const;

// 应用点
EnemyManager.initLevel(counts, difficulty)
  → 各类型敌人数 * countMult, 取整, 最少 1
EnemyTank.constructor(..., speedMult)
  → speed *= speedMult
```

### 3.4 菜单状态机

`MenuScene` 内部状态机，避免新建场景类：

```
state: 'main'
  选项: [单人, 合作, 双人, 地图编辑器, 继续]
  ↓ Enter
state: 'difficulty' (过滤掉编辑器 / 继续后)
  选项: [易, 中, 难]
  横向切换, Enter 确认, Esc 返回 main
  ↓ Enter
dispatch switchScene('stageIntro', { mode, difficulty, levelIndex })
```

### 3.5 生命系统

每个可死亡单位独立维护生命：

```ts
// PlayerTank 已有 lives 字段
// AlliedTank 新增 lives 字段
// 不共享 pool
```

死亡处理（`GameScene.handleUnitHit(tank)`）：
```
if tank.lives > 0:
  tank.respawn()
  tank.lives -= 1
  HUD 更新该单位显示
else:
  if tank === ally:
    ally.active = false  // 本关永久消失
    // 玩家继续单人作战
  elif tank === player1 || tank === player2:
    该玩家从游戏中消失, 但不影响其他玩家
    // 所有玩家 + 友军都死了才 Game Over
  if 所有玩家 + 友军都已死亡:
    switchScene('gameOver')
```

---

## 4. 数据结构

### 4.1 新增 / 修改常量 (`constants.ts`)

```ts
// 颜色（重命名 playerBody→player1Body，playerTrack→player1Track；新增 player2 / ally）
// 注意：playerBody → player1Body 是破坏性重命名,需同步更新 MapEditorScene 等引用点
COLORS = {
  ...,
  player1Body: '#FFD700',
  player1Track: '#AA8800',
  player2Body: '#FFA500',
  player2Track: '#A05800',
  allyBody: '#00BFFF',
  allyTrack: '#0070A0',
  // 敌人颜色不变
}

// 生命
export const ALLY_LIVES = 3;

// 出生点（cell 坐标，与原 PLAYER_SPAWN / PLAYER_SPAWN_COOP / ALLY_SPAWN 一致）
export const PLAYER1_SPAWN = { x: 8, y: 24 };   // 单人 / 双人 P1：鹰的左侧
export const PLAYER2_SPAWN = { x: 16, y: 24 };  // 双人 P2：鹰的右侧
// 合作模式沿用 PLAYER_SPAWN_COOP = (4, 24) 和 ALLY_SPAWN = (20, 24)

// 难度
export const DIFFICULTY: Record<Difficulty, { speedMult: number; countMult: number }>;
```

### 4.2 新增类型 (`types.ts`)

```ts
export type Difficulty = 'easy' | 'medium' | 'hard';
export type GameMode = 'single' | 'coop' | 'versus';
```

### 4.3 修改存档 (`Save.ts`)

```ts
interface SaveData {
  nextLevel: number;
  totalScore: number;
  updatedAt: number;
  lastDifficulty: Difficulty;  // 新增
}
```

向后兼容：缺失 `lastDifficulty` 字段时默认为 `'medium'`。

### 4.4 PlayerTank 构造器改造

```ts
constructor(
  x: number, y: number,
  playerIndex: 0 | 1,           // 新增：决定使用哪个 PlayerInput
  bodyColor: string = COLORS.player1Body,
  trackColor: string = COLORS.player1Track
)
```

playerIndex 决定使用哪个 PlayerInput（P1=0, P2=1）。颜色默认 P1 金色，双人模式时 P2 传橙色。

### 4.5 AlliedTank 改造

```ts
class AlliedTank {
  lives: number = ALLY_LIVES;   // 新增
  // 颜色从 COLORS.allyBody/allyTrack
  respawn(): void {
    if (this.lives > 0) {
      this.lives--;
      // ... 原有重置
    }
  }
}
```

### 4.6 EnemyTank 改造

```ts
constructor(
  x: number, y: number,
  type: EnemyType,
  speedMult: number = 1.0    // 新增
) {
  super(...);
  this.speed *= speedMult;
}
```

### 4.7 MenuScene 改造

状态机：

```ts
class MenuScene implements Scene {
  private state: 'main' | 'difficulty' = 'main';
  private mode: GameMode | null = null;
  private difficulty: Difficulty = 'medium';
  private mainOptions: MenuItem[];  // 动态, 根据 Save 和当前状态变化
  private difficultyOptions: Difficulty[] = ['easy', 'medium', 'hard'];
}
```

主选项逻辑：
- 默认: `[单人, 合作, 双人, 地图编辑器]`
- 若 `Save.hasSave()`: 改为 `[继续, 单人, 合作, 双人, 地图编辑器]`
- 选"继续"时直接进入上次关卡（用存档的难度）
- 选模式后 → 进入难度选择（同一屏）
- "地图编辑器"跳过难度选择直接进入

渲染：
- 顶部固定 1/3 屏：标题
- 中部：根据 state 显示 main/difficulty
- 底部：操作提示 + 手柄状态（"🎮 已连接 N 个手柄"）

---

## 5. 关键流程

### 5.1 进入游戏（菜单 → GameScene）

```
MenuScene (state: 'difficulty', mode: 'single', difficulty: 'medium')
  → 用户按 Enter
  → switchScene('stageIntro', { mode, difficulty, levelIndex })
StageIntroScene.enter({ mode, difficulty, levelIndex })
  → 显示关卡标题
  → 1.5s 后 switchScene('game', { mode, difficulty, levelIndex })
GameScene.enter({ mode, difficulty, levelIndex })
  → 加载关卡 JSON
  → 初始化 enemyManager.initLevel(counts, DIFFICULTY[difficulty])
  → 玩家：
      single: 1 个 PlayerTank(playerIndex=0, colors=P1)
      coop:   1 个 PlayerTank + 1 个 AlliedTank
      versus: 2 个 PlayerTank(playerIndex=0/1, colors=P1/P2)
  → HUD 初始化
```

### 5.2 子弹碰撞

```
BulletManager.processCollisions(map, players, enemies)
  players = [player1, player2?, ally?]
  // 现有逻辑：每个 player 接收伤害, 无视 ally vs player 区别
```

`processCollisions` 返回 `playerHit: boolean`，需要扩展为返回 `playerHit: { 0?: boolean; 1?: boolean }` 以区分哪位玩家被击中。或者保持 `playerHit: boolean` 简单处理：GameScene 检测每位玩家的 `active === false` 状态变化。

**决策**：保留 `playerHit: boolean`，GameScene 用 `player.active` 状态变化检测每位玩家。

### 5.3 友军死亡

```
1 帧内顺序:
1. BulletManager.processCollisions 返回 playerHit=true
2. GameScene 遍历所有玩家+友军, 找出 !active 的单位
3. 对每个死亡的单位调 handleUnitHit(unit)
4. handleUnitHit:
   if unit.lives > 0:
     unit.respawn()
   else:
     if ally: ally.active = false, HUD 显示 ALLY: 0
     if player: 该玩家停止移动, HUD 显示该玩家: 0
5. 检查所有玩家+友军是否都已死亡: 是 → Game Over
```

### 5.4 双人模式某玩家死亡

```
- 死亡玩家 active = false, lives = 0
- 该玩家 update() 调用被跳过（不响应输入）
- 该玩家坦克不渲染（active=false 时 PlayerTank.render 直接 return）
- 其他玩家继续游戏
- 剩余玩家击毁所有敌人 → 进入下一关
- 进入下一关时所有玩家 lives 重置为 3
```

---

## 6. 错误处理

### 6.1 手柄异常
- 浏览器不支持 Gamepad API：Input 类初始化时检测, 不报错, 退化为纯键盘
- 手柄连接但无输入：getDirection 返回 null, 玩家不动
- 用户按错键：所有键都有 noop 默认行为

### 6.2 难度边界
- 关卡 JSON 中某种敌人数量为 0：乘以 countMult 后仍为 0，正常处理
- 难度倍率取整：使用 `Math.max(1, Math.round(count * mult))` 保证至少 1 个敌人

### 6.3 存档兼容性
- 老存档（无 `lastDifficulty`）：读取时默认为 'medium'
- localStorage 不可用：Save 模块已 try/catch, 退化为无存档

---

## 7. 测试策略

无自动化测试（项目无 test suite）。视觉验证：
1. `npm run dev` 启动
2. **单人死亡**：
   - 单人模式死 3 次 → Game Over
   - 合作模式玩家死 3 次 → Game Over（友军活着）
   - 合作模式友军死 3 次 → 友军消失，玩家继续
3. **双人模式**：
   - P1 死 3 次 → P2 继续
   - P2 死 3 次 → P1 继续
4. **难度**：选"难" → 关卡敌人明显变多、变快
5. **手柄**（如能测试）：连接 2 个手柄 → 菜单提示"2 个手柄"，进入双人模式两位玩家用手柄操作
6. **键盘回退**：不接手柄时双人模式 P2 用方向键

---

## 8. 范围之外（YAGNI）

- 不做：网络对战、AI 难度自适应、关卡编辑器中的 P2 出生点
- 不改：敌人 AI 追击概率、玩家速度、分数倍数、命数（除友军）
- 不优化：现有合作模式之外的部分

---

## 9. 实施依赖

无新增 npm 包。手柄使用原生 `navigator.getGamepads()` Gamepad API。
