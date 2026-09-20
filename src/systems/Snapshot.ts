import type {
  Direction, Difficulty, EnemyType, GameMode, LevelData, LevelScore, TileType,
} from '../types';

/**
 * Typed snapshot schema (Task 4).
 *
 * Replaces the prior `as unknown as { ... }` casts in GameScene that silently
 * dropped new entity fields when the interface evolved. Adding a new field
 * to any tank subclass now produces a compile error in `serialize()`, so
 * the snapshot stays in sync with the class.
 *
 * The on-disk schema is versioned (`SNAPSHOT_VERSION = 2`). Legacy v1
 * snapshots from before this refactor are still readable: Save.loadSnapshot()
 * migrates them through `migrateV1ToV2` on load. They are never written by
 * current code.
 */
export const SNAPSHOT_VERSION = 2;

export interface PlayerTankSnapshot {
  kind: 'player';
  playerIndex: 0 | 1;
  x: number;
  y: number;
  direction: Direction;
  lives: number;
  hp: number;
  active: boolean;
  invincibleTimer: number;
}

export interface AlliedTankSnapshot {
  kind: 'ally';
  x: number;
  y: number;
  direction: Direction;
  lives: number;
  hp: number;
  active: boolean;
  directionTimer: number;
  nextDirectionChange: number;
  shootTimer: number;
}

export interface EnemyTankSnapshot {
  kind: 'enemy';
  type: EnemyType;
  x: number;
  y: number;
  direction: Direction;
  hp: number;
  active: boolean;
  directionTimer: number;
  nextDirectionChange: number;
  shootTimer: number;
  flashTimer: number;
  hasBullet: boolean;
}

/** Discriminated union of every per-tank snapshot. */
export type TankSnapshot = PlayerTankSnapshot | AlliedTankSnapshot | EnemyTankSnapshot;

export interface BulletSnapshot {
  x: number;
  y: number;
  direction: Direction;
  speed: number;
  ownerIsPlayer: boolean;
  active: boolean;
}

export interface MapSnapshot {
  cells: TileType[][];
  eagleAlive: boolean;
}

export interface EnemyManagerSnapshot {
  currentSpeedMult: number;
  remainingEnemies: number;
  enemies: EnemyTankSnapshot[];
}

/**
 * Current on-disk schema. Written by GameScene.saveSnapshot() and read by
 * GameScene.restoreFromSnapshot() via Save.loadSnapshot().
 */
export interface GameSnapshot {
  version: 2;
  savedAt: number;
  levelIndex: number;
  mode: GameMode;
  difficulty: Difficulty;
  score: number;
  levelScore: LevelScore;
  isCustomLevel: boolean;
  customLevelData: LevelData | null;
  map: MapSnapshot;
  players: PlayerTankSnapshot[];
  ally: AlliedTankSnapshot | null;
  enemies: EnemyManagerSnapshot;
  bullets: BulletSnapshot[];
}

/**
 * Legacy v1 snapshot. Kept only for migration of existing localStorage
 * saves. Field set matches the pre-Task-4 `GameSnapshot` interface in
 * Save.ts: same names, no `kind` discriminator, `map.cells` is `number[][]`
 * not `TileType[][]`, and `enemies` is a flat array with a separate
 * `remainingEnemies` field rather than nested in an EnemyManagerSnapshot.
 *
 * Treat all fields as `unknown` on read; `migrateV1ToV2` validates them.
 */
export interface LegacyGameSnapshotV1 {
  version: 1;
  savedAt?: number;
  levelIndex?: number;
  mode?: GameMode;
  difficulty?: Difficulty;
  score?: number;
  levelScore?: LevelScore;
  isCustomLevel?: boolean;
  customLevelData?: LevelData | null;
  map?: { cells?: unknown; eagleAlive?: boolean };
  players?: unknown[];
  ally?: unknown;
  enemies?: unknown[];
  remainingEnemies?: number;
  bullets?: unknown[];
}

/**
 * Migrate a legacy v1 snapshot to the current v2 schema. Performs shallow
 * validation (required number/string fields present) and falls back to
 * defaults for anything missing so a partially-corrupted save doesn't
 * silently brick the restore flow. Returns null if the snapshot is too
 * damaged to be usable (e.g. wrong root shape).
 */
export function migrateV1ToV2(raw: LegacyGameSnapshotV1): GameSnapshot | null {
  const num = (v: unknown, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;

  const bool = (v: unknown, fallback: boolean): boolean =>
    typeof v === 'boolean' ? v : fallback;

  // Map.cells: v1 had `number[][]`; v2 wants `TileType[][]` which is just
  // `number[]` of width 26×26. Accept any nested number arrays and cast.
  const v1Map = raw.map;
  const v2Cells: TileType[][] = [];
  if (v1Map && Array.isArray(v1Map.cells)) {
    for (const row of v1Map.cells) {
      if (!Array.isArray(row)) return null;
      v2Cells.push(row.map((c) => (typeof c === 'number' ? (c as TileType) : 0)));
    }
  } else {
    return null; // map is mandatory
  }

  // Players
  if (!Array.isArray(raw.players)) return null;
  const players: PlayerTankSnapshot[] = [];
  for (const p of raw.players) {
    if (!p || typeof p !== 'object') return null;
    const pp = p as Record<string, unknown>;
    const playerIndex = pp.playerIndex === 1 ? 1 : 0;
    players.push({
      kind: 'player',
      playerIndex: playerIndex as 0 | 1,
      x: num(pp.x, 0),
      y: num(pp.y, 0),
      direction: (pp.direction as Direction) ?? 'up',
      lives: num(pp.lives, 0),
      hp: num(pp.hp, 1),
      active: bool(pp.active, true),
      invincibleTimer: num(pp.invincibleTimer, 0),
    });
  }

  // Ally
  let ally: AlliedTankSnapshot | null = null;
  if (raw.ally && typeof raw.ally === 'object') {
    const a = raw.ally as Record<string, unknown>;
    ally = {
      kind: 'ally',
      x: num(a.x, 0),
      y: num(a.y, 0),
      direction: (a.direction as Direction) ?? 'up',
      lives: num(a.lives, 0),
      hp: num(a.hp, 1),
      active: bool(a.active, true),
      directionTimer: num(a.directionTimer, 0),
      nextDirectionChange: num(a.nextDirectionChange, 1),
      shootTimer: num(a.shootTimer, 0),
    };
  }

  // Enemies
  if (!Array.isArray(raw.enemies)) return null;
  const enemies: EnemyTankSnapshot[] = [];
  for (const e of raw.enemies) {
    if (!e || typeof e !== 'object') return null;
    const ee = e as Record<string, unknown>;
    enemies.push({
      kind: 'enemy',
      type: (ee.type as EnemyType) ?? 'basic',
      x: num(ee.x, 0),
      y: num(ee.y, 0),
      direction: (ee.direction as Direction) ?? 'up',
      hp: num(ee.hp, 1),
      active: bool(ee.active, true),
      directionTimer: num(ee.directionTimer, 0),
      nextDirectionChange: num(ee.nextDirectionChange, 1),
      shootTimer: num(ee.shootTimer, 0),
      flashTimer: num(ee.flashTimer, 0),
      hasBullet: bool(ee.hasBullet, false),
    });
  }

  // Bullets
  if (!Array.isArray(raw.bullets)) return null;
  const bullets: BulletSnapshot[] = [];
  for (const b of raw.bullets) {
    if (!b || typeof b !== 'object') return null;
    const bb = b as Record<string, unknown>;
    bullets.push({
      x: num(bb.x, 0),
      y: num(bb.y, 0),
      direction: (bb.direction as Direction) ?? 'up',
      speed: num(bb.speed, 4),
      ownerIsPlayer: bool(bb.ownerIsPlayer, true),
      active: bool(bb.active, true),
    });
  }

  return {
    version: SNAPSHOT_VERSION,
    savedAt: num(raw.savedAt, Date.now()),
    levelIndex: num(raw.levelIndex, 0),
    mode: (raw.mode as GameMode) ?? 'single',
    difficulty: (raw.difficulty as Difficulty) ?? 'medium',
    score: num(raw.score, 0),
    levelScore: {
      basic: num(raw.levelScore?.basic, 0),
      fast: num(raw.levelScore?.fast, 0),
      power: num(raw.levelScore?.power, 0),
      armor: num(raw.levelScore?.armor, 0),
    },
    isCustomLevel: bool(raw.isCustomLevel, false),
    customLevelData: (raw.customLevelData as LevelData) ?? null,
    map: {
      cells: v2Cells,
      eagleAlive: bool(v1Map.eagleAlive, true),
    },
    players,
    ally,
    enemies: {
      currentSpeedMult: 1, // v1 didn't carry this; medium default
      remainingEnemies: num(raw.remainingEnemies, enemies.length),
      enemies,
    },
    bullets,
  };
}