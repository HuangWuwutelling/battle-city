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
