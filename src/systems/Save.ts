import type { Direction, Difficulty, EnemyType, GameMode, LevelData, LevelScore } from '../types';

// 简单的 localStorage 存档：当前可继续的最高关卡 + 累计得分
const SAVE_KEY = 'battle-city-save-v1';

// 暂停时保存的完整游戏状态快照（用于主菜单"继续关卡"恢复）
const SNAPSHOT_KEY = 'battle-city-snapshot-v1';

export interface SaveData {
  // 玩家可以"继续"的下一关（已通关的最高关卡 + 1）
  // 例如：打到第 3 关通关 → nextLevel = 3（0-indexed，第 4 关）
  nextLevel: number;
  // 跨关累计得分（仅展示用）
  totalScore: number;
  // 最近更新时间戳
  updatedAt: number;
  // 上次选择的难度（默认 medium，向后兼容老存档）
  lastDifficulty: Difficulty;
}

/**
 * 暂停时保存的完整游戏状态。
 * 用 schema version 字段为将来兼容性/迁移留出空间。
 */
export interface GameSnapshot {
  version: 1;
  savedAt: number;
  levelIndex: number;
  mode: GameMode;
  difficulty: Difficulty;
  score: number;
  levelScore: LevelScore;
  isCustomLevel: boolean;
  customLevelData: LevelData | null;

  // 地图状态（26×26 单元 + 基地存活标志）
  map: { cells: number[][]; eagleAlive: boolean };

  // 玩家坦克
  players: Array<{
    playerIndex: 0 | 1;
    x: number; y: number;
    direction: Direction;
    lives: number;
    hp: number;
    active: boolean;
    invincibleTimer: number;
  }>;

  // AI 友军（单人或对战模式下为 null）
  ally: {
    x: number; y: number;
    direction: Direction;
    lives: number;
    hp: number;
    active: boolean;
    directionTimer: number;
    nextDirectionChange: number;
  } | null;

  // 敌人（仅保存存活的；剩余数量另算）
  enemies: Array<{
    type: EnemyType;
    x: number; y: number;
    direction: Direction;
    hp: number;
    active: boolean;
    directionTimer: number;
    nextDirectionChange: number;
    shootTimer: number;
    flashTimer: number;
    hasBullet: boolean;
  }>;
  remainingEnemies: number;

  // 当前飞行中的子弹
  bullets: Array<{
    x: number; y: number;
    direction: Direction;
    speed: number;
    ownerIsPlayer: boolean;
    active: boolean;
  }>;
}

export const Save = {
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

  save(data: SaveData): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // 隐私模式 / 配额超限，忽略
    }
  },

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

  clear(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // ignore
    }
  },

  hasSave(): boolean {
    return Save.load() !== null;
  },

  // ---------- 暂停快照 ----------

  saveSnapshot(snapshot: GameSnapshot): void {
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
    } catch {
      // 隐私模式 / 配额超限，忽略
    }
  },

  loadSnapshot(): GameSnapshot | null {
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as GameSnapshot;
      if (parsed.version !== 1) return null; // 拒绝不兼容的版本
      return parsed;
    } catch {
      return null;
    }
  },

  hasSnapshot(): boolean {
    return Save.loadSnapshot() !== null;
  },

  clearSnapshot(): void {
    try {
      localStorage.removeItem(SNAPSHOT_KEY);
    } catch {
      // ignore
    }
  },
};