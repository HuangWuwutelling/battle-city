import {
  ALLY_SPEED, ALLY_BULLET_SPEED, ALLY_MAX_BULLETS, ALLY_SHOOT_COOLDOWN,
  ALLY_DIRECTION_CHANGE_MIN, ALLY_DIRECTION_CHANGE_MAX,
  ALLY_AGGRO_RANGE, ALLY_NEAR_EAGLE_DISTANCE, EAGLE_POS,
  CELL_SIZE, COLORS, ALLY_LIVES,
} from '../constants';
import { Direction, Point } from '../types';
import { Tank } from './Tank';
import { Bullet } from './Bullet';
import { GameMap } from '../systems/Map';

/**
 * 合作模式下的 AI 友军坦克
 * 复用 PlayerTank 的大部分行为（共用生命池）
 * 中等 AI 策略:
 *   1. 视野内发现敌人 → 朝最近敌人方向追击 + 攻击
 *   2. 离基地近且视野无敌人 → 守卫基地（在基地四周巡逻）
 *   3. 其他情况 → 随机游走 + 遇墙换方向
 */
export class AlliedTank extends Tank {
  lives: number;
  private directionTimer = 0;
  private nextDirectionChange: number;
  private shootTimer: number;
  bullets: Bullet[] = [];

  constructor(x: number, y: number) {
    // 友军颜色用青色与敌人明显区分（亮青 #00BFFF）
    super(x, y, ALLY_SPEED, 1, COLORS.allyBody, COLORS.allyTrack);
    this.lives = ALLY_LIVES;
    this.nextDirectionChange = this.randomInterval();
    this.shootTimer = ALLY_SHOOT_COOLDOWN;
  }

  get activeBullets(): Bullet[] {
    return this.bullets.filter(b => b.active);
  }

  private randomInterval(): number {
    return ALLY_DIRECTION_CHANGE_MIN +
      Math.random() * (ALLY_DIRECTION_CHANGE_MAX - ALLY_DIRECTION_CHANGE_MIN);
  }

  /**
   * 在给定方向上预瞄几格，检查是否有障碍物/墙
   * 用于避免朝墙直撞
   */
  private canMove(dir: Direction, map: GameMap, allTanks: Tank[]): boolean {
    const probe = 16; // 探一格
    let nx = this.x;
    let ny = this.y;
    switch (dir) {
      case 'up':    ny -= probe; break;
      case 'down':  ny += probe; break;
      case 'left':  nx -= probe; break;
      case 'right': nx += probe; break;
    }
    if (nx < 0 || nx + 32 > 416 || ny < 0 || ny + 32 > 416) return false;
    const startCol = Math.floor(nx / CELL_SIZE);
    const endCol = Math.floor((nx + 31) / CELL_SIZE);
    const startRow = Math.floor(ny / CELL_SIZE);
    const endRow = Math.floor((ny + 31) / CELL_SIZE);
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        if (!map.isPassable(col, row)) return false;
      }
    }
    for (const other of allTanks) {
      if (other === this || !other.active) continue;
      if (nx < other.x + 32 && nx + 32 > other.x &&
          ny < other.y + 32 && ny + 32 > other.y) {
        return false;
      }
    }
    return true;
  }

  private distance(a: Point, b: Point): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 选择下一步方向
   * 优先级: 1) 朝最近敌人  2) 守卫基地  3) 随机但避墙
   */
  private chooseDirection(
    map: GameMap,
    allTanks: Tank[],
    enemies: Tank[],
  ): Direction {
    const myCenter = this.center;

    // 1. 视野内有敌人 → 追击
    let nearestEnemy: Tank | null = null;
    let nearestDist = Infinity;
    for (const e of enemies) {
      if (!e.active) continue;
      const d = this.distance(myCenter, e.center);
      if (d < nearestDist) {
        nearestDist = d;
        nearestEnemy = e;
      }
    }
    if (nearestEnemy && nearestDist < ALLY_AGGRO_RANGE) {
      const dx = nearestEnemy.x - this.x;
      const dy = nearestEnemy.y - this.y;
      const candidates: Direction[] =
        Math.abs(dx) > Math.abs(dy)
          ? (dx > 0 ? ['right', 'up', 'down'] : ['left', 'up', 'down'])
          : (dy > 0 ? ['down', 'left', 'right'] : ['up', 'left', 'right']);
      for (const dir of candidates) {
        if (this.canMove(dir, map, allTanks)) return dir;
      }
    }

    // 2. 离基地近 → 守基地（在基地四个方位之间巡逻）
    const eaglePx = EAGLE_POS.x * CELL_SIZE;
    const eaglePy = EAGLE_POS.y * CELL_SIZE;
    const distToEagle = this.distance(myCenter, { x: eaglePx, y: eaglePy });
    if (distToEagle < ALLY_NEAR_EAGLE_DISTANCE * 2) {
      // 站在基地上方一格，朝下面对敌人来的方向
      const guardDirs: Direction[] = ['up', 'left', 'right'];
      for (const dir of guardDirs) {
        if (this.canMove(dir, map, allTanks)) return dir;
      }
    }

    // 3. 随机但避免撞墙
    const allDirs: Direction[] = ['up', 'down', 'left', 'right'];
    // 优先保持当前方向（动量）
    if (this.canMove(this.direction, map, allTanks)) return this.direction;
    // 否则打乱顺序随机
    for (let i = allDirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allDirs[i], allDirs[j]] = [allDirs[j], allDirs[i]];
    }
    for (const dir of allDirs) {
      if (this.canMove(dir, map, allTanks)) return dir;
    }
    return this.direction;
  }

  /**
   * 是否应该朝某方向射击（视野内能看到敌人）
   */
  private hasEnemyInDirection(dir: Direction, enemies: Tank[]): boolean {
    const myCenter = this.center;
    for (const e of enemies) {
      if (!e.active) continue;
      const dx = e.x - myCenter.x;
      const dy = e.y - myCenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > ALLY_AGGRO_RANGE) continue;
      const aligned =
        (dir === 'up' && dy < 0 && Math.abs(dx) < 16) ||
        (dir === 'down' && dy > 0 && Math.abs(dx) < 16) ||
        (dir === 'left' && dx < 0 && Math.abs(dy) < 16) ||
        (dir === 'right' && dx > 0 && Math.abs(dy) < 16);
      if (aligned) return true;
    }
    return false;
  }

  update(
    dt: number,
    map: GameMap,
    allTanks: Tank[],
    enemies: Tank[],
  ): Bullet | null {
    if (!this.active) return null;

    // 更新自己射出的子弹
    for (const bullet of this.bullets) {
      if (bullet.active) bullet.update();
    }
    this.bullets = this.bullets.filter(b => b.active);

    // AI 决策 + 移动
    this.directionTimer += dt;
    if (this.directionTimer >= this.nextDirectionChange) {
      this.directionTimer = 0;
      this.nextDirectionChange = this.randomInterval();
      const newDir = this.chooseDirection(map, allTanks, enemies);
      this.tryMove(newDir, map, allTanks);
    } else {
      // 持续保持方向移动；撞墙立即换
      const moved = this.tryMove(this.direction, map, allTanks);
      if (!moved) {
        const newDir = this.chooseDirection(map, allTanks, enemies);
        this.tryMove(newDir, map, allTanks);
        this.directionTimer = 0;
        this.nextDirectionChange = this.randomInterval();
      }
    }

    // 射击
    let newBullet: Bullet | null = null;
    this.shootTimer -= dt;
    if (this.shootTimer <= 0 && this.activeBullets.length < ALLY_MAX_BULLETS) {
      // 仅在朝敌人方向时射击（避免乱开枪暴露位置）
      if (this.hasEnemyInDirection(this.direction, enemies)) {
        const bp = this.getBulletSpawnPoint();
        newBullet = new Bullet(bp.x, bp.y, this.direction, ALLY_BULLET_SPEED, 'player');
        this.bullets.push(newBullet);
        this.shootTimer = ALLY_SHOOT_COOLDOWN + Math.random() * 0.3;
      } else {
        this.shootTimer = 0.2; // 没敌人稍后再判断
      }
    }

    return newBullet;
  }

  respawn(x: number, y: number): void {
    if (this.lives <= 0) return;
    this.lives--;
    this.x = x;
    this.y = y;
    this.direction = 'up';
    this.hp = 1;
    this.active = true;
    this.bullets = [];
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;
    super.render(ctx);
  }
}
