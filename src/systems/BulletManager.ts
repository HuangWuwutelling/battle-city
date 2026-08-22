import { CELL_SIZE, EAGLE_POS, TANK_SIZE } from '../constants';
import { TILE_BRICK, TILE_STEEL, EnemyType } from '../types';
import { Bullet } from '../entities/Bullet';
import { PlayerTank } from '../entities/PlayerTank';
import { EnemyTank } from '../entities/EnemyTank';
import { GameMap } from './Map';
import { rectsOverlap } from './Collision';
import { PixelArt } from '../rendering/PixelArt';

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

  addBullet(bullet: Bullet): void {
    if (!this.bulletSet.has(bullet)) {
      this.bullets.push(bullet);
      this.bulletSet.add(bullet);
    }
  }

  hasBullet(bullet: Bullet): boolean {
    return this.bulletSet.has(bullet);
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
    this.explosions = this.explosions.filter(e => e.frame < 3);

    this.bullets = this.bullets.filter(b => b.active);
  }

  private addExplosion(x: number, y: number): void {
    this.explosions.push({ x, y, frame: 0, timer: 0 });
  }

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

    // Bullet vs bullet
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
