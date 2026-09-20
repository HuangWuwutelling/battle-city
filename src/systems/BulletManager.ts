import { CELL_SIZE, EAGLE_POS, TANK_SIZE } from '../constants';
import { TILE_BRICK, TILE_STEEL, EnemyType } from '../types';
import { Bullet } from '../entities/Bullet';
import { Tank } from '../entities/Tank';
import { EnemyTank } from '../entities/EnemyTank';
import { GameMap } from './Map';
import { rectsOverlap } from './Collision';
import { PixelArt } from '../rendering/PixelArt';
import { Audio } from './Audio';
import type { BulletSnapshot } from './Snapshot';

export interface Explosion {
  x: number;
  y: number;
  frame: number;
  timer: number;
}

export class BulletManager {
  private bullets: Bullet[] = [];
  private bulletSet = new WeakSet<Bullet>();
  explosions: Explosion[] = [];

  /**
   * @param source 子弹来源，用于选择开火音效。默认 'player'（保持向后兼容）。
   * @param options.silent 跳过音效。供 snapshot 恢复使用，避免暂停→恢复时
   *     误播一段不存在的"开火"声。其它语义与默认一致。
   */
  addBullet(
    bullet: Bullet,
    source: 'player' | 'ally' | 'enemy' = 'player',
    options: { silent?: boolean } = {},
  ): void {
    if (!this.bulletSet.has(bullet)) {
      this.bullets.push(bullet);
      this.bulletSet.add(bullet);
      if (options.silent) return;
      // 新子弹入队时立即播放开火音效
      if (source === 'ally') {
        Audio.playAllyShoot();
      } else if (source === 'enemy') {
        Audio.playEnemyShoot();
      } else {
        Audio.playShoot();
      }
    }
  }

  /**
   * Snapshot-only accessor: returns the internal bullet list in insertion
   * order (stable across a deserialize round-trip). Used by GameScene to
   * pass enemy-owned bullets to EnemyManager.applySnapshot() in the right
   * order. Not used during gameplay.
   */
  getBullets(): Bullet[] {
    return [...this.bullets];
  }

  update(dt: number): void {
    for (const b of this.bullets) {
      if (b.active) b.update();
    }

    for (const exp of this.explosions) {
      exp.timer += dt;
      if (exp.timer >= 0.1) {
        exp.timer -= 0.1;
        exp.frame++;
      }
    }
    this.compact();
  }

  /**
   * In-place swap-and-pop compaction: drops inactive bullets from
   * `this.bullets` and finished explosions (frame >= 3) from
   * `this.explosions`. Survivor order changes, but every removed element is
   * dropped and every surviving element is kept — equivalent to the prior
   * `.filter(active)` / `.filter(frame < 3)` calls. Called once per frame
   * after the per-bullet update loop, so it also cleans up the inactive
   * bullets left behind by `processCollisions`.
   */
  private compact(): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      if (!this.bullets[i].active) {
        this.bullets[i] = this.bullets[this.bullets.length - 1];
        this.bullets.pop();
      }
    }
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      if (this.explosions[i].frame >= 3) {
        this.explosions[i] = this.explosions[this.explosions.length - 1];
        this.explosions.pop();
      }
    }
  }

  private addExplosion(x: number, y: number): void {
    this.explosions.push({ x, y, frame: 0, timer: 0 });
  }

  processCollisions(
    map: GameMap,
    friendlyTanks: Tank[],
    enemies: EnemyTank[],
  ): { score: number; enemyKills: Partial<Record<EnemyType, number>>; friendlyHit: boolean; eagleHit: boolean } {
    let score = 0;
    const enemyKills: Partial<Record<EnemyType, number>> = {};
    let friendlyHit = false;
    let eagleHit = false;

    // Snapshot the active enemy bullets once. The player-bullet dispatch
    // iterates this as a sub-loop for bullet-vs-bullet without re-scanning
    // `this.bullets`. Stale entries (destroyed mid-loop) are guarded by
    // `if (!eb.active) continue;`.
    const activeEnemyBullets: Bullet[] = [];
    for (const b of this.bullets) {
      if (b.active && !b.ownerIsPlayer) activeEnemyBullets.push(b);
    }

    // Single pass over `this.bullets`. For each bullet:
    //   1. Bullet vs terrain
    //   2. Branch on `ownerIsPlayer` to dispatch into the enemy-collision
    //      sub-loop (player bullet → enemy bullets + enemies) or the
    //      friendly-collision sub-loop (enemy bullet → friendly tanks).
    for (const bullet of this.bullets) {
      if (!bullet.active) continue;

      // Bullet vs terrain
      this.checkBulletTerrain(bullet, map);
      if (!bullet.active) continue;

      if (bullet.ownerIsPlayer) {
        // Player bullet: bullet-vs-bullet sub-loop, then enemy-collision sub-loop.
        // Note: original behavior — no break; the player bullet keeps sweeping
        // through activeEnemyBullets in case its rect overlaps more than one.
        for (const eb of activeEnemyBullets) {
          if (!eb.active) continue;
          if (rectsOverlap(bullet.rect, eb.rect)) {
            bullet.destroy();
            eb.destroy();
          }
        }
        if (!bullet.active) continue;

        for (const enemy of enemies) {
          if (!enemy.active) continue;
          if (rectsOverlap(bullet.rect, enemy.rect)) {
            bullet.destroy();
            const destroyed = enemy.takeDamage();
            if (destroyed) {
              this.addExplosion(enemy.x, enemy.y);
              score += enemy.score;
              enemyKills[enemy.type] = (enemyKills[enemy.type] || 0) + 1;
              Audio.playTankExplode();
            }
            break; // player bullet is consumed
          }
        }
      } else {
        // Enemy bullet: friendly-collision sub-loop.
        for (const tank of friendlyTanks) {
          if (!tank.active) continue;
          // isInvincible is on the Tank base; PlayerTank overrides for spawn protection,
          // AlliedTank/EnemyTank inherit the default (false).
          if (tank.isInvincible) continue;
          if (rectsOverlap(bullet.rect, tank.rect)) {
            bullet.destroy();
            const destroyed = tank.takeDamage();
            if (destroyed) {
              this.addExplosion(tank.x, tank.y);
              friendlyHit = true;
              Audio.playTankExplode();
            }
            break; // enemy bullet is consumed
          }
        }
      }
    }

    // Eagle check (short-circuit when eagle is already dead).
    if (map.isEagleAlive()) {
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
          Audio.playEagleDestroyed();
        }
      }
    }

    return { score, enemyKills, friendlyHit, eagleHit };
  }

  private checkBulletTerrain(bullet: Bullet, map: GameMap): void {
    const bRect = bullet.rect;
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
            Audio.playBrickBreak();
            return;
          }
          if (cellType === TILE_STEEL) {
            bullet.destroy();
            Audio.playSteelHit();
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

  /**
   * Serialize the bullet list. Replaces the previous
   * `(this.bulletManager as unknown as { bullets: Bullet[] }).bullets` cast
   * in GameScene.saveSnapshot.
   */
  serialize(): BulletSnapshot[] {
    return this.bullets.map(b => ({
      x: b.x,
      y: b.y,
      direction: b.direction,
      speed: b.speed,
      ownerIsPlayer: b.ownerIsPlayer,
      active: b.active,
    }));
  }

  /**
   * Static factory: build a fresh BulletManager and re-add every snapshotted
   * bullet in order. Restore is silent (no audio) — see `addBullet`'s
   * `silent` option. The order of `snapshots` is preserved (a stable sort),
   * which matters for enemy bullets: EnemyManager.deserialize matches them
   * to enemies positionally.
   */
  static deserialize(snapshots: BulletSnapshot[]): BulletManager {
    const mgr = new BulletManager();
    for (const b of snapshots) {
      const bullet = new Bullet(b.x, b.y, b.direction, b.speed, b.ownerIsPlayer);
      bullet.active = b.active;
      mgr.addBullet(bullet, b.ownerIsPlayer ? 'player' : 'enemy', { silent: true });
    }
    return mgr;
  }
}