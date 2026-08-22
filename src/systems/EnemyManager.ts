import {
  MAX_ACTIVE_ENEMIES, SPAWN_INTERVAL, SPAWN_ANIMATION_DURATION,
  ENEMY_SPAWN_POINTS, CELL_SIZE, TANK_SIZE,
} from '../constants';
import { EnemyType, EnemyConfig, Point } from '../types';
import { EnemyTank } from '../entities/EnemyTank';
import { Bullet } from '../entities/Bullet';
import { Tank } from '../entities/Tank';
import { GameMap } from './Map';
import { PixelArt } from '../rendering/PixelArt';

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

  initLevel(enemies: { basic: number; fast: number; power: number; armor: number }): void {
    this.spawnQueue = [];
    this.activeEnemies = [];
    this.spawnTimer = 0;
    this.currentSpawnIndex = 0;
    this.spawning = null;

    const queue: EnemyConfig[] = [];
    for (let i = 0; i < enemies.basic; i++) queue.push({ type: 'basic' });
    for (let i = 0; i < enemies.fast; i++) queue.push({ type: 'fast' });
    for (let i = 0; i < enemies.power; i++) queue.push({ type: 'power' });
    for (let i = 0; i < enemies.armor; i++) queue.push({ type: 'armor' });

    // Shuffle
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }

    this.spawnQueue = queue;
  }

  get remainingEnemies(): number {
    return this.spawnQueue.length + this.activeEnemies.filter(e => e.active).length + (this.spawning ? 1 : 0);
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
      return;
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
        // Bullet will be picked up by BulletManager via getEnemyBullets
      }
    }

    // Clean up dead enemies
    this.activeEnemies = this.activeEnemies.filter(e => e.active);
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

  getEnemyBullets(): Bullet[] {
    return this.activeEnemies
      .filter(e => e.active)
      .map(e => e.bullet)
      .filter((b): b is Bullet => b != null && b.active);
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
