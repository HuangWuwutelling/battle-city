import {
  ENEMY_SPEED_BASIC, ENEMY_SPEED_FAST, ENEMY_SPEED_POWER, ENEMY_SPEED_ARMOR,
  ENEMY_BULLET_SPEED, ENEMY_BULLET_SPEED_POWER,
  AI_DIRECTION_CHANGE_MIN, AI_DIRECTION_CHANGE_MAX,
  AI_PLAYER_CHASE_CHANCE, AI_SHOOT_COOLDOWN_MIN, AI_SHOOT_COOLDOWN_MAX,
  COLORS,
} from '../constants';
import { EnemyType, Direction, Point } from '../types';
import { Tank } from './Tank';
import { Bullet } from './Bullet';
import { GameMap } from '../systems/Map';

const ENEMY_CONFIGS: Record<EnemyType, { speed: number; bulletSpeed: number; hp: number; bodyColor: string; score: number }> = {
  basic: { speed: ENEMY_SPEED_BASIC, bulletSpeed: ENEMY_BULLET_SPEED, hp: 1, bodyColor: COLORS.enemyBasic, score: 100 },
  fast:  { speed: ENEMY_SPEED_FAST,  bulletSpeed: ENEMY_BULLET_SPEED, hp: 1, bodyColor: COLORS.enemyFast,  score: 200 },
  power: { speed: ENEMY_SPEED_POWER, bulletSpeed: ENEMY_BULLET_SPEED_POWER, hp: 1, bodyColor: COLORS.enemyPower, score: 300 },
  armor: { speed: ENEMY_SPEED_ARMOR, bulletSpeed: ENEMY_BULLET_SPEED, hp: 4, bodyColor: COLORS.enemyArmor, score: 400 },
};

export class EnemyTank extends Tank {
  readonly type: EnemyType;
  readonly bulletSpeed: number;
  readonly score: number;
  private directionTimer = 0;
  private nextDirectionChange: number;
  private shootTimer: number;
  private flashTimer = 0;

  constructor(x: number, y: number, type: EnemyType, speedMult: number = 1) {
    const config = ENEMY_CONFIGS[type];
    super(x, y, config.speed * speedMult, config.hp, config.bodyColor, '#404040');
    this.type = type;
    this.bulletSpeed = config.bulletSpeed * speedMult;
    this.score = config.score;
    this.nextDirectionChange = this.randomInterval();
    this.shootTimer = this.randomShootCooldown();
  }

  private randomInterval(): number {
    return AI_DIRECTION_CHANGE_MIN + Math.random() * (AI_DIRECTION_CHANGE_MAX - AI_DIRECTION_CHANGE_MIN);
  }

  private randomShootCooldown(): number {
    return AI_SHOOT_COOLDOWN_MIN + Math.random() * (AI_SHOOT_COOLDOWN_MAX - AI_SHOOT_COOLDOWN_MIN);
  }

  private chooseDirection(playerPos: Point | null): Direction {
    const directions: Direction[] = ['up', 'down', 'left', 'right'];

    if (playerPos && Math.random() < AI_PLAYER_CHASE_CHANCE) {
      const dx = playerPos.x - this.x;
      const dy = playerPos.y - this.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        return dx > 0 ? 'right' : 'left';
      } else {
        return dy > 0 ? 'down' : 'up';
      }
    }

    return directions[Math.floor(Math.random() * 4)];
  }

  update(dt: number, map: GameMap, allTanks: Tank[], playerPos: Point | null): Bullet | null {
    if (!this.active) return null;

    // Direction change timer
    this.directionTimer += dt;
    if (this.directionTimer >= this.nextDirectionChange) {
      this.directionTimer = 0;
      this.nextDirectionChange = this.randomInterval();
      this.tryMove(this.chooseDirection(playerPos), map, allTanks);
    }

    // Try to move
    const moved = this.tryMove(this.direction, map, allTanks);
    if (!moved) {
      this.tryMove(this.chooseDirection(playerPos), map, allTanks);
      this.directionTimer = 0;
      this.nextDirectionChange = this.randomInterval();
    }

    // Shoot timer
    let newBullet: Bullet | null = null;
    this.shootTimer -= dt;
    if (this.shootTimer <= 0 && this.activeBullets.length === 0) {
      const bp = this.getBulletSpawnPoint();
      const bullet = new Bullet(bp.x, bp.y, this.direction, this.bulletSpeed, false);
      this.bullets.push(bullet);
      newBullet = bullet;
      this.shootTimer = this.randomShootCooldown();
    }

    // Update existing bullets (shared with PlayerTank/AlliedTank)
    this.updateBullets(dt, map);

    return newBullet;
  }

  takeDamage(amount: number = 1): boolean {
    this.flashTimer = 0.2;
    return super.takeDamage(amount);
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;

    if (this.flashTimer > 0) {
      this.flashTimer -= 1 / 60;
      const originalColor = this.bodyColor;
      if (Math.floor(this.flashTimer * 20) % 2 === 0) {
        this.bodyColor = COLORS.enemyPower;
      }
      super.render(ctx);
      this.bodyColor = originalColor;
      return;
    }

    super.render(ctx);
  }
}
