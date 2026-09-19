import type { Difficulty } from '../types';

// 简单的 localStorage 存档：当前可继续的最高关卡 + 累计得分
const SAVE_KEY = 'battle-city-save-v1';

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
};
