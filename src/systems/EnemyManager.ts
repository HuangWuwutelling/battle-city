import {
  MAX_ACTIVE_ENEMIES, SPAWN_INTERVAL, SPAWN_ANIMATION_DURATION,
  ENEMY_SPAWN_POINTS, CELL_SIZE, TANK_SIZE,
  DIFFICULTY,
} from '../constants';
import { EnemyType, EnemyConfig, Difficulty, Point } from '../types';
import { EnemyTank } from '../entities/EnemyTank';
import { Bullet } from '../entities/Bullet';
import { Tank } from '../entities/Tank';
import { GameMap } from './Map';
import { BulletManager } from './BulletManager';
import { PixelArt } from '../rendering/PixelArt';
import type { EnemyManagerSnapshot, EnemyTankSnapshot } from './Snapshot';

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
  private currentSpeedMult = 1;
  /**
   * Number of currently-active enemies — mirrors `activeEnemies.filter(e => e.active).length`
   * exactly, maintained incrementally to avoid the per-frame filter allocation.
   * Incremented on spawn (when the spawn animation completes) and decremented
   * on kill (via the in-place compaction at the top of `update`). Read by
   * `remainingEnemies`, `isLevelComplete`, and the spawn-block cap.
   */
  private _activeCount = 0;

  initLevel(
    enemies: { basic: number; fast: number; power: number; armor: number },
    difficulty: Difficulty = 'medium',
  ): void {
    this.spawnQueue = [];
    this.activeEnemies = [];
    this._activeCount = 0;
    this.spawnTimer = 0;
    this.currentSpawnIndex = 0;
    this.spawning = null;

    const diff = DIFFICULTY[difficulty];
    this.currentSpeedMult = diff.speedMult;
    const applyMult = (n: number) => Math.max(1, Math.round(n * diff.countMult));

    const queue: EnemyConfig[] = [];
    for (let i = 0; i < applyMult(enemies.basic); i++) queue.push({ type: 'basic' });
    for (let i = 0; i < applyMult(enemies.fast); i++) queue.push({ type: 'fast' });
    for (let i = 0; i < applyMult(enemies.power); i++) queue.push({ type: 'power' });
    for (let i = 0; i < applyMult(enemies.armor); i++) queue.push({ type: 'armor' });

    // Shuffle
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }

    this.spawnQueue = queue;
  }

  get remainingEnemies(): number {
    return this.spawnQueue.length + this._activeCount + (this.spawning ? 1 : 0);
  }

  isLevelComplete(): boolean {
    return this.spawnQueue.length === 0 &&
           this._activeCount === 0 &&
           this.spawning === null;
  }

  update(dt: number, map: GameMap, allTanks: Tank[], playerPos: Point | null, bulletManager: BulletManager): void {
    // Clean up dead enemies from the previous frame's collisions FIRST, so
    // the spawn-block below (and any external reader of `_activeCount` /
    // `remainingEnemies`) sees the same active count that the previous
    // `.filter(e => e.active).length` returned. Kills happen in
    // BulletManager.processCollisions, which runs AFTER this update, so any
    // dead enemy we see here was killed last frame.
    //
    // In-place swap-and-pop: survivor order changes, but membership is
    // preserved (mirrors BulletManager.compact()). The update loop below
    // still skips inactive via `if (!enemy.active) continue;`, so the slight
    // reordering inside `activeEnemies` is harmless — AI updates are
    // order-independent and render draws each tank at its own position.
    for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
      if (!this.activeEnemies[i].active) {
        this.activeEnemies[i] = this.activeEnemies[this.activeEnemies.length - 1];
        this.activeEnemies.pop();
        this._activeCount--;
      }
    }

    // Handle spawning animation
    if (this.spawning) {
      this.spawning.timer += dt;
      if (this.spawning.timer >= SPAWN_ANIMATION_DURATION) {
        const { config, point } = this.spawning;
        const enemy = new EnemyTank(point.x * CELL_SIZE, point.y * CELL_SIZE, config.type, this.currentSpeedMult);
        this.activeEnemies.push(enemy);
        this._activeCount++;
        // 敌人诞生音效跳过：闪光动画已足够辨识，避免噪音
        this.spawning = null;
      }
      return;
    }

    // Spawn new enemies
    this.spawnTimer += dt;
    if (this.spawnTimer >= SPAWN_INTERVAL &&
        this._activeCount < MAX_ACTIVE_ENEMIES &&
        this.spawnQueue.length > 0) {
      this.spawnTimer = 0;
      this.trySpawn();
    }

    // Update active enemies. Each EnemyTank.update() returns the bullet it
    // fired this tick (or null); we register that bullet directly with the
    // shared BulletManager so enemy-owned bullets join the same collision
    // pipeline as player/ally bullets. The bullet was already moved once
    // inside EnemyTank.updateBullets, so it gets its fair-play tick of
    // motion before BulletManager.update/processCollisions run this frame.
    // BulletManager.addBullet is deduped via a WeakSet, so re-registration
    // would be a no-op if any pre-existing bullet somehow slipped through.
    for (const enemy of this.activeEnemies) {
      if (!enemy.active) continue;
      const newBullet = enemy.update(dt, map, allTanks, playerPos);
      if (newBullet) {
        bulletManager.addBullet(newBullet, 'enemy');
      }
    }
  }

  private trySpawn(): void {
    if (this.spawnQueue.length === 0) return;

    const config = this.spawnQueue.shift()!;
    const spawnPoint = ENEMY_SPAWN_POINTS[this.currentSpawnIndex % ENEMY_SPAWN_POINTS.length];
    this.currentSpawnIndex++;

    const sx = spawnPoint.x * CELL_SIZE;
    const sy = spawnPoint.y * CELL_SIZE;
    const blocked = this.activeEnemies.some(e =>
      e.active &&
      Math.abs(e.x - sx) < TANK_SIZE &&
      Math.abs(e.y - sy) < TANK_SIZE
    );

    if (blocked) {
      this.spawnQueue.unshift(config);
      return;
    }

    this.spawning = { config, point: spawnPoint, timer: 0 };
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

  /**
   * Serialize this manager's state into a typed snapshot. Replaces the
   * previous
   * `(this.enemyManager as unknown as { activeEnemies: ...; currentSpeedMult: ... })....`
   * cast in GameScene.saveSnapshot.
   *
   * Builds the enemy-snapshot array in a single pass instead of
   * `.filter(e => e.active).map(e => e.serialize())` to drop the
   * intermediate array allocation. Snapshot is not per-frame so this is a
   * minor cleanup; iteration order still matches the previous
   * filter-then-map (we iterate `activeEnemies` in its current order and
   * skip inactive, so positional parity with enemy-bullet assignment in
   * `applySnapshot` is preserved).
   */
  serialize(): EnemyManagerSnapshot {
    const enemies: EnemyTankSnapshot[] = [];
    for (const e of this.activeEnemies) {
      if (e.active) enemies.push(e.serialize());
    }
    return {
      currentSpeedMult: this.currentSpeedMult,
      remainingEnemies: this.remainingEnemies,
      enemies,
    };
  }

  /**
   * Restore this manager from a typed snapshot. Replaces the previous
   * `(this.enemyManager as unknown as { ... })....` cast in
   * GameScene.restoreFromSnapshot. `enemyBulletsInOrder` supplies the
   * enemy-owned bullets (in stable order, matching the order they were
   * added to the bullet manager); each enemy whose snapshot says
   * `hasBullet` gets the next one via EnemyTank.deserialize.
   */
  applySnapshot(snap: EnemyManagerSnapshot, enemyBulletsInOrder: Bullet[]): void {
    this.spawning = null;
    this.spawnTimer = 0;
    this.currentSpeedMult = snap.currentSpeedMult;
    this.activeEnemies = [];
    let enemyBulletCursor = 0;
    for (const eSnap of snap.enemies) {
      const bullet = eSnap.hasBullet && enemyBulletCursor < enemyBulletsInOrder.length
        ? enemyBulletsInOrder[enemyBulletCursor++]
        : undefined;
      const enemy = EnemyTank.deserialize(eSnap, snap.currentSpeedMult, bullet);
      this.activeEnemies.push(enemy);
    }
    // Rebuild a placeholder spawnQueue so `remainingEnemies` returns the
    // same total as the snapshot. The real spawn-time choices are already
    // baked into `activeEnemies`; the queue is just a counter for the HUD.
    // Every deserialized enemy comes from `snap.enemies` (serialize only
    // includes active ones), so the active count equals the array length.
    this._activeCount = this.activeEnemies.length;
    const queueLen = Math.max(0, snap.remainingEnemies - this._activeCount);
    this.spawnQueue = new Array(queueLen).fill({ type: 'basic' as EnemyType });
    this.currentSpawnIndex = this.activeEnemies.length;
  }

  static deserialize(snap: EnemyManagerSnapshot, enemyBulletsInOrder: Bullet[]): EnemyManager {
    const mgr = new EnemyManager();
    mgr.applySnapshot(snap, enemyBulletsInOrder);
    return mgr;
  }
}
