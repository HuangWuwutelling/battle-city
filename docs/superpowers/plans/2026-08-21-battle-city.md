# Battle City (坦克大战) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a classic Battle City (FC坦克大战) web game with core gameplay, map editor, and GitHub Pages deployment.

**Architecture:** OOP class hierarchy with `Game → Scene → Entity` structure. Canvas 2D rendering with procedural pixel art (no image assets). Fixed-timestep game loop at 60fps. 13×13 tile grid internally represented as 26×26 cell grid for sub-tile brick wall destruction.

**Tech Stack:** TypeScript, Vite, Canvas 2D API, GitHub Actions

## Global Constraints

- Canvas size: 512×416px (416×416 game area + 96px HUD sidebar)
- Grid: 13×13 tiles (32px each), internally 26×26 cells (16px each)
- Tank size: 32×32px (2×2 cells), 4-directional movement only
- All graphics rendered procedurally via Canvas `fillRect` — no image assets
- 60fps fixed timestep game loop with accumulator pattern
- WASD movement + Space to shoot
- Level data format: JSON with 13×13 tile array + enemy config

---

## File Structure

```
battle-city/
├── index.html                  # Entry HTML with canvas element
├── package.json                # Dependencies: vite, typescript
├── tsconfig.json               # TypeScript strict config
├── vite.config.ts              # Vite config with base path
├── .github/workflows/deploy.yml
├── src/
│   ├── main.ts                 # Bootstrap: create canvas, start game
│   ├── Game.ts                 # Game loop + scene manager
│   ├── constants.ts            # All game constants (speeds, sizes, colors)
│   ├── types.ts                # Type definitions (TileType, LevelData, etc.)
│   ├── systems/
│   │   ├── Input.ts            # Keyboard state tracking
│   │   ├── Collision.ts        # AABB + cell-level collision detection
│   │   ├── Map.ts              # Map loading, cell grid, terrain queries
│   │   ├── EnemyManager.ts     # Enemy spawn, lifecycle, AI coordination
│   │   └── BulletManager.ts    # Bullet lifecycle, collision resolution
│   ├── entities/
│   │   ├── Tank.ts             # Base tank: movement, rendering, grid alignment
│   │   ├── PlayerTank.ts       # Player controls, input handling, respawn
│   │   ├── EnemyTank.ts        # 4 enemy types, AI movement + shooting
│   │   └── Bullet.ts           # Bullet movement + simple state
│   ├── rendering/
│   │   ├── PixelArt.ts         # Draw tank, terrain, bullet, eagle sprites
│   │   └── Animation.ts        # Frame-based animation helper
│   ├── scenes/
│   │   ├── Scene.ts            # Scene interface definition
│   │   ├── MenuScene.ts        # Main menu: start/select/editor
│   │   ├── StageIntroScene.ts  # "STAGE X" intro animation
│   │   ├── GameScene.ts        # Core gameplay orchestration
│   │   ├── ScoreScene.ts       # Post-level score tally
│   │   ├── GameOverScene.ts    # Game over screen
│   │   └── MapEditorScene.ts   # Visual map editor
│   ├── data/levels/
│   │   ├── level-01.json       # Built-in level 1
│   │   ├── level-02.json
│   │   ├── level-03.json
│   │   ├── level-04.json
│   │   └── level-05.json
│   └── utils/
│       └── storage.ts          # localStorage read/write for custom maps
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/constants.ts`
- Create: `src/types.ts`

- [ ] **Step 1: Initialize Vite + TypeScript project**

```bash
npm create vite@latest . -- --template vanilla-ts
npm install
```

Expected: `package.json`, `tsconfig.json`, `index.html`, `src/` created with vite + TS configured.

- [ ] **Step 2: Configure Vite for GitHub Pages**

Replace `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/battle-city/',
  build: {
    outDir: 'dist',
  },
});
```

- [ ] **Step 3: Create index.html with canvas**

Replace `index.html` content:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Battle City - 坦克大战</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #000;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    canvas {
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      border: 2px solid #444;
    }
  </style>
</head>
<body>
  <canvas id="gameCanvas" width="512" height="416"></canvas>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 4: Write constants.ts with all game constants**

Create `src/constants.ts`:

```typescript
// Grid
export const TILE_SIZE = 32;        // 1 tile = 32px (2×2 cells)
export const CELL_SIZE = 16;        // 1 cell = 16px
export const GRID_COLS = 13;        // 13 tiles wide
export const GRID_ROWS = 13;        // 13 tiles tall
export const CELL_COLS = 26;        // 26 cells wide
export const CELL_ROWS = 26;        // 26 cells tall

// Canvas
export const CANVAS_WIDTH = 512;
export const CANVAS_HEIGHT = 416;
export const GAME_AREA_WIDTH = 416;   // 26 × 16
export const GAME_AREA_HEIGHT = 416;  // 26 × 16
export const HUD_WIDTH = 96;

// Tank
export const TANK_SIZE = 32;          // 2×2 cells
export const PLAYER_SPEED = 2;        // px per frame @60fps
export const PLAYER_BULLET_SPEED = 6;
export const PLAYER_MAX_BULLETS = 1;
export const PLAYER_LIVES = 3;
export const INVINCIBLE_DURATION = 3; // seconds

// Enemy speeds
export const ENEMY_SPEED_BASIC = 1.5;
export const ENEMY_SPEED_FAST = 3;
export const ENEMY_SPEED_POWER = 1.5;
export const ENEMY_SPEED_ARMOR = 1;
export const ENEMY_BULLET_SPEED = 4;
export const ENEMY_BULLET_SPEED_POWER = 6;

// Enemy scores
export const SCORE_BASIC = 100;
export const SCORE_FAST = 200;
export const SCORE_POWER = 300;
export const SCORE_ARMOR = 400;

// Enemy manager
export const MAX_ACTIVE_ENEMIES = 4;
export const SPAWN_INTERVAL = 2;      // seconds between spawns
export const AI_DIRECTION_CHANGE_MIN = 2; // seconds
export const AI_DIRECTION_CHANGE_MAX = 5;
export const AI_PLAYER_CHASE_CHANCE = 0.3;
export const AI_SHOOT_COOLDOWN_MIN = 1;
export const AI_SHOOT_COOLDOWN_MAX = 3;

// Bullet
export const BULLET_SIZE = 4;

// Spawn points (cell coordinates)
export const ENEMY_SPAWN_POINTS = [
  { x: 0, y: 0 },
  { x: 12, y: 0 },
  { x: 24, y: 0 },
] as const;
export const PLAYER_SPAWN = { x: 8, y: 24 };
export const EAGLE_POS = { x: 12, y: 24 };

// Timings
export const TICK_RATE = 1 / 60;
export const STAGE_INTRO_DURATION = 1.5; // seconds
export const SPAWN_ANIMATION_DURATION = 1; // seconds
export const EXPLOSION_FRAME_DURATION = 0.1; // seconds
export const RIVER_ANIMATION_INTERVAL = 0.5; // seconds

// Colors
export const COLORS = {
  background: '#000000',
  brick: '#B53120',
  brickDark: '#802010',
  steel: '#C0C0C0',
  steelDark: '#808080',
  grass: '#40A040',
  grassDark: '#207020',
  river: '#0058F8',
  riverLight: '#4088FF',
  ice: '#A0C0D0',
  iceLight: '#C0E0F0',
  eagle: '#E0E0E0',
  eagleDark: '#808080',
  playerBody: '#FFD700',
  playerTrack: '#AA8800',
  enemyBasic: '#C0C0C0',
  enemyFast: '#E04040',
  enemyPower: '#40C040',
  enemyArmor: '#E0E040',
  bullet: '#FFFFFF',
  explosion: '#FF6600',
  explosionInner: '#FFFF00',
  hud: '#404040',
  hudText: '#FFFFFF',
} as const;
```

- [ ] **Step 5: Write types.ts with all type definitions**

Create `src/types.ts`:

```typescript
// Terrain tile types (used in 13×13 tile grid)
export type TileType = 0 | 1 | 2 | 3 | 4 | 5;
// 0=empty, 1=brick, 2=steel, 3=grass, 4=river, 5=ice

export const TILE_EMPTY: TileType = 0;
export const TILE_BRICK: TileType = 1;
export const TILE_STEEL: TileType = 2;
export const TILE_GRASS: TileType = 3;
export const TILE_RIVER: TileType = 4;
export const TILE_ICE: TileType = 5;

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export type EnemyType = 'basic' | 'fast' | 'power' | 'armor';

export interface EnemyConfig {
  type: EnemyType;
}

export interface LevelData {
  name: string;
  tiles: TileType[][];  // 13×13 grid
  enemies: {
    basic: number;
    fast: number;
    power: number;
    armor: number;
  };
}

export interface LevelScore {
  basic: number;
  fast: number;
  power: number;
  armor: number;
}
```

- [ ] **Step 6: Create main.ts entry point**

Create `src/main.ts`:

```typescript
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

// Placeholder: will be replaced by Game class in Task 6
ctx.fillStyle = '#000';
ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
ctx.fillStyle = '#FFF';
ctx.font = '20px monospace';
ctx.textAlign = 'center';
ctx.fillText('BATTLE CITY', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
ctx.font = '12px monospace';
ctx.fillText('Loading...', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);
```

- [ ] **Step 7: Clean up Vite template files**

Remove default Vite template files that aren't needed:

```bash
rm -f src/counter.ts src/typescript.svg src/style.css
```

- [ ] **Step 8: Verify dev server runs**

Run: `npx vite --open`

Expected: Browser opens showing black canvas with "BATTLE CITY" text.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: project scaffolding with vite, typescript, constants and types"
```

---

### Task 2: Input System + Animation System

**Files:**
- Create: `src/systems/Input.ts`
- Create: `src/rendering/Animation.ts`

**Interfaces:**
- Consumes: `types.ts` (Direction)
- Produces: `Input` class (isKeyDown, isKeyPressed, getDirection), `Animation` class (currentFrame, update, reset)

- [ ] **Step 1: Write Input.ts**

Create `src/systems/Input.ts`:

```typescript
import { Direction } from '../types';

export class Input {
  private keys: Set<string> = new Set();
  private justPressed: Set<string> = new Set();

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) {
        this.justPressed.add(e.code);
      }
      this.keys.add(e.code);
      // Prevent scrolling with arrow keys / space
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }

  isKeyPressed(code: string): boolean {
    return this.justPressed.has(code);
  }

  getDirection(): Direction | null {
    if (this.isKeyDown('KeyW') || this.isKeyDown('ArrowUp')) return 'up';
    if (this.isKeyDown('KeyS') || this.isKeyDown('ArrowDown')) return 'down';
    if (this.isKeyDown('KeyA') || this.isKeyDown('ArrowLeft')) return 'left';
    if (this.isKeyDown('KeyD') || this.isKeyDown('ArrowRight')) return 'right';
    return null;
  }

  isShooting(): boolean {
    return this.isKeyDown('Space');
  }

  isConfirm(): boolean {
    return this.isKeyPressed('Enter');
  }

  isUp(): boolean {
    return this.isKeyPressed('ArrowUp') || this.isKeyPressed('KeyW');
  }

  isDown(): boolean {
    return this.isKeyPressed('ArrowDown') || this.isKeyPressed('KeyS');
  }

  endFrame(): void {
    this.justPressed.clear();
  }
}
```

- [ ] **Step 2: Write Animation.ts**

Create `src/rendering/Animation.ts`:

```typescript
export class Animation {
  private frameIndex = 0;
  private elapsed = 0;

  constructor(
    public readonly frameCount: number,
    public readonly frameDuration: number,
    public readonly loop: boolean = true,
  ) {}

  update(dt: number): void {
    this.elapsed += dt;
    if (this.elapsed >= this.frameDuration) {
      this.elapsed -= this.frameDuration;
      this.frameIndex++;
      if (this.frameIndex >= this.frameCount) {
        this.frameIndex = this.loop ? 0 : this.frameCount - 1;
      }
    }
  }

  get currentFrame(): number {
    return this.frameIndex;
  }

  get isFinished(): boolean {
    return !this.loop && this.frameIndex >= this.frameCount - 1;
  }

  reset(): void {
    this.frameIndex = 0;
    this.elapsed = 0;
  }
}
```

- [ ] **Step 3: Verify by running dev server**

Run: `npx vite`

Expected: No TypeScript errors in terminal. Dev server starts.

- [ ] **Step 4: Commit**

```bash
git add src/systems/Input.ts src/rendering/Animation.ts
git commit -m "feat: add input system and animation system"
```

---

### Task 3: Collision Detection System

**Files:**
- Create: `src/systems/Collision.ts`

**Interfaces:**
- Consumes: `types.ts` (Rect, Point)
- Produces: `rectsOverlap()`, `pointInRect()`, `rectsOverlapArea()` functions

- [ ] **Step 1: Write Collision.ts**

Create `src/systems/Collision.ts`:

```typescript
import { Rect, Point } from '../types';

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function pointInRect(p: Point, r: Rect): boolean {
  return p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height;
}

export function getOverlapRect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const w = Math.min(a.x + a.width, b.x + b.width) - x;
  const h = Math.min(a.y + a.height, b.y + b.height) - y;
  if (w <= 0 || h <= 0) return null;
  return { x, y, width: w, height: h };
}

// Snap a position to the nearest cell boundary
export function snapToCell(value: number, cellSize: number): number {
  return Math.round(value / cellSize) * cellSize;
}
```

- [ ] **Step 2: Verify no TS errors**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/systems/Collision.ts
git commit -m "feat: add collision detection utilities"
```

---

### Task 4: Map System + Pixel Art Rendering

**Files:**
- Create: `src/systems/Map.ts`
- Create: `src/rendering/PixelArt.ts`

**Interfaces:**
- Consumes: `constants.ts`, `types.ts` (TileType, LevelData, TILE_*), `Collision.ts`
- Produces: `Map` class (loadLevel, getCell, setCell, isPassable, isBulletPassable, renderBaseLayer, renderGrassLayer, destroyCell), `PixelArt` (drawTerrain, drawTank, drawBullet, drawEagle, drawExplosion)

- [ ] **Step 1: Write PixelArt.ts — terrain drawing functions**

Create `src/rendering/PixelArt.ts`:

```typescript
import { CELL_SIZE, COLORS } from '../constants';
import { TileType, TILE_BRICK, TILE_STEEL, TILE_GRASS, TILE_RIVER, TILE_ICE } from '../types';

export class PixelArt {
  // Draw a single terrain cell (16×16 px)
  static drawTerrainCell(ctx: CanvasRenderingContext2D, x: number, y: number, type: TileType, frame: number = 0): void {
    const px = x * CELL_SIZE;
    const py = y * CELL_SIZE;
    const s = CELL_SIZE;

    switch (type) {
      case TILE_BRICK:
        PixelArt.drawBrick(ctx, px, py, s);
        break;
      case TILE_STEEL:
        PixelArt.drawSteel(ctx, px, py, s);
        break;
      case TILE_GRASS:
        PixelArt.drawGrass(ctx, px, py, s);
        break;
      case TILE_RIVER:
        PixelArt.drawRiver(ctx, px, py, s, frame);
        break;
      case TILE_ICE:
        PixelArt.drawIce(ctx, px, py, s);
        break;
    }
  }

  private static drawBrick(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
    ctx.fillStyle = COLORS.brick;
    ctx.fillRect(x, y, s, s);
    // Mortar lines
    ctx.fillStyle = COLORS.brickDark;
    // Horizontal lines
    for (let row = 0; row < s; row += 4) {
      ctx.fillRect(x, y + row, s, 1);
    }
    // Vertical lines (offset every other row)
    for (let row = 0; row < s; row += 8) {
      for (let col = 0; col < s; col += 8) {
        ctx.fillRect(x + col, y + row, 1, 4);
      }
      for (let col = 4; col < s; col += 8) {
        ctx.fillRect(x + col, y + row + 4, 1, 4);
      }
    }
  }

  private static drawSteel(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
    ctx.fillStyle = COLORS.steel;
    ctx.fillRect(x, y, s, s);
    // Highlight and shadow for 3D effect
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, s, 1);
    ctx.fillRect(x, y, 1, s);
    ctx.fillStyle = COLORS.steelDark;
    ctx.fillRect(x + s - 1, y, 1, s);
    ctx.fillRect(x, y + s - 1, s, 1);
    // Inner detail
    ctx.fillStyle = COLORS.steelDark;
    ctx.fillRect(x + 4, y + 4, s - 8, 1);
    ctx.fillRect(x + 4, y + 4, 1, s - 8);
  }

  private static drawGrass(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = COLORS.grassDark;
    // Leaf-like pattern
    for (let row = 0; row < s; row += 4) {
      for (let col = 0; col < s; col += 4) {
        ctx.fillRect(x + col + 1, y + row, 2, 2);
        ctx.fillRect(x + col + 3, y + row + 2, 1, 2);
      }
    }
  }

  private static drawRiver(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, frame: number): void {
    ctx.fillStyle = COLORS.river;
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = COLORS.riverLight;
    const offset = frame % 2 === 0 ? 0 : 4;
    for (let row = 0; row < s; row += 8) {
      for (let col = offset; col < s; col += 8) {
        ctx.fillRect(x + col, y + row, 4, 2);
      }
    }
  }

  private static drawIce(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
    ctx.fillStyle = COLORS.ice;
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = COLORS.iceLight;
    // Shine pattern
    ctx.fillRect(x + 2, y + 2, 4, 2);
    ctx.fillRect(x + 10, y + 8, 3, 2);
    ctx.fillRect(x + 4, y + 12, 5, 1);
  }

  // Draw tank sprite (32×32 px)
  static drawTank(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    direction: 'up' | 'down' | 'left' | 'right',
    bodyColor: string,
    trackColor: string,
    animFrame: number,
  ): void {
    ctx.save();
    ctx.translate(x, y);

    // Rotate based on direction (draw facing up by default)
    switch (direction) {
      case 'up': break;
      case 'down': ctx.translate(32, 32); ctx.rotate(Math.PI); break;
      case 'left': ctx.translate(0, 32); ctx.rotate(-Math.PI / 2); break;
      case 'right': ctx.translate(32, 0); ctx.rotate(Math.PI / 2); break;
    }

    // Tracks (left and right)
    ctx.fillStyle = trackColor;
    const trackOffset = animFrame % 2 === 0 ? 0 : 2;
    // Left track
    ctx.fillRect(2, 4, 6, 24);
    for (let i = trackOffset; i < 24; i += 4) {
      ctx.fillRect(2, 4 + i, 6, 2);
    }
    // Right track
    ctx.fillRect(24, 4, 6, 24);
    for (let i = trackOffset; i < 24; i += 4) {
      ctx.fillRect(24, 4 + i, 6, 2);
    }

    // Body
    ctx.fillStyle = bodyColor;
    ctx.fillRect(8, 6, 16, 20);

    // Turret
    ctx.fillRect(12, 2, 8, 12);
    // Barrel
    ctx.fillRect(14, 0, 4, 8);

    ctx.restore();
  }

  // Draw bullet (4×4 px)
  static drawBullet(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = COLORS.bullet;
    ctx.fillRect(x, y, 4, 4);
  }

  // Draw eagle/base (32×32 px)
  static drawEagle(ctx: CanvasRenderingContext2D, x: number, y: number, alive: boolean): void {
    if (alive) {
      ctx.fillStyle = COLORS.eagle;
      ctx.fillRect(x, y, 32, 32);
      // Eagle pattern (simplified bird shape)
      ctx.fillStyle = '#000';
      // Wings
      ctx.fillRect(x + 4, y + 8, 8, 4);
      ctx.fillRect(x + 20, y + 8, 8, 4);
      // Body
      ctx.fillRect(x + 12, y + 6, 8, 16);
      // Head
      ctx.fillRect(x + 14, y + 4, 4, 4);
      // Tail
      ctx.fillRect(x + 10, y + 22, 12, 4);
    } else {
      // Destroyed eagle
      ctx.fillStyle = '#404040';
      ctx.fillRect(x, y, 32, 32);
      ctx.fillStyle = '#808080';
      ctx.fillRect(x + 4, y + 8, 6, 6);
      ctx.fillRect(x + 18, y + 14, 8, 6);
      ctx.fillRect(x + 8, y + 20, 10, 4);
    }
  }

  // Draw explosion (variable size based on frame)
  static drawExplosion(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
    const sizes = [12, 24, 32];
    const size = sizes[Math.min(frame, sizes.length - 1)];
    const offset = (32 - size) / 2;

    ctx.fillStyle = COLORS.explosion;
    ctx.fillRect(x + offset, y + offset, size, size);

    // Inner bright core
    const innerSize = Math.max(4, size - 8);
    const innerOffset = (32 - innerSize) / 2;
    ctx.fillStyle = COLORS.explosionInner;
    ctx.fillRect(x + innerOffset, y + innerOffset, innerSize, innerSize);
  }

  // Draw spawn animation (flashing star pattern)
  static drawSpawnFlash(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
    const cx = x + 16;
    const cy = y + 16;
    const sizes = [4, 12, 20, 28];
    const size = sizes[frame % sizes.length];

    ctx.fillStyle = '#FFFFFF';
    // Diamond shape
    for (let i = 0; i < size / 2; i++) {
      ctx.fillRect(cx - i, cy - size / 2 + i, i * 2, 1);
      ctx.fillRect(cx - i, cy + size / 2 - i, i * 2, 1);
    }
  }
}
```

- [ ] **Step 2: Write Map.ts — map system**

Create `src/systems/Map.ts`:

```typescript
import {
  CELL_SIZE, CELL_COLS, CELL_ROWS, TILE_SIZE,
  GRID_COLS, GRID_ROWS, GAME_AREA_WIDTH, GAME_AREA_HEIGHT,
  EAGLE_POS, RIVER_ANIMATION_INTERVAL, COLORS,
} from '../constants';
import {
  TileType, LevelData, TILE_EMPTY, TILE_BRICK, TILE_STEEL,
  TILE_GRASS, TILE_RIVER, TILE_ICE,
} from '../types';
import { PixelArt } from '../rendering/PixelArt';

export class GameMap {
  // 26×26 cell grid for collision and rendering
  private cells: TileType[][] = [];
  private eagleAlive = true;
  private riverTimer = 0;
  private riverFrame = 0;

  constructor() {
    this.initEmpty();
  }

  private initEmpty(): void {
    this.cells = [];
    for (let row = 0; row < CELL_ROWS; row++) {
      this.cells[row] = [];
      for (let col = 0; col < CELL_COLS; col++) {
        this.cells[row][col] = TILE_EMPTY;
      }
    }
    this.eagleAlive = true;
  }

  loadLevel(level: LevelData): void {
    this.initEmpty();

    // Expand 13×13 tiles to 26×26 cells
    for (let tileRow = 0; tileRow < GRID_ROWS; tileRow++) {
      for (let tileCol = 0; tileCol < GRID_COLS; tileCol++) {
        const type = level.tiles[tileRow][tileCol];
        const cellRow = tileRow * 2;
        const cellCol = tileCol * 2;
        this.cells[cellRow][cellCol] = type;
        this.cells[cellRow][cellCol + 1] = type;
        this.cells[cellRow + 1][cellCol] = type;
        this.cells[cellRow + 1][cellCol + 1] = type;
      }
    }

    // Place eagle and surrounding brick walls
    this.placeEagle();
  }

  private placeEagle(): void {
    const ex = EAGLE_POS.x;
    const ey = EAGLE_POS.y;
    // Eagle occupies 2×2 cells at the eagle position
    this.cells[ey][ex] = TILE_EMPTY;
    this.cells[ey][ex + 1] = TILE_EMPTY;
    this.cells[ey + 1][ex] = TILE_EMPTY;
    this.cells[ey + 1][ex + 1] = TILE_EMPTY;

    // Surrounding brick wall protection (U-shape around eagle)
    // Top row
    this.cells[ey - 1][ex - 1] = TILE_BRICK;
    this.cells[ey - 1][ex] = TILE_BRICK;
    this.cells[ey - 1][ex + 1] = TILE_BRICK;
    this.cells[ey - 1][ex + 2] = TILE_BRICK;
    // Left column
    this.cells[ey][ex - 1] = TILE_BRICK;
    this.cells[ey + 1][ex - 1] = TILE_BRICK;
    // Right column
    this.cells[ey][ex + 2] = TILE_BRICK;
    this.cells[ey + 1][ex + 2] = TILE_BRICK;

    this.eagleAlive = true;
  }

  getCell(col: number, row: number): TileType {
    if (row < 0 || row >= CELL_ROWS || col < 0 || col >= CELL_COLS) {
      return TILE_STEEL; // Out of bounds treated as impassable
    }
    return this.cells[row][col];
  }

  setCell(col: number, row: number, type: TileType): void {
    if (row >= 0 && row < CELL_ROWS && col >= 0 && col < CELL_COLS) {
      this.cells[row][col] = type;
    }
  }

  // Check if terrain blocks tank movement
  isPassable(col: number, row: number): boolean {
    const type = this.getCell(col, row);
    return type === TILE_EMPTY || type === TILE_GRASS || type === TILE_ICE;
  }

  // Check if terrain blocks bullets
  isBulletPassable(col: number, row: number): boolean {
    const type = this.getCell(col, row);
    return type === TILE_EMPTY || type === TILE_GRASS || type === TILE_RIVER || type === TILE_ICE;
  }

  isIce(col: number, row: number): boolean {
    return this.getCell(col, row) === TILE_ICE;
  }

  // Destroy a single cell (for brick wall damage)
  destroyCell(col: number, row: number): void {
    if (this.getCell(col, row) === TILE_BRICK) {
      this.setCell(col, row, TILE_EMPTY);
    }
  }

  destroyEagle(): void {
    this.eagleAlive = false;
  }

  isEagleAlive(): boolean {
    return this.eagleAlive;
  }

  update(dt: number): void {
    this.riverTimer += dt;
    if (this.riverTimer >= RIVER_ANIMATION_INTERVAL) {
      this.riverTimer -= RIVER_ANIMATION_INTERVAL;
      this.riverFrame = (this.riverFrame + 1) % 2;
    }
  }

  // Render base terrain layer (everything except grass)
  renderBaseLayer(ctx: CanvasRenderingContext2D): void {
    for (let row = 0; row < CELL_ROWS; row++) {
      for (let col = 0; col < CELL_COLS; col++) {
        const type = this.cells[row][col];
        if (type !== TILE_EMPTY && type !== TILE_GRASS) {
          PixelArt.drawTerrainCell(ctx, col, row, type, this.riverFrame);
        }
      }
    }

    // Draw eagle
    const ex = EAGLE_POS.x * CELL_SIZE;
    const ey = EAGLE_POS.y * CELL_SIZE;
    PixelArt.drawEagle(ctx, ex, ey, this.eagleAlive);
  }

  // Render grass layer (on top of tanks)
  renderGrassLayer(ctx: CanvasRenderingContext2D): void {
    for (let row = 0; row < CELL_ROWS; row++) {
      for (let col = 0; col < CELL_COLS; col++) {
        if (this.cells[row][col] === TILE_GRASS) {
          PixelArt.drawTerrainCell(ctx, col, row, TILE_GRASS);
        }
      }
    }
  }

  // Get the cell grid data (for map editor)
  getCellGrid(): TileType[][] {
    return this.cells.map(row => [...row]);
  }

  // Set the entire cell grid (for map editor)
  setCellGrid(grid: TileType[][]): void {
    this.cells = grid.map(row => [...row]);
  }
}
```

- [ ] **Step 3: Verify no TS errors**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/rendering/PixelArt.ts src/systems/Map.ts
git commit -m "feat: add pixel art renderer and map system"
```

---

### Task 5: Bullet + Tank Entities

**Files:**
- Create: `src/entities/Bullet.ts`
- Create: `src/entities/Tank.ts`
- Create: `src/entities/PlayerTank.ts`
- Create: `src/entities/EnemyTank.ts`

**Interfaces:**
- Consumes: `constants.ts`, `types.ts`, `systems/Collision.ts`, `systems/Map.ts`, `rendering/PixelArt.ts`, `rendering/Animation.ts`, `systems/Input.ts`
- Produces: `Bullet` class, `Tank` base class, `PlayerTank` class, `EnemyTank` class

- [ ] **Step 1: Write Bullet.ts**

Create `src/entities/Bullet.ts`:

```typescript
import { BULLET_SIZE, CANVAS_WIDTH, GAME_AREA_WIDTH, GAME_AREA_HEIGHT } from '../constants';
import { Direction, Rect } from '../types';
import { PixelArt } from '../rendering/PixelArt';

export class Bullet {
  x: number;
  y: number;
  direction: Direction;
  speed: number;
  active = true;
  readonly ownerIsPlayer: boolean;

  constructor(x: number, y: number, direction: Direction, speed: number, ownerIsPlayer: boolean) {
    this.x = x;
    this.y = y;
    this.direction = direction;
    this.speed = speed;
    this.ownerIsPlayer = ownerIsPlayer;
  }

  get rect(): Rect {
    return { x: this.x, y: this.y, width: BULLET_SIZE, height: BULLET_SIZE };
  }

  update(): void {
    switch (this.direction) {
      case 'up':    this.y -= this.speed; break;
      case 'down':  this.y += this.speed; break;
      case 'left':  this.x -= this.speed; break;
      case 'right': this.x += this.speed; break;
    }

    // Deactivate if out of game area
    if (this.x < 0 || this.x + BULLET_SIZE > GAME_AREA_WIDTH ||
        this.y < 0 || this.y + BULLET_SIZE > GAME_AREA_HEIGHT) {
      this.active = false;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    PixelArt.drawBullet(ctx, this.x, this.y);
  }

  destroy(): void {
    this.active = false;
  }
}
```

- [ ] **Step 2: Write Tank.ts base class**

Create `src/entities/Tank.ts`:

```typescript
import {
  TANK_SIZE, CELL_SIZE, GAME_AREA_WIDTH, GAME_AREA_HEIGHT, COLORS,
} from '../constants';
import { Direction, Rect, Point } from '../types';
import { GameMap } from '../systems/Map';
import { PixelArt } from '../rendering/PixelArt';
import { Animation } from '../rendering/Animation';
import { snapToCell } from '../systems/Collision';

export abstract class Tank {
  x: number;           // pixel position (top-left)
  y: number;
  direction: Direction = 'up';
  speed: number;
  active = true;
  hp: number;
  maxHp: number;
  bodyColor: string;
  trackColor: string;
  readonly anim: Animation;
  protected shootCooldown = 0;

  constructor(x: number, y: number, speed: number, hp: number, bodyColor: string, trackColor: string) {
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.hp = hp;
    this.maxHp = hp;
    this.bodyColor = bodyColor;
    this.trackColor = trackColor;
    this.anim = new Animation(2, 0.1); // 2-frame walk animation, 0.1s per frame
  }

  get rect(): Rect {
    return { x: this.x, y: this.y, width: TANK_SIZE, height: TANK_SIZE };
  }

  get center(): Point {
    return { x: this.x + TANK_SIZE / 2, y: this.y + TANK_SIZE / 2 };
  }

  // Get the bullet spawn position (front of barrel)
  getBulletSpawnPoint(): Point {
    const cx = this.x + TANK_SIZE / 2 - 2; // center bullet (4px wide)
    const cy = this.y + TANK_SIZE / 2 - 2;
    switch (this.direction) {
      case 'up':    return { x: cx, y: this.y - 4 };
      case 'down':  return { x: cx, y: this.y + TANK_SIZE };
      case 'left':  return { x: this.x - 4, y: cy };
      case 'right': return { x: this.x + TANK_SIZE, y: cy };
    }
  }

  // Try to move in the given direction; returns true if moved
  tryMove(dir: Direction, map: GameMap, allTanks: Tank[]): boolean {
    // If changing direction, snap to cell grid first
    if (dir !== this.direction) {
      if (dir === 'up' || dir === 'down') {
        this.x = snapToCell(this.x, CELL_SIZE);
      } else {
        this.y = snapToCell(this.y, CELL_SIZE);
      }
      this.direction = dir;
    }

    // Calculate new position
    let nx = this.x;
    let ny = this.y;
    switch (dir) {
      case 'up':    ny -= this.speed; break;
      case 'down':  ny += this.speed; break;
      case 'left':  nx -= this.speed; break;
      case 'right': nx += this.speed; break;
    }

    // Boundary check
    if (nx < 0 || nx + TANK_SIZE > GAME_AREA_WIDTH ||
        ny < 0 || ny + TANK_SIZE > GAME_AREA_HEIGHT) {
      return false;
    }

    // Terrain collision: check all cells the tank would overlap
    const startCol = Math.floor(nx / CELL_SIZE);
    const endCol = Math.floor((nx + TANK_SIZE - 1) / CELL_SIZE);
    const startRow = Math.floor(ny / CELL_SIZE);
    const endRow = Math.floor((ny + TANK_SIZE - 1) / CELL_SIZE);

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        if (!map.isPassable(col, row)) {
          return false;
        }
      }
    }

    // Tank-vs-tank collision
    const testRect: Rect = { x: nx, y: ny, width: TANK_SIZE, height: TANK_SIZE };
    for (const other of allTanks) {
      if (other === this || !other.active) continue;
      const oRect = other.rect;
      if (nx < oRect.x + oRect.width && nx + TANK_SIZE > oRect.x &&
          ny < oRect.y + oRect.height && ny + TANK_SIZE > oRect.y) {
        return false;
      }
    }

    this.x = nx;
    this.y = ny;
    this.anim.update(1 / 60);
    return true;
  }

  // Check if tank is on ice
  isOnIce(map: GameMap): boolean {
    const col = Math.floor((this.x + TANK_SIZE / 2) / CELL_SIZE);
    const row = Math.floor((this.y + TANK_SIZE / 2) / CELL_SIZE);
    return map.isIce(col, row);
  }

  takeDamage(amount: number = 1): boolean {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.active = false;
      return true; // destroyed
    }
    return false;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;
    PixelArt.drawTank(
      ctx, this.x, this.y,
      this.direction, this.bodyColor, this.trackColor,
      this.anim.currentFrame,
    );
  }
}
```

- [ ] **Step 3: Write PlayerTank.ts**

Create `src/entities/PlayerTank.ts`:

```typescript
import {
  PLAYER_SPEED, PLAYER_BULLET_SPEED, PLAYER_MAX_BULLETS,
  PLAYER_LIVES, INVINCIBLE_DURATION, CELL_SIZE, COLORS,
} from '../constants';
import { Direction, Point } from '../types';
import { Tank } from './Tank';
import { Bullet } from './Bullet';
import { Input } from '../systems/Input';
import { GameMap } from '../systems/Map';

export class PlayerTank extends Tank {
  lives: number;
  private invincibleTimer = 0;
  private bullets: Bullet[] = [];
  private sliding = false;
  private slideDirection: Direction = 'up';

  constructor(x: number, y: number) {
    super(x, y, PLAYER_SPEED, 1, COLORS.playerBody, COLORS.playerTrack);
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

    // Update bullets
    for (const bullet of this.bullets) {
      if (bullet.active) bullet.update();
    }
    this.bullets = this.bullets.filter(b => b.active);

    // Movement
    const dir = input.getDirection();
    let newBullet: Bullet | null = null;

    if (dir) {
      this.sliding = false;
      this.tryMove(dir, map, allTanks);

      // Ice sliding: if we couldn't move but are on ice, keep sliding
      if (this.isOnIce(map)) {
        this.sliding = true;
        this.slideDirection = dir;
      }
    } else if (this.sliding && this.isOnIce(map)) {
      // Continue sliding on ice when no input
      this.tryMove(this.slideDirection, map, allTanks);
    } else {
      this.sliding = false;
    }

    // Shooting
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    if (input.isShooting() && this.shootCooldown <= 0 && this.activeBullets.length < PLAYER_MAX_BULLETS) {
      const bp = this.getBulletSpawnPoint();
      newBullet = new Bullet(bp.x, bp.y, this.direction, PLAYER_BULLET_SPEED, true);
      this.bullets.push(newBullet);
      this.shootCooldown = 0.2; // minimum time between shots
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

    // Invincibility flash effect
    if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer * 10) % 2 === 0) {
      return; // skip rendering every other frame for flashing
    }

    super.render(ctx);
  }
}
```

- [ ] **Step 4: Write EnemyTank.ts**

Create `src/entities/EnemyTank.ts`:

```typescript
import {
  ENEMY_SPEED_BASIC, ENEMY_SPEED_FAST, ENEMY_SPEED_POWER, ENEMY_SPEED_ARMOR,
  ENEMY_BULLET_SPEED, ENEMY_BULLET_SPEED_POWER,
  AI_DIRECTION_CHANGE_MIN, AI_DIRECTION_CHANGE_MAX,
  AI_PLAYER_CHASE_CHANCE, AI_SHOOT_COOLDOWN_MIN, AI_SHOOT_COOLDOWN_MAX,
  COLORS, TANK_SIZE, GAME_AREA_WIDTH, GAME_AREA_HEIGHT,
} from '../constants';
import { EnemyType, Direction, Point } from '../types';
import { Tank } from './Tank';
import { Bullet } from './Bullet';
import { GameMap } from '../systems/Map';

const ENEMY_CONFIGS: Record<EnemyType, { speed: number; bulletSpeed: number; hp: number; bodyColor: string; score: number }> = {
  basic: { speed: ENEMY_SPEED_BASIC, bulletSpeed: ENEMY_BULLET_SPEED, hp: 1, bodyColor: COLORS.enemyBasic, score: 100 },
  fast:  { speed: ENEMY_SPEED_FAST,  bulletSpeed: ENEMY_BULLET_SPEED, hp: 1, bodyColor: COLORS.enemyFast,  score: 200 },
  power: { speed: ENEMY_SPEED_POWER, bulletSpeed: ENEMY_BULLET_SPEED_POWER, hp: 1, bodyColor: COLORS.enemyPower, score: 300 },
  armor: { speed: ENEMY_SPEED_ARMOR, bulletSpeed: ENEMY_BULLET_SPEED, hp: 4, bodyColor: COLORS.enemyArmor, score: 400 },
};

export class EnemyTank extends Tank {
  readonly type: EnemyType;
  readonly bulletSpeed: number;
  readonly score: number;
  private directionTimer = 0;
  private nextDirectionChange: number;
  private shootTimer: number;
  private bullet: Bullet | null = null;
  private flashTimer = 0;

  constructor(x: number, y: number, type: EnemyType) {
    const config = ENEMY_CONFIGS[type];
    super(x, y, config.speed, config.hp, config.bodyColor, '#404040');
    this.type = type;
    this.bulletSpeed = config.bulletSpeed;
    this.score = config.score;
    this.nextDirectionChange = this.randomInterval();
    this.shootTimer = this.randomShootCooldown();
  }

  private randomInterval(): number {
    return AI_DIRECTION_CHANGE_MIN + Math.random() * (AI_DIRECTION_CHANGE_MAX - AI_DIRECTION_CHANGE_MIN);
  }

  private randomShootCooldown(): number {
    return AI_SHOOT_COOLDOWN_MIN + Math.random() * (AI_SHOOT_COOLDOWN_MAX - AI_SHOOT_COOLDOWN_MIN);
  }

  private chooseDirection(playerPos: Point | null): Direction {
    const directions: Direction[] = ['up', 'down', 'left', 'right'];

    // 30% chance to move toward player
    if (playerPos && Math.random() < AI_PLAYER_CHASE_CHANCE) {
      const dx = playerPos.x - this.x;
      const dy = playerPos.y - this.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        return dx > 0 ? 'right' : 'left';
      } else {
        return dy > 0 ? 'down' : 'up';
      }
    }

    return directions[Math.floor(Math.random() * 4)];
  }

  update(dt: number, map: GameMap, allTanks: Tank[], playerPos: Point | null): Bullet | null {
    if (!this.active) return null;

    // Direction change timer
    this.directionTimer += dt;
    if (this.directionTimer >= this.nextDirectionChange) {
      this.directionTimer = 0;
      this.nextDirectionChange = this.randomInterval();
      const newDir = this.chooseDirection(playerPos);
      this.tryMove(newDir, map, allTanks);
    }

    // Try to move in current direction
    const moved = this.tryMove(this.direction, map, allTanks);
    if (!moved) {
      // Hit something, pick new direction immediately
      const newDir = this.chooseDirection(playerPos);
      this.tryMove(newDir, map, allTanks);
      this.directionTimer = 0;
      this.nextDirectionChange = this.randomInterval();
    }

    // Shoot timer
    let newBullet: Bullet | null = null;
    this.shootTimer -= dt;
    if (this.shootTimer <= 0 && (!this.bullet || !this.bullet.active)) {
      const bp = this.getBulletSpawnPoint();
      this.bullet = new Bullet(bp.x, bp.y, this.direction, this.bulletSpeed, false);
      newBullet = this.bullet;
      this.shootTimer = this.randomShootCooldown();
    }

    // Update existing bullet
    if (this.bullet && this.bullet.active) {
      this.bullet.update();
    }

    return newBullet;
  }

  takeDamage(amount: number = 1): boolean {
    this.flashTimer = 0.2; // flash on hit
    return super.takeDamage(amount);
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;

    // Flash effect for armor tank taking damage
    if (this.flashTimer > 0) {
      this.flashTimer -= 1 / 60;
      // Alternate between body color and green
      const originalColor = this.bodyColor;
      if (Math.floor(this.flashTimer * 20) % 2 === 0) {
        this.bodyColor = COLORS.enemyPower; // green flash
      }
      super.render(ctx);
      this.bodyColor = originalColor;
      return;
    }

    super.render(ctx);
  }
}
```

- [ ] **Step 5: Verify no TS errors**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/entities/
git commit -m "feat: add bullet, tank base class, player tank, and enemy tank entities"
```

---

### Task 6: Bullet Manager + Enemy Manager

**Files:**
- Create: `src/systems/BulletManager.ts`
- Create: `src/systems/EnemyManager.ts`

**Interfaces:**
- Consumes: `Bullet`, `Tank`, `PlayerTank`, `EnemyTank`, `GameMap`, `Collision`, all constants
- Produces: `BulletManager` class (addBullet, update, checkCollisions), `EnemyManager` class (initLevel, update, isLevelComplete)

- [ ] **Step 1: Write BulletManager.ts**

Create `src/systems/BulletManager.ts`:

```typescript
import { CELL_SIZE, EAGLE_POS, TANK_SIZE } from '../constants';
import { TILE_BRICK, TILE_STEEL, Point, LevelScore, EnemyType } from '../types';
import { Bullet } from '../entities/Bullet';
import { PlayerTank } from '../entities/PlayerTank';
import { EnemyTank } from '../entities/EnemyTank';
import { GameMap } from './Map';
import { rectsOverlap } from './Collision';

export interface Explosion {
  x: number;
  y: number;
  frame: number;
  timer: number;
}

export class BulletManager {
  private bullets: Bullet[] = [];
  explosions: Explosion[] = [];

  addBullet(bullet: Bullet): void {
    this.bullets.push(bullet);
  }

  update(dt: number): void {
    // Update all bullets
    for (const b of this.bullets) {
      if (b.active) b.update();
    }

    // Update explosions
    for (const exp of this.explosions) {
      exp.timer += dt;
      if (exp.timer >= 0.1) {
        exp.timer -= 0.1;
        exp.frame++;
      }
    }
    this.explosions = this.explosions.filter(e => e.frame < 3);

    // Remove dead bullets
    this.bullets = this.bullets.filter(b => b.active);
  }

  private addExplosion(x: number, y: number): void {
    this.explosions.push({ x, y, frame: 0, timer: 0 });
  }

  // Process all collisions and return score earned + events
  processCollisions(
    map: GameMap,
    player: PlayerTank,
    enemies: EnemyTank[],
  ): { score: number; enemyKills: Partial<Record<EnemyType, number>>; playerHit: boolean; eagleHit: boolean } {
    let score = 0;
    const enemyKills: Partial<Record<EnemyType, number>> = {};
    let playerHit = false;
    let eagleHit = false;

    // Bullet vs terrain
    for (const bullet of this.bullets) {
      if (!bullet.active) continue;
      this.checkBulletTerrain(bullet, map);
    }

    // Bullet vs bullet (player bullet vs enemy bullet)
    const playerBullets = this.bullets.filter(b => b.active && b.ownerIsPlayer);
    const enemyBullets = this.bullets.filter(b => b.active && !b.ownerIsPlayer);
    for (const pb of playerBullets) {
      for (const eb of enemyBullets) {
        if (!eb.active) continue;
        if (rectsOverlap(pb.rect, eb.rect)) {
          pb.destroy();
          eb.destroy();
        }
      }
    }

    // Player bullets vs enemies
    for (const bullet of this.bullets) {
      if (!bullet.active || !bullet.ownerIsPlayer) continue;
      for (const enemy of enemies) {
        if (!enemy.active) continue;
        if (rectsOverlap(bullet.rect, enemy.rect)) {
          bullet.destroy();
          const destroyed = enemy.takeDamage();
          if (destroyed) {
            this.addExplosion(enemy.x, enemy.y);
            score += enemy.score;
            enemyKills[enemy.type] = (enemyKills[enemy.type] || 0) + 1;
          }
          break;
        }
      }
    }

    // Enemy bullets vs player
    for (const bullet of this.bullets) {
      if (!bullet.active || bullet.ownerIsPlayer) continue;
      if (player.active && !player.isInvincible && rectsOverlap(bullet.rect, player.rect)) {
        bullet.destroy();
        const destroyed = player.takeDamage();
        if (destroyed) {
          this.addExplosion(player.x, player.y);
          playerHit = true;
        }
      }
    }

    // Any bullet vs eagle
    const eagleRect = {
      x: EAGLE_POS.x * CELL_SIZE,
      y: EAGLE_POS.y * CELL_SIZE,
      width: TANK_SIZE,
      height: TANK_SIZE,
    };
    for (const bullet of this.bullets) {
      if (!bullet.active) continue;
      if (rectsOverlap(bullet.rect, eagleRect)) {
        bullet.destroy();
        map.destroyEagle();
        eagleHit = true;
        this.addExplosion(EAGLE_POS.x * CELL_SIZE, EAGLE_POS.y * CELL_SIZE);
      }
    }

    return { score, enemyKills, playerHit, eagleHit };
  }

  private checkBulletTerrain(bullet: Bullet, map: GameMap): void {
    const bRect = bullet.rect;
    // Check which cells the bullet overlaps
    const startCol = Math.floor(bRect.x / CELL_SIZE);
    const endCol = Math.floor((bRect.x + bRect.width - 1) / CELL_SIZE);
    const startRow = Math.floor(bRect.y / CELL_SIZE);
    const endRow = Math.floor((bRect.y + bRect.height - 1) / CELL_SIZE);

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        if (!map.isBulletPassable(col, row)) {
          const cellType = map.getCell(col, row);
          if (cellType === TILE_BRICK) {
            map.destroyCell(col, row);
            bullet.destroy();
            return;
          }
          if (cellType === TILE_STEEL) {
            bullet.destroy();
            return;
          }
        }
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const b of this.bullets) {
      if (b.active) b.render(ctx);
    }
    for (const exp of this.explosions) {
      PixelArt.drawExplosion(ctx, exp.x, exp.y, exp.frame);
    }
  }
}
```

- [ ] **Step 2: Write EnemyManager.ts**

Create `src/systems/EnemyManager.ts`:

```typescript
import {
  MAX_ACTIVE_ENEMIES, SPAWN_INTERVAL, SPAWN_ANIMATION_DURATION,
  ENEMY_SPAWN_POINTS, CELL_SIZE, TANK_SIZE,
} from '../constants';
import { EnemyType, EnemyConfig, Point } from '../types';
import { EnemyTank } from '../entities/EnemyTank';
import { Tank } from '../entities/Tank';
import { GameMap } from './Map';

interface SpawningEnemy {
  config: EnemyConfig;
  point: Point;
  timer: number;
}

export class EnemyManager {
  private spawnQueue: EnemyConfig[] = [];
  activeEnemies: EnemyTank[] = [];
  private spawnTimer = 0;
  private currentSpawnIndex = 0;
  private spawning: SpawningEnemy | null = null;
  private totalEnemies = 0;

  initLevel(enemies: { basic: number; fast: number; power: number; armor: number }): void {
    this.spawnQueue = [];
    this.activeEnemies = [];
    this.spawnTimer = 0;
    this.currentSpawnIndex = 0;
    this.spawning = null;

    // Build spawn queue: mix enemy types for variety
    const queue: EnemyConfig[] = [];
    for (let i = 0; i < enemies.basic; i++) queue.push({ type: 'basic' });
    for (let i = 0; i < enemies.fast; i++) queue.push({ type: 'fast' });
    for (let i = 0; i < enemies.power; i++) queue.push({ type: 'power' });
    for (let i = 0; i < enemies.armor; i++) queue.push({ type: 'armor' });

    // Shuffle for variety
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }

    this.spawnQueue = queue;
    this.totalEnemies = queue.length;
  }

  get remainingEnemies(): number {
    return this.spawnQueue.length + this.activeEnemies.length + (this.spawning ? 1 : 0);
  }

  isLevelComplete(): boolean {
    return this.spawnQueue.length === 0 &&
           this.activeEnemies.filter(e => e.active).length === 0 &&
           this.spawning === null;
  }

  update(dt: number, map: GameMap, allTanks: Tank[], playerPos: Point | null): void {
    // Handle spawning animation
    if (this.spawning) {
      this.spawning.timer += dt;
      if (this.spawning.timer >= SPAWN_ANIMATION_DURATION) {
        const { config, point } = this.spawning;
        const enemy = new EnemyTank(point.x * CELL_SIZE, point.y * CELL_SIZE, config.type);
        this.activeEnemies.push(enemy);
        this.spawning = null;
      }
      return; // Don't spawn another while one is spawning
    }

    // Spawn new enemies
    this.spawnTimer += dt;
    if (this.spawnTimer >= SPAWN_INTERVAL &&
        this.activeEnemies.filter(e => e.active).length < MAX_ACTIVE_ENEMIES &&
        this.spawnQueue.length > 0) {
      this.spawnTimer = 0;
      this.trySpawn();
    }

    // Update active enemies
    for (const enemy of this.activeEnemies) {
      if (!enemy.active) continue;
      const newBullet = enemy.update(dt, map, allTanks, playerPos);
      if (newBullet) {
        // Bullet is managed by the enemy itself; BulletManager picks it up from activeEnemies
      }
    }

    // Clean up dead enemies
    this.activeEnemies = this.activeEnemies.filter(e => e.active || e.hp > 0);
  }

  private trySpawn(): void {
    if (this.spawnQueue.length === 0) return;

    const config = this.spawnQueue.shift()!;
    const spawnPoint = ENEMY_SPAWN_POINTS[this.currentSpawnIndex % ENEMY_SPAWN_POINTS.length];
    this.currentSpawnIndex++;

    // Check if spawn point is clear
    const sx = spawnPoint.x * CELL_SIZE;
    const sy = spawnPoint.y * CELL_SIZE;
    const blocked = this.activeEnemies.some(e =>
      e.active &&
      Math.abs(e.x - sx) < TANK_SIZE &&
      Math.abs(e.y - sy) < TANK_SIZE
    );

    if (blocked) {
      // Put back in queue, try next interval
      this.spawnQueue.unshift(config);
      return;
    }

    this.spawning = { config, point: spawnPoint, timer: 0 };
  }

  getEnemyBullets() {
    return this.activeEnemies
      .filter(e => e.active)
      .map(e => (e as any).bullet)
      .filter((b): b is NonNullable<typeof b> => b != null && b.active);
  }

  renderSpawnAnimation(ctx: CanvasRenderingContext2D): void {
    if (!this.spawning) return;
    const frame = Math.floor(this.spawning.timer / (SPAWN_ANIMATION_DURATION / 4)) % 4;
    PixelArt.drawSpawnFlash(
      ctx,
      this.spawning.point.x * CELL_SIZE,
      this.spawning.point.y * CELL_SIZE,
      frame,
    );
  }
}
```
```

Use this corrected version for both `BulletManager.ts` and `EnemyManager.ts`.

- [ ] **Step 3: Verify no TS errors**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/systems/BulletManager.ts src/systems/EnemyManager.ts
git commit -m "feat: add bullet manager and enemy manager systems"
```

---

### Task 7: Game Loop + Scene System + Menu Scene

**Files:**
- Create: `src/scenes/Scene.ts`
- Create: `src/Game.ts`
- Create: `src/scenes/MenuScene.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: All previous modules
- Produces: `Scene` interface, `Game` class (main loop + scene management), `MenuScene`

- [ ] **Step 1: Write Scene.ts interface**

Create `src/scenes/Scene.ts`:

```typescript
import { Input } from '../systems/Input';

export interface Scene {
  enter(params?: Record<string, unknown>): void;
  exit(): void;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  handleInput(input: Input): void;
}
```

- [ ] **Step 2: Write Game.ts — game loop and scene manager**

Create `src/Game.ts`:

```typescript
import { CANVAS_WIDTH, CANVAS_HEIGHT, TICK_RATE, COLORS } from './constants';
import { Scene } from './scenes/Scene';
import { Input } from './systems/Input';
import { MenuScene } from './scenes/MenuScene';
import { StageIntroScene } from './scenes/StageIntroScene';
import { GameScene } from './scenes/GameScene';
import { ScoreScene } from './scenes/ScoreScene';
import { GameOverScene } from './scenes/GameOverScene';
import { MapEditorScene } from './scenes/MapEditorScene';

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private input: Input;
  private scenes: Map<string, Scene> = new Map();
  private currentScene: Scene | null = null;
  private lastTime = 0;
  private accumulator = 0;
  private running = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.input = new Input();

    this.registerScenes();
  }

  private registerScenes(): void {
    const scenes: [string, Scene][] = [
      ['menu', new MenuScene(this)],
      ['stageIntro', new StageIntroScene(this)],
      ['game', new GameScene(this)],
      ['score', new ScoreScene(this)],
      ['gameOver', new GameOverScene(this)],
      ['mapEditor', new MapEditorScene(this)],
    ];

    for (const [name, scene] of scenes) {
      this.scenes.set(name, scene);
    }
  }

  switchScene(name: string, params?: Record<string, unknown>): void {
    if (this.currentScene) {
      this.currentScene.exit();
    }
    const scene = this.scenes.get(name);
    if (!scene) {
      console.error(`Scene "${name}" not found`);
      return;
    }
    this.currentScene = scene;
    scene.enter(params);
  }

  start(): void {
    this.running = true;
    this.switchScene('menu');
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  private loop(timestamp: number): void {
    if (!this.running) return;

    const dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    this.accumulator += dt;

    // Fixed timestep updates
    while (this.accumulator >= TICK_RATE) {
      if (this.currentScene) {
        this.currentScene.handleInput(this.input);
        this.currentScene.update(TICK_RATE);
      }
      this.input.endFrame();
      this.accumulator -= TICK_RATE;
    }

    // Render
    this.ctx.fillStyle = COLORS.background;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (this.currentScene) {
      this.currentScene.render(this.ctx);
    }

    requestAnimationFrame((t) => this.loop(t));
  }

  stop(): void {
    this.running = false;
  }
}
```

- [ ] **Step 3: Write MenuScene.ts**

Create `src/scenes/MenuScene.ts`:

```typescript
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS, GAME_AREA_WIDTH } from '../constants';
import { Scene } from './Scene';
import { Input } from '../systems/Input';
import { Game } from '../Game';

export class MenuScene implements Scene {
  private game: Game;
  private selectedIndex = 0;
  private readonly options = ['开始游戏', '关卡选择', '地图编辑器'];

  constructor(game: Game) {
    this.game = game;
  }

  enter(): void {
    this.selectedIndex = 0;
  }

  exit(): void {}

  handleInput(input: Input): void {
    if (input.isUp()) {
      this.selectedIndex = (this.selectedIndex - 1 + this.options.length) % this.options.length;
    }
    if (input.isDown()) {
      this.selectedIndex = (this.selectedIndex + 1) % this.options.length;
    }
    if (input.isConfirm()) {
      switch (this.selectedIndex) {
        case 0: // Start game
          this.game.switchScene('stageIntro', { levelIndex: 0 });
          break;
        case 1: // Level select (for now, just start at level 0)
          this.game.switchScene('stageIntro', { levelIndex: 0 });
          break;
        case 2: // Map editor
          this.game.switchScene('mapEditor');
          break;
      }
    }
  }

  update(_dt: number): void {}

  render(ctx: CanvasRenderingContext2D): void {
    const cx = CANVAS_WIDTH / 2;

    // Title
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BATTLE CITY', cx, 100);

    // Subtitle
    ctx.font = '14px monospace';
    ctx.fillStyle = COLORS.enemyBasic;
    ctx.fillText('坦 克 大 战', cx, 130);

    // Tank decoration
    this.drawMenuTank(ctx, cx - 80, 160, COLORS.playerBody);
    this.drawMenuTank(ctx, cx + 48, 160, COLORS.enemyBasic);

    // Menu options
    ctx.font = '18px monospace';
    for (let i = 0; i < this.options.length; i++) {
      const y = 240 + i * 40;
      ctx.fillStyle = i === this.selectedIndex ? COLORS.playerBody : COLORS.hudText;
      const prefix = i === this.selectedIndex ? '▶ ' : '  ';
      ctx.textAlign = 'center';
      ctx.fillText(prefix + this.options[i], cx, y);
    }

    // Instructions
    ctx.font = '12px monospace';
    ctx.fillStyle = '#808080';
    ctx.fillText('WASD/方向键 选择  |  Enter 确认', cx, 380);
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

- [ ] **Step 4: Update main.ts to start the Game**

Replace `src/main.ts`:

```typescript
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants';
import { Game } from './Game';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const game = new Game(canvas);
game.start();
```

- [ ] **Step 5: Create stub scene files so imports resolve**

Create minimal stubs for scenes not yet implemented. Each file follows the same pattern:

`src/scenes/StageIntroScene.ts`:

```typescript
import { Scene } from './Scene';
import { Input } from '../systems/Input';
import { Game } from '../Game';

export class StageIntroScene implements Scene {
  private game: Game;
  constructor(game: Game) { this.game = game; }
  enter(_params?: Record<string, unknown>): void {}
  exit(): void {}
  handleInput(_input: Input): void {}
  update(_dt: number): void {}
  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFF';
    ctx.font = '20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('STAGE INTRO (TODO)', 256, 208);
  }
}
```

`src/scenes/GameScene.ts`:

```typescript
import { Scene } from './Scene';
import { Input } from '../systems/Input';
import { Game } from '../Game';

export class GameScene implements Scene {
  private game: Game;
  constructor(game: Game) { this.game = game; }
  enter(_params?: Record<string, unknown>): void {}
  exit(): void {}
  handleInput(_input: Input): void {}
  update(_dt: number): void {}
  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFF';
    ctx.font = '20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME SCENE (TODO)', 256, 208);
  }
}
```

`src/scenes/ScoreScene.ts`:

```typescript
import { Scene } from './Scene';
import { Input } from '../systems/Input';
import { Game } from '../Game';

export class ScoreScene implements Scene {
  private game: Game;
  constructor(game: Game) { this.game = game; }
  enter(_params?: Record<string, unknown>): void {}
  exit(): void {}
  handleInput(_input: Input): void {}
  update(_dt: number): void {}
  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFF';
    ctx.font = '20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SCORE SCENE (TODO)', 256, 208);
  }
}
```

`src/scenes/GameOverScene.ts`:

```typescript
import { Scene } from './Scene';
import { Input } from '../systems/Input';
import { Game } from '../Game';

export class GameOverScene implements Scene {
  private game: Game;
  constructor(game: Game) { this.game = game; }
  enter(_params?: Record<string, unknown>): void {}
  exit(): void {}
  handleInput(_input: Input): void {}
  update(_dt: number): void {}
  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFF';
    ctx.font = '20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER (TODO)', 256, 208);
  }
}
```

`src/scenes/MapEditorScene.ts`:

```typescript
import { Scene } from './Scene';
import { Input } from '../systems/Input';
import { Game } from '../Game';

export class MapEditorScene implements Scene {
  private game: Game;
  constructor(game: Game) { this.game = game; }
  enter(_params?: Record<string, unknown>): void {}
  exit(): void {}
  handleInput(_input: Input): void {}
  update(_dt: number): void {}
  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFF';
    ctx.font = '20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MAP EDITOR (TODO)', 256, 208);
  }
}
```

- [ ] **Step 6: Verify and test menu visually**

Run: `npx vite --open`

Expected: Browser opens showing the main menu with "BATTLE CITY" title, 3 menu options, and ▲▼ navigation working.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add game loop, scene system, and menu scene"
```

---

### Task 8: Stage Intro Scene + Game Scene (Core Gameplay)

**Files:**
- Modify: `src/scenes/StageIntroScene.ts`
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Write StageIntroScene.ts**

Replace `src/scenes/StageIntroScene.ts`:

```typescript
import { CANVAS_WIDTH, CANVAS_HEIGHT, STAGE_INTRO_DURATION, COLORS } from '../constants';
import { Scene } from './Scene';
import { Input } from '../systems/Input';
import { Game } from '../Game';

export class StageIntroScene implements Scene {
  private game: Game;
  private levelIndex = 0;
  private timer = 0;

  constructor(game: Game) {
    this.game = game;
  }

  enter(params?: Record<string, unknown>): void {
    this.levelIndex = (params?.levelIndex as number) ?? 0;
    this.timer = 0;
  }

  exit(): void {}

  handleInput(_input: Input): void {}

  update(dt: number): void {
    this.timer += dt;
    if (this.timer >= STAGE_INTRO_DURATION) {
      this.game.switchScene('game', { levelIndex: this.levelIndex });
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Gray background (like FC original)
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Stage text with curtain animation
    const progress = Math.min(this.timer / STAGE_INTRO_DURATION, 1);
    const curtainWidth = CANVAS_WIDTH * (1 - progress);

    // Draw curtains
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, curtainWidth / 2, CANVAS_HEIGHT);
    ctx.fillRect(CANVAS_WIDTH - curtainWidth / 2, 0, curtainWidth / 2, CANVAS_HEIGHT);

    // Stage text
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`STAGE ${this.levelIndex + 1}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  }
}
```

- [ ] **Step 2: Write GameScene.ts — core gameplay**

Replace `src/scenes/GameScene.ts`:

```typescript
import {
  GAME_AREA_WIDTH, GAME_AREA_HEIGHT, HUD_WIDTH, CANVAS_HEIGHT,
  PLAYER_SPAWN, CELL_SIZE, TANK_SIZE, COLORS, PLAYER_LIVES,
} from '../constants';
import { LevelData, EnemyType, LevelScore } from '../types';
import { Scene } from './Scene';
import { Input } from '../systems/Input';
import { Game } from '../Game';
import { GameMap } from '../systems/Map';
import { BulletManager } from '../systems/BulletManager';
import { EnemyManager } from '../systems/EnemyManager';
import { PlayerTank } from '../entities/PlayerTank';
import { Tank } from '../entities/Tank';

import level01 from '../data/levels/level-01.json';
import level02 from '../data/levels/level-02.json';
import level03 from '../data/levels/level-03.json';
import level04 from '../data/levels/level-04.json';
import level05 from '../data/levels/level-05.json';

const LEVELS: LevelData[] = [level01, level02, level03, level04, level05];

export class GameScene implements Scene {
  private game: Game;
  private map: GameMap;
  private bulletManager: BulletManager;
  private enemyManager: EnemyManager;
  private player: PlayerTank;
  private levelIndex = 0;
  private score = 0;
  private levelScore: LevelScore = { basic: 0, fast: 0, power: 0, armor: 0 };
  private input: Input | null = null;
  private isCustomLevel = false;
  private customLevelData: LevelData | null = null;

  constructor(game: Game) {
    this.game = game;
    this.map = new GameMap();
    this.bulletManager = new BulletManager();
    this.enemyManager = new EnemyManager();
    this.player = new PlayerTank(PLAYER_SPAWN.x * CELL_SIZE, PLAYER_SPAWN.y * CELL_SIZE);
  }

  enter(params?: Record<string, unknown>): void {
    this.levelIndex = (params?.levelIndex as number) ?? 0;
    this.isCustomLevel = !!(params?.customLevel);
    this.customLevelData = (params?.customLevel as LevelData) ?? null;

    if (params?.keepScore) {
      // Continuing from previous level
    } else {
      this.score = 0;
      this.player = new PlayerTank(PLAYER_SPAWN.x * CELL_SIZE, PLAYER_SPAWN.y * CELL_SIZE);
    }

    this.levelScore = { basic: 0, fast: 0, power: 0, armor: 0 };
    this.bulletManager = new BulletManager();
    this.enemyManager = new EnemyManager();

    // Load level
    const levelData = this.isCustomLevel ? this.customLevelData! : LEVELS[this.levelIndex % LEVELS.length];
    this.map.loadLevel(levelData);
    this.enemyManager.initLevel(levelData.enemies);

    // Position player
    this.player.x = PLAYER_SPAWN.x * CELL_SIZE;
    this.player.y = PLAYER_SPAWN.y * CELL_SIZE;
    this.player.active = true;
    this.player.hp = 1;
  }

  exit(): void {}

  handleInput(input: Input): void {
    this.input = input;
  }

  update(dt: number): void {
    if (!this.input) return;

    // Update map (river animation)
    this.map.update(dt);

    // Update player
    const allTanks: Tank[] = [this.player, ...this.enemyManager.activeEnemies];
    const newPlayerBullet = this.player.update(dt, this.input, this.map, allTanks);
    if (newPlayerBullet) {
      this.bulletManager.addBullet(newPlayerBullet);
    }

    // Update enemies
    this.enemyManager.update(dt, this.map, allTanks, this.player.center);

    // Collect enemy bullets
    const enemyBullets = this.enemyManager.getEnemyBullets();
    for (const b of enemyBullets) {
      // Enemy bullets are already being updated by EnemyTank
      // We need to add them to BulletManager for collision detection
      // But we only add new ones - track which are already added
    }

    // Update bullet manager
    this.bulletManager.update(dt);

    // Process collisions
    const result = this.bulletManager.processCollisions(
      this.map, this.player, this.enemyManager.activeEnemies
    );

    // Add score
    this.score += result.score;
    for (const [type, count] of Object.entries(result.enemyKills)) {
      this.levelScore[type as EnemyType] += count as number;
    }

    // Handle player death
    if (result.playerHit) {
      if (this.player.lives > 0) {
        this.player.respawn(PLAYER_SPAWN.x * CELL_SIZE, PLAYER_SPAWN.y * CELL_SIZE);
      } else {
        this.game.switchScene('gameOver', { score: this.score });
        return;
      }
    }

    // Handle eagle destruction
    if (result.eagleHit) {
      this.game.switchScene('gameOver', { score: this.score });
      return;
    }

    // Check level completion
    if (this.enemyManager.isLevelComplete()) {
      this.game.switchScene('score', {
        levelIndex: this.levelIndex,
        levelScore: this.levelScore,
        totalScore: this.score,
        isCustomLevel: this.isCustomLevel,
      });
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // 1. Base terrain (brick, steel, river, ice)
    this.map.renderBaseLayer(ctx);

    // 2. Bullets
    this.bulletManager.render(ctx);

    // 3. Tanks
    this.player.render(ctx);
    for (const enemy of this.enemyManager.activeEnemies) {
      enemy.render(ctx);
    }

    // 4. Spawn animation
    this.enemyManager.renderSpawnAnimation(ctx);

    // 5. Grass overlay (on top of everything)
    this.map.renderGrassLayer(ctx);

    // 6. HUD
    this.renderHUD(ctx);
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    const hx = GAME_AREA_WIDTH; // HUD starts at x=416

    // HUD background
    ctx.fillStyle = '#404040';
    ctx.fillRect(hx, 0, HUD_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = COLORS.hudText;
    ctx.textAlign = 'center';
    const cx = hx + HUD_WIDTH / 2;

    // Enemy count
    ctx.font = '12px monospace';
    ctx.fillText('ENEMY', cx, 30);
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`${this.enemyManager.remainingEnemies}`, cx, 55);

    // Stage number
    ctx.font = '12px monospace';
    ctx.fillText('STAGE', cx, 150);
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`${this.levelIndex + 1}`, cx, 175);

    // Lives
    ctx.font = '12px monospace';
    ctx.fillText('LIVES', cx, 250);
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`${this.player.lives}`, cx, 275);

    // Score
    ctx.font = '12px monospace';
    ctx.fillText('SCORE', cx, 350);
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`${this.score}`, cx, 375);
  }
}
```

- [ ] **Step 3: Handle enemy bullets in GameScene**

The `EnemyManager.getEnemyBullets()` method returns bullets that belong to enemy tanks. We need to add them to the BulletManager. Let me refine the approach: Instead of a separate tracking mechanism, enemy bullets are added to BulletManager when created. Update `GameScene.update()`:

In the `update` method, after `this.enemyManager.update(...)`, add:

```typescript
    // Add new enemy bullets to bullet manager
    for (const enemy of this.enemyManager.activeEnemies) {
      const bullet = (enemy as any).bullet;
      if (bullet && bullet.active && !this.bulletManager.hasBullet(bullet)) {
        this.bulletManager.addBullet(bullet);
      }
    }
```

And add a `hasBullet` method to `BulletManager`:

```typescript
  private bulletSet = new WeakSet<Bullet>();

  addBullet(bullet: Bullet): void {
    if (!this.bulletSet.has(bullet)) {
      this.bullets.push(bullet);
      this.bulletSet.add(bullet);
    }
  }

  hasBullet(bullet: Bullet): boolean {
    return this.bulletSet.has(bullet);
  }
```

- [ ] **Step 4: Verify and test**

Run: `npx vite --open`

Expected: Menu → select "开始游戏" → see "STAGE 1" intro → enter game scene with terrain, player tank controllable with WASD, shooting with space.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add stage intro scene and core game scene"
```

---

### Task 9: Score Scene + Game Over Scene + Level Data

**Files:**
- Modify: `src/scenes/ScoreScene.ts`
- Modify: `src/scenes/GameOverScene.ts`
- Create: `src/data/levels/level-01.json` through `level-05.json`

- [ ] **Step 1: Create 5 built-in level JSON files**

Create `src/data/levels/level-01.json`:

```json
{
  "name": "Stage 1",
  "tiles": [
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,1,0,1,0,1,0,1,0,1,0,1,0],
    [0,1,0,1,0,1,0,1,0,1,0,1,0],
    [0,1,0,1,0,1,2,1,0,1,0,1,0],
    [0,1,0,1,0,0,0,0,0,1,0,1,0],
    [0,0,0,0,0,1,0,1,0,0,0,0,0],
    [0,0,0,1,0,1,0,1,0,1,0,0,0],
    [0,1,0,1,0,0,0,0,0,1,0,1,0],
    [0,1,0,1,0,1,0,1,0,1,0,1,0],
    [0,1,0,1,0,1,0,1,0,1,0,1,0],
    [0,1,0,0,0,0,0,0,0,0,0,1,0],
    [0,1,0,0,0,1,1,1,0,0,0,1,0],
    [0,0,0,0,0,1,0,1,0,0,0,0,0]
  ],
  "enemies": { "basic": 14, "fast": 4, "power": 2, "armor": 0 }
}
```

Create `src/data/levels/level-02.json`:

```json
{
  "name": "Stage 2",
  "tiles": [
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,1,1,0,0,1,0,1,0,0,1,1,0],
    [0,1,1,0,0,1,0,1,0,0,1,1,0],
    [0,0,0,0,0,1,1,1,0,0,0,0,0],
    [0,0,1,1,0,0,0,0,0,1,1,0,0],
    [0,0,1,1,0,0,4,0,0,1,1,0,0],
    [0,0,0,0,0,4,4,4,0,0,0,0,0],
    [0,0,1,1,0,0,4,0,0,1,1,0,0],
    [0,0,1,1,0,0,0,0,0,1,1,0,0],
    [0,0,0,0,0,1,1,1,0,0,0,0,0],
    [0,1,0,0,0,0,0,0,0,0,0,1,0],
    [0,1,0,0,0,1,1,1,0,0,0,1,0],
    [0,0,0,0,0,1,0,1,0,0,0,0,0]
  ],
  "enemies": { "basic": 12, "fast": 4, "power": 2, "armor": 2 }
}
```

Create `src/data/levels/level-03.json`:

```json
{
  "name": "Stage 3",
  "tiles": [
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,2,0,1,0,0,0,0,0,1,0,2,0],
    [0,0,0,1,0,3,3,3,0,1,0,0,0],
    [0,1,0,0,0,3,0,3,0,0,0,1,0],
    [0,1,0,1,0,0,0,0,0,1,0,1,0],
    [0,0,0,1,0,1,2,1,0,1,0,0,0],
    [0,1,0,0,0,0,0,0,0,0,0,1,0],
    [0,1,0,1,0,1,2,1,0,1,0,1,0],
    [0,0,0,1,0,0,0,0,0,1,0,0,0],
    [0,1,0,0,0,3,3,3,0,0,0,1,0],
    [0,1,0,0,0,0,0,0,0,0,0,1,0],
    [0,0,0,0,0,1,1,1,0,0,0,0,0],
    [0,0,0,0,0,1,0,1,0,0,0,0,0]
  ],
  "enemies": { "basic": 10, "fast": 6, "power": 2, "armor": 2 }
}
```

Create `src/data/levels/level-04.json`:

```json
{
  "name": "Stage 4",
  "tiles": [
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,1,0,5,5,0,1,0,5,5,0,1,0],
    [0,1,0,5,5,0,1,0,5,5,0,1,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
    [1,1,0,1,1,0,2,0,1,1,0,1,1],
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,1,0,1,0,1,0,1,0,1,0,1,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
    [1,1,0,1,1,0,2,0,1,1,0,1,1],
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,1,0,0,0,0,0,0,0,0,0,1,0],
    [0,1,0,0,0,1,1,1,0,0,0,1,0],
    [0,0,0,0,0,1,0,1,0,0,0,0,0]
  ],
  "enemies": { "basic": 8, "fast": 6, "power": 4, "armor": 2 }
}
```

Create `src/data/levels/level-05.json`:

```json
{
  "name": "Stage 5",
  "tiles": [
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,2,0,2,0,1,0,1,0,2,0,2,0],
    [0,0,1,0,0,1,0,1,0,0,1,0,0],
    [0,1,1,1,0,0,0,0,0,1,1,1,0],
    [0,0,0,0,0,2,2,2,0,0,0,0,0],
    [4,4,0,1,0,0,0,0,0,1,0,4,4],
    [4,4,0,1,0,1,2,1,0,1,0,4,4],
    [4,4,0,1,0,0,0,0,0,1,0,4,4],
    [0,0,0,0,0,2,2,2,0,0,0,0,0],
    [0,1,1,1,0,0,0,0,0,1,1,1,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,1,0,0,0,1,1,1,0,0,0,1,0],
    [0,0,0,0,0,1,0,1,0,0,0,0,0]
  ],
  "enemies": { "basic": 6, "fast": 6, "power": 4, "armor": 4 }
}
```

- [ ] **Step 2: Write ScoreScene.ts**

> Note: Vite handles JSON imports natively, no declaration file needed.

Replace `src/scenes/ScoreScene.ts`:

```typescript
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS, SCORE_BASIC, SCORE_FAST, SCORE_POWER, SCORE_ARMOR } from '../constants';
import { LevelScore } from '../types';
import { Scene } from './Scene';
import { Input } from '../systems/Input';
import { Game } from '../Game';

export class ScoreScene implements Scene {
  private game: Game;
  private levelIndex = 0;
  private levelScore: LevelScore = { basic: 0, fast: 0, power: 0, armor: 0 };
  private totalScore = 0;
  private isCustomLevel = false;
  private timer = 0;

  constructor(game: Game) {
    this.game = game;
  }

  enter(params?: Record<string, unknown>): void {
    this.levelIndex = (params?.levelIndex as number) ?? 0;
    this.levelScore = (params?.levelScore as LevelScore) ?? { basic: 0, fast: 0, power: 0, armor: 0 };
    this.totalScore = (params?.totalScore as number) ?? 0;
    this.isCustomLevel = (params?.isCustomLevel as boolean) ?? false;
    this.timer = 0;
  }

  exit(): void {}

  handleInput(input: Input): void {
    if (input.isConfirm() && this.timer > 1) {
      if (this.isCustomLevel) {
        this.game.switchScene('menu');
      } else {
        this.game.switchScene('stageIntro', { levelIndex: this.levelIndex + 1 });
      }
    }
  }

  update(dt: number): void {
    this.timer += dt;
    // Auto-advance after 5 seconds
    if (this.timer >= 5 && !this.isCustomLevel) {
      this.game.switchScene('stageIntro', { levelIndex: this.levelIndex + 1 });
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const cx = CANVAS_WIDTH / 2;
    ctx.fillStyle = COLORS.hudText;
    ctx.textAlign = 'center';

    // Title
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`STAGE ${this.levelIndex + 1} CLEAR!`, cx, 60);

    // Score breakdown
    const entries: [string, number, number][] = [
      ['普通', this.levelScore.basic, SCORE_BASIC],
      ['快速', this.levelScore.fast, SCORE_FAST],
      ['强力', this.levelScore.power, SCORE_POWER],
      ['重甲', this.levelScore.armor, SCORE_ARMOR],
    ];

    ctx.font = '16px monospace';
    ctx.textAlign = 'left';
    let y = 120;

    for (const [name, count, perScore] of entries) {
      ctx.fillStyle = COLORS.hudText;
      ctx.fillText(`${name}`, cx - 120, y);
      ctx.fillText(`× ${count}`, cx - 20, y);
      ctx.fillText(`= ${count * perScore}`, cx + 60, y);
      y += 35;
    }

    // Divider
    ctx.fillStyle = '#808080';
    ctx.fillText('────────────────────', cx - 120, y);
    y += 30;

    // Total
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = COLORS.playerBody;
    ctx.fillText(`TOTAL    ${this.totalScore}`, cx - 80, y);

    // Continue prompt
    ctx.font = '12px monospace';
    ctx.fillStyle = '#808080';
    ctx.textAlign = 'center';
    if (this.timer > 1) {
      ctx.fillText('按 Enter 继续', cx, 380);
    }
  }
}
```

- [ ] **Step 3: Write GameOverScene.ts**

Replace `src/scenes/GameOverScene.ts`:

```typescript
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS } from '../constants';
import { Scene } from './Scene';
import { Input } from '../systems/Input';
import { Game } from '../Game';

export class GameOverScene implements Scene {
  private game: Game;
  private score = 0;
  private timer = 0;

  constructor(game: Game) {
    this.game = game;
  }

  enter(params?: Record<string, unknown>): void {
    this.score = (params?.score as number) ?? 0;
    this.timer = 0;
  }

  exit(): void {}

  handleInput(input: Input): void {
    if (input.isConfirm() && this.timer > 1) {
      this.game.switchScene('menu');
    }
  }

  update(dt: number): void {
    this.timer += dt;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const cx = CANVAS_WIDTH / 2;

    // Game over text with slide-up animation
    const targetY = CANVAS_HEIGHT / 2 - 20;
    const startY = CANVAS_HEIGHT;
    const progress = Math.min(this.timer / 1.5, 1);
    const y = startY + (targetY - startY) * progress;

    ctx.fillStyle = '#E04040';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', cx, y);

    if (this.timer > 1.5) {
      ctx.fillStyle = COLORS.hudText;
      ctx.font = '16px monospace';
      ctx.fillText(`SCORE: ${this.score}`, cx, y + 50);

      ctx.font = '12px monospace';
      ctx.fillStyle = '#808080';
      ctx.fillText('按 Enter 返回菜单', cx, y + 100);
    }
  }
}
```

- [ ] **Step 4: Verify and test**

Run: `npx vite --open`

Expected: Can play through a level, see score screen, game over on death.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add score scene, game over scene, and 5 built-in levels"
```

---

### Task 10: Map Editor + Storage

**Files:**
- Create: `src/utils/storage.ts`
- Modify: `src/scenes/MapEditorScene.ts`

- [ ] **Step 1: Write storage.ts**

Create `src/utils/storage.ts`:

```typescript
import { LevelData } from '../types';

const STORAGE_KEY = 'battle-city-custom-maps';

export function saveCustomMaps(maps: LevelData[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(maps));
}

export function loadCustomMaps(): LevelData[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch {
    // Corrupted data, reset
  }
  return [];
}

export function exportMap(map: LevelData): void {
  const json = JSON.stringify(map, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${map.name || 'custom-map'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importMap(): Promise<LevelData> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          resolve(data as LevelData);
        } catch {
          reject(new Error('Invalid JSON file'));
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}
```

- [ ] **Step 2: Write MapEditorScene.ts**

Replace `src/scenes/MapEditorScene.ts`:

```typescript
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, CELL_SIZE, TILE_SIZE,
  GRID_COLS, GRID_ROWS, GAME_AREA_WIDTH, GAME_AREA_HEIGHT,
  HUD_WIDTH, COLORS, EAGLE_POS, PLAYER_SPAWN, ENEMY_SPAWN_POINTS,
} from '../constants';
import { TileType, LevelData, TILE_EMPTY, TILE_BRICK, TILE_STEEL, TILE_GRASS, TILE_RIVER, TILE_ICE } from '../types';
import { Scene } from './Scene';
import { Input } from '../systems/Input';
import { Game } from '../Game';
import { PixelArt } from '../rendering/PixelArt';
import { saveCustomMaps, loadCustomMaps, exportMap, importMap } from '../utils/storage';

const TOOLBAR_HEIGHT = 36;
const EDITOR_AREA_SIZE = GRID_COLS * TILE_SIZE; // 416
const SIDEBAR_WIDTH = CANVAS_WIDTH - EDITOR_AREA_SIZE; // 96

const TERRAIN_OPTIONS: { type: TileType; label: string }[] = [
  { type: TILE_BRICK, label: '砖' },
  { type: TILE_STEEL, label: '铁' },
  { type: TILE_GRASS, label: '草' },
  { type: TILE_RIVER, label: '河' },
  { type: TILE_ICE, label: '冰' },
  { type: TILE_EMPTY, label: '空' },
];

export class MapEditorScene implements Scene {
  private game: Game;
  private grid: TileType[][] = [];
  private selectedTerrain: TileType = TILE_BRICK;
  private selectedTerrainIndex = 0;
  private isDrawing = false;
  private mouseDown = false;
  private rightMouseDown = false;
  private mouseX = 0;
  private mouseY = 0;
  private mapName = '自定义关卡';
  private enemyConfig = { basic: 10, fast: 4, power: 4, armor: 2 };
  private message = '';
  private messageTimer = 0;

  // Bound event handlers (for cleanup)
  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseUp: (e: MouseEvent) => void;
  private boundContextMenu: (e: Event) => void;

  constructor(game: Game) {
    this.game = game;
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundContextMenu = (e: Event) => e.preventDefault();
  }

  enter(): void {
    this.initGrid();
    this.selectedTerrain = TILE_BRICK;
    this.selectedTerrainIndex = 0;
    this.message = '';

    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    canvas.addEventListener('mousemove', this.boundMouseMove);
    canvas.addEventListener('mousedown', this.boundMouseDown);
    canvas.addEventListener('mouseup', this.boundMouseUp);
    canvas.addEventListener('contextmenu', this.boundContextMenu);
  }

  exit(): void {
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    canvas.removeEventListener('mousemove', this.boundMouseMove);
    canvas.removeEventListener('mousedown', this.boundMouseDown);
    canvas.removeEventListener('mouseup', this.boundMouseUp);
    canvas.removeEventListener('contextmenu', this.boundContextMenu);
  }

  private initGrid(): void {
    this.grid = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      this.grid[row] = [];
      for (let col = 0; col < GRID_COLS; col++) {
        this.grid[row][col] = TILE_EMPTY;
      }
    }
    // Place default eagle protection
    this.placeEagleProtection();
  }

  private placeEagleProtection(): void {
    // Eagle at tile (6, 12) in 13×13 grid (center bottom)
    const eagleTileRow = GRID_ROWS - 1;
    const eagleTileCol = 6;
    // Brick protection around eagle
    if (eagleTileRow - 1 >= 0) {
      this.grid[eagleTileRow - 1][eagleTileCol - 1] = TILE_BRICK;
      this.grid[eagleTileRow - 1][eagleTileCol] = TILE_BRICK;
      this.grid[eagleTileRow - 1][eagleTileCol + 1] = TILE_BRICK;
    }
    this.grid[eagleTileRow][eagleTileCol - 1] = TILE_BRICK;
    this.grid[eagleTileRow][eagleTileCol + 1] = TILE_BRICK;
  }

  private getTileAtPixel(px: number, py: number): { col: number; row: number } | null {
    const canvasY = py;
    const canvasX = px;
    // Editor area starts below toolbar
    const editorX = canvasX;
    const editorY = canvasY - TOOLBAR_HEIGHT;
    if (editorX < 0 || editorX >= EDITOR_AREA_SIZE || editorY < 0 || editorY >= EDITOR_AREA_SIZE) {
      return null;
    }
    const col = Math.floor(editorX / TILE_SIZE);
    const row = Math.floor(editorY / TILE_SIZE);
    if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS) {
      return { col, row };
    }
    return null;
  }

  private onMouseMove(e: MouseEvent): void {
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    this.mouseX = (e.clientX - rect.left) * scaleX;
    this.mouseY = (e.clientY - rect.top) * scaleY;

    if (this.mouseDown) {
      this.paintAtPixel(this.mouseX, this.mouseY);
    }
    if (this.rightMouseDown) {
      this.eraseAtPixel(this.mouseX, this.mouseY);
    }
  }

  private onMouseDown(e: MouseEvent): void {
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    if (e.button === 0) {
      // Check sidebar terrain selection
      if (px >= EDITOR_AREA_SIZE) {
        this.handleSidebarClick(px - EDITOR_AREA_SIZE, py);
        return;
      }
      // Check toolbar
      if (py < TOOLBAR_HEIGHT) {
        this.handleToolbarClick(px, py);
        return;
      }
      this.mouseDown = true;
      this.paintAtPixel(px, py);
    } else if (e.button === 2) {
      this.rightMouseDown = true;
      this.eraseAtPixel(px, py);
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) this.mouseDown = false;
    if (e.button === 2) this.rightMouseDown = false;
  }

  private paintAtPixel(px: number, py: number): void {
    const tile = this.getTileAtPixel(px, py);
    if (tile) {
      this.grid[tile.row][tile.col] = this.selectedTerrain;
    }
  }

  private eraseAtPixel(px: number, py: number): void {
    const tile = this.getTileAtPixel(px, py);
    if (tile) {
      this.grid[tile.row][tile.col] = TILE_EMPTY;
    }
  }

  private handleSidebarClick(sx: number, sy: number): void {
    // Terrain selection buttons
    const btnStartY = 50;
    const btnSize = 36;
    const btnGap = 4;
    for (let i = 0; i < TERRAIN_OPTIONS.length; i++) {
      const by = btnStartY + i * (btnSize + btnGap);
      if (sy >= by && sy < by + btnSize) {
        this.selectedTerrainIndex = i;
        this.selectedTerrain = TERRAIN_OPTIONS[i].type;
        return;
      }
    }
  }

  private handleToolbarClick(px: number, py: number): void {
    const btnWidth = 70;
    const btnGap = 8;
    const startX = 10;
    const buttons = ['新建', '保存', '导出', '测试', '返回'];
    for (let i = 0; i < buttons.length; i++) {
      const bx = startX + i * (btnWidth + btnGap);
      if (px >= bx && px < bx + btnWidth) {
        this.handleToolAction(buttons[i]);
        return;
      }
    }
  }

  private handleToolAction(action: string): void {
    switch (action) {
      case '新建':
        this.initGrid();
        this.showMessage('已创建新地图');
        break;
      case '保存':
        this.saveMap();
        break;
      case '导出':
        exportMap(this.buildLevelData());
        this.showMessage('已导出地图文件');
        break;
      case '测试':
        this.testMap();
        break;
      case '返回':
        this.game.switchScene('menu');
        break;
    }
  }

  private buildLevelData(): LevelData {
    return {
      name: this.mapName,
      tiles: this.grid.map(row => [...row]),
      enemies: { ...this.enemyConfig },
    };
  }

  private saveMap(): void {
    const maps = loadCustomMaps();
    const data = this.buildLevelData();
    // Replace existing map with same name, or add new
    const idx = maps.findIndex(m => m.name === data.name);
    if (idx >= 0) {
      maps[idx] = data;
    } else {
      maps.push(data);
    }
    saveCustomMaps(maps);
    this.showMessage('地图已保存');
  }

  private testMap(): void {
    this.game.switchScene('game', {
      levelIndex: 0,
      customLevel: this.buildLevelData(),
    });
  }

  private showMessage(msg: string): void {
    this.message = msg;
    this.messageTimer = 2;
  }

  handleInput(input: Input): void {
    // Keyboard shortcuts
    if (input.isKeyDown('Digit1')) this.selectedTerrain = TILE_BRICK;
    if (input.isKeyDown('Digit2')) this.selectedTerrain = TILE_STEEL;
    if (input.isKeyDown('Digit3')) this.selectedTerrain = TILE_GRASS;
    if (input.isKeyDown('Digit4')) this.selectedTerrain = TILE_RIVER;
    if (input.isKeyDown('Digit5')) this.selectedTerrain = TILE_ICE;
    if (input.isKeyDown('Digit6')) this.selectedTerrain = TILE_EMPTY;

    // Escape to return
    if (input.isKeyPressed('Escape')) {
      this.game.switchScene('menu');
    }
  }

  update(dt: number): void {
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.message = '';
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Toolbar background
    ctx.fillStyle = '#303030';
    ctx.fillRect(0, 0, CANVAS_WIDTH, TOOLBAR_HEIGHT);

    // Toolbar buttons
    const btnWidth = 70;
    const btnGap = 8;
    const startX = 10;
    const buttons = ['新建', '保存', '导出', '测试', '返回'];
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < buttons.length; i++) {
      const bx = startX + i * (btnWidth + btnGap);
      ctx.fillStyle = '#505050';
      ctx.fillRect(bx, 6, btnWidth, 24);
      ctx.fillStyle = COLORS.hudText;
      ctx.fillText(buttons[i], bx + btnWidth / 2, 22);
    }

    // Editor area background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, TOOLBAR_HEIGHT, EDITOR_AREA_SIZE, EDITOR_AREA_SIZE);

    // Draw grid
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const type = this.grid[row][col];
        if (type !== TILE_EMPTY) {
          // Draw 2×2 cells for each tile
          const cellCol = col * 2;
          const cellRow = row * 2;
          for (let cr = 0; cr < 2; cr++) {
            for (let cc = 0; cc < 2; cc++) {
              PixelArt.drawTerrainCell(ctx, cellCol + cc, cellRow + cr, type);
            }
          }
        }
      }
    }

    // Grid lines
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_COLS; i++) {
      const x = i * TILE_SIZE;
      ctx.beginPath();
      ctx.moveTo(x, TOOLBAR_HEIGHT);
      ctx.lineTo(x, TOOLBAR_HEIGHT + EDITOR_AREA_SIZE);
      ctx.stroke();
    }
    for (let i = 0; i <= GRID_ROWS; i++) {
      const y = TOOLBAR_HEIGHT + i * TILE_SIZE;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(EDITOR_AREA_SIZE, y);
      ctx.stroke();
    }

    // Draw fixed markers (eagle, spawn points)
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    // Eagle marker
    ctx.fillStyle = '#FFD700';
    const eagleX = 6 * TILE_SIZE + TILE_SIZE / 2;
    const eagleY = TOOLBAR_HEIGHT + 12 * TILE_SIZE + TILE_SIZE / 2;
    ctx.fillText('🦅', eagleX, eagleY + 4);
    // Player spawn
    ctx.fillStyle = COLORS.playerBody;
    const playerX = 4 * TILE_SIZE + TILE_SIZE / 2;
    const playerY = TOOLBAR_HEIGHT + 12 * TILE_SIZE + TILE_SIZE / 2;
    ctx.fillText('P', playerX, playerY + 4);
    // Enemy spawns
    ctx.fillStyle = COLORS.enemyBasic;
    for (const sp of ENEMY_SPAWN_POINTS) {
      const sx = (sp.x / 2) * TILE_SIZE + TILE_SIZE / 2;
      const sy = TOOLBAR_HEIGHT + (sp.y / 2) * TILE_SIZE + TILE_SIZE / 2;
      ctx.fillText('E', sx, sy + 4);
    }

    // Hover highlight
    const hoverTile = this.getTileAtPixel(this.mouseX, this.mouseY);
    if (hoverTile) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        hoverTile.col * TILE_SIZE,
        TOOLBAR_HEIGHT + hoverTile.row * TILE_SIZE,
        TILE_SIZE, TILE_SIZE,
      );
    }

    // Sidebar
    const sx = EDITOR_AREA_SIZE;
    ctx.fillStyle = '#303030';
    ctx.fillRect(sx, TOOLBAR_HEIGHT, SIDEBAR_WIDTH, CANVAS_HEIGHT - TOOLBAR_HEIGHT);

    // Terrain selection
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    const btnStartY = TOOLBAR_HEIGHT + 14;
    const btnSize = 36;
    const btnGap = 4;
    for (let i = 0; i < TERRAIN_OPTIONS.length; i++) {
      const by = btnStartY + i * (btnSize + btnGap);
      const isSelected = i === this.selectedTerrainIndex;

      ctx.fillStyle = isSelected ? '#606060' : '#404040';
      ctx.fillRect(sx + 8, by, SIDEBAR_WIDTH - 16, btnSize);
      if (isSelected) {
        ctx.strokeStyle = COLORS.playerBody;
        ctx.lineWidth = 2;
        ctx.strokeRect(sx + 8, by, SIDEBAR_WIDTH - 16, btnSize);
      }

      // Terrain preview color
      const previewColors = [COLORS.brick, COLORS.steel, COLORS.grass, COLORS.river, COLORS.ice, '#000'];
      ctx.fillStyle = previewColors[i];
      ctx.fillRect(sx + 14, by + 8, 20, 20);

      ctx.fillStyle = COLORS.hudText;
      ctx.fillText(TERRAIN_OPTIONS[i].label, sx + SIDEBAR_WIDTH / 2 + 10, by + 22);
    }

    // Keyboard hints
    ctx.font = '9px monospace';
    ctx.fillStyle = '#808080';
    ctx.textAlign = 'center';
    ctx.fillText('按键1-6选择地形', sx + SIDEBAR_WIDTH / 2, CANVAS_HEIGHT - 40);
    ctx.fillText('左键放置 右键擦除', sx + SIDEBAR_WIDTH / 2, CANVAS_HEIGHT - 25);
    ctx.fillText('ESC 返回菜单', sx + SIDEBAR_WIDTH / 2, CANVAS_HEIGHT - 10);

    // Status message
    if (this.message) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(EDITOR_AREA_SIZE / 2 - 80, TOOLBAR_HEIGHT + EDITOR_AREA_SIZE / 2 - 15, 160, 30);
      ctx.fillStyle = COLORS.playerBody;
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.message, EDITOR_AREA_SIZE / 2, TOOLBAR_HEIGHT + EDITOR_AREA_SIZE / 2 + 5);
    }
  }
}
```

- [ ] **Step 3: Verify and test editor**

Run: `npx vite --open`

Expected: From menu → "地图编辑器" → see grid editor with terrain palette, can draw/erase terrain, save/load works, test button enters game with custom map.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add map editor scene with save/load/export and storage utils"
```

---

### Task 11: GitHub Pages Deployment

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `vite.config.ts` (if base path needs adjustment)

- [ ] **Step 1: Create GitHub Actions deploy workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm install
      - run: npm run build

      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

- [ ] **Step 2: Verify build works locally**

Run: `npm run build`

Expected: Build succeeds, `dist/` directory contains `index.html`, JS bundle, and assets.

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Actions deploy workflow for GitHub Pages"
```

After pushing to GitHub:
1. Go to repository Settings → Pages
2. Set source to "Deploy from a branch" → `gh-pages` branch → `/ (root)`
3. Push to main and the workflow will auto-deploy

- [ ] **Step 4: Final integration test**

Run: `npx vite --open`

Play through the complete flow:
- Main menu → Start game → Stage intro → Play level → Score screen → Next level
- Main menu → Map editor → Draw map → Test → Play custom map → Return to menu
- Die → Game over → Return to menu

Expected: All flows work without errors.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final integration testing and cleanup"
```
