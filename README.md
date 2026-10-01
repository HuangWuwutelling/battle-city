# 坦克大战 (Battle City)

经典红白机游戏《坦克大战》(Battle City) 的网页复刻版。TypeScript + Vite + Canvas 2D 实现,程序化生成像素美术,**无任何图片资源依赖**。

## 演示截图

启动游戏后:菜单 → 关卡介绍 → 战斗 → 结算 → 下一关。游戏区域 416×416,右侧 96px 为 HUD 信息栏,整体画布 512×416。

## 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | TypeScript 5.7 (严格模式) |
| 构建工具 | Vite 6 (HMR 热更新) |
| 渲染 | Canvas 2D API |
| 架构 | 场景管理器 + 固定时间步长游戏循环 (60fps) |
| 美术 | 程序化绘制 (纯代码,无图片资源) |
| 输入 | 键盘 + 手柄 (Gamepad API) |
| 关卡数据 | JSON |

## 功能特性

- 🎮 经典坦克大战玩法:玩家坦克、敌方坦克、子弹、砖墙/钢墙/水域/森林/基地
- 🗺️ 关卡系统:JSON 格式关卡数据,多关卡递进
- 🛠️ 内置地图编辑器 (从菜单进入)
- 🎯 砖墙按格子细分 (4 发子弹击碎一格),钢墙仅特殊子弹可击毁
- 🌿 森林草丛覆盖坦克,提供视觉掩护
- 💥 爆炸粒子效果
- 🎵 音效 (基于 Web Audio API)
- ⏸️ 暂停 / 通关 / 失败 / 重新开始
- 🎮 完整手柄支持 (菜单导航 + 游戏内操作)

## 快速开始

### 环境要求

- Node.js ≥ 18
- npm (或其他包管理器,如 pnpm / yarn)

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

默认在 `http://localhost:5173` 启动,支持热更新 (HMR),修改代码后浏览器自动刷新。

### 类型检查 + 生产构建

```bash
npm run build
```

执行 `tsc` 类型检查,然后用 Vite 打包到 `dist/` 目录。

### 预览生产构建

```bash
npm run preview
```

本地预览 `dist/` 目录中的构建产物。

### 仅类型检查

```bash
npx tsc --noEmit
```

适合快速验证类型错误,不产出文件。

## 操作说明

### 键盘

| 按键 | 操作 |
|------|------|
| ↑ ↓ ← → / WASD | 移动坦克 |
| 空格 / J | 发射子弹 |
| Enter | 菜单确认 / 开始 |
| Esc / P | 暂停 |
| R | 重新开始关卡 |

### 手柄

支持 Xbox / PlayStation / 普通 USB 手柄。左摇杆或方向键移动,`A` / `X` 发射,`Start` 暂停。手柄菜单导航按上下/确认操作。

## 项目结构

```
src/
├── main.ts                 # 入口
├── Game.ts                 # 游戏主循环 + 场景管理
├── constants.ts            # 全局常量 (尺寸/速度/颜色)
├── types.ts                # 类型定义
│
├── scenes/                 # 场景
│   ├── MenuScene.ts        # 主菜单
│   ├── StageIntroScene.ts  # 关卡介绍
│   ├── GameScene.ts        # 战斗主场景
│   ├── ScoreScene.ts       # 通关结算
│   ├── GameOverScene.ts    # 失败结算
│   └── MapEditorScene.ts   # 地图编辑器
│
├── entities/               # 实体 (坦克、子弹等)
├── systems/                # 系统 (子弹管理、敌人 AI 等)
├── rendering/              # 渲染相关 (像素艺术绘制)
├── data/
│   └── levels/             # 关卡 JSON 数据
└── utils/                  # 工具函数
```

## 核心架构

### 双坐标系

- **Tile 网格**: 13×13 逻辑块 (32px/格),关卡 JSON 和地图编辑器使用
- **Cell 网格**: 26×26 内部格 (16px/格),碰撞和渲染使用。1 个 tile = 2×2 cells

砖墙按 cell 粒度破坏 (4 发子弹彻底打碎 1 个 tile);坦克像素坐标,碰撞查询通过 `Math.floor(px / CELL_SIZE)` 转 cell 坐标。

### 渲染顺序

```
地形 → 子弹 → 坦克 → 爆炸 → 草丛(覆盖坦克) → HUD
```

草丛必须在地形之后渲染,以提供视觉掩护。

### 实体继承

```
Tank (抽象)
├── PlayerTank
└── EnemyTank

Bullet (独立类,被 BulletManager 管理)
```

敌方子弹由 `EnemyTank.bullet` 持有,但通过 `BulletManager` 的 `WeakSet` 去重追踪。

### 场景流转

```
menu → stageIntro → game → score → stageIntro(下一关)
                ↘ gameOver → menu
地图编辑器: menu → mapEditor
```

## 自定义关卡

关卡数据为 JSON 格式,放在 `src/data/levels/` 下。结构为 13×13 的 `tiles` 数组 + 敌方坦克配置。具体的 `TileType` 枚举可参考 `src/types.ts`。

```json
{
  "name": "关卡 1",
  "tiles": [[0,0,0,...], ...],
  "enemies": { "basic": 5, "fast": 3, "power": 1, "armor": 1 }
}
```

也可启动游戏后,从主菜单进入 **地图编辑器** 可视化编辑关卡。

## 开发约定

- 所有常量集中在 `src/constants.ts`,速度单位为 px/frame @60fps
- 所有颜色定义在 `constants.ts` 的 `COLORS` 对象中
- `Direction` 类型仅四方向:`'up' | 'down' | 'left' | 'right'`
- 坦克转向时位置吸附到 cell 网格边界,防止穿墙
- JSON 关卡用 `as unknown as LevelData[]` 强转 (TS 默认推断为 `number[][]`)

## 浏览器兼容性

支持现代浏览器:Chrome / Edge / Firefox / Safari 最新版。移动端浏览器可运行但建议使用键盘或手柄。音效部分依赖 Web Audio API,iOS Safari 需用户首次交互后才解锁。

## 许可证

MIT
