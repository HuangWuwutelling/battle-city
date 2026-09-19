// Difficulty type (defined in src/types.ts, added in Task 2)
import type { Difficulty } from './types';

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
export const ALLY_LIVES = 3;
export const INVINCIBLE_DURATION = 3; // seconds

// Ally (co-op AI) tank
export const ALLY_SPEED = 2;
export const ALLY_BULLET_SPEED = 6;
export const ALLY_MAX_BULLETS = 1;
export const ALLY_SHOOT_COOLDOWN = 0.4;
export const ALLY_DIRECTION_CHANGE_MIN = 1.5;
export const ALLY_DIRECTION_CHANGE_MAX = 3;
export const ALLY_AGGRO_RANGE = 200;
export const ALLY_NEAR_EAGLE_DISTANCE = 96;

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
export const PLAYER1_SPAWN = PLAYER_SPAWN;       // 别名，便于多人语义一致
export const PLAYER2_SPAWN = { x: 16, y: 24 };
export const PLAYER_SPAWN_COOP = { x: 8, y: 24 };
export const ALLY_SPAWN = { x: 4, y: 24 };
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
  player1Body: '#FFD700',
  player1Track: '#AA8800',
  player2Body: '#FFA500',
  player2Track: '#A05800',
  allyBody: '#00BFFF',
  allyTrack: '#0070A0',
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

// Difficulty configuration
export const DIFFICULTY: Record<Difficulty, { speedMult: number; countMult: number }> = {
  easy:   { speedMult: 0.75, countMult: 0.7 },
  medium: { speedMult: 1.0,  countMult: 1.0 },
  hard:   { speedMult: 1.25, countMult: 1.3 },
};
