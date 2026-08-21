# Battle City (坦克大战) — 设计文档

## 概述

经典 FC 坦克大战（Battle City）的网页版复刻，包含核心游戏玩法和地图编辑器功能。

- **技术栈**：TypeScript + Vite
- **渲染**：Canvas 2D，程序化像素绘制（无外部图片资源）
- **部署**：GitHub Pages（GitHub Actions 自动部署）
- **操作**：键盘 WASD 移动 + 空格射击

---

## 1. 游戏世界与地图系统

### 1.1 地图网格

| 参数 | 值 |
|------|------|
| 逻辑网格 | 13×13 大格（tile） |
| 小格网格 | 26×26 小格（cell），每大格 = 2×2 小格 |
| 小格尺寸 | 16×16 像素 |
| 游戏区域 | 416×416 像素（26×26 × 16px） |
| HUD 侧栏 | 右侧 96 像素宽 |
| **总画布尺寸** | **512×416 像素** |

### 1.2 地形类型（6种）

| ID | 名称 | 像素颜色 | 坦克通行 | 子弹通行 | 可破坏 | 特殊 |
|----|------|---------|---------|---------|--------|------|
| 0 | 空地 | 黑色 `#000000` | ✅ | ✅ | — | — |
| 1 | 砖墙 | 棕色 `#B53120` | ❌ | ❌ | ✅ 按小格消除 | — |
| 2 | 铁墙 | 银色 `#C0C0C0` | ❌ | ❌ | ❌ | — |
| 3 | 草地 | 绿色 `#40A040` | ✅ | ✅ | — | 渲染在坦克上层 |
| 4 | 河流 | 蓝色 `#0058F8` | ❌ | ✅ | — | 2帧波纹动画 |
| 5 | 冰面 | 浅蓝 `#A0C0D0` | ✅ | ✅ | — | 坦克滑行（惯性） |

### 1.3 地图数据结构

```typescript
// 逻辑地图：13×13 大格，每格一个地形类型
type TileType = 0 | 1 | 2 | 3 | 4 | 5;

// 内部碰撞网格：26×26 小格，砖墙按小格粒度破坏
type CellGrid = TileType[][];  // 26×26

// 关卡数据格式（JSON）
interface LevelData {
  name: string;
  tiles: TileType[][];          // 13×13 大格定义
  subTiles?: Record<string, number[]>;  // 可选：预设部分破坏的子格状态
  enemies: {
    basic: number;    // 普通型数量
    fast: number;     // 快速型数量
    power: number;    // 强力型数量
    armor: number;    // 重甲型数量
  };
}
```

### 1.4 基地（鹰）

- **位置**：固定在地图底部中央，小格坐标 `(12,24)`
- **尺寸**：2×2 小格 = 32×32 像素
- **规则**：被敌方子弹击中 → 立即游戏结束（无论剩余生命数）
- **保护**：初始周围有砖墙包围保护

### 1.5 关键坐标（小格坐标系，原点左上角）

| 位置 | 坐标 | 说明 |
|------|------|------|
| 敌方生成点1 | `(0, 0)` | 地图左上角 |
| 敌方生成点2 | `(12, 0)` | 地图顶部中央 |
| 敌方生成点3 | `(24, 0)` | 地图右上角 |
| 玩家出生点 | `(8, 24)` | 地图底部偏左 |
| 基地（鹰） | `(12, 24)` | 地图底部中央 |

---

## 2. 坦克与战斗系统

### 2.1 玩家坦克

| 属性 | 值 |
|------|------|
| 尺寸 | 32×32 像素（2×2 小格 = 1 大格） |
| 移动速度 | 2 像素/帧（@60fps） |
| 子弹速度 | 6 像素/帧 |
| 同屏子弹数 | 1 颗 |
| 初始生命 | 3 条命 |
| 方向 | 上/下/左/右 四方向 |

**操控特性**：
- WASD 控制方向，空格键射击
- 每次只能朝一个方向移动（经典手感，非8方向）
- 方向改变时自动对齐到最近的小格边界（防止卡墙）
- 死亡后在玩家出生点复活，有短暂无敌时间（3秒闪烁）

### 2.2 敌方坦克（4种）

| 类型 | 颜色 | 移动速度 | 子弹速度 | 血量 | 分值 | 特点 |
|------|------|---------|---------|------|------|------|
| 普通 (basic) | 灰白 `#C0C0C0` | 1.5px/帧 | 4px/帧 | 1 | 100 | 基础敌人 |
| 快速 (fast) | 红色 `#E04040` | 3px/帧 | 4px/帧 | 1 | 200 | 速度翻倍 |
| 强力 (power) | 绿色 `#40C040` | 1.5px/帧 | 6px/帧 | 1 | 300 | 子弹速度快 |
| 重甲 (armor) | 黄色 `#E0E040` | 1px/帧 | 4px/帧 | 4 | 400 | 需4发击毁，闪烁表示受伤 |

### 2.3 子弹

| 属性 | 玩家子弹 | 敌方子弹 |
|------|---------|---------|
| 大小 | 4×4 像素 | 4×4 像素 |
| 速度 | 6 像素/帧 | 4 像素/帧（强力型 6px/帧） |
| 碰撞 | AABB 矩形检测 | AABB 矩形检测 |

**碰撞检测**（基于小格级别）：
- 子弹 vs 砖墙：检测子弹命中的小格，消除命中的单个小格
- 子弹 vs 铁墙：子弹消失，铁墙不变
- 子弹 vs 坦克：AABB 碰撞，坦克受伤/死亡
- 子弹 vs 子弹：两个子弹 AABB 重叠时互相抵消
- 坦克 vs 地形：检测坦克前方 2×2 小格区域是否可通行
- 坦克 vs 坦克：AABB 碰撞，互相阻挡移动

### 2.4 每关流程

1. **关卡开始** → `StageIntroScene` 显示 "STAGE X"（1.5秒过渡）
2. **游戏进行中** → `GameScene`：敌方从 3 个生成点依次刷出，场上最多 4 个
3. **胜利条件** → 消灭本关所有敌方坦克 → 进入 `ScoreScene` 结算 → 下一关
4. **失败条件** → 玩家生命耗尽 **或** 基地被毁 → `GameOverScene`

### 2.5 关卡结算

`ScoreScene` 显示本关战绩：

```
STAGE X CLEAR!

  普通  × 5   =  500
  快速  × 3   =  600
  强力  × 2   =  600
  重甲  × 1   =  400
  ────────────────
  TOTAL       2100
```

---

## 3. 敌方 AI 系统

### 3.1 移动逻辑

- 默认沿当前方向直线移动
- 碰到墙壁 / 地图边界 / 其他坦克时 → 随机选择新方向
- 即使无碰撞，每 2~5 秒随机换方向
- 方向选择：30% 概率朝玩家方向移动，70% 纯随机

### 3.2 射击逻辑

- 每个敌方坦克有独立射击冷却（1~3 秒随机间隔）
- 冷却结束且当前无在场子弹时射击
- 只朝当前面向方向射击（不做智能瞄准）

### 3.3 敌人管理器 (EnemyManager)

```typescript
class EnemyManager {
  spawnQueue: EnemyConfig[];     // 本关待生成敌人列表
  activeEnemies: EnemyTank[];    // 当前在场敌人（上限 4 个）
  spawnTimer: number;            // 生成间隔计时
  spawnPoints: Point[];          // 3 个生成点坐标
  currentSpawnIndex: number;     // 轮流生成点索引

  update(dt: number): void;      // 每帧：处理生成、AI 决策、移动
  onEnemyDestroyed(enemy: EnemyTank): void;  // 敌人被击毁回调
  isLevelComplete(): boolean;    // 队列空 + 场上无敌人 = 关卡完成
}
```

**生成规则**：
- 场上敌人 < 4 且队列非空 → 按间隔从生成点轮流刷出
- 生成前检查：如果目标位置被其他坦克占据 → 跳过本次，下个间隔重试
- 生成时播放闪烁出生动画（1秒）

---

## 4. 地图编辑器

### 4.1 界面布局

```
┌──────────────────────────────────────────────┐
│   顶部工具栏：[新建] [保存] [加载] [测试] [返回] │
├──────────────────────────┬───────────────────┤
│                          │   地形选择面板      │
│                          │  [砖] [铁] [草]    │
│     13×13 编辑画布        │  [河] [冰] [空]    │
│    （带网格线辅助）        │  [鹰] [敌(显示)]   │
│                          │                   │
│   鼠标左键 = 放置地形      │   敌人数量配置      │
│   鼠标右键 = 擦除为空      │  普通: [input]    │
│                          │  快速: [input]    │
│                          │  强力: [input]    │
│                          │  重甲: [input]    │
├──────────────────────────┴───────────────────┤
│  状态栏：当前地形 | 鼠标坐标 | 操作提示          │
└──────────────────────────────────────────────┘
```

### 4.2 交互规则

- 画布以 13×13 大格为编辑单位（点击一个大格放置对应地形）
- 选择地形后，在画布上点击或拖拽绘制
- 右键点击清除为空地
- 基地（鹰）只能放在底部中央位置，放置后自动生成周围砖墙保护
- 敌方生成点固定在顶部 3 个位置（只读显示，不可编辑）
- 玩家出生点固定在底部左侧（只读显示，不可编辑）

### 4.3 保存与加载

| 操作 | 实现 |
|------|------|
| 保存 | `localStorage.setItem('custom-maps', JSON.stringify(maps))` |
| 加载 | 从 `localStorage` 读取自定义地图列表 |
| 导出 | 下载为 JSON 文件（`Blob` + `URL.createObjectURL`） |
| 导入 | `<input type="file">` 上传 JSON 文件并解析 |
| 测试 | 直接从编辑器进入 `GameScene`，使用当前编辑的地图数据 |

### 4.4 地图数据格式

与内置关卡使用相同的 `LevelData` 接口（见 1.3 节）。

---

## 5. 场景管理与游戏循环

### 5.1 场景结构

```
SceneManager (在 Game 类中)
├── MenuScene          // 主菜单
├── StageIntroScene    // "STAGE X" 过渡动画
├── GameScene          // 核心游戏玩法
├── ScoreScene         // 关底积分结算
├── GameOverScene      // GAME OVER 画面
└── MapEditorScene     // 地图编辑器
```

每个场景实现统一接口：

```typescript
interface Scene {
  enter(params?: Record<string, unknown>): void;  // 进入场景时初始化
  exit(): void;                                    // 离开场景时清理
  update(dt: number): void;                       // 逻辑更新
  render(ctx: CanvasRenderingContext2D): void;     // 渲染
  handleInput(input: Input): void;                // 输入处理
}
```

### 5.2 主菜单

```
     ▓▓▓ BATTLE CITY ▓▓▓

        ▶ 开始游戏
          关卡选择
          地图编辑器

      ▲▼ 选择   Enter 确认
```

- 键盘 ▲▼ 切换选项，Enter 确认
- 关卡选择：显示内置关卡列表 + 自定义地图列表

### 5.3 游戏 HUD（右侧 96px 侧栏）

```
┌──────────┐
│ 🚩×20    │  剩余敌人数
│          │
│          │
│ STAGE 3  │  当前关卡
│          │
│ ❤️×3     │  剩余生命
│          │
│ SCORE    │
│ 02100    │  当前总分
└──────────┘
```

### 5.4 游戏主循环

```typescript
// 固定时间步长 + 累积器模式
const TICK_RATE = 1 / 60;  // 60fps 固定步长
let accumulator = 0;

function gameLoop(timestamp: number) {
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  accumulator += dt;

  while (accumulator >= TICK_RATE) {
    currentScene.update(TICK_RATE);
    accumulator -= TICK_RATE;
  }

  currentScene.render(ctx);
  requestAnimationFrame(gameLoop);
}
```

### 5.5 渲染顺序（从底到顶）

1. 黑色背景填充
2. 地形底层：空地 / 砖墙 / 铁墙 / 河流 / 冰面
3. 子弹
4. 坦克（玩家 + 敌方）
5. 爆炸动画
6. **草地**（渲染在坦克上方，坦克穿过时被遮挡）
7. 出生闪烁动画
8. HUD 侧栏

### 5.6 动画系统

所有图形使用程序化像素绘制（Canvas `fillRect`），无需外部图片资源。

| 动画 | 帧数 | 说明 |
|------|------|------|
| 坦克行走 | 2 帧 | 履带交替，× 4 方向 = 8 帧 |
| 河流波纹 | 2 帧 | 0.5 秒切换 |
| 爆炸 | 3 帧 | 小 → 中 → 大，每帧 0.1 秒 |
| 出生闪烁 | 4 帧 | 闪烁 1 秒后坦克出现 |
| 重甲受伤 | 颜色变化 | 黄 → 绿 → 黄 → 绿（每次受击切换） |

---

## 6. 项目结构

```
battle-city/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .github/
│   └── workflows/
│       └── deploy.yml              # GitHub Pages 自动部署
├── src/
│   ├── main.ts                     # 入口：初始化 Canvas + 启动游戏
│   ├── Game.ts                     # 游戏主类：循环 + 场景管理
│   ├── constants.ts                # 全局常量
│   ├── types.ts                    # 类型定义
│   ├── scenes/
│   │   ├── Scene.ts                # 场景接口
│   │   ├── MenuScene.ts            # 主菜单
│   │   ├── StageIntroScene.ts      # 关卡过渡
│   │   ├── GameScene.ts            # 游戏场景
│   │   ├── ScoreScene.ts           # 积分结算
│   │   ├── GameOverScene.ts        # 游戏结束
│   │   └── MapEditorScene.ts       # 地图编辑器
│   ├── entities/
│   │   ├── Tank.ts                 # 坦克基类
│   │   ├── PlayerTank.ts           # 玩家坦克
│   │   ├── EnemyTank.ts            # 敌方坦克
│   │   └── Bullet.ts               # 子弹
│   ├── systems/
│   │   ├── Map.ts                  # 地图系统
│   │   ├── EnemyManager.ts         # 敌人管理
│   │   ├── BulletManager.ts        # 子弹管理
│   │   ├── Collision.ts            # 碰撞检测
│   │   └── Input.ts                # 键盘输入
│   ├── rendering/
│   │   ├── PixelArt.ts             # 像素绘制工具
│   │   └── Animation.ts            # 帧动画系统
│   ├── data/
│   │   └── levels/                 # 内置关卡 JSON
│   │       ├── level-01.json
│   │       └── ...
│   └── utils/
│       └── storage.ts              # localStorage 工具
└── public/
    └── favicon.ico
```

---

## 7. 部署

### 7.1 Vite 配置

```typescript
// vite.config.ts
export default defineConfig({
  base: '/battle-city/',  // GitHub Pages 子路径
  build: {
    outDir: 'dist',
  },
});
```

### 7.2 GitHub Actions 部署流程

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

### 7.3 部署流程

1. 开发者 push 代码到 `main` 分支
2. GitHub Actions 自动触发构建
3. `vite build` 输出静态文件到 `dist/`
4. 部署到 `gh-pages` 分支
5. 通过 `https://<username>.github.io/battle-city/` 访问

---

## 8. 代码量估算

| 模块 | 预计行数 |
|------|---------|
| 常量 + 类型定义 | ~80 行 |
| 地图系统 (Map.ts) | ~200 行 |
| 像素绘制 (PixelArt.ts) | ~250 行 |
| 帧动画 (Animation.ts) | ~60 行 |
| 碰撞检测 (Collision.ts) | ~100 行 |
| 输入管理 (Input.ts) | ~50 行 |
| 坦克基类 + 玩家坦克 | ~250 行 |
| 敌方坦克 | ~150 行 |
| 子弹 | ~80 行 |
| 敌人管理器 | ~150 行 |
| 子弹管理器 | ~80 行 |
| 游戏主类 + 循环 | ~100 行 |
| 各场景 | ~350 行 |
| 地图编辑器场景 | ~300 行 |
| 关卡数据 (JSON) | ~200 行 |
| **总计** | **~2400 行** |
