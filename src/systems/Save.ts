import type { Difficulty } from '../types';
import {
  GameSnapshot, LegacyGameSnapshotV1, SNAPSHOT_VERSION, migrateV1ToV2,
} from './Snapshot';

// Re-export the current schema so callers (`GameScene`, `StageIntroScene`)
// can keep importing `GameSnapshot` from this module.
export type { GameSnapshot } from './Snapshot';

// 简单的 localStorage 存档：当前可继续的最高关卡 + 累计得分
const SAVE_KEY = 'battle-city-save-v1';

// 暂停时保存的完整游戏状态快照（用于主菜单"继续关卡"恢复）
// v2 键：与 v1 键不同，避免旧版 v1 格式与新版 v2 格式互相覆盖造成迁移失败
const SNAPSHOT_KEY = `battle-city-snapshot-v${SNAPSHOT_VERSION}`;

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
 * `GameSnapshot` was previously defined here. It's now in `./Snapshot` so the
 * schema lives next to the entity serialize/deserialize methods. Importing
 * it from this module still works (see re-export above).
 */

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

  /**
   * Read the current snapshot. If the on-disk payload is in the legacy v1
   * format (older pre-Task-4 saves), it is migrated to v2 in memory and
   * then re-written under the v2 key so subsequent loads skip the
   * migration. If the payload is in an unrecognised version (neither 1
   * nor 2), it's treated as missing — the user gets a fresh game instead
   * of a half-broken restore.
   */
  loadSnapshot(): GameSnapshot | null {
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GameSnapshot> & { version?: unknown };
        if (parsed.version === SNAPSHOT_VERSION) {
          return parsed as GameSnapshot;
        }
        // unknown future version → refuse
        return null;
      }

      // No v2 save found. Try legacy v1 keys (one per pre-migration release).
      for (const legacyKey of ['battle-city-snapshot-v1']) {
        const legacyRaw = localStorage.getItem(legacyKey);
        if (!legacyRaw) continue;
        const legacy = JSON.parse(legacyRaw) as LegacyGameSnapshotV1;
        if (legacy.version !== 1) continue;
        const migrated = migrateV1ToV2(legacy);
        if (!migrated) continue;
        // Persist under the v2 key so next load is fast.
        Save.saveSnapshot(migrated);
        return migrated;
      }
      return null;
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
    // Also clear any legacy v1 keys left behind from before the migration,
    // so they don't shadow future saves if the user ever downgrades.
    try {
      localStorage.removeItem('battle-city-snapshot-v1');
    } catch {
      // ignore
    }
  },
};